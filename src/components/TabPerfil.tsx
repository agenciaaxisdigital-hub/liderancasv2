import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Shield, User, UserPlus, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function TabPerfil() {
  const { usuario, isAdmin, signOut } = useAuth();
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string; tipo: string; criado_em: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoSenha, setNovoSenha] = useState('');
  const [novoTipo, setNovoTipo] = useState<'agente' | 'admin'>('agente');
  const [criando, setCriando] = useState(false);

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('id, nome, tipo, criado_em');
    if (data) setUsuarios(data);
    setLoaded(true);
  };

  useEffect(() => {
    if (isAdmin && !loaded) fetchUsuarios();
  }, [isAdmin]);

  const handleCriar = async () => {
    if (!novoNome.trim() || !novoSenha.trim()) return;
    setCriando(true);
    try {
      const { data, error } = await supabase.functions.invoke('criar-usuario', {
        body: { nome: novoNome.trim(), senha: novoSenha, tipo: novoTipo },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `✅ Usuário "${novoNome.trim()}" criado!` });
      setNovoNome(''); setNovoSenha(''); setNovoTipo('agente'); setShowForm(false);
      fetchUsuarios();
    } catch (err: any) {
      toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' });
    } finally { setCriando(false); }
  };

  const inputCls = "w-full h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-4 pb-24">
      <div className="section-card flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center">
          {usuario?.tipo === 'admin' ? <Shield size={28} className="text-white" /> : <User size={28} className="text-white" />}
        </div>
        <h2 className="text-lg font-bold text-foreground mt-3">{usuario?.nome || '—'}</h2>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-wider mt-1">
          {usuario?.tipo === 'admin' ? 'Administrador' : 'Agente de Campo'}
        </span>
      </div>

      {/* Gerenciamento de Usuários (admin only) */}
      {isAdmin && (
        <div className="section-card">
          <div className="flex items-center justify-between">
            <h2 className="section-title">🔑 Usuários do Sistema</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
            >
              <UserPlus size={14} />
              Novo
            </button>
          </div>

          {showForm && (
            <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Criar novo usuário</p>
              <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome do usuário" className={inputCls} />
              <input type="text" value={novoSenha} onChange={e => setNovoSenha(e.target.value)} placeholder="Senha" className={inputCls} />
              <div className="flex gap-2">
                <button onClick={() => setNovoTipo('agente')}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium border transition-all ${novoTipo === 'agente' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>
                  Agente de Campo
                </button>
                <button onClick={() => setNovoTipo('admin')}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium border transition-all ${novoTipo === 'admin' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>
                  Administrador
                </button>
              </div>
              <button onClick={handleCriar} disabled={criando || !novoNome.trim() || !novoSenha.trim()}
                className="w-full h-10 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                {criando ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : 'Criar Usuário'}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            {usuarios.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{u.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                    {u.tipo === 'admin' && <Shield size={12} className="text-primary shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {u.tipo === 'admin' ? 'Administrador' : 'Agente de Campo'} · Desde {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={signOut}
        className="w-full h-12 border border-destructive/30 rounded-xl text-destructive font-medium flex items-center justify-center gap-2 active:scale-[0.97] transition-all">
        <LogOut size={18} /> Sair
      </button>

      <p className="text-center text-[10px] text-muted-foreground">v1.0 · Lideranças – Dra. Fernanda Sarelli</p>
    </div>
  );
}
