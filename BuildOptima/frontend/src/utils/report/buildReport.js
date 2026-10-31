// Mengubah data mentah dari API menjadi laporan terstruktur (angka ringkasan + kalimat analisis).
// Dipakai SAMA oleh halaman Laporan, ekspor PDF, dan ekspor Excel, sehingga isinya selalu konsisten.
// Fungsi murni: tidak memanggil API dan tidak menyentuh DOM.

export const PERIOD_INFO = {
  weekly:  { label: 'Mingguan', range: (now) => `7 hari terakhir (sampai ${fmtDate(now)})` },
  monthly: { label: 'Bulanan',  range: (now) => `Januari - Desember ${now.getFullYear()} (per bulan)` },
  yearly:  { label: 'Tahunan',  range: (now) => `${now.getFullYear() - 4} - ${now.getFullYear()} (5 tahun terakhir)` },
};

export const STATUS_LABEL_PLAIN = {
  pending: 'Terjadwal',
  in_progress: 'Dikerjakan',
  done: 'Selesai',
  cancelled: 'Batal',
};
export const RISK_LABEL_PLAIN = { ok: 'Baik', warn: 'Perlu pengecekan', critical: 'Kritis' };

// ── format angka & tanggal (locale Indonesia) ────────────────────────────────
export const fmtNum = (n, digits = 2) =>
  Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: digits });
export const fmtRp = (n) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;
export function fmtDate(d) {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function fmtDateTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${fmtDate(date)}, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')}`;
}

const sum = (arr) => arr.reduce((s, v) => s + Number(v || 0), 0);
const round2 = (n) => Math.round(n * 100) / 100;
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * @param {object} input
 * @param {'weekly'|'monthly'|'yearly'} input.period
 * @param {{labels:string[], vals:number[], tarif?:number}} input.timeline
 * @param {{room_id:string,total:number}[]} input.perRoom
 * @param {{danger:number,warn:number,info:number,success:number}} input.alertSummary
 * @param {object[]} input.history        riwayat/pekerjaan perawatan
 * @param {object[]} input.assetHealth    hasil /inventory/health
 * @param {object|null} input.energySummary  hasil /energy/today-summary
 * @param {string} input.generatedBy
 * @param {Date} [input.now]
 */
export function buildReport({
  period = 'weekly', timeline = {}, perRoom = [], alertSummary = {}, history = [],
  assetHealth = [], energySummary = null, generatedBy = '-', now = new Date(),
}) {
  const info = PERIOD_INFO[period] || PERIOD_INFO.weekly;
  const labels = timeline.labels || [];
  const vals = (timeline.vals || []).map(Number);
  const tarif = Number(timeline.tarif ?? energySummary?.tarif ?? 0);

  // ── Energi ────────────────────────────────────────────────────────────────
  const rows = labels.map((label, i) => {
    const kwh = round2(vals[i] || 0);
    return { label, kwh, cost: Math.round(kwh * tarif) };
  });
  const total = round2(sum(rows.map((r) => r.kwh)));
  const withData = rows.filter((r) => r.kwh > 0);
  const avg = withData.length ? round2(total / withData.length) : 0;
  const peak = withData.length ? withData.reduce((a, b) => (b.kwh > a.kwh ? b : a)) : null;
  const low = withData.length ? withData.reduce((a, b) => (b.kwh < a.kwh ? b : a)) : null;
  rows.forEach((r) => { r.share = pct(r.kwh, total); });

  // Tren: dua periode terakhir yang punya data (hanya bermakna untuk bulanan/tahunan yang berurutan waktu)
  let trend = null;
  if ((period === 'monthly' || period === 'yearly') && withData.length >= 2) {
    const to = withData[withData.length - 1];
    const from = withData[withData.length - 2];
    trend = { from, to, pct: from.kwh > 0 ? Math.round(((to.kwh - from.kwh) / from.kwh) * 100) : 0 };
  }

  // Mingguan: bandingkan rata-rata hari kerja (Sen-Jum) vs akhir pekan (Sab-Min)
  let weekend = null;
  if (period === 'weekly' && rows.length === 7) {
    const wd = rows.slice(0, 5).map((r) => r.kwh);
    const we = rows.slice(5).map((r) => r.kwh);
    const wdAvg = sum(wd) / 5; const weAvg = sum(we) / 2;
    if (wdAvg > 0 && weAvg > 0) weekend = { weekdayAvg: round2(wdAvg), weekendAvg: round2(weAvg), pct: Math.round(((weAvg - wdAvg) / wdAvg) * 100) };
  }

  const today = energySummary
    ? { todayKwh: Number(energySummary.todayKwh || 0), yesterdayKwh: Number(energySummary.yesterdayKwh || 0), efficiencyPct: Number(energySummary.efficiencyPct || 0) }
    : null;

  // ── Per ruangan ───────────────────────────────────────────────────────────
  const roomRows = [...perRoom]
    .map((r) => ({ room: String(r.room_id), kwh: round2(Number(r.total || 0)) }))
    .sort((a, b) => b.kwh - a.kwh);
  const roomTotal = round2(sum(roomRows.map((r) => r.kwh)));
  roomRows.forEach((r) => { r.share = pct(r.kwh, roomTotal); r.cost = Math.round(r.kwh * tarif); });
  const topRoom = roomRows[0] || null;

  // ── Peringatan ────────────────────────────────────────────────────────────
  const alerts = {
    danger: Number(alertSummary.danger || 0), warn: Number(alertSummary.warn || 0),
    info: Number(alertSummary.info || 0), success: Number(alertSummary.success || 0),
  };
  alerts.total = alerts.danger + alerts.warn + alerts.info + alerts.success;

  // ── Perawatan ─────────────────────────────────────────────────────────────
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const jobs = history.map((h) => ({
    id: h.id,
    date: h.completed_at || h.scheduled_date || h.performed_at,
    asset: h.asset_name, room: h.room_id || '-', activity: h.activity,
    technician: h.technician || '-', status: h.status, notes: h.notes || '',
    overdue: ['pending', 'in_progress'].includes(h.status) && h.scheduled_date && new Date(h.scheduled_date) < startOfToday,
  }));
  const counts = { pending: 0, in_progress: 0, done: 0, cancelled: 0 };
  jobs.forEach((j) => { if (j.status in counts) counts[j.status] += 1; });
  const maintenance = {
    rows: jobs, counts,
    open: counts.pending + counts.in_progress,
    overdue: jobs.filter((j) => j.overdue).length,
  };

  // ── Aset (AI Predictive Maintenance) ──────────────────────────────────────
  const attention = assetHealth.filter((a) => a.risk && a.risk !== 'ok');
  const assets = {
    total: assetHealth.length,
    ok: assetHealth.filter((a) => a.risk === 'ok').length,
    warn: assetHealth.filter((a) => a.risk === 'warn').length,
    critical: assetHealth.filter((a) => a.risk === 'critical').length,
    avgHealth: assetHealth.length ? Math.round(sum(assetHealth.map((a) => a.health_pct)) / assetHealth.length) : 0,
    attention: attention
      .map((a) => ({
        name: a.name || a.asset_name, room: a.room_code || '-', risk: a.risk, health: a.health_pct,
        maintenance: a.maintenance_status || null, qty: a.qty,
      }))
      .sort((a, b) => (a.risk === b.risk ? a.health - b.health : a.risk === 'critical' ? -1 : 1)),
  };
  assets.scheduled = attention.filter((a) => a.maintenance_status).length;
  assets.unscheduled = attention.length - assets.scheduled;

  // ── Analisis otomatis ─────────────────────────────────────────────────────
  // level: 'good' (hijau) | 'info' (biru) | 'warn' (kuning/merah)
  const insights = [];
  if (!withData.length) {
    insights.push({ level: 'warn', text: 'Belum ada data konsumsi energi pada periode ini. Pastikan sensor PZEM dan koneksi MQTT berjalan.' });
  } else {
    insights.push({ level: 'info', text: `Total konsumsi ${fmtNum(total)} kWh dengan estimasi biaya ${fmtRp(total * tarif)} (tarif ${fmtRp(tarif)}/kWh).` });
    if (peak && withData.length >= 2) {
      const over = avg > 0 ? Math.round(((peak.kwh - avg) / avg) * 100) : 0;
      insights.push({ level: over >= 30 ? 'warn' : 'info', text: `Konsumsi tertinggi pada ${peak.label} sebesar ${fmtNum(peak.kwh)} kWh (${over}% di atas rata-rata ${fmtNum(avg)} kWh); terendah pada ${low.label} sebesar ${fmtNum(low.kwh)} kWh.` });
    }
    if (trend) {
      const up = trend.pct > 0;
      insights.push({
        level: up && trend.pct >= 10 ? 'warn' : !up && trend.pct <= -5 ? 'good' : 'info',
        text: `Dibanding ${trend.from.label}, konsumsi ${trend.to.label} ${up ? 'naik' : 'turun'} ${Math.abs(trend.pct)}% (${fmtNum(trend.from.kwh)} -> ${fmtNum(trend.to.kwh)} kWh).`,
      });
    }
    if (weekend) {
      insights.push({
        level: weekend.pct > -20 ? 'warn' : 'good',
        text: `Rata-rata akhir pekan ${fmtNum(weekend.weekendAvg)} kWh/hari, ${Math.abs(weekend.pct)}% ${weekend.pct < 0 ? 'lebih rendah' : 'lebih tinggi'} dari hari kerja (${fmtNum(weekend.weekdayAvg)} kWh/hari).${weekend.pct > -20 ? ' Periksa perangkat yang masih menyala saat ruangan kosong.' : ''}`,
      });
    }
  }
  if (today && today.yesterdayKwh > 0) {
    const better = today.efficiencyPct >= 0;
    insights.push({ level: better ? 'good' : 'warn', text: `Konsumsi hari ini ${fmtNum(today.todayKwh)} kWh, ${Math.abs(today.efficiencyPct)}% ${better ? 'lebih hemat' : 'lebih boros'} dibanding kemarin (${fmtNum(today.yesterdayKwh)} kWh).` });
  }
  if (topRoom && topRoom.kwh > 0) {
    const concentrated = roomRows.length >= 3 && topRoom.share >= 40;
    insights.push({ level: concentrated ? 'warn' : 'info', text: `Ruangan ${topRoom.room} paling banyak mengonsumsi energi: ${fmtNum(topRoom.kwh)} kWh (${topRoom.share}% dari ${fmtNum(roomTotal)} kWh seluruh ruangan).${concentrated ? ' Konsumsi terpusat di satu ruangan; tinjau jadwal penggunaan AC dan lampu di sana.' : ''}` });
  }
  if (alerts.danger > 0) {
    insights.push({ level: 'warn', text: `${alerts.danger} peringatan kritis tercatat bulan ini (dari total ${alerts.total} notifikasi). Tinjau halaman Notifikasi untuk tindak lanjut.` });
  } else if (alerts.total === 0) {
    insights.push({ level: 'good', text: 'Tidak ada peringatan sistem bulan ini.' });
  } else {
    insights.push({ level: 'info', text: `${alerts.total} notifikasi bulan ini (${alerts.warn} peringatan, ${alerts.info} info, ${alerts.success} sukses); tidak ada yang kritis.` });
  }
  if (assets.total) {
    if (attention.length) {
      insights.push({ level: assets.critical ? 'warn' : 'info', text: `${attention.length} dari ${assets.total} aset memerlukan perhatian (${assets.critical} kritis, ${assets.warn} perlu pengecekan). ${assets.scheduled} sudah dijadwalkan perawatan, ${assets.unscheduled} belum.${assets.unscheduled ? ' Jadwalkan melalui panel AI Predictive Maintenance di halaman Inventaris.' : ''}` });
    } else {
      insights.push({ level: 'good', text: `Seluruh ${assets.total} aset dalam kondisi baik (rata-rata kesehatan ${assets.avgHealth}%).` });
    }
  }
  if (maintenance.open > 0) {
    insights.push({ level: maintenance.overdue ? 'warn' : 'info', text: `${maintenance.open} pekerjaan perawatan masih terbuka (${counts.pending} terjadwal, ${counts.in_progress} dikerjakan).${maintenance.overdue ? ` ${maintenance.overdue} di antaranya melewati tanggal rencana.` : ''}` });
  }
  if (counts.done > 0) {
    insights.push({ level: 'good', text: `${counts.done} pekerjaan perawatan telah diselesaikan.` });
  }

  return {
    meta: {
      title: 'Laporan & Analitik BuildOptima',
      subtitle: 'Gedung Teknik Komputer - Universitas Diponegoro',
      period, periodLabel: info.label, rangeLabel: info.range(now),
      generatedAt: now, generatedAtLabel: fmtDateTime(now), generatedBy,
    },
    energy: { rows, total, cost: Math.round(total * tarif), avg, peak, low, trend, weekend, today, tarif, unit: 'kWh', hasData: withData.length > 0 },
    rooms: { rows: roomRows, total: roomTotal, top: topRoom },
    alerts,
    maintenance,
    assets,
    insights,
  };
}
