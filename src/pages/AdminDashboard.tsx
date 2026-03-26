import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Users, TrendingUp, Award, Activity, ChevronDown, ChevronUp,
  Phone, Mail, MapPin, Calendar, Clock, Hash, UserCheck,
  Zap, Target, Star, AlertTriangle, Shield, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

interface Lideranca {
  id: string;
  tipo_lideranca: string | null;
  nivel: string | null;
  status: string;
  regiao_atuacao: string | null;
  nivel_comprometimento: string | null;
  apoiadores_estimados: number | null;
  meta_votos: number | null;
  criado_em: string;
  cadastrado_por: string | null;
  observacoes: string | null;
  pessoas: {
    nome: string;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
    cpf: string | null;
    instagram: string | null;
    zona_eleitoral: string | null;
    secao_eleitoral: string | null;
    municipio_eleitoral: string | null;
    colegio_eleitoral: string | null;
    situacao_titulo: string | null;
  } | null;
}

interface HierarquiaUsuario {
  id: string;
  nome: string;
  tipo: string;
  criado_em: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Ativa': 'hsl(142 71% 45%)',
  'Potencial': 'hsl(217 91% 60%)',
  'Em negociação': 'hsl(45 93% 47%)',
  'Fraca': 'hsl(25 95% 53%)',
  'Descartada': 'hsl(0 72% 51%)',
};

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return date.toLocaleDateString('pt-BR');
}

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [liderancas, setLiderancas] = useState<Lideranca[]>([]);
  const [usuarios, setUsuarios] = useState<HierarquiaUsuario[]>([]);
  const [totalFiscais, setTotalFiscais] = useState(0);
  const [totalEleitores, setTotalEleitores] = useState(0);
  const [eleitoresConfirmados, setEleitoresConfirmados] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    const [lRes, uRes, fRes, eRes, ecRes] = await Promise.all([
      supabase.from('liderancas').select('*, pessoas(nome, telefone, whatsapp, email, cpf, instagram, zona_eleitoral, secao_eleitoral, municipio_eleitoral, colegio_eleitoral, situacao_titulo)'),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, criado_em').eq('ativo', true),
      supabase.from('fiscais').select('id', { count: 'exact', head: true }),
      supabase.from('possiveis_eleitores').select('id', { count: 'exact', head: true }),
      supabase.from('possiveis_eleitores').select('id', { count: 'exact', head: true }).eq('compromisso_voto', 'Confirmado'),
    ]);
    if (lRes.data) setLiderancas(lRes.data as unknown as Lideranca[]);
    if (uRes.data) setUsuarios(uRes.data);
    setTotalFiscais(fRes.count || 0);
    setTotalEleitores(eRes.count || 0);
    setEleitoresConfirmados(ecRes.count || 0);
    setLoading(false);
  };

  const agentes = usuarios.filter(u => u.tipo === 'suplente' || u.tipo === 'lideranca' || u.tipo === 'coordenador');
  const suplentes = usuarios.filter(u => u.tipo === 'suplente');

  const totalLiderancas = liderancas.length;
  const totalApoiadores = liderancas.reduce((s, l) => s + (l.apoiadores_estimados || 0), 0);
  const totalMetaVotos = liderancas.reduce((s, l) => s + (l.meta_votos || 0), 0);
  const ativas = liderancas.filter(l => l.status === 'Ativa').length;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  const cadastrosHoje = liderancas.filter(l => new Date(l.criado_em) >= hoje).length;
  const cadastrosSemana = liderancas.filter(l => new Date(l.criado_em) >= inicioSemana).length;

  const ultimoCadastroGeral = liderancas.length > 0
    ? new Date(Math.max(...liderancas.map(l => new Date(l.criado_em).getTime())))
    : null;

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    liderancas.forEach(l => { map[l.status] = (map[l.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [liderancas]);

  const timelineData = useMemo(() => {
    const map: Record<string, number> = {};
    liderancas.forEach(l => {
      const d = new Date(l.criado_em);
      const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => {
        const [da, ma] = a.split('/').map(Number);
        const [db, mb] = b.split('/').map(Number);
        return ma !== mb ? ma - mb : da - db;
      })
      .map(([dia, total]) => ({ dia, total }));
  }, [liderancas]);

  const rankingData = useMemo(() => {
    const map: Record<string, { total: number; hoje: number; semana: number; ultimo: Date | null }> = {};
    agentes.forEach(a => { map[a.id] = { total: 0, hoje: 0, semana: 0, ultimo: null }; });
    liderancas.forEach(l => {
      if (!l.cadastrado_por) return;
      if (!map[l.cadastrado_por]) map[l.cadastrado_por] = { total: 0, hoje: 0, semana: 0, ultimo: null };
      const d = new Date(l.criado_em);
      map[l.cadastrado_por].total++;
      if (d >= hoje) map[l.cadastrado_por].hoje++;
      if (d >= inicioSemana) map[l.cadastrado_por].semana++;
      if (!map[l.cadastrado_por].ultimo || d > map[l.cadastrado_por].ultimo!) map[l.cadastrado_por].ultimo = d;
    });
    return agentes
      .map(a => ({ ...map[a.id], nome: a.nome, id: a.id, tipo: a.tipo }))
      .sort((a, b) => b.total - a.total);
  }, [liderancas, agentes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getMedalEmoji = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
  const agenteNome = (id: string | null) => agentes.find(a => a.id === id)?.nome || '—';

  const tipoLabel = (t: string) => {
    const labels: Record<string, string> = { super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente', lideranca: 'Liderança', fiscal: 'Fiscal' };
    return labels[t] || t;
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="h-[1.5px] gradient-header" />

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-xl hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Dashboard Admin</h1>
            <p className="text-[10px] text-muted-foreground">
              Controle geral · Atualizado {ultimoCadastroGeral ? timeSince(ultimoCadastroGeral) : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{cadastrosHoje}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">hoje</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {/* Resumo Geral - includes hierarchy totals */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Users, label: 'Lideranças', value: totalLiderancas, sub: `${ativas} ativas` },
            { icon: Shield, label: 'Fiscais', value: totalFiscais, sub: 'cadastrados' },
            { icon: Target, label: 'Eleitores', value: totalEleitores, sub: `${eleitoresConfirmados} confirmados` },
            { icon: Activity, label: 'Suplentes', value: suplentes.length, sub: `${agentes.length} agentes total` },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="section-card flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Indicadores rápidos */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Zap, label: 'Hoje', value: cadastrosHoje },
            { icon: Calendar, label: 'Semana', value: cadastrosSemana },
            { icon: TrendingUp, label: 'Apoiadores', value: totalApoiadores },
            { icon: Award, label: 'Meta votos', value: totalMetaVotos },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <Icon size={14} className="text-primary mx-auto mb-1" />
              <p className="text-base font-bold text-foreground">{typeof value === 'number' && value > 999 ? `${(value / 1000).toFixed(1)}k` : value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Status (pie) */}
        <div className="section-card">
          <h2 className="section-title">📊 Distribuição por Status</h2>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30} strokeWidth={2} stroke="hsl(var(--background))">
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || 'hsl(var(--muted-foreground))'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {statusData.map(s => {
                const pct = totalLiderancas > 0 ? Math.round((s.value / totalLiderancas) * 100) : 0;
                return (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s.name] || 'hsl(var(--muted-foreground))' }} />
                    <span className="text-foreground font-medium">{s.name}</span>
                    <span className="text-muted-foreground ml-auto">{s.value} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="section-card">
          <h2 className="section-title">📈 Cadastros por Dia</h2>
          {timelineData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro encontrado</p>
          )}
        </div>

        {/* Ranking */}
        <div className="section-card">
          <h2 className="section-title">🏆 Ranking de Agentes</h2>
          <div className="space-y-2">
            {rankingData.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                i === 0 ? 'border-amber-400/40 bg-amber-500/5' :
                i === 1 ? 'border-slate-400/30 bg-slate-500/5' :
                i === 2 ? 'border-orange-400/30 bg-orange-500/5' :
                'border-border bg-card'
              }`}>
                <span className="text-lg w-8 text-center shrink-0">{getMedalEmoji(i)}</span>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{r.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{r.nome}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{tipoLabel(r.tipo)}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>Hoje: <strong className="text-foreground">{r.hoje}</strong></span>
                    <span>Semana: <strong className="text-foreground">{r.semana}</strong></span>
                    {r.ultimo && <span>Último: {timeSince(r.ultimo)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-primary">{r.total}</p>
                  <p className="text-[9px] text-muted-foreground">total</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
