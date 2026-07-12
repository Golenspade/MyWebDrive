ALTER TABLE "OutboxEvent" ADD COLUMN "occurredAt" TIMESTAMP(3);
UPDATE "OutboxEvent" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;
ALTER TABLE "OutboxEvent" ALTER COLUMN "occurredAt" SET NOT NULL;
ALTER TABLE "OutboxEvent" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AnalyticsDaily" (
  "date" DATE NOT NULL,
  "uploadsCount" BIGINT NOT NULL DEFAULT 0,
  "uploadsBytes" BIGINT NOT NULL DEFAULT 0,
  "downloadsCount" BIGINT NOT NULL DEFAULT 0,
  "downloadsBytes" BIGINT NOT NULL DEFAULT 0,
  "createdUsers" BIGINT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("date"),
  CONSTRAINT "AnalyticsDaily_uploadsCount_nonnegative" CHECK ("uploadsCount" >= 0),
  CONSTRAINT "AnalyticsDaily_uploadsBytes_nonnegative" CHECK ("uploadsBytes" >= 0),
  CONSTRAINT "AnalyticsDaily_downloadsCount_nonnegative" CHECK ("downloadsCount" >= 0),
  CONSTRAINT "AnalyticsDaily_downloadsBytes_nonnegative" CHECK ("downloadsBytes" >= 0),
  CONSTRAINT "AnalyticsDaily_createdUsers_nonnegative" CHECK ("createdUsers" >= 0)
);

CREATE TABLE "AnalyticsDailyActiveUser" (
  "date" DATE NOT NULL,
  "userId" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsDailyActiveUser_pkey" PRIMARY KEY ("date", "userId")
);

CREATE TABLE "AnalyticsEventReceipt" (
  "sourceKey" TEXT NOT NULL,
  "outboxEventId" TEXT,
  "topic" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEventReceipt_pkey" PRIMARY KEY ("sourceKey")
);

CREATE TABLE "AnalyticsCoverage" (
  "metric" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "complete" BOOLEAN NOT NULL DEFAULT true,
  "gapStartedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsCoverage_pkey" PRIMARY KEY ("metric")
);

CREATE INDEX "AnalyticsEventReceipt_outboxEventId_idx" ON "AnalyticsEventReceipt"("outboxEventId");
CREATE INDEX "FileVersion_createdAt_idx" ON "FileVersion"("createdAt");
CREATE INDEX "UploadIntent_completedAt_idx" ON "UploadIntent"("completedAt");
CREATE INDEX "RefreshSession_lastUsedAt_idx" ON "RefreshSession"("lastUsedAt");
