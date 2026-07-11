import { createHmac } from 'node:crypto'

import type { FinalizationJob, FinalizationQueue } from './finalization-queue.js'
import type { ObjectStorage } from './object-storage/types.js'

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const

type CallbackRequest = {
  uploadIntentId: string
  rawBody: Buffer
  timestamp: string
  signature: string
}

type CallbackResponse = { status: number; body: string }

type JobDependencies = {
  storage: Pick<ObjectStorage, 'completeObject' | 'deleteObject'>
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
  const completion = await deps.storage.completeObject(job.objectKey, job.parts)
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
      },
    )
    return { status: response.status, body: await response.text() }
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
}): Promise<void> {
  const now = input.now ?? (() => new Date())
  const sleep = input.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  const callback = createCoreCallback(input.coreApiUrl)
  await input.queue.ensureGroup()
  while (!input.signal?.aborted) {
    const reclaimed = await input.queue.reclaim()
    const jobs = reclaimed.length > 0 ? reclaimed : await input.queue.read()
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
}
