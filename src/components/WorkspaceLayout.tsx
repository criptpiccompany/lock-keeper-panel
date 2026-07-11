import { useState, type ComponentType } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  DollarSign,
  FileText,
  Home as HomeIcon,
  Info,
  LayoutGrid,
  Lock,
  LogOut,
  MoreHorizontal,
  Search,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutStore } from "@/store/useLayoutStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavTone = "closer" | "admin" | "financeiro";

type NavItem = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: NavTone;
};

const toneClasses: Record<NavTone, { icon: string; dot: string }> = {
  closer: { icon: "text-emerald-600", dot: "bg-emerald-500" },
  admin: { icon: "text-amber-600", dot: "bg-amber-500" },
  financeiro: { icon: "text-violet-600", dot: "bg-violet-500" },
};

function SidebarLink({
  item,
  active,
  expanded,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
}) {
  const Icon = item.icon;
  const tone = item.tone ? toneClasses[item.tone].icon : "";

  return (
    <Link
      to={item.path}
      title={item.label}
      aria-label={item.label}
      className="relative grid h-[44px] w-[44px] place-items-center"
    >
      <span
        className={cn(
          "grid h-[44px] w-[44px] place-items-center rounded-[18px] transition-all",
          active
            ? "bg-[#242424] text-white shadow-[0_16px_36px_-30px_rgba(15,23,42,0.28)]"
            : cn(
                "bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:text-slate-900",
                tone || "text-[#676767]"
              )
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium tracking-[-0.01em] transition-opacity duration-150",
          expanded ? "opacity-100" : "opacity-0",
          active ? "text-slate-950" : "text-slate-500"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function WorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isFinanceiro, isAdminOnlyView, signOut } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  if (!user) return null;

  const firstName = user.nome.split(/\s+/)[0];

  // Menus por perfil, com "tone" para colorir o ícone conforme a área
  const closerNav: NavItem[] = [
    { path: "/home", label: "Home", icon: HomeIcon, tone: "closer" },
    { path: "/meu", label: "Minha Lista", icon: User, tone: "closer" },
    { path: "/registro", label: "Planilhamento", icon: FileText, tone: "closer" },
    { path: "/painel", label: "Meu Painel", icon: Lock, tone: "closer" },
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

  const externalNavItems = !isFinanceiro && !isAdminOnlyView
    ? [{ label: "Influs Travados", path: "/influboard-test" }]
    : [];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };





  return (
    <div className="min-h-screen bg-[#f3f3ef] text-slate-950">
      <div className="px-5 pb-8 pt-6 lg:px-6 lg:pt-6">
        <div className="grid items-center gap-6 pb-[18px] lg:grid-cols-[auto_1fr_auto]">
          <div className="inline-flex min-w-[116px] items-center gap-[10px] rounded-[20px] bg-white px-[14px] py-[10px] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(180deg,#48a857_0%,#28773f_100%)] text-xs font-semibold text-white">
              C
            </div>
            <div className="text-[14px] font-medium tracking-[-0.01em] text-slate-900">CREATORS</div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-center lg:gap-6">
            <div className="inline-flex items-center gap-[6px] rounded-[20px] bg-white p-[6px] shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
              {topNavItems.map((item) => {
                const active = location.pathname === item.path;
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

            {externalNavItems.length > 0 && (
              <div
                className="inline-flex items-center gap-[6px] rounded-[20px] bg-white/70 p-[6px] shadow-[0_14px_30px_-26px_rgba(15,23,42,0.10)] ring-1 ring-dashed ring-slate-300"
                title="Sistema externo"
              >
                {externalNavItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "rounded-full px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] transition-colors",
                        active ? "bg-[#242424] text-white" : "text-slate-400 hover:text-slate-700"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-start gap-3 lg:justify-end">

            <div className="flex items-center gap-2 rounded-[20px] bg-white p-[6px] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]">
              <button type="button" className="grid h-[34px] w-[34px] place-items-center rounded-full text-slate-700 transition hover:bg-black/[0.03] hover:text-slate-900">
                <Search className="h-4 w-4" />
              </button>
              <button type="button" className="grid h-[34px] w-[34px] place-items-center rounded-full text-slate-700 transition hover:bg-black/[0.03] hover:text-slate-900">
                <Bell className="h-4 w-4" />
              </button>
            </div>

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


      <div className="grid min-h-[calc(100vh-98px)] lg:grid-cols-[56px_minmax(0,1fr)] lg:gap-6 lg:px-6">
        <aside className="relative border-b border-black/[0.04] bg-transparent px-5 pb-4 pt-4 lg:sticky lg:top-[92px] lg:h-[calc(100vh-120px)] lg:border-b-0 lg:px-0 lg:pt-[18px]">
          {/* Glow branco com efeito de pena que se expande para a direita */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute hidden transition-opacity duration-300 ease-out lg:block",
              sidebarExpanded ? "opacity-100" : "opacity-0"
            )}
            style={{
              left: "0",
              top: "-60px",
              height: "calc(100% + 120px)",
              width: "560px",
              zIndex: 0,
              background:
                "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.98) 20%, rgba(255,255,255,0.85) 38%, rgba(255,255,255,0.6) 55%, rgba(255,255,255,0.3) 75%, rgba(255,255,255,0.08) 90%, rgba(255,255,255,0) 100%)",
              filter: "blur(18px)",
            }}
          />

          <div className="relative z-10 flex items-center gap-3 lg:flex-col lg:items-center lg:gap-3">
            <button
              type="button"
              onClick={() => setSidebarExpanded((v) => !v)}
              aria-label={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
              aria-expanded={sidebarExpanded}
              className="hidden h-7 w-11 place-items-center rounded-full text-slate-400 transition-colors hover:text-slate-900 lg:grid"
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  sidebarExpanded && "rotate-180"
                )}
              />
            </button>
          </div>

          <div className="relative z-10 mt-3 space-y-3 lg:space-y-0">
            <div className="flex flex-wrap gap-3 lg:flex-col lg:items-center">
              {primaryNav.map((item) => (
                <SidebarLink key={item.path} item={item} active={location.pathname === item.path} expanded={sidebarExpanded} />
              ))}
            </div>

          </div>

          <div className="mt-8 lg:flex lg:min-h-[180px] lg:flex-col lg:justify-end">
            <div className="flex gap-3 lg:flex-col lg:items-center">
              <div className="rounded-[18px] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="grid h-[28px] w-[28px] place-items-center rounded-full text-[#676767] transition hover:bg-[#f3f3ef] hover:text-slate-950"
                  title="Sair"
                  aria-label="Sair"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-6 lg:px-3 lg:py-8 xl:pr-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
