import { Prisma, type PrismaClient } from '@prisma/client'

export async function bootstrapAnalyticsReadModel(input: {
  prisma: PrismaClient
  now: () => Date
}): Promise<void> {
  const now = input.now()

  await input.prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      WITH source AS (
        SELECT
          'file.version.created:' || version."id" AS "sourceKey",
          version."createdAt" AS "occurredAt",
          version."sizeBytes" AS "sizeBytes"
        FROM "FileVersion" AS version
      ),
      inserted AS (
        INSERT INTO "AnalyticsEventReceipt" (
          "sourceKey",
          "outboxEventId",
          "topic",
          "occurredAt",
          "processedAt"
        )
        SELECT
          source."sourceKey",
          NULL,
          'file.version.created',
          source."occurredAt",
          ${now}
        FROM source
        ON CONFLICT ("sourceKey") DO NOTHING
        RETURNING "sourceKey"
      ),
      aggregated AS (
        SELECT
          (
            source."occurredAt" AT TIME ZONE 'UTC'
            AT TIME ZONE 'Asia/Shanghai'
          )::date AS "date",
          COUNT(*)::bigint AS "uploadsCount",
          SUM(source."sizeBytes")::bigint AS "uploadsBytes"
        FROM source
        INNER JOIN inserted USING ("sourceKey")
        GROUP BY "date"
      )
      INSERT INTO "AnalyticsDaily" (
        "date",
        "uploadsCount",
        "uploadsBytes",
        "downloadsCount",
        "downloadsBytes",
        "createdUsers",
        "updatedAt"
      )
      SELECT
        aggregated."date",
        aggregated."uploadsCount",
        aggregated."uploadsBytes",
        0,
        0,
        0,
        ${now}
      FROM aggregated
      ON CONFLICT ("date") DO UPDATE SET
        "uploadsCount" = "AnalyticsDaily"."uploadsCount" + EXCLUDED."uploadsCount",
        "uploadsBytes" = "AnalyticsDaily"."uploadsBytes" + EXCLUDED."uploadsBytes",
        "updatedAt" = EXCLUDED."updatedAt"
    `)

    const [earliestVersion, existingUploadsCoverage] = await Promise.all([
      tx.fileVersion.aggregate({ _min: { createdAt: true } }),
      tx.analyticsCoverage.findUnique({ where: { metric: 'uploads' } }),
    ])
    const authoritativeStart = earliestVersion._min.createdAt ?? now
    const uploadsStartedAt =
      existingUploadsCoverage && existingUploadsCoverage.startedAt < authoritativeStart
        ? existingUploadsCoverage.startedAt
        : authoritativeStart
    await tx.analyticsCoverage.upsert({
      where: { metric: 'uploads' },
      create: { metric: 'uploads', startedAt: uploadsStartedAt },
      update: { startedAt: uploadsStartedAt },
    })
    await tx.analyticsCoverage.createMany({
      data: [
        { metric: 'activeUsers', startedAt: now },
        { metric: 'downloads', startedAt: now },
      ],
      skipDuplicates: true,
    })
  })
}
