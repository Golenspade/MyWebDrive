import type { OutboxEvent, Prisma } from '@prisma/client'

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

type ProjectableEvent = Pick<
  OutboxEvent,
  'id' | 'dedupeKey' | 'topic' | 'aggregateId' | 'payload' | 'occurredAt'
>

function eventDate(occurredAt: Date): Date {
  const local = new Date(occurredAt.getTime() + SHANGHAI_OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
}

function payloadRecord(payload: Prisma.JsonValue): Prisma.JsonObject {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('invalid analytics event payload')
  }
  return payload
}

function requiredString(
  payload: Prisma.JsonObject,
  key: string,
): string {
  const value = payload[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('invalid analytics event payload')
  }
  return value
}

function requiredBytes(payload: Prisma.JsonObject): bigint {
  const value = requiredString(payload, 'sizeBytes')
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error('invalid analytics event payload')
  return BigInt(value)
}

export async function projectOutboxEvent(
  tx: Prisma.TransactionClient,
  event: ProjectableEvent,
): Promise<boolean> {
  const receipt = await tx.analyticsEventReceipt.createMany({
    data: {
      sourceKey: event.dedupeKey,
      outboxEventId: event.id,
      topic: event.topic,
      occurredAt: event.occurredAt,
    },
    skipDuplicates: true,
  })
  if (receipt.count === 0) return false

  const date = eventDate(event.occurredAt)
  const payload = payloadRecord(event.payload)
  if (event.topic === 'user.activity.recorded') {
    await tx.analyticsDailyActiveUser.createMany({
      data: {
        date,
        userId: requiredString(payload, 'userId'),
        firstSeenAt: event.occurredAt,
      },
      skipDuplicates: true,
    })
    return true
  }

  if (event.topic === 'user.created') {
    await tx.analyticsDaily.upsert({
      where: { date },
      create: { date, createdUsers: 1n },
      update: { createdUsers: { increment: 1n } },
    })
    return true
  }

  const sizeBytes = requiredBytes(payload)
  if (event.topic === 'file.version.created') {
    await tx.analyticsDaily.upsert({
      where: { date },
      create: { date, uploadsCount: 1n, uploadsBytes: sizeBytes },
      update: {
        uploadsCount: { increment: 1n },
        uploadsBytes: { increment: sizeBytes },
      },
    })
    return true
  }
  if (event.topic === 'download.completed') {
    await tx.analyticsDaily.upsert({
      where: { date },
      create: { date, downloadsCount: 1n, downloadsBytes: sizeBytes },
      update: {
        downloadsCount: { increment: 1n },
        downloadsBytes: { increment: sizeBytes },
      },
    })
    return true
  }

  throw new Error('unsupported analytics event topic')
}
