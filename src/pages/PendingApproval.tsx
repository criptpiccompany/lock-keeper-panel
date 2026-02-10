import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Clock, XCircle, ShieldOff } from 'lucide-react';

export default function PendingApproval() {
  const { user, signOut } = useAuth();

  const status = user?.status || 'pending';

  const config = {
    pending: {
      icon: <Clock className="h-12 w-12 text-amber-500" />,
      title: 'Aguardando Aprovação',
      description: 'Sua conta foi criada com sucesso. Um administrador precisa aprovar seu acesso antes que você possa utilizar o sistema.',
      color: 'text-amber-600',
    },
    rejected: {
      icon: <XCircle className="h-12 w-12 text-destructive" />,
      title: 'Conta Rejeitada',
      description: user?.rejectionReason
        ? `Sua conta foi rejeitada. Motivo: "${user.rejectionReason}"`
        : 'Sua conta foi rejeitada por um administrador. Entre em contato para mais informações.',
      color: 'text-destructive',
    },
    blocked: {
      icon: <ShieldOff className="h-12 w-12 text-destructive" />,
      title: 'Conta Bloqueada',
      description: 'Sua conta foi bloqueada por um administrador. Entre em contato para mais informações.',
      color: 'text-destructive',
    },
  };

  const current = config[status as keyof typeof config] || config.pending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm mx-4 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
          <span className="text-lg font-bold text-primary-foreground">IB</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-8">InfluBoard</h1>

        <div className="bg-card rounded-xl border shadow-subtle p-8 space-y-4">
          <div className="flex justify-center">{current.icon}</div>
          <h2 className={`text-lg font-semibold ${current.color}`}>{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        <Button variant="outline" className="mt-6" onClick={signOut}>
          Sair
        </Button>
      </div>
    </div>
  );
}
