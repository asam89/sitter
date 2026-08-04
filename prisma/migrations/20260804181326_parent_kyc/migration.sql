-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('LEVEL_0_REGISTERED', 'LEVEL_1_CONTACT', 'LEVEL_2_IDENTITY');

-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "IdReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "minParentVerificationLevelToBook" "VerificationLevel" NOT NULL DEFAULT 'LEVEL_1_CONTACT';

-- AlterTable
ALTER TABLE "ParentProfile" ADD COLUMN     "idVerificationProvider" TEXT,
ADD COLUMN     "idVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "identityVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "streetAddress" TEXT,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "verifiedName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'LEVEL_0_REGISTERED';

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdVerificationDocument" (
    "id" TEXT NOT NULL,
    "parentProfileId" TEXT NOT NULL,
    "storagePath" TEXT,
    "reviewStatus" "IdReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdVerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationCode_userId_channel_idx" ON "VerificationCode"("userId", "channel");

-- CreateIndex
CREATE INDEX "IdVerificationDocument_reviewStatus_idx" ON "IdVerificationDocument"("reviewStatus");

-- CreateIndex
CREATE INDEX "IdVerificationDocument_parentProfileId_idx" ON "IdVerificationDocument"("parentProfileId");

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdVerificationDocument" ADD CONSTRAINT "IdVerificationDocument_parentProfileId_fkey" FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdVerificationDocument" ADD CONSTRAINT "IdVerificationDocument_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
