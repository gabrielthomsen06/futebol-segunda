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

  // Só partidas finalizadas contam pros stats. Partidas agendadas
  // (played=false, "vai ocorrer em breve") são ignoradas até terem resultado.
  const playedMatches = matches.filter(m => m.played);

  for (const m of playedMatches) {
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
        // ev.assist: formato antigo (assistência embutida no gol). Mantido por
        // compatibilidade com partidas registradas antes da entrada por quantidade.
        if (ev.assist && stats[ev.assist]) stats[ev.assist].assists++;
      } else if (ev.type === 'assist') {
        if (stats[ev.player]) stats[ev.player].assists++;
      }
    }
  }

  for (const id in stats) {
    const s = stats[id];
    s.attendance = playedMatches.length ? s.played / playedMatches.length : 0;
  }

  return stats;
}

// Agrega gols/assistências por jogador numa única partida. Lida com o formato
// antigo (assistência embutida no gol) e o novo (eventos 'goal'/'assist'
// separados). Retorna { [playerId]: { goals, assists } }.
function matchTallies(events) {
  const t = {};
  const bump = (pid, key) => {
    if (!pid) return;
    if (!t[pid]) t[pid] = { goals: 0, assists: 0 };
    t[pid][key]++;
  };
  for (const ev of (events || [])) {
    if (ev.type === 'goal') {
      bump(ev.player, 'goals');
      if (ev.assist) bump(ev.assist, 'assists');
    } else if (ev.type === 'assist') {
      bump(ev.player, 'assists');
    }
  }
  return t;
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function fmtDateLong(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

Object.assign(window, { computeStats, matchTallies, fmtDate, fmtDateLong });
