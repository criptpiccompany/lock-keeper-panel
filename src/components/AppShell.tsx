import { ReactNode, useState } from "react";
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
  LayoutGrid, User, Users, Book, FileText, Settings, LogOut, ChevronDown,
  Bell, DollarSign, Home, ShieldAlert, Menu, Eye, Search, Sun, LucideIcon,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin, isSubAdmin, realRole, viewAsRole, setViewAsRole, isImpersonating } = useAuth();
  const canImpersonate = realRole === "ADMIN" || realRole === "SUBADMIN";
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);

  const closerItems: NavItem[] = [
    { path: "/home", label: "Home", icon: Home },
    { path: "/meu", label: "Minha Lista", icon: User },
    { path: "/registro", label: "Planilhamento", icon: FileText },
    { path: "/painel", label: "Painel", icon: LayoutGrid },
    { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
  ];

  const adminItems: NavItem[] = [
    { path: "/home", label: "Home", icon: Home },
    { path: "/financeiro", label: "Financeiro", icon: DollarSign },
    { path: "/diretorio", label: "Diretório", icon: Book },
    { path: "/influenciadores", label: "Influenciadores", icon: Users },
    { path: "/notificacoes", label: "Notificações", icon: Bell },
    { path: "/auditoria", label: "Auditoria", icon: FileText },
    { path: "/admin", label: "Admin", icon: Settings },
    { path: "/meu", label: "Minha Lista", icon: User },
    { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
    { path: "/painel", label: "Painel", icon: LayoutGrid },
  ];

  const subAdminItems: NavItem[] = [
    { path: "/home", label: "Home", icon: Home },
    { path: "/painel", label: "Painel", icon: LayoutGrid },
    { path: "/financeiro", label: "Financeiro", icon: DollarSign },
    { path: "/diretorio", label: "Diretório", icon: Book },
    { path: "/influenciadores", label: "Influenciadores", icon: Users },
    { path: "/auditoria", label: "Auditoria", icon: ShieldAlert },
    { path: "/notificacoes", label: "Notificações", icon: Bell },
    { path: "/admin", label: "Admin", icon: Settings },
    { path: "/meu", label: "Minha Lista", icon: User },
    { path: "/registro", label: "Planilhamento", icon: FileText },
    { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
  ];

  const navItems = isAdmin ? adminItems : isSubAdmin ? subAdminItems : closerItems;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = user?.nome ? user.nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() : "??";

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--page))" }}>
      <div className="min-h-screen px-3.5 pt-3 pb-[18px] max-[920px]:px-4">
        {/* Topbar */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-0.5 pb-6 pt-0.5 max-[920px]:grid-cols-[auto_1fr_auto]">
          <Link to="/home" className="surface-card inline-flex items-center gap-2.5 px-4 py-3 min-w-[122px]">
            <div
              className="grid h-[30px] w-[30px] place-items-center rounded-full text-white"
              style={{ background: "linear-gradient(180deg,hsl(var(--lime-deep)) 0%,hsl(var(--green-deep)) 100%)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 12.5 12 7l6 5.5" /><path d="M8.5 11.8V18h7v-6.2" /><path d="M10.5 18v-3h3v3" />
              </svg>
            </div>
            <div className="text-[15px] font-medium tracking-tight">INFLUBOARD</div>
          </Link>

          <div />

          <div className="flex items-center gap-3 min-w-0">
            {!isMobile && (
              <div className="surface-card inline-flex items-center gap-2 p-2">
                <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-soft" aria-label="Pesquisar">
                  <Search className="h-4 w-4 text-soft" />
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-soft" aria-label="Notificações">
                  <Bell className="h-4 w-4 text-soft" />
                </button>
              </div>
            )}

            {canImpersonate && !isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isImpersonating ? "default" : "outline"}
                    size="sm"
                    className={cn("gap-1.5 h-9 rounded-full px-3", isImpersonating && "bg-amber-500 hover:bg-amber-600 text-white border-amber-500")}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{isImpersonating ? `Vendo como ${viewAsRole}` : "Ver como"}</span>
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setViewAsRole(null)} className={cn(!viewAsRole && "bg-accent")}>
                    <ShieldAlert className="mr-2 h-4 w-4" />{realRole} <span className="ml-1 text-xs text-muted-foreground">(meu papel)</span>
                  </DropdownMenuItem>
                  {(realRole === "ADMIN" || realRole === "SUBADMIN") && (
                    <DropdownMenuItem onClick={() => setViewAsRole("CLOSER")} className={cn(viewAsRole === "CLOSER" && "bg-accent")}>
                      <User className="mr-2 h-4 w-4" />CLOSER
                    </DropdownMenuItem>
                  )}
                  {realRole === "ADMIN" && (
                    <DropdownMenuItem onClick={() => setViewAsRole("SUBADMIN")} className={cn(viewAsRole === "SUBADMIN" && "bg-accent")}>
                      <Settings className="mr-2 h-4 w-4" />SUBADMIN
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {user && !isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="surface-card flex max-w-[220px] items-center gap-2.5 px-3.5 py-2.5 hover:bg-card-soft transition-colors">
                    <div
                      className="grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white"
                      style={{ background: "linear-gradient(180deg,#f2d7c4 0%,#b47f59 100%)" }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 leading-tight text-left">
                      <div className="text-sm font-medium tracking-tight truncate">{user.nome}</div>
                      <div className="text-[11px] text-muted truncate">{user.email}</div>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <Badge variant="outline" className="text-xs">{user.role}</Badge>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isMobile && user && (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 surface-card">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] p-0">
                  <div className="px-4 py-4 border-b">
                    <p className="text-sm font-medium">{user.nome}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <Badge variant="outline" className="text-[10px] mt-2">{user.role}</Badge>
                  </div>
                  <div className="flex flex-col gap-1 p-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setMobileOpen(false); }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left",
                            active ? "nav-pill-active" : "text-soft hover:bg-card-soft"
                          )}
                        >
                          <Icon className="h-4 w-4" />{item.label}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => { handleSignOut(); setMobileOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />Sair
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>

        {/* Main grid: side rail + content */}
        <div className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-6 max-[1460px]:gap-4 max-[920px]:grid-cols-1 max-[920px]:gap-4">
          {/* Side rail (desktop) */}
          {!isMobile && (
            <aside
              className="relative flex flex-col gap-[18px] pt-1"
              onMouseEnter={() => setRailExpanded(true)}
              onMouseLeave={() => setRailExpanded(false)}
            >
              <div className="relative flex flex-col items-center gap-2.5 rounded-[28px] bg-card px-2 py-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={item.label}
                      aria-label={item.label}
                      className="relative grid h-11 w-11 place-items-center"
                    >
                      <span
                        className={cn(
                          "grid h-11 w-11 place-items-center rounded-full transition-colors",
                          active ? "nav-pill-active" : "text-soft hover:bg-card-soft"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span
                        className={cn(
                          "pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium tracking-tight transition-opacity duration-150 z-10 px-2 py-1 rounded-md bg-card shadow-sm",
                          railExpanded ? "opacity-100" : "opacity-0",
                          active ? "text-foreground" : "text-soft"
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="flex-1 min-h-[24px]" />

              <div className="flex flex-col items-center gap-2.5 rounded-full bg-card px-2 py-3">
                <button
                  onClick={handleSignOut}
                  title="Sair"
                  className="grid h-11 w-11 place-items-center rounded-full text-soft hover:bg-card-soft"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </aside>
          )}

          <main className="min-w-0 pt-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
