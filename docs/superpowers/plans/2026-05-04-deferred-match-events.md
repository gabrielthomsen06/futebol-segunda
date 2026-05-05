# Salvar partida sem gols + editar gols depois — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir ao admin salvar uma partida apenas com os times definidos (no step 1 da Nova rodada) e voltar mais tarde pelo detalhe da partida pra registrar gols/assistências, sem mudanças no banco.

**Architecture:** Reaproveita componentes existentes. Extrai o conteúdo do step 2 do `NewMatch` num componente compartilhado `GoalsForm`, que é consumido tanto pelo `NewMatch` quanto pela nova tela `EditMatchEvents`. Persistência via nova função `updateMatch` no `supabase.jsx`. RLS de UPDATE em `matches` já existente (`matches_admin_update`).

**Tech Stack:** React 18 via CDN + Babel standalone (sem build), Supabase JS, sem framework de testes (validação manual seguindo o precedente do projeto).

---

## File Structure

| Arquivo | Mudança | Responsabilidade |
|---|---|---|
| `supabase.jsx` | Modify | Adicionar `updateMatch(id, patch)` e expor em `window` |
| `screens-edit.jsx` | Modify | Extrair helpers `applyAddGoal`/`applyRemoveGoal` e componente `GoalsForm`. Adicionar segundo botão no step 1 do `NewMatch`. Criar componente novo `EditMatchEvents`. |
| `screens-stats.jsx` | Modify | Adicionar botão "Adicionar/editar gols" em `MatchDetail` (admin-only) |
| `app.jsx` | Modify | Adicionar `updateMatchLocal`, rota `edit-match`, `onEdit` em `MatchDetail` |

---

## Task 1: Adicionar `updateMatch` em `supabase.jsx`

**Files:**
- Modify: `supabase.jsx`

- [ ] **Step 1: Adicionar a função `updateMatch` antes da seção "Conversores"**

Em `supabase.jsx`, depois de `deleteMatch` (linha ~83) e antes do comentário `// ── Conversores`, adicione:

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

- [ ] **Step 2: Expor `updateMatch` em `window`**

Em `supabase.jsx`, no bloco final que expõe funções (depois da linha `window.deleteMatch = deleteMatch;`), adicione:

```js
window.updateMatch = updateMatch;
```

- [ ] **Step 3: Verificar que a função carrega no browser**

Abrir `index.html` (Vercel ou localhost). Abrir DevTools → Console. Rodar:
```js
typeof window.updateMatch
```
Esperado: `"function"`

- [ ] **Step 4: Commit**

```bash
git add supabase.jsx
git commit -m "Add updateMatch helper for partial match updates"
```

---

## Task 2: Extrair helpers `applyAddGoal` e `applyRemoveGoal` em `screens-edit.jsx`

Refatoração pura: a lógica de adicionar/remover gol vira função pura no topo do arquivo, podendo ser reusada em `EditMatchEvents`.

**Files:**
- Modify: `screens-edit.jsx`

- [ ] **Step 1: Adicionar helpers no topo do arquivo**

No início de `screens-edit.jsx`, logo abaixo do comentário inicial e antes de `function NewMatch(...)`, adicione:

```js
function applyAddGoal(teamA, teamB, events, team, pid, assistId) {
  const newEvents = [...events, { type:'goal', player: pid, assist: assistId || null, team }];
  if (team === 'A') {
    return { teamA: { ...teamA, score: teamA.score + 1 }, teamB, events: newEvents };
  }
  return { teamA, teamB: { ...teamB, score: teamB.score + 1 }, events: newEvents };
}

function applyRemoveGoal(teamA, teamB, events, idx) {
  const ev = events[idx];
  if (!ev) return { teamA, teamB, events };
  const newEvents = events.filter((_, i) => i !== idx);
  if (ev.team === 'A') {
    return { teamA: { ...teamA, score: Math.max(0, teamA.score - 1) }, teamB, events: newEvents };
  }
  return { teamA, teamB: { ...teamB, score: Math.max(0, teamB.score - 1) }, events: newEvents };
}
```

- [ ] **Step 2: Substituir `addEvent` e `removeEvent` dentro do `NewMatch` pelos helpers**

Em `screens-edit.jsx`, dentro de `NewMatch`, substituir o bloco existente (linhas ~21-31):

```js
const addEvent = (team, pid, assistId) => {
  setEvents(evs => [...evs, { type:'goal', player: pid, assist: assistId || null, team }]);
  if (team === 'A') setTeamA(t => ({ ...t, score: t.score + 1 }));
  else              setTeamB(t => ({ ...t, score: t.score + 1 }));
};
const removeEvent = (idx) => {
  const ev = events[idx];
  if (ev.team === 'A') setTeamA(t => ({ ...t, score: Math.max(0, t.score - 1) }));
  else                 setTeamB(t => ({ ...t, score: Math.max(0, t.score - 1) }));
  setEvents(evs => evs.filter((_,i) => i !== idx));
};
```

por:

```js
const addEvent = (team, pid, assistId) => {
  const next = applyAddGoal(teamA, teamB, events, team, pid, assistId);
  setTeamA(next.teamA); setTeamB(next.teamB); setEvents(next.events);
};
const removeEvent = (idx) => {
  const next = applyRemoveGoal(teamA, teamB, events, idx);
  setTeamA(next.teamA); setTeamB(next.teamB); setEvents(next.events);
};
```

- [ ] **Step 3: Verificar que o fluxo atual de criar partida ainda funciona**

Recarregar o app. Logado como admin: `Histórico → Nova partida → escolher times → próximo → adicionar gols → remover um gol → salvar`. Confirmar que:
- O placar aumenta ao adicionar gol
- O placar diminui ao remover
- A partida salva com os gols corretos

- [ ] **Step 4: Commit**

```bash
git add screens-edit.jsx
git commit -m "Extract applyAddGoal/applyRemoveGoal pure helpers"
```

---

## Task 3: Extrair componente `GoalsForm`

Move o conteúdo visual do step 2 do `NewMatch` (placar + dois `GoalEditor` + lista de gols) pra um componente reutilizável.

**Files:**
- Modify: `screens-edit.jsx`

- [ ] **Step 1: Adicionar componente `GoalsForm` antes de `function NewMatch(...)`**

Em `screens-edit.jsx`, após os helpers `applyAddGoal`/`applyRemoveGoal` adicionados na Task 2 e antes de `function NewMatch(...)`, adicione:

```jsx
function GoalsForm({ teamA, teamB, events, playerById, onAddEvent, onRemoveEvent }) {
  return (
    <>
      <div className="scoreboard-grid" style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap: 16, marginBottom: 24 }}>
        <ScoreSide team={teamA} side="left"/>
        <div className="score-mobile" style={{
          fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
          fontSize: 56, lineHeight: 1, fontVariantNumeric:'tabular-nums',
          letterSpacing:'var(--head-tracking)', textAlign:'center',
        }}>
          {teamA.score}<span style={{ color:'var(--fg-3)', margin:'0 8px' }}>:</span>{teamB.score}
        </div>
        <ScoreSide team={teamB} side="right"/>
      </div>

      <div className="grid-2">
        <GoalEditor team={teamA} side="A" playerById={playerById}
                    onAddGoal={(pid, aid)=>onAddEvent('A', pid, aid)}/>
        <GoalEditor team={teamB} side="B" playerById={playerById}
                    onAddGoal={(pid, aid)=>onAddEvent('B', pid, aid)}/>
      </div>

      {events.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 10,
          }}>Gols registrados</div>
          <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
            {events.map((ev, i) => {
              const p = playerById[ev.player];
              const a = ev.assist ? playerById[ev.assist] : null;
              if (!p) return null;
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap: 10, padding: '8px 12px',
                  background: 'var(--surface-2)', borderRadius:'var(--radius)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)', minWidth: 30 }}>
                    {ev.team === 'A' ? teamA.name.slice(0,3) : teamB.name.slice(0,3)}
                  </span>
                  <span style={{ fontSize: 14 }}>⚽</span>
                  <span style={{ fontWeight: 500, flex: 1, minWidth: 0,
                                 overflow:'hidden', textOverflow:'ellipsis' }}>
                    {p.name}
                    {a && <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}> ↳ {a.name}</span>}
                  </span>
                  <button onClick={()=>onRemoveEvent(i)} style={{
                    background:'transparent', border:0, color:'var(--fg-3)',
                    cursor:'pointer', padding: 4,
                  }}><Icon.X width="14" height="14"/></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Substituir o conteúdo do step 2 dentro de `NewMatch` por `<GoalsForm>`**

Em `NewMatch`, substituir todo o bloco JSX que começa com `<div className="scoreboard-grid" ...` e vai até o fechamento do `</div>` antes do botão "← Voltar" (linhas ~141-194 originais — agora deslocadas por causa da Task 2) por:

```jsx
<GoalsForm teamA={teamA} teamB={teamB} events={events} playerById={playerById}
           onAddEvent={addEvent} onRemoveEvent={removeEvent}/>
```

O resultado completo do step 2 fica:

```jsx
{!noPlayers && step === 2 && (
  <Card className="card-mobile">
    <GoalsForm teamA={teamA} teamB={teamB} events={events} playerById={playerById}
               onAddEvent={addEvent} onRemoveEvent={removeEvent}/>

    <div className="mobile-row" style={{ marginTop: 24, display:'flex', justifyContent:'space-between', gap: 12 }}>
      <Button variant="ghost" onClick={()=>setStep(1)}>← Voltar</Button>
      <Button variant="accent" onClick={save} disabled={!canSave || saving}>
        {saving ? 'Salvando…' : 'Salvar partida ✓'}
      </Button>
    </div>
  </Card>
)}
```

- [ ] **Step 3: Verificar visualmente**

Recarregar o app. Logado como admin: `Histórico → Nova partida → escolher times → próximo`. Confirmar que o step 2 (placar, dois GoalEditor, lista de gols após adicionar) **aparece exatamente igual ao anterior** — pixel a pixel. Adicionar e remover um gol pra garantir que os handlers ainda funcionam.

- [ ] **Step 4: Commit**

```bash
git add screens-edit.jsx
git commit -m "Extract GoalsForm component for reuse in edit flow"
```

---

## Task 4: Adicionar botão "Salvar só os times" no step 1 do `NewMatch`

**Files:**
- Modify: `screens-edit.jsx`

- [ ] **Step 1: Substituir a barra de ação do step 1**

Em `screens-edit.jsx`, dentro do bloco `step === 1`, substituir a barra de ação atual:

```jsx
<div className="mobile-row" style={{ marginTop: 24, display:'flex', justifyContent:'space-between', alignItems:'center', gap: 12 }}>
  <div style={{ fontSize: 13, color:'var(--fg-2)' }}>
    {allPlayedIds.length} escalados · {state.players.length - allPlayedIds.length} de fora
  </div>
  <Button onClick={()=>setStep(2)} disabled={!canStep2}>
    Próximo: registrar gols →
  </Button>
</div>
```

por:

```jsx
<div className="mobile-row" style={{ marginTop: 24, display:'flex', justifyContent:'space-between', alignItems:'center', gap: 12 }}>
  <div style={{ fontSize: 13, color:'var(--fg-2)' }}>
    {allPlayedIds.length} escalados · {state.players.length - allPlayedIds.length} de fora
  </div>
  <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
    <Button variant="ghost" onClick={save} disabled={!canStep2 || saving}>
      {saving ? 'Salvando…' : 'Salvar só os times'}
    </Button>
    <Button onClick={()=>setStep(2)} disabled={!canStep2 || saving}>
      Próximo: registrar gols →
    </Button>
  </div>
</div>
```

A função `save` já existente em `NewMatch` constrói o objeto a partir do estado atual — com `events: []` no step 1, o que é exatamente o comportamento desejado.

- [ ] **Step 2: Verificar fluxo "salvar só os times"**

Recarregar o app. Logado como admin: `Nova partida → escolher times → "Salvar só os times"`. Confirmar:
- Botão mostra "Salvando…" durante a chamada
- Após salvar, navega pro detalhe da partida (placar 0×0)
- Volta no Histórico → a partida aparece com placar 0×0

- [ ] **Step 3: Verificar fluxo completo (regressão)**

Repetir o cadastro com gols: `Nova partida → times → próximo → adicionar gols → salvar partida`. Confirmar que o fluxo antigo continua funcionando.

- [ ] **Step 4: Commit**

```bash
git add screens-edit.jsx
git commit -m "Add 'Salvar só os times' shortcut to step 1 of NewMatch"
```

---

## Task 5: Criar componente `EditMatchEvents`

**Files:**
- Modify: `screens-edit.jsx`

- [ ] **Step 1: Adicionar componente `EditMatchEvents` após `function NewMatch(...)`**

Em `screens-edit.jsx`, após o fechamento de `function NewMatch(...)` (antes de `function ScoreSide(...)`), adicione:

```jsx
function EditMatchEvents({ match, state, onSave, onCancel }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));

  // Re-deriva score dos events ao montar pra evitar dessincronia se o
  // banco tiver score divergente do número de eventos (defensivo).
  const initialEvents = (match.events || []).map(e => ({...e}));
  const computeScore = (evs, side) => evs.filter(e => e.team === side).length;

  const [teamA, setTeamA] = React.useState({
    ...match.teamA,
    players: [...(match.teamA?.players || [])],
    score: computeScore(initialEvents, 'A'),
  });
  const [teamB, setTeamB] = React.useState({
    ...match.teamB,
    players: [...(match.teamB?.players || [])],
    score: computeScore(initialEvents, 'B'),
  });
  const [events, setEvents] = React.useState(initialEvents);
  const [saving, setSaving] = React.useState(false);

  const addEvent = (team, pid, assistId) => {
    const next = applyAddGoal(teamA, teamB, events, team, pid, assistId);
    setTeamA(next.teamA); setTeamB(next.teamB); setEvents(next.events);
  };
  const removeEvent = (idx) => {
    const next = applyRemoveGoal(teamA, teamB, events, idx);
    setTeamA(next.teamA); setTeamB(next.teamB); setEvents(next.events);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        team_a: { ...teamA, players: [...teamA.players] },
        team_b: { ...teamB, players: [...teamB.players] },
        events: events.map(e => ({ type: e.type, player: e.player, assist: e.assist, team: e.team })),
      });
    } catch (err) {
      // toast já é mostrado pelo updateMatchLocal no app.jsx
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <button onClick={onCancel} style={{
        background:'transparent', border: 0, color:'var(--fg-2)',
        fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
        alignSelf:'flex-start',
      }}>← cancelar</button>

      <h1 className="h1-mobile" style={{
        fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
        textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
        fontSize: 36, margin: 0, lineHeight: 1.1,
      }}>Editar gols</h1>

      <Card className="card-mobile">
        <GoalsForm teamA={teamA} teamB={teamB} events={events} playerById={playerById}
                   onAddEvent={addEvent} onRemoveEvent={removeEvent}/>

        <div className="mobile-row" style={{ marginTop: 24, display:'flex', justifyContent:'space-between', gap: 12 }}>
          <Button variant="ghost" onClick={onCancel}>← Cancelar</Button>
          <Button variant="accent" onClick={save} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar alterações ✓'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Expor `EditMatchEvents` em `window`**

No final de `screens-edit.jsx`, substituir:

```js
Object.assign(window, { NewMatch, Players });
```

por:

```js
Object.assign(window, { NewMatch, EditMatchEvents, Players });
```

- [ ] **Step 3: Verificar que o componente carrega**

Recarregar o app. DevTools → Console:
```js
typeof window.EditMatchEvents
```
Esperado: `"function"`

(Ainda não dá pra abrir a tela porque não tem rota — vem na Task 6.)

- [ ] **Step 4: Commit**

```bash
git add screens-edit.jsx
git commit -m "Add EditMatchEvents component for editing match goals"
```

---

## Task 6: Adicionar `updateMatchLocal` e rota `edit-match` em `app.jsx`

**Files:**
- Modify: `app.jsx`

- [ ] **Step 1: Adicionar `updateMatchLocal` ao lado de `removeMatch`**

Em `app.jsx`, após a função `removeMatch` (linha ~69) e antes de `updatePlayerLocal`, adicione:

```js
const updateMatchLocal = async (id, patch) => {
  try {
    const updated = await updateMatch(id, patch);
    setMatches(arr => arr.map(m => m.id === id ? updated : m));
    return updated;
  } catch (err) {
    showToast('Erro ao atualizar partida: ' + err.message, { tone: 'error' });
    throw err;
  }
};
```

- [ ] **Step 2: Adicionar rota `edit-match` antes do branch `else if (view.name === 'player')`**

Em `app.jsx`, dentro do bloco de roteamento (depois do branch `view.name === 'match'` e antes de `view.name === 'player'`), adicione:

```jsx
} else if (view.name === 'edit-match') {
  if (!auth.isAdmin) {
    content = <AccessDenied onBack={()=>nav('history')}/>;
  } else {
    const match = matches.find(m => m.id === view.matchId);
    if (!match) { setTimeout(()=>nav('history'), 0); content = null; }
    else content = <EditMatchEvents match={match} state={state}
      onSave={async (patch)=>{
        await updateMatchLocal(view.matchId, patch);
        nav('match', { matchId: view.matchId });
      }}
      onCancel={()=>nav('match', { matchId: view.matchId })}/>;
  }
}
```

- [ ] **Step 3: Atualizar `isActive` pra que `edit-match` também marque "Histórico" como ativa**

Em `app.jsx`, substituir a função `isActive` (linhas ~103-106):

```js
const isActive = (id) =>
  view.name === id ||
  (id === 'history' && (view.name === 'match' || view.name === 'new-match')) ||
  (id === 'players' && view.name === 'player');
```

por:

```js
const isActive = (id) =>
  view.name === id ||
  (id === 'history' && (view.name === 'match' || view.name === 'new-match' || view.name === 'edit-match')) ||
  (id === 'players' && view.name === 'player');
```

- [ ] **Step 4: Verificar que o app carrega sem erros**

Recarregar o app. Abrir DevTools → Console. Confirmar que **não há erros de sintaxe** no carregamento. A nova rota só é exercitada na Task 7 (quando o botão pra ela existir), mas se o JSX tiver erro, o app inteiro quebra ao carregar.

- [ ] **Step 5: Commit**

```bash
git add app.jsx
git commit -m "Add edit-match route and updateMatchLocal mutation"
```

---

## Task 7: Adicionar botão "Adicionar/editar gols" em `MatchDetail`

**Files:**
- Modify: `screens-stats.jsx`
- Modify: `app.jsx`

- [ ] **Step 1: Adicionar prop `onEdit` em `MatchDetail` e renderizar botão**

Em `screens-stats.jsx`, substituir a função `MatchDetail` (linhas ~432-452):

```jsx
function MatchDetail({ match, state, onBack, onDelete, isAdmin }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12, flexWrap:'wrap' }}>
        <button onClick={onBack} style={{
          background:'transparent', border: 0, color:'var(--fg-2)',
          fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
        }}>← voltar</button>
        {isAdmin && (
          <Button variant="danger" onClick={()=>{
            if (confirm('Apagar esta partida?')) onDelete(match.id);
          }}>Apagar partida</Button>
        )}
      </div>
      <Card className="card-mobile">
        <MatchScoreboard match={match} playerById={playerById}/>
      </Card>
    </div>
  );
}
```

por:

```jsx
function MatchDetail({ match, state, onBack, onDelete, onEdit, isAdmin }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12, flexWrap:'wrap' }}>
        <button onClick={onBack} style={{
          background:'transparent', border: 0, color:'var(--fg-2)',
          fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
        }}>← voltar</button>
        {isAdmin && (
          <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
            <Button variant="accent" onClick={()=>onEdit(match.id)}>
              Adicionar/editar gols
            </Button>
            <Button variant="danger" onClick={()=>{
              if (confirm('Apagar esta partida?')) onDelete(match.id);
            }}>Apagar partida</Button>
          </div>
        )}
      </div>
      <Card className="card-mobile">
        <MatchScoreboard match={match} playerById={playerById}/>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Passar `onEdit` em `app.jsx` no branch `match`**

Em `app.jsx`, substituir o branch atual:

```jsx
} else if (view.name === 'match') {
  const match = matches.find(m => m.id === view.matchId);
  if (!match) { setTimeout(()=>nav('history'), 0); content = null; }
  else content = <MatchDetail match={match} state={state}
    onBack={()=>nav('history')}
    onDelete={async (id)=>{ await removeMatch(id); nav('history'); }}
    isAdmin={auth.isAdmin}/>;
}
```

por:

```jsx
} else if (view.name === 'match') {
  const match = matches.find(m => m.id === view.matchId);
  if (!match) { setTimeout(()=>nav('history'), 0); content = null; }
  else content = <MatchDetail match={match} state={state}
    onBack={()=>nav('history')}
    onDelete={async (id)=>{ await removeMatch(id); nav('history'); }}
    onEdit={(id)=>nav('edit-match', { matchId: id })}
    isAdmin={auth.isAdmin}/>;
}
```

- [ ] **Step 3: Verificar fluxo end-to-end**

Recarregar o app. Logado como admin:

1. Criar partida só com times (Task 4): `Nova partida → escolher times → "Salvar só os times"`. Confirmar partida 0×0 no histórico.
2. Abrir a partida: clicar no card no histórico. Confirmar que aparecem os botões `Adicionar/editar gols` e `Apagar partida`.
3. Clicar em `Adicionar/editar gols`. Tela `EditMatchEvents` deve aparecer com placar 0×0 e dois `GoalEditor`.
4. Adicionar 2 gols no time A e 1 no time B. Confirmar que o placar atualiza.
5. Clicar em `Salvar alterações ✓`. Voltar pra tela do detalhe — placar agora deve mostrar 2×1.
6. Voltar pro Histórico → a partida agora aparece com 2×1.
7. Reabrir a partida → `Adicionar/editar gols` de novo. Os 3 gols devem aparecer pré-carregados na lista. Remover um deles. Salvar. Conferir que sumiu.

- [ ] **Step 4: Verificar que não-admin não vê os botões**

Logout (ou abrir em janela anônima sem logar). Abrir uma partida pelo histórico. Confirmar que **não aparecem** nem `Adicionar/editar gols` nem `Apagar partida`.

- [ ] **Step 5: Verificar fluxo completo (regressão)**

Logado como admin: `Nova partida → escolher times → próximo → adicionar gols → "Salvar partida ✓"`. Confirmar que esse fluxo antigo ainda funciona ponta a ponta.

- [ ] **Step 6: Commit**

```bash
git add screens-stats.jsx app.jsx
git commit -m "Add 'Adicionar/editar gols' button to MatchDetail"
```

---

## Task 8: Verificação final e merge

- [ ] **Step 1: Conferir visualmente todas as telas afetadas no celular**

Abrir o app em viewport mobile (DevTools → Toggle Device toolbar):
- Step 1 da Nova partida: os dois botões cabem bem ou quebram em duas linhas (`flexWrap: 'wrap'` foi adicionado)
- `MatchDetail` com 3 botões empilha bem em mobile

- [ ] **Step 2: Conferir que estatísticas se atualizam corretamente**

Antes/depois de adicionar gols via `EditMatchEvents`, conferir:
- Página `Rankings`: artilharia/assistência atualizam
- Perfil dos jogadores envolvidos: contadores atualizam

- [ ] **Step 3: Conferir merge na main**

```bash
git log --oneline -10
```
Esperado: ver os commits das tasks 1-7 + spec da fase de design.

Se o trabalho foi feito numa branch separada, abrir PR / merge na main com `git merge`. Caso contrário (trabalho direto na main), só `git push`.

```bash
git push
```

- [ ] **Step 4: Validar em produção**

Após o deploy automático na Vercel, repetir o teste end-to-end (Task 7 step 3) na URL de produção. Conferir que tudo funciona com o banco real.

---

## Resumo de cobertura do spec

| Requisito do spec | Onde é implementado |
|---|---|
| Botão "Salvar só os times" no step 1 | Task 4 |
| `events: []` aceito como partida válida | Implícito (modelo já suporta) — verificado em Task 4 |
| Botão "Adicionar/editar gols" no MatchDetail (admin-only) | Task 7 |
| Tela `EditMatchEvents` reusando step 2 visualmente | Tasks 3 + 5 |
| Pré-carregar eventos existentes ao editar | Task 5 step 1 |
| Re-derivar score dos events (defesa contra dessincronia) | Task 5 step 1 |
| Função `updateMatch(id, patch)` no `supabase.jsx` | Task 1 |
| `updateMatchLocal` em `app.jsx` (espelho de `addMatch`) | Task 6 step 1 |
| Rota `edit-match` com gating de admin | Task 6 step 2 |
| Helpers `applyAddGoal`/`applyRemoveGoal` extraídos | Task 2 |
| Componente `GoalsForm` extraído | Task 3 |
| Sem mudança de schema/RLS (já existe `matches_admin_update`) | Confirmado no spec |
| Não mexe em escalação/data/placar manual (out of scope) | N/A — não implementado |
