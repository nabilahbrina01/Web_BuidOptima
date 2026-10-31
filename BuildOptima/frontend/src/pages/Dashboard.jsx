import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import RoomDetailModal from './rooms/RoomDetailModal.jsx';
import { useData } from '../context/DataContext.jsx';

function formatRupiah(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
function slabel(s) { return s === 'maint' ? 'Perawatan' : s === 'free' ? 'Kosong' : 'Terisi'; }
function mapClass(s) { return s === 'maint' ? 'mr-maint' : s === 'free' ? 'mr-free' : 'mr-used'; }

export default function Dashboard() {
  const { rooms, energySummary, refreshEnergySummary, fetchTimeline } = useData();
  const [detailRoom, setDetailRoom] = useState(null);
  const [dayVals, setDayVals] = useState([0, 0, 0, 0, 0, 0]);
  const navigate = useNavigate();

  useEffect(() => {
    refreshEnergySummary();
    
    fetchTimeline('daily').then((t) => {
      const v = t?.vals || [];
      setDayVals([6, 8, 10, 12, 14, 16].map((h) => Math.round(((v[h] || 0) + (v[h + 1] || 0)) * 100) / 100));
    }).catch(() => {});
  }, []);

  const total = energySummary?.todayKwh ?? 0;
  const biaya = energySummary?.biayaToday ?? 0;
  const efficiency = energySummary?.efficiencyPct ?? 0;
  const tarif = energySummary?.tarif ?? 1877;
  const activeRoom = rooms.find((r) => r.status !== 'free');
  const max = Math.max(...dayVals, 1);
  const colors = ['#93c5fd', '#2563eb', '#1d4ed8', '#3b82f6', '#60a5fa', '#10b981'];

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        <div className="stat-card">
          <div className="stat-hdr"><div className="stat-icon si-blue"><Icon name="room" /></div><span className="badge bg-blue">{rooms.length} total</span></div>
          <div className="stat-val">{rooms.filter((r) => r.status === 'used').length}</div>
          <div className="stat-lbl">Ruangan Aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-hdr"><div className="stat-icon si-amber"><Icon name="energy" /></div><span className="badge bg-amber">Hari ini</span></div>
          <div className="stat-val">{total}</div>
          <div className="stat-lbl">kWh Energi</div>
        </div>
        <div className="stat-card">
          <div className="stat-hdr"><div className="stat-icon si-green"><Icon name="bolt" /></div><span className="badge bg-green">Hari ini</span></div>
          <div className="stat-val" style={{ fontSize: '1.1rem' }}>{formatRupiah(biaya)}</div>
          <div className="stat-lbl">Biaya Listrik ({total} kWh × Rp {Number(tarif).toLocaleString('id-ID', { maximumFractionDigits: 2 })})</div>
        </div>
      </div>

      <div className="qa-grid">
        {[
          ['room', 'Ruangan', '/rooms'], ['schedule', 'Jadwal', '/schedule'], ['energy', 'Energi', '/energy'],
          ['device', 'Perangkat', '/devices'], ['inventory', 'Inventaris', '/inventory'], ['settings', 'Pengaturan', '/settings'],
        ].map(([icon, label, to]) => (
          <button key={to} className="qa-btn" onClick={() => navigate(to)}>
            <Icon name={icon} size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="sec-hdr"><div className="sec-title">Peta Gedung DTK</div><button className="sec-action" onClick={() => navigate('/rooms')}>Semua →</button></div>
          <div style={{ fontSize: '.69rem', color: 'var(--gray-500)', marginBottom: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, background: '#16a34a', borderRadius: '50%', display: 'inline-block' }} />Terisi</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, background: 'var(--gray-300)', borderRadius: '50%', display: 'inline-block' }} />Tidak Terisi</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, background: 'var(--red)', borderRadius: '50%', display: 'inline-block' }} />Perawatan</span>
          </div>
          <div className="map-grid">
            {rooms.slice(0, 8).map((r) => (
              <div key={r.id} className={`map-room ${mapClass(r.status)}`} onClick={() => setDetailRoom(r)}>
                <div className="mr-name">{r.room_code}</div>
                <div className="mr-cap">{slabel(r.status)}</div>
              </div>
            ))}
            {rooms.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: 16, textAlign: 'center', color: 'var(--gray-400)', fontSize: '.8rem' }}>
                Belum ada ruangan. Tambahkan lewat halaman Ruangan.
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="sec-hdr"><div className="sec-title">Energi Hari Ini</div><button className="sec-action" onClick={() => navigate('/energy')}>Detail →</button></div>
          <div className="e-bars">
            {dayVals.map((v, i) => (
              <div key={i} className="e-bar-w">
                <div className="e-bar" style={{ height: Math.round((v / max) * 70), background: colors[i % colors.length] }} />
                <div className="e-kw">{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.67rem', color: 'var(--gray-400)', padding: '0 4px', marginTop: 4 }}>
            <span>06:00</span><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 15, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: '.69rem', color: 'var(--gray-500)' }}>Total</div><div style={{ fontWeight: 700, fontFamily: "'DM Mono'", fontSize: '.93rem', color: 'var(--gray-900)' }}>{total} kWh</div></div>
            <div><div style={{ fontSize: '.69rem', color: 'var(--gray-500)' }}>Efisiensi</div><div style={{ fontWeight: 700, fontFamily: "'DM Mono'", fontSize: '.93rem', color: 'var(--green)' }}>↓ {efficiency}%</div></div>
          </div>
        </div>
      </div>

      <div className="sec-hdr"><div className="sec-title">Ruangan Aktif Sekarang</div></div>
      <div className="room-list">
        {rooms.filter((r) => r.status !== 'free').length === 0 && (
          <div style={{ padding: 16, color: 'var(--gray-400)', fontSize: '.83rem' }}>Tidak ada ruangan aktif saat ini.</div>
        )}
        {activeRoom && (
          <div className="room-item" onClick={() => setDetailRoom(activeRoom)}>
            <div className="status-dot dot-g" />
            <div className="room-info">
              <div className="room-name">{activeRoom.room_code || activeRoom.id} — {activeRoom.name}</div>
              <div className="room-meta">{activeRoom.course || '-'} · {activeRoom.supervisor || '-'} · {activeRoom.start_time || '-'}–{activeRoom.end_time || '-'}</div>
              <div className="room-env"><span className="env-chip">🌡 {activeRoom.temperature ?? '–'}°C</span><span className="env-chip">💧 {activeRoom.humidity ?? '–'}%</span></div>
            </div>
          </div>
        )}
      </div>

      <RoomDetailModal room={detailRoom} onClose={() => setDetailRoom(null)} />
    </>
  );
}
