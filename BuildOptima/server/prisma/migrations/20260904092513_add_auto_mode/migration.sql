-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    `otp_code` VARCHAR(10) NULL,
    `otp_expired` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_code` VARCHAR(20) NOT NULL,
    `room_name` VARCHAR(100) NOT NULL,
    `floor` INTEGER NOT NULL,
    `occupancy_status` ENUM('occupied', 'empty') NOT NULL DEFAULT 'empty',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `rooms_room_code_key`(`room_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NOT NULL,
    `course_name` VARCHAR(150) NOT NULL,
    `lecturer` VARCHAR(100) NOT NULL,
    `day` VARCHAR(10) NOT NULL,
    `start_time` VARCHAR(8) NOT NULL,
    `end_time` VARCHAR(8) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `esp_id` VARCHAR(64) NOT NULL,
    `room_id` INTEGER NULL,
    `device_name` VARCHAR(100) NOT NULL,
    `status` ENUM('online', 'offline') NOT NULL DEFAULT 'offline',
    `auto_mode` BOOLEAN NOT NULL DEFAULT true,
    `last_seen` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `devices_esp_id_key`(`esp_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NULL,
    `asset_name` VARCHAR(150) NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `condition` ENUM('good', 'damaged', 'missing') NOT NULL DEFAULT 'good',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `qr_code` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sensors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `device_id` INTEGER NOT NULL,
    `sensor_type` VARCHAR(50) NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sensor_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sensor_id` INTEGER NOT NULL,
    `value` DECIMAL(12, 4) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sensor_logs_sensor_id_recorded_at_idx`(`sensor_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `occupancy_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NOT NULL,
    `status` ENUM('occupied', 'empty') NOT NULL,
    `detected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `occupancy_logs_room_id_detected_at_idx`(`room_id`, `detected_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `energy_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NOT NULL,
    `voltage` DECIMAL(8, 2) NOT NULL,
    `current` DECIMAL(8, 4) NOT NULL,
    `power` DECIMAL(10, 2) NOT NULL,
    `energy_kwh` DECIMAL(12, 6) NOT NULL,
    `estimated_cost` DECIMAL(12, 2) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `energy_logs_room_id_recorded_at_idx`(`room_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `actuators` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `device_id` INTEGER NOT NULL,
    `actuator_name` VARCHAR(80) NOT NULL,
    `status` ENUM('on', 'off') NOT NULL DEFAULT 'off',
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `type` ENUM('device_offline', 'energy_anomaly', 'occupancy_alert', 'system') NOT NULL DEFAULT 'system',
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_ai_results` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `detected_objects` JSON NOT NULL,
    `expected_objects` JSON NOT NULL,
    `mismatch_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sensors` ADD CONSTRAINT `sensors_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sensor_logs` ADD CONSTRAINT `sensor_logs_sensor_id_fkey` FOREIGN KEY (`sensor_id`) REFERENCES `sensors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `occupancy_logs` ADD CONSTRAINT `occupancy_logs_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `energy_logs` ADD CONSTRAINT `energy_logs_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `actuators` ADD CONSTRAINT `actuators_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_ai_results` ADD CONSTRAINT `inventory_ai_results_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
