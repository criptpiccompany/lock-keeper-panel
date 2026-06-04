import { type ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  FileText,
  Gauge,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  User,
  Users,
  Wallet,
} from "lucide-react";

import { BrandMark } from "@/components/design/BrandMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

type NavItem = {
  path: string;
  label: string;
  icon: typeof Home;
};

const closerNav: NavItem[] = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/meu", label: "Minha Lista", icon: User },
  { path: "/registro", label: "Planilhamento", icon: FileText },
  { path: "/painel", label: "Painel de Consulta", icon: LayoutGrid },
  { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
];

const subAdminNav: NavItem[] = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/dashboard", label: "Dashboard", icon: Gauge },
  { path: "/financeiro", label: "Financeiro", icon: Wallet },
  { path: "/diretorio", label: "Diretório", icon: BookOpen },
  { path: "/influenciadores", label: "Influenciadores", icon: Users },
  { path: "/notificacoes", label: "Notificações", icon: Bell },
  { path: "/auditoria", label: "Auditoria", icon: ShieldEllipsis },
  { path: "/admin", label: "Admin", icon: Settings },
  { path: "/meu", label: "Minha Lista", icon: User },
  { path: "/registro", label: "Planilhamento", icon: FileText },
  { path: "/painel", label: "Painel de Consulta", icon: LayoutGrid },
  { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
];

const adminNav: NavItem[] = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/dashboard", label: "Dashboard", icon: Gauge },
  { path: "/financeiro", label: "Financeiro", icon: Wallet },
  { path: "/diretorio", label: "Diretório", icon: BookOpen },
  { path: "/influenciadores", label: "Influenciadores", icon: Users },
  { path: "/notificacoes", label: "Notificações", icon: Bell },
  { path: "/auditoria", label: "Auditoria", icon: ShieldEllipsis },
  { path: "/admin", label: "Admin", icon: Settings },
  { path: "/meu", label: "Minha Lista", icon: User },
  { path: "/registro", label: "Planilhamento", icon: FileText },
  { path: "/painel", label: "Painel de Consulta", icon: LayoutGrid },
  { path: "/gestao-influenciadores", label: "Gestão de Influs", icon: Users },
];

function UserRoleBadge({ role }: { role: "ADMIN" | "SUBADMIN" | "CLOSER" }) {
  const roleClass =
    role === "ADMIN"
      ? "tone-danger"
      : role === "SUBADMIN"
        ? "border-primary/20 bg-primary/10 text-primary"
        : "tone-success";

  return <Badge className={cn("border text-[0.65rem] uppercase tracking-[0.18em]", roleClass)}>{role}</Badge>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    user,
    signOut,
    isAdmin,
    isSubAdmin,
    realRole,
    viewAsRole,
    setViewAsRole,
    isImpersonating,
  } = useAuth();

  if (!user) return null;

  const navItems = isAdmin ? adminNav : isSubAdmin ? subAdminNav : closerNav;
  const uniqueNavItems = navItems.filter(
    (item, index, items) => items.findIndex((candidate) => candidate.path === item.path) === index,
  );
  const topItems = uniqueNavItems.slice(0, isMobile ? uniqueNavItems.length : 5);
  const canImpersonate = realRole === "ADMIN" || realRole === "SUBADMIN";
  const initials = user.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="topbar-shell">
        <div className="container-premium flex min-h-[5.25rem] items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/home" aria-label="Influboard">
              <BrandMark compact={isMobile} />
            </Link>

            {!isMobile ? (
              <nav className="hidden items-center gap-1 lg:flex">
                {topItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn("subnav-link", active && "subnav-link-active")}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {!isMobile ? (
              <>
                <button className="icon-badge" type="button" aria-label="Pesquisar">
                  <Search className="h-4 w-4" />
                </button>
                <button className="icon-badge" type="button" aria-label="Notificações">
                  <Bell className="h-4 w-4" />
                </button>
              </>
            ) : null}

            {canImpersonate ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-full">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {isImpersonating ? `Ver como ${viewAsRole}` : "Ver como"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setViewAsRole(null)}>
                    {realRole} (papel atual)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setViewAsRole("CLOSER")}>
                    CLOSER
                  </DropdownMenuItem>
                  {realRole === "ADMIN" ? (
                    <DropdownMenuItem onClick={() => setViewAsRole("SUBADMIN")}>
                      SUBADMIN
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {!isMobile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="brand-chip" type="button">
                    <div className="brand-mark h-10 w-10 text-xs">{initials || "IB"}</div>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-semibold text-foreground">{user.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <UserRoleBadge role={user.role} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">{user.nome}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[22rem] border-border/70 bg-card p-0">
                  <div className="space-y-6 p-5">
                    <BrandMark />
                    <div className="surface-soft p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{user.nome}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <UserRoleBadge role={user.role} />
                      </div>
                    </div>

                    <nav className="space-y-2">
                      {uniqueNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path;
                        return (
                          <button
                            key={item.path}
                            type="button"
                            onClick={() => handleNavigate(item.path)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium",
                              active ? "bg-primary text-primary-foreground" : "bg-muted/55 text-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </nav>

                    <Button variant="outline" className="w-full rounded-full" onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </header>

      <div className="container-premium grid gap-6 py-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-8">
        {!isMobile ? (
          <aside className="space-y-4">
            <div className="rail-shell sticky top-28">
              <div className="space-y-2">
                {uniqueNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn("rail-link", active && "rail-link-active")}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 space-y-3 border-t border-sidebar-border pt-5">
                <div className="rounded-3xl bg-sidebar-accent p-4">
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-sidebar-foreground opacity-60">
                    Visualização
                  </p>
                  <p className="mt-2 text-base font-semibold text-sidebar-foreground">
                    {isImpersonating ? `Modo ${viewAsRole}` : "Ambiente principal"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-sidebar-foreground opacity-70">
                    Menus e camadas visuais reagem ao papel ativo sem tocar na regra de acesso.
                  </p>
                </div>

                <Button variant="secondary" className="w-full rounded-full" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>
          </aside>
        ) : null}

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
