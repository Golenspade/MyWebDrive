export type DownloadStartedEvent = {
  id: string
  kind: 'started'
  attemptId: string
  fileVersionId: string
  expectedBytes: bigint
  occurredAt: Date
}

export type DownloadCompletedEvent = {
  id: string
  kind: 'completed'
  attemptId: string
  fileVersionId: string
  bytes: bigint
  occurredAt: Date
}

export type DownloadEvent = DownloadStartedEvent | DownloadCompletedEvent

export type MalformedDownloadEvent = {
  id: string
  kind: 'malformed'
  errorCode: 'invalid_download_event'
}

export type DownloadQueueEntry = DownloadEvent | MalformedDownloadEvent
