import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navbar } from "@/components/Navbar";
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

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  // Default redirect based on role
  const DefaultRedirect = () => {
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
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

      {/* Home - first screen after login */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Navbar />
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Protected routes for all authenticated users */}
      <Route
        path="/meu"
        element={
          <ProtectedRoute>
            <Navbar />
            <MeuPainel />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/gestao-influenciadores"
        element={
          <ProtectedRoute>
            <Navbar />
            <GestaoInfluenciadores />
          </ProtectedRoute>
        }
      />

      {/* Painel Geral - for closers (limited view) */}
      <Route
        path="/painel"
        element={
          <ProtectedRoute>
            <Navbar />
            <PainelGeral />
          </ProtectedRoute>
        }
      />

      {/* Admin only routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requireAdmin>
            <Navbar />
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <ProtectedRoute requireAdmin>
            <Navbar />
            <Financeiro />
          </ProtectedRoute>
        }
      />
      <Route
        path="/diretorio"
        element={
          <ProtectedRoute requireAdmin>
            <Navbar />
            <Diretorio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notificacoes"
        element={
          <ProtectedRoute requireAdmin>
            <Navbar />
            <Notificacoes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditoria"
        element={
          <ProtectedRoute requireAdmin>
            <Navbar />
            <Auditoria />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <Navbar />
            <Admin />
          </ProtectedRoute>
        }
      />

      {/* Registro Diário - all authenticated users */}
      <Route
        path="/registro"
        element={
          <ProtectedRoute>
            <Navbar />
            <RegistroDiario />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
      
      {/* Temporary import route */}
      <Route path="/import" element={<ImportData />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-background overflow-x-hidden">
            <AppRoutes />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
