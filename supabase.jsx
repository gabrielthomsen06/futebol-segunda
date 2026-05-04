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
