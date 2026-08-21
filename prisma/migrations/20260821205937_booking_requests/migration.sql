-- CreateEnum
CREATE TYPE "BookingRequestStatus" AS ENUM ('OPEN', 'CLAIMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "childrenAgeRange" TEXT NOT NULL,
    "numberOfChildren" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "waiverVersion" TEXT NOT NULL,
    "waiverAcceptedAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingRequestStatus" NOT NULL DEFAULT 'OPEN',
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_requestNumber_key" ON "BookingRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_bookingId_key" ON "BookingRequest"("bookingId");

-- CreateIndex
CREATE INDEX "BookingRequest_status_startTime_idx" ON "BookingRequest"("status", "startTime");

-- CreateIndex
CREATE INDEX "BookingRequest_parentId_idx" ON "BookingRequest"("parentId");

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
