import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  ShieldAlert,
  Menu,
  Eye,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin, isSubAdmin, realRole, viewAsRole, setViewAsRole, isImpersonating } = useAuth();
  const canImpersonate = realRole === 'ADMIN' || realRole === 'SUBADMIN';
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

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

  const subAdminMainItems = [
    { path: "/home", label: "Home", icon: Home },
    { path: "/painel", label: "Painel de Consulta", icon: LayoutGrid },
    { path: "/financeiro", label: "Financeiro", icon: DollarSign },
    { path: "/diretorio", label: "Diretório", icon: Book },
    { path: "/auditoria", label: "Auditoria", icon: ShieldAlert },
    { path: "/notificacoes", label: "Notificações", icon: Bell },
    { path: "/admin", label: "Admin", icon: Settings },
  ];

  const subAdminDropdownItems = [
    { path: "/meu", label: "Minha Lista", icon: User },
    { path: "/registro", label: "Planilhamento", icon: FileText },
    { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
  ];

  const adminOperationItems = [
    { path: "/meu", label: "Minha Lista", icon: User },
    { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
    { path: "/painel", label: "Painel de Consulta", icon: LayoutGrid },
  ];

  const navItems = isAdmin ? adminItems : isSubAdmin ? subAdminMainItems : closerItems;

  // All navigable items for mobile menu
  const allMobileItems = isAdmin
    ? [...adminItems, ...adminOperationItems]
    : isSubAdmin
    ? [...subAdminMainItems, ...subAdminDropdownItems]
    : closerItems;

  // Deduplicate by path
  const mobileItems = allMobileItems.filter(
    (item, idx, arr) => arr.findIndex((i) => i.path === item.path) === idx
  );

  const MobileNav = () => (
    <div className="flex flex-col gap-1 py-4">
      {mobileItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
      <div className="border-t my-2" />
      <button
        onClick={() => { handleSignOut(); setMobileOpen(false); }}
        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full text-left"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </div>
  );

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">IB</span>
          </div>
          <span className="font-semibold text-base tracking-tight hidden sm:inline">InfluBoard</span>
        </Link>

        {/* Desktop Navigation */}
        {!isMobile && (
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isDropdownActive = isSubAdmin && item.path === "/home" && subAdminDropdownItems.some(d => d.path === location.pathname);
              return (
                <div key={item.path} className="flex items-center">
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      isActive || isDropdownActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                  {isSubAdmin && item.path === "/home" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 w-7 p-0 ml-0.5 rounded-md",
                            isDropdownActive
                              ? "text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        {subAdminDropdownItems.map((dropItem) => {
                          const DropIcon = dropItem.icon;
                          const isDropActive = location.pathname === dropItem.path;
                          return (
                            <DropdownMenuItem
                              key={dropItem.path}
                              onClick={() => navigate(dropItem.path)}
                              className={cn(isDropActive && "bg-accent")}
                            >
                              <DropIcon className="mr-2 h-4 w-4" />
                              {dropItem.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* User badge (desktop) */}
          {user && !isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="hidden lg:inline text-sm font-medium">{user.nome}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs ml-1",
                      isAdmin ? "border-amber-300 text-amber-700 bg-amber-50" : isSubAdmin ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"
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

          {/* Mobile: role badge + hamburger */}
          {isMobile && user && (
            <>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  isAdmin ? "border-amber-300 text-amber-700 bg-amber-50" : isSubAdmin ? "border-blue-300 text-blue-700 bg-blue-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"
                )}
              >
                {user.role}
              </Badge>
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] p-0">
                  <div className="px-4 py-4 border-b">
                    <p className="text-sm font-medium">{user.nome}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <MobileNav />
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
