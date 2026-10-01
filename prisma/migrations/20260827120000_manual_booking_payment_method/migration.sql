-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'ETRANSFER');

-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "waiverAcceptedAt" DROP NOT NULL,
ADD COLUMN     "createdByAdminId" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paidRecordedById" TEXT;

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN "etransferEmail" TEXT;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_paidRecordedById_fkey" FOREIGN KEY ("paidRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
