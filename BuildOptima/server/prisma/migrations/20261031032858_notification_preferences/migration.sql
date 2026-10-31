-- AlterTable
ALTER TABLE `assets` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `daily_report_sent_at` DATETIME(3) NULL,
    ADD COLUMN `notif_daily` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `notif_email` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notif_push` BOOLEAN NOT NULL DEFAULT true;
