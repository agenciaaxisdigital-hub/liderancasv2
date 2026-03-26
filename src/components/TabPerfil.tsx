import { useState, useEffect } from 'react';
import { useAuth, TipoUsuario } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Shield, User, UserPlus, Loader2, Crown, Users, Eye, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const tipoLabels: Record<TipoUsuario, string> = {
  super_admin: 'Super Admin',
  coordenador: 'Coordenador',
  suplente: 'Suplente',
  lideranca: 'Liderança',
  fiscal: 'Fiscal',
};

const tipoIcons: Record<TipoUsuario, typeof Shield> = {
  super_admin: Crown,
  coordenador: Shield,
  suplente: User,
  lideranca: Users,
  fiscal: Eye,
};

interface SuplenteOption {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
}

export default function TabPerfil() {
  const { usuario, isAdmin, tipoUsuario, signOut } = useAuth();
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string; tipo: string; criado_em: string; suplente_id: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [novoSenha, setNovoSenha] = useState('');
  const [criando, setCriando] = useState(false);
  const [suplentes, setSuplentes] = useState<SuplenteOption[]>([]);
  const [selectedSuplenteId, setSelectedSuplenteId] = useState('');

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('hierarquia_usuarios').select('id, nome, tipo, criado_em, suplente_id').eq('ativo', true).order('criado_em', { ascending: false });
    if (data) setUsuarios(data);
    setLoaded(true);
  };

  const fetchSuplentes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('buscar-suplentes');
      if (!error && data) setSuplentes(data);
    } catch (err) {
      console.error('Erro ao buscar suplentes:', err);
    }
  };

  useEffect(() => {
    if (isAdmin && !loaded) {
      fetchUsuarios();
      fetchSuplentes();
    }
  }, [isAdmin]);

  // Filter suplentes that don't already have a user
  const suplentesJaVinculados = new Set(usuarios.filter(u => u.suplente_id).map(u => u.suplente_id));
  const suplentesDisponiveis = suplentes.filter(s => !suplentesJaVinculados.has(s.id));

  const selectedSuplente = suplentes.find(s => s.id === selectedSuplenteId);

  const handleCriar = async () => {
    if (!selectedSuplenteId || !novoSenha.trim()) return;
    if (!selectedSuplente) return;
    setCriando(true);
    try {
      const { data, error } = await supabase.functions.invoke('criar-usuario', {
        body: {
          nome: selectedSuplente.nome.trim(),
          senha: novoSenha,
          tipo: 'suplente',
          superior_id: usuario?.id,
          suplente_id: selectedSuplenteId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `✅ Usuário "${selectedSuplente.nome}" criado!` });
      setNovoSenha('');
      setSelectedSuplenteId('');
      setShowForm(false);
      fetchUsuarios();
    } catch (err: any) {
      toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' });
    } finally { setCriando(false); }
  };

  const inputCls = "w-full h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";
  const selectCls = inputCls;
  const IconComponent = tipoUsuario ? tipoIcons[tipoUsuario] : User;

  // Find suplente name for a user
  const getSuplenteNome = (suplente_id: string | null) => {
    if (!suplente_id) return null;
    return suplentes.find(s => s.id === suplente_id)?.nome || null;
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="section-card flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center">
          <IconComponent size={28} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-foreground mt-3">{usuario?.nome || '—'}</h2>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-wider mt-1">
          {tipoUsuario ? tipoLabels[tipoUsuario] : '—'}
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
              <p className="text-xs font-semibold text-foreground">Criar acesso para suplente</p>
              <p className="text-[10px] text-muted-foreground">Selecione o suplente já cadastrado e defina uma senha para ele acessar o app.</p>

              <select
                value={selectedSuplenteId}
                onChange={e => setSelectedSuplenteId(e.target.value)}
                className={selectCls}
              >
                <option value="">Selecione o suplente...</option>
                {suplentesDisponiveis.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nome}{s.regiao_atuacao ? ` — ${s.regiao_atuacao}` : ''}
                  </option>
                ))}
              </select>

              {selectedSuplente && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                  <p className="text-xs font-semibold text-primary">{selectedSuplente.nome}</p>
                  {selectedSuplente.regiao_atuacao && (
                    <p className="text-[10px] text-muted-foreground">{selectedSuplente.regiao_atuacao}</p>
                  )}
                </div>
              )}

              <input
                type="text"
                value={novoSenha}
                onChange={e => setNovoSenha(e.target.value)}
                placeholder="Senha de acesso"
                className={inputCls}
              />

              <button
                onClick={handleCriar}
                disabled={criando || !selectedSuplenteId || !novoSenha.trim()}
                className="w-full h-10 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
              >
                {criando ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : 'Criar Acesso'}
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
                    {(u.tipo === 'super_admin' || u.tipo === 'coordenador') && <Shield size={12} className="text-primary shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {tipoLabels[u.tipo as TipoUsuario] || u.tipo}
                    {getSuplenteNome(u.suplente_id) ? ` · ${getSuplenteNome(u.suplente_id)}` : ''}
                    {' · Desde '}
                    {new Date(u.criado_em).toLocaleDateString('pt-BR')}
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

      <p className="text-center text-[10px] text-muted-foreground">v2.0 · Rede Política – Dra. Fernanda Sarelli</p>
    </div>
  );
}
