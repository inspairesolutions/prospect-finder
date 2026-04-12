-- CreateTable
CREATE TABLE `Prospect` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `placeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `formattedAddress` TEXT NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `googleRating` DOUBLE NULL,
    `googleReviewCount` INTEGER NULL,
    `priceLevel` INTEGER NULL,
    `businessStatus` VARCHAR(191) NULL,
    `types` TEXT NOT NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `googleMapsUrl` TEXT NULL,
    `openingHours` TEXT NULL,
    `vicinity` VARCHAR(191) NULL,
    `status` ENUM('NEW', 'RESEARCHING', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'READY', 'CONVERTED', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
    `notes` TEXT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `facebookUrl` VARCHAR(191) NULL,
    `instagramUrl` VARCHAR(191) NULL,
    `linkedinUrl` VARCHAR(191) NULL,
    `twitterUrl` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `services` TEXT NULL,
    `uniqueSellingPoints` TEXT NULL,
    `primaryColor` VARCHAR(191) NULL,
    `secondaryColor` VARCHAR(191) NULL,
    `accentColor` VARCHAR(191) NULL,
    `preferredWebStyle` VARCHAR(191) NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `assignedTo` VARCHAR(191) NULL,
    `lastContactedAt` DATETIME(3) NULL,
    `nextFollowUpAt` DATETIME(3) NULL,
    `searchId` VARCHAR(191) NULL,

    UNIQUE INDEX `Prospect_placeId_key`(`placeId`),
    INDEX `Prospect_status_idx`(`status`),
    INDEX `Prospect_createdAt_idx`(`createdAt`),
    INDEX `Prospect_priority_idx`(`priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProspectPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `photoRef` TEXT NOT NULL,
    `url` TEXT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `prospectId` VARCHAR(191) NOT NULL,

    INDEX `ProspectPhoto_prospectId_idx`(`prospectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProspectReview` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `authorName` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `text` TEXT NULL,
    `time` DATETIME(3) NOT NULL,
    `relativeTime` VARCHAR(191) NULL,
    `prospectId` VARCHAR(191) NOT NULL,

    INDEX `ProspectReview_prospectId_idx`(`prospectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProspectFile` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `filename` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `prospectId` VARCHAR(191) NOT NULL,

    INDEX `ProspectFile_prospectId_idx`(`prospectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fromStatus` ENUM('NEW', 'RESEARCHING', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'READY', 'CONVERTED', 'ARCHIVED') NULL,
    `toStatus` ENUM('NEW', 'RESEARCHING', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'READY', 'CONVERTED', 'ARCHIVED') NOT NULL,
    `notes` TEXT NULL,
    `changedBy` VARCHAR(191) NULL,
    `prospectId` VARCHAR(191) NOT NULL,

    INDEX `StatusHistory_prospectId_idx`(`prospectId`),
    INDEX `StatusHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Search` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `query` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `location` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `radius` INTEGER NOT NULL,
    `resultsCount` INTEGER NOT NULL,

    INDEX `Search_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Prospect` ADD CONSTRAINT `Prospect_searchId_fkey` FOREIGN KEY (`searchId`) REFERENCES `Search`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProspectPhoto` ADD CONSTRAINT `ProspectPhoto_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProspectReview` ADD CONSTRAINT `ProspectReview_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProspectFile` ADD CONSTRAINT `ProspectFile_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StatusHistory` ADD CONSTRAINT `StatusHistory_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
