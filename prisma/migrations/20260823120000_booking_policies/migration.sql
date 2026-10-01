-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('NONE', 'REQUESTED', 'SCHEDULED', 'DECLINED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RefundTier" AS ENUM ('UNPAID', 'PARENT_EARLY', 'PARENT_MID', 'PARENT_LATE', 'PARENT_AFTER_START', 'SITTER_CANCELLED', 'ADMIN_CANCELLED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledByRole" "Role",
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "extraChildFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "interviewMethod" TEXT,
ADD COLUMN     "interviewNote" TEXT,
ADD COLUMN     "interviewRequestedAt" TIMESTAMP(3),
ADD COLUMN     "interviewScheduledAt" TIMESTAMP(3),
ADD COLUMN     "interviewStatus" "InterviewStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "lateNightFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overnightFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundPercent" INTEGER,
ADD COLUMN     "refundProcessorId" TEXT,
ADD COLUMN     "refundProcessorStatus" TEXT,
ADD COLUMN     "refundTier" "RefundTier",
ADD COLUMN     "waiverAcceptedIp" TEXT,
ADD COLUMN     "waiverAcceptedUserAgent" TEXT;

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "waiverAcceptedIp" TEXT,
ADD COLUMN     "waiverAcceptedUserAgent" TEXT;

-- AlterTable
ALTER TABLE "BusinessSettings" DROP COLUMN "cancellationChargePercent",
DROP COLUMN "cancellationWindowHours",
ADD COLUMN     "afterStartRefundPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extraChildFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateCancelWindowHours" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "lateNightEndHour" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "lateNightFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateNightStartHour" INTEGER NOT NULL DEFAULT 22,
ADD COLUMN     "lateRefundPercent" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "midRefundPercent" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "minBookingHours" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "overnightEndHour" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "overnightFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overnightStartHour" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundFullBeforeHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "sitterCancelRefundPercent" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "SitterProfile" ADD COLUMN     "baseRate" INTEGER;

-- CreateTable
CREATE TABLE "ChildMedicalRecord" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "bookingRequestId" TEXT,
    "childIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "ageYears" INTEGER,
    "encrypted" TEXT NOT NULL,
    "purgeAfter" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildMedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentByUserId" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "suppressedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildMedicalRecord_bookingId_idx" ON "ChildMedicalRecord"("bookingId");

-- CreateIndex
CREATE INDEX "ChildMedicalRecord_bookingRequestId_idx" ON "ChildMedicalRecord"("bookingRequestId");

-- CreateIndex
CREATE INDEX "ChildMedicalRecord_purgeAfter_idx" ON "ChildMedicalRecord"("purgeAfter");

-- CreateIndex
CREATE INDEX "EmailCampaign_sentAt_idx" ON "EmailCampaign"("sentAt");

-- AddForeignKey
ALTER TABLE "ChildMedicalRecord" ADD CONSTRAINT "ChildMedicalRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildMedicalRecord" ADD CONSTRAINT "ChildMedicalRecord_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

