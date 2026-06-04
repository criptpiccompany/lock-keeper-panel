import { useState, useEffect, useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import criptpicLogo from '@/assets/criptpic-logo.png.asset.json';

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const isSignUp = !!inviteToken;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteValid, setInviteValid] = useState<boolean | null>(inviteToken ? null : true);
  const logoRef = useRef<HTMLImageElement>(null);


  // Intro: logo entra ocupando a tela e encolhe até o slot final em 2s
  useEffect(() => {
    const el = logoRef.current;
    if (!el) return;
    const run = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const targetSize = Math.min(vw * 0.85, vh * 0.7);
      const scale = targetSize / rect.width;
      const dx = vw / 2 - (rect.left + rect.width / 2);
      const dy = vh / 2 - (rect.top + rect.height / 2);
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1, offset: 0 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 1 },
        ],
        { duration: 2000, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
      );
    };
    if (el.complete) run();
    else el.addEventListener('load', run, { once: true });
  }, []);


  useEffect(() => {
    if (inviteToken) {
      supabase.rpc('validate_invite_token', { _token: inviteToken }).then(({ data }) => {
        setInviteValid(!!data);
        if (!data) toast.error('Convite inválido ou expirado');
      });
    }
  }, [inviteToken]);

  // Redirect if already logged in
  if (!loading && user) {
    return <Navigate to="/meu" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (isSignUp) {
      if (inviteToken && !inviteValid) {
        toast.error('Convite inválido');
        setIsSubmitting(false);
        return;
      }
      // Pass invite token to signUp so handle_new_user trigger can consume it
      const { error } = await signUp(email, password, nome, inviteToken || undefined);
      if (!error) {
        setPassword('');
      }
    } else {
      await signIn(email, password);
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#F6F4F0' }}>
      <div className="w-full max-w-md">
        {/* Logo CRIPTPIC com fade-in + drop-shadow vermelho sutil pulsante */}
        <div className="flex justify-center mb-10 h-36">
          <img
            src={criptpicLogo.url}
            alt="CRIPTPIC"
            className="h-36 w-auto object-contain logo-premium animate-[fadeInSolid_1.2s_ease-out_forwards] opacity-0"
          />
        </div>



        {/* Form Card — premium brand language */}
        <div className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] p-8 sm:p-10 animate-[fadeInSolid_0.8s_ease-out_0.4s_both] opacity-0">
          {isSignUp && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted mb-5">
              <Sparkles className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Novo acesso
              </span>
            </div>
          )}


          <h1 className="text-4xl font-semibold tracking-tight mb-2">
            {isSignUp ? 'Criar conta' : 'Bem-vindo'}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {isSignUp
              ? 'Complete seu cadastro para acessar a plataforma.'
              : 'Entre com suas credenciais para continuar.'}
          </p>

          {isSignUp && inviteToken && inviteValid === false && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-destructive/10 border border-destructive/20 mb-5">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">Convite inválido ou expirado. Peça um novo convite ao administrador.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required={isSignUp}
                  disabled={isSubmitting}
                  className="h-12 rounded-full px-5 bg-muted/40 border-border/60 focus-visible:bg-white transition-colors"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-12 rounded-full px-5 bg-muted/40 border-border/60 focus-visible:bg-white transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isSubmitting}
                className="h-12 rounded-full px-5 bg-muted/40 border-border/60 focus-visible:bg-white transition-colors"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-medium mt-2 transition-transform hover:scale-[1.01] active:scale-[0.99] group"
              disabled={isSubmitting || (isSignUp && (!inviteToken || !inviteValid))}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isSignUp ? 'Criar conta' : 'Entrar'}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso exclusivo · criptpic · online money
        </p>
      </div>
    </div>
  );
}

