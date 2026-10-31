-- AlterTable
ALTER TABLE `assets` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `maintenance_logs` ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `notes` VARCHAR(500) NULL,
    ADD COLUMN `scheduled_date` DATETIME(3) NULL,
    MODIFY `status` ENUM('done', 'pending', 'cancelled', 'in_progress') NOT NULL DEFAULT 'pending';
