-- Give every outbox event a stable business identity. Existing rows receive a
-- unique legacy value before the column becomes required.
ALTER TABLE "OutboxEvent" ADD COLUMN "dedupeKey" TEXT;

UPDATE "OutboxEvent"
SET "dedupeKey" = "topic" || ':legacy:' || "id"
WHERE "dedupeKey" IS NULL;

ALTER TABLE "OutboxEvent" ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key" ON "OutboxEvent"("dedupeKey");
