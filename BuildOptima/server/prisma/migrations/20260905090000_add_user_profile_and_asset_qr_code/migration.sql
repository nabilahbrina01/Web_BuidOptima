-- AlterTable: profil user yang dipakai frontend (Sidebar, Settings, Manajemen User)
ALTER TABLE `users`
    ADD COLUMN `name` VARCHAR(100) NULL,
    ADD COLUMN `nip` VARCHAR(50) NULL,
    ADD COLUMN `phone` VARCHAR(30) NULL,
    ADD COLUMN `photo` MEDIUMTEXT NULL;

-- Data lama: pakai username sebagai nama tampilan sementara
UPDATE `users` SET `name` = `username` WHERE `name` IS NULL;

-- Frontend memakai kode pendek (mis. SB-2026-001) sebagai isi QR + kunci pencarian scan.
-- Sebelumnya kolom ini berisi path file PNG (uploads/qrcodes/asset-N.png) atau NULL.
UPDATE `assets`
   SET `qr_code` = CONCAT('SB-', YEAR(`created_at`), '-', LPAD(`id`, 3, '0'))
 WHERE `qr_code` IS NULL OR `qr_code` LIKE 'uploads/%';
