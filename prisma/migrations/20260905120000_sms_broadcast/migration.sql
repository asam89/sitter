-- Admin → parents/sitters SMS broadcast: a separate texting opt-out (so STOP
-- doesn't cancel email too) and the channel a past campaign went out on.
DO $$ BEGIN
  CREATE TYPE "CampaignChannel" AS ENUM ('EMAIL', 'SMS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "smsOptOutAt" TIMESTAMP(3);

ALTER TABLE "EmailCampaign"
  ADD COLUMN IF NOT EXISTS "channel" "CampaignChannel" NOT NULL DEFAULT 'EMAIL';
