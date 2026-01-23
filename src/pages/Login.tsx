import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  if (!loading && user) {
    return <Navigate to="/meu" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, nome);
      if (!error) {
        setIsSignUp(false);
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <span className="text-lg font-bold text-primary-foreground">IB</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">InfluBoard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de influenciadores
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card rounded-xl border shadow-subtle p-6">
          <h2 className="text-lg font-medium mb-6">
            {isSignUp ? 'Criar conta' : 'Entrar'}
          </h2>

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
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={isSubmitting}
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
            </button>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Novos usuários são criados como Closers.<br />
          Contate um admin para acesso administrativo.
        </p>
      </div>
    </div>
  );
}
