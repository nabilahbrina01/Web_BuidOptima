import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { useData } from '../context/DataContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const TYPE_ICON = { info: 'info', warn: 'warn', danger: 'danger', success: 'check' };
const TYPE_LABEL = { info: 'Info', warn: 'Peringatan', danger: 'Kritis', success: 'Sukses' };
const TYPE_TAG_CLS = { info: 'tag-info', warn: 'tag-warn', danger: 'tag-danger', success: 'tag-success' };

export default function Alerts() {
  const { alerts, markAlertRead, markAllAlertsRead } = useData();
  const showToast = useToast();
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const counts = { all: alerts.length, danger: 0, warn: 0, info: 0, success: 0 };
  alerts.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });

  const visible = alerts.filter((a) => filter === 'all' || a.type === filter);

  function openDetail(a) {
    setDetail(a);
    if (!a.is_read) markAlertRead(a.id);
  }

  async function markAll() {
    await markAllAlertsRead();
    showToast('Semua notifikasi telah ditandai dibaca.', 'info');
  }

  return (
    <>
      <div className="notif-topbar">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--gray-900)' }}>Notifikasi &amp; Peringatan</div>
          <div style={{ fontSize: '.72rem', color: 'var(--gray-400)', marginTop: 2 }}>Klik notifikasi untuk melihat detail</div>
        </div>
        <button className="notif-markall" onClick={markAll}><Icon name="checkSimple" size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />Tandai Semua Dibaca</button>
      </div>

      <div className="notif-summary-chips">
        <button className={`notif-chip nc-all${filter === 'all' ? ' chip-active' : ''}`} onClick={() => setFilter('all')}><Icon name="info" size={13} />Semua <span className="notif-chip-count">{counts.all}</span></button>
        <button className={`notif-chip nc-danger${filter === 'danger' ? ' chip-active' : ''}`} onClick={() => setFilter('danger')}><Icon name="danger" size={13} stroke="#ef4444" />Kritis <span className="notif-chip-count" style={{ background: '#ef4444', color: 'white' }}>{counts.danger}</span></button>
        <button className={`notif-chip nc-warn${filter === 'warn' ? ' chip-active' : ''}`} onClick={() => setFilter('warn')}><Icon name="warn" size={13} stroke="#f59e0b" />Peringatan <span className="notif-chip-count" style={{ background: '#f59e0b', color: 'white' }}>{counts.warn}</span></button>
        <button className={`notif-chip nc-info${filter === 'info' ? ' chip-active' : ''}`} onClick={() => setFilter('info')}><Icon name="info" size={13} stroke="#3b82f6" />Info <span className="notif-chip-count" style={{ background: '#3b82f6', color: 'white' }}>{counts.info}</span></button>
        <button className={`notif-chip nc-success${filter === 'success' ? ' chip-active' : ''}`} onClick={() => setFilter('success')}><Icon name="checkSimple" size={13} stroke="#10b981" />Sukses <span className="notif-chip-count" style={{ background: '#10b981', color: 'white' }}>{counts.success}</span></button>
      </div>

      <div>
        {visible.map((a) => (
          <div key={a.id} className={`notif-card nt-${a.type} ${a.is_read ? 'read' : 'unread'}`} onClick={() => openDetail(a)}>
            <div className="notif-icon-wrap"><Icon name={TYPE_ICON[a.type]} size={18} stroke={{ info: '#3b82f6', warn: '#f59e0b', danger: '#ef4444', success: '#10b981' }[a.type]} /></div>
            <div className="notif-card-body">
              <div className="notif-card-title">
                <span className="notif-title-text">{a.title}</span>
                <span className="notif-time-chip">{new Date(a.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
              </div>
              <div className="notif-card-sub">{a.summary}</div>
              <div className="notif-tags"><span className={`notif-tag ${TYPE_TAG_CLS[a.type]}`}>{TYPE_LABEL[a.type]}</span></div>
            </div>
            <div className="notif-unread-dot" style={a.is_read ? { background: 'var(--gray-300)' } : undefined} />
          </div>
        ))}
        {visible.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)' }}>Tidak ada notifikasi.</div>}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title} maxWidth={420}
        actions={<button className="btn-sm btn-outline" onClick={() => setDetail(null)}>Tutup</button>}>
        {detail && (
          <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: '.74rem', color: 'var(--gray-500)', marginBottom: 8, fontFamily: "'DM Mono'" }}>
              📅 Pukul {new Date(detail.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--gray-700)', lineHeight: 1.7 }}>{detail.detail}</div>
          </div>
        )}
      </Modal>
    </>
  );
}
