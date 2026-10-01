-- Parent-facing "About me" details on a sitter profile.
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "age" INTEGER;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "education" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "experience" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "agesCaredFor" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "languages" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "activities" TEXT;
