import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { AppShell } from "@/components/AppShell";
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
import GestaoInfluenciadores from "./pages/GestaoInfluenciadores";
import PendingApproval from "./pages/PendingApproval";
import Financeiro from "./pages/Financeiro";
import Home from "./pages/Home";
import Influenciadores from "./pages/Influenciadores";

const queryClient = new QueryClient();

const Shelled = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);

const ShelledAdmin = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireAdmin>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);

function AppRoutes() {
  const { user, loading } = useAuth();

  const DefaultRedirect = () => {
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to="/home" replace />;
  };

  const PendingApprovalRoute = () => {
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (user.status === "approved" || user.role === "ADMIN" || user.role === "SUBADMIN") return <Navigate to="/home" replace />;
    return <PendingApproval />;
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/aguardando-aprovacao" element={<PendingApprovalRoute />} />
      <Route path="/" element={<DefaultRedirect />} />

      <Route path="/home" element={<Shelled><Home /></Shelled>} />
      <Route path="/meu" element={<Shelled><MeuPainel /></Shelled>} />
      <Route path="/gestao-influenciadores" element={<Shelled><GestaoInfluenciadores /></Shelled>} />
      <Route path="/painel" element={<Shelled><PainelGeral /></Shelled>} />
      <Route path="/registro" element={<Shelled><RegistroDiario /></Shelled>} />

      <Route path="/dashboard" element={<ShelledAdmin><Dashboard /></ShelledAdmin>} />
      <Route path="/financeiro" element={<ShelledAdmin><Financeiro /></ShelledAdmin>} />
      <Route path="/diretorio" element={<ShelledAdmin><Diretorio /></ShelledAdmin>} />
      <Route path="/influenciadores" element={<ShelledAdmin><Influenciadores /></ShelledAdmin>} />
      <Route path="/notificacoes" element={<ShelledAdmin><Notificacoes /></ShelledAdmin>} />
      <Route path="/auditoria" element={<ShelledAdmin><Auditoria /></ShelledAdmin>} />
      <Route path="/admin" element={<ShelledAdmin><Admin /></ShelledAdmin>} />

      <Route path="/import" element={<ImportData />} />
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
