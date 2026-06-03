import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type UserRole = 'CLOSER' | 'ADMIN' | 'SUBADMIN';

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

  const fetchUserProfile = async (userId: string): Promise<AuthUser | null> => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nome, status, rejection_reason, team_id')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return null;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();

      return {
        id: userId,
        email: authUser?.email || '',
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid blocking the auth state change
          setTimeout(async () => {
            const userProfile = await fetchUserProfile(currentSession.user.id);
            setUser(userProfile);
            setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchUserProfile(currentSession.user.id).then((userProfile) => {
          setUser(userProfile);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
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
      if (inviteToken) {
        metadata.invite_token = inviteToken;
      }
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: metadata,
        },
      });
      
      if (error) {
        toast.error('Erro ao criar conta', { description: error.message });
        return { error };
      }
      
      toast.success('Conta criada com sucesso!', { 
        description: 'Você já pode fazer login.' 
      });
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

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin: user?.role === 'ADMIN',
    isSubAdmin: user?.role === 'SUBADMIN',
    isCloser: user?.role === 'CLOSER',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
