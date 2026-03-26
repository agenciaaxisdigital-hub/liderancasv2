
-- =============================================
-- FASE 1: MIGRAÇÃO COMPLETA - HIERARQUIA DE USUÁRIOS
-- =============================================

-- 1. Criar tabela suplentes (do Projeto A)
CREATE TABLE IF NOT EXISTS public.suplentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  partido VARCHAR(50),
  cargo_disputado VARCHAR(100),
  regiao_atuacao TEXT,
  base_politica TEXT,
  ano_eleicao INTEGER,
  expectativa_votos INTEGER,
  total_votos INTEGER,
  retirada_mensal_valor NUMERIC,
  retirada_mensal_meses INTEGER,
  plotagem_qtd INTEGER,
  plotagem_valor_unit NUMERIC,
  liderancas_qtd INTEGER,
  liderancas_valor_unit NUMERIC,
  fiscais_qtd INTEGER,
  fiscais_valor_unit NUMERIC,
  total_campanha NUMERIC,
  assinatura TEXT,
  situacao VARCHAR(30) DEFAULT 'Em negociação',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suplentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem suplentes" ON public.suplentes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin insere suplentes" ON public.suplentes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin atualiza suplentes" ON public.suplentes
  FOR UPDATE TO authenticated USING (true);

-- 2. Criar ENUM tipo_usuario
DO $$ BEGIN
  CREATE TYPE public.tipo_usuario AS ENUM (
    'super_admin', 'coordenador', 'suplente', 'lideranca', 'fiscal'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Criar tabela hierarquia_usuarios
CREATE TABLE IF NOT EXISTS public.hierarquia_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  tipo public.tipo_usuario NOT NULL,
  superior_id UUID REFERENCES public.hierarquia_usuarios(id),
  suplente_id UUID REFERENCES public.suplentes(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hierarquia_usuarios ENABLE ROW LEVEL SECURITY;

-- 4. Adicionar campos faltantes na tabela pessoas
ALTER TABLE public.pessoas 
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS origem VARCHAR(50),
  ADD COLUMN IF NOT EXISTS observacoes_gerais TEXT,
  ADD COLUMN IF NOT EXISTS outras_redes TEXT;

-- 5. Dropar liderancas antiga (sem dados) e recriar com novas FKs
DROP TABLE IF EXISTS public.liderancas CASCADE;

CREATE TABLE public.liderancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  cadastrado_por UUID REFERENCES public.hierarquia_usuarios(id),
  suplente_id UUID REFERENCES public.suplentes(id),
  tipo_lideranca VARCHAR(50),
  nivel VARCHAR(30),
  regiao_atuacao TEXT,
  zona_atuacao VARCHAR(10),
  bairros_influencia TEXT,
  comunidades_influencia TEXT,
  lider_principal_id UUID REFERENCES public.liderancas(id),
  origem_captacao VARCHAR(50),
  apoiadores_estimados INTEGER,
  meta_votos INTEGER,
  status VARCHAR(30) DEFAULT 'Ativa',
  nivel_comprometimento VARCHAR(20),
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.liderancas ENABLE ROW LEVEL SECURITY;

-- 6. Criar tabela fiscais
CREATE TABLE public.fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  cadastrado_por UUID REFERENCES public.hierarquia_usuarios(id),
  suplente_id UUID REFERENCES public.suplentes(id),
  lideranca_id UUID REFERENCES public.liderancas(id),
  colegio_eleitoral VARCHAR(255),
  zona_fiscal VARCHAR(10),
  secao_fiscal VARCHAR(10),
  status VARCHAR(30) DEFAULT 'Ativo',
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.fiscais ENABLE ROW LEVEL SECURITY;

-- 7. Criar tabela possiveis_eleitores
CREATE TABLE public.possiveis_eleitores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  cadastrado_por UUID REFERENCES public.hierarquia_usuarios(id),
  suplente_id UUID REFERENCES public.suplentes(id),
  lideranca_id UUID REFERENCES public.liderancas(id),
  fiscal_id UUID REFERENCES public.fiscais(id),
  compromisso_voto VARCHAR(30) DEFAULT 'Indefinido',
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.possiveis_eleitores ENABLE ROW LEVEL SECURITY;

-- 8. Criar funções RLS para hierarquia

-- Função recursiva que retorna todos os IDs subordinados
CREATE OR REPLACE FUNCTION public.get_subordinados(usuario_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE sub AS (
    SELECT id FROM hierarquia_usuarios WHERE superior_id = usuario_id
    UNION ALL
    SELECT h.id FROM hierarquia_usuarios h
    INNER JOIN sub s ON h.superior_id = s.id
  )
  SELECT id FROM sub;
$$;

-- Pegar o hierarquia_usuarios.id do usuário logado
CREATE OR REPLACE FUNCTION public.get_meu_usuario_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM hierarquia_usuarios
  WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Checar se é super_admin
CREATE OR REPLACE FUNCTION public.eh_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM hierarquia_usuarios
    WHERE auth_user_id = auth.uid() AND tipo = 'super_admin'
  );
$$;

-- Pegar o tipo do usuário logado
CREATE OR REPLACE FUNCTION public.get_meu_tipo()
RETURNS public.tipo_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tipo FROM hierarquia_usuarios
  WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Pegar o suplente_id do usuário logado (ou do superior suplente)
CREATE OR REPLACE FUNCTION public.get_meu_suplente_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE cadeia AS (
    SELECT id, tipo, suplente_id, superior_id 
    FROM hierarquia_usuarios WHERE auth_user_id = auth.uid()
    UNION ALL
    SELECT h.id, h.tipo, h.suplente_id, h.superior_id
    FROM hierarquia_usuarios h
    INNER JOIN cadeia c ON h.id = c.superior_id
    WHERE c.suplente_id IS NULL
  )
  SELECT suplente_id FROM cadeia WHERE suplente_id IS NOT NULL LIMIT 1;
$$;

-- 9. Criar RLS Policies para hierarquia_usuarios
CREATE POLICY "Admin ve todos usuarios" ON public.hierarquia_usuarios
  FOR SELECT TO authenticated USING (
    eh_super_admin() OR id = get_meu_usuario_id() OR id IN (SELECT get_subordinados(get_meu_usuario_id()))
  );

CREATE POLICY "Admin insere usuarios" ON public.hierarquia_usuarios
  FOR INSERT TO authenticated WITH CHECK (eh_super_admin());

CREATE POLICY "Admin atualiza usuarios" ON public.hierarquia_usuarios
  FOR UPDATE TO authenticated USING (
    eh_super_admin() OR id = get_meu_usuario_id()
  );

CREATE POLICY "Admin deleta usuarios" ON public.hierarquia_usuarios
  FOR DELETE TO authenticated USING (eh_super_admin());

-- 10. RLS Policies para liderancas (hierarquia)
CREATE POLICY "Ver liderancas hierarquia" ON public.liderancas
  FOR SELECT TO authenticated USING (
    eh_super_admin()
    OR cadastrado_por = get_meu_usuario_id()
    OR cadastrado_por IN (SELECT get_subordinados(get_meu_usuario_id()))
  );

CREATE POLICY "Inserir liderancas" ON public.liderancas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Atualizar liderancas" ON public.liderancas
  FOR UPDATE TO authenticated USING (
    eh_super_admin()
    OR cadastrado_por = get_meu_usuario_id()
    OR cadastrado_por IN (SELECT get_subordinados(get_meu_usuario_id()))
  );

CREATE POLICY "Admin deleta liderancas" ON public.liderancas
  FOR DELETE TO authenticated USING (eh_super_admin());

-- 11. RLS Policies para fiscais
CREATE POLICY "Ver fiscais" ON public.fiscais
  FOR SELECT TO authenticated USING (
    eh_super_admin()
    OR cadastrado_por = get_meu_usuario_id()
    OR cadastrado_por IN (SELECT get_subordinados(get_meu_usuario_id()))
  );

CREATE POLICY "Inserir fiscais" ON public.fiscais
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Atualizar fiscais" ON public.fiscais
  FOR UPDATE TO authenticated USING (
    eh_super_admin()
    OR cadastrado_por = get_meu_usuario_id()
  );

CREATE POLICY "Admin deleta fiscais" ON public.fiscais
  FOR DELETE TO authenticated USING (eh_super_admin());

-- 12. RLS Policies para possiveis_eleitores
CREATE POLICY "Ver eleitores" ON public.possiveis_eleitores
  FOR SELECT TO authenticated USING (
    eh_super_admin()
    OR cadastrado_por = get_meu_usuario_id()
    OR cadastrado_por IN (SELECT get_subordinados(get_meu_usuario_id()))
  );

CREATE POLICY "Inserir eleitores" ON public.possiveis_eleitores
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Atualizar eleitores" ON public.possiveis_eleitores
  FOR UPDATE TO authenticated USING (
    eh_super_admin()
    OR cadastrado_por = get_meu_usuario_id()
  );

CREATE POLICY "Admin deleta eleitores" ON public.possiveis_eleitores
  FOR DELETE TO authenticated USING (eh_super_admin());
