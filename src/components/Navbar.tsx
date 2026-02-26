import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutGrid,
  User,
  Users,
  Book,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Bell,
  DollarSign,
  Home,
} from "lucide-react";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Navigation items based on role
  const closerItems = [
    { path: "/home", label: "Home", icon: Home },
    { path: "/meu", label: "Minha Lista", icon: User },
    { path: "/registro", label: "Planilhamento", icon: FileText },
    { path: "/painel", label: "Painel de Consulta", icon: LayoutGrid },
    { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
  ];

  const adminItems = [
    { path: "/financeiro", label: "Financeiro", icon: DollarSign },
    { path: "/diretorio", label: "Diretório", icon: Book },
    { path: "/notificacoes", label: "Notificações", icon: Bell },
    { path: "/auditoria", label: "Auditoria", icon: FileText },
    { path: "/admin", label: "Admin", icon: Settings },
  ];

  // Admin operational items shown in profile dropdown
  const adminOperationItems = [
    { path: "/meu", label: "Minha Lista", icon: User },
    { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
    { path: "/painel", label: "Painel de Consulta", icon: LayoutGrid },
  ];

  const navItems = isAdmin ? adminItems : closerItems;

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">IB</span>
          </div>
          <span className="font-semibold text-base tracking-tight">InfluBoard</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* User Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="hidden sm:inline text-sm font-medium">{user.nome}</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs ml-1",
                    isAdmin ? "border-amber-300 text-amber-700 bg-amber-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"
                  )}
                >
                  {user.role}
                </Badge>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.nome}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operação</p>
                  </div>
                  {adminOperationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)}>
                        <Icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
