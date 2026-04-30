// screens-stats.jsx — Dashboard, Rankings, Histórico, Perfil

function Dashboard({ state, stats, onNavigate, onSelectPlayer, onSelectMatch }) {
  const players = state.players;
  const playerById = Object.fromEntries(players.map(p => [p.id, p]));
  const matches = state.matches;
  const lastMatch = matches[matches.length - 1];
  const totalGoals = matches.reduce((s,m)=>s+m.teamA.score+m.teamB.score,0);
  const avgGoals = matches.length ? (totalGoals/matches.length).toFixed(1) : '0';

  const sortedByPts = Object.values(stats).sort((a,b)=>b.points-a.points).slice(0,5);
  const sortedByGoals = Object.values(stats).sort((a,b)=>b.goals-a.goals).slice(0,5);
  const sortedByAssists = Object.values(stats).sort((a,b)=>b.assists-a.assists).slice(0,5);
  const sortedByWins = Object.values(stats).sort((a,b)=>b.wins-a.wins).slice(0,5);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      {/* Hero */}
      <Card style={{ padding: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 8,
            }}>Temporada 2026</div>
            <h1 style={{
              fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
              textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
              fontSize: 48, margin: 0, lineHeight: 1.05, whiteSpace: 'nowrap',
            }}>Futebol de Segunda</h1>
            <div style={{ marginTop: 10, color: 'var(--fg-2)', fontSize: 14 }}>
              {matches.length} {matches.length === 1 ? 'rodada disputada' : 'rodadas disputadas'} · {players.length} jogadores ativos
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
            paddingTop: 22, borderTop: '1px solid var(--line)',
          }}>
            <Stat label="Rodadas" value={matches.length} />
            <Stat label="Gols" value={totalGoals} />
            <Stat label="Média/jogo" value={avgGoals} />
            <Stat label="Jogadores" value={players.length} />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Bola de Ouro */}
        <Card>
          <SectionTitle action={
            <button onClick={()=>onNavigate('rankings')} style={linkBtn}>ver tudo →</button>
          }>🏆 Bola de Ouro</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap: 0 }}>
            {sortedByPts.map((s, i) => (
              <RankRow key={s.id} idx={i} player={playerById[s.id]} value={s.points} unit="pts"
                       onClick={()=>onSelectPlayer(s.id)} highlight={i===0}/>
            ))}
          </div>
        </Card>

        {/* Última partida */}
        {lastMatch && (
          <Card>
            <SectionTitle action={
              <button onClick={()=>onNavigate('history')} style={linkBtn}>histórico →</button>
            }>Última rodada</SectionTitle>
            <button onClick={()=>onSelectMatch(lastMatch.id)} style={{
              all:'unset', cursor:'pointer', display:'block', width:'100%',
            }}>
              <MatchScoreboard match={lastMatch} playerById={playerById} compact />
            </button>
          </Card>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        <MiniLeaderboard title="Artilharia" data={sortedByGoals} unit="gols"
                         keyName="goals" playerById={playerById}
                         onSelectPlayer={onSelectPlayer}/>
        <MiniLeaderboard title="Assistências" data={sortedByAssists} unit="ass."
                         keyName="assists" playerById={playerById}
                         onSelectPlayer={onSelectPlayer}/>
        <MiniLeaderboard title="Vitórias" data={sortedByWins} unit="V"
                         keyName="wins" playerById={playerById}
                         onSelectPlayer={onSelectPlayer}/>
      </div>
    </div>
  );
}

const linkBtn = {
  background: 'transparent', border: 0, color: 'var(--fg-2)',
  fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer', padding: 0,
};

function RankRow({ idx, player, value, unit, onClick, highlight }) {
  if (!player) return null;
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap: 12,
      padding: '10px 0', cursor: onClick ? 'pointer':'default',
      borderBottom: '1px solid var(--line)',
    }}>
      <div style={{
        width: 22, textAlign: 'center', fontFamily: 'var(--font-mono)',
        fontSize: 13, color: highlight ? 'var(--accent)' : 'var(--fg-3)',
        fontWeight: 600,
      }}>{idx + 1}</div>
      <Avatar player={player} size={30}/>
      <div style={{ flex: 1, fontWeight: 500 }}>{player.name}</div>
      <div style={{
        fontFamily:'var(--font-mono)', fontSize: 14, fontWeight: 600,
        color: 'var(--fg)', fontVariantNumeric:'tabular-nums',
      }}>{value} <span style={{ color:'var(--fg-3)', fontSize:11, fontWeight:500 }}>{unit}</span></div>
    </div>
  );
}

function MiniLeaderboard({ title, data, unit, keyName, playerById, onSelectPlayer }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <div>
        {data.map((s, i) => (
          <RankRow key={s.id} idx={i} player={playerById[s.id]}
                   value={s[keyName]} unit={unit} highlight={i===0}
                   onClick={()=>onSelectPlayer(s.id)}/>
        ))}
      </div>
    </Card>
  );
}

function MatchScoreboard({ match, playerById, compact = false }) {
  const winA = match.teamA.score > match.teamB.score;
  const winB = match.teamB.score > match.teamA.score;
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 14,
      }}>{fmtDateLong(match.date)}</div>

      <div style={{
        display:'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems:'center', gap: 20,
      }}>
        <TeamCol team={match.teamA} won={winA} align="right" playerById={playerById} compact={compact}/>
        <div style={{ textAlign:'center' }}>
          <div style={{
            fontFamily:'var(--font-head)', fontWeight: 'var(--head-weight)',
            fontSize: 56, lineHeight: 1, fontVariantNumeric:'tabular-nums',
            letterSpacing: 'var(--head-tracking)',
          }}>
            {match.teamA.score}<span style={{ color:'var(--fg-3)', margin:'0 8px' }}>:</span>{match.teamB.score}
          </div>
        </div>
        <TeamCol team={match.teamB} won={winB} align="left" playerById={playerById} compact={compact}/>
      </div>

      {!compact && match.events && (
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24 }}>
            <div>
              {match.events.filter(e=>e.team!=='B').map((ev, i) => (
                <EventRow key={'a'+i} ev={ev} playerById={playerById} side="left"/>
              ))}
            </div>
            <div>
              {match.events.filter(e=>e.team==='B').map((ev, i) => (
                <EventRow key={'b'+i} ev={ev} playerById={playerById} side="right"/>
              ))}
            </div>
          </div>
        </div>
      )}

      {!compact && (match.mvp || match.flop) && (
        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)',
          display:'grid', gridTemplateColumns:'1fr 1fr', gap: 24,
        }}>
          {match.mvp && playerById[match.mvp] && (
            <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
              <Badge tone="accent">⭐ Craque</Badge>
              <PlayerChip player={playerById[match.mvp]} size={28}/>
            </div>
          )}
          {match.flop && playerById[match.flop] && (
            <div style={{ display:'flex', alignItems:'center', gap: 10, justifyContent:'flex-end' }}>
              <Badge tone="loss">💀 Pior</Badge>
              <PlayerChip player={playerById[match.flop]} size={28}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamCol({ team, won, align, playerById, compact }) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{
        display:'flex', alignItems:'center', gap: 10,
        flexDirection: align === 'right' ? 'row-reverse' : 'row',
      }}>
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
        {won && <Badge tone="win">V</Badge>}
      </div>
      {!compact && (
        <div style={{
          marginTop: 10, display:'flex', flexWrap:'wrap', gap: 6,
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}>
          {team.players.map(pid => playerById[pid] && (
            <span key={pid} style={{
              display:'inline-flex', alignItems:'center', gap: 6,
              padding: '4px 8px 4px 4px', borderRadius: 999,
              background:'var(--surface-2)', fontSize: 12,
            }}>
              <Avatar player={playerById[pid]} size={20}/>
              {playerById[pid].name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ ev, playerById, side }) {
  const scorer = playerById[ev.player];
  const assister = ev.assist ? playerById[ev.assist] : null;
  if (!scorer) return null;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: 8, padding:'5px 0',
      flexDirection: side === 'right' ? 'row-reverse' : 'row',
      textAlign: side === 'right' ? 'right' : 'left',
    }}>
      <span style={{ fontSize: 14 }}>⚽</span>
      <span style={{ fontWeight: 500, fontSize: 14 }}>{scorer.name}</span>
      {assister && <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>↳ {assister.name}</span>}
    </div>
  );
}

// ── Rankings full page ──────────────────────────────────────────────────────

function Rankings({ state, stats, onSelectPlayer }) {
  const [tab, setTab] = React.useState('points');
  const tabs = [
    { id: 'points',  label: 'Bola de Ouro', key: 'points',  unit: 'pts'  },
    { id: 'goals',   label: 'Artilharia',   key: 'goals',   unit: 'gols' },
    { id: 'assists', label: 'Assistências', key: 'assists', unit: 'ass.' },
    { id: 'wins',    label: 'Vitórias',     key: 'wins',    unit: 'V'    },
    { id: 'played',  label: 'Frequência',   key: 'played',  unit: 'jogos'},
  ];
  const cur = tabs.find(t=>t.id===tab);
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  const sorted = Object.values(stats)
    .sort((a,b)=>b[cur.key]-a[cur.key])
    .filter(s => cur.key === 'played' || s[cur.key] > 0 || s.played > 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <h1 style={{
        fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
        textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
        fontSize: 36, margin: 0, lineHeight: 1.1,
      }}>Rankings</h1>

      <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding: '8px 14px', borderRadius: 'var(--radius)',
            border: '1px solid ' + (tab===t.id ? 'var(--fg)' : 'var(--line-2)'),
            background: tab===t.id ? 'var(--fg)' : 'transparent',
            color: tab===t.id ? 'var(--bg)' : 'var(--fg)',
            fontFamily:'var(--font-body)', fontSize: 13, fontWeight: 600,
            cursor:'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      <Card noPad>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'var(--font-body)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <Th>#</Th>
              <Th>Jogador</Th>
              <Th right>Jogos</Th>
              <Th right>Gols</Th>
              <Th right>Ass.</Th>
              <Th right>V</Th>
              <Th right>E</Th>
              <Th right>D</Th>
              <Th right>★</Th>
              <Th right>Pts</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.id} onClick={()=>onSelectPlayer(s.id)} style={{
                borderBottom: '1px solid var(--line)', cursor:'pointer',
              }} className="rank-row">
                <Td><span style={{
                  fontFamily:'var(--font-mono)', color: i<3 ? 'var(--accent)' : 'var(--fg-3)',
                  fontWeight: 600,
                }}>{i+1}</span></Td>
                <Td><div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                  <Avatar player={playerById[s.id]} size={28}/>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                </div></Td>
                <Td right mono>{s.played}</Td>
                <Td right mono bold={cur.key==='goals'}>{s.goals}</Td>
                <Td right mono bold={cur.key==='assists'}>{s.assists}</Td>
                <Td right mono bold={cur.key==='wins'} color={s.wins>0?'var(--win)':null}>{s.wins}</Td>
                <Td right mono>{s.draws}</Td>
                <Td right mono color={s.losses>0?'var(--loss)':null}>{s.losses}</Td>
                <Td right mono>{s.mvps || '·'}</Td>
                <Td right mono bold={cur.key==='points'} color="var(--accent)">{s.points}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <style>{`.rank-row:hover { background: var(--surface-2); }`}</style>
    </div>
  );
}

function Th({ children, right }) {
  return <th style={{
    textAlign: right ? 'right' : 'left', padding: '12px 16px',
    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--fg-3)',
  }}>{children}</th>;
}
function Td({ children, right, mono, bold, color }) {
  return <td style={{
    textAlign: right ? 'right' : 'left', padding: '14px 16px',
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
    fontVariantNumeric: 'tabular-nums',
    fontSize: 14, fontWeight: bold ? 700 : 400,
    color: color || 'var(--fg)',
  }}>{children}</td>;
}

// ── History ────────────────────────────────────────────────────────────────

function History({ state, onSelectMatch, onNavigate }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  const matches = [...state.matches].reverse();
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <h1 style={{
          fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
          textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
          fontSize: 36, margin: 0, lineHeight: 1.1,
        }}>Histórico</h1>
        <Button variant="accent" onClick={()=>onNavigate('new-match')}>
          <Icon.Plus width="16" height="16"/> Nova partida
        </Button>
      </div>
      {matches.length === 0 && (
        <Card><div style={{ textAlign:'center', padding: 40, color:'var(--fg-2)' }}>
          Nenhuma partida ainda. Comece uma agora!
        </div></Card>
      )}
      {matches.map(m => (
        <Card key={m.id} onClick={()=>onSelectMatch(m.id)}>
          <MatchScoreboard match={m} playerById={playerById} compact/>
        </Card>
      ))}
    </div>
  );
}

// ── Match Detail ───────────────────────────────────────────────────────────

function MatchDetail({ match, state, onBack, onDelete }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onBack} style={{
          background:'transparent', border: 0, color:'var(--fg-2)',
          fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
        }}>← voltar</button>
        <Button variant="danger" onClick={()=>{
          if (confirm('Apagar esta partida?')) onDelete(match.id);
        }}>Apagar partida</Button>
      </div>
      <Card>
        <MatchScoreboard match={match} playerById={playerById}/>
      </Card>
    </div>
  );
}

// ── Player Profile ─────────────────────────────────────────────────────────

function PlayerProfile({ playerId, state, stats, onBack, onSelectMatch, onUpdatePlayer, onDeletePlayer }) {
  const player = state.players.find(p=>p.id===playerId);
  const s = stats[playerId];
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  const playerMatches = state.matches.filter(m =>
    m.teamA.players.includes(playerId) || m.teamB.players.includes(playerId));
  const allRanked = Object.values(stats).sort((a,b)=>b.points-a.points);
  const rankPos = allRanked.findIndex(x => x.id === playerId) + 1;

  if (!player || !s) return <div>Jogador não encontrado</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <button onClick={onBack} style={{
        background:'transparent', border: 0, color:'var(--fg-2)',
        fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
        alignSelf:'flex-start',
      }}>← voltar</button>

      <Card style={{ padding: 28 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 20 }}>
          <Avatar player={player} size={88}/>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--fg-3)',
            }}>#{rankPos} no ranking · {(s.attendance*100).toFixed(0)}% de presença</div>
            <h1 style={{
              fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
              textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
              fontSize: 44, margin: '4px 0 0 0', lineHeight: 1.1,
            }}>{player.name}</h1>
            {player.nick && <div style={{ color:'var(--fg-2)', marginTop: 6, fontStyle:'italic' }}>"{player.nick}"</div>}
          </div>
          <Button variant="ghost" onClick={()=>{
            const newName = prompt('Nome do jogador:', player.name);
            if (newName && newName.trim()) onUpdatePlayer(player.id, { name: newName.trim() });
          }}>Editar</Button>
        </div>

        <div style={{
          marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--line)',
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 20,
        }}>
          <Stat label="Pts" value={s.points} sub="Bola de Ouro"/>
          <Stat label="Gols" value={s.goals}/>
          <Stat label="Ass." value={s.assists}/>
          <Stat label="V/E/D" value={`${s.wins}/${s.draws}/${s.losses}`}/>
          <Stat label="Jogos" value={s.played}/>
          <Stat label="★ Craque" value={s.mvps}/>
        </div>
      </Card>

      <Card>
        <SectionTitle>Histórico em partidas</SectionTitle>
        <div>
          {playerMatches.length === 0 && (
            <div style={{ color:'var(--fg-2)', padding: '20px 0', textAlign:'center' }}>
              Ainda não jogou nenhuma partida.
            </div>
          )}
          {[...playerMatches].reverse().map(m => {
            const inA = m.teamA.players.includes(playerId);
            const myScore = inA ? m.teamA.score : m.teamB.score;
            const oppScore = inA ? m.teamB.score : m.teamA.score;
            const result = myScore>oppScore?'V':myScore<oppScore?'D':'E';
            const tone = result==='V'?'win':result==='D'?'loss':'draw';
            const goals = m.events.filter(e=>e.type==='goal' && e.player===playerId).length;
            const assists = m.events.filter(e=>e.type==='goal' && e.assist===playerId).length;
            return (
              <div key={m.id} onClick={()=>onSelectMatch(m.id)} style={{
                display:'grid', gridTemplateColumns:'90px auto 1fr auto', gap: 16,
                alignItems:'center', padding: '12px 0',
                borderBottom: '1px solid var(--line)', cursor:'pointer',
              }}>
                <div style={{ color:'var(--fg-3)', fontSize: 12, fontFamily:'var(--font-mono)' }}>
                  {fmtDate(m.date)}
                </div>
                <Badge tone={tone}>{result} {myScore}-{oppScore}</Badge>
                <div style={{ display:'flex', gap: 14, color:'var(--fg-2)', fontSize: 13 }}>
                  {goals>0 && <span>⚽ {goals}</span>}
                  {assists>0 && <span>🅰 {assists}</span>}
                  {m.mvp===playerId && <Badge tone="accent">★ Craque</Badge>}
                  {m.flop===playerId && <Badge tone="loss">💀 Pior</Badge>}
                </div>
                <Icon.Chevron width="14" height="14" color="var(--fg-3)"/>
              </div>
            );
          })}
        </div>
      </Card>

      <div>
        <Button variant="danger" onClick={()=>{
          if (confirm(`Remover ${player.name}? Os registros em partidas antigas permanecem.`)) {
            onDeletePlayer(player.id);
          }
        }}>Remover jogador</Button>
      </div>
    </div>
  );
}

Object.assign(window, {
  Dashboard, Rankings, History, MatchDetail, PlayerProfile, MatchScoreboard,
});
