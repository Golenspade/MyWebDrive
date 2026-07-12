import type { Prisma } from '@prisma/client'

type OutboxStore = Pick<Prisma.TransactionClient, 'outboxEvent'>

export async function enqueueDomainEvent(
  tx: OutboxStore,
  input: {
    dedupeKey: string
    topic: string
    aggregateId: string
    occurredAt: Date
    payload: Prisma.InputJsonValue
  },
): Promise<void> {
  await tx.outboxEvent.createMany({
    data: {
      dedupeKey: input.dedupeKey,
      topic: input.topic,
      aggregateId: input.aggregateId,
      occurredAt: input.occurredAt,
      payload: input.payload,
    },
    skipDuplicates: true,
  })
}

export async function enqueueFileVersionCreated(
  tx: Prisma.TransactionClient,
  input: {
    fileId: string
    versionId: string
    uploadIntentId: string
    sizeBytes: bigint
    sha256: string
    occurredAt: Date
  },
): Promise<void> {
  await enqueueDomainEvent(tx, {
    dedupeKey: `file.version.created:${input.versionId}`,
    topic: 'file.version.created',
    aggregateId: input.fileId,
    occurredAt: input.occurredAt,
    payload: {
      fileId: input.fileId,
      versionId: input.versionId,
      uploadIntentId: input.uploadIntentId,
      sizeBytes: input.sizeBytes.toString(),
      sha256: input.sha256,
    },
  })
}
