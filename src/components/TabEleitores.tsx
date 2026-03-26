import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, CheckCircle2, Search, ChevronRight, ArrowLeft, Phone, MessageCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCPF, cleanCPF, validateCPF } from '@/lib/cpf';
import { toast } from '@/hooks/use-toast';

const compromissoOptions = ['Confirmado', 'Provável', 'Indefinido', 'Improvável'];

const emptyForm = {
  cpf: '', nome: '', telefone: '', whatsapp: '',
  titulo_eleitor: '', zona_eleitoral: '', secao_eleitoral: '',
  municipio_eleitoral: '', uf_eleitoral: '',
  lideranca_id: '', fiscal_id: '',
  compromisso_voto: 'Indefinido', observacoes: '',
};

interface EleitorRow {
  id: string;
  compromisso_voto: string | null;
  lideranca_id: string | null;
  fiscal_id: string | null;
  cadastrado_por: string | null;
  observacoes: string | null;
  criado_em: string;
  pessoas: {
    nome: string; cpf: string | null; telefone: string | null; whatsapp: string | null;
    zona_eleitoral: string | null; secao_eleitoral: string | null;
  };
}

interface Props {
  refreshKey: number;
  onSaved?: () => void;
}

export default function TabEleitores({ refreshKey, onSaved }: Props) {
  const { usuario, isAdmin } = useAuth();
  const [mode, setMode] = useState<'list' | 'form' | 'detail'>('list');
  const [data, setData] = useState<EleitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<EleitorRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [pessoaExistenteId, setPessoaExistenteId] = useState<string | null>(null);
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'validando' | 'confirmado'>('idle');
  const [cpfNomePessoa, setCpfNomePessoa] = useState('');
  const [validandoCPF, setValidandoCPF] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [liderancas, setLiderancas] = useState<{ id: string; nome: string }[]>([]);
  const [fiscais, setFiscais] = useState<{ id: string; nome: string }[]>([]);
  const cpfTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const update = useCallback((field: string, value: string) => setForm(f => ({ ...f, [field]: value })), []);

  const fetchData = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    const { data: eleitores } = await supabase
      .from('possiveis_eleitores')
      .select('id, compromisso_voto, lideranca_id, fiscal_id, cadastrado_por, observacoes, criado_em, pessoas(nome, cpf, telefone, whatsapp, zona_eleitoral, secao_eleitoral)')
      .order('criado_em', { ascending: false });
    if (eleitores) setData(eleitores as unknown as EleitorRow[]);
    setLoading(false);
  }, [usuario]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  useEffect(() => {
    supabase.from('liderancas').select('id, pessoas(nome)').eq('status', 'Ativa')
      .then(({ data }) => { if (data) setLiderancas(data.map((l: any) => ({ id: l.id, nome: l.pessoas?.nome || '—' }))); });
    supabase.from('fiscais').select('id, pessoas(nome)').eq('status', 'Ativo')
      .then(({ data }) => { if (data) setFiscais(data.map((f: any) => ({ id: f.id, nome: f.pessoas?.nome || '—' }))); });
  }, []);

  const validarCPF = useCallback(async (cpfClean: string) => {
    if (cpfClean.length !== 11 || !validateCPF(cpfClean)) return;
    if (validandoCPF) return;
    setValidandoCPF(true);
    setCpfStatus('validando');
    try {
      const { data: pessoa } = await supabase.from('pessoas').select('*').eq('cpf', cpfClean).maybeSingle();
      if (pessoa) {
        setForm(f => ({ ...f, cpf: pessoa.cpf || cpfClean, nome: pessoa.nome || f.nome, telefone: pessoa.telefone || f.telefone, whatsapp: pessoa.whatsapp || f.whatsapp, titulo_eleitor: pessoa.titulo_eleitor || f.titulo_eleitor, zona_eleitoral: pessoa.zona_eleitoral || f.zona_eleitoral, secao_eleitoral: pessoa.secao_eleitoral || f.secao_eleitoral, municipio_eleitoral: pessoa.municipio_eleitoral || f.municipio_eleitoral, uf_eleitoral: pessoa.uf_eleitoral || f.uf_eleitoral }));
        setPessoaExistenteId(pessoa.id);
        setCpfStatus('confirmado');
        setCpfNomePessoa(pessoa.nome);
      } else { setCpfStatus('idle'); }
    } catch (err) { console.error(err); }
    finally { setValidandoCPF(false); }
  }, [validandoCPF]);

  const handleCPFChange = (value: string) => {
    const cleaned = cleanCPF(value);
    update('cpf', cleaned);
    setCpfStatus('idle');
    setPessoaExistenteId(null);
    if (cpfTimeoutRef.current) clearTimeout(cpfTimeoutRef.current);
    if (cleaned.length === 11) cpfTimeoutRef.current = setTimeout(() => validarCPF(cleaned), 500);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast({ title: 'Preencha o nome', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let pessoaId: string;
      if (pessoaExistenteId) {
        pessoaId = pessoaExistenteId;
      } else {
        const { data: novaPessoa, error } = await supabase.from('pessoas').insert({
          cpf: form.cpf || null, nome: form.nome, telefone: form.telefone || null,
          whatsapp: form.whatsapp || null, titulo_eleitor: form.titulo_eleitor || null,
          zona_eleitoral: form.zona_eleitoral || null, secao_eleitoral: form.secao_eleitoral || null,
          municipio_eleitoral: form.municipio_eleitoral || null, uf_eleitoral: form.uf_eleitoral || null,
        }).select('id').single();
        if (error) throw error;
        pessoaId = novaPessoa!.id;
      }

      const { error } = await supabase.from('possiveis_eleitores').insert({
        pessoa_id: pessoaId,
        cadastrado_por: usuario?.id || null,
        suplente_id: usuario?.suplente_id || null,
        lideranca_id: form.lideranca_id || null,
        fiscal_id: form.fiscal_id || null,
        compromisso_voto: form.compromisso_voto,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;

      toast({ title: '✅ Possível eleitor cadastrado!' });
      setForm({ ...emptyForm });
      setPessoaExistenteId(null);
      setCpfStatus('idle');
      setMode('list');
      fetchData();
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este registro?')) return;
    await supabase.from('possiveis_eleitores').delete().eq('id', id);
    toast({ title: 'Registro excluído' });
    setSelected(null);
    setMode('list');
    fetchData();
  };

  const filtered = data.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (e.pessoas?.nome?.toLowerCase() || '').includes(q);
  });

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";
  const selectCls = inputCls;
  const cpfBorderCls = cpfStatus === 'confirmado' ? 'border-emerald-500 ring-1 ring-emerald-500/30' : '';

  const compromissoBadge = (c: string | null) => {
    const colors: Record<string, string> = {
      'Confirmado': 'bg-emerald-500/10 text-emerald-600',
      'Provável': 'bg-blue-500/10 text-blue-600',
      'Indefinido': 'bg-amber-500/10 text-amber-600',
      'Improvável': 'bg-red-500/10 text-red-600',
    };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[c || ''] || 'bg-muted text-muted-foreground'}`}>{c || 'Indefinido'}</span>;
  };

  // DETAIL VIEW
  if (mode === 'detail' && selected) {
    const e = selected;
    const p = e.pessoas;
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => { setSelected(null); setMode('list'); }} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{p.nome}</h2>
              <p className="text-sm text-muted-foreground">Possível eleitor</p>
            </div>
            {compromissoBadge(e.compromisso_voto)}
          </div>
          <div className="flex gap-2 pt-2">
            {p.telefone && <a href={`tel:${p.telefone}`} className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-lg text-xs font-medium"><Phone size={14} /> Ligar</a>}
            {p.whatsapp && <a href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-medium"><MessageCircle size={14} /> WhatsApp</a>}
          </div>
        </div>
        {e.observacoes && (
          <div className="section-card">
            <p className="text-[11px] text-muted-foreground mb-1">Observações</p>
            <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{e.observacoes}</p>
          </div>
        )}
        {isAdmin && (
          <button onClick={() => handleDelete(e.id)} className="w-full h-11 border border-destructive/30 rounded-xl text-destructive font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
            <Trash2 size={16} /> Excluir
          </button>
        )}
      </div>
    );
  }

  // FORM VIEW
  if (mode === 'form') {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setMode('list')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <h2 className="section-title">👤 Dados do Eleitor</h2>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Nome <span className="text-primary">*</span></label><input type="text" value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="Nome completo" className={inputCls} /></div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">CPF {cpfStatus === 'validando' && <Loader2 size={12} className="animate-spin" />}{cpfStatus === 'confirmado' && <CheckCircle2 size={12} className="text-emerald-500" />}</label>
            <input type="text" inputMode="numeric" value={formatCPF(form.cpf)} onChange={e => handleCPFChange(e.target.value)} placeholder="000.000.000-00" className={`${inputCls} ${cpfBorderCls}`} maxLength={14} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Telefone</label><input type="tel" value={form.telefone} onChange={e => update('telefone', e.target.value)} className={inputCls} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">WhatsApp</label><input type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} className={inputCls} /></div>
          </div>
        </div>
        <div className="section-card">
          <h2 className="section-title">🔗 Vínculo na Cadeia</h2>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Liderança vinculada</label><select value={form.lideranca_id} onChange={e => update('lideranca_id', e.target.value)} className={selectCls}><option value="">Nenhuma</option>{liderancas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Fiscal vinculado</label><select value={form.fiscal_id} onChange={e => update('fiscal_id', e.target.value)} className={selectCls}><option value="">Nenhum</option>{fiscais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Compromisso de voto</label><select value={form.compromisso_voto} onChange={e => update('compromisso_voto', e.target.value)} className={selectCls}>{compromissoOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Observações</label><textarea value={form.observacoes} onChange={e => update('observacoes', e.target.value)} rows={3} className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none" /></div>
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full h-14 gradient-primary text-white text-base font-semibold rounded-2xl shadow-lg shadow-pink-500/25 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={20} className="animate-spin" /> Salvando...</> : '✅ Salvar Eleitor'}
        </button>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-3 pb-24">
      <button onClick={() => setMode('form')} className="w-full h-12 gradient-primary text-white font-semibold rounded-xl active:scale-[0.97] transition-all">
        + Cadastrar Possível Eleitor
      </button>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar eleitor..." className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: data.length },
          { label: 'Confirmados', value: data.filter(e => e.compromisso_voto === 'Confirmado').length },
          { label: 'Prováveis', value: data.filter(e => e.compromisso_voto === 'Provável').length },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-2 text-center">
            <p className="text-lg font-bold text-primary">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</p>
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="section-card animate-pulse"><div className="h-4 bg-muted rounded w-2/3" /></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Nenhum eleitor encontrado</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <button key={e.id} onClick={() => { setSelected(e); setMode('detail'); }} className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm truncate">{e.pessoas?.nome || '—'}</span>
                  {compromissoBadge(e.compromisso_voto)}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {e.pessoas?.zona_eleitoral ? `Z${e.pessoas.zona_eleitoral}` : ''}{e.pessoas?.secao_eleitoral ? ` S${e.pessoas.secao_eleitoral}` : ''}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
