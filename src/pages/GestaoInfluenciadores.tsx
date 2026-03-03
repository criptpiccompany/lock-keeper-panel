import { KanbanBoard } from "@/components/kanban/KanbanBoard";

const GestaoInfluenciadores = () => {
  return (
    <main className="container-premium py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
          Gestão de Influenciadores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline, acompanhamento e controle operacional
        </p>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <KanbanBoard />
      </div>
    </main>
  );
};

export default GestaoInfluenciadores;
