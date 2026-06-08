import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireFinanceiro?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, requireFinanceiro = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const elevated = user.role === 'ADMIN' || user.role === 'SUBADMIN' || user.role === 'FINANCEIRO';

  if (user.status !== 'approved' && !elevated) {
    return <Navigate to="/aguardando-aprovacao" replace />;
  }

  if (requireAdmin && user.role !== 'ADMIN' && user.role !== 'SUBADMIN') {
    if (user.role === 'FINANCEIRO') return <Navigate to="/financeiro/comprovantes" replace />;
    return <Navigate to="/meu" replace />;
  }

  if (requireFinanceiro && user.role !== 'ADMIN' && user.role !== 'FINANCEIRO') {
    return <Navigate to="/meu" replace />;
  }

  return <>{children}</>;
}
