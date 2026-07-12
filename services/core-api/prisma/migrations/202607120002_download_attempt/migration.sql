CREATE TABLE "DownloadAttempt" (
    "id" TEXT NOT NULL,
    "fileVersionId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expectedBytes" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "unknownAt" TIMESTAMP(3),

    CONSTRAINT "DownloadAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DownloadAttempt_expectedBytes_nonnegative" CHECK ("expectedBytes" >= 0),
    CONSTRAINT "DownloadAttempt_purpose_valid" CHECK ("purpose" IN ('private', 'share', 'publication')),
    CONSTRAINT "DownloadAttempt_status_valid" CHECK ("status" IN ('issued', 'started', 'completed', 'unknown'))
);

CREATE INDEX "DownloadAttempt_status_issuedAt_idx"
ON "DownloadAttempt"("status", "issuedAt");

CREATE INDEX "DownloadAttempt_fileVersionId_idx"
ON "DownloadAttempt"("fileVersionId");
