-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "confirmTokenHash" TEXT,
    "confirmSentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "consentText" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "source" TEXT,
    "unsubscribeToken" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_confirmTokenHash_key" ON "NewsletterSubscriber"("confirmTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_unsubscribeToken_key" ON "NewsletterSubscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_confirmedAt_idx" ON "NewsletterSubscriber"("confirmedAt");
