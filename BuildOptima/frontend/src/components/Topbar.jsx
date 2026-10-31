import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

const TITLES = {
  '/': 'Dashboard',
  '/rooms': 'Monitoring Ruangan',
  '/schedule': 'Jadwal',
  '/energy': 'Monitoring Energi',
  '/devices': 'Kontrol Perangkat',
  '/inventory': 'Inventaris Aset',
  '/alerts': 'Notifikasi',
  '/reports': 'Laporan & Analitik',
  '/users': 'Manajemen Pengguna',
  '/settings': 'Pengaturan',
};

export default function Topbar({ pathname, onMenuClick, mqttConnected }) {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="topbar">
      <button className="menu-btn" onClick={onMenuClick}><Icon name="menu" size={20} /></button>
      <div className="topbar-title">{TITLES[pathname] || 'BuildOptima'}</div>
      <div className="topbar-right">
        <span
          title={mqttConnected ? 'MQTT broker terhubung' : 'MQTT broker terputus'}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.68rem', fontFamily: "'DM Mono',monospace", color: mqttConnected ? '#10b981' : '#ef4444' }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: mqttConnected ? '#10b981' : '#ef4444', boxShadow: mqttConnected ? '0 0 0 3px rgba(16,185,129,.15)' : '0 0 0 3px rgba(239,68,68,.15)' }} />
          MQTT
        </span>
        <div className="topbar-date">{today}</div>
        <button className="icon-btn" onClick={() => navigate('/alerts')}>
          <Icon name="bell" size={15} />
          <div className="notif-dot" />
        </button>
      </div>
    </div>
  );
}
