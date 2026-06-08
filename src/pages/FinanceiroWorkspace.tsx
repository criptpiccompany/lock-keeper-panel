import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinanceiroComprovantes from "./FinanceiroComprovantes";
import FinanceiroEspelhamento from "./FinanceiroEspelhamento";

export default function FinanceiroWorkspace({ initialTab }: { initialTab: "comprovantes" | "espelhamento" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const tab = location.pathname.includes("espelhamento") ? "espelhamento" : "comprovantes";

  return (
    <div className="min-h-screen bg-[#F6F4F0]">
      <div className="border-b bg-white/60 backdrop-blur-sm sticky top-[66px] z-30">
        <div className="container px-4 sm:px-6 lg:px-8 py-3">
          <Tabs value={tab} onValueChange={(v) => navigate(`/financeiro/${v}`)}>
            <TabsList>
              <TabsTrigger value="comprovantes">Comprovantes</TabsTrigger>
              <TabsTrigger value="espelhamento">Espelhamento</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="container px-4 sm:px-6 lg:px-8 py-6">
        {tab === "comprovantes" ? <FinanceiroComprovantes /> : <FinanceiroEspelhamento />}
      </div>
    </div>
  );
}
