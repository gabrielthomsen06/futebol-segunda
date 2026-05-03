# Multiusuário com Supabase — Design

**Data:** 2026-05-02
**Projeto:** Futebol de Segunda
**Status:** Aprovado pelo usuário, pronto pra plano de implementação

## Contexto

App de controle de pelada (segundas-feiras) hoje funcionando como SPA estática
em React 18 + Babel standalone via CDN, hospedada na Vercel, com persistência
em `localStorage`. Único usuário hoje. Necessidade: cada jogador da pelada
faz seu próprio cadastro, mas só o admin (dono do app) pode registrar partidas
e editar dados — pra não virar bagunça.

## Decisões aprovadas durante o brainstorming

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Quem pode ver o que sem logar? | Tudo aberto — rankings, histórico e perfis públicos. Login só pra ações de escrita. |
| 2 | Método de login? | Magic link (passwordless) via email. |
| 3 | O que pedir no cadastro? | Email + nome (nick fica pra editar depois no perfil). |
| 4 | O que o jogador logado pode fazer? | Editar nome e nick do próprio perfil. Sem upload de foto agora. |
| 5 | Jogador "convidado" sem cadastro? | Não. Estrito: 1 jogador = 1 conta. |
| Arquitetura | Onde fica a lógica? | Supabase direto do browser. RLS protege dados. Sem backend próprio. |

## Arquitetura

```
┌──────────────────────────────────────────┐
│  Browser (Vercel: index.html estático)  │
│  ┌────────────────────────────────────┐ │
│  │ React via CDN + Babel standalone   │ │
│  │ @supabase/supabase-js via CDN      │ │
│  └────────────────────────────────────┘ │
└──────────────────┬───────────────────────┘
                   │ HTTPS (publishable key)
                   ▼
┌──────────────────────────────────────────┐
│  Supabase Project                        │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Auth    │  │ Postgres │  │  RLS   │ │
│  │ (magic   │  │ profiles │  │ (segu- │ │
│  │  link)   │  │ matches  │  │  rança)│ │
│  └──────────┘  └──────────┘  └────────┘ │
└──────────────────────────────────────────┘
```

- **Sem backend próprio.** Browser fala direto com Supabase.
- **Segurança no banco** via Row Level Security — não no JS.
- **`localStorage`** continua existindo só pra preferências de tema/cor (`tweaks`).

## Schema do banco

### Tabela `profiles`

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  nick        text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);
```

- `id` é igual ao `auth.users.id` — relação 1:1 com a conta.
- Cascata em delete: se admin remove um user, o profile some junto.

### Tabela `matches`

```sql
create table matches (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  team_a      jsonb not null,   -- { name, color, players: [uuid], score: int }
  team_b      jsonb not null,   -- mesmo shape
  events      jsonb not null default '[]',  -- [{ type, player, assist, team }]
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);
```

**Por que JSONB e não tabelas relacionais separadas:**
- Modelo atual já é JSON aninhado.
- Partidas são imutáveis na prática (raramente editadas após salvar).
- Volume baixíssimo (uma rodada por semana).
- Evita 3-4 tabelas extras com joins.

**Trade-off aceito:** queries do tipo "todos os gols de jogador X" precisam
expandir o jsonb com `jsonb_array_elements`. Pra esse volume é irrelevante.

### Função helper

```sql
create function is_admin(uid uuid) returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from profiles where id = uid), false)
$$;
```

`security definer` permite chamar a função dentro das policies sem recursão.

### Trigger pós-signup

```sql
create function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Sem nome'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

Quando usuário confirma o magic link pela primeira vez, a linha em `profiles`
é criada automaticamente usando o `name` que veio no metadata do signup.

## Regras de acesso (RLS)

```sql
alter table profiles enable row level security;
alter table matches  enable row level security;

-- profiles: leitura pública, escrita controlada
create policy "profiles_select_all" on profiles
  for select using (true);

create policy "profiles_update_self_or_admin" on profiles
  for update using (auth.uid() = id or is_admin(auth.uid()));

-- Trigger blinda a coluna is_admin: só admin pode alterar
create function prevent_self_admin_promotion() returns trigger
language plpgsql security definer as $$
begin
  if old.is_admin is distinct from new.is_admin
     and not is_admin(auth.uid()) then
    raise exception 'Only admins can change is_admin';
  end if;
  return new;
end;
$$;

create trigger profiles_block_self_promotion
  before update on profiles
  for each row execute function prevent_self_admin_promotion();

create policy "profiles_delete_admin" on profiles
  for delete using (is_admin(auth.uid()));

-- (não há policy de INSERT — só o trigger insere)

-- matches: leitura pública, escrita só admin
create policy "matches_select_all" on matches
  for select using (true);

create policy "matches_admin_insert" on matches
  for insert with check (is_admin(auth.uid()));

create policy "matches_admin_update" on matches
  for update using (is_admin(auth.uid()));

create policy "matches_admin_delete" on matches
  for delete using (is_admin(auth.uid()));
```

**Bootstrap do admin:** o primeiro `is_admin = true` é setado manualmente
uma vez via SQL no painel do Supabase, no user do dono do app. Não há rota
no app pra se tornar admin — protege contra escalonamento de privilégio.

## Fluxo de autenticação

### Cadastro (jogador novo)
1. Tela inicial pública mostra rankings/histórico + botão "Entrar / Cadastrar".
2. Modal/tela com abas **Entrar** / **Cadastrar**.
3. **Cadastrar**: email + nome → `signInWithOtp({ email, options: { data: { name } }, shouldCreateUser: true })`.
4. Mensagem: "Te mandei um link no email."
5. Usuário clica no link → volta pra `https://futebol-segunda.vercel.app/?...` → SDK detecta o token, abre sessão, trigger cria profile.

### Login (já cadastrado)
1. Aba **Entrar**: só email → `signInWithOtp({ email, shouldCreateUser: false })`.
2. Mesmo fluxo de link.

### Sessão
- `supabase.auth.getSession()` no boot do app define `currentUser`.
- `onAuthStateChange()` mantém sincronizado entre abas e detecta logout.
- Sessão persiste via SDK (cookie/localStorage gerenciado).

### Logout
- `supabase.auth.signOut()` → volta ao modo anônimo.

### Detecção de admin
- Após login, busca `profiles` do user logado e lê `is_admin`.
- Boolean `isAdmin` no estado React controla a UI.

### Casos de borda
- Email já cadastrado tentando "Cadastrar" → mensagem "Esse email já tem conta".
- Email não cadastrado tentando "Entrar" → "Email não encontrado, faz cadastro".
- Sessão expira → cai pro modo anônimo silenciosamente, com toast.

## Mudanças na UI

### Header
- Botão **"Entrar"** quando anônimo. Avatar + nome + dropdown ("Meu perfil", "Sair") quando logado.
- Botão **"Nova"** só renderiza pra admin.

### Bottom nav (mobile)
- Mantém os 4 itens (Início, Rankings, Histórico, Jogadores). Não muda.

### Telas existentes

| Tela | Mudança |
|---|---|
| Dashboard | Sem mudança visual. Dados do Supabase. |
| Rankings | Sem mudança visual. |
| Histórico | Sem mudança visual. |
| Match Detail | Botão "Apagar partida" só pra admin. |
| Player Profile | Botão "Editar" só pra dono OU admin. "Remover jogador" só pra admin. |
| Players | Botão "Adicionar" some (cadastro é pelo signup). |
| New Match | Renderiza só pra admin. Anônimo/jogador comum vê "Acesso restrito" se forçar URL. |

### Telas novas

- **`view = 'auth'`** — Tela única com toggle Entrar/Cadastrar. Inputs grandes, mobile-friendly.
- **`view = 'me'`** — Perfil próprio editável (nome, nick) + botão Sair.

### Estados auxiliares

- **Loading no boot:** spinner enquanto `getSession()` resolve (~100ms).
- **Loading nos cards:** skeleton/spinner na primeira busca de dados.
- **Erro de rede:** toast "Sem conexão. Tentando de novo…" com retry.
- **Sessão expirada:** toast e fallback pro modo anônimo.

## Setup do projeto Supabase (configuração já feita pelo usuário)

✅ Projeto criado: `bnikdaesbbzprtyxauxe`
✅ Project URL: `https://bnikdaesbbzprtyxauxe.supabase.co`
✅ Publishable key obtida (segura no browser)
✅ Secret key revogada após exposição acidental no chat
✅ Site URL configurada: `https://futebol-segunda.vercel.app`
✅ Redirect URLs: `https://futebol-segunda.vercel.app/**` e `http://localhost:8000/**`

**Pendente (executar após implementação do código):**
- Rodar script SQL único no SQL Editor (cria tabelas, RLS, função, trigger).
- Customizar template do magic link em português (opcional).

## Migração de dados

Trivial — `localStorage` já está zerado (commit anterior limpou o seed).

**Bootstrap pós-deploy:**
1. Dono acessa `https://futebol-segunda.vercel.app`.
2. Faz cadastro com email + nome.
3. Confirma magic link.
4. Roda no SQL Editor:
   ```sql
   UPDATE profiles SET is_admin = true
   WHERE id = (SELECT id FROM auth.users WHERE email='gabrielthomsen08@gmail.com');
   ```
5. Recarrega o app — agora vê os botões de admin.
6. Compartilha o link da Vercel no grupo do zap pra pessoal se cadastrar.

`localStorage` antigo dos navegadores: deixar como está. Os dados ficam órfãos
mas não atrapalham — o app passa a ler tudo do Supabase. `localStorage`
continua usado só pra preferências de tema (`tweaks`).

## Estrutura de arquivos após implementação

```
index.html               # CDN React + CDN @supabase/supabase-js
config.jsx               # Project URL + publishable key (commitado, é público)
supabase.jsx             # Client + funções de fetch/mutation (substitui data.jsx no fluxo)
auth.jsx                 # Hook useAuth + telas Auth/Me
data.jsx                 # Mantido só pra helpers (fmtDate, newId)
themes.jsx               # Sem mudança
ui.jsx                   # Avatar/Card/Button mantidos, novos: Toast, Spinner
screens-stats.jsx        # Adapta pra usar dados async + flags isAdmin/isOwner
screens-edit.jsx         # NewMatch só pra admin; Players sem "Adicionar"
app.jsx                  # Rotas + integração useAuth + tela auth/me
tweaks-panel.jsx         # Sem mudança
docs/supabase-setup.sql  # Script SQL pra rodar no painel
```

## Princípios de implementação

- **Sem build step.** Continua tudo via CDN.
- **Componentes pequenos e focados.** Se um arquivo crescer demais durante
  a implementação, quebrar em arquivos menores.
- **Erros de rede tratados em toda mutação.** Toast + retry, nunca falhar silencioso.
- **Otimistic UI quando seguro** (ex: editar nick atualiza local e só depois sincroniza).
- **Fonte única de verdade:** Supabase. `localStorage` só pra preferências.

## Fora de escopo (deferido pra depois)

- Upload de foto de perfil (pediria Supabase Storage).
- Realtime subscriptions (auto-refresh quando admin adiciona partida).
- Dashboard administrativo dedicado (admin usa o app normal + painel do Supabase).
- Notificações por email após cada rodada.
- Importação de dados antigos (não há nada pra importar).
- Multi-admin (apenas um admin via SQL bootstrap).
- Domínio de email customizado pro magic link.
