import { createHmac } from 'node:crypto'

import type { FinalizationJob, FinalizationQueue } from './finalization-queue.js'
import { ObjectIntegrityError, type ObjectStorage } from './object-storage/types.js'

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const

type CallbackRequest = {
  uploadIntentId: string
  rawBody: Buffer
  timestamp: string
  signature: string
}

type CallbackResponse = { status: number; body: string }

type JobDependencies = {
  storage: Pick<ObjectStorage, 'completeObject' | 'deleteObject' | 'deleteParts'>
  queue: Pick<FinalizationQueue, 'ack' | 'deadLetter'>
  callback: (request: CallbackRequest) => Promise<CallbackResponse>
  callbackSecret: string
  now: () => Date
  sleep: (milliseconds: number) => Promise<void>
}

export async function processFinalizationJob(
  job: FinalizationJob,
  deps: JobDependencies,
): Promise<void> {
  let completion: { sizeBytes: bigint; sha256: string }
  try {
    completion = await deps.storage.completeObject(
      job.objectKey,
      job.parts,
      job.generation,
      job.expectedSize,
    )
    if (completion.sizeBytes !== job.expectedSize) throw new ObjectIntegrityError()
  } catch (error) {
    if (!(error instanceof ObjectIntegrityError)) throw error
    await deps.storage.deleteObject(job.objectKey)
    await deps.queue.deadLetter({
      id: job.id,
      uploadIntentId: job.uploadIntentId,
      objectKey: job.objectKey,
      errorCode: 'integrity_mismatch',
    })
    return
  }
  const rawBody = Buffer.from(
    JSON.stringify({
      objectKey: job.objectKey,
      sizeBytes: completion.sizeBytes.toString(),
      sha256: completion.sha256,
    }),
    'utf8',
  )

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const timestamp = Math.floor(deps.now().getTime() / 1000).toString()
    const signature = createHmac('sha256', deps.callbackSecret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex')
    let response: CallbackResponse
    try {
      response = await deps.callback({
        uploadIntentId: job.uploadIntentId,
        rawBody,
        timestamp,
        signature,
      })
    } catch {
      response = { status: 503, body: '' }
    }

    if (response.status >= 200 && response.status < 300) {
      await deps.storage.deleteParts(job.objectKey, job.parts)
      await deps.queue.ack(job.id)
      return
    }
    if (response.status === 409) {
      await deps.queue.deadLetter({
        id: job.id,
        uploadIntentId: job.uploadIntentId,
        objectKey: job.objectKey,
        errorCode: 'core_conflict',
      })
      return
    }
    const delay = RETRY_DELAYS_MS[attempt]
    if (delay !== undefined) await deps.sleep(delay)
  }
  // Intentionally leave the entry pending and retain the final object for reconciliation.
}

export function createCoreCallback(coreApiUrl: string): JobDependencies['callback'] {
  const base = coreApiUrl.replace(/\/$/, '')
  return async (request) => {
    const response = await fetch(
      `${base}/api/v1/internal/upload-intents/${encodeURIComponent(request.uploadIntentId)}/complete`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(request.rawBody.length),
          'x-core-timestamp': request.timestamp,
          'x-core-signature': request.signature,
        },
        body: new Uint8Array(request.rawBody),
        signal: AbortSignal.timeout(10_000),
      },
    )
    return { status: response.status, body: await response.text() }
  }
}

export class WorkerLoopState {
  private running = false
  private pollHealthy = false

  markRunning(): void {
    this.running = true
    this.pollHealthy = false
  }

  markStopped(): void {
    this.running = false
    this.pollHealthy = false
  }

  markPollSuccess(): void {
    this.pollHealthy = true
  }

  markPollFailure(): void {
    this.pollHealthy = false
  }

  isAlive(): boolean {
    return this.running
  }

  isReady(): boolean {
    return this.running && this.pollHealthy
  }
}

export async function runWorker(input: {
  storage: ObjectStorage
  queue: FinalizationQueue
  callbackSecret: string
  coreApiUrl: string
  signal?: AbortSignal
  now?: () => Date
  sleep?: (milliseconds: number) => Promise<void>
  state?: WorkerLoopState
  callback?: JobDependencies['callback']
}): Promise<void> {
  const now = input.now ?? (() => new Date())
  const sleep = input.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  const callback = input.callback ?? createCoreCallback(input.coreApiUrl)
  const state = input.state ?? new WorkerLoopState()
  let preferReclaim = true
  try {
    await input.queue.ensureGroup()
    state.markRunning()
    while (!input.signal?.aborted) {
      let jobs: FinalizationJob[]
      try {
        if (preferReclaim) {
          const reclaimed = await input.queue.reclaim()
          jobs = reclaimed.length > 0 ? reclaimed.slice(0, 1) : (await input.queue.read(1)).slice(0, 1)
        } else {
          const fresh = await input.queue.read(1, 1_000)
          jobs = fresh.length > 0 ? fresh.slice(0, 1) : (await input.queue.reclaim()).slice(0, 1)
        }
        preferReclaim = !preferReclaim
        state.markPollSuccess()
      } catch {
        preferReclaim = !preferReclaim
        state.markPollFailure()
        await sleep(1_000)
        continue
      }
      for (const job of jobs) {
        if (input.signal?.aborted) return
        await processFinalizationJob(job, {
          storage: input.storage,
          queue: input.queue,
          callback,
          callbackSecret: input.callbackSecret,
          now,
          sleep,
        }).catch(() => undefined)
      }
    }
  } finally {
    state.markStopped()
  }
}
