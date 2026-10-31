const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
require('dayjs/locale/id');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || '"BuildOptima" <no-reply@buildoptima.id>';

/** true bila SMTP sudah diisi di .env (tanpa ini, email tidak bisa dikirim). */
const isConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

// Alamat aplikasi untuk tombol "Buka Dashboard" di email (opsional: APP_URL, default = CLIENT_URL pertama)
const appUrl = () => (process.env.APP_URL || (process.env.CLIENT_URL || '').split(',')[0] || '').trim().replace(/\/$/, '');

// Semua teks dari database/pengguna (nama perangkat, pesan, dsb.) WAJIB di-escape sebelum masuk HTML email.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtNum = (n, d = 2) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: d });
const fmtRp = (n) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;

// ─── OTP (tidak berubah) ──────────────────────────────────────────────────────
const sendOtp = async (to, otp, context = 'verify') => {
  const subject = context === 'password_reset'
    ? 'BuildOptima - Password Reset OTP'
    : 'BuildOptima - Email Verification OTP';

  const html = `
    <div style="font-family:sans-serif;max-width:420px;margin:auto">
      <h2 style="color:#1e4a9a">BuildOptima</h2>
      <p>Your one-time password (OTP) is:</p>
      <div style="font-size:2rem;font-weight:bold;letter-spacing:0.3em;color:#2563eb;padding:16px 0">${otp}</div>
      <p style="color:#6b7280;font-size:.85rem">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
    </div>
  `;

  await transporter.sendMail({ from: FROM, to, subject, html });
};

// ─── KERANGKA EMAIL NOTIFIKASI ────────────────────────────────────────────────
const layout = ({ heading, accent, body, test }) => `
<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <tr><td style="background:#1e3a8a;padding:18px 24px">
      <div style="color:#ffffff;font-size:18px;font-weight:bold">BuildOptima</div>
      <div style="color:#c7d6f5;font-size:12px;margin-top:2px">Teknik Komputer - Universitas Diponegoro</div>
    </td></tr>
    <tr><td style="padding:24px">
      ${test ? '<div style="background:#fef3c7;color:#92400e;font-size:12px;padding:8px 12px;border-radius:8px;margin-bottom:14px">Ini adalah <b>email contoh</b> dari tombol tes di Pengaturan.</div>' : ''}
      <div style="border-left:4px solid ${accent};padding-left:12px;margin-bottom:16px">
        <div style="font-size:19px;font-weight:bold;color:#111827">${heading}</div>
      </div>
      ${body}
      ${appUrl() ? `<p style="margin:22px 0 0"><a href="${esc(appUrl())}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:bold;display:inline-block">Buka Dashboard</a></p>` : ''}
    </td></tr>
    <tr><td style="background:#f9fafb;padding:14px 24px;color:#6b7280;font-size:11px;line-height:1.5">
      Anda menerima email ini karena notifikasi email aktif di akun BuildOptima Anda.
      Untuk mematikannya, buka <b>Pengaturan &rarr; Preferensi Notifikasi</b>.
    </td></tr>
  </table>
</div>`;

const TYPE_STYLE = {
  device_offline:   { label: 'Kritis',     color: '#dc2626', badgeBg: '#fee2e2' },
  energy_anomaly:   { label: 'Peringatan', color: '#d97706', badgeBg: '#fef3c7' },
  system:           { label: 'Info',       color: '#2563eb', badgeBg: '#dbeafe' },
  occupancy_alert:  { label: 'Info',       color: '#059669', badgeBg: '#d1fae5' },
};

/**
 * Email peringatan (perangkat offline, lonjakan daya, ...).
 * @param {{title:string,message:string,type:string,created_at?:Date}} n
 */
const sendAlertEmail = async (to, n, { test = false } = {}) => {
  const st = TYPE_STYLE[n.type] || TYPE_STYLE.system;
  const when = dayjs(n.created_at || new Date()).locale('id').format('dddd, D MMMM YYYY [pukul] HH:mm [WIB]');
  const body = `
    <p style="margin:0 0 12px"><span style="background:${st.badgeBg};color:${st.color};font-size:12px;font-weight:bold;padding:3px 10px;border-radius:999px">${esc(st.label)}</span></p>
    <p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.55">${esc(n.message)}</p>
    <p style="margin:0;color:#6b7280;font-size:12px">${esc(when)}</p>`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `${test ? '[TES] ' : ''}[BuildOptima] ${st.label}: ${n.title}`,
    html: layout({ heading: esc(n.title), accent: st.color, body, test }),
  });
};

const row = (label, value, sub = '') => `
  <tr>
    <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">${esc(label)}</td>
    <td style="padding:9px 0;border-bottom:1px solid #f3f4f6;text-align:right;color:#111827;font-size:14px;font-weight:bold">${esc(value)}${sub ? `<div style="font-weight:normal;color:#6b7280;font-size:11px">${esc(sub)}</div>` : ''}</td>
  </tr>`;

/** Email laporan harian. `report` berasal dari services/dailyReport.service.build(). */
const sendDailyReportEmail = async (to, report, { test = false } = {}) => {
  const e = report.energy;
  const change = e.changePct === null ? 'Tidak ada data pembanding' : `${e.changePct > 0 ? 'naik' : 'turun'} ${Math.abs(e.changePct)}% dibanding hari sebelumnya`;
  const body = `
    <p style="margin:0 0 12px;color:#374151;font-size:14px">Ringkasan operasional gedung untuk <b>${esc(report.dateLabel)}</b>:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${row('Konsumsi energi kemarin', `${fmtNum(e.kwh)} kWh`, change)}
      ${row('Estimasi biaya', fmtRp(e.cost))}
      ${row('Ruangan paling boros', e.topRoom ? e.topRoom.code : '-', e.topRoom ? `${fmtNum(e.topRoom.kwh)} kWh (${e.topRoom.share}%)` : 'Belum ada data')}
      ${row('Peringatan 24 jam terakhir', String(report.alerts.total), `${report.alerts.danger} kritis, ${report.alerts.warn} peringatan`)}
      ${row('Perangkat offline saat ini', String(report.devices.offline))}
      ${row('Aset perlu perhatian', String(report.assets.attention), `${report.assets.critical} kritis`)}
      ${row('Perawatan masih terbuka', String(report.maintenance.open), report.maintenance.overdue ? `${report.maintenance.overdue} melewati jadwal` : 'Tidak ada yang terlambat')}
    </table>`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `${test ? '[TES] ' : ''}[BuildOptima] Laporan Harian - ${report.dateLabel}`,
    html: layout({ heading: 'Laporan Harian', accent: '#2563eb', body, test }),
  });
};

module.exports = { sendOtp, sendAlertEmail, sendDailyReportEmail, isConfigured, esc, appUrl };