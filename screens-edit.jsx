// screens-edit.jsx — Nova Partida + Jogadores

// Gols e assistências são eventos independentes: { type:'goal'|'assist', player, team }.
// Partidas antigas têm o gol com assistência embutida ({type:'goal', player, assist}).
// normalizeEvents converte esse formato antigo no novo ao abrir a edição, pra
// toda a tela (e o salvamento) lidarem só com eventos separados.
function normalizeEvents(events) {
  const out = [];
  for (const e of (events || [])) {
    if (e.type === 'goal') {
      out.push({ type: 'goal', player: e.player, team: e.team });
      if (e.assist) out.push({ type: 'assist', player: e.assist, team: e.team });
    } else {
      out.push({ type: e.type, player: e.player, team: e.team });
    }
  }
  return out;
}

// Quantos eventos desse tipo o jogador tem (gols ou assistências na partida).
function countEvents(events, type, pid) {
  return events.filter(e => e.type === type && e.player === pid).length;
}

// Placar de um time = quantidade de eventos de gol daquele lado.
function teamScore(events, side) {
  return events.filter(e => e.type === 'goal' && e.team === side).length;
}

// +1: adiciona um evento. -1: remove o primeiro evento daquele tipo/jogador.
function changeEvent(events, type, side, pid, delta) {
  if (delta > 0) return [...events, { type, player: pid, team: side }];
  const idx = events.findIndex(e => e.type === type && e.player === pid);
  if (idx === -1) return events;
  return events.filter((_, i) => i !== idx);
}

// Jogador tem gol ou assistência registrado nestes eventos?
function hasEvents(events, pid) {
  return events.some(e => e.player === pid || e.assist === pid);
}

function GoalsForm({ teamA, teamB, events, playerById, onChangeEvent }) {
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
        <TeamCounters team={teamA} side="A" events={events} playerById={playerById} onChange={onChangeEvent}/>
        <TeamCounters team={teamB} side="B" events={events} playerById={playerById} onChange={onChangeEvent}/>
      </div>
    </>
  );
}

function NewMatch({ state, onSave, onCancel }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  const [step, setStep] = React.useState(1); // 1: teams, 2: events
  const [date, setDate] = React.useState(new Date().toISOString().slice(0,10));
  const [teamA, setTeamA] = React.useState({ name: 'Coloridos', color: '#e23a3a', players: [], score: 0 });
  const [teamB, setTeamB] = React.useState({ name: 'Brancos', color: '#f4f1ea', players: [], score: 0 });
  const [events, setEvents] = React.useState([]);

  const togglePlayer = (team, pid) => {
    if (team === 'A') {
      setTeamA(t => ({ ...t, players: t.players.includes(pid) ? t.players.filter(x=>x!==pid) : [...t.players, pid] }));
    } else {
      setTeamB(t => ({ ...t, players: t.players.includes(pid) ? t.players.filter(x=>x!==pid) : [...t.players, pid] }));
    }
  };

  const allPlayedIds = [...teamA.players, ...teamB.players];

  const onChangeEvent = (side, type, pid, delta) => {
    const newEvents = changeEvent(events, type, side, pid, delta);
    setEvents(newEvents);
    setTeamA(t => ({ ...t, score: teamScore(newEvents, 'A') }));
    setTeamB(t => ({ ...t, score: teamScore(newEvents, 'B') }));
  };

  const canStep2 = teamA.players.length > 0 && teamB.players.length > 0;
  const canSave = canStep2;
  const [saving, setSaving] = React.useState(false);

  // played=false: "Salvar só os times" (agendada). played=true: salvar com gols.
  const save = async (played) => {
    if (saving) return;
    setSaving(true);
    try {
      const m = {
        date,
        teamA: { ...teamA, players: [...teamA.players] },
        teamB: { ...teamB, players: [...teamB.players] },
        events: events.map(e => ({ type: e.type, player: e.player, team: e.team })),
        played,
      };
      await onSave(m);
    } catch (err) {
      // toast já é mostrado pelo addMatch no app.jsx
    } finally {
      setSaving(false);
    }
  };

  const noPlayers = state.players.length === 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <button onClick={onCancel} style={{
        background:'transparent', border: 0, color:'var(--fg-2)',
        fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
        alignSelf:'flex-start',
      }}>← cancelar</button>

      <div className="mobile-row" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12 }}>
        <h1 className="h1-mobile" style={{
          fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
          textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
          fontSize: 36, margin: 0, lineHeight: 1.1,
        }}>Nova rodada</h1>
        <div style={{ display:'flex', gap: 8 }}>
          {['Times','Gols'].map((label, i) => (
            <div key={label} style={{
              padding: '6px 12px', borderRadius: 999,
              background: step===i+1 ? 'var(--fg)' : 'var(--surface-2)',
              color: step===i+1 ? 'var(--bg)' : 'var(--fg-2)',
              fontSize: 12, fontWeight: 600,
            }}>{i+1}. {label}</div>
          ))}
        </div>
      </div>

      {noPlayers && (
        <Card className="card-mobile">
          <div style={{ textAlign:'center', padding: 20, color:'var(--fg-2)' }}>
            Cadastre jogadores primeiro na aba <b>Jogadores</b>.
          </div>
        </Card>
      )}

      {!noPlayers && step === 1 && (
        <Card className="card-mobile">
          <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 20, flexWrap:'wrap' }}>
            <span style={{ fontSize: 13, color:'var(--fg-2)' }}>Data:</span>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                   style={{
                     padding: '8px 12px', background:'var(--surface-2)',
                     border:'1px solid var(--line)', borderRadius:'var(--radius)',
                     color:'var(--fg)', fontFamily:'var(--font-body)', fontSize: 14,
                   }}/>
          </div>

          <div className="grid-2">
            {[{t: teamA, set: setTeamA, side:'A'}, {t: teamB, set: setTeamB, side:'B'}].map(({t, set, side}) => (
              <div key={side}>
                <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 12 }}>
                  <input type="color" value={t.color} onChange={e=>set(x=>({...x,color:e.target.value}))}
                         style={{ width: 36, height: 38, border:'1px solid var(--line)', borderRadius:6, padding: 0, background:'transparent', flexShrink: 0 }}/>
                  <input value={t.name} onChange={e=>set(x=>({...x,name:e.target.value}))}
                         style={{
                           flex: 1, minWidth: 0, height: 38, padding:'0 12px',
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

          <div className="mobile-row" style={{ marginTop: 24, display:'flex', justifyContent:'space-between', alignItems:'center', gap: 12 }}>
            <div style={{ fontSize: 13, color:'var(--fg-2)' }}>
              {allPlayedIds.length} escalados · {state.players.length - allPlayedIds.length} de fora
            </div>
            <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
              <Button variant="ghost" onClick={()=>save(false)} disabled={!canStep2 || saving}>
                {saving ? 'Salvando…' : 'Salvar só os times'}
              </Button>
              <Button onClick={()=>setStep(2)} disabled={!canStep2 || saving}>
                Próximo: registrar gols →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!noPlayers && step === 2 && (
        <Card className="card-mobile">
          <GoalsForm teamA={teamA} teamB={teamB} events={events} playerById={playerById}
                     onChangeEvent={onChangeEvent}/>

          <div className="mobile-row" style={{ marginTop: 24, display:'flex', justifyContent:'space-between', gap: 12 }}>
            <Button variant="ghost" onClick={()=>setStep(1)}>← Voltar</Button>
            <Button variant="accent" onClick={()=>save(true)} disabled={!canSave || saving}>
              {saving ? 'Salvando…' : 'Salvar partida ✓'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function EditMatchEvents({ match, state, onSave, onCancel }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));

  // Normaliza eventos antigos (gol com assistência embutida) pro formato novo
  // de eventos separados, e re-deriva o score da contagem de gols ao montar
  // (defensivo contra dessincronia entre score salvo e eventos).
  const initialEvents = normalizeEvents(match.events);

  const [date, setDate] = React.useState(match.date);
  const [teamA, setTeamA] = React.useState({
    ...match.teamA,
    players: [...(match.teamA?.players || [])],
    score: teamScore(initialEvents, 'A'),
  });
  const [teamB, setTeamB] = React.useState({
    ...match.teamB,
    players: [...(match.teamB?.players || [])],
    score: teamScore(initialEvents, 'B'),
  });
  const [events, setEvents] = React.useState(initialEvents);
  // Status escolhido quando não há gols. Com gols, played é sempre true.
  const [finished, setFinished] = React.useState(!!match.played);
  const [saving, setSaving] = React.useState(false);

  const onChangeEvent = (side, type, pid, delta) => {
    const newEvents = changeEvent(events, type, side, pid, delta);
    setEvents(newEvents);
    setTeamA(t => ({ ...t, score: teamScore(newEvents, 'A') }));
    setTeamB(t => ({ ...t, score: teamScore(newEvents, 'B') }));
  };

  // Edita escalação. Bloqueia remover quem tem gol/assistência na partida.
  const togglePlayer = (side, pid) => {
    const team = side === 'A' ? teamA : teamB;
    const removing = team.players.includes(pid);
    if (removing && hasEvents(events, pid)) {
      const p = playerById[pid];
      showToast(
        `${p ? p.name : 'Esse jogador'} tem gol ou assistência nesta partida. Remova os gols dele primeiro pra poder tirá-lo do time.`,
        { tone: 'error' }
      );
      return;
    }
    const setTeam = side === 'A' ? setTeamA : setTeamB;
    setTeam(t => ({
      ...t,
      players: removing ? t.players.filter(x=>x!==pid) : [...t.players, pid],
    }));
  };

  const hasGoals = events.length > 0;
  const played = hasGoals ? true : finished;
  const canSave = teamA.players.length > 0 && teamB.players.length > 0;

  const save = async () => {
    if (saving || !canSave) return;
    setSaving(true);
    try {
      await onSave({
        date,
        team_a: { ...teamA, players: [...teamA.players] },
        team_b: { ...teamB, players: [...teamB.players] },
        events: events.map(e => ({ type: e.type, player: e.player, team: e.team })),
        played,
      });
    } catch (err) {
      // toast já é mostrado pelo updateMatchLocal no app.jsx
    } finally {
      setSaving(false);
    }
  };

  const teamHeader = (team) => (
    <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: team.color,
        border: team.color === '#f4f1ea' ? '1px solid var(--line-2)' : 'none',
      }}/>
      <div className="team-name" style={{
        flex: 1, minWidth: 0, fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
        textTransform:'var(--head-transform)', letterSpacing:'var(--head-tracking)',
        fontSize: 18, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>{team.name}</div>
      <Badge>{team.players.length}</Badge>
    </div>
  );

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
      }}>Editar partida</h1>

      {/* Data + escalação */}
      <Card className="card-mobile">
        <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 20, flexWrap:'wrap' }}>
          <span style={{ fontSize: 13, color:'var(--fg-2)' }}>Data:</span>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                 style={{
                   padding: '8px 12px', background:'var(--surface-2)',
                   border:'1px solid var(--line)', borderRadius:'var(--radius)',
                   color:'var(--fg)', fontFamily:'var(--font-body)', fontSize: 14,
                 }}/>
        </div>

        <div className="grid-2">
          {[{ t: teamA, side: 'A' }, { t: teamB, side: 'B' }].map(({ t, side }) => (
            <div key={side}>
              {teamHeader(t)}
              <PlayerPicker players={state.players}
                            selected={t.players}
                            onToggle={(pid)=>togglePlayer(side, pid)}
                            exclude={side==='A' ? teamB.players : teamA.players}/>
            </div>
          ))}
        </div>
      </Card>

      {/* Gols */}
      <Card className="card-mobile">
        <GoalsForm teamA={teamA} teamB={teamB} events={events} playerById={playerById}
                   onChangeEvent={onChangeEvent}/>
      </Card>

      {/* Status — só editável quando não há gols */}
      <Card className="card-mobile">
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 12,
        }}>Status da partida</div>
        {hasGoals ? (
          <div style={{ fontSize: 13, color:'var(--fg-2)' }}>
            Finalizada — tem gols registrados, conta nas estatísticas.
          </div>
        ) : (
          <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
            {[
              { val: false, label: 'Agendada · vai ocorrer em breve' },
              { val: true,  label: 'Finalizada · 0×0' },
            ].map(opt => (
              <button key={String(opt.val)} type="button" onClick={()=>setFinished(opt.val)}
                style={{
                  padding: '8px 14px', borderRadius: 'var(--radius)',
                  border: '1px solid ' + (finished===opt.val ? 'var(--fg)' : 'var(--line-2)'),
                  background: finished===opt.val ? 'var(--fg)' : 'transparent',
                  color: finished===opt.val ? 'var(--bg)' : 'var(--fg)',
                  fontFamily:'var(--font-body)', fontSize: 13, fontWeight: 600, cursor:'pointer',
                }}>{opt.label}</button>
            ))}
          </div>
        )}
      </Card>

      <Card className="card-mobile">
        <div className="mobile-row" style={{ display:'flex', justifyContent:'space-between', gap: 12 }}>
          <Button variant="ghost" onClick={onCancel}>← Cancelar</Button>
          <Button variant="accent" onClick={save} disabled={!canSave || saving}>
            {saving ? 'Salvando…' : 'Salvar alterações ✓'}
          </Button>
        </div>
        {!canSave && (
          <div style={{ marginTop: 10, fontSize: 12, color:'var(--loss)' }}>
            Cada time precisa de pelo menos um jogador.
          </div>
        )}
      </Card>
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
          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
          background: team.color,
          border: team.color === '#f4f1ea' ? '1px solid var(--line-2)' : 'none',
        }}/>
        <div className="team-name" style={{
          fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
          textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
          fontSize: 18, minWidth: 0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{team.name}</div>
      </div>
    </div>
  );
}

// Lista os jogadores escalados do time, cada um com contadores de gols e
// assistências. Substitui a antiga entrada de "quem fez o gol / quem assistiu".
function TeamCounters({ team, side, events, playerById, onChange }) {
  const teamPlayers = team.players.map(pid => playerById[pid]).filter(Boolean);
  return (
    <div>
      <div style={{
        fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
        textTransform:'var(--head-transform)', letterSpacing:'var(--head-tracking)',
        fontSize: 16, marginBottom: 10, display:'flex', alignItems:'center', gap: 8,
      }}>
        <div style={{ width:10, height:10, borderRadius:2, background:team.color, flexShrink: 0,
                      border: team.color==='#f4f1ea' ? '1px solid var(--line-2)':'none' }}/>
        <span style={{ minWidth: 0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {team.name}
        </span>
      </div>
      <div style={{ display:'flex', flexDirection:'column' }}>
        {teamPlayers.length === 0 && (
          <div style={{ fontSize: 13, color:'var(--fg-3)', padding:'8px 0' }}>
            Nenhum jogador escalado.
          </div>
        )}
        {teamPlayers.map(p => (
          <PlayerScoreRow key={p.id} player={p}
            goals={countEvents(events, 'goal', p.id)}
            assists={countEvents(events, 'assist', p.id)}
            onChange={(type, delta) => onChange(side, type, p.id, delta)}/>
        ))}
      </div>
    </div>
  );
}

function PlayerScoreRow({ player, goals, assists, onChange }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: 10, padding:'8px 0',
      borderTop:'1px solid var(--line)',
    }}>
      <Avatar player={player} size={28}/>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: 14,
                     overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {player.name}
      </span>
      <Counter label="Gols" value={goals} onChange={(d)=>onChange('goal', d)}/>
      <Counter label="Assist" value={assists} onChange={(d)=>onChange('assist', d)}/>
    </div>
  );
}

function Counter({ label, value, onChange }) {
  const btn = (disabled) => ({
    width: 28, height: 28, borderRadius: 'var(--radius)',
    border: '1px solid var(--line-2)', background: 'var(--surface-2)',
    color: disabled ? 'var(--fg-3)' : 'var(--fg)',
    fontSize: 16, fontWeight: 600, lineHeight: 1,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    display:'flex', alignItems:'center', justifyContent:'center', padding: 0,
  });
  return (
    <div style={{ textAlign:'center', flexShrink: 0 }}>
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing:'0.06em',
        textTransform:'uppercase', color:'var(--fg-3)', marginBottom: 3,
      }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap: 4 }}>
        <button type="button" onClick={()=>onChange(-1)} disabled={value<=0} style={btn(value<=0)}>−</button>
        <span style={{ minWidth: 18, textAlign:'center', fontWeight: 600,
                       fontVariantNumeric:'tabular-nums' }}>{value}</span>
        <button type="button" onClick={()=>onChange(1)} style={btn(false)}>+</button>
      </div>
    </div>
  );
}

// ── Players Screen ──────────────────────────────────────────────────────────

function Players({ state, stats, onSelectPlayer }) {
  const sorted = [...state.players].sort((a,b) => a.name.localeCompare(b.name));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <div className="mobile-row" style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap: 12 }}>
        <h1 className="h1-mobile" style={{
          fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
          textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
          fontSize: 36, margin: 0, lineHeight: 1.1,
        }}>Jogadores <span style={{ color:'var(--fg-3)' }}>· {state.players.length}</span></h1>
      </div>

      {sorted.length === 0 && (
        <Card className="card-mobile">
          <div style={{ textAlign:'center', padding: 30, color:'var(--fg-2)' }}>
            Ninguém cadastrado ainda. Cada jogador faz o próprio cadastro pelo botão <b>Entrar</b>.
          </div>
        </Card>
      )}

      <div className="grid-3">
        {sorted.map(p => {
          const s = stats[p.id] || {};
          return (
            <Card key={p.id} className="card-mobile" onClick={()=>onSelectPlayer(p.id)}>
              <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
                <Avatar player={p} size={48}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color:'var(--fg-3)' }}>{s.played || 0} jogos</div>
                </div>
              </div>
              <div style={{ display:'flex', gap: 14, marginTop: 14, paddingTop: 14, borderTop:'1px solid var(--line)' }}>
                <MiniStat label="Gols" value={s.goals||0}/>
                <MiniStat label="Ass" value={s.assists||0}/>
                <MiniStat label="V" value={s.wins||0} color="var(--win)"/>
                <MiniStat label="D" value={s.losses||0} color="var(--loss)"/>
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

Object.assign(window, { NewMatch, EditMatchEvents, Players });
