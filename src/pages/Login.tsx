import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
    if (!inviteToken) return;
    void supabase.rpc('validate_invite_token', { _token: inviteToken }).then(({ data }) => {
      setInviteValid(!!data);
      if (!data) toast.error('Convite inválido ou expirado');
    });
  }, [inviteToken]);

  if (!loading && user) return <Navigate to="/home" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (isSignUp) {
      if (inviteToken && !inviteValid) {
        toast.error('Convite inválido');
        setIsSubmitting(false);
        return;
      }
      const { error } = await signUp(email, password, nome, inviteToken || undefined);
      if (!error) setPassword('');
    } else {
      await signIn(email, password);
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--login-stage))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--login-paper))]" />
      </div>
    );
  }

  return (
    <main className="login-stage">
      <div className="login-grain" aria-hidden="true" />
      <form onSubmit={handleSubmit} className="login-composition">
        <header className="login-heading-wrap">
          <p className="login-kicker">Online Money Company</p>
          <h1 className="login-display">
            {isSignUp ? 'Crie seu acesso' : '1% melhor que ontem'}
          </h1>
        </header>

        <div className={`login-fields ${isSignUp ? 'login-fields--signup' : ''}`}>
          {isSignUp && (
            <label className="login-field">
              <span>Nome</span>
              <input
                type="text"
                autoComplete="name"
                placeholder="Seu nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </label>
          )}

          <label className="login-field">
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </label>

          <div className="login-password-row">
            <label className="login-field">
              <span>Senha</span>
              <input
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                disabled={isSubmitting}
              />
            </label>

            <button
              type="submit"
              className="login-form-submit"
              aria-label={isSignUp ? 'Criar conta' : 'Entrar'}
              disabled={isSubmitting || (isSignUp && (!inviteToken || !inviteValid))}
            >
              {isSubmitting
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <ArrowRight className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {isSignUp && inviteToken && inviteValid === false && (
          <div className="login-invite-error" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Convite inválido ou expirado. Peça um novo convite ao administrador.</span>
          </div>
        )}

        <div className="login-wordmark" aria-hidden="true">
          <span>{isSignUp ? 'Criar conta' : 'CriptPic'}</span>
        </div>
      </form>
    </main>
  );
}
