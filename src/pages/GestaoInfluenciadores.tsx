import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { PageHeader } from "@/components/design/PageHeader";
import { PanelCard } from "@/components/design/PanelCard";

const GestaoInfluenciadores = () => {
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Pipeline"
        title="Gestão de Influs"
        description="Pipeline visual, acompanhamento de negociação e visão operacional do board."
      />

      <PanelCard
        title="Board ativo"
        description="Acompanhe movimentações, status e próximos passos em uma única superfície."
      >
        <div className="overflow-x-auto">
          <KanbanBoard />
        </div>
      </PanelCard>
    </div>
  );
};

export default GestaoInfluenciadores;
