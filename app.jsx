// app.jsx — Root, navigation, state management

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "estadio",
  "accent": "#f5d04a"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [state, setState] = React.useState(() => loadState());
  const [view, setView] = React.useState({ name: 'dashboard' });

  React.useEffect(() => { applyTheme(t.theme); }, [t.theme]);
  React.useEffect(() => { saveState(state); }, [state]);

  // override accent on top of theme
  React.useEffect(() => {
    if (t.accent) document.documentElement.style.setProperty('--accent', t.accent);
  }, [t.accent, t.theme]);

  const stats = React.useMemo(() => computeStats(state), [state]);

  const nav = (name, payload) => {
    setView({ name, ...payload });
    window.scrollTo(0, 0);
  };

  // mutations
  const addMatch = (m) => setState(s => ({ ...s, matches: [...s.matches, m] }));
  const deleteMatch = (id) => setState(s => ({ ...s, matches: s.matches.filter(m => m.id !== id) }));
  const addPlayer = (name) => setState(s => ({
    ...s, players: [...s.players, { id: newId('p'), name, nick: '' }],
  }));
  const updatePlayer = (id, patch) => setState(s => ({
    ...s, players: s.players.map(p => p.id === id ? { ...p, ...patch } : p),
  }));
  const deletePlayer = (id) => setState(s => ({
    ...s, players: s.players.filter(p => p.id !== id),
  }));

  const navItems = [
    { id: 'dashboard', label: 'Início' },
    { id: 'rankings',  label: 'Rankings' },
    { id: 'history',   label: 'Histórico' },
    { id: 'players',   label: 'Jogadores' },
  ];

  let content;
  if (view.name === 'dashboard') {
    content = <Dashboard state={state} stats={stats}
      onNavigate={nav}
      onSelectPlayer={(id)=>nav('player', { playerId: id })}
      onSelectMatch={(id)=>nav('match', { matchId: id })} />;
  } else if (view.name === 'rankings') {
    content = <Rankings state={state} stats={stats}
      onSelectPlayer={(id)=>nav('player', { playerId: id })}/>;
  } else if (view.name === 'history') {
    content = <History state={state}
      onSelectMatch={(id)=>nav('match', { matchId: id })}
      onNavigate={nav}/>;
  } else if (view.name === 'players') {
    content = <Players state={state} stats={stats}
      onSelectPlayer={(id)=>nav('player', { playerId: id })}
      onAddPlayer={addPlayer}/>;
  } else if (view.name === 'new-match') {
    content = <NewMatch state={state}
      onSave={(m)=>{ addMatch(m); nav('match', { matchId: m.id }); }}
      onCancel={()=>nav('history')}/>;
  } else if (view.name === 'match') {
    const match = state.matches.find(m => m.id === view.matchId);
    if (!match) { setTimeout(()=>nav('history'), 0); content = null; }
    else content = <MatchDetail match={match} state={state}
      onBack={()=>nav('history')}
      onDelete={(id)=>{ deleteMatch(id); nav('history'); }}/>;
  } else if (view.name === 'player') {
    content = <PlayerProfile playerId={view.playerId} state={state} stats={stats}
      onBack={()=>nav('rankings')}
      onSelectMatch={(id)=>nav('match', { matchId: id })}
      onUpdatePlayer={updatePlayer}
      onDeletePlayer={(id)=>{ deletePlayer(id); nav('players'); }}/>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', backgroundImage: 'var(--page-tex)' }}>
      {/* Top bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '14px 32px',
          display: 'flex', alignItems: 'center', gap: 32,
        }}>
          <button onClick={()=>nav('dashboard')} style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <Logo/>
            <div style={{ whiteSpace: 'nowrap' }}>
              <div style={{
                fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
                textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
                fontSize: 18, lineHeight: 1.1,
              }}>Futebol de Segunda</div>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.08em',
                            textTransform: 'uppercase', fontWeight: 600, marginTop: 4 }}>
                Temporada 2026
              </div>
            </div>
          </button>

          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {navItems.map(item => {
              const active = view.name === item.id ||
                (item.id === 'history' && (view.name === 'match' || view.name === 'new-match')) ||
                (item.id === 'players' && view.name === 'player');
              return (
                <button key={item.id} onClick={()=>nav(item.id)} style={{
                  padding: '8px 14px', borderRadius: 'var(--radius)',
                  border: 0, background: active ? 'var(--surface-2)' : 'transparent',
                  color: active ? 'var(--fg)' : 'var(--fg-2)',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                }}>{item.label}</button>
              );
            })}
          </nav>

          <Button variant="accent" onClick={()=>nav('new-match')}>
            <Icon.Plus width="16" height="16"/> Nova rodada
          </Button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px' }}>
        {content}
      </main>

      <footer style={{
        maxWidth: 1200, margin: '0 auto', padding: '20px 32px 40px',
        color: 'var(--fg-3)', fontSize: 12, textAlign: 'center',
        borderTop: '1px solid var(--line)', marginTop: 40,
      }}>
        Toda segunda. Pra valer.
      </footer>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Vibe Visual"/>
        <TweakRadio label="Tema" value={t.theme}
                    options={[
                      { value: 'estadio', label: 'Estádio' },
                      { value: 'minimal', label: 'Minimal' },
                      { value: 'varzea',  label: 'Várzea' },
                    ]}
                    onChange={(v)=>setTweak('theme', v)}/>
        <TweakColor label="Cor de destaque" value={t.accent}
                    onChange={(v)=>setTweak('accent', v)}/>
        <div style={{ display:'flex', gap: 6, marginTop: 4 }}>
          {[
            { name: 'Dourado',  hex: '#f5d04a' },
            { name: 'Gramado',  hex: '#7ad97a' },
            { name: 'Laranja',  hex: '#ff9933' },
            { name: 'Vermelho', hex: '#e23a3a' },
            { name: 'Azul',     hex: '#3a85e2' },
          ].map(c => (
            <button key={c.hex} onClick={()=>setTweak('accent', c.hex)}
              title={c.name}
              style={{
                width: 28, height: 22, borderRadius: 6,
                background: c.hex, padding: 0, cursor:'pointer',
                border: t.accent.toLowerCase() === c.hex.toLowerCase()
                  ? '2px solid #29261b' : '1px solid rgba(0,0,0,0.15)',
              }}/>
          ))}
        </div>

        <TweakSection label="Dados"/>
        <TweakButton label="Recarregar dados de exemplo" secondary
                     onClick={()=>{
                       if (confirm('Isso apaga tudo e volta pros dados de exemplo. Confirmar?')) {
                         resetState();
                         setState(SEED);
                       }
                     }}/>
        <TweakButton label="Limpar tudo (zerar)" secondary
                     onClick={()=>{
                       if (confirm('Apagar TODAS as partidas e jogadores? Não dá pra desfazer.')) {
                         const empty = { players: [], matches: [], seasonStart: new Date().toISOString().slice(0,10) };
                         setState(empty);
                         saveState(empty);
                       }
                     }}/>
      </TweaksPanel>
    </div>
  );
}

function Logo() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 800,
      color: '#1a1a1a',
      fontFamily: 'var(--font-head)',
    }}>⚽</div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
