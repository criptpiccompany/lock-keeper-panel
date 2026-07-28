import { type ComponentType, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  EyeOff,
  FileText,
  Home as HomeIcon,
  LayoutGrid,
  Lock,
  LogOut,
  Menu,
  MoreHorizontal,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";

import { CloserSharedBoard } from "@/components/home/CloserSharedBoard";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutStore } from "@/store/useLayoutStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavTone = "closer" | "admin" | "financeiro";

type NavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: NavTone;
};

type NavGroup = {
  id: "meu-espaco" | "time" | "controle";
  label: string;
  items: NavItem[];
};

const toneClasses: Record<NavTone, { icon: string; dot: string }> = {
  closer: { icon: "text-emerald-600", dot: "bg-emerald-500" },
  admin: { icon: "text-amber-600", dot: "bg-amber-500" },
  financeiro: { icon: "text-violet-600", dot: "bg-violet-500" },
};

const QUICK_NAV_STORAGE_KEY = "criptpicQuickNavHidden";

function FloatingQuickNav({
  locationPath,
  onNavigate,
}: {
  locationPath: string;
  onNavigate: (path: string) => void;
}) {
  const [boardOpen, setBoardOpen] = useState(false);
  const [hidden, setHidden] = useState(
    () => window.localStorage.getItem(QUICK_NAV_STORAGE_KEY) === "true"
  );

  const setNavigationHidden = (value: boolean) => {
    setHidden(value);
    window.localStorage.setItem(QUICK_NAV_STORAGE_KEY, String(value));
  };

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setNavigationHidden(false)}
        className="fixed bottom-4 right-4 z-40 flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-medium text-muted-foreground shadow-lg transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Mostrar navegação rápida"
      >
        <ChevronLeft className="h-4 w-4" />
        Mostrar atalhos
      </button>
    );
  }

  const planilhamentoActive = locationPath === "/registro";

  return (
    <>
      <nav
        className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-[24px] border border-border bg-card p-1.5 shadow-xl"
        aria-label="Navegação rápida"
      >
        <button
          type="button"
          onClick={() => onNavigate("/registro")}
          className={cn(
            "flex min-w-[112px] items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            planilhamentoActive
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={planilhamentoActive ? "page" : undefined}
        >
          <FileText className="h-4 w-4" />
          Planilhamento
        </button>

        <button
          type="button"
          onClick={() => setBoardOpen(true)}
          className="flex min-w-[112px] items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-haspopup="dialog"
        >
          <Users className="h-4 w-4" />
          Board
        </button>

        <button
          type="button"
          onClick={() => setNavigationHidden(true)}
          className="flex h-10 w-10 items-center justify-center rounded-[16px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ocultar navegação rápida"
          title="Ocultar navegação rápida"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </nav>

      <Sheet open={boardOpen} onOpenChange={setBoardOpen}>
        <SheetContent
          side="bottom"
          className="h-[88vh] overflow-hidden rounded-t-[30px] border-border bg-background p-3 sm:p-4 [&>button.absolute]:right-6 [&>button.absolute]:top-6 [&>button.absolute]:z-20"
          onEscapeKeyDown={() => setBoardOpen(false)}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Board Compartilhado</SheetTitle>
            <SheetDescription>
              Board atualizado em tempo real com os influenciadores do time.
            </SheetDescription>
          </SheetHeader>
          <div className="h-full min-h-0 pt-1">
            <CloserSharedBoard />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

type AdminSidebarContentProps = {
  collapsed: boolean;
  groups: NavGroup[];
  locationPath: string;
  userName: string;
  userEmail: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  onToggle?: () => void;
  mobile?: boolean;
};

function AdminSidebarContent({
  collapsed,
  groups,
  locationPath,
  userName,
  userEmail,
  onNavigate,
  onSignOut,
  onToggle,
  mobile = false,
}: AdminSidebarContentProps) {
  const firstName = userName.split(/\s+/)[0];
  const showLabels = mobile || !collapsed;
  const [expandedGroups, setExpandedGroups] = useState<Record<NavGroup["id"], boolean>>({
    "meu-espaco": true,
    time: true,
    controle: true,
  });

  const toggleGroup = (groupId: NavGroup["id"]) => {
    setExpandedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--admin-sidebar))] text-primary-foreground">
      <div className={cn("flex h-20 items-center border-b border-primary-foreground/10 px-4", showLabels ? "justify-between" : "justify-center")}>
        <button
          type="button"
          onClick={() => onNavigate("/home")}
          className={cn(
            "flex items-center rounded-xl transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60",
            showLabels ? "gap-3 px-2 py-2" : "p-2"
          )}
          aria-label="Ir para Home"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground text-primary">
            <HomeIcon className="h-4 w-4" />
          </span>
          {showLabels && (
            <span className="text-sm font-semibold tracking-tight">CriptPic Board</span>
          )}
        </button>

        {!mobile && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground/60 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Navegação administrativa">
        {groups.map((group) => {
          const expanded = expandedGroups[group.id];

          return (
            <div key={group.id}>
              {showLabels && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/45 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
                  aria-expanded={expanded}
                  aria-controls={`admin-nav-group-${group.id}`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      !expanded && "-rotate-90"
                    )}
                  />
                </button>
              )}

              <div
                id={`admin-nav-group-${group.id}`}
                className={cn("space-y-1", showLabels && !expanded && "hidden")}
              >
                {group.items.map((item) => {
                  const exactOnly = item.path === "/home" || item.path === "/financeiro";
                  const active = exactOnly
                    ? locationPath === item.path
                    : locationPath === item.path || locationPath.startsWith(`${item.path}/`);
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => onNavigate(item.path)}
                      className={cn(
                        "flex w-full items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60",
                        showLabels ? "gap-3 px-3 py-2.5" : "justify-center p-2.5",
                        active
                          ? "bg-primary-foreground text-primary"
                          : "text-primary-foreground/65 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                      title={!showLabels ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {showLabels && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-primary-foreground/10 p-3">
        <div className={cn("flex items-center", showLabels ? "gap-3 px-2 py-2" : "justify-center py-2")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-xs font-semibold text-primary-foreground">
            {firstName.charAt(0).toUpperCase()}
          </div>
          {showLabels && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{userName}</div>
              <div className="truncate text-xs text-primary-foreground/50">{userEmail}</div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className={cn(
            "mt-1 flex w-full items-center rounded-xl text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60",
            showLabels ? "gap-3 px-3 py-2.5" : "justify-center p-2.5"
          )}
          title={!showLabels ? "Sair" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {showLabels && <span>Sair</span>}
        </button>
      </div>
    </div>
  );
}

export function WorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isFinanceiro, isAdminOnlyView, signOut } = useAuth();
  const fullWidth = useLayoutStore((s) => s.fullWidth);
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = useState(
    () => window.localStorage.getItem("adminSidebarCollapsed") === "true"
  );
  const [adminMobileOpen, setAdminMobileOpen] = useState(false);

  if (!user) return null;

  const firstName = user.nome.split(/\s+/)[0];

  // Menus por perfil, com "tone" para colorir o ícone conforme a área
  const closerNav: NavItem[] = [
    { path: "/meu", label: "Minha Lista", icon: User, tone: "closer" },
    { path: "/registro", label: "Planilhamento", icon: FileText, tone: "closer" },
    { path: "/painel", label: "Painel De Influenciadores", icon: Lock, tone: "closer" },
  ];

  const adminNav: NavItem[] = [
    { path: "/financeiro", label: "Financeiro", icon: DollarSign, tone: "admin" },
    { path: "/diretorio", label: "Diretório", icon: BookOpen, tone: "admin" },
    { path: "/notificacoes", label: "Notificações", icon: Bell, tone: "admin" },
    { path: "/auditoria", label: "Auditoria", icon: Shield, tone: "admin" },
    { path: "/admin", label: "Admin", icon: Settings, tone: "admin" },
  ];

  const financeiroInternalNav: NavItem[] = [
    { path: "/financeiro/comprovantes", label: "Comprovantes", icon: FileText, tone: "financeiro" },
    { path: "/financeiro/espelhamento", label: "Espelhamento", icon: LayoutGrid, tone: "financeiro" },
  ];

  const financeiroPageNav: NavItem[] = [
    { path: "/financeiro/comprovantes", label: "Comprovantes", icon: FileText },
    { path: "/financeiro/espelhamento", label: "Espelhamento", icon: LayoutGrid },
  ];

  // ADMIN: view única, mesclando closer + admin + financeiro (com cores)
  // FINANCEIRO: apenas suas páginas
  // CLOSER: apenas closer
  const primaryNav: NavItem[] = isFinanceiro
    ? financeiroPageNav
    : isAdminOnlyView
    ? [...closerNav, ...adminNav, ...financeiroInternalNav]
    : closerNav;

  const topNavItems = primaryNav;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleAdminNavigate = (path: string) => {
    navigate(path);
    setAdminMobileOpen(false);
  };

  const toggleAdminSidebar = () => {
    setAdminSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("adminSidebarCollapsed", String(next));
      return next;
    });
  };

  if (isAdminOnlyView) {
    const adminSidebarGroups: NavGroup[] = [
      {
        id: "meu-espaco",
        label: "Meu espaço",
        items: closerNav,
      },
      {
        id: "time",
        label: "Time",
        items: [
          adminNav[0],
          ...financeiroInternalNav,
        ],
      },
      {
        id: "controle",
        label: "Controle",
        items: [
          adminNav[1],
          adminNav[3],
          adminNav[2],
          adminNav[4],
        ],
      },
    ];

    return (
      <div className="flex min-h-screen bg-[#f3f3ef] text-foreground">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-card transition-[width] duration-200 lg:block",
            adminSidebarCollapsed ? "w-20" : "w-64"
          )}
        >
          <AdminSidebarContent
            collapsed={adminSidebarCollapsed}
            groups={adminSidebarGroups}
            locationPath={location.pathname}
            userName={user.nome}
            userEmail={user.email}
            onNavigate={handleAdminNavigate}
            onSignOut={handleSignOut}
            onToggle={toggleAdminSidebar}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
            <Sheet open={adminMobileOpen} onOpenChange={setAdminMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-r border-border p-0">
                <AdminSidebarContent
                  collapsed={false}
                  groups={adminSidebarGroups}
                  locationPath={location.pathname}
                  userName={user.nome}
                  userEmail={user.email}
                  onNavigate={handleAdminNavigate}
                  onSignOut={handleSignOut}
                  mobile
                />
              </SheetContent>
            </Sheet>
            <span className="ml-3 text-sm font-semibold">CriptPic Board</span>
          </div>

          <main className={cn("min-w-0", fullWidth ? "px-0 py-2" : "px-5 py-6 lg:px-8 lg:py-8")}>
            <Outlet />
          </main>
        </div>
        <FloatingQuickNav
          locationPath={location.pathname}
          onNavigate={handleAdminNavigate}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f3ef] text-slate-950">
      <div className="px-5 pb-8 pt-6 lg:px-6 lg:pt-6">
        <div className="grid items-center gap-6 pb-[18px] lg:grid-cols-[auto_1fr_auto]">
          <button
            type="button"
            onClick={() => navigate("/home")}
            aria-label="Ir para Home"
            aria-current={location.pathname === "/home" ? "page" : undefined}
            className={cn(
              "inline-flex min-w-[116px] items-center gap-[10px] rounded-[20px] bg-white px-[14px] py-[10px] text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] transition hover:-translate-y-px hover:shadow-[0_16px_32px_-24px_rgba(15,23,42,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
              location.pathname === "/home" && "ring-black/[0.12]"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(180deg,#48a857_0%,#28773f_100%)] text-white">
              <HomeIcon className="h-4 w-4" />
            </span>
            <span className="text-[14px] font-medium tracking-[-0.01em] text-slate-900">Home</span>
          </button>

          <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-center lg:gap-6">
            <div className="inline-flex items-center gap-[6px] rounded-[20px] bg-white p-[6px] shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
              {topNavItems.map((item) => {
                const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                const Icon = item.icon;
                const toneIcon = item.tone ? toneClasses[item.tone].icon : "text-slate-500";
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors",
                      active ? "bg-[#242424] text-white" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", active ? "text-white" : toneIcon)} />
                    {item.label}
                  </button>
                );
              })}
            </div>

          </div>

          <div className="flex items-center justify-start gap-3 lg:justify-end">

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden min-w-[178px] items-center gap-[10px] rounded-[20px] bg-white px-3 py-2 text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] transition hover:bg-black/[0.02] sm:flex"
                >
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[linear-gradient(180deg,#f2d7c4_0%,#b47f59_100%)] text-[12px] font-semibold text-white">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium tracking-[-0.01em] text-slate-900">{user.nome}</div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">
                      {user.email}
                    </div>
                  </div>
                  <MoreHorizontal className="ml-auto h-4 w-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>


      <div className="min-h-[calc(100vh-98px)]">
        <main className={cn("min-w-0", fullWidth ? "px-0 py-2" : "px-5 py-6 lg:px-6 lg:py-8")}>
          <Outlet />
        </main>
      </div>
      {!isFinanceiro && (
        <FloatingQuickNav
          locationPath={location.pathname}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}
