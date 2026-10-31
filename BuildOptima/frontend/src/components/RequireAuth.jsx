import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { DataProvider } from '../context/DataContext.jsx';

export default function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <DataProvider>{children}</DataProvider>;
}
