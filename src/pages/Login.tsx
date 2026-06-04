import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";

import { BrandMark } from "@/components/design/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const isSignUp = Boolean(inviteToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteValid, setInviteValid] = useState<boolean | null>(inviteToken ? null : true);

  useEffect(() => {
    if (!inviteToken) return;

    void supabase.rpc("validate_invite_token", { _token: inviteToken }).then(({ data }) => {
      setInviteValid(Boolean(data));
      if (!data) toast.error("Convite inválido ou expirado");
    });
  }, [inviteToken]);

  if (!loading && user) {
    return <Navigate to="/home" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (isSignUp) {
      if (inviteToken && !inviteValid) {
        toast.error("Convite inválido");
        setIsSubmitting(false);
        return;
      }

      const { error } = await signUp(email, password, nome, inviteToken || undefined);
      if (!error) setPassword("");
    } else {
      await signIn(email, password);
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
        <section className="hero-panel hidden lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-8">
            <BrandMark />
            <div className="space-y-4">
              <p className="eyebrow">Acesso central</p>
              <h1 className="font-display text-5xl leading-none text-foreground">
                Operação visual pronta para closer, subadmin e admin.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Entre para acompanhar carteira, planilhamento, locks e painéis de consulta
                sem perder a consistência do shell visual.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="metric-card">
              <p className="metric-kicker">Closer</p>
              <p className="mt-2 text-sm text-muted-foreground">Minha Lista e Planilhamento</p>
            </div>
            <div className="metric-card">
              <p className="metric-kicker">Subadmin</p>
              <p className="mt-2 text-sm text-muted-foreground">Operação e consulta em paralelo</p>
            </div>
            <div className="metric-card">
              <p className="metric-kicker">Admin</p>
              <p className="mt-2 text-sm text-muted-foreground">Governança, auditoria e visão geral</p>
            </div>
          </div>
        </section>

        <section className="surface-panel-strong flex flex-col justify-center">
          <div className="mb-8 space-y-4">
            <BrandMark compact className="lg:hidden" />
            <div className="space-y-2">
              <p className="eyebrow">{isSignUp ? "Convite" : "Entrar"}</p>
              <h2 className="text-2xl font-semibold text-foreground">
                {isSignUp ? "Criar conta" : "Entrar no painel"}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {isSignUp
                  ? "Finalize seu cadastro para acessar o ambiente liberado pelo administrador."
                  : "Use suas credenciais para acessar a operação."}
              </p>
            </div>
          </div>

          {isSignUp && inviteToken && inviteValid === false ? (
            <div className="mb-5 flex items-start gap-3 rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Convite inválido ou expirado. Solicite um novo convite ao administrador.</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp ? (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  required
                  disabled={isSubmitting}
                  className="rounded-2xl"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isSubmitting}
                className="rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={isSubmitting}
                className="rounded-2xl"
              />
            </div>

            <Button type="submit" className="w-full rounded-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando
                </>
              ) : isSignUp ? (
                "Criar conta"
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
