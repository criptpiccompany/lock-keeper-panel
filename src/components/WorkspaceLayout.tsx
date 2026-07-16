import { type ComponentType } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  CalendarDays,
  DollarSign,
  FileText,
  Home as HomeIcon,
  Info,
  LayoutGrid,
  Lock,
  LogOut,
  MoreHorizontal,
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

export function WorkspaceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isFinanceiro, isAdminOnlyView, signOut } = useAuth();
  const fullWidth = useLayoutStore((s) => s.fullWidth);

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
    </div>
  );
}
