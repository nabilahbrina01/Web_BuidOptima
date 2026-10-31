const prisma = require('../config/prisma');
const mailer = require('../utils/mailer');

/**
 * Mengirim notifikasi penting ke email pengguna yang MENGAKTIFKAN "Notifikasi Email" di Pengaturan.
 *
 *  - Hanya peringatan yang butuh tindakan (EMAIL_TYPES). Info rutin seperti "ruangan kosong"
 *    tetap hanya tampil di dalam aplikasi.
 *  - Hanya ke user yang notif_email = true DAN emailnya sudah terverifikasi.
 *  - Cooldown per sumber (NOTIFY_EMAIL_COOLDOWN_MIN, default 30 menit): lonjakan daya yang terus
 *    terdeteksi tiap beberapa detik tidak membanjiri inbox.
 *  - Gagal kirim (SMTP salah/mati) hanya dicatat di log; tidak pernah mengganggu proses utama.
 */
const EMAIL_TYPES = new Set(['device_offline', 'energy_anomaly']);

const cooldownMs = () => {
  const n = parseInt(process.env.NOTIFY_EMAIL_COOLDOWN_MIN, 10);
  return (Number.isFinite(n) && n >= 0 ? n : 30) * 60 * 1000;
};

const lastSent = new Map(); // dedupeKey -> waktu kirim terakhir (memori server; reset saat restart)

const enabled = () => process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false' && mailer.isConfigured();

/**
 * @param {{type:string,title:string,message:string,created_at?:Date}} notification
 * @param {{dedupeKey?:string, now?:number}} [opts]
 * @returns {Promise<{sent:number, reason?:string}>}
 */
const notify = async (notification, { dedupeKey, now = Date.now() } = {}) => {
  if (!EMAIL_TYPES.has(notification.type)) return { sent: 0, reason: 'type-not-emailed' };
  if (!enabled()) return { sent: 0, reason: 'email-disabled' };

  const key = dedupeKey || `${notification.type}:${notification.title}`;
  const prev = lastSent.get(key);
  if (prev !== undefined && now - prev < cooldownMs()) return { sent: 0, reason: 'cooldown' };
  lastSent.set(key, now); // tandai SEBELUM mengirim agar notifikasi beruntun tidak lolos bersamaan
  if (lastSent.size > 500) for (const [k, t] of lastSent) if (now - t >= cooldownMs()) lastSent.delete(k);

  const users = await prisma.user.findMany({
    where: { notif_email: true, email_verified: true },
    select: { id: true, email: true },
  });

  let sent = 0;
  for (const u of users) {
    try {
      await mailer.sendAlertEmail(u.email, notification);
      sent += 1;
    } catch (err) {
      console.warn(`[MAIL] Gagal kirim notifikasi ke user ${u.id}: ${err.message}`);
    }
  }
  return { sent };
};

module.exports = { notify, EMAIL_TYPES, _resetForTests: () => lastSent.clear() };