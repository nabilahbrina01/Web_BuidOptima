-- AlterTable: akun baru harus verifikasi OTP email sebelum bisa login
ALTER TABLE `users` ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT false;

-- Akun yang sudah ada (seed / dibuat admin / sebelum fitur ini) dianggap terverifikasi
UPDATE `users` SET `email_verified` = true;
