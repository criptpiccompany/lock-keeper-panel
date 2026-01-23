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

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  // Default redirect based on role
  const DefaultRedirect = () => {
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to="/meu" replace />;
  };

  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Default redirect */}
      <Route path="/" element={<DefaultRedirect />} />

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
        path="/diretorio"
        element={
          <ProtectedRoute requireAdmin>
            <Navbar />
            <Diretorio />
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

      <Route path="*" element={<NotFound />} />
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
          <div className="min-h-screen bg-background">
            <AppRoutes />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
