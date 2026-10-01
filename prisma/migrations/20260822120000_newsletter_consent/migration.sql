-- AlterTable
ALTER TABLE "User" ADD COLUMN     "newsletterConsentAt" TIMESTAMP(3),
ADD COLUMN     "newsletterConsentText" TEXT,
ADD COLUMN     "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "newsletterOptOutAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribeToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");

