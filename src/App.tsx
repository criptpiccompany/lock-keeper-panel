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
import { lazy, Suspense } from "react";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MeuPainel = lazy(() => import("./pages/MeuPainel"));
const PainelGeral = lazy(() => import("./pages/PainelGeral"));
const Diretorio = lazy(() => import("./pages/Diretorio"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ImportData = lazy(() => import("./pages/ImportData"));
const RegistroDiario = lazy(() => import("./pages/RegistroDiario"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Home = lazy(() => import("./pages/Home"));
const FinanceiroWorkspace = lazy(() => import("./pages/FinanceiroWorkspace"));
const InfluboardTest = lazy(() => import("./pages/InfluboardTest"));
const PainelWorkspace = lazy(() => import("./pages/PainelWorkspace"));

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
    if (user.status === 'approved' || user.role === 'ADMIN') return <Navigate to="/home" replace />;
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
        
        <Route path="/painel" element={<PainelWorkspace />}>
          <Route index element={<Navigate to="travados" replace />} />
          <Route path="travados" element={<InfluboardTest />} />
          <Route path="meu" element={<PainelGeral />} />
        </Route>
        <Route path="/registro" element={<RegistroDiario />} />
        <Route path="/influboard-test" element={<Navigate to="/painel/travados" replace />} />

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
          path="/import"
          element={
            <ProtectedRoute requireAdmin>
              <ImportData />
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
                <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
