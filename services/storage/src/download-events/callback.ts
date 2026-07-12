import { createHmac } from 'node:crypto'

import type { DownloadEventQueue } from './queue.js'
import type { DownloadEvent } from './types.js'

export type DownloadCallbackRequest = {
  attemptId: string
  kind: DownloadEvent['kind']
  rawBody: Buffer
  timestamp: string
  signature: string
}

export type DownloadCallbackResponse = { status: number; body: string }
export type DownloadCallback = (
  request: DownloadCallbackRequest,
) => Promise<DownloadCallbackResponse>

export async function processDownloadEvent(
  event: DownloadEvent,
  deps: {
    queue: Pick<DownloadEventQueue, 'ack' | 'deadLetter'>
    callback: DownloadCallback
    callbackSecret: string
    now: () => Date
  },
): Promise<void> {
  const rawBody = Buffer.from(JSON.stringify(event.kind === 'started'
    ? {
        fileVersionId: event.fileVersionId,
        expectedBytes: event.expectedBytes.toString(),
        occurredAt: event.occurredAt.toISOString(),
      }
    : {
        fileVersionId: event.fileVersionId,
        bytes: event.bytes.toString(),
        occurredAt: event.occurredAt.toISOString(),
      }), 'utf8')
  const timestamp = Math.floor(deps.now().getTime() / 1000).toString()
  const signature = createHmac('sha256', deps.callbackSecret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex')
  let response: DownloadCallbackResponse
  try {
    response = await deps.callback({
      attemptId: event.attemptId,
      kind: event.kind,
      rawBody,
      timestamp,
      signature,
    })
  } catch {
    return
  }
  if (response.status >= 200 && response.status < 300) {
    await deps.queue.ack(event.id)
    return
  }
  if (
    [400, 404, 409, 410, 422].includes(response.status)
  ) {
    await deps.queue.deadLetter({
      id: event.id,
      attemptId: event.attemptId,
      kind: event.kind,
      errorCode: `core_rejected_${response.status}`,
    })
  }
}

export function createDownloadCoreCallback(coreApiUrl: string): DownloadCallback {
  const base = coreApiUrl.replace(/\/$/, '')
  return async (request) => {
    const response = await fetch(
      `${base}/api/v1/internal/download-attempts/${encodeURIComponent(request.attemptId)}/${request.kind}`,
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
