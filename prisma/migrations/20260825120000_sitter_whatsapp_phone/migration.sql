-- AlterTable
ALTER TABLE "SitterApplication" ADD COLUMN     "whatsappPhone" TEXT,
ADD COLUMN     "whatsappReachable" BOOLEAN NOT NULL DEFAULT false;
