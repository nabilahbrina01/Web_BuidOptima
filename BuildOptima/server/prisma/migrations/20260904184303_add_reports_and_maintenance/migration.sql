-- AlterTable
ALTER TABLE `assets` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `maintenance_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NULL,
    `asset_name` VARCHAR(150) NOT NULL,
    `room_id` INTEGER NULL,
    `activity` VARCHAR(150) NOT NULL,
    `technician` VARCHAR(100) NULL,
    `status` ENUM('done', 'pending', 'cancelled') NOT NULL DEFAULT 'pending',
    `performed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
