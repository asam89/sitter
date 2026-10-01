-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "finalReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "supportEmail" TEXT DEFAULT 'support@riaya.ca',
ADD COLUMN     "reminderLeadHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "reminderFinalLeadHours" INTEGER NOT NULL DEFAULT 2;
