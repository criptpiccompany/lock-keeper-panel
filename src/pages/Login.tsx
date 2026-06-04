import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F6F4F0' }}>
      <div className="w-full max-w-sm mx-4">
        {/* Logo CRIPTPIC com fade-in transparente → sólido */}
        <div className="flex justify-center mb-8 h-32">
          <img
            src={criptpicLogo.url}
            alt="CRIPTPIC"
            className="h-32 w-auto object-contain animate-[fadeInSolid_1.2s_ease-out_forwards] opacity-0"
          />
        </div>



        {/* Form Card */}
        <div className="bg-card rounded-xl border shadow-subtle p-6">
          <h2 className="text-lg font-medium mb-6">
            {isSignUp ? 'Criar conta' : 'Entrar'}
          </h2>

          {isSignUp && inviteToken && inviteValid === false && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">Convite inválido ou expirado. Peça um novo convite ao administrador.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required={isSignUp}
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isSubmitting}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || (isSignUp && (!inviteToken || !inviteValid))}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
