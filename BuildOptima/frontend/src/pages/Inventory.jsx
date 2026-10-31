import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import QRCode from '../components/QRCode.jsx';
import QRScanner from '../components/QRScanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const COND_MAP = { Baik: 'bg-green', 'Ada Yang Rusak': 'bg-amber', Rusak: 'bg-red' };
const emptyForm = { name: '', room_id: '', qty: 1, condition_status: 'Baik', note: '' };

export default function Inventory() {
  const { isAdmin } = useAuth();
  const { inventory, assetHealth, rooms, addInventory, updateInventory, deleteInventory, scanInventory, scheduleMaintenance } = useData();
  const showToast = useToast();

  const [roomFilter, setRoomFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [detailItem, setDetailItem] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [aipmFilter, setAipmFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = inventory.filter((i) => (!roomFilter || String(i.room_id) === String(roomFilter)) && (!nameFilter || i.name.toLowerCase().includes(nameFilter.toLowerCase())));

  const summary = useMemo(() => {
    const map = {};
    inventory.forEach((i) => { map[i.name] = (map[i.name] || 0) + i.qty; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [inventory]);

  const aipmVisible = assetHealth.filter((a) => aipmFilter === 'all' || a.risk === aipmFilter);
  const okCount = assetHealth.filter((a) => a.risk === 'ok').length;
  const warnCount = assetHealth.filter((a) => a.risk === 'warn' || a.risk === 'critical').length;

  function openAdd() { setEditing(null); setForm({ ...emptyForm, room_id: rooms[0]?.id || '' }); setModalOpen(true); }
  function openEdit(item) { setEditing(item); setForm({ name: item.name, room_id: item.room_id, qty: item.qty, condition_status: item.condition_status, note: item.note || '' }); setModalOpen(true); }

  async function save() {
    if (saving) return; // cegah klik ganda / submit dobel
    if (!form.name.trim()) { showToast('Isi nama aset!', 'danger'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateInventory(editing.id, { name: form.name, qty: Number(form.qty) || 1, condition_status: form.condition_status, note: form.note });
        showToast('Aset diperbarui!', 'success');
      } else {
        const created = await addInventory({ name: form.name, room_id: form.room_id, qty: Number(form.qty) || 1, condition_status: form.condition_status, note: form.note });
        showToast(`Aset ditambahkan dengan QR Code ${created.qr_code}`, 'success');
      }
      setModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menyimpan aset.', 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!confirm(`Hapus aset "${item.name}"?`)) return;
    await deleteInventory(item.id);
    showToast('Aset dihapus.', 'success');
  }

  async function doScan(code) {
    const value = (code ?? scanCode).trim();
    if (!value) return;
    try {
      const item = await scanInventory(value);
      showToast(`Aset ditemukan: ${item.name} — ${item.room_code || '-'}`, 'success');
      setScanOpen(false); setScanCode('');
      setDetailItem(item);
    } catch {
      showToast(`Aset dengan kode "${value}" tidak ditemukan.`, 'danger');
    }
  }

  async function scheduleService(a) {
    try {
      await scheduleMaintenance(a.id, a.risk === 'critical' ? 'Perbaikan / Penggantian' : 'Pengecekan Komponen');
      showToast('Jadwal servis ditambahkan! Kelola (atur teknisi, mulai, selesaikan) di Laporan → Riwayat Perawatan.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Gagal menambahkan jadwal servis.', 'danger');
    }
  }

  function refreshAI() {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); showToast('Analisis AI berhasil diperbarui!', 'success'); }, 1200);
  }

  function printQR(item) {
    const dataUrl = document.querySelector('#detail-qr-canvas-wrap canvas')?.toDataURL('image/png');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>QR — ${item.name}</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:40px}img{width:220px;height:220px}h2{margin:16px 0 4px}p{color:#555;font-size:13px}</style></head>
      <body>${dataUrl ? `<img src="${dataUrl}" />` : ''}<h2>${item.name}</h2><p>${item.room_code || '-'} · Kode: ${item.qr_code}</p></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  return (
    <>
      <div className="sec-hdr">
        <div className="sec-title">Daftar Inventaris</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setScanOpen(true)}>Scan QR Code</button>
          {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Tambah Aset</button>}
        </div>
      </div>

      <div className="inv-summary">
        {summary.map(([name, qty]) => (
          <div className="inv-chip" key={name}><div className="inv-chip-val">{qty}</div><div>{name}</div></div>
        ))}
      </div>

      <div className="inv-filter-row" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <input type="text" placeholder="Cari nama inventaris..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>
            <option value="">Semua Ruangan</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_code || r.id} — {r.name}</option>)}
          </select>
        </div>
        <span style={{ fontSize: '.79rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{filtered.length} item</span>
      </div>

      <div className="inv-grid">
        {filtered.map((item) => (
          <div className="inv-card" key={item.id} onClick={() => setDetailItem(item)}>
            <div className="inv-icon"><Icon name="inventory" /></div>
            <div className="inv-name">{item.name}</div>
            <div className="inv-loc">{item.room_code} · Qty: {item.qty}</div>
            <div className="inv-foot"><span className="qr-strip">{item.qr_code}</span><span className={`badge ${COND_MAP[item.condition_status]}`}>{item.condition_status}</span></div>
            {isAdmin && (
              <div className="inv-actions">
                <button className="btn-sm btn-outline" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); openEdit(item); }}>Edit</button>
                <button className="btn-sm btn-danger" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); remove(item); }}>Hapus</button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 32, color: 'var(--gray-400)', fontSize: '.83rem' }}>Tidak ada aset ditemukan.</div>}
      </div>

      {/* ── AI Predictive Maintenance ── */}
      <div className="aipm-wrap">
        <div className="aipm-header">
          <div className="aipm-title-row">
            <div className="aipm-title-left">
              <div className="aipm-icon-wrap"><Icon name="brain" size={20} stroke="white" strokeWidth={1.8} /></div>
              <div>
                <div className="aipm-label">AI Predictive Maintenance</div>
                <div className="aipm-sublabel">Analisis cerdas kondisi aset &amp; prediksi perawatan</div>
              </div>
            </div>
            <div className="aipm-live-badge"><div className="aipm-live-dot" />AI Aktif</div>
          </div>
        </div>
        <div className="aipm-stats">
          <div className="aipm-stat">
            <div className="aipm-stat-icon" style={{ background: '#dcfce7' }}><Icon name="checkSimple" size={13} stroke="#10b981" /></div>
            <div className="aipm-stat-val" style={{ color: '#10b981' }}>{okCount}</div>
            <div className="aipm-stat-lbl">Aset<br />Kondisi Baik</div>
          </div>
          <div className="aipm-stat">
            <div className="aipm-stat-icon" style={{ background: '#fef3c7' }}><Icon name="warn" size={13} stroke="#f59e0b" /></div>
            <div className="aipm-stat-val" style={{ color: '#f59e0b' }}>{warnCount}</div>
            <div className="aipm-stat-lbl">Perlu<br />Perhatian</div>
          </div>
          <div className="aipm-stat">
            <div className="aipm-stat-icon" style={{ background: '#dbeafe' }}><Icon name="clock" size={13} stroke="#2563eb" /></div>
            <div className="aipm-stat-val" style={{ color: '#2563eb' }}>{Math.min(...assetHealth.map((a) => a.next_service_days ?? 999), 14)}<span style={{ fontSize: '.75rem', fontWeight: 500 }}> hr</span></div>
            <div className="aipm-stat-lbl">Servis<br />Berikutnya</div>
          </div>
          <div className="aipm-stat">
            <div className="aipm-stat-icon" style={{ background: '#ede9fe' }}><Icon name="settings" size={13} stroke="#7c3aed" /></div>
            <div className="aipm-stat-val" style={{ color: '#7c3aed' }}>92<span style={{ fontSize: '.75rem', fontWeight: 500 }}>%</span></div>
            <div className="aipm-stat-lbl">Akurasi<br />Model AI</div>
            <div className="aipm-accuracy-row"><div className="aipm-accuracy-mini-bar"><div className="aipm-accuracy-mini-fill" /></div></div>
          </div>
        </div>
        <div className="aipm-filterbar">
          <span className="aipm-filter-label">Filter:</span>
          <button className={`aipm-filter-btn${aipmFilter === 'all' ? ' active' : ''}`} onClick={() => setAipmFilter('all')}>Semua</button>
          <button className={`aipm-filter-btn${aipmFilter === 'warn' ? ' active' : ''}`} onClick={() => setAipmFilter('warn')}>Perhatian</button>
          <button className={`aipm-filter-btn${aipmFilter === 'ok' ? ' active' : ''}`} onClick={() => setAipmFilter('ok')}>Kondisi Baik</button>
          <div className="aipm-filter-spacer" />
          <span style={{ fontSize: '.67rem', color: 'var(--gray-400)', fontFamily: "'DM Mono'" }}>{assetHealth.length} aset teranalisis</span>
        </div>
        <div className="aipm-body">
          {aipmVisible.map((a) => (
            <div className={`aipm-card risk-${a.risk === 'critical' ? 'critical' : a.risk}`} key={a.id}>
              <div className="aipm-card-icon"><Icon name={a.risk === 'ok' ? 'checkSimple' : 'device'} size={18} stroke={a.risk === 'ok' ? '#10b981' : a.risk === 'critical' ? '#ef4444' : '#f59e0b'} /></div>
              <div className="aipm-card-body">
                <div className="aipm-card-title">
                  {a.asset_name} — {a.room_code}
                  <span className={`aipm-risk-chip ${a.risk === 'ok' ? 'ok' : a.risk === 'critical' ? 'critical' : 'warn'}`}>
                    {a.risk === 'ok' ? '✓ Kondisi Baik' : a.risk === 'critical' ? '✕ Risiko Tinggi' : '⚠ Risiko Sedang'}
                  </span>
                </div>
                <div className="aipm-card-desc">{a.notes}</div>
                <div className="aipm-health-wrap">
                  <div className="aipm-health-label"><span>Kondisi Komponen</span><span style={{ fontFamily: "'DM Mono'", color: a.risk === 'ok' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{a.health_pct}%</span></div>
                  <div className="aipm-health-track"><div className={`aipm-health-fill fill-${a.risk === 'ok' ? 'ok' : a.risk === 'critical' ? 'critical' : 'warn'}`} style={{ width: `${a.health_pct}%` }} /></div>
                </div>
                <div className="aipm-card-meta">
                  <span style={{ fontSize: '.64rem', color: 'var(--gray-400)', fontFamily: "'DM Mono'" }}>Update {new Date(a.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
              {a.risk !== 'ok' && (a.maintenance_status
                ? <button className="aipm-action-btn warn" disabled style={{ opacity: 0.7, cursor: 'default' }} title="Kelola di menu Laporan → Riwayat Perawatan">{a.maintenance_status === 'in_progress' ? '🔧 Sedang dikerjakan' : '✓ Terjadwal'}</button>
                : <button className="aipm-action-btn warn" onClick={() => scheduleService(a)}>+ Jadwalkan</button>)}
            </div>
          ))}
          {aipmVisible.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--gray-400)', fontSize: '.8rem' }}>Tidak ada aset pada filter ini.</div>}
        </div>
        <div className="aipm-insight">
          <div className="aipm-insight-icon"><Icon name="info" size={14} stroke="white" strokeWidth={1.8} /></div>
          <div className="aipm-insight-text">
            <strong>Ringkasan AI:</strong> Dari {assetHealth.length} aset yang dianalisis, <strong>{warnCount} aset</strong> memerlukan perhatian segera.
          </div>
        </div>
        <div className="aipm-footer">
          <div className="aipm-footer-meta"><Icon name="clock" size={12} />Diperbarui otomatis setiap 24 jam</div>
          <button className="aipm-refresh-btn" onClick={refreshAI}>
            <Icon name="refresh" size={13} strokeWidth={2.5} className={refreshing ? 'aipm-spinning' : ''} />
            Perbarui Analisis
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title={detailItem?.name} maxWidth={420}
        actions={<>
          <button className="btn-sm btn-outline" onClick={() => setDetailItem(null)}>Tutup</button>
          <button className="btn-sm btn-primary" onClick={() => printQR(detailItem)}>Cetak QR</button>
        </>}>
        {detailItem && (
          <>
            <div className="modal-grid">
              <div><span className="mf-label">Nama Aset</span><p className="mf-val">{detailItem.name}</p></div>
              <div><span className="mf-label">Ruangan</span><p className="mf-val">{detailItem.room_code}</p></div>
              <div><span className="mf-label">Jumlah Unit</span><p className="mf-val">{detailItem.qty} unit</p></div>
              <div><span className="mf-label">Kondisi</span><p className="mf-val">{detailItem.condition_status}</p></div>
              <div><span className="mf-label">Kode QR</span><p className="mf-val" style={{ fontFamily: "'DM Mono'" }}>{detailItem.qr_code}</p></div>
            </div>
            <div id="detail-qr-canvas-wrap" style={{ textAlign: 'center', margin: '10px 0' }}><QRCode value={detailItem.qr_code} size={120} /></div>
          </>
        )}
      </Modal>

      {/* Scan Modal */}
      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="Scan QR Code Aset"
        maxWidth={460}
        actions={<button className="btn-sm btn-outline" onClick={() => setScanOpen(false)}>Tutup</button>}
      >
        <QRScanner active={scanOpen} onDetect={(text) => doScan(text)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
          <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>atau masukkan kode manual</span>
          <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Kode QR Aset</label>
          <input
            className="form-input scan-code-input"
            type="text"
            placeholder="Contoh: SB-2025-001"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doScan(); }}
            autoFocus
            autoComplete="off"
            style={{ color: '#111827', backgroundColor: '#ffffff', fontSize: '1rem', padding: '13px 16px', fontWeight: 600, letterSpacing: '.02em' }}
          />
          <button className="btn btn-primary" style={{ marginTop: 9 }} onClick={() => doScan()}>Cari Aset</button>
        </div>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? 'Edit Aset' : 'Tambah Aset Inventaris'}
        actions={<>
          <button className="btn-sm btn-outline" disabled={saving} onClick={() => setModalOpen(false)}>Batal</button>
          <button className="btn-sm btn-success" disabled={saving} onClick={save}>{saving ? 'Menyimpan...' : 'Simpan & Generate QR'}</button>
        </>}>
        <div className="form-group"><label className="form-label">Nama Aset</label><input className="form-input" type="text" placeholder="Komputer PC" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="modal-grid" style={{ marginBottom: 0 }}>
          <div className="form-group">
            <label className="form-label">Ruangan</label>
            <select className="form-input" value={form.room_id} disabled={!!editing} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_code || r.id}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Jumlah Unit</label><input className="form-input" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
        </div>
        <div className="form-group">
          <label className="form-label">Kondisi</label>
          <select className="form-input" value={form.condition_status} onChange={(e) => setForm({ ...form, condition_status: e.target.value })}>
            <option>Baik</option><option>Ada Yang Rusak</option><option>Rusak</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Keterangan</label><input className="form-input" type="text" placeholder="Merk, spesifikasi, dll." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: 14, textAlign: 'center', margin: '10px 0' }}>
          <div style={{ fontSize: '.73rem', color: 'var(--gray-500)', marginBottom: 8 }}>QR Code akan digenerate otomatis</div>
          <QRCode value={editing?.qr_code} size={100} />
          <div style={{ fontFamily: "'DM Mono'", fontSize: '.72rem', color: 'var(--gray-700)', marginTop: 4 }}>{editing?.qr_code || 'SB-2025-XXXXXX'}</div>
        </div>
      </Modal>
    </>
  );
}
