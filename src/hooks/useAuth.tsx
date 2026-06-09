import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type UserRole = 'CLOSER' | 'ADMIN' | 'SUBADMIN' | 'FINANCEIRO';

type AccountStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

interface AuthUser {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  status: AccountStatus;
  rejectionReason: string | null;
  teamId: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string, inviteToken?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isCloser: boolean;
  isFinanceiro: boolean;
  isGlobalViewer: boolean;
  realRole: UserRole | null;
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  isImpersonating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewAsRole, setViewAsRoleState] = useState<UserRole | null>(null);

  const setViewAsRole = (role: UserRole | null) => {
    setViewAsRoleState(role);
    try {
      localStorage.removeItem('viewAsRole');
    } catch {}
  };

  const fetchUserProfile = async (userId: string, email: string): Promise<AuthUser | null> => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nome, status, rejection_reason, team_id')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return null;
      }

      return {
        id: userId,
        email,
        nome: profile.nome,
        role: roleData.role as UserRole,
        status: (profile as any).status as AccountStatus || 'pending',
        rejectionReason: (profile as any).rejection_reason || null,
        teamId: (profile as any).team_id || null,
      };
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    // Track the last loaded profile id so token refresh / focus events
    // do NOT trigger a full profile refetch (which re-creates the `user`
    // object and cascades re-renders across the app — visible as flicker).
    let lastLoadedUserId: string | null = null;
    let cancelled = false;

    const loadProfile = (userId: string, email: string) => {
      // Fire-and-forget — never await inside onAuthStateChange.
      fetchUserProfile(userId, email).then((userProfile) => {
        if (cancelled) return;
        if (userProfile) lastLoadedUserId = userId;
        setUser(userProfile);
        setLoading(false);
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        const sessionUserId = currentSession?.user?.id ?? null;

        if (!sessionUserId) {
          lastLoadedUserId = null;
          setViewAsRole(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // Only (re)fetch profile when the user identity actually changes
        // or on explicit USER_UPDATED. Ignore TOKEN_REFRESHED / SIGNED_IN
        // on the same user — they fire on tab focus and were causing the
        // whole tree to re-render as if reloading.
        const userChanged = sessionUserId !== lastLoadedUserId;
        if (userChanged || event === 'USER_UPDATED') {
          loadProfile(sessionUserId, currentSession!.user.email || '');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (cancelled) return;
      setSession(currentSession);
      if (currentSession?.user) {
        loadProfile(currentSession.user.id, currentSession.user.email || '');
      } else {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error('Erro ao fazer login', { description: error.message });
        return { error };
      }
      toast.success('Login realizado com sucesso!');
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, nome: string, inviteToken?: string) => {
    try {
      const metadata: Record<string, string> = { nome };
      if (inviteToken) metadata.invite_token = inviteToken;
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: metadata },
      });
      if (error) {
        toast.error('Erro ao criar conta', { description: error.message });
        return { error };
      }
      toast.success('Conta criada com sucesso!', { description: 'Você já pode fazer login.' });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    toast.success('Logout realizado');
  };

  const realRole = user?.role ?? null;
  const canImpersonate = realRole === 'ADMIN' || realRole === 'SUBADMIN' || realRole === 'FINANCEIRO';
  const effectiveRole: UserRole | null = canImpersonate && viewAsRole ? viewAsRole : realRole;
  const isImpersonating = !!(canImpersonate && viewAsRole && viewAsRole !== realRole);

  const value: AuthContextType = {
    user, session, loading, signIn, signUp, signOut,
    isAdmin: effectiveRole === 'ADMIN',
    isSubAdmin: effectiveRole === 'SUBADMIN',
    isCloser: effectiveRole === 'CLOSER',
    isFinanceiro: effectiveRole === 'FINANCEIRO',
    isGlobalViewer: effectiveRole === 'ADMIN' || effectiveRole === 'FINANCEIRO',
    realRole,
    viewAsRole: canImpersonate ? viewAsRole : null,
    setViewAsRole,
    isImpersonating,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
