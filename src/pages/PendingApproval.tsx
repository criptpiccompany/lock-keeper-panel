import { Clock, ShieldOff, XCircle } from "lucide-react";

import { BrandMark } from "@/components/design/BrandMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function PendingApproval() {
  const { user, signOut } = useAuth();
  const status = user?.status || "pending";

  const config = {
    pending: {
      icon: <Clock className="h-10 w-10" />,
      title: "Aguardando Aprovação",
      description:
        "Sua conta foi criada com sucesso. Um administrador precisa liberar o seu acesso antes do uso.",
      tone: "tone-warning",
    },
    rejected: {
      icon: <XCircle className="h-10 w-10" />,
      title: "Conta Rejeitada",
      description: user?.rejectionReason
        ? `Sua conta foi rejeitada. Motivo: "${user.rejectionReason}".`
        : "Sua conta foi rejeitada por um administrador. Entre em contato para mais detalhes.",
      tone: "tone-danger",
    },
    blocked: {
      icon: <ShieldOff className="h-10 w-10" />,
      title: "Conta Bloqueada",
      description:
        "Sua conta foi bloqueada por um administrador. Entre em contato para regularização.",
      tone: "tone-danger",
    },
  } as const;

  const current = config[status as keyof typeof config] || config.pending;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex justify-center">
          <BrandMark />
        </div>

        <section className="surface-panel-strong space-y-5 text-center">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border ${current.tone}`}>
            {current.icon}
          </div>
          <div className="space-y-2">
            <p className="eyebrow">Status da conta</p>
            <h1 className="text-2xl font-semibold text-foreground">{current.title}</h1>
            <p className="text-sm leading-7 text-muted-foreground">{current.description}</p>
          </div>
          <Button variant="outline" className="rounded-full" onClick={signOut}>
            Sair
          </Button>
        </section>
      </div>
    </div>
  );
}
