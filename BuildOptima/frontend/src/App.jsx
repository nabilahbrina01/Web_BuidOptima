import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';

import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import Verify from './pages/auth/Verify.jsx';
import Forgot from './pages/auth/Forgot.jsx';
import Reset from './pages/auth/Reset.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Rooms from './pages/rooms/Rooms.jsx';
import Schedule from './pages/Schedule.jsx';
import Energy from './pages/Energy.jsx';
import Devices from './pages/Devices.jsx';
import Inventory from './pages/Inventory.jsx';
import Alerts from './pages/Alerts.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';

function GuestOnly({ children }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/verify" element={<GuestOnly><Verify /></GuestOnly>} />
      <Route path="/forgot" element={<GuestOnly><Forgot /></GuestOnly>} />
      <Route path="/reset" element={<GuestOnly><Reset /></GuestOnly>} />

      <Route element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/energy" element={<Energy />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<AdminOnly><Users /></AdminOnly>} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
