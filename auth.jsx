// auth.jsx — Hook de autenticação + telas Auth e MyProfile

function useAuth() {
  const [session, setSession] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  // Boot: pega sessão atual + escuta mudanças
  React.useEffect(() => {
    let mounted = true;

    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess);
      if (!sess) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Quando session muda, busca o profile correspondente
  React.useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    setLoading(true);
    fetchMyProfile(session.user.id)
      .then(p => {
        if (!cancelled) {
          setProfile(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signUpWithEmail = async (email, name) => {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        data: { name },
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email) => {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabaseClient.auth.signOut();
  };

  const refreshProfile = async () => {
    if (!session?.user) return;
    const p = await fetchMyProfile(session.user.id);
    setProfile(p);
  };

  return {
    user: session?.user || null,
    profile,
    isAdmin: !!profile?.is_admin,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    refreshProfile,
  };
}

// ── AuthScreen ──────────────────────────────────────────────────────────

function AuthScreen({ auth, onCancel }) {
  const [mode, setMode] = React.useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (mode === 'signup' && !name.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await auth.signUpWithEmail(email.trim().toLowerCase(), name.trim());
      } else {
        await auth.signInWithEmail(email.trim().toLowerCase());
      }
      setSent(true);
    } catch (err) {
      setError(err.message || 'Algo deu errado. Tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap: 24, maxWidth: 480, margin: '0 auto' }}>
        <button onClick={onCancel} style={linkBackBtn}>← voltar</button>
        <Card className="card-mobile" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
          <h2 style={{
            fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
            textTransform:'var(--head-transform)', letterSpacing:'var(--head-tracking)',
            fontSize: 22, margin: '0 0 10px',
          }}>Te mandei um link</h2>
          <p style={{ color:'var(--fg-2)', fontSize: 14, margin: 0 }}>
            Abre seu email <b>{email}</b> e clica no link pra entrar.
            Pode demorar até 1 minuto.
          </p>
          <button onClick={()=>{ setSent(false); setEmail(''); setName(''); }}
                  style={{ ...linkBackBtn, marginTop: 18 }}>
            Usar outro email
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 20, maxWidth: 480, margin: '0 auto' }}>
      <button onClick={onCancel} style={linkBackBtn}>← voltar</button>

      <h1 className="h1-mobile" style={{
        fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
        textTransform:'var(--head-transform)', letterSpacing:'var(--head-tracking)',
        fontSize: 36, margin: 0, lineHeight: 1.1,
      }}>{mode === 'signup' ? 'Cadastrar' : 'Entrar'}</h1>

      <div style={{ display:'flex', gap: 8 }}>
        {[
          { id:'signin', label:'Entrar' },
          { id:'signup', label:'Cadastrar' },
        ].map(t => (
          <button key={t.id} onClick={()=>{ setMode(t.id); setError(null); }} style={{
            padding:'8px 14px', borderRadius:'var(--radius)',
            border:'1px solid '+(mode===t.id?'var(--fg)':'var(--line-2)'),
            background: mode===t.id?'var(--fg)':'transparent',
            color: mode===t.id?'var(--bg)':'var(--fg)',
            fontFamily:'var(--font-body)', fontSize:13, fontWeight:600, cursor:'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      <Card className="card-mobile" style={{ padding: 24 }}>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap: 14 }}>
          {mode === 'signup' && (
            <label style={authLabelStyle}>
              <span>Nome</span>
              <input value={name} onChange={e=>setName(e.target.value)}
                     placeholder="Como você quer aparecer no app"
                     autoFocus style={authInputStyle}/>
            </label>
          )}
          <label style={authLabelStyle}>
            <span>Email</span>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                   placeholder="seu@email.com"
                   autoFocus={mode!=='signup'} style={authInputStyle}/>
          </label>
          {error && (
            <div style={{
              padding:'10px 12px', borderRadius:'var(--radius)',
              background:'rgba(226,85,85,0.12)', color:'var(--loss)', fontSize: 13,
            }}>{error}</div>
          )}
          <Button variant="accent" type="submit" disabled={submitting}>
            {submitting ? 'Enviando…' : (mode === 'signup' ? 'Criar conta' : 'Receber link')}
          </Button>
          <div style={{ fontSize: 12, color:'var(--fg-3)', textAlign:'center' }}>
            Sem senha. Você recebe um link no email pra entrar.
          </div>
        </form>
      </Card>
    </div>
  );
}

const authLabelStyle = {
  display:'flex', flexDirection:'column', gap: 6,
  fontSize: 12, fontWeight: 600, letterSpacing: '0.06em',
  textTransform:'uppercase', color:'var(--fg-3)',
};
const authInputStyle = {
  height: 44, padding:'0 14px',
  background:'var(--surface-2)', border:'1px solid var(--line)',
  borderRadius:'var(--radius)', color:'var(--fg)',
  fontFamily:'var(--font-body)', fontSize: 16, outline:'none',
  textTransform:'none', letterSpacing: 0,
};
const linkBackBtn = {
  background:'transparent', border: 0, color:'var(--fg-2)',
  fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
  alignSelf:'flex-start',
};

// ── MyProfile ───────────────────────────────────────────────────────────

function MyProfile({ auth, onBack, onSaved }) {
  const [name, setName] = React.useState(auth.profile?.name || '');
  const [nick, setNick] = React.useState(auth.profile?.nick || '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [savedOk, setSavedOk] = React.useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile(auth.user.id, {
        name: name.trim(),
        nick: nick.trim() || null,
      });
      await auth.refreshProfile();
      setSavedOk(true);
      setTimeout(()=>setSavedOk(false), 2000);
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!auth.profile) return null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 20, maxWidth: 480, margin: '0 auto' }}>
      <button onClick={onBack} style={linkBackBtn}>← voltar</button>

      <h1 className="h1-mobile" style={{
        fontFamily:'var(--font-head)', fontWeight:'var(--head-weight)',
        textTransform:'var(--head-transform)', letterSpacing:'var(--head-tracking)',
        fontSize: 36, margin: 0, lineHeight: 1.1,
      }}>Meu perfil</h1>

      <Card className="card-mobile" style={{ padding: 24 }}>
        <form onSubmit={save} style={{ display:'flex', flexDirection:'column', gap: 14 }}>
          <label style={authLabelStyle}>
            <span>Nome</span>
            <input value={name} onChange={e=>setName(e.target.value)}
                   style={authInputStyle}/>
          </label>
          <label style={authLabelStyle}>
            <span>Apelido (opcional)</span>
            <input value={nick} onChange={e=>setNick(e.target.value)}
                   placeholder="Ex: Goleiro, Ronaldinho..."
                   style={authInputStyle}/>
          </label>
          <div style={{ fontSize: 12, color:'var(--fg-3)' }}>
            Email: {auth.user.email} <span style={{ opacity: 0.6 }}>(não dá pra alterar)</span>
          </div>
          {error && (
            <div style={{
              padding:'10px 12px', borderRadius:'var(--radius)',
              background:'rgba(226,85,85,0.12)', color:'var(--loss)', fontSize: 13,
            }}>{error}</div>
          )}
          {savedOk && (
            <div style={{
              padding:'10px 12px', borderRadius:'var(--radius)',
              background:'rgba(122,217,122,0.18)', color:'var(--win)', fontSize: 13,
            }}>Salvo!</div>
          )}
          <Button variant="accent" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Card>

      <Card className="card-mobile" style={{ padding: 20 }}>
        <Button variant="ghost" onClick={async ()=>{
          await auth.signOut();
          onBack();
        }}>Sair da conta</Button>
      </Card>
    </div>
  );
}

Object.assign(window, { useAuth, AuthScreen, MyProfile });
