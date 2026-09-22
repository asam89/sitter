-- Team → sitter messages read in the portal, with per-sitter read receipts.
CREATE TABLE IF NOT EXISTS "TeamMessage" (
  "id" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "smsSentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamMessage_recipientUserId_createdAt_idx"
  ON "TeamMessage"("recipientUserId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TeamMessageRead" (
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMessageRead_pkey" PRIMARY KEY ("messageId", "userId")
);

DO $$ BEGIN
  ALTER TABLE "TeamMessageRead" ADD CONSTRAINT "TeamMessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TeamMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TeamMessageRead" ADD CONSTRAINT "TeamMessageRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "TeamMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMessageRead" ENABLE ROW LEVEL SECURITY;
