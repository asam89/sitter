-- Shifts an Admin offers to the vetted pool when the assigned sitter can't make it.
DO $$ BEGIN
  CREATE TYPE "ShiftCoverStatus" AS ENUM ('OPEN', 'FILLED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ShiftCover" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "fromSitterId" TEXT NOT NULL,
  "postedById" TEXT NOT NULL,
  "note" TEXT,
  "status" "ShiftCoverStatus" NOT NULL DEFAULT 'OPEN',
  "filledById" TEXT,
  "filledAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "smsSentCount" INTEGER NOT NULL DEFAULT 0,
  "emailSentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftCover_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShiftCover_status_createdAt_idx" ON "ShiftCover"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ShiftCover_bookingId_idx" ON "ShiftCover"("bookingId");

DO $$ BEGIN
  ALTER TABLE "ShiftCover" ADD CONSTRAINT "ShiftCover_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShiftCover" ADD CONSTRAINT "ShiftCover_fromSitterId_fkey" FOREIGN KEY ("fromSitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShiftCover" ADD CONSTRAINT "ShiftCover_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShiftCover" ADD CONSTRAINT "ShiftCover_filledById_fkey" FOREIGN KEY ("filledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "ShiftCover" ENABLE ROW LEVEL SECURITY;
