// app.jsx — Root, navegação, integração com Supabase + Auth

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "estadio",
  "accent": "#f5d04a"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const auth = useAuth();
  const [view, setView] = React.useState({ name: 'dashboard' });

  const [players, setPlayers] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [dataLoading, setDataLoading] = React.useState(true);
  const [dataError, setDataError] = React.useState(null);

  React.useEffect(() => { applyTheme(t.theme); }, [t.theme]);

  React.useEffect(() => {
    if (t.accent) document.documentElement.style.setProperty('--accent', t.accent);
  }, [t.accent, t.theme]);

  // Fetch inicial dos dados
  const reload = React.useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [ps, ms] = await Promise.all([fetchProfiles(), fetchMatches()]);
      setPlayers(ps);
      setMatches(ms);
    } catch (err) {
      setDataError(err.message || 'Erro ao carregar dados.');
      showToast('Não consegui carregar os dados. Verifica sua conexão.', { tone: 'error' });
    } finally {
      setDataLoading(false);
    }
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  const stats = React.useMemo(() => computeStats(players, matches), [players, matches]);

  const nav = (name, payload) => {
    setView({ name, ...payload });
    window.scrollTo(0, 0);
  };

  // ── Mutations ─────────────────────────────────────────────────────────

  const addMatch = async (m) => {
    try {
      const saved = await createMatch(m);
      setMatches(arr => [...arr, saved]);
      return saved;
    } catch (err) {
      showToast('Erro ao salvar partida: ' + err.message, { tone: 'error' });
      throw err;
    }
  };

  const removeMatch = async (id) => {
    try {
      await deleteMatch(id);
      setMatches(arr => arr.filter(m => m.id !== id));
    } catch (err) {
      showToast('Erro ao apagar: ' + err.message, { tone: 'error' });
    }
  };

  const updatePlayerLocal = async (id, patch) => {
    try {
      const updated = await updateProfile(id, patch);
      setPlayers(arr => arr.map(p => p.id === id ? { ...p, ...updated } : p));
      return updated;
    } catch (err) {
      showToast('Erro ao salvar: ' + err.message, { tone: 'error' });
      throw err;
    }
  };

  const deletePlayerLocal = async (id) => {
    try {
      await deleteProfile(id);
      setPlayers(arr => arr.filter(p => p.id !== id));
    } catch (err) {
      showToast('Erro ao remover: ' + err.message, { tone: 'error' });
    }
  };

  // state proxy pra componentes que ainda esperam um shape único
  const state = { players, matches };

  // ── Navigation ────────────────────────────────────────────────────────

  const navItems = [
    { id: 'dashboard', label: 'Início',    icon: '🏠' },
    { id: 'rankings',  label: 'Rankings',  icon: '📊' },
    { id: 'history',   label: 'Histórico', icon: '📅' },
    { id: 'players',   label: 'Jogadores', icon: '👥' },
  ];

  const isActive = (id) =>
    view.name === id ||
    (id === 'history' && (view.name === 'match' || view.name === 'new-match')) ||
    (id === 'players' && view.name === 'player');

  // ── Content routing ───────────────────────────────────────────────────

  let content;
  if (auth.loading || dataLoading) {
    content = <FullPageSpinner label="Carregando…"/>;
  } else if (view.name === 'auth') {
    content = <AuthScreen auth={auth} onCancel={()=>nav('dashboard')}/>;
  } else if (view.name === 'me') {
    if (!auth.user) { setTimeout(()=>nav('auth'), 0); content = null; }
    else content = <MyProfile auth={auth} onBack={()=>nav('dashboard')}/>;
  } else if (view.name === 'dashboard') {
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
      onNavigate={nav}
      isAdmin={auth.isAdmin}/>;
  } else if (view.name === 'players') {
    content = <Players state={state} stats={stats}
      onSelectPlayer={(id)=>nav('player', { playerId: id })}/>;
  } else if (view.name === 'new-match') {
    if (!auth.isAdmin) {
      content = <AccessDenied onBack={()=>nav('dashboard')}/>;
    } else {
      content = <NewMatch state={state}
        onSave={async (m)=>{ const saved = await addMatch(m); nav('match', { matchId: saved.id }); }}
        onCancel={()=>nav('history')}/>;
    }
  } else if (view.name === 'match') {
    const match = matches.find(m => m.id === view.matchId);
    if (!match) { setTimeout(()=>nav('history'), 0); content = null; }
    else content = <MatchDetail match={match} state={state}
      onBack={()=>nav('history')}
      onDelete={async (id)=>{ await removeMatch(id); nav('history'); }}
      isAdmin={auth.isAdmin}/>;
  } else if (view.name === 'player') {
    content = <PlayerProfile playerId={view.playerId} state={state} stats={stats}
      onBack={()=>nav('rankings')}
      onSelectMatch={(id)=>nav('match', { matchId: id })}
      onUpdatePlayer={updatePlayerLocal}
      onDeletePlayer={async (id)=>{ await deletePlayerLocal(id); nav('players'); }}
      isAdmin={auth.isAdmin}
      currentUserId={auth.user?.id || null}/>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', backgroundImage: 'var(--page-tex)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div className="header-inner" style={{
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
              <div className="hide-mobile" style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: '0.08em',
                            textTransform: 'uppercase', fontWeight: 600, marginTop: 4 }}>
                Temporada 2026
              </div>
            </div>
          </button>

          <nav className="hide-mobile" style={{ display: 'flex', gap: 4, flex: 1 }}>
            {navItems.map(item => {
              const active = isActive(item.id);
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

          <div style={{ marginLeft: 'auto', display:'flex', alignItems:'center', gap: 8 }}>
            {auth.isAdmin && (
              <Button variant="accent" onClick={()=>nav('new-match')}>
                <Icon.Plus width="16" height="16"/>
                <span className="hide-mobile">Nova rodada</span>
                <span className="show-mobile">Nova</span>
              </Button>
            )}
            {!auth.user && (
              <Button variant="ghost" onClick={()=>nav('auth')}>
                Entrar
              </Button>
            )}
            {auth.user && auth.profile && (
              <button onClick={()=>nav('me')} style={{
                all: 'unset', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 10px 4px 4px', borderRadius: 999,
                background:'var(--surface-2)',
              }}>
                <Avatar player={auth.profile} size={28}/>
                <span className="hide-mobile" style={{ fontSize: 13, fontWeight: 500 }}>
                  {auth.profile.name}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container">
        {content}
      </main>

      <footer className="hide-mobile" style={{
        maxWidth: 1200, margin: '0 auto', padding: '20px 32px 40px',
        color: 'var(--fg-3)', fontSize: 12, textAlign: 'center',
        borderTop: '1px solid var(--line)', marginTop: 40,
      }}>
        Toda segunda. Pra valer.
      </footer>

      <nav className="nav-bottom">
        {navItems.map(item => (
          <button key={item.id}
                  className={isActive(item.id) ? 'active' : ''}
                  onClick={()=>nav(item.id)}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <ToastContainer/>

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
      </TweaksPanel>
    </div>
  );
}

function AccessDenied({ onBack }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 16, alignItems:'center', padding:'60px 20px' }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <h2 style={{
        fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
        textTransform:'var(--head-transform)', letterSpacing:'var(--head-tracking)',
        fontSize: 22, margin: 0,
      }}>Acesso restrito</h2>
      <p style={{ color:'var(--fg-2)', fontSize: 14, margin: 0, textAlign:'center' }}>
        Só o admin pode registrar partidas.
      </p>
      <Button variant="ghost" onClick={onBack}>← voltar</Button>
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
