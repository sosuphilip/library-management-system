import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingBlock } from '../components/ui';

export default function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingBlock />;
  return <Navigate to={user && user.role === 'MEMBER' ? '/my' : '/catalog'} replace />;
}
