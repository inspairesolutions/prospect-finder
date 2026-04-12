-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'IN_CONSTRUCTION', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'READY', 'CONVERTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "placeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "googleRating" DOUBLE PRECISION,
    "googleReviewCount" INTEGER,
    "priceLevel" INTEGER,
    "businessStatus" TEXT,
    "types" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "googleMapsUrl" TEXT,
    "openingHours" TEXT,
    "vicinity" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "logoUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "description" TEXT,
    "services" TEXT,
    "uniqueSellingPoints" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "preferredWebStyle" TEXT,
    "proposedWebUrl" TEXT,
    "contactEmail" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assignedTo" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "webContentExtract" TEXT,
    "webAnalysis" TEXT,
    "webAnalysisScore" INTEGER,
    "webAnalysisCategory" TEXT,
    "webAnalyzedAt" TIMESTAMP(3),
    "searchId" TEXT,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailProposal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "threadId" TEXT,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "EmailProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "readAt" TIMESTAMP(3),
    "threadId" TEXT NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectPhoto" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoRef" TEXT NOT NULL,
    "url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "ProspectPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectReview" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "time" TIMESTAMP(3) NOT NULL,
    "relativeTime" TEXT,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "ProspectReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectFile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "ProspectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectSite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "ProspectSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromStatus" "ProspectStatus",
    "toStatus" "ProspectStatus" NOT NULL,
    "notes" TEXT,
    "changedBy" TEXT,
    "prospectId" TEXT NOT NULL,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscardedPlace" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "placeId" TEXT NOT NULL,

    CONSTRAINT "DiscardedPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "query" TEXT NOT NULL,
    "category" TEXT,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius" INTEGER NOT NULL,
    "resultsCount" INTEGER NOT NULL,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_placeId_key" ON "Prospect"("placeId");

-- CreateIndex
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

-- CreateIndex
CREATE INDEX "Prospect_createdAt_idx" ON "Prospect"("createdAt");

-- CreateIndex
CREATE INDEX "Prospect_priority_idx" ON "Prospect"("priority");

-- CreateIndex
CREATE INDEX "EmailProposal_prospectId_idx" ON "EmailProposal"("prospectId");

-- CreateIndex
CREATE INDEX "EmailProposal_createdAt_idx" ON "EmailProposal"("createdAt");

-- CreateIndex
CREATE INDEX "EmailThread_prospectId_idx" ON "EmailThread"("prospectId");

-- CreateIndex
CREATE INDEX "EmailThread_createdAt_idx" ON "EmailThread"("createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");

-- CreateIndex
CREATE INDEX "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_messageId_idx" ON "EmailMessage"("messageId");

-- CreateIndex
CREATE INDEX "ProspectPhoto_prospectId_idx" ON "ProspectPhoto"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectReview_prospectId_idx" ON "ProspectReview"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectFile_prospectId_idx" ON "ProspectFile"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectSite_prospectId_idx" ON "ProspectSite"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectSite_slug_key" ON "ProspectSite"("slug");

-- CreateIndex
CREATE INDEX "StatusHistory_prospectId_idx" ON "StatusHistory"("prospectId");

-- CreateIndex
CREATE INDEX "StatusHistory_createdAt_idx" ON "StatusHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscardedPlace_placeId_key" ON "DiscardedPlace"("placeId");

-- CreateIndex
CREATE INDEX "DiscardedPlace_placeId_idx" ON "DiscardedPlace"("placeId");

-- CreateIndex
CREATE INDEX "Search_createdAt_idx" ON "Search"("createdAt");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailProposal" ADD CONSTRAINT "EmailProposal_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectPhoto" ADD CONSTRAINT "ProspectPhoto_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectReview" ADD CONSTRAINT "ProspectReview_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectFile" ADD CONSTRAINT "ProspectFile_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectSite" ADD CONSTRAINT "ProspectSite_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

