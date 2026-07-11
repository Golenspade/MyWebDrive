const STREAM = 'storage:finalize'
const DEAD_LETTER_STREAM = 'storage:finalize:dead-letter'
const GROUP = 'storage-workers'
const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type FinalizationJob = {
  id: string
  uploadIntentId: string
  objectKey: string
  parts: number
  expectedSize: bigint
  generation: string
}

export interface StreamRedis {
  ping(): Promise<unknown>
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>
  xgroup(...args: Array<string | number>): Promise<unknown>
  xreadgroup(...args: Array<string | number>): Promise<unknown>
  xautoclaim(...args: Array<string | number>): Promise<unknown>
  xack(...args: Array<string | number>): Promise<unknown>
}

const DECIMAL_FUNCTIONS = `
local function normalize(value)
  value = string.gsub(value, '^0+', '')
  if value == '' then return '0' end
  return value
end
local function add(a, b)
  a = normalize(a); b = normalize(b)
  local i = string.len(a); local j = string.len(b); local carry = 0; local out = ''
  while i > 0 or j > 0 or carry > 0 do
    local da = i > 0 and tonumber(string.sub(a, i, i)) or 0
    local db = j > 0 and tonumber(string.sub(b, j, j)) or 0
    local sum = da + db + carry
    out = tostring(sum % 10) .. out
    carry = math.floor(sum / 10); i = i - 1; j = j - 1
  end
  return normalize(out)
end
local function subtract(a, b)
  local i = string.len(a); local j = string.len(b); local borrow = 0; local out = ''
  while i > 0 do
    local da = tonumber(string.sub(a, i, i)) - borrow
    local db = j > 0 and tonumber(string.sub(b, j, j)) or 0
    if da < db then da = da + 10; borrow = 1 else borrow = 0 end
    out = tostring(da - db) .. out; i = i - 1; j = j - 1
  end
  return normalize(out)
end
local function greater(a, b)
  a = normalize(a); b = normalize(b)
  if string.len(a) ~= string.len(b) then return string.len(a) > string.len(b) end
  return a > b
end
`

const RESERVE_PART = `${DECIMAL_FUNCTIONS}
local objectKey = redis.call('HGET', KEYS[1], 'objectKey')
local maxBytes = redis.call('HGET', KEYS[1], 'maxBytes')
if objectKey and (objectKey ~= ARGV[1] or maxBytes ~= ARGV[4]) then return {'mismatch'} end
if redis.call('HGET', KEYS[1], 'frozen') == '1' then return {'frozen'} end
local field = 'part:' .. ARGV[2]
if redis.call('HEXISTS', KEYS[1], field) == 1 then return {'exists'} end
local total = redis.call('HGET', KEYS[1], 'total') or '0'
local nextTotal = add(total, ARGV[3])
if greater(nextTotal, ARGV[4]) then return {'too_large'} end
redis.call('HSET', KEYS[1], 'objectKey', ARGV[1], 'maxBytes', ARGV[4],
  'total', nextTotal, field, 'r:' .. ARGV[3] .. ':' .. ARGV[5])
redis.call('EXPIRE', KEYS[1], ARGV[6])
return {'reserved'}
`

const COMMIT_PART = `
local field = 'part:' .. ARGV[1]
local expected = 'r:' .. ARGV[2] .. ':' .. ARGV[3]
if redis.call('HGET', KEYS[1], field) ~= expected then return {'mismatch'} end
redis.call('HSET', KEYS[1], field, 'c:' .. ARGV[2])
return {'committed'}
`

const RELEASE_PART = `${DECIMAL_FUNCTIONS}
local field = 'part:' .. ARGV[1]
local expected = 'r:' .. ARGV[2] .. ':' .. ARGV[3]
if redis.call('HGET', KEYS[1], field) ~= expected then return 0 end
local total = redis.call('HGET', KEYS[1], 'total') or ARGV[2]
redis.call('HDEL', KEYS[1], field)
redis.call('HSET', KEYS[1], 'total', subtract(total, ARGV[2]))
return 1
`

const FREEZE_AND_ENQUEUE = `${DECIMAL_FUNCTIONS}
if redis.call('HGET', KEYS[1], 'objectKey') ~= ARGV[1] or
   redis.call('HGET', KEYS[1], 'maxBytes') ~= ARGV[3] then return {'mismatch'} end
if redis.call('HGET', KEYS[1], 'frozen') == '1' then
  return {'replay', redis.call('HGET', KEYS[1], 'jobId'),
    redis.call('HGET', KEYS[1], 'expectedSize'), redis.call('HGET', KEYS[1], 'generation')}
end
local total = '0'
for part = 1, tonumber(ARGV[2]) do
  local value = redis.call('HGET', KEYS[1], 'part:' .. tostring(part))
  if not value then return {'incomplete'} end
  local size = string.match(value, '^c:(%d+)$')
  if not size then return {'incomplete'} end
  total = add(total, size)
end
if total == '0' or total ~= redis.call('HGET', KEYS[1], 'total') or greater(total, ARGV[3]) then
  return {'mismatch'}
end
if total ~= ARGV[3] then return {'size_mismatch'} end
local id = redis.call('XADD', KEYS[2], '*',
  'uploadIntentId', ARGV[4], 'objectKey', ARGV[1], 'parts', ARGV[2],
  'expectedSize', total, 'generation', ARGV[5])
redis.call('HSET', KEYS[1], 'frozen', '1', 'jobId', id,
  'expectedSize', total, 'generation', ARGV[5], 'parts', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[6])
return {'enqueued', id, total, ARGV[5]}
`

const DEAD_LETTER_AND_ACK = `
redis.call('XADD', KEYS[2], '*',
  'sourceEntryId', ARGV[2], 'uploadIntentId', ARGV[3],
  'objectKey', ARGV[4], 'errorCode', ARGV[5])
return redis.call('XACK', KEYS[1], ARGV[1], ARGV[2])
`

function fields(values: unknown): Record<string, string> | null {
  if (!Array.isArray(values) || values.length % 2 !== 0) return null
  const result: Record<string, string> = {}
  for (let index = 0; index < values.length; index += 2) {
    if (typeof values[index] !== 'string' || typeof values[index + 1] !== 'string') return null
    result[values[index] as string] = values[index + 1] as string
  }
  return result
}

function job(entry: unknown): FinalizationJob | null {
  if (!Array.isArray(entry) || typeof entry[0] !== 'string') return null
  const value = fields(entry[1])
  if (!value) return null
  const parts = Number(value.parts)
  if (
    !UUID_PATTERN.test(value.uploadIntentId ?? '') ||
    !UUID_PATTERN.test(value.objectKey ?? '') ||
    !Number.isInteger(parts) ||
    parts < 1 ||
    parts > 100_000
    || !/^[1-9]\d*$/.test(value.expectedSize ?? '')
    || !UUID_PATTERN.test(value.generation ?? '')
  ) return null
  return {
    id: entry[0],
    uploadIntentId: value.uploadIntentId!,
    objectKey: value.objectKey!,
    parts,
    expectedSize: BigInt(value.expectedSize!),
    generation: value.generation!,
  }
}

function entriesFromRead(value: unknown): FinalizationJob[] {
  if (!Array.isArray(value)) return []
  const firstStream = value[0]
  if (!Array.isArray(firstStream) || !Array.isArray(firstStream[1])) return []
  return firstStream[1].map(job).filter((entry): entry is FinalizationJob => entry !== null)
}

export class FinalizationQueue {
  private reclaimCursor = '0-0'
  constructor(
    private readonly redis: StreamRedis,
    private readonly consumer: string,
  ) {}

  async reservePart(input: {
    uploadIntentId: string
    objectKey: string
    partNumber: number
    sizeBytes: bigint
    maxBytes: bigint
    reservationId: string
  }): Promise<'reserved' | 'exists' | 'frozen' | 'too_large' | 'mismatch'> {
    const result = await this.redis.eval(
      RESERVE_PART, 1, `storage:upload:${input.uploadIntentId}`,
      input.objectKey, String(input.partNumber), input.sizeBytes.toString(),
      input.maxBytes.toString(), input.reservationId, String(DEDUPE_TTL_SECONDS),
    )
    const status = Array.isArray(result) ? result[0] : null
    if (!['reserved', 'exists', 'frozen', 'too_large', 'mismatch'].includes(String(status))) {
      throw new Error('upload ledger unavailable')
    }
    return String(status) as 'reserved' | 'exists' | 'frozen' | 'too_large' | 'mismatch'
  }

  async commitPart(input: {
    uploadIntentId: string
    partNumber: number
    sizeBytes: bigint
    reservationId: string
  }): Promise<'committed' | 'mismatch'> {
    const result = await this.redis.eval(
      COMMIT_PART, 1, `storage:upload:${input.uploadIntentId}`,
      String(input.partNumber), input.sizeBytes.toString(), input.reservationId,
    )
    const status = Array.isArray(result) ? String(result[0]) : ''
    if (status !== 'committed' && status !== 'mismatch') throw new Error('upload ledger unavailable')
    return status
  }

  async releasePart(input: {
    uploadIntentId: string
    partNumber: number
    sizeBytes: bigint
    reservationId: string
  }): Promise<void> {
    await this.redis.eval(
      RELEASE_PART, 1, `storage:upload:${input.uploadIntentId}`,
      String(input.partNumber), input.sizeBytes.toString(), input.reservationId,
    )
  }

  async freezeAndEnqueue(input: {
    uploadIntentId: string
    objectKey: string
    parts: number
    maxBytes: bigint
    generation: string
  }): Promise<{ enqueued: boolean; id: string; expectedSize: bigint; generation: string }> {
    if (!UUID_PATTERN.test(input.generation)) throw new Error('invalid upload generation')
    const result = await this.redis.eval(
      FREEZE_AND_ENQUEUE, 2,
      `storage:upload:${input.uploadIntentId}`, STREAM,
      input.objectKey, String(input.parts), input.maxBytes.toString(), input.uploadIntentId,
      input.generation, String(DEDUPE_TTL_SECONDS),
    )
    if (!Array.isArray(result) || !['enqueued', 'replay'].includes(String(result[0]))) {
      const status = Array.isArray(result) ? String(result[0]) : 'unavailable'
      throw new Error(`upload freeze ${status}`)
    }
    return {
      enqueued: result[0] === 'enqueued',
      id: String(result[1]),
      expectedSize: BigInt(String(result[2])),
      generation: String(result[3]),
    }
  }

  async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', STREAM, GROUP, '0-0', 'MKSTREAM')
    } catch (error) {
      if (!String((error as Error).message).includes('BUSYGROUP')) throw error
    }
  }

  async read(count = 1, blockMilliseconds = 5_000): Promise<FinalizationJob[]> {
    const value = await this.redis.xreadgroup(
      'GROUP', GROUP, this.consumer,
      'COUNT', count,
      'BLOCK', blockMilliseconds,
      'STREAMS', STREAM, '>',
    )
    return entriesFromRead(value)
  }

  async reclaim(minIdleMilliseconds = 120_000, count = 1): Promise<FinalizationJob[]> {
    const value = await this.redis.xautoclaim(
      STREAM, GROUP, this.consumer, minIdleMilliseconds, this.reclaimCursor, 'COUNT', count,
    )
    if (!Array.isArray(value) || !Array.isArray(value[1])) return []
    this.reclaimCursor = typeof value[0] === 'string' ? value[0] : '0-0'
    return value[1].map(job).filter((entry): entry is FinalizationJob => entry !== null)
  }

  async ack(id: string): Promise<void> {
    await this.redis.xack(STREAM, GROUP, id)
  }

  async deadLetter(input: {
    id: string
    uploadIntentId: string
    objectKey: string
    errorCode: string
  }): Promise<void> {
    await this.redis.eval(
      DEAD_LETTER_AND_ACK,
      2,
      STREAM,
      DEAD_LETTER_STREAM,
      GROUP,
      input.id,
      input.uploadIntentId,
      input.objectKey,
      input.errorCode,
    )
  }

  async ready(): Promise<void> {
    await this.redis.ping()
    await this.ensureGroup()
  }
}

export const finalizationQueueContract = {
  stream: STREAM,
  deadLetterStream: DEAD_LETTER_STREAM,
  group: GROUP,
}
