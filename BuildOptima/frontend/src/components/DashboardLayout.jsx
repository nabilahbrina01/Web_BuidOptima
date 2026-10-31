import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useData } from '../context/DataContext.jsx';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { alerts, mqttConnected } = useData();
  const unreadCount = alerts?.filter((a) => !a.is_read).length || 0;

  return (
    <div id="screen-dashboard" className="screen active">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} unreadCount={unreadCount} />
      <div className="main">
        <Topbar pathname={pathname} onMenuClick={() => setSidebarOpen((o) => !o)} mqttConnected={mqttConnected} />
        <div className="content">
          <div className="page active">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
