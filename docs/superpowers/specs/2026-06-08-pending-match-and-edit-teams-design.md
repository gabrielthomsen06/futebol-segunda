# Partida agendada ("vai ocorrer em breve") + editar times depois — Design

**Data:** 2026-06-08
**Projeto:** Futebol de Segunda
**Status:** Aprovado pelo usuário (migração já aplicada no Supabase)

## Contexto

O admin cria os times **antes** do jogo pra galera ver com quem joga. Hoje a
partida recém-criada (via "Salvar só os times") aparece como `0 : 0`, o que dá
a entender que o jogo já aconteceu e empatou. O usuário quer:

1. Que uma partida ainda não jogada mostre **"Partida irá ocorrer em breve"** no
   lugar do `0 : 0`.
2. Poder **editar a escalação e a data** de uma partida já criada (hoje só dá
   pra mexer em gols/assistências).

Isso reabre duas decisões que o design de
[deferred-match-events](2026-05-04-deferred-match-events-design.md) tinha deixado
de fora: 0×0 contava como empate normal, e editar escalação era fora de escopo.

## Decisões aprovadas no brainstorming

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | Partida não jogada conta como empate nos stats? | **Não** — é ignorada (sem V/E/D, presença ou gols) até ser finalizada. |
| 2 | Como distinguir "vai rolar" de um 0×0 real? | **Flag explícita** `played` na tabela `matches` + botão "marcar como finalizada". |
| 3 | O que dá pra editar numa partida criada? | **Escalação + data** (gols já dava). Nomes/cores ficam de fora. |
| 4 | Remover jogador da escalação que já tem gol/assist? | **Bloquear e avisar** — pede pra remover os gols dele primeiro. Nada apagado silenciosamente. |

## Modelo de dados

Nova coluna na tabela `matches` (migração já aplicada):

```sql
alter table public.matches add column if not exists played boolean not null default false;
update public.matches set played = true where jsonb_array_length(events) > 0;
```

- `played = false` → partida agendada ("vai ocorrer em breve")
- `played = true` → jogo aconteceu, resultado final (inclusive 0×0 real)
- Backfill: jogos com gols viram `played=true`; partidas 0×0 existentes ficam
  `played=false`.
- RLS: `matches_admin_update` já cobre o update. Sem mudança.

### Semântica de `played`

- "Salvar só os times" (step 1 do NewMatch) → `played = false`.
- Salvar pela etapa de gols (step 2 do NewMatch) → `played = true`.
- Na edição: se há ≥1 gol, `played` é forçado `true`. Se 0 gols, o admin
  escolhe *Agendada* (`false`) ou *Finalizada 0×0* (`true`).

## Mudanças por arquivo

### `supabase.jsx`
- `fetchMatches` inclui `played` no `select`.
- `rowToMatch` mapeia `played: row.played ?? false`.
- `matchToRow` inclui `played: m.played`.

### `data.jsx` (`computeStats`)
- Ignora partidas com `!m.played` (não conta played/wins/draws/losses/goals).
- Denominador de presença (`attendance`) passa a usar só partidas finalizadas.

### `screens-stats.jsx`
- **`MatchScoreboard`**: quando `!match.played`, mantém times/cores visíveis mas
  troca o bloco central `score : score` por um rótulo "Partida irá ocorrer em
  breve" e esconde os badges "V". Vale em compact e full.
- **`Dashboard`** (hero): "rodadas disputadas", total de gols e média/jogo passam
  a contar só partidas finalizadas. A "última rodada" continua sendo a mais
  recente (mostra o aviso se agendada).
- **`MatchDetail`**: botão "Adicionar/editar gols" → **"Editar partida"**.

### `screens-edit.jsx`
- **`NewMatch`**: "Salvar só os times" salva `played:false`; salvar no step 2
  salva `played:true`.
- **`EditMatchEvents` → "Editar partida"**: além de `GoalsForm`, ganha:
  - input de **data**;
  - **`PlayerPicker`** por time pra editar escalação;
  - controle de **status** (Agendada/Finalizada), oculto/forçado `true` quando há gols.
  - Ao remover jogador com gol/assist na partida: **bloqueia** e mostra aviso
    (`alert`/toast) pedindo pra remover os gols dele antes.
  - Save manda `{ team_a, team_b, events, date, played }`.

### `app.jsx`
- Garante que `played` trafega no estado (já vem do `rowToMatch`).
- Rota `edit-match` permanece; só o conteúdo da tela muda.

## Reuso de código

- `GoalsForm`, `PlayerPicker`, `GoalEditor` reaproveitados como estão.
- A checagem "jogador tem gol/assist?" é uma função pura sobre `events`
  (`hasEvents(events, pid)`), usada no toggle de escalação da edição.

## O que NÃO muda

- Placar continua derivado da soma dos gols (sem placar manual).
- Nomes/cores dos times não são editáveis pós-criação.
- Permissões: só admin cria/edita/apaga.

## Fora de escopo

- Editar nomes/cores dos times depois de criar.
- Reabrir uma partida finalizada de volta pra "agendada" via UI dedicada (o
  controle de status na edição já permite, mas não há fluxo especial).

## Plano de validação

- Abrir o dashboard → a rodada agendada (sem gols) mostra "Partida irá ocorrer em
  breve", não conta nos rankings nem no "rodadas disputadas".
- Editar partida agendada → adicionar gols → vira finalizada, conta nos stats.
- Editar partida → trocar data e escalação → salvar → conferir consistência.
- Tentar remover jogador com gol → bloqueio com aviso.
- Marcar 0×0 como finalizada → conta como empate normal.
- Não-admin não vê botões de edição.
