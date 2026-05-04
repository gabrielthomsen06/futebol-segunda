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
