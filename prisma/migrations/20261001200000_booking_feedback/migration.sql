-- When the parent was asked for feedback after a completed session.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "feedbackRequestedAt" TIMESTAMP(3);

-- Bookings completed before this existed are treated as already asked, so the
-- first run doesn't email every past family.
UPDATE "Booking"
SET "feedbackRequestedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP)
WHERE "status" = 'COMPLETED' AND "feedbackRequestedAt" IS NULL;
