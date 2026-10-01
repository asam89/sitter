-- Automated pipeline nudges: a log of every reminder the daily sweep sent so a
-- sitter or applicant is only chased about the same thing once per cooldown.
DO $$ BEGIN
  CREATE TYPE "PipelineNudgeKind" AS ENUM ('SITTER_SCHEDULE', 'APPLICANT_NEXT_STEP', 'APPLICATION_UNFINISHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PipelineNudge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "PipelineNudgeKind" NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineNudge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PipelineNudge_userId_kind_sentAt_idx"
  ON "PipelineNudge"("userId", "kind", "sentAt");

DO $$ BEGIN
  ALTER TABLE "PipelineNudge" ADD CONSTRAINT "PipelineNudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Supabase exposes every public table over its REST API, so lock it down now.
ALTER TABLE "PipelineNudge" ENABLE ROW LEVEL SECURITY;
