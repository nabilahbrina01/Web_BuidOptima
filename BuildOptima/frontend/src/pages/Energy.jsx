import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Icon from '../components/Icon.jsx';
import api from '../api/client.js';
import { useData } from '../context/DataContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const TABS = [
  { key: 'daily', label: 'Harian' },
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'yearly', label: 'Tahunan' },
];

function formatRupiah(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function shortRupiah(v) { return v >= 1e6 ? (v / 1e6).toFixed(1) + 'jt' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'rb' : Math.round(v); }

export default function Energy() {
  const { rooms, fetchTimeline, energySummary, refreshEnergySummary } = useData();
  const showToast = useToast();
  const [tab, setTab] = useState('daily');
  const [roomFilter, setRoomFilter] = useState('');
  const [timeline, setTimeline] = useState({ labels: [], vals: [], unit: 'kWh', tarif: 1877 });
  const [perRoom, setPerRoom] = useState([]);

  useEffect(() => { refreshEnergySummary(); }, []);

  useEffect(() => {
    fetchTimeline(tab, roomFilter || undefined).then(setTimeline).catch(() => showToast('Gagal memuat data energi.', 'danger'));
  }, [tab, roomFilter]);

  useEffect(() => {
    api.get('/energy/per-room').then((r) => setPerRoom(r.data)).catch(() => {});
  }, [rooms]);

  const chartData = timeline.labels.map((l, i) => ({ label: l, kwh: timeline.vals[i], biaya: Math.round(timeline.vals[i] * timeline.tarif) }));
  const totalKwh = timeline.vals.reduce((a, b) => a + b, 0);
  const totalRp = totalKwh * timeline.tarif;
  const periodLabel = tab === 'daily' ? 'Hari ini (24 jam)' : tab === 'weekly' ? 'Minggu ini' : tab === 'monthly' ? 'Tahun ini' : '5 Tahun Terakhir';

  function downloadExcel() {
    let csv = 'Periode,Konsumsi (kWh),Biaya Listrik (Rp)\n';
    chartData.forEach((d) => { csv += `${d.label},${d.kwh},${d.biaya}\n`; });
    csv += `\nTotal,${totalKwh.toFixed(1)},${Math.round(totalRp)}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `laporan-energi-${tab}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('Laporan berhasil diunduh sebagai Excel/CSV!', 'success');
  }

  function downloadPDF() {
    const rows = chartData.map((d) => `<tr><td>${d.label}</td><td>${d.kwh} kWh</td><td>${formatRupiah(d.biaya)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Laporan Energi</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:16px;margin-bottom:4px}p{font-size:12px;color:#555;margin:2px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#2563eb;color:white;padding:8px 10px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #eee}.total{font-weight:700;background:#f0f6ff}</style></head>
    <body><h1>Laporan Energi ${tab} — BuildOptima UNDIP</h1><p>Tarif: Rp ${timeline.tarif}/kWh · Dicetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <table><thead><tr><th>Periode</th><th>Konsumsi</th><th>Biaya Listrik</th></tr></thead><tbody>${rows}<tr class="total"><td>TOTAL</td><td>${totalKwh.toFixed(1)} kWh</td><td>${formatRupiah(totalRp)}</td></tr></tbody></table></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 400);
    showToast('Membuka dialog cetak PDF laporan...', 'info');
  }

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        <div className="stat-card"><div className="stat-hdr"><div className="stat-icon si-amber"><Icon name="energy" /></div><span className="badge bg-amber">Hari ini</span></div><div className="stat-val">{energySummary?.todayKwh ?? 0}</div><div className="stat-lbl">kWh Terpakai</div></div>
        <div className="stat-card"><div className="stat-hdr"><div className="stat-icon si-green"><Icon name="trend" /></div><span className="badge bg-green">Efisiensi</span></div><div className="stat-val">↓{energySummary?.efficiencyPct ?? 0}%</div><div className="stat-lbl">vs kemarin</div></div>
        <div className="stat-card"><div className="stat-hdr"><div className="stat-icon si-blue"><Icon name="bolt" /></div><span className="badge bg-blue">Hari ini</span></div><div className="stat-val" style={{ fontSize: '1.1rem' }}>{formatRupiah(energySummary?.biayaToday ?? 0)}</div><div className="stat-lbl">Biaya Listrik hari ini</div></div>
        <div className="stat-card"><div className="stat-hdr"><div className="stat-icon si-cyan"><Icon name="schedule" /></div><span className="badge bg-blue">Bulan ini</span></div><div className="stat-val" style={{ fontSize: '1.1rem' }}>{formatRupiah(energySummary?.biayaMonthEstimate ?? 0)}</div><div className="stat-lbl">Estimasi tagihan bulan ini</div></div>
      </div>

      <div className="card">
        <div className="sec-hdr">
          <div className="sec-title">Konsumsi Energi &amp; Biaya Listrik</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={downloadExcel} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', padding: '5px 10px' }}><Icon name="report" size={13} />Unduh Excel</button>
            <button className="btn btn-outline btn-sm" onClick={downloadPDF} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', padding: '5px 10px' }}><Icon name="report" size={13} />Unduh PDF</button>
          </div>
        </div>
        <div className="etab-wrap" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map((t) => (
            <button key={t.key} className={`etab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            style={{ marginLeft: 'auto', padding: '6px 10px', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: '.78rem', cursor: 'pointer' }}
          >
            <option value="">Semua Ruangan</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_code || r.id} — {r.name}</option>)}
          </select>
        </div>

        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#374151', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#374151', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v} kWh`, 'Konsumsi']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="kwh" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: 4, fontSize: '.72rem', color: 'var(--gray-500)', textAlign: 'center' }}>
          Total: {totalKwh.toFixed(1)} {timeline.unit} · {periodLabel}
        </div>

        <div style={{ marginTop: 18, borderTop: '1px solid var(--gray-200)', paddingTop: 14 }}>
          <div style={{ fontSize: '.83rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 10 }}>Harga Listrik (Rupiah)</div>
          <div style={{ height: 110 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#374151', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={shortRupiah} tick={{ fontSize: 10, fill: '#374151', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [formatRupiah(v), 'Biaya']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="biaya" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 8, fontSize: '.72rem', color: 'var(--gray-500)', textAlign: 'center' }}>
            Total Biaya: {formatRupiah(totalRp)} · Tarif Rp {timeline.tarif}/kWh
          </div>
        </div>
      </div>

      <div className="card">
        <div className="sec-hdr"><div className="sec-title">Konsumsi per Ruangan (kWh)</div></div>
        <div>
          {perRoom.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: '.8rem' }}>Belum ada data energi per ruangan hari ini.</div>}
          {perRoom.map((d) => {
            const max = Math.max(...perRoom.map((x) => Number(x.total)), 1);
            return (
              <div className="e-room-bar" key={d.room_id}>
                <div className="erb-label">{d.room_id}</div>
                <div className="erb-track"><div className="erb-fill" style={{ width: `${Math.round((d.total / max) * 100)}%`, background: 'var(--blue-500)' }} /></div>
                <div className="erb-val">{d.total} kWh</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
