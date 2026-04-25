-- AlterTable
ALTER TABLE "EmailMessage"
ADD COLUMN "openTrackingToken" TEXT,
ADD COLUMN "openedAt" TIMESTAMP(3),
ADD COLUMN "openedHumanAt" TIMESTAMP(3),
ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "humanOpenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "firstOpenUserAgent" TEXT,
ADD COLUMN "firstOpenIp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_openTrackingToken_key" ON "EmailMessage"("openTrackingToken");
