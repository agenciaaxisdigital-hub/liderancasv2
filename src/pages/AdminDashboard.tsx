import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Users, TrendingUp, Award, Activity, ChevronDown, ChevronUp,
  Phone, Mail, MapPin, Calendar, Clock, Hash, UserCheck,
  Zap, Target, Star, AlertTriangle
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

interface Usuario {
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
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgente, setExpandedAgente] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    const [lRes, uRes] = await Promise.all([
      supabase.from('liderancas').select('*, pessoas(nome, telefone, whatsapp, email, cpf, instagram, zona_eleitoral, secao_eleitoral, municipio_eleitoral, colegio_eleitoral, situacao_titulo)'),
      supabase.from('usuarios').select('id, nome, tipo, criado_em'),
    ]);
    if (lRes.data) setLiderancas(lRes.data as unknown as Lideranca[]);
    if (uRes.data) setUsuarios(uRes.data);
    setLoading(false);
  };

  const agentes = usuarios.filter(u => u.tipo === 'agente');

  // ── Métricas gerais ──
  const totalLiderancas = liderancas.length;
  const totalApoiadores = liderancas.reduce((s, l) => s + (l.apoiadores_estimados || 0), 0);
  const totalMetaVotos = liderancas.reduce((s, l) => s + (l.meta_votos || 0), 0);
  const ativas = liderancas.filter(l => l.status === 'Ativa').length;
  const comCPF = liderancas.filter(l => l.pessoas?.cpf).length;
  const comDadosEleitorais = liderancas.filter(l => l.pessoas?.zona_eleitoral).length;
  const semTelefone = liderancas.filter(l => !l.pessoas?.telefone && !l.pessoas?.whatsapp).length;

  // Cadastros hoje / semana
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
  const cadastrosHoje = liderancas.filter(l => new Date(l.criado_em) >= hoje).length;
  const cadastrosSemana = liderancas.filter(l => new Date(l.criado_em) >= inicioSemana).length;

  // Último cadastro geral
  const ultimoCadastroGeral = liderancas.length > 0
    ? new Date(Math.max(...liderancas.map(l => new Date(l.criado_em).getTime())))
    : null;

  // ── Por status (pie chart) ──
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    liderancas.forEach(l => { map[l.status] = (map[l.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [liderancas]);

  // ── Timeline (line chart) ──
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

  // ── Ranking de agentes ──
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
      .map(a => ({ ...map[a.id], nome: a.nome, id: a.id, nomeCurto: a.nome.split(' ')[0] }))
      .sort((a, b) => b.total - a.total);
  }, [liderancas, agentes]);

  // ── Lideranças por agente ──
  const liderancasPorAgente = useMemo(() => {
    const map: Record<string, Lideranca[]> = {};
    liderancas.forEach(l => {
      const key = l.cadastrado_por || 'sem_agente';
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    // Sort each list by date desc
    Object.values(map).forEach(arr => arr.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()));
    return map;
  }, [liderancas]);

  // ── Pessoas que mais cadastraram (top lideranças por apoiadores) ──
  const topPorApoiadores = useMemo(() => {
    return [...liderancas]
      .filter(l => (l.apoiadores_estimados || 0) > 0)
      .sort((a, b) => (b.apoiadores_estimados || 0) - (a.apoiadores_estimados || 0))
      .slice(0, 10);
  }, [liderancas]);

  // ── Últimos cadastros (atividade recente) ──
  const ultimosCadastros = useMemo(() => {
    return [...liderancas].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()).slice(0, 8);
  }, [liderancas]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getMedalEmoji = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
  const agenteNome = (id: string | null) => agentes.find(a => a.id === id)?.nome || '—';

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="h-[1.5px] gradient-header" />

      {/* Header */}
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

        {/* ── Resumo Geral ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Users, label: 'Lideranças', value: totalLiderancas, sub: `${ativas} ativas · ${liderancas.length - ativas} outras` },
            { icon: Activity, label: 'Agentes', value: agentes.length, sub: `${rankingData.filter(r => r.hoje > 0).length} ativos hoje` },
            { icon: TrendingUp, label: 'Apoiadores', value: totalApoiadores.toLocaleString('pt-BR'), sub: 'estimados total' },
            { icon: Award, label: 'Meta votos', value: totalMetaVotos.toLocaleString('pt-BR'), sub: 'acumulado' },
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

        {/* ── Indicadores rápidos ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Zap, label: 'Hoje', value: cadastrosHoje },
            { icon: Calendar, label: 'Semana', value: cadastrosSemana },
            { icon: UserCheck, label: 'Com CPF', value: comCPF },
            { icon: Target, label: 'Eleitorais', value: comDadosEleitorais },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <Icon size={14} className="text-primary mx-auto mb-1" />
              <p className="text-base font-bold text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Alertas ── */}
        {semTelefone > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>{semTelefone}</strong> liderança{semTelefone > 1 ? 's' : ''} sem telefone/WhatsApp cadastrado
            </p>
          </div>
        )}

        {/* ── Atividade Recente ── */}
        <div className="section-card">
          <h2 className="section-title">⚡ Atividade Recente</h2>
          <div className="space-y-2">
            {ultimosCadastros.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-1.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-primary">{(item.pessoas?.nome || '?').charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{item.pessoas?.nome || '—'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    por {agenteNome(item.cadastrado_por)} · {item.tipo_lideranca || 'Sem ligação'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    item.status === 'Ativa' ? 'bg-emerald-500/10 text-emerald-600' :
                    item.status === 'Potencial' ? 'bg-blue-500/10 text-blue-600' :
                    'bg-muted text-muted-foreground'
                  }`}>{item.status}</span>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{timeSince(new Date(item.criado_em))}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Status (pie) ── */}
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

        {/* ── Timeline ── */}
        <div className="section-card">
          <h2 className="section-title">📈 Cadastros por Dia</h2>
          {timelineData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: 'hsl(var(--foreground))' }} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro encontrado</p>
          )}
        </div>

        {/* ── 🏆 Ranking de Agentes ── */}
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
                  <p className="text-sm font-semibold text-foreground truncate">{r.nome}</p>
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

        {/* ── 🌟 Top Lideranças por Apoiadores ── */}
        {topPorApoiadores.length > 0 && (
          <div className="section-card">
            <h2 className="section-title">🌟 Top Lideranças por Apoiadores</h2>
            <div className="space-y-1.5">
              {topPorApoiadores.map((item, i) => (
                <div key={item.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-sm w-6 text-center text-muted-foreground font-semibold">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{item.pessoas?.nome || '—'}</p>
                    <p className="text-[10px] text-muted-foreground">{item.tipo_lideranca || '—'} · {item.regiao_atuacao || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{(item.apoiadores_estimados || 0).toLocaleString('pt-BR')}</p>
                    <p className="text-[9px] text-muted-foreground">apoiadores</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Gráfico ranking ── */}
        {rankingData.length > 0 && (
          <div className="section-card">
            <h2 className="section-title">📊 Cadastros por Agente</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="nomeCurto" type="category" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── 👥 Detalhes por Agente ── */}
        <div className="section-card">
          <h2 className="section-title">👥 Detalhes por Agente</h2>
          <div className="space-y-2">
            {rankingData.map((ranking, idx) => {
              const agente = agentes.find(a => a.id === ranking.id);
              if (!agente) return null;
              const items = liderancasPorAgente[agente.id] || [];
              const isOpen = expandedAgente === agente.id;
              const ativasAgente = items.filter(i => i.status === 'Ativa').length;
              const potenciaisAgente = items.filter(i => i.status === 'Potencial').length;
              const descartadasAgente = items.filter(i => i.status === 'Descartada').length;
              const apoiadoresAgente = items.reduce((s, i) => s + (i.apoiadores_estimados || 0), 0);
              const metaVotosAgente = items.reduce((s, i) => s + (i.meta_votos || 0), 0);
              const comCPFAgente = items.filter(i => i.pessoas?.cpf).length;
              const comEleitoralAgente = items.filter(i => i.pessoas?.zona_eleitoral).length;

              return (
                <div key={agente.id} className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedAgente(isOpen ? null : agente.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base w-6 text-center">{getMedalEmoji(idx)}</span>
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{agente.nome.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{agente.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {items.length} cadastro{items.length !== 1 ? 's' : ''}
                          {ranking.ultimo && ` · ${timeSince(ranking.ultimo)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">{items.length}</span>
                      {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/30">
                      {/* Stats detalhados do agente */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'Ativas', value: ativasAgente, color: 'text-emerald-600' },
                          { label: 'Potenciais', value: potenciaisAgente, color: 'text-blue-600' },
                          { label: 'Descartadas', value: descartadasAgente, color: 'text-red-500' },
                          { label: 'Total', value: items.length, color: 'text-foreground' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-card rounded-lg p-2 text-center border border-border">
                            <p className={`text-base font-bold ${color}`}>{value}</p>
                            <p className="text-[9px] text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'Apoiadores', value: apoiadoresAgente },
                          { label: 'Meta votos', value: metaVotosAgente },
                          { label: 'Com CPF', value: comCPFAgente },
                          { label: 'Eleitorais', value: comEleitoralAgente },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-card rounded-lg p-2 text-center border border-border">
                            <p className="text-base font-bold text-foreground">{value}</p>
                            <p className="text-[9px] text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Lista de lideranças detalhada */}
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Nenhum cadastro ainda</p>
                      ) : (
                        <div className="space-y-2">
                          {items.map(item => (
                            <div key={item.id} className="bg-card rounded-xl p-3 border border-border space-y-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-foreground">{item.pessoas?.nome || '—'}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  item.status === 'Ativa' ? 'bg-emerald-500/10 text-emerald-600' :
                                  item.status === 'Potencial' ? 'bg-blue-500/10 text-blue-600' :
                                  item.status === 'Em negociação' ? 'bg-amber-500/10 text-amber-600' :
                                  item.status === 'Fraca' ? 'bg-orange-500/10 text-orange-600' :
                                  'bg-red-500/10 text-red-600'
                                }`}>
                                  {item.status}
                                </span>
                              </div>

                              {/* Dados da pessoa */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                {item.pessoas?.cpf && <span className="flex items-center gap-1"><Hash size={10} /> {item.pessoas.cpf}</span>}
                                {item.pessoas?.telefone && <span className="flex items-center gap-1"><Phone size={10} /> {item.pessoas.telefone}</span>}
                                {item.pessoas?.whatsapp && <span className="flex items-center gap-1">📱 {item.pessoas.whatsapp}</span>}
                                {item.pessoas?.email && <span className="flex items-center gap-1"><Mail size={10} /> {item.pessoas.email}</span>}
                                {item.pessoas?.instagram && <span>📷 {item.pessoas.instagram}</span>}
                              </div>

                              {/* Dados liderança */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                {item.tipo_lideranca && <span className="flex items-center gap-1"><Star size={10} /> {item.tipo_lideranca}</span>}
                                {item.nivel && <span>{item.nivel}</span>}
                                {item.regiao_atuacao && <span className="flex items-center gap-1"><MapPin size={10} /> {item.regiao_atuacao}</span>}
                                {item.nivel_comprometimento && <span>Comp: {item.nivel_comprometimento}</span>}
                              </div>

                              {/* Dados eleitorais */}
                              {(item.pessoas?.zona_eleitoral || item.pessoas?.municipio_eleitoral) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1">
                                  {item.pessoas?.zona_eleitoral && <span>Zona: {item.pessoas.zona_eleitoral}</span>}
                                  {item.pessoas?.secao_eleitoral && <span>Seção: {item.pessoas.secao_eleitoral}</span>}
                                  {item.pessoas?.municipio_eleitoral && <span>{item.pessoas.municipio_eleitoral}</span>}
                                  {item.pessoas?.colegio_eleitoral && <span>🏫 {item.pessoas.colegio_eleitoral}</span>}
                                  {item.pessoas?.situacao_titulo && <span>Título: {item.pessoas.situacao_titulo}</span>}
                                </div>
                              )}

                              {/* Números + data */}
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <div className="flex gap-3">
                                  {(item.apoiadores_estimados || 0) > 0 && <span>👥 {item.apoiadores_estimados} apoiadores</span>}
                                  {(item.meta_votos || 0) > 0 && <span>🎯 {item.meta_votos} meta</span>}
                                </div>
                                <span className="flex items-center gap-1">
                                  <Clock size={10} /> {new Date(item.criado_em).toLocaleDateString('pt-BR')} {new Date(item.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {item.observacoes && (
                                <p className="text-[10px] text-muted-foreground italic border-t border-border pt-1.5">💬 {item.observacoes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>


      </div>
    </div>
  );
}
