-- Public sitter profile: photo + opt-in/showcase flags for the "Meet our team" page.
ALTER TABLE "SitterProfile" ADD COLUMN "photoPath" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN "publicOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SitterProfile" ADD COLUMN "showcased" BOOLEAN NOT NULL DEFAULT false;
