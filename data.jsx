// data.jsx — Dados, persistência e helpers do app

const STORAGE_KEY = 'fds_v1';

const PLAYERS_INIT = [
  { id: 'p1',  name: 'Poletti',       nick: 'Goleiro' },
  { id: 'p2',  name: 'Teteu',         nick: '' },
  { id: 'p3',  name: 'Lavina',        nick: '' },
  { id: 'p4',  name: 'Gustavo',       nick: '' },
  { id: 'p5',  name: 'Gamba',         nick: '' },
  { id: 'p6',  name: 'Paulista',      nick: '' },
  { id: 'p7',  name: 'Brum',          nick: '' },
  { id: 'p8',  name: 'GTA',           nick: '' },
  { id: 'p9',  name: 'Arthur',        nick: '' },
  { id: 'p10', name: 'Bertoli',       nick: '' },
  { id: 'p11', name: 'Vini Branco',   nick: '' },
  { id: 'p12', name: 'Willian Branco',nick: '' },
];

// Partidas fictícias para demonstrar — 6 segundas
function buildSeedMatches() {
  const dates = [
    '2026-03-23', '2026-03-30', '2026-04-06',
    '2026-04-13', '2026-04-20', '2026-04-27',
  ];
  const ids = PLAYERS_INIT.map(p => p.id);
  // hand-curated rounds para ficar realista
  const rounds = [
    {
      teamA: { name: 'Coloridos', color: '#e23a3a', players: ['p1','p3','p5','p7','p9','p11'], score: 4 },
      teamB: { name: 'Brancos',   color: '#f4f1ea', players: ['p2','p4','p6','p8','p10','p12'], score: 2 },
      events: [
        { type:'goal', player:'p5',  assist:'p3'  },
        { type:'goal', player:'p11', assist:'p7'  },
        { type:'goal', player:'p9',  assist:'p11' },
        { type:'goal', player:'p3',  assist:null  },
        { type:'goal', player:'p4',  assist:'p6', team:'B' },
        { type:'goal', player:'p10', assist:null, team:'B' },
      ],
      mvp: 'p11', flop: 'p2',
    },
    {
      teamA: { name: 'Coloridos', color: '#e23a3a', players: ['p2','p3','p5','p8','p10','p11'], score: 3 },
      teamB: { name: 'Brancos',   color: '#f4f1ea', players: ['p1','p4','p6','p7','p9','p12'], score: 3 },
      events: [
        { type:'goal', player:'p5',  assist:'p11' },
        { type:'goal', player:'p3',  assist:'p10' },
        { type:'goal', player:'p11', assist:'p8'  },
        { type:'goal', player:'p9',  assist:'p7', team:'B' },
        { type:'goal', player:'p4',  assist:null, team:'B' },
        { type:'goal', player:'p6',  assist:'p9', team:'B' },
      ],
      mvp: 'p9', flop: 'p4',
    },
    {
      teamA: { name: 'Coloridos', color: '#e23a3a', players: ['p1','p4','p5','p7','p10','p12'], score: 5 },
      teamB: { name: 'Brancos',   color: '#f4f1ea', players: ['p2','p3','p6','p8','p9','p11'], score: 1 },
      events: [
        { type:'goal', player:'p5',  assist:'p7' },
        { type:'goal', player:'p7',  assist:'p4' },
        { type:'goal', player:'p5',  assist:'p10' },
        { type:'goal', player:'p12', assist:null },
        { type:'goal', player:'p4',  assist:'p7' },
        { type:'goal', player:'p11', assist:'p3', team:'B' },
      ],
      mvp: 'p5', flop: 'p8',
    },
    {
      teamA: { name: 'Coloridos', color: '#e23a3a', players: ['p3','p4','p6','p9','p11','p12'], score: 2 },
      teamB: { name: 'Brancos',   color: '#f4f1ea', players: ['p1','p2','p5','p7','p8','p10'], score: 4 },
      events: [
        { type:'goal', player:'p9',  assist:'p11' },
        { type:'goal', player:'p11', assist:null },
        { type:'goal', player:'p5',  assist:'p2', team:'B' },
        { type:'goal', player:'p7',  assist:'p10', team:'B' },
        { type:'goal', player:'p5',  assist:'p7', team:'B' },
        { type:'goal', player:'p10', assist:'p8', team:'B' },
      ],
      mvp: 'p7', flop: 'p3',
    },
    {
      teamA: { name: 'Coloridos', color: '#e23a3a', players: ['p1','p2','p5','p6','p9','p11'], score: 6 },
      teamB: { name: 'Brancos',   color: '#f4f1ea', players: ['p3','p4','p7','p8','p10','p12'], score: 5 },
      events: [
        { type:'goal', player:'p11', assist:'p9'  },
        { type:'goal', player:'p5',  assist:'p2'  },
        { type:'goal', player:'p11', assist:null  },
        { type:'goal', player:'p9',  assist:'p11' },
        { type:'goal', player:'p6',  assist:null  },
        { type:'goal', player:'p11', assist:'p5'  },
        { type:'goal', player:'p4',  assist:'p7', team:'B' },
        { type:'goal', player:'p7',  assist:'p10',team:'B' },
        { type:'goal', player:'p10', assist:null, team:'B' },
        { type:'goal', player:'p4',  assist:'p3', team:'B' },
        { type:'goal', player:'p12', assist:'p7', team:'B' },
      ],
      mvp: 'p11', flop: 'p1',
    },
    {
      teamA: { name: 'Coloridos', color: '#e23a3a', players: ['p2','p4','p7','p9','p10','p11'], score: 3 },
      teamB: { name: 'Brancos',   color: '#f4f1ea', players: ['p1','p3','p5','p6','p8','p12'], score: 2 },
      events: [
        { type:'goal', player:'p11', assist:'p9'  },
        { type:'goal', player:'p7',  assist:'p4'  },
        { type:'goal', player:'p9',  assist:'p11' },
        { type:'goal', player:'p5',  assist:'p3', team:'B' },
        { type:'goal', player:'p12', assist:'p6', team:'B' },
      ],
      mvp: 'p11', flop: 'p8',
    },
  ];

  return rounds.map((r, i) => ({
    id: 'm' + (i + 1),
    date: dates[i],
    ...r,
  }));
}

const SEED = {
  players: PLAYERS_INIT,
  matches: buildSeedMatches(),
  seasonStart: '2026-03-23',
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
      played: 0, mvps: 0, flops: 0,
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

    if (m.mvp && stats[m.mvp]) stats[m.mvp].mvps++;
    if (m.flop && stats[m.flop]) stats[m.flop].flops++;
  }

  // Bola de Ouro score
  for (const id in stats) {
    const s = stats[id];
    s.points = s.goals * 3 + s.assists * 2 + s.wins * 1 + s.mvps * 4 - s.flops * 1;
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
