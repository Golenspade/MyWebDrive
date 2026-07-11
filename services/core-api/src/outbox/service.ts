import type { Prisma } from '@prisma/client'

export async function enqueueFileVersionCreated(
  tx: Prisma.TransactionClient,
  input: {
    fileId: string
    versionId: string
    uploadIntentId: string
    sizeBytes: bigint
    sha256: string
  },
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      dedupeKey: `file.version.created:${input.versionId}`,
      topic: 'file.version.created',
      aggregateId: input.fileId,
      payload: {
        fileId: input.fileId,
        versionId: input.versionId,
        uploadIntentId: input.uploadIntentId,
        sizeBytes: input.sizeBytes.toString(),
        sha256: input.sha256,
      },
    },
  })
}
