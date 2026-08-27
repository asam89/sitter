-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ErrorEventKind" AS ENUM ('SERVER_ERROR', 'USER_REPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ErrorEvent" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "kind" "ErrorEventKind" NOT NULL,
    "route" TEXT NOT NULL,
    "message" TEXT,
    "digest" TEXT,
    "reporterNote" TEXT,
    "userId" TEXT,
    "userRole" TEXT,
    "userEmail" TEXT,
    "githubIssueUrl" TEXT,
    "githubIssueNumber" INTEGER,
    "githubError" TEXT,
    "alertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ErrorEvent_ref_key" ON "ErrorEvent"("ref");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ErrorEvent_createdAt_idx" ON "ErrorEvent"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ErrorEvent_route_kind_idx" ON "ErrorEvent"("route", "kind");
