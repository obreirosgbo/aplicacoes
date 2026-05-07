-- ============================================================
-- SCHEMA SQL — Controle Financeiro
-- Banco: PostgreSQL (Supabase)
-- ============================================================

-- Perfis de usuário (extensão do auth.users do Supabase)
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plano de Contas: grupos de tipo RECEITA ou DESPESA
CREATE TABLE IF NOT EXISTS plano_contas (
    id          SERIAL PRIMARY KEY,
    tipo        TEXT NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    descricao   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contas (subcategorias dentro de um grupo do plano de contas)
CREATE TABLE IF NOT EXISTS contas (
    id              SERIAL PRIMARY KEY,
    plano_id        INTEGER NOT NULL REFERENCES plano_contas(id) ON DELETE CASCADE,
    nome            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Descrições de conta (detalhamentos dentro de uma conta)
CREATE TABLE IF NOT EXISTS conta_descricoes (
    id          SERIAL PRIMARY KEY,
    conta_id    INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    descricao   TEXT NOT NULL
);

-- Lançamentos financeiros
CREATE TABLE IF NOT EXISTS lancamentos (
    id              BIGSERIAL PRIMARY KEY,
    tipo            TEXT NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    conta_id        INTEGER REFERENCES contas(id) ON DELETE SET NULL,
    conta_nome      TEXT,                        -- cache do nome para exibição histórica
    data            DATE NOT NULL,
    historico       TEXT NOT NULL,
    descricao       TEXT,
    valor           NUMERIC(15, 2) NOT NULL CHECK (valor > 0),
    nota_fiscal_url TEXT,
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colunas adicionadas após criação inicial
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS nota_fiscal_url TEXT;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS tipificacao TEXT; -- nome da conta (alias de conta_nome usado pelo app)

-- Categorias (legacy — usadas em Eventos/Prestação de Contas)
CREATE TABLE IF NOT EXISTS tipificacoes (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eventos (Prestação de Contas)
CREATE TABLE IF NOT EXISTS eventos (
    id                  BIGSERIAL PRIMARY KEY,
    nome                TEXT NOT NULL,
    tipificacao         TEXT,
    contas_selecionadas TEXT[],                  -- contas associadas ao evento (múltiplas)
    informacoes         TEXT,
    data_criacao        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL
);
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS contas_selecionadas TEXT[];

-- Vínculo entre eventos e lançamentos (N:N)
CREATE TABLE IF NOT EXISTS evento_lancamentos (
    evento_id       BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    lancamento_id   BIGINT NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
    PRIMARY KEY (evento_id, lancamento_id)
);

-- Irmãos (contatos para notificações)
CREATE TABLE IF NOT EXISTS irmaos (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    whatsapp    TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parâmetros mensais do orçamento (obreiros, mensalidades, taxas)
CREATE TABLE IF NOT EXISTS orcamento_parametros (
    id                      BIGSERIAL PRIMARY KEY,
    ano                     INTEGER NOT NULL,
    mes                     INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    obreiros_normal         NUMERIC(10,2) NOT NULL DEFAULT 0,
    obreiros_remido         NUMERIC(10,2) NOT NULL DEFAULT 0,
    obreiros_licenciado     NUMERIC(10,2) NOT NULL DEFAULT 0,
    mensalidade_normal      NUMERIC(15,2) NOT NULL DEFAULT 0,
    mensalidade_remido      NUMERIC(15,2) NOT NULL DEFAULT 0,
    mensalidade_licenciado  NUMERIC(15,2) NOT NULL DEFAULT 0,
    taxa_inadimplencia      NUMERIC(8,6)  NOT NULL DEFAULT 0,
    taxa_gob                NUMERIC(15,2) NOT NULL DEFAULT 0,
    taxa_godf               NUMERIC(15,2) NOT NULL DEFAULT 0,
    UNIQUE (ano, mes)
);

-- Valores orçados por conta, mês e ano
CREATE TABLE IF NOT EXISTS orcamento_valores (
    id          BIGSERIAL PRIMARY KEY,
    ano         INTEGER NOT NULL,
    mes         INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    conta_id    INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    valor       NUMERIC(15,2) NOT NULL DEFAULT 0,
    UNIQUE (ano, mes, conta_id)
);

-- Orçamentos vinculados ao plano de contas (legacy)
CREATE TABLE IF NOT EXISTS orcamentos (
    id          BIGSERIAL PRIMARY KEY,
    plano_id    INTEGER NOT NULL REFERENCES plano_contas(id) ON DELETE CASCADE,
    conta_id    INTEGER REFERENCES contas(id) ON DELETE SET NULL,
    descricao   TEXT,
    valor       NUMERIC(15, 2) NOT NULL CHECK (valor >= 0),
    periodo     TEXT NOT NULL CHECK (periodo IN ('mensal', 'trimestral', 'semestral', 'anual')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de auditoria
CREATE TABLE IF NOT EXISTS historico_auditoria (
    id          BIGSERIAL PRIMARY KEY,
    modulo      TEXT,
    acao        TEXT NOT NULL,
    detalhes    TEXT,
    usuario_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    usuario_nome TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração: adicionar coluna modulo caso a tabela já exista
ALTER TABLE historico_auditoria ADD COLUMN IF NOT EXISTS modulo TEXT;

-- ============================================================
-- FUNÇÕES AUXILIARES (SECURITY DEFINER — evitam recursão RLS)
-- ============================================================

-- Retorna true se o usuário autenticado tem role = 'admin'
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Retorna true se o usuário autenticado tem status = 'approved'
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved'
    );
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_contas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE conta_descricoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipificacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_lancamentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE irmaos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_parametros   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_valores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_auditoria    ENABLE ROW LEVEL SECURITY;

-- Admins têm acesso total
DROP POLICY IF EXISTS "admin_all" ON profiles;
CREATE POLICY "admin_all" ON profiles           USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON plano_contas;
CREATE POLICY "admin_all" ON plano_contas       USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON contas;
CREATE POLICY "admin_all" ON contas             USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON conta_descricoes;
CREATE POLICY "admin_all" ON conta_descricoes   USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON lancamentos;
CREATE POLICY "admin_all" ON lancamentos        USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON tipificacoes;
CREATE POLICY "admin_all" ON tipificacoes       USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON eventos;
CREATE POLICY "admin_all" ON eventos            USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON evento_lancamentos;
CREATE POLICY "admin_all" ON evento_lancamentos USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON irmaos;
CREATE POLICY "admin_all" ON irmaos             USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON orcamentos;
CREATE POLICY "admin_all" ON orcamentos         USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON historico_auditoria;
CREATE POLICY "admin_all" ON historico_auditoria    USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON orcamento_parametros;
CREATE POLICY "admin_all" ON orcamento_parametros   USING (is_admin());
DROP POLICY IF EXISTS "admin_all" ON orcamento_valores;
CREATE POLICY "admin_all" ON orcamento_valores       USING (is_admin());

-- Usuários aprovados podem ler lançamentos, plano de contas e eventos
DROP POLICY IF EXISTS "user_read_lancamentos" ON lancamentos;
CREATE POLICY "user_read_lancamentos"  ON lancamentos   FOR SELECT USING (is_approved());
DROP POLICY IF EXISTS "user_read_plano" ON plano_contas;
CREATE POLICY "user_read_plano"        ON plano_contas  FOR SELECT USING (is_approved());
DROP POLICY IF EXISTS "user_read_contas" ON contas;
CREATE POLICY "user_read_contas"       ON contas        FOR SELECT USING (is_approved());
DROP POLICY IF EXISTS "user_read_eventos" ON eventos;
CREATE POLICY "user_read_eventos"      ON eventos       FOR SELECT USING (is_approved());

-- ============================================================
-- STORAGE — Bucket notas-fiscais
-- Execute no Supabase SQL Editor (dashboard.supabase.com)
-- ============================================================

-- 1. Criar o bucket (público = URLs acessíveis sem autenticação)
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Upload: apenas admins autenticados e aprovados
DROP POLICY IF EXISTS "nf_upload_admin" ON storage.objects;
CREATE POLICY "nf_upload_admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'notas-fiscais'
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
);

-- 3. Leitura pública (necessário para exibir a nota no modal)
DROP POLICY IF EXISTS "nf_read_public" ON storage.objects;
CREATE POLICY "nf_read_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'notas-fiscais');

-- 4. Exclusão: apenas admins
DROP POLICY IF EXISTS "nf_delete_admin" ON storage.objects;
CREATE POLICY "nf_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'notas-fiscais'
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
);

-- 5. Substituição (upsert): apenas admins
DROP POLICY IF EXISTS "nf_update_admin" ON storage.objects;
CREATE POLICY "nf_update_admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'notas-fiscais'
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin' AND p.status = 'approved'
    )
);
