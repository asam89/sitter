-- Sitter background checks: police vulnerable sector / record checks and
-- certifications. Documents live encrypted in private storage; only the
-- metadata and an access log live here.
DO $$ BEGIN
  CREATE TYPE "ScreeningCheckType" AS ENUM ('VULNERABLE_SECTOR', 'POLICE_RECORD', 'CPR', 'FIRST_AID', 'REFERENCE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ScreeningStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SitterScreening" (
    "id" TEXT NOT NULL,
    "sitterUserId" TEXT NOT NULL,
    "checkType" "ScreeningCheckType" NOT NULL,
    "issuer" TEXT,
    "issuedOn" TIMESTAMP(3),
    "renewBy" TIMESTAMP(3),
    "status" "ScreeningStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "storagePath" TEXT,
    "originalMime" TEXT,
    "originalName" TEXT,
    "fileBytes" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "uploadedByUserId" TEXT,
    "verifiedByAdminId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterScreening_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScreeningAccessLog" (
    "id" TEXT NOT NULL,
    "screeningId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SitterScreening_sitterUserId_idx" ON "SitterScreening"("sitterUserId");
CREATE INDEX IF NOT EXISTS "SitterScreening_status_idx" ON "SitterScreening"("status");
CREATE INDEX IF NOT EXISTS "SitterScreening_renewBy_idx" ON "SitterScreening"("renewBy");
CREATE INDEX IF NOT EXISTS "ScreeningAccessLog_screeningId_idx" ON "ScreeningAccessLog"("screeningId");

DO $$ BEGIN
  ALTER TABLE "SitterScreening" ADD CONSTRAINT "SitterScreening_sitterUserId_fkey" FOREIGN KEY ("sitterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SitterScreening" ADD CONSTRAINT "SitterScreening_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SitterScreening" ADD CONSTRAINT "SitterScreening_verifiedByAdminId_fkey" FOREIGN KEY ("verifiedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ScreeningAccessLog" ADD CONSTRAINT "ScreeningAccessLog_screeningId_fkey" FOREIGN KEY ("screeningId") REFERENCES "SitterScreening"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ScreeningAccessLog" ADD CONSTRAINT "ScreeningAccessLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Supabase exposes every public table over its REST API, so these must be
-- locked down the moment they exist.
ALTER TABLE "SitterScreening" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScreeningAccessLog" ENABLE ROW LEVEL SECURITY;
