import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

const ProtectedRoute = ({ children, allowRoles }: { children: ReactNode; allowRoles?: UserRole[] }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (allowRoles && user && !allowRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
