import { useState } from "react";
import { FileText, BarChart3, ListChecks } from "lucide-react";
import PlanilhamentoDiario from "./PlanilhamentoDiario";
import Balanco from "./Balanco";
import ListaDoMes from "./ListaDoMes";

const tabs = [
  { id: "diario", label: "Planilhamento Diário", icon: FileText },
  { id: "balanco", label: "Balanço", icon: BarChart3 },
  { id: "lista-mes", label: "Lista do Mês", icon: ListChecks },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function PlanilhamentoTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("diario");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container py-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Planilhamento</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão financeira diária dos influenciadores
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b bg-card">
        <div className="container">
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative
                    ${isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="container py-6">
        {activeTab === "diario" && <PlanilhamentoDiario />}
        {activeTab === "balanco" && <Balanco />}
        {activeTab === "lista-mes" && <ListaDoMes />}
      </div>
    </div>
  );
}
