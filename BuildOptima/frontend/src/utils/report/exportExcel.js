import { STATUS_LABEL_PLAIN, RISK_LABEL_PLAIN, fmtDate } from './buildReport.js';
import { reportFileName } from './exportPdf.js';

// Excel (.xlsx) sungguhan dengan beberapa sheet. Angka disimpan sebagai angka (bukan teks)
// sehingga bisa langsung dijumlah/diurutkan/dibuat grafik di Excel.

const widths = (...w) => w.map((wch) => ({ wch }));

/** @param {object} report hasil buildReport()  @param {object} XLSX modul xlsx */
export function buildWorkbook(report, XLSX) {
  const { meta, energy, rooms, alerts, maintenance, assets, insights } = report;
  const wb = XLSX.utils.book_new();
  const add = (name, aoa, cols) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (cols) ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // 1) Ringkasan + analisis
  add('Ringkasan', [
    [meta.title],
    [meta.subtitle],
    [],
    ['Periode', `${meta.periodLabel} - ${meta.rangeLabel}`],
    ['Dicetak', meta.generatedAtLabel],
    ['Oleh', meta.generatedBy],
    [],
    ['Indikator', 'Nilai', 'Satuan'],
    ['Total konsumsi energi', energy.total, 'kWh'],
    ['Estimasi biaya', energy.cost, 'Rp'],
    ['Tarif listrik', energy.tarif, 'Rp/kWh'],
    ['Rata-rata per periode (yang berdata)', energy.avg, 'kWh'],
    ['Puncak konsumsi', energy.peak ? energy.peak.kwh : 0, energy.peak ? `kWh (${energy.peak.label})` : 'kWh'],
    ['Aset perlu perhatian', assets.attention.length, `dari ${assets.total} aset`],
    ['Perawatan masih terbuka', maintenance.open, `${maintenance.overdue} terlambat`],
    ['Peringatan kritis bulan ini', alerts.danger, `dari ${alerts.total} notifikasi`],
    [],
    ['Analisis otomatis'],
    ...insights.map((i) => [i.text]),
  ], widths(38, 28, 26));

  // 2) Energi per periode
  add('Energi', [
    ['Periode', 'Konsumsi (kWh)', 'Estimasi Biaya (Rp)', '% dari Total'],
    ...energy.rows.map((r) => [r.label, r.kwh, r.cost, r.share / 100]),
    ['Total', energy.total, energy.cost, 1],
  ], widths(14, 18, 22, 14));

  // 3) Per ruangan
  add('Per Ruangan', [
    ['Ruangan', 'Konsumsi (kWh)', 'Estimasi Biaya (Rp)', 'Porsi'],
    ...rooms.rows.map((r) => [r.room, r.kwh, r.cost, r.share / 100]),
    ['Total', rooms.total, Math.round(rooms.total * energy.tarif), rooms.total ? 1 : 0],
  ], widths(16, 18, 22, 10));

  // 4) Peringatan
  add('Peringatan', [
    ['Kategori', 'Jumlah (bulan ini)'],
    ['Kritis', alerts.danger], ['Peringatan', alerts.warn], ['Info', alerts.info], ['Sukses', alerts.success],
    ['Total', alerts.total],
  ], widths(16, 18));

  // 5) Aset
  add('Aset', [
    ['Aset', 'Ruangan', 'Kondisi', 'Kesehatan (%)', 'Status Perawatan'],
    ...assets.attention.map((a) => [
      a.name, a.room, RISK_LABEL_PLAIN[a.risk] || a.risk, a.health,
      a.maintenance ? STATUS_LABEL_PLAIN[a.maintenance] : 'Belum dijadwalkan',
    ]),
  ], widths(30, 12, 18, 14, 20));

  // 6) Perawatan
  add('Perawatan', [
    ['Tanggal', 'Aset', 'Ruangan', 'Kegiatan', 'Teknisi', 'Status', 'Terlambat', 'Catatan'],
    ...maintenance.rows.map((j) => [
      fmtDate(j.date), j.asset, j.room, j.activity, j.technician,
      STATUS_LABEL_PLAIN[j.status] || j.status, j.overdue ? 'Ya' : '', j.notes,
    ]),
  ], widths(18, 26, 10, 26, 18, 12, 10, 36));

  // format persen untuk kolom % / Porsi
  ['Energi', 'Per Ruangan'].forEach((name) => {
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = 1; r <= range.e.r; r += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
      if (cell && typeof cell.v === 'number') cell.z = '0%';
    }
  });
  return wb;
}

export async function exportExcel(report) {
  const XLSX = await import('xlsx');
  const wb = buildWorkbook(report, XLSX);
  XLSX.writeFile(wb, reportFileName(report, 'xlsx'));
}