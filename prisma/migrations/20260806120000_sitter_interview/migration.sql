-- Sitter application: add an INTERVIEW stage between UNDER_REVIEW and VETTED,
-- plus optional interview scheduling + internal interview notes. Additive only.

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'INTERVIEW';

-- AlterTable
ALTER TABLE "SitterApplication" ADD COLUMN     "interviewNotes" TEXT,
ADD COLUMN     "interviewScheduledAt" TIMESTAMP(3);
