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
}

export interface StreamRedis {
  ping(): Promise<unknown>
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>
  xgroup(...args: Array<string | number>): Promise<unknown>
  xreadgroup(...args: Array<string | number>): Promise<unknown>
  xautoclaim(...args: Array<string | number>): Promise<unknown>
  xack(...args: Array<string | number>): Promise<unknown>
}

const ENQUEUE_ONCE = `
local existing = redis.call('GET', KEYS[2])
if existing then return {0, existing} end
local id = redis.call('XADD', KEYS[1], '*',
  'uploadIntentId', ARGV[1], 'objectKey', ARGV[2], 'parts', ARGV[3])
redis.call('SET', KEYS[2], id, 'EX', ARGV[4])
return {1, id}
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
  ) return null
  return {
    id: entry[0],
    uploadIntentId: value.uploadIntentId!,
    objectKey: value.objectKey!,
    parts,
  }
}

function entriesFromRead(value: unknown): FinalizationJob[] {
  if (!Array.isArray(value)) return []
  const firstStream = value[0]
  if (!Array.isArray(firstStream) || !Array.isArray(firstStream[1])) return []
  return firstStream[1].map(job).filter((entry): entry is FinalizationJob => entry !== null)
}

export class FinalizationQueue {
  constructor(
    private readonly redis: StreamRedis,
    private readonly consumer: string,
  ) {}

  async enqueueOnce(input: Omit<FinalizationJob, 'id'>): Promise<{ enqueued: boolean; id: string }> {
    const result = await this.redis.eval(
      ENQUEUE_ONCE,
      2,
      STREAM,
      `storage:finalize:enqueued:${input.uploadIntentId}`,
      input.uploadIntentId,
      input.objectKey,
      String(input.parts),
      String(DEDUPE_TTL_SECONDS),
    )
    if (!Array.isArray(result) || typeof result[1] !== 'string') throw new Error('queue unavailable')
    return { enqueued: Number(result[0]) === 1, id: result[1] }
  }

  async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', STREAM, GROUP, '0-0', 'MKSTREAM')
    } catch (error) {
      if (!String((error as Error).message).includes('BUSYGROUP')) throw error
    }
  }

  async read(count = 10, blockMilliseconds = 5_000): Promise<FinalizationJob[]> {
    const value = await this.redis.xreadgroup(
      'GROUP', GROUP, this.consumer,
      'COUNT', count,
      'BLOCK', blockMilliseconds,
      'STREAMS', STREAM, '>',
    )
    return entriesFromRead(value)
  }

  async reclaim(minIdleMilliseconds = 30_000, count = 10): Promise<FinalizationJob[]> {
    const value = await this.redis.xautoclaim(
      STREAM, GROUP, this.consumer, minIdleMilliseconds, '0-0', 'COUNT', count,
    )
    if (!Array.isArray(value) || !Array.isArray(value[1])) return []
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
