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
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorias (legacy — usadas em Eventos/Prestação de Contas)
CREATE TABLE IF NOT EXISTS tipificacoes (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eventos (Prestação de Contas)
CREATE TABLE IF NOT EXISTS eventos (
    id              BIGSERIAL PRIMARY KEY,
    nome            TEXT NOT NULL,
    tipificacao     TEXT,                        -- referência à tipificação legacy
    informacoes     TEXT,
    data_criacao    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL
);

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

-- Orçamentos vinculados ao plano de contas
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
    acao        TEXT NOT NULL,
    detalhes    TEXT,
    usuario_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    usuario_nome TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_contas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conta_descricoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipificacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE irmaos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_auditoria ENABLE ROW LEVEL SECURITY;

-- Admins têm acesso total
CREATE POLICY "admin_all" ON profiles           USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON plano_contas       USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON contas             USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON conta_descricoes   USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON lancamentos        USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON tipificacoes       USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON eventos            USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON evento_lancamentos USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON irmaos             USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON orcamentos         USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "admin_all" ON historico_auditoria USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Usuários aprovados podem ler lançamentos, plano de contas e eventos
CREATE POLICY "user_read_lancamentos"  ON lancamentos   FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.status = 'approved'));
CREATE POLICY "user_read_plano"        ON plano_contas  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.status = 'approved'));
CREATE POLICY "user_read_contas"       ON contas        FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.status = 'approved'));
CREATE POLICY "user_read_eventos"      ON eventos       FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.status = 'approved'));
