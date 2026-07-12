import { Prisma, type OutboxEvent, type PrismaClient } from '@prisma/client'

import { projectOutboxEvent } from './projector.js'

const IDLE_POLL_MS = 1_000
const MAX_RETRY_DELAY_MS = 60_000

type AnalyticsWorkerInput = {
  prisma: PrismaClient
  signal: AbortSignal
  now: () => Date
  sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>
  batchSize: number
  state?: AnalyticsWorkerState
  metrics?: {
    recordProcessed(): void
    recordRetried(): void
    recordFailed(): void
    setProjectionLagSeconds(seconds: number): void
    setOldestOutboxAgeSeconds(seconds: number): void
  }
}

type ProcessResult =
  | { outcome: 'empty' }
  | { outcome: 'processed' | 'retried'; event: OutboxEvent }

export class AnalyticsWorkerState {
  private running = false
  private pollHealthy = false

  markRunning(): void {
    this.running = true
    this.pollHealthy = false
  }

  markPollSuccess(): void {
    this.pollHealthy = true
  }

  markStopped(): void {
    this.running = false
    this.pollHealthy = false
  }

  isReady(): boolean {
    return this.running && this.pollHealthy
  }
}

function retryDelay(attemptsBeforeFailure: number): number {
  return Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** Math.min(attemptsBeforeFailure, 6))
}

function errorCode(error: unknown): string {
  if (error instanceof Error && error.message === 'invalid analytics event payload') {
    return 'INVALID_EVENT_PAYLOAD'
  }
  return 'ANALYTICS_PROJECTION_FAILED'
}

async function processNextEvent(input: AnalyticsWorkerInput): Promise<ProcessResult> {
  let claimed: OutboxEvent | undefined
  try {
    await input.prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw<OutboxEvent[]>(Prisma.sql`
        SELECT *
        FROM "OutboxEvent"
        WHERE "processedAt" IS NULL
          AND "availableAt" <= ${input.now()}
          AND "topic" IN (
            'user.created',
            'user.activity.recorded',
            'file.version.created',
            'download.completed'
          )
        ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `)
      claimed = events[0]
      if (!claimed) return
      await projectOutboxEvent(tx, claimed)
      await tx.outboxEvent.update({
        where: { id: claimed.id },
        data: { processedAt: input.now(), lastErrorCode: null },
      })
    })
  } catch (error) {
    if (!claimed) throw error
    const failedAt = input.now()
    await input.prisma.outboxEvent.updateMany({
      where: { id: claimed.id, processedAt: null },
      data: {
        attempts: { increment: 1 },
        availableAt: new Date(failedAt.getTime() + retryDelay(claimed.attempts)),
        lastErrorCode: errorCode(error),
      },
    })
    return { outcome: 'retried', event: claimed }
  }
  return claimed
    ? { outcome: 'processed', event: claimed }
    : { outcome: 'empty' }
}

function ageSeconds(now: Date, then: Date): number {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000))
}

export async function runAnalyticsWorker(input: AnalyticsWorkerInput): Promise<void> {
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1) {
    throw new Error('batchSize must be a positive integer')
  }

  const state = input.state ?? new AnalyticsWorkerState()
  state.markRunning()
  try {
    while (!input.signal.aborted) {
      let handled = 0
      for (; handled < input.batchSize && !input.signal.aborted; handled += 1) {
        let result: ProcessResult
        try {
          result = await processNextEvent(input)
        } catch (error) {
          input.metrics?.recordFailed()
          throw error
        }
        if (result.outcome === 'empty') break
        const observedAt = input.now()
        if (result.outcome === 'processed') input.metrics?.recordProcessed()
        else input.metrics?.recordRetried()
        input.metrics?.setProjectionLagSeconds(ageSeconds(observedAt, result.event.occurredAt))
        input.metrics?.setOldestOutboxAgeSeconds(ageSeconds(observedAt, result.event.createdAt))
        state.markPollSuccess()
      }
      state.markPollSuccess()
      if (input.signal.aborted) break
      try {
        await input.sleep(handled === input.batchSize ? 0 : IDLE_POLL_MS, input.signal)
      } catch (error) {
        if (!input.signal.aborted) throw error
      }
    }
  } finally {
    state.markStopped()
  }
}
