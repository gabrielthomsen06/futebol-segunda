// screens-edit.jsx — Nova Partida + Jogadores

function NewMatch({ state, onSave, onCancel }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  const [step, setStep] = React.useState(1); // 1: teams, 2: events, 3: mvp
  const [date, setDate] = React.useState(new Date().toISOString().slice(0,10));
  const [teamA, setTeamA] = React.useState({ name: 'Coloridos', color: '#e23a3a', players: [], score: 0 });
  const [teamB, setTeamB] = React.useState({ name: 'Brancos', color: '#f4f1ea', players: [], score: 0 });
  const [events, setEvents] = React.useState([]);
  const [mvp, setMvp] = React.useState(null);
  const [flop, setFlop] = React.useState(null);

  const togglePlayer = (team, pid) => {
    if (team === 'A') {
      setTeamA(t => ({ ...t, players: t.players.includes(pid) ? t.players.filter(x=>x!==pid) : [...t.players, pid] }));
    } else {
      setTeamB(t => ({ ...t, players: t.players.includes(pid) ? t.players.filter(x=>x!==pid) : [...t.players, pid] }));
    }
  };

  const allPlayedIds = [...teamA.players, ...teamB.players];

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

  const canStep2 = teamA.players.length > 0 && teamB.players.length > 0;
  const canSave = canStep2;

  const save = () => {
    const m = {
      id: newId('m'), date,
      teamA: { ...teamA, players: [...teamA.players] },
      teamB: { ...teamB, players: [...teamB.players] },
      events: events.map(e => ({ type: e.type, player: e.player, assist: e.assist, team: e.team })),
      mvp, flop,
    };
    onSave(m);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <button onClick={onCancel} style={{
        background:'transparent', border: 0, color:'var(--fg-2)',
        fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
        alignSelf:'flex-start',
      }}>← cancelar</button>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h1 style={{
          fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
          textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
          fontSize: 36, margin: 0, lineHeight: 1.1,
        }}>Nova rodada</h1>
        <div style={{ display:'flex', gap: 8 }}>
          {['Times','Gols','Craque'].map((label, i) => (
            <div key={label} style={{
              padding: '6px 12px', borderRadius: 999,
              background: step===i+1 ? 'var(--fg)' : 'var(--surface-2)',
              color: step===i+1 ? 'var(--bg)' : 'var(--fg-2)',
              fontSize: 12, fontWeight: 600,
            }}>{i+1}. {label}</div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card>
          <div style={{ display:'flex', alignItems:'center', gap: 16, marginBottom: 20 }}>
            <span style={{ fontSize: 13, color:'var(--fg-2)' }}>Data:</span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                   style={{
                     padding: '8px 12px', background:'var(--surface-2)',
                     border:'1px solid var(--line)', borderRadius:'var(--radius)',
                     color:'var(--fg)', fontFamily:'var(--font-body)', fontSize: 14,
                   }}/>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24 }}>
            {[{t: teamA, set: setTeamA, side:'A'}, {t: teamB, set: setTeamB, side:'B'}].map(({t, set, side}) => (
              <div key={side}>
                <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 12 }}>
                  <input type="color" value={t.color} onChange={e=>set(x=>({...x,color:e.target.value}))}
                         style={{ width: 28, height: 28, border:'1px solid var(--line)', borderRadius:6, padding: 0, background:'transparent' }}/>
                  <input value={t.name} onChange={e=>set(x=>({...x,name:e.target.value}))}
                         style={{
                           flex: 1, height: 38, padding:'0 12px',
                           background:'var(--surface-2)', border:'1px solid var(--line)',
                           borderRadius:'var(--radius)', color:'var(--fg)',
                           fontFamily:'var(--font-head)', fontSize: 18, fontWeight:'var(--head-weight)',
                           textTransform:'var(--head-transform)', letterSpacing:'var(--head-tracking)',
                           outline:'none',
                         }}/>
                  <Badge>{t.players.length}</Badge>
                </div>
                <PlayerPicker players={state.players}
                              selected={t.players}
                              onToggle={(pid)=>togglePlayer(side, pid)}
                              exclude={side==='A' ? teamB.players : teamA.players}/>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize: 13, color:'var(--fg-2)' }}>
              {allPlayedIds.length} jogadores escalados · {state.players.length - allPlayedIds.length} de fora
            </div>
            <Button onClick={()=>setStep(2)} disabled={!canStep2}>
              Próximo: registrar gols →
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', gap: 24, marginBottom: 24 }}>
            <ScoreSide team={teamA} side="left"/>
            <div style={{
              fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
              fontSize: 56, lineHeight: 1, fontVariantNumeric:'tabular-nums',
              letterSpacing:'var(--head-tracking)', textAlign:'center',
            }}>
              {teamA.score}<span style={{ color:'var(--fg-3)', margin:'0 8px' }}>:</span>{teamB.score}
            </div>
            <ScoreSide team={teamB} side="right"/>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24 }}>
            <GoalEditor team={teamA} side="A" playerById={playerById}
                        onAddGoal={(pid, aid)=>addEvent('A', pid, aid)}/>
            <GoalEditor team={teamB} side="B" playerById={playerById}
                        onAddGoal={(pid, aid)=>addEvent('B', pid, aid)}/>
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
                      <span style={{ fontWeight: 500, flex: 1 }}>
                        {p.name}
                        {a && <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}> ↳ {a.name}</span>}
                      </span>
                      <button onClick={()=>removeEvent(i)} style={{
                        background:'transparent', border:0, color:'var(--fg-3)',
                        cursor:'pointer', padding: 4,
                      }}><Icon.X width="14" height="14"/></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, display:'flex', justifyContent:'space-between' }}>
            <Button variant="ghost" onClick={()=>setStep(1)}>← Voltar</Button>
            <Button onClick={()=>setStep(3)}>Próximo: Craque/Pior →</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24 }}>
            <div>
              <SectionTitle>⭐ Craque da partida</SectionTitle>
              <PlayerSinglePicker players={state.players.filter(p=>allPlayedIds.includes(p.id))}
                                  selected={mvp} onSelect={setMvp}/>
            </div>
            <div>
              <SectionTitle>💀 Pior da partida</SectionTitle>
              <PlayerSinglePicker players={state.players.filter(p=>allPlayedIds.includes(p.id))}
                                  selected={flop} onSelect={setFlop}/>
            </div>
          </div>

          <div style={{ marginTop: 24, display:'flex', justifyContent:'space-between' }}>
            <Button variant="ghost" onClick={()=>setStep(2)}>← Voltar</Button>
            <Button variant="accent" onClick={save} disabled={!canSave}>
              Salvar partida ✓
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ScoreSide({ team, side }) {
  return (
    <div style={{ textAlign: side==='left' ? 'right' : 'left' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 10,
                    flexDirection: side==='left' ? 'row-reverse':'row',
                    justifyContent: side==='left' ? 'flex-start':'flex-start' }}>
        <div style={{
          width: 14, height: 14, borderRadius: 3,
          background: team.color,
          border: team.color === '#f4f1ea' ? '1px solid var(--line-2)' : 'none',
        }}/>
        <div style={{
          fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
          textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
          fontSize: 18,
        }}>{team.name}</div>
      </div>
    </div>
  );
}

function GoalEditor({ team, side, playerById, onAddGoal }) {
  const [scorer, setScorer] = React.useState('');
  const [assister, setAssister] = React.useState('');
  const teamPlayers = team.players.map(pid => playerById[pid]).filter(Boolean);
  const submit = () => {
    if (!scorer) return;
    onAddGoal(scorer, assister || null);
    setScorer(''); setAssister('');
  };
  const selectStyle = {
    width:'100%', height: 38, padding:'0 12px',
    background:'var(--surface-2)', border:'1px solid var(--line)',
    borderRadius:'var(--radius)', color:'var(--fg)',
    fontFamily:'var(--font-body)', fontSize: 14, outline:'none',
  };
  return (
    <div>
      <div style={{
        fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
        textTransform:'var(--head-transform)', letterSpacing:'var(--head-tracking)',
        fontSize: 16, marginBottom: 10, display:'flex', alignItems:'center', gap: 8,
      }}>
        <div style={{ width:10, height:10, borderRadius:2, background:team.color,
                      border: team.color==='#f4f1ea' ? '1px solid var(--line-2)':'none' }}/>
        Gol do {team.name}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
        <select value={scorer} onChange={e=>setScorer(e.target.value)} style={selectStyle}>
          <option value="">Quem fez o gol?</option>
          {teamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={assister} onChange={e=>setAssister(e.target.value)} style={selectStyle}>
          <option value="">Sem assistência</option>
          {teamPlayers.filter(p=>p.id!==scorer).map(p => <option key={p.id} value={p.id}>↳ {p.name}</option>)}
        </select>
        <Button variant="ghost" onClick={submit} disabled={!scorer}>
          <Icon.Plus width="14" height="14"/> Adicionar gol
        </Button>
      </div>
    </div>
  );
}

function PlayerSinglePicker({ players, selected, onSelect }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6 }}>
      {players.map(p => {
        const on = selected === p.id;
        return (
          <button key={p.id} type="button" onClick={()=>onSelect(on ? null : p.id)}
                  style={{
                    display:'flex', alignItems:'center', gap: 10,
                    padding: '8px 10px', borderRadius: 'var(--radius)',
                    border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                    background: on ? 'rgba(245,208,74,0.18)' : 'var(--surface-2)',
                    color: 'var(--fg)', fontFamily: 'var(--font-body)',
                    fontSize: 13, cursor: 'pointer', textAlign:'left',
                  }}>
            <Avatar player={p} size={26}/>
            <span style={{ flex: 1 }}>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Players Screen ──────────────────────────────────────────────────────────

function Players({ state, stats, onSelectPlayer, onAddPlayer }) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const sorted = [...state.players].sort((a,b) => a.name.localeCompare(b.name));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <h1 style={{
          fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
          textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
          fontSize: 36, margin: 0, lineHeight: 1.1,
        }}>Jogadores <span style={{ color:'var(--fg-3)' }}>· {state.players.length}</span></h1>
        <Button variant="accent" onClick={()=>setAdding(a=>!a)}>
          <Icon.Plus width="16" height="16"/> Adicionar
        </Button>
      </div>

      {adding && (
        <Card>
          <div style={{ display:'flex', gap: 10 }}>
            <input value={name} onChange={e=>setName(e.target.value)}
                   placeholder="Nome do jogador (ex: Ronaldinho)"
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && name.trim()) {
                       onAddPlayer(name.trim()); setName(''); setAdding(false);
                     }
                   }}
                   autoFocus
                   style={{
                     flex: 1, height: 38, padding:'0 12px',
                     background:'var(--surface-2)', border:'1px solid var(--line)',
                     borderRadius:'var(--radius)', color:'var(--fg)',
                     fontFamily:'var(--font-body)', fontSize: 14, outline:'none',
                   }}/>
            <Button onClick={()=>{ if (name.trim()) { onAddPlayer(name.trim()); setName(''); setAdding(false); } }}>
              Adicionar
            </Button>
            <Button variant="ghost" onClick={()=>{ setAdding(false); setName(''); }}>Cancelar</Button>
          </div>
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 16 }}>
        {sorted.map(p => {
          const s = stats[p.id] || {};
          return (
            <Card key={p.id} onClick={()=>onSelectPlayer(p.id)}>
              <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
                <Avatar player={p} size={48}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color:'var(--fg-3)' }}>{s.played || 0} jogos · {s.points || 0} pts</div>
                </div>
              </div>
              <div style={{ display:'flex', gap: 14, marginTop: 14, paddingTop: 14, borderTop:'1px solid var(--line)' }}>
                <MiniStat label="Gols" value={s.goals||0}/>
                <MiniStat label="Ass" value={s.assists||0}/>
                <MiniStat label="V" value={s.wins||0} color="var(--win)"/>
                <MiniStat label="★" value={s.mvps||0} color="var(--accent)"/>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600,
        color: color || 'var(--fg)', marginTop: 2,
      }}>{value}</div>
    </div>
  );
}

Object.assign(window, { NewMatch, Players });
