# Salvar partida sem gols + editar gols depois — Design

**Data:** 2026-05-04
**Projeto:** Futebol de Segunda
**Status:** Aprovado pelo usuário, pronto pra plano de implementação

## Contexto

Hoje o fluxo de "Nova rodada" tem 2 passos obrigatórios em sequência: (1)
escolher times e (2) registrar gols. Não dá pra salvar a partida só com os
times — o botão `Salvar partida ✓` só aparece no step 2.

Na prática, o admin define os times **antes** do jogo começar (pra a galera
ver com quem joga). Os gols só podem ser catalogados **depois** que o jogo
acontece. O fluxo atual obriga esperar o jogo terminar pra criar a partida,
o que é inconveniente.

## Decisões aprovadas durante o brainstorming

| # | Pergunta | Resposta |
|---|---|---|
| 1 | "Time vencedor" é registrado separado do placar? | Não — o placar continua sendo derivado da soma dos gols (cenário A). Sem placar manual. |
| 2 | Abordagem de UI? | Caminho duplo: salvar pode acontecer no step 1 (só times) **ou** no step 2 (com gols). Edição de gols depois é feita pela tela do detalhe da partida. |
| 3 | Mudar escalação depois? | **Fora de escopo.** Edição pós-salvar é só de gols/assistências. Pra mudar escalação, apaga e recria. |
| 4 | Partida 0×0 sem eventos? | Conta como empate normal pros stats — comportamento atual já trata corretamente. |
| 5 | RLS de UPDATE em `matches`? | Já existe (`matches_admin_update` em `docs/supabase-setup.sql:114`). Sem mudanças no banco. |

## Arquitetura

Sem mudanças estruturais. Continua a mesma SPA estática:

- Browser → Supabase via `@supabase/supabase-js`
- Persistência em Postgres com RLS
- Estado da UI via React hooks

Mudanças localizadas em 3 áreas:
1. **`screens-edit.jsx`** — botão extra no step 1 do `NewMatch`, e nova tela
   `EditMatchEvents` que reusa o `GoalEditor` existente
2. **`screens-stats.jsx`** — botão "Adicionar/editar gols" em `MatchDetail`
   pra admin
3. **`supabase.jsx`** — nova função `updateMatch(id, patch)`
4. **`app.jsx`** — nova rota `edit-match` na navegação, com gating de admin

## Mudanças de UI

### 1. Step 1 do "Nova rodada"

Barra de ação inferior do step 1 ganha um segundo botão à esquerda do "Próximo":

```
[Voltar]            [Salvar só os times]   [Próximo: registrar gols →]
                    └─ ghost              └─ accent (existente)
```

- `Salvar só os times` — usa `Button variant="ghost"`. Salva com `events: []`,
  fecha a tela e navega pro detalhe da partida recém-criada (mesmo comportamento
  do save atual).
- `Próximo: registrar gols →` — sem mudança.

Ambos exigem `canStep2` (>=1 jogador em cada time) — regra atual.

### 2. MatchDetail (tela da partida)

A barra superior do `MatchDetail`, hoje com `[← voltar]` e (se admin)
`[Apagar partida]`, ganha um botão a mais pra admin:

```
[← voltar]      [Adicionar/editar gols]   [Apagar partida]
                 └─ accent                 └─ danger (existente)
```

Tocar nele navega pra `edit-match` da partida atual.

### 3. Tela `EditMatchEvents` (nova)

Reaproveita visualmente o step 2 do `NewMatch`:

- Cabeçalho: `← cancelar` + título "Editar gols"
- Placar grande com nomes dos times (componente `ScoreSide` existente)
- Dois `GoalEditor` lado a lado (um por time)
- Lista "Gols registrados" abaixo, com botão remover por evento
- Barra inferior: `[← Cancelar]` (descarta) e `[Salvar alterações ✓]` (accent)

Ao montar:
- Carrega a partida a partir do estado global (`state.matches`)
- Inicializa `events`, `teamA`, `teamB` com cópias dos valores da partida
- O `score` de cada time é re-derivado dos events (defesa contra dessincronização)

Ao salvar:
- Chama `updateMatch(id, { events, team_a, team_b })`
- Atualiza o estado global
- Navega de volta pro detalhe da partida

## Reuso de código

Pra evitar duplicar o step 2 do `NewMatch` na nova tela, extrair o conteúdo
visual do step 2 num componente novo `GoalsForm({ teamA, teamB, events,
playerById, onAddEvent, onRemoveEvent })`. Esse componente:

- Renderiza o placar, os dois `GoalEditor` e a lista de gols registrados
- É **stateless** quanto a estrutura (recebe tudo via props)
- É consumido por `NewMatch` (step 2) e `EditMatchEvents`

Lógica de `addEvent` e `removeEvent` (incrementar/decrementar `score`)
fica em quem usa o componente, mas é a mesma. Pra simplificar, mover esses
helpers pra função utilitária no topo do `screens-edit.jsx`:

```js
function applyAddGoal(teamA, teamB, events, team, pid, assistId) { ... }
function applyRemoveGoal(teamA, teamB, events, idx) { ... }
```

Retorna `{ teamA, teamB, events }` novos. Usado por ambas as telas.

## Mudanças no backend (`supabase.jsx`)

Nova função:

```js
async function updateMatch(id, patch) {
  const { data, error } = await supabaseClient
    .from('matches')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToMatch(data);
}
```

- `patch` é um subset de `{ team_a, team_b, events, date }` (snake_case do
  banco, mesmo padrão usado em `createMatch`)
- Para uso atual, o caller passa `{ team_a, team_b, events }` (não muda data)
- Exposta em `window.updateMatch`

## Mudanças na navegação (`app.jsx`)

Adicionar nova view `edit-match`:

```js
} else if (view.name === 'edit-match') {
  if (!auth.isAdmin) {
    content = <AccessDenied onBack={()=>nav('history')}/>;
  } else {
    const match = matches.find(m => m.id === view.matchId);
    if (!match) { setTimeout(()=>nav('history'), 0); content = null; }
    else content = <EditMatchEvents match={match} state={state}
      onSave={async (patch)=>{ await updateMatchLocal(view.matchId, patch);
                                nav('match', { matchId: view.matchId }); }}
      onCancel={()=>nav('match', { matchId: view.matchId })}/>;
  }
}
```

`updateMatchLocal` é uma função nova no app.jsx (paralela a `addMatch` /
`removeMatch`) que chama `updateMatch` e atualiza o `matches` local.

## O que NÃO muda

- **Modelo de dados:** `events` JSONB já aceita `[]`. `team_a`/`team_b` já
  contêm `score`. Sem migração.
- **RLS:** política `matches_admin_update` já existe.
- **Permissões:** só admin cria, edita, apaga. Não-admin nunca vê os botões.
- **Stats / rankings:** lógica em `data.jsx` já lida com partidas sem eventos.
- **Histórico:** partidas com 0×0 aparecem normais, sem badge especial. Admin
  sabe que pode entrar e adicionar gols.

## Fora de escopo

- **Editar escalação depois de salvar.** Pra adicionar/remover jogadores
  num time já criado, o admin apaga e recria. Justificativa: edição de
  escalação ativa interage de forma complexa com gols já registrados (e se
  o jogador removido marcou um gol?), e o caso de uso é raro.
- **Editar data/nomes/cores dos times depois.** Mesmo motivo: apaga e recria
  é mais barato que projetar uma tela de edição de tudo.
- **Placar manual sem gols.** Regra atual (placar = soma dos gols) preservada.

## Plano de validação

Antes de mergear:

- Cadastrar partida só com times → confirmar que aparece no histórico como 0×0
- Abrir o detalhe da partida → clicar "Adicionar/editar gols" → adicionar
  alguns gols → salvar → conferir placar e estatísticas atualizadas
- Repetir edição: voltar e remover um gol → conferir consistência
- Logar como não-admin → confirmar que botões "Salvar só os times" e
  "Adicionar/editar gols" **continuam aparecendo** apenas pra admin (o primeiro
  fica no fluxo de admin que já é gated; o segundo é gated explicitamente em
  `MatchDetail`)
- Testar erro de rede no save → mensagem de erro aparece, não corrompe estado
