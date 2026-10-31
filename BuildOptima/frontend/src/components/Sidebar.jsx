import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_MAIN = [{ to: '/', icon: 'home', label: 'Dashboard' }];
const NAV_MONITOR = [
  { to: '/rooms', icon: 'room', label: 'Ruangan' },
  { to: '/schedule', icon: 'schedule', label: 'Jadwal' },
  { to: '/energy', icon: 'energy', label: 'Energi' },
];
const NAV_MANAGE = [
  { to: '/devices', icon: 'device', label: 'Perangkat' },
  { to: '/inventory', icon: 'inventory', label: 'Inventaris' },
  { to: '/alerts', icon: 'bell', label: 'Notifikasi', badge: true },
  { to: '/reports', icon: 'report', label: 'Laporan' },
];

export default function Sidebar({ open, onClose, unreadCount }) {
  const { user, isAdmin, logout } = useAuth();

  function Item({ to, icon, label, badge }) {
    return (
      <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
        <Icon name={icon} size={15} />
        {label}
        {badge && unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
      </NavLink>
    );
  }

  return (
    <>
      <div className={`sidebar-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <nav className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-row">
            <div className="sidebar-logo-icon"><Icon name="building" size={16} fill="white" stroke="none" /></div>
            <div className="sidebar-logo-text"><h2>BuildOptima</h2><p>Teknik Komputer UNDIP</p></div>
          </div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-sec">Utama</div>
          {NAV_MAIN.map((n) => <Item key={n.to} {...n} />)}
          <div className="nav-sec">Monitoring</div>
          {NAV_MONITOR.map((n) => <Item key={n.to} {...n} />)}
          <div className="nav-sec">Manajemen</div>
          {NAV_MANAGE.map((n) => <Item key={n.to} {...n} />)}
          {isAdmin && (
            <>
              <div className="nav-sec">Admin</div>
              <Item to="/users" icon="users" label="Manajemen User" />
            </>
          )}
          <div className="nav-sec">Akun</div>
          <Item to="/settings" icon="settings" label="Pengaturan" />
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" style={{ overflow: 'hidden' }}>
              {user?.photo ? <img src={user.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : (user?.initials || '??')}
            </div>
            <div className="sidebar-user-info">
              <h4>{user?.name} <span className={`role-badge ${isAdmin ? 'rb-admin' : 'rb-staff'}`}>{isAdmin ? 'Admin' : 'Staff'}</span></h4>
              <p>{user?.email}</p>
            </div>
            <button className="sidebar-logout" onClick={() => { if (confirm('Keluar dari sistem?')) logout(); }}>
              <Icon name="logout" size={14} />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
