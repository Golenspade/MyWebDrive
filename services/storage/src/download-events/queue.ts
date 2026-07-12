import type { DownloadEvent, DownloadQueueEntry } from './types.js'

const STREAM = 'storage:download-events'
const DEAD_LETTER_STREAM = 'storage:download-events:dead-letter'
const GROUP = 'storage-download-workers'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface DownloadStreamRedis {
  ping(): Promise<unknown>
  xadd(...args: Array<string | number>): Promise<unknown>
  xgroup(...args: Array<string | number>): Promise<unknown>
  xreadgroup(...args: Array<string | number>): Promise<unknown>
  xautoclaim(...args: Array<string | number>): Promise<unknown>
  xpending(...args: Array<string | number>): Promise<unknown>
  xack(...args: Array<string | number>): Promise<unknown>
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>
}

const DEAD_LETTER_AND_ACK = `
redis.call('XADD', KEYS[2], '*',
  'sourceEntryId', ARGV[2], 'attemptId', ARGV[3],
  'kind', ARGV[4], 'errorCode', ARGV[5])
return redis.call('XACK', KEYS[1], ARGV[1], ARGV[2])
`

function validInput(input: {
  attemptId: string
  fileVersionId: string
  bytes: bigint
  occurredAt: Date
}): void {
  if (
    !UUID_PATTERN.test(input.attemptId) ||
    !UUID_PATTERN.test(input.fileVersionId) ||
    input.bytes < 0n ||
    !Number.isFinite(input.occurredAt.getTime())
  ) {
    throw new Error('invalid download event')
  }
}

function fields(values: unknown): Record<string, string> | null {
  if (!Array.isArray(values) || values.length % 2 !== 0) return null
  const result: Record<string, string> = {}
  for (let index = 0; index < values.length; index += 2) {
    if (typeof values[index] !== 'string' || typeof values[index + 1] !== 'string') return null
    result[values[index] as string] = values[index + 1] as string
  }
  return result
}

function malformed(entry: unknown): DownloadQueueEntry | null {
  if (!Array.isArray(entry) || typeof entry[0] !== 'string') return null
  return { id: entry[0], kind: 'malformed', errorCode: 'invalid_download_event' }
}

function parseEvent(entry: unknown): DownloadQueueEntry | null {
  if (!Array.isArray(entry) || typeof entry[0] !== 'string') return null
  const value = fields(entry[1])
  if (
    !value ||
    !UUID_PATTERN.test(value.attemptId ?? '') ||
    !UUID_PATTERN.test(value.fileVersionId ?? '') ||
    !/^(0|[1-9]\d*)$/.test(value.kind === 'started' ? value.expectedBytes ?? '' : value.bytes ?? '')
  ) return malformed(entry)
  const occurredAt = new Date(value.occurredAt ?? '')
  if (!Number.isFinite(occurredAt.getTime()) || occurredAt.toISOString() !== value.occurredAt) {
    return malformed(entry)
  }
  if (value.kind === 'started') {
    return {
      id: entry[0],
      kind: 'started',
      attemptId: value.attemptId!,
      fileVersionId: value.fileVersionId!,
      expectedBytes: BigInt(value.expectedBytes!),
      occurredAt,
    }
  }
  if (value.kind === 'completed') {
    return {
      id: entry[0],
      kind: 'completed',
      attemptId: value.attemptId!,
      fileVersionId: value.fileVersionId!,
      bytes: BigInt(value.bytes!),
      occurredAt,
    }
  }
  return malformed(entry)
}

function eventsFromRead(value: unknown): DownloadQueueEntry[] {
  if (!Array.isArray(value)) return []
  const firstStream = value[0]
  if (!Array.isArray(firstStream) || !Array.isArray(firstStream[1])) return []
  return firstStream[1]
    .map(parseEvent)
    .filter((event): event is DownloadQueueEntry => event !== null)
}

export class DownloadEventQueue {
  private reclaimCursor = '0-0'

  constructor(
    private readonly redis: DownloadStreamRedis,
    private readonly consumer: string,
  ) {}

  async appendStarted(input: {
    attemptId: string
    fileVersionId: string
    expectedBytes: bigint
    occurredAt: Date
  }): Promise<string> {
    validInput({ ...input, bytes: input.expectedBytes })
    const id = await this.redis.xadd(
      STREAM, '*',
      'kind', 'started',
      'attemptId', input.attemptId,
      'fileVersionId', input.fileVersionId,
      'expectedBytes', input.expectedBytes.toString(),
      'occurredAt', input.occurredAt.toISOString(),
    )
    if (typeof id !== 'string') throw new Error('download event queue unavailable')
    return id
  }

  async appendCompleted(input: {
    attemptId: string
    fileVersionId: string
    bytes: bigint
    occurredAt: Date
  }): Promise<string> {
    validInput(input)
    const id = await this.redis.xadd(
      STREAM, '*',
      'kind', 'completed',
      'attemptId', input.attemptId,
      'fileVersionId', input.fileVersionId,
      'bytes', input.bytes.toString(),
      'occurredAt', input.occurredAt.toISOString(),
    )
    if (typeof id !== 'string') throw new Error('download event queue unavailable')
    return id
  }

  async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', STREAM, GROUP, '0-0', 'MKSTREAM')
    } catch (error) {
      if (!String((error as Error).message).includes('BUSYGROUP')) throw error
    }
  }

  async read(count = 1, blockMilliseconds = 5_000): Promise<DownloadQueueEntry[]> {
    return eventsFromRead(await this.redis.xreadgroup(
      'GROUP', GROUP, this.consumer,
      'COUNT', count,
      'BLOCK', blockMilliseconds,
      'STREAMS', STREAM, '>',
    ))
  }

  async reclaim(minIdleMilliseconds = 120_000, count = 1): Promise<DownloadQueueEntry[]> {
    const value = await this.redis.xautoclaim(
      STREAM, GROUP, this.consumer, minIdleMilliseconds, this.reclaimCursor, 'COUNT', count,
    )
    if (!Array.isArray(value) || !Array.isArray(value[1])) return []
    this.reclaimCursor = typeof value[0] === 'string' ? value[0] : '0-0'
    return value[1]
      .map(parseEvent)
      .filter((event): event is DownloadQueueEntry => event !== null)
  }

  async ack(id: string): Promise<void> {
    await this.redis.xack(STREAM, GROUP, id)
  }

  async pendingCount(): Promise<number> {
    const summary = await this.redis.xpending(STREAM, GROUP)
    const count = Array.isArray(summary) ? Number(summary[0]) : Number.NaN
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error('invalid download pending summary')
    }
    return count
  }

  async deadLetter(input: (
    | {
        id: string
        attemptId: string
        kind: DownloadEvent['kind']
        errorCode: string
      }
    | {
        id: string
        kind: 'malformed'
        errorCode: 'invalid_download_event'
      }
  )): Promise<void> {
    const attemptId = 'attemptId' in input ? input.attemptId : ''
    const validCoreRejection =
      input.kind !== 'malformed' &&
      UUID_PATTERN.test(attemptId) &&
      /^core_rejected_\d{3}$/.test(input.errorCode)
    const validMalformed =
      input.kind === 'malformed' && input.errorCode === 'invalid_download_event'
    if (!validCoreRejection && !validMalformed) {
      throw new Error('invalid download dead letter')
    }
    await this.redis.eval(
      DEAD_LETTER_AND_ACK,
      2,
      STREAM,
      DEAD_LETTER_STREAM,
      GROUP,
      input.id,
      attemptId,
      input.kind,
      input.errorCode,
    )
  }

  async ready(): Promise<void> {
    await this.redis.ping()
    await this.ensureGroup()
  }
}

export const downloadEventQueueContract = {
  stream: STREAM,
  deadLetterStream: DEAD_LETTER_STREAM,
  group: GROUP,
}
