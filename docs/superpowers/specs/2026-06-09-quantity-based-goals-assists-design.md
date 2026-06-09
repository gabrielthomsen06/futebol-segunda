# Gols e assistências por quantidade — design

Data: 2026-06-09

## Problema

Hoje, para registrar gols e assistências numa partida, o admin precisa informar
**quem fez o gol e quem deu a assistência daquele gol específico** (ex: "Gol GTA,
assistência Poletti"). Como tudo é anotado numa folha de papel e o vínculo real
gol↔assistência muitas vezes nem é conhecido (as assistências eram atribuídas de
forma aleatória), esse fluxo é trabalhoso e impreciso.

O desejado é simplesmente informar **a quantidade de gols e de assistências de
cada jogador naquela partida**, sem casar uma assistência com um gol.

## Decisão de arquitetura

Manter o array `match.events` (coluna `events` jsonb no Supabase) como
armazenamento, mas gravar gols e assistências como **eventos independentes**:

- Gol → `{ type: 'goal', player, team }`
- Assistência → `{ type: 'assist', player, team }`

Vantagens:

- **Desacopla** gols de assistências (um time pode ter 3 assistências e 2 gols).
- **Sem mudança de esquema** no banco (a coluna `events` é jsonb).
- **Compatível com o histórico:** partidas antigas têm `{type:'goal', player, assist}`
  e continuam contando corretamente, pois a agregação é feita por jogador.

Alternativa descartada: trocar o armazenamento por objetos de contagem
(`match.goals = {playerId: n}`). Mais limpo conceitualmente, mas exigiria migração
de esquema e reescrita de tudo que lê `events`, além de tratar partidas antigas —
mais trabalho e risco sem ganho prático.

## Componentes e fluxo

### 1. Registro/edição (mudança principal) — `screens-edit.jsx`

No passo "Gols" (em `NewMatch`) e na tela de editar partida (`EditMatchEvents`),
substituir o `GoalEditor` (dois dropdowns + botão "adicionar gol") por uma lista
dos jogadores escalados de cada time, cada um com dois contadores `−/+`:

```
COLORIDOS
  GTA        Gols [− 2 +]   Assist [− 1 +]
  Poletti    Gols [− 0 +]   Assist [− 1 +]
Placar do time = soma dos gols
```

- O placar de cada time continua derivado automaticamente da soma dos gols.
- Os contadores geram/removem eventos `goal`/`assist` para manter `match.events`
  como fonte de verdade (N eventos `goal` = N gols do jogador, idem `assist`).
- Assistências são livres: podem exceder o número de gols do time.

### 2. Estatísticas — `data.jsx` (`computeStats`)

- `type:'goal'` → incrementa `goals` em `ev.player`.
- `type:'assist'` → incrementa `assists` em `ev.player`.
- Compatibilidade: continuar tratando `ev.assist` dos eventos antigos
  (gol com assistência embutida) para não quebrar partidas já registradas.

### 3. Exibição — `screens-stats.jsx`

- Detalhe da partida: exibição **por jogador com totais**. Cada time lista seus
  jogadores que pontuaram, ex: `GTA ⚽×2 🅰️×1`. Quem não pontuou não aparece.
- Perfil do jogador (gols/assistências por partida): somar os dois tipos de evento;
  manter compatibilidade com `ev.assist` antigo.

### 4. Placar e validação

- Placar de cada time = quantidade de eventos `goal` daquele time.
- Bloqueio de remover, na edição, jogador que tem gol/assistência na partida
  continua valendo, agora checando os dois tipos de evento.
- Partida "finalizada" = tem ao menos um gol **ou** marcada manualmente como
  finalizada, igual ao comportamento atual.

## Escopo / arquivos afetados

- `screens-edit.jsx` — novo componente de contadores no lugar do `GoalEditor`;
  ajuste de `applyAddGoal`/`applyRemoveGoal` (ou helpers novos) e de `hasEvents`.
- `data.jsx` — `computeStats`.
- `screens-stats.jsx` — `EventRow`/detalhe da partida e contagem no perfil.

Sem mudança em `supabase.jsx` nem no banco.

## Fora de escopo

- Migração dos dados existentes (mantida a compatibilidade de leitura).
- Reestruturação do esquema do banco.
