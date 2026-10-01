-- Support/reply-to mailbox is now info@riaya.ca.
ALTER TABLE "BusinessSettings"
  ALTER COLUMN "supportEmail" SET DEFAULT 'info@riaya.ca';

UPDATE "BusinessSettings"
   SET "supportEmail" = 'info@riaya.ca'
 WHERE "supportEmail" IS NULL OR "supportEmail" = 'support@riaya.ca';
