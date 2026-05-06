# Design: Múltiplos Orçamentos Anuais

**Data:** 2026-05-06  
**Status:** Aprovado

## Objetivo

Permitir que a tela de Orçamento suporte múltiplos exercícios anuais (ex: 2026, 2027, ...), com navegação entre eles via sidebar lateral, e ações de criar, copiar e excluir exercícios.

---

## Layout

A seção `#orcamento` passa a usar layout de duas colunas:

- **Coluna esquerda (sidebar ~180px):** lista vertical de exercícios disponíveis, com o ano ativo destacado. Rodapé com botões "Novo", "Copiar" e "Excluir" (este último apenas para admins).
- **Coluna direita:** conteúdo atual da tela (parâmetros mensais + planilha de contas), com título dinâmico "Planejamento Orçamentário — [ANO]".

---

## Lógica de Dados

### Estado ativo
- `ORC_EXERCICIO` (constante hardcoded `2026`) é substituído por variável `orcExercicioAtivo`.
- Inicializado com o menor ano existente no banco (fallback: 2026).

### Lista de exercícios
- Obtida consultando `orcamento_parametros` com `SELECT DISTINCT ano ORDER BY ano`.
- Armazenada em `orcExerciciosDisponiveis` (array de números).

### Troca de exercício
- Ao clicar em um ano na sidebar: limpa `orcParam` e `orcValores`, carrega do banco com o novo `orcExercicioAtivo`, re-renderiza parâmetros e planilha.

### Persistência de exercício vazio
- Como não existe tabela `exercicios`, um exercício "criado em branco" precisa ter ao menos um registro no banco para aparecer na lista.
- Ao criar em branco: insere 12 registros placeholder em `orcamento_parametros` (todos os campos zerados) para os meses 1–12 do novo ano.

---

## Ações

### Novo exercício (criar em branco)
1. `prompt()` solicitando o ano.
2. Validação: inteiro entre 2020 e 2099, não pode já existir em `orcExerciciosDisponiveis`.
3. Insere 12 registros placeholder em `orcamento_parametros` via `upsert`.
4. Atualiza `orcExerciciosDisponiveis`, seleciona o novo ano automaticamente.

### Copiar de outro ano
1. Modal com dois campos: "Origem" (select com anos existentes) e "Destino" (input numérico).
2. Validação do destino: inteiro entre 2020 e 2099.
3. Se o destino já existe: pede confirmação antes de sobrescrever.
4. Copia todos os registros de `orcamento_parametros` e `orcamento_valores` do ano origem, substituindo o campo `ano` pelo destino, e faz `upsert`.
5. Atualiza lista e seleciona o ano destino automaticamente.

### Excluir exercício
- Visível apenas para `appData.currentUser.role === 'admin'`.
- Confirmação: "Excluir orçamento [ANO]? Esta ação não pode ser desfeita."
- Deleta todos os registros do ano em `orcamento_parametros` e `orcamento_valores`.
- Seleciona automaticamente o próximo ano disponível (ou o anterior se não houver próximo).

---

## Arquivos Afetados

- `index.html` — ajuste no HTML da seção `#orcamento` (adicionar sidebar + wrapper de duas colunas)
- `app.js` — módulo de orçamento (~linha 2208 em diante):
  - Trocar `ORC_EXERCICIO` por `orcExercicioAtivo`
  - Adicionar `orcExerciciosDisponiveis`
  - Adicionar funções: `carregarExercicios()`, `trocarExercicio(ano)`, `criarExercicio()`, `copiarExercicio()`, `excluirExercicio()`
  - Adicionar `renderizarSidebarExercicios()`
  - Atualizar `carregarOrcamento()` para chamar `carregarExercicios()` primeiro

---

## Fora de Escopo

- Criação de tabela `exercicios` no banco (não necessário)
- Comparação entre exercícios (relatório ano vs. ano)
- Permissões granulares além de admin/não-admin para excluir
