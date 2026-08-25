-- Supersede the draft waiver with v1 (identical text without the draft/pending
-- labels). The draft row is never rewritten: bookings reference the version they
-- accepted, so it stays readable exactly as accepted.
DO $$
DECLARE
  v1_body text := 'Ri''aya Parent Liability Waiver & Terms of Service

Ri''aya vets and lists babysitters as a scheduling and booking service. Sitters
are independent contractors, not employees or agents of Ri''aya. Vetting and
listing are not a guarantee of a sitter''s conduct, and Ri''aya does not
supervise care provided in your home.

By confirming a booking you acknowledge that you engage the sitter at your own
risk, that you are responsible for evaluating the suitability of any sitter for
your family, and that Ri''aya''s liability is limited to the fullest extent
permitted by law.';
BEGIN
  IF EXISTS (
    SELECT 1 FROM "TermsVersion" WHERE "version" = 'v0-draft' AND "active"
  ) AND NOT EXISTS (
    SELECT 1 FROM "TermsVersion" WHERE "version" = 'v1'
  ) THEN
    UPDATE "TermsVersion" SET "active" = false WHERE "active";
    INSERT INTO "TermsVersion" ("id", "version", "body", "active", "createdAt")
    VALUES (gen_random_uuid()::text, 'v1', v1_body, true, now());
  END IF;
END $$;
