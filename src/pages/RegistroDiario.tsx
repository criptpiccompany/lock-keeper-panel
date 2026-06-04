import PlanilhamentoTabs from "@/components/planilhamento/PlanilhamentoTabs";
import { PageHeader } from "@/components/design/PageHeader";

export default function RegistroDiario() {
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Rotina diária"
        title="Planilhamento"
        description="Registro, revisão e consolidação visual da operação diária."
      />
      <PlanilhamentoTabs />
    </div>
  );
}
