-- Support bounded lazy release by user, status and fixed expiry cutoff.
CREATE INDEX "QuotaReservation_userId_status_expiresAt_idx"
ON "QuotaReservation"("userId", "status", "expiresAt");
