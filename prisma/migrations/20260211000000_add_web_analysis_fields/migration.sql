-- AlterTable: Add web analysis fields to Prospect
ALTER TABLE `Prospect` ADD COLUMN `webAnalysis` LONGTEXT NULL;
ALTER TABLE `Prospect` ADD COLUMN `webAnalysisScore` INTEGER NULL;
ALTER TABLE `Prospect` ADD COLUMN `webAnalysisCategory` VARCHAR(191) NULL;
ALTER TABLE `Prospect` ADD COLUMN `webAnalyzedAt` DATETIME(3) NULL;
