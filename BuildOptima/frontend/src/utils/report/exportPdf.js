import { fmtNum, fmtRp, STATUS_LABEL_PLAIN, RISK_LABEL_PLAIN } from './buildReport.js';

// PDF dibuat langsung dari DATA laporan (teks, tabel, grafik vektor) - bukan screenshot halaman.
// Hasilnya: teks bisa diseleksi/dicari, tabel rapi lintas halaman, ukuran file kecil.

const M = 14;               // margin kiri/kanan (mm)
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 18; // batas bawah konten (sisakan ruang footer)

const BLUE = [37, 99, 235];
const NAVY = [30, 58, 138];
const GRAY = [107, 114, 128];
const DARK = [31, 41, 55];
const LEVEL_COLOR = { good: [16, 185, 129], info: [59, 130, 246], warn: [245, 158, 11] };
const STATUS_COLOR = { done: [6, 95, 70], pending: [146, 64, 14], in_progress: [30, 64, 175], cancelled: [153, 27, 27] };

// Font bawaan PDF (Helvetica) hanya mendukung Latin-1: ganti karakter yang tidak didukung.
const safe = (s) => String(s ?? '')
  .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/\u2192/g, '->').replace(/\u2026/g, '...').replace(/[\u2713\u2714]/g, 'v')
  // buang karakter di luar Latin-1 (mis. emoji) agar tidak tampil sebagai karakter rusak
  .replace(/[^\u0000-\u00FF]/g, '');

const shortDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function ensure(doc, y, need) {
  if (y + need > BOTTOM) { doc.addPage(); return 20; }
  return y;
}

function heading(doc, y, text) {
  y = ensure(doc, y, 16);
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NAVY);
  doc.text(safe(text), M, y);
  doc.setDrawColor(...BLUE).setLineWidth(0.5).line(M, y + 1.8, M + CONTENT_W, y + 1.8);
  return y + 7;
}

function emptyNote(doc, y, text) {
  doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(...GRAY);
  doc.text(safe(text), M, y + 3);
  return y + 11;
}

function kpiRow(doc, y, items) {
  const gap = 4;
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const x = M + i * (w + gap);
    doc.setFillColor(243, 246, 252).setDrawColor(219, 228, 245).setLineWidth(0.3).roundedRect(x, y, w, 17, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...GRAY);
    doc.text(safe(it.label).toUpperCase(), x + 3, y + 5.2);
    doc.setFont('helvetica', 'bold').setFontSize(it.value.length > 14 ? 9 : 11).setTextColor(...(it.color || DARK));
    doc.text(safe(it.value), x + 3, y + 11.2);
    if (it.sub) { doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...GRAY); doc.text(safe(it.sub), x + 3, y + 15); }
  });
  return y + 17 + 4;
}

function barChart(doc, y, rows, unit) {
  const h = 46;
  y = ensure(doc, y, h + 12);
  const left = M + 11; const right = M + CONTENT_W - 2;
  const top = y + 3; const bottom = y + h - 8;
  const max = Math.max(...rows.map((r) => r.kwh), 0.01);
  const niceMax = max;

  doc.setDrawColor(229, 231, 235).setLineWidth(0.2).setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...GRAY);
  for (let g = 0; g <= 4; g += 1) {
    const gy = bottom - ((bottom - top) * g) / 4;
    doc.line(left, gy, right, gy);
    doc.text(fmtNum((niceMax * g) / 4, 1), left - 1.5, gy + 1.2, { align: 'right' });
  }
  const slot = (right - left) / rows.length;
  const bw = Math.min(slot * 0.62, 14);
  rows.forEach((r, i) => {
    const bh = ((bottom - top) * r.kwh) / niceMax;
    const x = left + slot * i + (slot - bw) / 2;
    if (bh > 0) doc.setFillColor(...BLUE).rect(x, bottom - bh, bw, bh, 'F');
    doc.setFontSize(7).setTextColor(...DARK).text(safe(r.label), x + bw / 2, bottom + 4, { align: 'center' });
    if (rows.length <= 8 && r.kwh > 0) {
      doc.setFontSize(6.5).setTextColor(...GRAY).text(fmtNum(r.kwh, 1), x + bw / 2, bottom - bh - 1, { align: 'center' });
    }
  });
  doc.setFontSize(6.5).setTextColor(...GRAY).text(`Satuan: ${unit}`, left, y + h - 1);
  return y + h + 4;
}

/**
 * @param {object} report  hasil buildReport()
 * @param {{jsPDF: any, autoTable: Function}} libs
 */
export function buildPdf(report, { jsPDF, autoTable }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { meta, energy, rooms, alerts, maintenance, assets, insights } = report;
  doc.setProperties({ title: safe(meta.title), subject: `Laporan ${meta.periodLabel}`, author: safe(meta.generatedBy), creator: 'BuildOptima' });

  const table = (opts) => {
    const userParse = opts.didParseCell;
    autoTable(doc, {
      margin: { left: M, right: M },
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: DARK, overflow: 'linebreak' },
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      ...opts,
      didParseCell: (d) => {
        // judul kolom mengikuti perataan isi kolomnya (angka rata kanan)
        const cs = opts.columnStyles && opts.columnStyles[d.column.index];
        if (d.section === 'head' && cs && cs.halign) d.cell.styles.halign = cs.halign;
        if (userParse) userParse(d);
      },
    });
  };
  const after = () => doc.lastAutoTable.finalY + 8;
  const ROW_H = 6.6; // perkiraan tinggi satu baris tabel (mm)
  // Tabel kecil dipindah utuh ke halaman berikutnya bila tidak muat, agar tidak terpotong.
  const keepTogether = (yy, rowCount) => ensure(doc, yy, (rowCount + 1) * ROW_H + 4);

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY).rect(0, 0, PAGE_W, 32, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(255, 255, 255).text(safe(meta.title), M, 14);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(200, 214, 245).text(safe(meta.subtitle), M, 20.5);
  doc.setFontSize(8.5).setTextColor(255, 255, 255);
  doc.text(`Periode: ${safe(meta.periodLabel)} - ${safe(meta.rangeLabel)}`, M, 27);
  doc.text(`Dicetak: ${safe(meta.generatedAtLabel)}`, PAGE_W - M, 14, { align: 'right' });
  doc.text(`Oleh: ${safe(meta.generatedBy)}`, PAGE_W - M, 20.5, { align: 'right' });
  let y = 40;

  // ── Ringkasan angka ───────────────────────────────────────────────────────
  y = heading(doc, y, 'Ringkasan');
  y = kpiRow(doc, y, [
    { label: 'Total konsumsi', value: `${fmtNum(energy.total)} kWh` },
    { label: 'Estimasi biaya', value: fmtRp(energy.cost), sub: `Tarif ${fmtRp(energy.tarif)}/kWh` },
    { label: `Rata-rata / ${meta.period === 'weekly' ? 'hari' : meta.period === 'monthly' ? 'bulan' : 'tahun'}`, value: `${fmtNum(energy.avg)} kWh` },
    { label: 'Puncak', value: energy.peak ? `${fmtNum(energy.peak.kwh)} kWh` : '-', sub: energy.peak ? energy.peak.label : '' },
  ]);
  y = kpiRow(doc, y, [
    { label: 'Aset perlu perhatian', value: `${assets.attention.length} / ${assets.total}`, color: assets.attention.length ? [180, 83, 9] : DARK },
    { label: 'Perawatan terbuka', value: String(maintenance.open), sub: maintenance.overdue ? `${maintenance.overdue} terlambat` : '', color: maintenance.overdue ? [185, 28, 28] : DARK },
    { label: 'Peringatan kritis', value: String(alerts.danger), sub: `dari ${alerts.total} notifikasi`, color: alerts.danger ? [185, 28, 28] : DARK },
    { label: 'Ruangan terboros', value: rooms.top ? rooms.top.room : '-', sub: rooms.top ? `${fmtNum(rooms.top.kwh)} kWh (${rooms.top.share}%)` : '' },
  ]);

  // ── Analisis ──────────────────────────────────────────────────────────────
  y = heading(doc, y + 2, 'Analisis Otomatis');
  doc.setFont('helvetica', 'normal').setFontSize(9);
  insights.forEach((it) => {
    const lines = doc.splitTextToSize(safe(it.text), CONTENT_W - 8);
    y = ensure(doc, y, lines.length * 4.4 + 2);
    doc.setFillColor(...(LEVEL_COLOR[it.level] || LEVEL_COLOR.info)).circle(M + 2, y - 1.1, 1.3, 'F');
    doc.setTextColor(...DARK).text(lines, M + 7, y);
    y += lines.length * 4.4 + 2;
  });
  y += 3;

  // ── Konsumsi energi ───────────────────────────────────────────────────────
  y = heading(doc, y, `Konsumsi Energi - ${meta.periodLabel}`);
  if (energy.hasData) {
    y = barChart(doc, y, energy.rows, energy.unit);
    y = keepTogether(y, energy.rows.length + 1);
    doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...GRAY).text('Rincian per periode', M, y);
    y += 2.5;
    table({
      startY: y,
      head: [['Periode', 'Konsumsi (kWh)', 'Estimasi Biaya (Rp)', '% dari Total']],
      body: [
        ...energy.rows.map((r) => [r.label, fmtNum(r.kwh), fmtNum(r.cost, 0), `${r.share}%`]),
        [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: fmtNum(energy.total), styles: { fontStyle: 'bold' } }, { content: fmtNum(energy.cost, 0), styles: { fontStyle: 'bold' } }, { content: '100%', styles: { fontStyle: 'bold' } }],
      ],
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    y = after();
  } else {
    y = emptyNote(doc, y, 'Belum ada data konsumsi energi pada periode ini.');
  }

  // ── Per ruangan ───────────────────────────────────────────────────────────
  y = heading(doc, keepTogether(y, Math.min(rooms.rows.length, 12)), 'Konsumsi per Ruangan');
  if (rooms.rows.length) {
    const maxKwh = Math.max(...rooms.rows.map((r) => r.kwh), 0.01);
    table({
      startY: y,
      head: [['Ruangan', 'Konsumsi (kWh)', 'Estimasi Biaya (Rp)', 'Porsi']],
      body: rooms.rows.map((r) => [r.room, fmtNum(r.kwh), fmtNum(r.cost, 0), '']),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { cellWidth: 62 } },
      didDrawCell: (d) => {
        if (d.section !== 'body' || d.column.index !== 3) return;
        const r = rooms.rows[d.row.index];
        const full = d.cell.width - 16;
        doc.setFillColor(...BLUE).rect(d.cell.x + 1.5, d.cell.y + d.cell.height / 2 - 1.6, Math.max((r.kwh / maxKwh) * full, 0.6), 3.2, 'F');
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GRAY).text(`${r.share}%`, d.cell.x + d.cell.width - 1.5, d.cell.y + d.cell.height / 2 + 1, { align: 'right' });
      },
    });
    y = after();
  } else {
    y = emptyNote(doc, y, 'Belum ada data konsumsi per ruangan pada periode ini.');
  }

  // ── Peringatan ────────────────────────────────────────────────────────────
  y = heading(doc, keepTogether(y, 5), 'Ringkasan Peringatan Bulan Ini');
  table({
    startY: y,
    head: [['Kategori', 'Jumlah', 'Keterangan']],
    body: [
      ['Kritis', alerts.danger, 'Perangkat offline / gangguan serius'],
      ['Peringatan', alerts.warn, 'Anomali energi dan kondisi perlu perhatian'],
      ['Info', alerts.info, 'Informasi sistem, termasuk jadwal perawatan'],
      ['Sukses', alerts.success, 'Kejadian normal (mis. ruangan kosong)'],
      [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: String(alerts.total), styles: { fontStyle: 'bold' } }, ''],
    ],
    columnStyles: { 1: { halign: 'right', cellWidth: 22 } },
  });
  y = after();

  // ── Aset ──────────────────────────────────────────────────────────────────
  y = heading(doc, ensure(doc, y, 40), 'Kondisi Aset (AI Predictive Maintenance)');
  if (assets.total) {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...DARK);
    doc.text(safe(`Total ${assets.total} aset: ${assets.ok} baik, ${assets.warn} perlu pengecekan, ${assets.critical} kritis. Rata-rata kesehatan ${assets.avgHealth}%.`), M, y);
    y += 4;
    if (assets.attention.length) {
      table({
        startY: y,
        head: [['Aset', 'Ruangan', 'Kondisi', 'Kesehatan', 'Status Perawatan']],
        body: assets.attention.map((a) => [
          safe(a.name), a.room, RISK_LABEL_PLAIN[a.risk] || a.risk, `${a.health}%`,
          a.maintenance ? STATUS_LABEL_PLAIN[a.maintenance] : 'Belum dijadwalkan',
        ]),
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (d) => {
          if (d.section !== 'body') return;
          if (d.column.index === 2) d.cell.styles.textColor = d.cell.raw === 'Kritis' ? [185, 28, 28] : [180, 83, 9];
          if (d.column.index === 4 && d.cell.raw === 'Belum dijadwalkan') d.cell.styles.textColor = [185, 28, 28];
        },
      });
      y = after();
    } else {
      y = emptyNote(doc, y, 'Semua aset dalam kondisi baik.');
    }
  } else {
    y = emptyNote(doc, y, 'Belum ada data aset.');
  }

  // ── Perawatan ─────────────────────────────────────────────────────────────
  y = heading(doc, ensure(doc, y, 40), 'Riwayat & Status Perawatan Aset');
  if (maintenance.rows.length) {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...DARK);
    const c = maintenance.counts;
    doc.text(safe(`Terjadwal: ${c.pending}   |   Dikerjakan: ${c.in_progress}   |   Selesai: ${c.done}   |   Batal: ${c.cancelled}`), M, y);
    y += 4;
    table({
      startY: y,
      head: [['Tanggal', 'Aset', 'Ruangan', 'Kegiatan', 'Teknisi', 'Status', 'Catatan']],
      body: maintenance.rows.map((j) => [
        shortDate(j.date), safe(j.asset), j.room, safe(j.activity), safe(j.technician),
        `${STATUS_LABEL_PLAIN[j.status] || j.status}${j.overdue ? ' (terlambat)' : ''}`, safe(j.notes),
      ]),
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, textColor: DARK, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 30 }, 2: { cellWidth: 15 }, 3: { cellWidth: 30 }, 4: { cellWidth: 22 }, 5: { cellWidth: 24 } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 5) {
          d.cell.styles.textColor = STATUS_COLOR[maintenance.rows[d.row.index].status] || DARK;
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = after();
  } else {
    y = emptyNote(doc, y, 'Belum ada catatan perawatan.');
  }

  // ── Footer semua halaman ──────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(209, 213, 219).setLineWidth(0.2).line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GRAY);
    doc.text('BuildOptima - dibuat otomatis dari data sistem', M, PAGE_H - 7.5);
    doc.text(`Halaman ${p} dari ${pages}`, PAGE_W - M, PAGE_H - 7.5, { align: 'right' });
  }
  return doc;
}

export const reportFileName = (report, ext) => {
  const d = report.meta.generatedAt;
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `laporan-buildoptima-${report.meta.period}-${stamp}.${ext}`;
};

// Pustaka PDF dimuat hanya saat tombol diklik (tidak membebani bundle awal aplikasi).
export async function exportPdf(report) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = buildPdf(report, { jsPDF, autoTable });
  doc.save(reportFileName(report, 'pdf'));
}