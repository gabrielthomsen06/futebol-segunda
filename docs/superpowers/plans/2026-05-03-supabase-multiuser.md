# Supabase Multi-Usuário — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o app de armazenamento local (`localStorage`) pra Supabase, com cadastro próprio dos jogadores via magic link e controle de admin pra registrar partidas.

**Architecture:** SPA estática (React 18 + Babel via CDN, sem build) chama Supabase direto do browser usando `@supabase/supabase-js` via CDN. Autenticação via magic link (passwordless). Segurança via Row Level Security no Postgres — qualquer um lê, só admin escreve partidas, cada usuário edita só o próprio perfil. Bootstrap de admin via SQL manual (uma vez).

**Tech Stack:** React 18 (CDN), Babel standalone (CDN), `@supabase/supabase-js` v2 (CDN), PostgreSQL (Supabase), Vercel (hosting estático).

**Spec relacionado:** `docs/superpowers/specs/2026-05-02-supabase-multiuser-design.md`

---

## File Structure

```
index.html               # MODIFY: adicionar <script> do supabase-js
config.jsx               # CREATE: Project URL + publishable key
supabase.jsx             # CREATE: client + funções fetch/mutation
auth.jsx                 # CREATE: useAuth hook + AuthScreen + MyProfile
data.jsx                 # MODIFY: remover SEED/loadState/saveState (manter helpers)
ui.jsx                   # MODIFY: adicionar Spinner e Toast
app.jsx                  # MODIFY: integrar useAuth, fetch async, novos views
screens-stats.jsx        # MODIFY: gating isAdmin/isOwner em MatchDetail e PlayerProfile
screens-edit.jsx         # MODIFY: NewMatch só admin; Players sem botão Adicionar
themes.jsx               # SEM MUDANÇA
tweaks-panel.jsx         # SEM MUDANÇA
docs/supabase-setup.sql  # CREATE: script SQL pra rodar no painel
```

**Princípios:**
- Sem build step. Tudo continua via CDN.
- Cada task termina com commit.
- Verificação é manual no navegador (sem framework de testes).
- Use `python -m http.server 8000` na raiz pra rodar local. Acesse `http://localhost:8000`.

---

## Task 1: Criar script SQL do Supabase

**Files:**
- Create: `docs/supabase-setup.sql`

- [ ] **Step 1: Criar o arquivo com o script SQL completo**

Crie `docs/supabase-setup.sql`:

```sql
-- =============================================================
-- Futebol de Segunda — Setup do banco
-- Rode este script uma única vez no SQL Editor do Supabase.
-- =============================================================

-- 1. TABELAS ---------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  nick        text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  team_a      jsonb not null,
  team_b      jsonb not null,
  events      jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- 2. FUNÇÃO is_admin ------------------------------------------

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false)
$$;

-- 3. TRIGGER: criar profile no signup --------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Sem nome')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. TRIGGER: blindar coluna is_admin --------------------------

create or replace function public.prevent_self_admin_promotion()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.is_admin is distinct from new.is_admin
     and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change is_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_self_promotion on public.profiles;
create trigger profiles_block_self_promotion
  before update on public.profiles
  for each row execute function public.prevent_self_admin_promotion();

-- 5. ROW LEVEL SECURITY ----------------------------------------

alter table public.profiles enable row level security;
alter table public.matches  enable row level security;

-- profiles: leitura pública
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

-- profiles: cada um edita o próprio, admin edita qualquer um
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin(auth.uid()));

-- profiles: só admin deleta
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin(auth.uid()));

-- matches: leitura pública
drop policy if exists "matches_select_all" on public.matches;
create policy "matches_select_all" on public.matches
  for select using (true);

-- matches: só admin escreve
drop policy if exists "matches_admin_insert" on public.matches;
create policy "matches_admin_insert" on public.matches
  for insert with check (public.is_admin(auth.uid()));

drop policy if exists "matches_admin_update" on public.matches;
create policy "matches_admin_update" on public.matches
  for update using (public.is_admin(auth.uid()));

drop policy if exists "matches_admin_delete" on public.matches;
create policy "matches_admin_delete" on public.matches
  for delete using (public.is_admin(auth.uid()));
```

- [ ] **Step 2: Pedir pro usuário rodar o script no painel do Supabase**

Mostre as instruções:

> Abra o painel do Supabase → **SQL Editor** → **New query** → cole o conteúdo de `docs/supabase-setup.sql` → **Run**.
> Espera ver "Success. No rows returned." Sem erros.

- [ ] **Step 3: Commit**

```bash
git add docs/supabase-setup.sql
git commit -m "Add Supabase setup SQL script"
```

---

## Task 2: Adicionar SDK do Supabase no index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Adicionar a tag script do Supabase**

Em `index.html`, adicione a tag `<script>` do Supabase logo após o script do Babel (antes do `</head>`):

```html
<script src="https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
```

A seção de scripts deve ficar:

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
```

- [ ] **Step 2: Verificação manual**

Rode `python -m http.server 8000` na raiz, abra `http://localhost:8000`, abra o DevTools (F12) → Console.

Digite: `window.supabase`

Esperado: deve mostrar um objeto com método `createClient` (não `undefined`).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add @supabase/supabase-js via CDN"
```

---

## Task 3: Criar config.jsx com chaves do Supabase

**Files:**
- Create: `config.jsx`
- Modify: `index.html`

- [ ] **Step 1: Criar o arquivo de config**

Crie `config.jsx`:

```jsx
// config.jsx — Configuração do projeto. Valores públicos (anon key).

const SUPABASE_URL = 'https://bnikdaesbbzprtyxauxe.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4rEf77zvgjIBvNkvwoTJTw_Xleh6a4A';

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
```

- [ ] **Step 2: Adicionar config.jsx no index.html ANTES dos outros scripts JSX**

Em `index.html`, no `<body>`, adicione `<script type="text/babel" src="config.jsx"></script>` como **primeiro** dos scripts type="text/babel". A seção `<body>` deve ficar:

```html
<body>
<div id="root"></div>
<script type="text/babel" src="config.jsx"></script>
<script type="text/babel" src="tweaks-panel.jsx"></script>
<script type="text/babel" src="data.jsx"></script>
<script type="text/babel" src="themes.jsx"></script>
<script type="text/babel" src="ui.jsx"></script>
<script type="text/babel" src="screens-stats.jsx"></script>
<script type="text/babel" src="screens-edit.jsx"></script>
<script type="text/babel" src="app.jsx"></script>
</body>
```

- [ ] **Step 3: Verificação manual**

Recarregue `http://localhost:8000`. No console, digite: `window.SUPABASE_URL`

Esperado: `"https://bnikdaesbbzprtyxauxe.supabase.co"`.

- [ ] **Step 4: Commit**

```bash
git add config.jsx index.html
git commit -m "Add Supabase config module"
```

---

## Task 4: Criar supabase.jsx — client e helpers de dados

**Files:**
- Create: `supabase.jsx`
- Modify: `index.html`

- [ ] **Step 1: Criar o arquivo supabase.jsx**

Crie `supabase.jsx`:

```jsx
// supabase.jsx — Client Supabase + helpers de fetch e mutation

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// ── Profiles ────────────────────────────────────────────────────────────

async function fetchProfiles() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, name, nick, is_admin, created_at')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchMyProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, name, nick, is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateProfile(id, patch) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteProfile(id) {
  const { error } = await supabaseClient
    .from('profiles')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Matches ─────────────────────────────────────────────────────────────

async function fetchMatches() {
  const { data, error } = await supabaseClient
    .from('matches')
    .select('id, date, team_a, team_b, events, created_at')
    .order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToMatch);
}

async function createMatch(match) {
  const row = matchToRow(match);
  const { data, error } = await supabaseClient
    .from('matches')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToMatch(data);
}

async function deleteMatch(id) {
  const { error } = await supabaseClient
    .from('matches')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Conversores entre shape do banco (snake) e shape do app (camel) ────

function rowToMatch(row) {
  return {
    id: row.id,
    date: row.date,
    teamA: row.team_a,
    teamB: row.team_b,
    events: row.events || [],
  };
}

function matchToRow(m) {
  return {
    id: m.id, // pode ser undefined — banco gera
    date: m.date,
    team_a: m.teamA,
    team_b: m.teamB,
    events: m.events || [],
  };
}

window.supabaseClient = supabaseClient;
window.fetchProfiles = fetchProfiles;
window.fetchMyProfile = fetchMyProfile;
window.updateProfile = updateProfile;
window.deleteProfile = deleteProfile;
window.fetchMatches = fetchMatches;
window.createMatch = createMatch;
window.deleteMatch = deleteMatch;
```

**Nota sobre `id` em createMatch:** o banco gera UUID automaticamente. O `id` antigo (`m_xyz123`) gerado por `newId('m')` não é UUID válido, então a gente deixa o banco gerar.

- [ ] **Step 2: Adicionar supabase.jsx no index.html**

Em `index.html`, adicione `<script type="text/babel" src="supabase.jsx"></script>` logo após `data.jsx`:

```html
<script type="text/babel" src="config.jsx"></script>
<script type="text/babel" src="tweaks-panel.jsx"></script>
<script type="text/babel" src="data.jsx"></script>
<script type="text/babel" src="supabase.jsx"></script>
<script type="text/babel" src="themes.jsx"></script>
<script type="text/babel" src="ui.jsx"></script>
<script type="text/babel" src="screens-stats.jsx"></script>
<script type="text/babel" src="screens-edit.jsx"></script>
<script type="text/babel" src="app.jsx"></script>
```

- [ ] **Step 3: Verificação manual no console**

Recarregue. No console:

```js
await window.fetchProfiles()
```

Esperado: `[]` (array vazio, banco está vazio).

```js
await window.fetchMatches()
```

Esperado: `[]`.

Se der erro tipo "permission denied" ou "relation does not exist", a Task 1 (rodar o SQL) não foi feita — peça pro usuário rodar.

- [ ] **Step 4: Commit**

```bash
git add supabase.jsx index.html
git commit -m "Add Supabase client and data helpers"
```

---

## Task 5: Criar useAuth hook em auth.jsx

**Files:**
- Create: `auth.jsx`
- Modify: `index.html`

- [ ] **Step 1: Criar o arquivo auth.jsx com o hook**

Crie `auth.jsx`:

```jsx
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

window.useAuth = useAuth;
```

- [ ] **Step 2: Adicionar auth.jsx no index.html (DEPOIS de ui.jsx)**

`auth.jsx` usa `Card` e `Button` do `ui.jsx`, então tem que carregar depois dele. A seção de scripts no `<body>` deve ficar:

```html
<script type="text/babel" src="config.jsx"></script>
<script type="text/babel" src="tweaks-panel.jsx"></script>
<script type="text/babel" src="data.jsx"></script>
<script type="text/babel" src="supabase.jsx"></script>
<script type="text/babel" src="themes.jsx"></script>
<script type="text/babel" src="ui.jsx"></script>
<script type="text/babel" src="auth.jsx"></script>
<script type="text/babel" src="screens-stats.jsx"></script>
<script type="text/babel" src="screens-edit.jsx"></script>
<script type="text/babel" src="app.jsx"></script>
```

- [ ] **Step 3: Verificação manual** (vamos testar de verdade na próxima task)

Recarregue. Não deve dar erro no console. Digite: `typeof window.useAuth`

Esperado: `"function"`.

- [ ] **Step 4: Commit**

```bash
git add auth.jsx index.html
git commit -m "Add useAuth hook"
```

---

## Task 6: Adicionar AuthScreen e MyProfile em auth.jsx

**Files:**
- Modify: `auth.jsx`

- [ ] **Step 1: Adicionar componentes AuthScreen e MyProfile no final de auth.jsx**

Adicione no final de `auth.jsx` (antes do `Object.assign(window, ...)` final, ou depois — não importa, mas adicione todos ao window no final):

```jsx
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
```

**Importante:** remova o `window.useAuth = useAuth;` que você tinha no final do arquivo na Task 5 — ele é substituído pelo `Object.assign` no final. Garante que tem só **um** export final.

- [ ] **Step 2: Verificação manual**

Recarregue. No console: `typeof window.AuthScreen`

Esperado: `"function"`. Sem erros.

- [ ] **Step 3: Commit**

```bash
git add auth.jsx
git commit -m "Add AuthScreen and MyProfile components"
```

---

## Task 7: Adicionar Spinner e Toast em ui.jsx

**Files:**
- Modify: `ui.jsx`

- [ ] **Step 1: Adicionar Spinner e Toast no fim do ui.jsx**

No final de `ui.jsx`, **antes** do `Object.assign(window, ...)` existente, adicione:

```jsx
function Spinner({ size = 24 }) {
  return (
    <div style={{
      width: size, height: size,
      border: '2px solid var(--line)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'fdsspin 0.7s linear infinite',
      display: 'inline-block',
    }}/>
  );
}

function FullPageSpinner({ label = 'Carregando...' }) {
  return (
    <div style={{
      minHeight: '50vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap: 14, color:'var(--fg-3)',
    }}>
      <Spinner size={32}/>
      <div style={{ fontSize: 13 }}>{label}</div>
      <style>{`@keyframes fdsspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Toast: estilo "fila simples" via window.showToast()
const ToastHost = (() => {
  let pushFn = null;
  function ToastContainer() {
    const [toasts, setToasts] = React.useState([]);
    React.useEffect(() => {
      pushFn = (t) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(ts => [...ts, { id, ...t }]);
        setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), t.ms || 4000);
      };
      return () => { pushFn = null; };
    }, []);
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        zIndex: 100, pointerEvents: 'none', padding: '0 16px',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 14px', borderRadius: 'var(--radius)',
            background: t.tone === 'error' ? 'var(--loss)' : 'var(--fg)',
            color: t.tone === 'error' ? '#fff' : 'var(--bg)',
            fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            maxWidth: 480, pointerEvents: 'auto',
          }}>{t.message}</div>
        ))}
      </div>
    );
  }
  function showToast(message, opts = {}) {
    if (pushFn) pushFn({ message, ...opts });
  }
  return { ToastContainer, showToast };
})();

const ToastContainer = ToastHost.ToastContainer;
const showToast = ToastHost.showToast;
```

E atualize o `Object.assign(window, ...)` final pra incluir os novos:

```jsx
Object.assign(window, {
  Avatar, PlayerChip, Card, Stat, SectionTitle, Badge, Button, Icon,
  PlayerPicker, colorFor, initialsOf,
  Spinner, FullPageSpinner, ToastContainer, showToast,
});
```

- [ ] **Step 2: Verificação manual** (vamos usar de verdade nas próximas tasks)

Recarregue. No console: `typeof window.showToast`

Esperado: `"function"`. Sem erros.

- [ ] **Step 3: Commit**

```bash
git add ui.jsx
git commit -m "Add Spinner and Toast components"
```

---

## Task 8: Refatorar data.jsx — manter só helpers

**Files:**
- Modify: `data.jsx`

- [ ] **Step 1: Substituir conteúdo do data.jsx**

Substitua **todo** o conteúdo de `data.jsx` por:

```jsx
// data.jsx — Helpers de cálculo e formatação (sem persistência, banco no Supabase)

function computeStats(players, matches) {
  const stats = {};
  for (const p of players) {
    stats[p.id] = {
      id: p.id, name: p.name, nick: p.nick,
      goals: 0, assists: 0,
      wins: 0, draws: 0, losses: 0,
      played: 0,
    };
  }

  for (const m of matches) {
    const winA = m.teamA.score > m.teamB.score;
    const winB = m.teamB.score > m.teamA.score;
    const draw = m.teamA.score === m.teamB.score;

    for (const pid of m.teamA.players) {
      if (!stats[pid]) continue;
      stats[pid].played++;
      if (winA) stats[pid].wins++;
      else if (draw) stats[pid].draws++;
      else stats[pid].losses++;
    }
    for (const pid of m.teamB.players) {
      if (!stats[pid]) continue;
      stats[pid].played++;
      if (winB) stats[pid].wins++;
      else if (draw) stats[pid].draws++;
      else stats[pid].losses++;
    }

    for (const ev of m.events) {
      if (ev.type === 'goal') {
        if (stats[ev.player]) stats[ev.player].goals++;
        if (ev.assist && stats[ev.assist]) stats[ev.assist].assists++;
      }
    }
  }

  for (const id in stats) {
    const s = stats[id];
    s.attendance = matches.length ? s.played / matches.length : 0;
  }

  return stats;
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function fmtDateLong(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

Object.assign(window, { computeStats, fmtDate, fmtDateLong });
```

**Mudanças:**
- Removido: `STORAGE_KEY`, `SEED`, `loadState`, `saveState`, `resetState`, `newId`.
- `computeStats` agora recebe `(players, matches)` separadamente em vez de `state` agregado.

**⚠️ Nota:** `screens-edit.jsx` ainda tem uma chamada a `newId('m')` em `NewMatch.save` que vai ser consertada na Task 12. Entre as Tasks 8 e 12, **não tente salvar uma nova partida** — vai dar `ReferenceError`. Os outros fluxos (login, navegação, ver dados) funcionam normal.

- [ ] **Step 2: Verificação manual**

Recarregue. App vai dar erro porque `app.jsx` ainda chama `loadState()`. Não tem problema — vamos consertar na Task 9.

No console pode confirmar: `typeof window.computeStats` → `"function"`. `typeof window.loadState` → `"undefined"`.

- [ ] **Step 3: Commit**

```bash
git add data.jsx
git commit -m "Refactor data.jsx: remove localStorage, keep computeStats and formatters"
```

---

## Task 9: Refatorar app.jsx — integrar useAuth + fetch async + novos views

**Files:**
- Modify: `app.jsx`

- [ ] **Step 1: Substituir conteúdo do app.jsx**

Substitua **todo** o conteúdo de `app.jsx` por:

```jsx
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
```

**Mudanças principais em relação ao anterior:**
- Removeu `loadState`/`saveState`/`useEffect(saveState)`.
- Adicionou `players`/`matches`/`dataLoading`/`dataError` como estado separado.
- Adicionou `reload()` que chama `fetchProfiles` + `fetchMatches`.
- Mutações agora são async (`createMatch`/`deleteMatch`/`updateProfile`/`deleteProfile`).
- Header tem botão "Entrar" (anon) ou avatar+nome (logado). "Nova" só pra admin.
- Adicionou rotas `auth` e `me`.
- Adicionou componente `AccessDenied`.
- Removeu o tweak "Limpar tudo" (agora os dados estão no banco — limpar via SQL).

- [ ] **Step 2: Verificação manual completa**

Recarregue `http://localhost:8000`.

Esperado:
- Vê spinner por instante.
- Depois dashboard vazio (sem partidas, sem jogadores).
- Header tem **"Entrar"** no canto direito.
- **NÃO** tem botão "Nova rodada" (você ainda não é admin).
- Bottom nav funciona no mobile.

Sem erros no console (warning de React sobre `setTimeout(()=>nav)` é OK — é um padrão antigo, não quebra nada).

- [ ] **Step 3: Commit**

```bash
git add app.jsx
git commit -m "Wire app.jsx to Supabase: async data fetch and auth integration"
```

---

## Task 10: Testar fluxo de cadastro e login real

**Files:** (nenhum — só verificação)

- [ ] **Step 1: Testar cadastro com email real**

Com o servidor local rodando:
1. Abra `http://localhost:8000`.
2. Clique em **Entrar** no header.
3. Clique na aba **Cadastrar**.
4. Preencha **Nome**: seu nome (ex: "Gabriel Thomsen").
5. Preencha **Email**: seu email real (`gabrielthomsen08@gmail.com`).
6. Clique em **Criar conta**.
7. Espera ver tela "Te mandei um link 📬".
8. Abre seu email, encontra o email do Supabase, clica no link.
9. Vai abrir uma URL tipo `http://localhost:8000/?...` (ou a Vercel se você for clicar no celular).
10. App carrega de volta logado: header mostra seu nome + avatar.

**Se o link abrir em `localhost:8000` mas você quiser que abra na Vercel** (ou vice-versa): o `emailRedirectTo: window.location.origin` envia ele de volta de **onde** ele clicou em "Criar conta". Então se cadastrou no localhost, o link volta no localhost.

- [ ] **Step 2: Verificar no painel do Supabase que o profile foi criado**

No painel: **Table Editor → profiles**. Deve ter uma linha com seu nome e `is_admin = false`.

- [ ] **Step 3: Tornar você admin**

No painel: **SQL Editor → New query**:

```sql
UPDATE public.profiles SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email='gabrielthomsen08@gmail.com');
```

Run. Esperado: "Success. 1 row affected".

- [ ] **Step 4: Recarregar e verificar admin**

No app, recarregue a página. Esperado:
- Header agora mostra botão **"Nova rodada"** (ou "Nova" no mobile).
- Clica em **Nova** → abre tela de Nova Rodada (não mostra "Acesso restrito").

- [ ] **Step 5: Sem commit nessa task** — é só verificação.

---

## Task 11: Gating em screens-stats.jsx (MatchDetail e PlayerProfile)

**Files:**
- Modify: `screens-stats.jsx`

- [ ] **Step 1: Atualizar MatchDetail pra esconder "Apagar partida" se não for admin**

Em `screens-stats.jsx`, encontre a função `MatchDetail` (procure por `function MatchDetail({`) e substitua por:

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

- [ ] **Step 2: Atualizar PlayerProfile pra controlar Editar e Remover**

Encontre `function PlayerProfile({` e substitua a assinatura e o conteúdo pelos blocos abaixo. Mantenha o resto da função igual; só mude:
1. Adicione `isAdmin` e `currentUserId` aos props.
2. Calcule `isOwner` no início.
3. Renderize Editar e Remover condicionalmente.

```jsx
function PlayerProfile({ playerId, state, stats, onBack, onSelectMatch, onUpdatePlayer, onDeletePlayer, isAdmin, currentUserId }) {
  const player = state.players.find(p=>p.id===playerId);
  const s = stats[playerId];
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  const playerMatches = state.matches.filter(m =>
    m.teamA.players.includes(playerId) || m.teamB.players.includes(playerId));
  const allRanked = Object.values(stats).sort((a,b)=>b.goals-a.goals);
  const rankPos = allRanked.findIndex(x => x.id === playerId) + 1;
  const isOwner = currentUserId && currentUserId === playerId;
  const canEdit = isAdmin || isOwner;

  if (!player || !s) return <div>Jogador não encontrado</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <button onClick={onBack} style={{
        background:'transparent', border: 0, color:'var(--fg-2)',
        fontFamily:'var(--font-body)', fontSize: 13, cursor:'pointer', padding: 0,
        alignSelf:'flex-start',
      }}>← voltar</button>

      <Card className="card-mobile" style={{ padding: 28 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 16, flexWrap:'wrap' }}>
          <Avatar player={player} size={88}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--fg-3)',
            }}>#{rankPos} artilharia · {(s.attendance*100).toFixed(0)}% de presença</div>
            <h1 className="h1-mobile" style={{
              fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
              textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
              fontSize: 40, margin: '4px 0 0 0', lineHeight: 1.1,
              wordBreak:'break-word',
            }}>{player.name}</h1>
            {player.nick && <div style={{ color:'var(--fg-2)', marginTop: 6, fontStyle:'italic' }}>"{player.nick}"</div>}
          </div>
          {canEdit && (
            <Button variant="ghost" onClick={()=>{
              const newName = prompt('Nome do jogador:', player.name);
              if (newName && newName.trim()) onUpdatePlayer(player.id, { name: newName.trim() });
            }}>Editar</Button>
          )}
        </div>

        <div className="grid-stats-6" style={{
          marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--line)',
        }}>
          <Stat label="Gols" value={s.goals}/>
          <Stat label="Ass." value={s.assists}/>
          <Stat label="V" value={s.wins}/>
          <Stat label="E" value={s.draws}/>
          <Stat label="D" value={s.losses}/>
        </div>
      </Card>

      <Card className="card-mobile">
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
              <div key={m.id} onClick={()=>onSelectMatch(m.id)} className="player-history-row" style={{
                display:'grid', gridTemplateColumns:'90px auto 1fr auto', gap: 12,
                alignItems:'center', padding: '12px 0',
                borderBottom: '1px solid var(--line)', cursor:'pointer',
              }}>
                <div style={{ color:'var(--fg-3)', fontSize: 12, fontFamily:'var(--font-mono)' }}>
                  {fmtDate(m.date)}
                </div>
                <Badge tone={tone}>{result} {myScore}-{oppScore}</Badge>
                <div className="hide-mobile" style={{ display:'flex', gap: 14, color:'var(--fg-2)', fontSize: 13 }}>
                  {goals>0 && <span>⚽ {goals}</span>}
                  {assists>0 && <span>🅰 {assists}</span>}
                </div>
                <div className="show-mobile" style={{ color:'var(--fg-2)', fontSize: 12, textAlign:'right' }}>
                  {goals>0 && <span style={{ marginRight: 8 }}>⚽ {goals}</span>}
                  {assists>0 && <span>🅰 {assists}</span>}
                </div>
                <Icon.Chevron width="14" height="14" color="var(--fg-3)" className="hide-mobile"/>
              </div>
            );
          })}
        </div>
      </Card>

      {isAdmin && (
        <div>
          <Button variant="danger" onClick={()=>{
            if (confirm(`Remover ${player.name}? Os registros em partidas antigas permanecem.`)) {
              onDeletePlayer(player.id);
            }
          }}>Remover jogador</Button>
        </div>
      )}
    </div>
  );
}
```

**Mudança no `History`** — também precisa receber `isAdmin` pra esconder o botão "Nova partida" se não for admin. Encontre `function History({ state, onSelectMatch, onNavigate })` e substitua por:

```jsx
function History({ state, onSelectMatch, onNavigate, isAdmin }) {
  const playerById = Object.fromEntries(state.players.map(p=>[p.id,p]));
  const matches = [...state.matches].reverse();
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 24 }}>
      <div className="mobile-row" style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
        <h1 className="h1-mobile" style={{
          fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
          textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
          fontSize: 36, margin: 0, lineHeight: 1.1,
        }}>Histórico</h1>
        {isAdmin && (
          <Button variant="accent" onClick={()=>onNavigate('new-match')}>
            <Icon.Plus width="16" height="16"/> Nova partida
          </Button>
        )}
      </div>
      {matches.length === 0 && (
        <Card className="card-mobile"><div style={{ textAlign:'center', padding: 30, color:'var(--fg-2)' }}>
          {isAdmin ? 'Nenhuma partida ainda. Bora começar!' : 'Nenhuma partida registrada ainda.'}
        </div></Card>
      )}
      {matches.map(m => (
        <Card key={m.id} className="card-mobile" onClick={()=>onSelectMatch(m.id)}>
          <MatchScoreboard match={m} playerById={playerById} compact/>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificação manual**

Recarregue. Como admin (você):
- Vai em Histórico → vê botão "Nova partida".
- Vai em qualquer partida → vê "Apagar partida".
- Vai num jogador → vê "Editar" e "Remover jogador".

Logout (clica no avatar, vai em Meu perfil, "Sair da conta"). Como anônimo:
- Histórico: **sem** botão "Nova partida".
- Match detail: **sem** "Apagar partida".
- Player profile: **sem** "Editar" e **sem** "Remover jogador".

- [ ] **Step 3: Commit**

```bash
git add screens-stats.jsx
git commit -m "Gate admin-only actions in MatchDetail, PlayerProfile and History"
```

---

## Task 12: Atualizar screens-edit.jsx — remover botão Adicionar dos Players

**Files:**
- Modify: `screens-edit.jsx`

- [ ] **Step 1: Atualizar Players pra remover o botão Adicionar**

Em `screens-edit.jsx`, encontre `function Players({` e substitua por:

```jsx
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
```

**Mudanças:**
- Remove `onAddPlayer` dos props (não é mais usado).
- Remove o estado `adding`/`name`.
- Remove o botão "Adicionar".
- Mensagem de empty-state explica que cadastro é pelo botão "Entrar".

- [ ] **Step 2: Atualizar NewMatch — onSave deve ser async**

Encontre em `screens-edit.jsx` a função `save` dentro de `NewMatch`. Atualize pra ser `async` e tratar erro:

```jsx
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const m = {
        date,
        teamA: { ...teamA, players: [...teamA.players] },
        teamB: { ...teamB, players: [...teamB.players] },
        events: events.map(e => ({ type: e.type, player: e.player, assist: e.assist, team: e.team })),
      };
      await onSave(m);
    } catch (err) {
      // toast já é mostrado pelo addMatch
    } finally {
      setSaving(false);
    }
  };
```

E atualize o botão de salvar pra refletir o estado de loading:

```jsx
            <Button variant="accent" onClick={save} disabled={!canSave || saving}>
              {saving ? 'Salvando…' : 'Salvar partida ✓'}
            </Button>
```

**Importante:** removeu o `id: newId('m')` do objeto da partida — banco gera o UUID. O `newId` foi removido do data.jsx na Task 8, então deixar a chamada quebraria.

- [ ] **Step 3: Verificação manual**

Recarregue como admin:
- Aba Jogadores: mostra **só sua conta** (você se cadastrou). **Sem** botão "Adicionar".
- Aba Histórico → "Nova partida" → escolher times: como você é o único jogador cadastrado, o picker mostra só você. Pra testar de verdade precisa cadastrar outros (ou criar um segundo account no Supabase manualmente).

Pra testar criar uma partida com 1 jogador de cada lado:
1. Selecione você no time A.
2. (não vai dar pra selecionar outro porque só tem você — pula o teste de salvar até ter mais usuários).

Como anônimo:
- Aba Jogadores: vê a lista (vazia ou só você), **sem** botão "Adicionar", mensagem "Ninguém cadastrado ainda…".

- [ ] **Step 4: Commit**

```bash
git add screens-edit.jsx
git commit -m "Players: remove Adicionar button (signup-only); NewMatch: async save"
```

---

## Task 13: Smoke test ponta-a-ponta + deploy

**Files:** (nenhum — só verificação + git push)

- [ ] **Step 1: Pra simular um segundo usuário, criar conta de teste**

Use um segundo email (pode ser um alias `+teste`, ex: `gabrielthomsen08+teste@gmail.com` — Gmail ignora o `+xxx`). Faça cadastro pelo app igual ao seu.

Esperado: nova linha em `profiles` no Supabase, `is_admin=false`.

- [ ] **Step 2: Como admin (você), criar uma partida real**

1. Logue como admin.
2. Vai em "Nova rodada".
3. Adicione você no time A, o usuário de teste no time B.
4. Próximo → adicione 1 ou 2 gols pra cada lado.
5. Salvar partida.

Esperado: redireciona pra detalhe da partida, mostra placar, gols listados, sem erro.

- [ ] **Step 3: Verificar persistência**

Recarregue (F5). Esperado:
- Partida continua aparecendo em Histórico.
- Stats atualizadas em Rankings (Artilharia, Vitórias).

- [ ] **Step 4: Logar como o usuário de teste e verificar bloqueios**

1. Faça logout.
2. Logue com o email `+teste`.
3. Verifique:
   - **Sem** botão "Nova rodada" no header.
   - Em Histórico, a partida aparece, mas **sem** botão "Nova partida".
   - Clicando na partida, **sem** botão "Apagar".
   - Clicando no perfil dele mesmo, vê "Editar" (porque é dono).
   - Clicando no SEU perfil (admin), **sem** "Editar" nem "Remover".

- [ ] **Step 5: Editar perfil próprio como user comum**

Logado como teste, clique no avatar (header) → "Meu perfil" → mude o nick → Salvar.

Esperado: "Salvo!" e o nick atualiza no perfil.

- [ ] **Step 6: Tentar burlar — forçar URL de admin**

Como user comum logado, abre DevTools → Console → digite:
```js
// força view de new-match
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
// ou simplesmente clica "Histórico" e tenta as ações
```

Mais simples: como esse app não tem URLs por view, simulamos navegando manualmente. Isso é só pra confirmar que mesmo se ele forçasse, o RLS bloqueia. Pra confirmar a RLS funcional:
```js
await window.deleteMatch('id-de-uma-partida-existente')
```

Esperado: erro tipo "permission denied" — RLS impediu.

- [ ] **Step 7: Push pra Vercel**

```bash
git push
```

Espera Vercel deployar (segundos).

- [ ] **Step 8: Testar na Vercel real**

Abre `https://futebol-segunda.vercel.app` no navegador.
- Faça logout local primeiro pra não confundir.
- Você já tem cadastro (mesmo email). Clica "Entrar" → digita seu email → recebe link → loga.
- **IMPORTANTE:** o link do email vai voltar pra Vercel (não pro localhost) porque agora você está clicando lá.
- Verifique que vê os botões de admin lá também.

- [ ] **Step 9: Commit final** (se sobrar alguma coisa não commitada)

```bash
git status
# se tiver coisa: git add . && git commit -m "..."
```

---

## Pós-implementação — checklist do usuário

Depois que o código estiver no ar:

- [ ] Manda o link `https://futebol-segunda.vercel.app` no grupo do zap da pelada.
- [ ] Pessoal se cadastra (email + nome).
- [ ] Você (admin) registra a primeira rodada real.
- [ ] (Opcional) customiza o template de magic link em PT no painel Supabase → Authentication → Email Templates.

## Limites conhecidos / fora de escopo

- Sem upload de foto de perfil (avatar continua sendo iniciais).
- Sem realtime — quando admin adiciona partida, outros usuários precisam recarregar.
- Sem URLs por view (não dá pra compartilhar link direto pra um perfil).
- Sem multi-admin (só um admin via SQL bootstrap).
- Sem importação de dados antigos (não havia nada).
