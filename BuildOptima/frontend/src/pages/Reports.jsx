import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { buildReport, fmtNum, fmtRp } from '../utils/report/buildReport.js';

const TABS = [{ key: 'weekly', label: 'Mingguan' }, { key: 'monthly', label: 'Bulanan' }, { key: 'yearly', label: 'Tahunan' }];
const STATUS_PILL = { done: 'pill-done', pending: 'pill-pending', cancelled: 'pill-cancel', in_progress: 'pill-progress' };
const STATUS_LABEL = { done: '✓ Selesai', pending: '⏳ Terjadwal', in_progress: '🔧 Dikerjakan', cancelled: '✕ Batal' };
const PILL_PROGRESS_STYLE = { background: '#dbeafe', color: '#1e40af' }; // pill "Dikerjakan" (kelas CSS belum ada)
const LEVEL_COLOR = { good: '#10b981', info: '#3b82f6', warn: '#f59e0b' };
const CONDITIONS = ['Baik', 'Ada Yang Rusak', 'Rusak'];
const OPEN = ['pending', 'in_progress'];

const dateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const showDate = (v) => new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Reports() {
  const { fetchTimeline, assetHealth, energySummary, refreshEnergySummary, refreshInventory, users } = useData();
  const { user, isAdmin } = useAuth();
  const showToast = useToast();
  const [period, setPeriod] = useState('weekly');
  const [timeline, setTimeline] = useState({ labels: [], vals: [] });
  const [history, setHistory] = useState([]);
  const [alertSummary, setAlertSummary] = useState({ danger: 0, warn: 0, info: 0, success: 0 });
  const [perRoom, setPerRoom] = useState([]);
  const [exporting, setExporting] = useState('');
  const [manage, setManage] = useState(null); // { job, form } — modal "Atur"
  const [finish, setFinish] = useState(null); // { job, form } — modal "Selesaikan"
  const [saving, setSaving] = useState(false);

  // data yang bergantung pada periode: grafik waktu + konsumsi per ruangan
  useEffect(() => {
    fetchTimeline(period).then(setTimeline).catch(() => {});
    api.get('/energy/per-room', { params: { period } }).then((r) => setPerRoom(r.data)).catch(() => {});
  }, [period]);

  const loadHistory = () => api.get('/reports/maintenance-history').then((r) => setHistory(r.data)).catch(() => {});
  useEffect(() => {
    loadHistory();
    api.get('/reports/alert-summary').then((r) => setAlertSummary(r.data)).catch(() => {});
    refreshEnergySummary();
  }, []);

  // Satu sumber data untuk tampilan, PDF, dan Excel
  const report = useMemo(() => buildReport({
    period, timeline, perRoom, alertSummary, history, assetHealth, energySummary,
    generatedBy: user?.name || user?.username || '-',
  }), [period, timeline, perRoom, alertSummary, history, assetHealth, energySummary, user]);

  async function download(kind) {
    if (exporting) return;
    setExporting(kind);
    try {
      // modul dimuat saat diklik, supaya halaman lain tidak ikut membawa pustaka PDF/Excel
      if (kind === 'pdf') { const m = await import('../utils/report/exportPdf.js'); await m.exportPdf(report); }
      else { const m = await import('../utils/report/exportExcel.js'); await m.exportExcel(report); }
      showToast(kind === 'pdf' ? 'Laporan PDF berhasil dibuat!' : 'Laporan Excel berhasil dibuat!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat file laporan.', 'danger');
    } finally {
      setExporting('');
    }
  }

  // ── aksi perawatan ────────────────────────────────────────────────────────
  async function patchJob(job, body, okMsg) {
    setSaving(true);
    try {
      await api.patch(`/reports/maintenance/${job.id}`, body);
      await Promise.all([loadHistory(), refreshInventory().catch(() => {})]);
      showToast(okMsg, 'success');
      return true;
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal memperbarui perawatan.', 'danger');
      return false;
    } finally {
      setSaving(false);
    }
  }

  const startJob = (job) => patchJob(job, { status: 'in_progress', technician: job.technician || user?.name || user?.username }, 'Perawatan mulai dikerjakan.');
  async function cancelJob(job) {
    if (!window.confirm(`Batalkan perawatan "${job.activity}" untuk ${job.asset_name}?`)) return;
    patchJob(job, { status: 'cancelled' }, 'Perawatan dibatalkan.');
  }
  async function deleteJob(job) {
    if (!window.confirm(`Hapus catatan perawatan "${job.activity}" untuk ${job.asset_name}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api.delete(`/reports/maintenance/${job.id}`);
      await Promise.all([loadHistory(), refreshInventory().catch(() => {})]);
      showToast('Catatan perawatan dihapus.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menghapus catatan.', 'danger');
    }
  }

  const openManage = (job) => setManage({ job, form: { activity: job.activity, technician: job.technician || '', scheduled_date: dateInput(job.scheduled_date), notes: job.notes || '' } });
  async function saveManage() {
    const { job, form } = manage;
    if (!form.activity.trim()) { showToast('Isi jenis kegiatan!', 'danger'); return; }
    if (await patchJob(job, { activity: form.activity.trim(), technician: form.technician, scheduled_date: form.scheduled_date || null, notes: form.notes }, 'Jadwal perawatan diperbarui.')) setManage(null);
  }

  const openFinish = (job) => setFinish({ job, form: { condition_after: 'Baik', technician: job.technician || user?.name || user?.username || '', notes: job.notes || '' } });
  async function saveFinish() {
    const { job, form } = finish;
    if (await patchJob(job, { status: 'done', condition_after: form.condition_after, technician: form.technician, notes: form.notes }, `Perawatan selesai. Kondisi aset: ${form.condition_after}.`)) setFinish(null);
  }

  // daftar teknisi = semua user terdaftar (+ nama yang sudah tercatat di pekerjaan, bila bukan user)
  const techOptions = (current) => {
    const names = [...new Set([...users.map((u) => u.name || u.username), current].filter(Boolean))];
    return names.map((n) => <option key={n} value={n}>{n}</option>);
  };

  const chartData = timeline.labels.map((l, i) => ({ label: l, kwh: timeline.vals[i] }));
  const maxRoom = Math.max(...perRoom.map((r) => Number(r.total)), 1);
  const roomColors = ['#3b82f6', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b'];
  const { energy, insights } = report;
  const kpis = [
    { label: 'Total Konsumsi', value: `${fmtNum(energy.total)} kWh` },
    { label: 'Estimasi Biaya', value: fmtRp(energy.cost) },
    { label: 'Rata-rata', value: `${fmtNum(energy.avg)} kWh` },
    { label: 'Puncak', value: energy.peak ? `${fmtNum(energy.peak.kwh)} kWh` : '-', sub: energy.peak?.label },
  ];

  return (
    <>
      <div className="rpt-header-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, position: 'relative', zIndex: 1 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,.2)', flexShrink: 0 }}>
            <Icon name="report" size={21} stroke="white" strokeWidth={1.8} />
          </div>
          <div>
            <div className="rpt-header-title">Laporan &amp; Analitik</div>
            <div className="rpt-header-sub">Ringkasan operasional gedung Teknik Komputer UNDIP</div>
          </div>
        </div>
        <div className="rpt-header-actions">
          <button className="rpt-dl-btn excel" onClick={() => download('excel')} disabled={!!exporting}><Icon name="report" size={14} />{exporting === 'excel' ? 'Membuat...' : 'Unduh Excel'}</button>
          <button className="rpt-dl-btn pdf" onClick={() => download('pdf')} disabled={!!exporting}><Icon name="report" size={14} />{exporting === 'pdf' ? 'Membuat...' : 'Unduh PDF'}</button>
        </div>
      </div>

      <div className="rpt-tabs">
        {TABS.map((t) => <button key={t.key} className={`rpt-tab${period === t.key ? ' active' : ''}`} onClick={() => setPeriod(t.key)}>{t.label}</button>)}
      </div>

      <div className="rpt-chart-card">
        <div className="rpt-chart-title"><Icon name="report" size={16} stroke="#3b82f6" />Ringkasan &amp; Analisis — {report.meta.periodLabel}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10, marginBottom: 12 }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ padding: '9px 11px', background: 'var(--gray-50)', borderRadius: 9, border: '1px solid var(--gray-100)' }}>
              <div style={{ fontSize: '.62rem', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
              <div style={{ fontSize: '.98rem', fontWeight: 700, fontFamily: "'DM Mono'", color: 'var(--gray-900)', marginTop: 2 }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: '.64rem', color: 'var(--gray-400)' }}>{k.sub}</div>}
            </div>
          ))}
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {insights.map((it, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: '.79rem', lineHeight: 1.45, color: 'var(--gray-700)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: LEVEL_COLOR[it.level], marginTop: 6, flexShrink: 0 }} />
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 10, fontSize: '.68rem', color: 'var(--gray-400)' }}>Dihitung otomatis dari data sistem. File PDF/Excel berisi angka dan analisis yang sama.</div>
      </div>

      <div className="rpt-chart-card">
        <div className="rpt-chart-title"><Icon name="energy" size={16} stroke="#f59e0b" />Konsumsi Energi (kWh)</div>
        <div style={{ height: 110 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#374151', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#374151', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v} kWh`, 'Konsumsi']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="kwh" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rpt-chart-card">
        <div className="rpt-chart-title"><Icon name="home" size={16} stroke="#3b82f6" />Konsumsi per Ruangan</div>
        <div>
          {perRoom.map((r, i) => (
            <div className="rpt-trend-row" key={r.room_id}>
              <div className="rpt-trend-label">{r.room_id}</div>
              <div className="rpt-trend-track"><div className="rpt-trend-fill" style={{ width: `${Math.round((r.total / maxRoom) * 100)}%`, background: roomColors[i % roomColors.length] }} /></div>
              <div className="rpt-trend-val">{r.total} kWh</div>
            </div>
          ))}
          {perRoom.length === 0 && <div style={{ color: 'var(--gray-400)', fontSize: '.8rem' }}>Belum ada data.</div>}
        </div>
      </div>

      <div className="rpt-table-card">
        <div className="rpt-table-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="wrench" size={16} stroke="#10b981" />Riwayat Perawatan Aset</div>
        <div style={{ fontSize: '.7rem', color: 'var(--gray-400)', margin: '-4px 0 10px' }}>
          Alur: <b>Terjadwal</b> → <b>Dikerjakan</b> → <b>Selesai</b> (kondisi aset diperbarui) atau <b>Batal</b>. Tambah jadwal baru dari panel AI Predictive Maintenance di halaman Inventaris.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="rpt-tbl">
            <thead><tr><th>Tanggal</th><th>Aset</th><th>Ruangan</th><th>Jenis</th><th>Teknisi</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {history.map((h) => {
                const open = OPEN.includes(h.status);
                const overdue = open && h.scheduled_date && new Date(h.scheduled_date) < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <tr key={h.id}>
                    <td style={{ fontFamily: "'DM Mono'", fontSize: '.71rem', fontWeight: 700 }}>
                      {showDate(h.completed_at || h.scheduled_date || h.performed_at)}
                      {overdue && <div style={{ fontSize: '.62rem', color: '#dc2626', fontFamily: 'inherit' }}>Terlambat</div>}
                    </td>
                    <td>{h.asset_name}</td><td>{h.room_id || '—'}</td>
                    <td>{h.activity}{h.notes && <div style={{ fontSize: '.66rem', color: 'var(--gray-400)' }}>{h.notes}</div>}</td>
                    <td>{h.technician || <span style={{ color: 'var(--gray-400)' }}>Belum ditentukan</span>}</td>
                    <td><span className={`rpt-pill ${STATUS_PILL[h.status]}`} style={h.status === 'in_progress' ? PILL_PROGRESS_STYLE : undefined}>{STATUS_LABEL[h.status]}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {h.status === 'pending' && <button className="btn-sm btn-outline" onClick={() => startJob(h)} disabled={saving}>Mulai</button>}
                        {open && <button className="btn-sm btn-success" onClick={() => openFinish(h)} disabled={saving}>Selesaikan</button>}
                        {open && <button className="btn-sm btn-outline" onClick={() => openManage(h)} disabled={saving}>Atur</button>}
                        {open && <button className="btn-sm btn-outline" onClick={() => cancelJob(h)} disabled={saving}>Batal</button>}
                        {isAdmin && <button className="btn-sm btn-danger" onClick={() => deleteJob(h)}>Hapus</button>}
                        {!open && !isAdmin && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {history.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 16 }}>Belum ada perawatan. Jadwalkan dari panel AI Predictive Maintenance di halaman Inventaris.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rpt-table-card">
        <div className="rpt-table-title" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}><Icon name="warn" size={16} stroke="#f59e0b" />Ringkasan Peringatan Bulan Ini</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 10 }}>
          <div style={{ textAlign: 'center', padding: 12, background: '#fff1f2', borderRadius: 9, border: '1px solid #fca5a5' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: "'DM Mono'", color: '#ef4444' }}>{alertSummary.danger}</div><div style={{ fontSize: '.67rem', color: '#991b1b', fontWeight: 600, marginTop: 2 }}>Kritis</div></div>
          <div style={{ textAlign: 'center', padding: 12, background: '#fffbeb', borderRadius: 9, border: '1px solid #fcd34d' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: "'DM Mono'", color: '#f59e0b' }}>{alertSummary.warn}</div><div style={{ fontSize: '.67rem', color: '#92400e', fontWeight: 600, marginTop: 2 }}>Peringatan</div></div>
          <div style={{ textAlign: 'center', padding: 12, background: '#eff6ff', borderRadius: 9, border: '1px solid #93c5fd' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: "'DM Mono'", color: '#3b82f6' }}>{alertSummary.info}</div><div style={{ fontSize: '.67rem', color: '#1e40af', fontWeight: 600, marginTop: 2 }}>Info</div></div>
          <div style={{ textAlign: 'center', padding: 12, background: '#f0fdf4', borderRadius: 9, border: '1px solid #6ee7b7' }}><div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: "'DM Mono'", color: '#10b981' }}>{alertSummary.success}</div><div style={{ fontSize: '.67rem', color: '#065f46', fontWeight: 600, marginTop: 2 }}>Sukses</div></div>
        </div>
      </div>

      <Modal
        open={!!manage}
        onClose={() => setManage(null)}
        title="Atur Perawatan"
        actions={<>
          <button className="btn-sm btn-outline" disabled={saving} onClick={() => setManage(null)}>Batal</button>
          <button className="btn-sm btn-success" disabled={saving} onClick={saveManage}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </>}
      >
        {manage && (
          <>
            <div className="form-group"><label className="form-label">Aset</label><input className="form-input" value={manage.job.asset_name} disabled /></div>
            <div className="form-group"><label className="form-label">Jenis Kegiatan</label><input className="form-input" value={manage.form.activity} onChange={(e) => setManage({ ...manage, form: { ...manage.form, activity: e.target.value } })} /></div>
            <div className="form-group">
              <label className="form-label">Teknisi</label>
              <select className="form-input" value={manage.form.technician} onChange={(e) => setManage({ ...manage, form: { ...manage.form, technician: e.target.value } })}>
                <option value="">— Belum ditentukan —</option>
                {techOptions(manage.job.technician)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Tanggal Rencana</label><input className="form-input" type="date" value={manage.form.scheduled_date} onChange={(e) => setManage({ ...manage, form: { ...manage.form, scheduled_date: e.target.value } })} /></div>
            <div className="form-group"><label className="form-label">Catatan</label><textarea className="form-input" rows={3} maxLength={500} placeholder="Mis. bawa kabel cadangan" value={manage.form.notes} onChange={(e) => setManage({ ...manage, form: { ...manage.form, notes: e.target.value } })} /></div>
          </>
        )}
      </Modal>

      <Modal
        open={!!finish}
        onClose={() => setFinish(null)}
        title="Selesaikan Perawatan"
        actions={<>
          <button className="btn-sm btn-outline" disabled={saving} onClick={() => setFinish(null)}>Batal</button>
          <button className="btn-sm btn-success" disabled={saving} onClick={saveFinish}>{saving ? 'Menyimpan...' : 'Tandai Selesai'}</button>
        </>}
      >
        {finish && (
          <>
            <div style={{ fontSize: '.8rem', color: 'var(--gray-600)', marginBottom: 12 }}><b>{finish.job.asset_name}</b> — {finish.job.activity}</div>
            <div className="form-group">
              <label className="form-label">Kondisi Aset Setelah Perawatan</label>
              <select className="form-input" value={finish.form.condition_after} onChange={(e) => setFinish({ ...finish, form: { ...finish.form, condition_after: e.target.value } })}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ fontSize: '.68rem', color: 'var(--gray-400)', marginTop: 4 }}>Kondisi ini langsung memperbarui data aset dan analisis AI di halaman Inventaris.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Teknisi</label>
              <select className="form-input" value={finish.form.technician} onChange={(e) => setFinish({ ...finish, form: { ...finish.form, technician: e.target.value } })}>
                <option value="">— Tidak dicatat —</option>
                {techOptions(finish.form.technician)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Catatan Hasil</label><textarea className="form-input" rows={3} maxLength={500} placeholder="Apa yang dikerjakan / diganti" value={finish.form.notes} onChange={(e) => setFinish({ ...finish, form: { ...finish.form, notes: e.target.value } })} /></div>
          </>
        )}
      </Modal>
    </>
  );
}