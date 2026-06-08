import FinanceiroComprovantes from "./FinanceiroComprovantes";
import FinanceiroEspelhamento from "./FinanceiroEspelhamento";

export default function FinanceiroWorkspace({ initialTab }: { initialTab: "comprovantes" | "espelhamento" }) {
  return (
    <div className="min-w-0">
      {initialTab === "comprovantes" ? <FinanceiroComprovantes /> : <FinanceiroEspelhamento />}
    </div>
  );
}
