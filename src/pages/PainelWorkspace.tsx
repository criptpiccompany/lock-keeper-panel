import { Lock, PanelTop } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

const tabs = [
  { path: "/painel/travados", label: "Influenciadores Travados", icon: Lock },
  { path: "/painel/meu", label: "Meu Painel", icon: PanelTop },
];

export default function PainelWorkspace() {
  return (
    <div className="space-y-6">
      <nav
        aria-label="Áreas do Painel"
        className="inline-flex items-center gap-1 rounded-[20px] bg-white p-1.5 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03]"
      >
        {tabs.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => cn(
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium tracking-[-0.01em] transition-colors",
              isActive
                ? "bg-[#242424] text-white"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
