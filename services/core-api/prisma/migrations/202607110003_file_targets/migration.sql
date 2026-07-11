-- Bind replacement upload intents to an existing logical file without changing
-- the Task 4 shape for new-file intents (NULL still means create a new file).
ALTER TABLE "UploadIntent" ADD COLUMN "targetFileId" TEXT;

CREATE INDEX "UploadIntent_targetFileId_idx" ON "UploadIntent"("targetFileId");

ALTER TABLE "UploadIntent" ADD CONSTRAINT "UploadIntent_targetFileId_fkey"
FOREIGN KEY ("targetFileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL 15+ NULLS NOT DISTINCT makes root-level siblings participate in
-- the same uniqueness rule as nested siblings. Quoted names remain opaque;
-- lower(name) supplies the required case-folded comparison.
CREATE UNIQUE INDEX "File_live_sibling_name_key"
ON "File"("ownerId", "parentId", lower("name")) NULLS NOT DISTINCT
WHERE "deletedAt" IS NULL;
