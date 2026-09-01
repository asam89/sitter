-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('OWED', 'BLOCKED', 'FAILED', 'PAID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutMethod" AS ENUM ('STRIPE', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "SitterProfile"
  ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripeRequirementsDue" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeStatusCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "payoutAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "payoutStatus" "PayoutStatus",
  ADD COLUMN IF NOT EXISTS "payoutMethod" "PayoutMethod",
  ADD COLUMN IF NOT EXISTS "payoutTransferId" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutError" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutNote" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutPaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payoutRecordedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_payoutStatus_idx" ON "Booking"("payoutStatus");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_payoutRecordedById_fkey"
    FOREIGN KEY ("payoutRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Bookings completed before payout tracking existed are money already owed;
-- mark them OWED so they surface on /admin/payouts instead of disappearing.
UPDATE "Booking"
SET "payoutStatus" = 'OWED',
    "payoutAmount" = "totalAmount" - "platformFeeAmount"
WHERE "status" = 'COMPLETED' AND "payoutStatus" IS NULL;
