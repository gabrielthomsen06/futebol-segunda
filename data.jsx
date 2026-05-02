// data.jsx — Dados, persistência e helpers do app

const STORAGE_KEY = 'fds_v2';

const SEED = {
  players: [],
  matches: [],
  seasonStart: new Date().toISOString().slice(0, 10),
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    if (!parsed.players || !parsed.matches) return SEED;
    return parsed;
  } catch {
    return SEED;
  }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Aggregations ────────────────────────────────────────────────────────────

function computeStats(state) {
  const stats = {};
  for (const p of state.players) {
    stats[p.id] = {
      id: p.id, name: p.name, nick: p.nick,
      goals: 0, assists: 0,
      wins: 0, draws: 0, losses: 0,
      played: 0,
    };
  }

  for (const m of state.matches) {
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
    s.attendance = state.matches.length ? s.played / state.matches.length : 0;
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

function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 8);
}

Object.assign(window, {
  loadState, saveState, resetState, computeStats,
  fmtDate, fmtDateLong, newId, SEED,
});
