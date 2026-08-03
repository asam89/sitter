-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARENT', 'SITTER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'VETTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('OPEN', 'BOOKED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('FLAT', 'PERCENT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARENT',
    "phone" TEXT,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "certifications" TEXT[],
    "documentUrls" TEXT[],
    "targetPayRate" INTEGER NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "city" TEXT,
    "listedPayRate" INTEGER NOT NULL,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "serviceRadiusKm" INTEGER NOT NULL DEFAULT 15,
    "vettedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "sitterProfileId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "availabilitySlotId" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "childrenAgeRange" TEXT NOT NULL,
    "numberOfChildren" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "listedRateSnapshot" INTEGER NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "isLastMinute" BOOLEAN NOT NULL DEFAULT false,
    "rushFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "platformFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "waiverVersion" TEXT NOT NULL,
    "waiverAcceptedAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "payoutReleasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastMinuteThresholdHours" INTEGER NOT NULL DEFAULT 12,
    "rushFeeType" "FeeType" NOT NULL DEFAULT 'PERCENT',
    "rushFeeAmount" INTEGER NOT NULL DEFAULT 25,
    "platformFeeType" "FeeType" NOT NULL DEFAULT 'PERCENT',
    "platformFeeAmount" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SitterApplication_userId_key" ON "SitterApplication"("userId");

-- CreateIndex
CREATE INDEX "SitterApplication_status_idx" ON "SitterApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SitterProfile_userId_key" ON "SitterProfile"("userId");

-- CreateIndex
CREATE INDEX "SitterProfile_isListed_idx" ON "SitterProfile"("isListed");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_sitterProfileId_status_idx" ON "AvailabilitySlot"("sitterProfileId", "status");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_startTime_idx" ON "AvailabilitySlot"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_availabilitySlotId_key" ON "Booking"("availabilitySlotId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_parentId_idx" ON "Booking"("parentId");

-- CreateIndex
CREATE INDEX "Booking_sitterId_idx" ON "Booking"("sitterId");

-- CreateIndex
CREATE INDEX "Message_bookingId_idx" ON "Message"("bookingId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_bookingId_idx" ON "Report"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_version_key" ON "TermsVersion"("version");

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterApplication" ADD CONSTRAINT "SitterApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterApplication" ADD CONSTRAINT "SitterApplication_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterProfile" ADD CONSTRAINT "SitterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_sitterProfileId_fkey" FOREIGN KEY ("sitterProfileId") REFERENCES "SitterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_availabilitySlotId_fkey" FOREIGN KEY ("availabilitySlotId") REFERENCES "AvailabilitySlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
