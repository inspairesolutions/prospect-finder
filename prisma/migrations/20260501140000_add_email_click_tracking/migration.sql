-- AlterTable
ALTER TABLE "EmailMessage"
ADD COLUMN "clickTrackingToken" TEXT,
ADD COLUMN "proposedUrl" TEXT,
ADD COLUMN "firstClickedAt" TIMESTAMP(3),
ADD COLUMN "firstClickedHumanAt" TIMESTAMP(3),
ADD COLUMN "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "humanClickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "firstClickIp" TEXT,
ADD COLUMN "firstClickUserAgent" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_clickTrackingToken_key" ON "EmailMessage"("clickTrackingToken");
