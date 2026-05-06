# Múltiplos Orçamentos Anuais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir múltiplos exercícios orçamentários anuais (ex: 2026, 2027...) com sidebar de navegação, criação em branco, cópia entre anos e exclusão.

**Architecture:** O HTML da seção `#orcamento` ganha layout de duas colunas (sidebar + conteúdo). Em `app.js`, a constante `ORC_EXERCICIO` vira variável `orcExercicioAtivo` e são adicionadas funções de gerenciamento de exercícios. O banco já suporta múltiplos anos via coluna `ano` em `orcamento_parametros` e `orcamento_valores`.

**Tech Stack:** HTML/CSS vanilla, JavaScript ES2020, Supabase JS SDK

---

## Arquivos Afetados

- **Modify:** `index.html` — seção `#orcamento` (linhas ~460–467): adicionar layout de duas colunas e sidebar de exercícios
- **Modify:** `app.js` — módulo de orçamento (linhas ~2208–2450): substituir `ORC_EXERCICIO`, adicionar variáveis e funções de gerenciamento

---

## Task 1: Reestruturar HTML da seção orçamento

**Files:**
- Modify: `index.html` (~linha 460)

- [ ] **Step 1: Substituir o HTML da seção `#orcamento`**

Localizar o bloco atual:
```html
<section id="orcamento" class="page">
    <div class="page-header">
        <h2>Planejamento Orçamentário — Exercício 2026</h2>
        <button class="btn-secondary" onclick="carregarOrcamento()">↻ Recarregar</button>
    </div>
    <div id="orcamento-parametros-container" style="margin-bottom:2rem;"></div>
    <div id="orcamento-planilha-container"></div>
</section>
```

Substituir por:
```html
<section id="orcamento" class="page">
    <div style="display:flex; gap:1.5rem; align-items:flex-start;">

        <!-- Sidebar de exercícios -->
        <div id="orcamento-sidebar" style="min-width:160px; max-width:180px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:1rem; flex-shrink:0;">
            <p style="font-weight:700; font-size:0.85rem; color:#475569; margin-bottom:0.75rem; text-transform:uppercase; letter-spacing:0.05em;">Exercícios</p>
            <div id="orcamento-exercicios-lista" style="display:flex; flex-direction:column; gap:0.25rem; margin-bottom:1rem;"></div>
            <div style="display:flex; flex-direction:column; gap:0.5rem; border-top:1px solid #e2e8f0; padding-top:0.75rem;">
                <button class="btn-secondary" style="font-size:0.8rem; padding:0.35rem 0.6rem;" onclick="criarExercicio()">+ Novo</button>
                <button class="btn-secondary" style="font-size:0.8rem; padding:0.35rem 0.6rem;" onclick="abrirModalCopiarExercicio()">⧉ Copiar</button>
                <button class="btn-danger" id="btn-excluir-exercicio" style="font-size:0.8rem; padding:0.35rem 0.6rem;" onclick="excluirExercicio()">🗑 Excluir</button>
            </div>
        </div>

        <!-- Conteúdo principal -->
        <div style="flex:1; min-width:0;">
            <div class="page-header" style="margin-bottom:1.5rem;">
                <h2 id="orcamento-titulo">Planejamento Orçamentário</h2>
                <button class="btn-secondary" onclick="carregarOrcamento()">↻ Recarregar</button>
            </div>
            <div id="orcamento-parametros-container" style="margin-bottom:2rem;"></div>
            <div id="orcamento-planilha-container"></div>
        </div>

    </div>

    <!-- Modal: Copiar exercício -->
    <div id="modal-copiar-exercicio" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:1000; align-items:center; justify-content:center;">
        <div style="background:white; border-radius:12px; padding:2rem; min-width:340px; box-shadow:0 20px 60px rgba(0,0,0,0.2);">
            <h3 style="margin-bottom:1.25rem;">Copiar Exercício</h3>
            <div style="margin-bottom:1rem;">
                <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.35rem;">Ano de origem</label>
                <select id="copiar-origem" style="width:100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px;"></select>
            </div>
            <div style="margin-bottom:1.5rem;">
                <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:0.35rem;">Ano destino (novo)</label>
                <input type="number" id="copiar-destino" min="2020" max="2099" placeholder="Ex: 2027"
                    style="width:100%; padding:0.5rem; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>
            <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
                <button class="btn-secondary" onclick="fecharModalCopiarExercicio()">Cancelar</button>
                <button class="btn-primary" onclick="confirmarCopiarExercicio()">Copiar</button>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 2: Verificar no browser que a seção exibe sem erros de layout**

Abrir `index.html` no browser, navegar para Orçamento. Deve exibir a sidebar à esquerda e o conteúdo à direita. A lista de exercícios estará vazia até o próximo task.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(orcamento): layout de duas colunas com sidebar de exercícios"
```

---

## Task 2: Converter `ORC_EXERCICIO` para variável e adicionar estado de exercícios

**Files:**
- Modify: `app.js` (~linha 2211)

- [ ] **Step 1: Substituir a constante e adicionar variáveis de estado**

Localizar:
```javascript
const ORC_EXERCICIO = 2026;
const ORC_MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CONTA_MENSALIDADES_ID = 4;
const CONTA_INADIMPLENCIA_ID = 3;

let orcParam = {};
let orcValores = {};
```

Substituir por:
```javascript
let orcExercicioAtivo = 2026;
let orcExerciciosDisponiveis = [];
const ORC_MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CONTA_MENSALIDADES_ID = 4;
const CONTA_INADIMPLENCIA_ID = 3;

let orcParam = {};
let orcValores = {};
```

- [ ] **Step 2: Atualizar `carregarOrcamento()` para usar `orcExercicioAtivo` e chamar `carregarExercicios()`**

Localizar a função `carregarOrcamento()` (linha ~2219) e substituir por:
```javascript
async function carregarOrcamento() {
    const container = document.getElementById('orcamento-planilha-container');
    if (container) container.innerHTML = '<p class="text-muted" style="padding:2rem;">Carregando...</p>';

    await carregarExercicios();

    for (let m = 1; m <= 12; m++) {
        orcParam[m] = { ano: orcExercicioAtivo, mes: m,
            obreiros_normal: 0, obreiros_remido: 0, obreiros_licenciado: 0,
            mensalidade_normal: 0, mensalidade_remido: 0, mensalidade_licenciado: 0,
            taxa_inadimplencia: 0, taxa_gob: 0, taxa_godf: 0 };
    }

    const { data: params, error: ep } = await supabaseClient
        .from('orcamento_parametros').select('*').eq('ano', orcExercicioAtivo);
    if (ep) { console.error('orcamento_parametros:', ep); }
    (params || []).forEach(p => { orcParam[p.mes] = p; });

    const { data: valores, error: ev } = await supabaseClient
        .from('orcamento_valores').select('*').eq('ano', orcExercicioAtivo);
    if (ev) { console.error('orcamento_valores:', ev); }
    orcValores = {};
    (valores || []).forEach(v => { orcValores[`${v.mes}_${v.conta_id}`] = parseFloat(v.valor) || 0; });

    renderizarSidebarExercicios();
    renderizarParametros();
    renderizarPlanilha();
}
```

- [ ] **Step 3: Atualizar `salvarParametro()` para usar `orcExercicioAtivo`**

Localizar dentro de `salvarParametro`:
```javascript
    await supabaseClient.from('orcamento_parametros')
        .upsert({ ...orcParam[mes] }, { onConflict: 'ano,mes' });
```

A função já usa `orcParam[mes]` que contém `ano: orcExercicioAtivo` — sem mudança necessária, mas confirmar que `orcParam[mes].ano` é atribuído corretamente pela linha:
```javascript
    orcParam[mes] = { ...orcParam[mes], [campo]: val };
```
O `ano` é preservado do estado. OK.

- [ ] **Step 4: Atualizar `salvarValorConta()` para usar `orcExercicioAtivo`**

Localizar:
```javascript
    await supabaseClient.from('orcamento_valores')
        .upsert({ ano: ORC_EXERCICIO, mes, conta_id: contaId, valor: val },
```

Substituir por:
```javascript
    await supabaseClient.from('orcamento_valores')
        .upsert({ ano: orcExercicioAtivo, mes, conta_id: contaId, valor: val },
```

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat(orcamento): converter ORC_EXERCICIO em variável orcExercicioAtivo"
```

---

## Task 3: Adicionar `carregarExercicios()` e `renderizarSidebarExercicios()`

**Files:**
- Modify: `app.js` (após as variáveis de estado do módulo de orçamento)

- [ ] **Step 1: Adicionar `carregarExercicios()` logo após as declarações de estado**

Inserir após `let orcValores = {};`:
```javascript
async function carregarExercicios() {
    const { data, error } = await supabaseClient
        .from('orcamento_parametros')
        .select('ano')
        .order('ano', { ascending: true });
    if (error) { console.error('carregarExercicios:', error); return; }
    const anos = [...new Set((data || []).map(r => r.ano))];
    orcExerciciosDisponiveis = anos;
    if (anos.length > 0 && !anos.includes(orcExercicioAtivo)) {
        orcExercicioAtivo = anos[0];
    }
    if (anos.length === 0) {
        orcExercicioAtivo = new Date().getFullYear();
    }
}
```

- [ ] **Step 2: Adicionar `renderizarSidebarExercicios()`**

Inserir logo após `carregarExercicios()`:
```javascript
function renderizarSidebarExercicios() {
    const lista = document.getElementById('orcamento-exercicios-lista');
    const titulo = document.getElementById('orcamento-titulo');
    if (!lista) return;

    lista.innerHTML = orcExerciciosDisponiveis.map(ano => {
        const ativo = ano === orcExercicioAtivo;
        return `<button onclick="trocarExercicio(${ano})" style="
            width:100%; text-align:left; padding:0.4rem 0.6rem;
            border-radius:6px; border:none; cursor:pointer; font-size:0.9rem;
            background:${ativo ? 'var(--color-primary)' : 'transparent'};
            color:${ativo ? 'white' : '#334155'};
            font-weight:${ativo ? '700' : '400'};
        ">${ativo ? '● ' : ''}${ano}</button>`;
    }).join('');

    if (titulo) titulo.textContent = `Planejamento Orçamentário — ${orcExercicioAtivo}`;
}
```

- [ ] **Step 3: Adicionar `trocarExercicio(ano)`**

Inserir logo após `renderizarSidebarExercicios()`:
```javascript
async function trocarExercicio(ano) {
    orcExercicioAtivo = ano;
    orcParam = {};
    orcValores = {};
    const container = document.getElementById('orcamento-planilha-container');
    if (container) container.innerHTML = '<p class="text-muted" style="padding:2rem;">Carregando...</p>';

    for (let m = 1; m <= 12; m++) {
        orcParam[m] = { ano: orcExercicioAtivo, mes: m,
            obreiros_normal: 0, obreiros_remido: 0, obreiros_licenciado: 0,
            mensalidade_normal: 0, mensalidade_remido: 0, mensalidade_licenciado: 0,
            taxa_inadimplencia: 0, taxa_gob: 0, taxa_godf: 0 };
    }

    const { data: params } = await supabaseClient
        .from('orcamento_parametros').select('*').eq('ano', orcExercicioAtivo);
    (params || []).forEach(p => { orcParam[p.mes] = p; });

    const { data: valores } = await supabaseClient
        .from('orcamento_valores').select('*').eq('ano', orcExercicioAtivo);
    orcValores = {};
    (valores || []).forEach(v => { orcValores[`${v.mes}_${v.conta_id}`] = parseFloat(v.valor) || 0; });

    renderizarSidebarExercicios();
    renderizarParametros();
    renderizarPlanilha();
}
```

- [ ] **Step 4: Atualizar `renderizarParametros()` para usar `orcExercicioAtivo`**

Localizar dentro de `renderizarParametros()`:
```javascript
        <p style="font-weight:600; margin-bottom:0.75rem; color:var(--color-primary);">Parâmetros Mensais — ${ORC_EXERCICIO}</p>
```

Substituir por:
```javascript
        <p style="font-weight:600; margin-bottom:0.75rem; color:var(--color-primary);">Parâmetros Mensais — ${orcExercicioAtivo}</p>
```

- [ ] **Step 5: Verificar no browser**

Abrir a tela de Orçamento. A sidebar deve exibir o ano 2026 (se houver dados no banco) ou vazia. Clicar no ano deve recarregar a planilha sem erros no console.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat(orcamento): sidebar de exercícios com carregarExercicios e trocarExercicio"
```

---

## Task 4: Criar exercício em branco (`criarExercicio`)

**Files:**
- Modify: `app.js` (após `trocarExercicio`)

- [ ] **Step 1: Adicionar `criarExercicio()`**

```javascript
async function criarExercicio() {
    const input = prompt('Informe o ano do novo exercício (ex: 2027):');
    if (!input) return;
    const ano = parseInt(input, 10);
    if (isNaN(ano) || ano < 2020 || ano > 2099) {
        alert('Ano inválido. Informe um valor entre 2020 e 2099.');
        return;
    }
    if (orcExerciciosDisponiveis.includes(ano)) {
        alert(`O exercício ${ano} já existe.`);
        return;
    }

    // Insere 12 placeholders para o ano aparecer na lista
    const placeholders = [];
    for (let m = 1; m <= 12; m++) {
        placeholders.push({ ano, mes: m,
            obreiros_normal: 0, obreiros_remido: 0, obreiros_licenciado: 0,
            mensalidade_normal: 0, mensalidade_remido: 0, mensalidade_licenciado: 0,
            taxa_inadimplencia: 0, taxa_gob: 0, taxa_godf: 0 });
    }
    const { error } = await supabaseClient.from('orcamento_parametros')
        .upsert(placeholders, { onConflict: 'ano,mes' });
    if (error) { alert('Erro ao criar exercício: ' + error.message); return; }

    orcExerciciosDisponiveis = [...orcExerciciosDisponiveis, ano].sort((a,b) => a - b);
    await trocarExercicio(ano);
}
```

- [ ] **Step 2: Testar no browser**

Clicar em "+ Novo" na sidebar. Inserir um ano válido (ex: 2027). O exercício deve aparecer na lista e ser selecionado automaticamente com planilha zerada.

Testar casos de erro:
- Ano fora do intervalo (ex: 1900) → alerta "Ano inválido"
- Ano já existente → alerta "já existe"
- Cancelar prompt → nada acontece

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(orcamento): criar exercício em branco"
```

---

## Task 5: Copiar exercício (`copiarExercicio`)

**Files:**
- Modify: `app.js` (após `criarExercicio`)

- [ ] **Step 1: Adicionar funções de abertura/fechamento do modal e confirmação**

```javascript
function abrirModalCopiarExercicio() {
    const sel = document.getElementById('copiar-origem');
    if (!sel) return;
    sel.innerHTML = orcExerciciosDisponiveis
        .map(a => `<option value="${a}">${a}</option>`).join('');
    sel.value = orcExercicioAtivo;
    const inp = document.getElementById('copiar-destino');
    if (inp) inp.value = '';
    const modal = document.getElementById('modal-copiar-exercicio');
    if (modal) modal.style.display = 'flex';
}

function fecharModalCopiarExercicio() {
    const modal = document.getElementById('modal-copiar-exercicio');
    if (modal) modal.style.display = 'none';
}

async function confirmarCopiarExercicio() {
    const origem = parseInt(document.getElementById('copiar-origem').value, 10);
    const destino = parseInt(document.getElementById('copiar-destino').value, 10);

    if (isNaN(destino) || destino < 2020 || destino > 2099) {
        alert('Ano destino inválido. Informe um valor entre 2020 e 2099.');
        return;
    }
    if (destino === origem) {
        alert('O ano destino deve ser diferente do ano de origem.');
        return;
    }
    if (orcExerciciosDisponiveis.includes(destino)) {
        if (!confirm(`O exercício ${destino} já existe. Deseja sobrescrever todos os seus dados?`)) return;
    }

    fecharModalCopiarExercicio();

    // Busca dados de origem
    const { data: params } = await supabaseClient
        .from('orcamento_parametros').select('*').eq('ano', origem);
    const { data: valores } = await supabaseClient
        .from('orcamento_valores').select('*').eq('ano', origem);

    // Copia parâmetros
    if (params && params.length > 0) {
        const novosParams = params.map(({ id, ...rest }) => ({ ...rest, ano: destino }));
        const { error } = await supabaseClient.from('orcamento_parametros')
            .upsert(novosParams, { onConflict: 'ano,mes' });
        if (error) { alert('Erro ao copiar parâmetros: ' + error.message); return; }
    } else {
        // Garante placeholders mesmo sem parâmetros na origem
        const placeholders = [];
        for (let m = 1; m <= 12; m++) {
            placeholders.push({ ano: destino, mes: m,
                obreiros_normal: 0, obreiros_remido: 0, obreiros_licenciado: 0,
                mensalidade_normal: 0, mensalidade_remido: 0, mensalidade_licenciado: 0,
                taxa_inadimplencia: 0, taxa_gob: 0, taxa_godf: 0 });
        }
        await supabaseClient.from('orcamento_parametros')
            .upsert(placeholders, { onConflict: 'ano,mes' });
    }

    // Copia valores das contas
    if (valores && valores.length > 0) {
        const novosValores = valores.map(({ id, ...rest }) => ({ ...rest, ano: destino }));
        const { error } = await supabaseClient.from('orcamento_valores')
            .upsert(novosValores, { onConflict: 'ano,mes,conta_id' });
        if (error) { alert('Erro ao copiar valores: ' + error.message); return; }
    }

    if (!orcExerciciosDisponiveis.includes(destino)) {
        orcExerciciosDisponiveis = [...orcExerciciosDisponiveis, destino].sort((a,b) => a - b);
    }
    await trocarExercicio(destino);
}
```

- [ ] **Step 2: Testar no browser**

Clicar em "⧉ Copiar". O modal deve abrir com o select de origem populado. Informar um destino válido e clicar Copiar. O novo exercício deve aparecer na sidebar com os mesmos dados do ano de origem.

Testar:
- Destino = origem → alerta "deve ser diferente"
- Destino já existe → pede confirmação antes de sobrescrever
- Cancelar modal → nada acontece

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(orcamento): copiar exercício entre anos"
```

---

## Task 6: Excluir exercício (`excluirExercicio`)

**Files:**
- Modify: `app.js` (após `confirmarCopiarExercicio`)

- [ ] **Step 1: Adicionar `excluirExercicio()`**

```javascript
async function excluirExercicio() {
    if (orcExerciciosDisponiveis.length <= 1) {
        alert('Não é possível excluir o único exercício existente.');
        return;
    }
    if (!confirm(`Excluir orçamento ${orcExercicioAtivo}? Esta ação não pode ser desfeita.`)) return;

    const ano = orcExercicioAtivo;

    const { error: ep } = await supabaseClient
        .from('orcamento_parametros').delete().eq('ano', ano);
    if (ep) { alert('Erro ao excluir parâmetros: ' + ep.message); return; }

    const { error: ev } = await supabaseClient
        .from('orcamento_valores').delete().eq('ano', ano);
    if (ev) { alert('Erro ao excluir valores: ' + ev.message); return; }

    orcExerciciosDisponiveis = orcExerciciosDisponiveis.filter(a => a !== ano);
    const proximo = orcExerciciosDisponiveis[0];
    await trocarExercicio(proximo);
}
```

- [ ] **Step 2: Testar no browser**

Com dois ou mais exercícios, clicar "🗑 Excluir" no exercício ativo. Confirmar. O exercício deve desaparecer da lista e o próximo deve ser selecionado automaticamente.

Testar:
- Único exercício → alerta "não é possível excluir"
- Cancelar confirmação → nada acontece

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(orcamento): excluir exercício com confirmação"
```

---

## Task 7: Revisão final e testes de integração

- [ ] **Step 1: Testar fluxo completo**

  1. Abrir Orçamento → exercício 2026 selecionado na sidebar
  2. Criar 2027 em branco → sidebar mostra `2026 | 2027`, 2027 ativo com tudo zerado
  3. Preencher alguns valores em 2027 e verificar que salvam no banco (sem sobrescrever 2026)
  4. Copiar 2027 → 2028 → sidebar mostra `2026 | 2027 | 2028`, valores iguais aos de 2027
  5. Trocar para 2026 → planilha exibe os dados originais de 2026
  6. Excluir 2028 → some da sidebar, volta para próximo exercício disponível

- [ ] **Step 2: Verificar que o dashboard/relatórios não quebraram**

Navegar para Dashboard e Relatórios. As funções `calcMesGrupo` e `orcRecMes` usam `orcParam` e `orcValores` que agora refletem o exercício ativo — isso é esperado. Confirmar que não há erros no console.

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat(orcamento): múltiplos exercícios anuais — implementação completa"
```
