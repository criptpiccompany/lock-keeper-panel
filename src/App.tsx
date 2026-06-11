import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MeuPainel from "./pages/MeuPainel";
import PainelGeral from "./pages/PainelGeral";
import Diretorio from "./pages/Diretorio";
import Auditoria from "./pages/Auditoria";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import ImportData from "./pages/ImportData";
import RegistroDiario from "./pages/RegistroDiario";
import Notificacoes from "./pages/Notificacoes";

import PendingApproval from "./pages/PendingApproval";
import Financeiro from "./pages/Financeiro";
import Home from "./pages/Home";
import FinanceiroWorkspace from "./pages/FinanceiroWorkspace";
import InfluboardTest from "./pages/InfluboardTest";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  // Default redirect based on role
  const DefaultRedirect = () => {
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (user.role === 'FINANCEIRO') return <Navigate to="/financeiro/comprovantes" replace />;
    return <Navigate to="/home" replace />;
  };

  const PendingApprovalRoute = () => {
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (user.status === 'approved' || user.role === 'ADMIN' || user.role === 'SUBADMIN') return <Navigate to="/home" replace />;
    return <PendingApproval />;
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/aguardando-aprovacao" element={<PendingApprovalRoute />} />

      {/* Default redirect */}
      <Route path="/" element={<DefaultRedirect />} />

      <Route
        element={
          <ProtectedRoute>
            <WorkspaceLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/meu" element={<MeuPainel />} />
        
        <Route path="/painel" element={<PainelGeral />} />
        <Route path="/registro" element={<RegistroDiario />} />
        <Route path="/influboard-test" element={<InfluboardTest />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requireAdmin>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/financeiro"
          element={
            <ProtectedRoute requireAdmin>
              <Financeiro />
            </ProtectedRoute>
          }
        />
        <Route
          path="/diretorio"
          element={
            <ProtectedRoute requireAdmin>
              <Diretorio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notificacoes"
          element={
            <ProtectedRoute requireAdmin>
              <Notificacoes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/auditoria"
          element={
            <ProtectedRoute requireAdmin>
              <Auditoria />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/financeiro/comprovantes"
          element={
            <ProtectedRoute requireFinanceiro>
              <FinanceiroWorkspace initialTab="comprovantes" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/financeiro/espelhamento"
          element={
            <ProtectedRoute requireFinanceiro>
              <FinanceiroWorkspace initialTab="espelhamento" />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
      
      {/* Temporary import route */}
      <Route path="/import" element={<ImportData />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <AuthProvider>
            <ConnectionStatus />
            <div className="min-h-screen bg-background overflow-x-hidden">
              <ErrorBoundary fallbackTitle="Erro na página">
                <AppRoutes />
              </ErrorBoundary>
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
