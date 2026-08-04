-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'STUBBED', 'FAILED');

-- CreateEnum
CREATE TYPE "CompletionConfirmer" AS ENUM ('PARENT', 'ADMIN');

-- AlterTable (add new lifecycle columns first, so the data migration below can populate them)
ALTER TABLE "AvailabilitySlot" ADD COLUMN     "isLastMinuteEligible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Booking" ADD COLUMN     "addressReleasedAt" TIMESTAMP(3),
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationChargeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

ALTER TABLE "BusinessSettings" ADD COLUMN     "cancellationChargePercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancellationWindowHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "completionConfirmedBy" "CompletionConfirmer" NOT NULL DEFAULT 'PARENT',
ADD COLUMN     "notifySmsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyWhatsappEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Data migration: legacy CONFIRMED bookings (paid + active in the old model) map
-- to APPROVED in the new model. They were already paid, so mark approved + address
-- released as of their original payment time. Runs before the enum is reshaped,
-- using a text compare on the still-valid 'CONFIRMED' value.
UPDATE "Booking"
SET "approvedAt" = COALESCE("paidAt", "createdAt"),
    "addressReleasedAt" = COALESCE("paidAt", "createdAt")
WHERE "status"::text = 'CONFIRMED';

-- AlterEnum: reshape BookingStatus (drop CONFIRMED, add APPROVED/DECLINED/IN_PROGRESS).
-- The USING clause maps any legacy CONFIRMED row to APPROVED as it is recast.
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new"
  USING (CASE WHEN "status"::text = 'CONFIRMED' THEN 'APPROVED' ELSE "status"::text END::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "detail" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_bookingId_idx" ON "Notification"("bookingId");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_idx" ON "Notification"("recipientUserId");

-- CreateIndex
CREATE INDEX "Review_subjectId_idx" ON "Review"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_authorId_key" ON "Review"("bookingId", "authorId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
