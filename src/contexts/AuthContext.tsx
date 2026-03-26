import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Usuario {
  id: string;
  auth_user_id: string;
  nome: string;
  tipo: 'admin' | 'agente';
}

interface AuthContextType {
  user: User | null;
  usuario: Usuario | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (nome: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Convert username to a fake email for Supabase Auth
function nomeToEmail(nome: string): string {
  const slug = nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  return `${slug}@liderancas.app`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsuario = async (authUserId: string) => {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();
    if (data) {
      setUsuario(data as unknown as Usuario);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUsuario(session.user.id), 0);
      } else {
        setUsuario(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUsuario(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (nome: string, password: string) => {
    const email = nomeToEmail(nome);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      usuario,
      loading,
      isAdmin: usuario?.tipo === 'admin',
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
