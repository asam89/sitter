-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARENT', 'SITTER', 'COMMUNITY_ADMIN', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "CommunityType" AS ENUM ('MOSQUE', 'SCHOOL', 'SPORTS_LEAGUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AffiliationRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AffiliationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'PLATFORM_VERIFIED');

-- CreateEnum
CREATE TYPE "EndorsementStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID', 'BACKGROUND_CHECK', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('NOW', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DispatchTier" AS ENUM ('COMMUNITY_ENDORSED', 'PLATFORM_VERIFIED');

-- CreateEnum
CREATE TYPE "DispatchOfferStatus" AS ENUM ('OFFERED', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'BOOKING', 'MESSAGE_THREAD');

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
CREATE TABLE "CommunityPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CommunityType" NOT NULL DEFAULT 'OTHER',
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityAffiliation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityPartnerId" TEXT NOT NULL,
    "role" "AffiliationRole" NOT NULL DEFAULT 'MEMBER',
    "status" "AffiliationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "hourlyRate" INTEGER NOT NULL DEFAULT 20,
    "serviceRadiusKm" INTEGER NOT NULL DEFAULT 15,
    "isAvailableNow" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "languages" TEXT[],
    "certifications" TEXT[],
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endorsement" (
    "id" TEXT NOT NULL,
    "sitterProfileId" TEXT NOT NULL,
    "communityPartnerId" TEXT NOT NULL,
    "endorsedByAdminId" TEXT,
    "status" "EndorsementStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endorsement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "sitterProfileId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "sitterId" TEXT,
    "requestType" "RequestType" NOT NULL DEFAULT 'NOW',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "dateTime" TIMESTAMP(3) NOT NULL,
    "durationHours" INTEGER NOT NULL DEFAULT 2,
    "childrenAgeRange" TEXT NOT NULL,
    "numberOfChildren" INTEGER NOT NULL DEFAULT 1,
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "addressReleasedAt" TIMESTAMP(3),
    "sitterHourlyRate" INTEGER NOT NULL,
    "platformFeePct" DOUBLE PRECISION NOT NULL,
    "platformFeeAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "communityOnly" BOOLEAN NOT NULL DEFAULT false,
    "dispatchDeadline" TIMESTAMP(3),
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "payoutReleasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchOffer" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "tier" "DispatchTier" NOT NULL,
    "status" "DispatchOfferStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "DispatchOffer_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "visibleToCommunityPartnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CommunityAffiliation_communityPartnerId_idx" ON "CommunityAffiliation"("communityPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityAffiliation_userId_communityPartnerId_key" ON "CommunityAffiliation"("userId", "communityPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SitterProfile_userId_key" ON "SitterProfile"("userId");

-- CreateIndex
CREATE INDEX "SitterProfile_isAvailableNow_idx" ON "SitterProfile"("isAvailableNow");

-- CreateIndex
CREATE INDEX "Endorsement_communityPartnerId_idx" ON "Endorsement"("communityPartnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Endorsement_sitterProfileId_communityPartnerId_key" ON "Endorsement"("sitterProfileId", "communityPartnerId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_parentId_idx" ON "Booking"("parentId");

-- CreateIndex
CREATE INDEX "Booking_sitterId_idx" ON "Booking"("sitterId");

-- CreateIndex
CREATE INDEX "DispatchOffer_sitterId_status_idx" ON "DispatchOffer"("sitterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchOffer_bookingId_sitterId_key" ON "DispatchOffer"("bookingId", "sitterId");

-- CreateIndex
CREATE INDEX "Message_bookingId_idx" ON "Message"("bookingId");

-- CreateIndex
CREATE INDEX "Review_targetId_idx" ON "Review"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_authorId_key" ON "Review"("bookingId", "authorId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_visibleToCommunityPartnerId_idx" ON "Report"("visibleToCommunityPartnerId");

-- AddForeignKey
ALTER TABLE "CommunityAffiliation" ADD CONSTRAINT "CommunityAffiliation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAffiliation" ADD CONSTRAINT "CommunityAffiliation_communityPartnerId_fkey" FOREIGN KEY ("communityPartnerId") REFERENCES "CommunityPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitterProfile" ADD CONSTRAINT "SitterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_sitterProfileId_fkey" FOREIGN KEY ("sitterProfileId") REFERENCES "SitterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_communityPartnerId_fkey" FOREIGN KEY ("communityPartnerId") REFERENCES "CommunityPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endorsement" ADD CONSTRAINT "Endorsement_endorsedByAdminId_fkey" FOREIGN KEY ("endorsedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_sitterProfileId_fkey" FOREIGN KEY ("sitterProfileId") REFERENCES "SitterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOffer" ADD CONSTRAINT "DispatchOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOffer" ADD CONSTRAINT "DispatchOffer_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_visibleToCommunityPartnerId_fkey" FOREIGN KEY ("visibleToCommunityPartnerId") REFERENCES "CommunityPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
