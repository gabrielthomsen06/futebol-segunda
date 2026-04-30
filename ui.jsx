// ui.jsx — Shared UI primitives + helpers

// Avatar with initials, deterministic color
const PALETTE = [
  '#e23a3a','#1f7ae0','#7a4adb','#e08a1f','#1fa37a',
  '#d11a8a','#3a85e2','#c97a00','#5a8a3d','#7a3aed',
  '#1aa1c4','#bd3a3a',
];
function colorFor(id) {
  let h = 0; for (let i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i))|0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function initialsOf(name) {
  return name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
}

function Avatar({ player, size = 32 }) {
  if (!player) return null;
  return (
    <div className="avatar" style={{
      width: size, height: size, borderRadius: '50%',
      background: colorFor(player.id), color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, fontFamily: 'var(--font-body)',
      letterSpacing: 0, flexShrink: 0,
    }}>
      {initialsOf(player.name)}
    </div>
  );
}

function PlayerChip({ player, size = 28, showName = true }) {
  if (!player) return null;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap: 8 }}>
      <Avatar player={player} size={size} />
      {showName && <span>{player.name}</span>}
    </span>
  );
}

function Card({ children, style, className = '', noPad = false, onClick, role }) {
  return (
    <div className={'card ' + className} role={role} onClick={onClick} style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      padding: noPad ? 0 : 20,
      backgroundImage: 'var(--card-tex)',
      boxShadow: 'var(--shadow)',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, align = 'left' }) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--fg-3)',
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-head)', fontSize: 36,
        fontWeight: 'var(--head-weight)', letterSpacing: 'var(--head-tracking)',
        textTransform: 'var(--head-transform)', lineHeight: 1, marginTop: 4,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      gap: 12, marginBottom: 16,
    }}>
      <h2 style={{
        fontFamily: 'var(--font-head)', fontWeight: 'var(--head-weight)',
        textTransform: 'var(--head-transform)', letterSpacing: 'var(--head-tracking)',
        fontSize: 20, margin: 0, lineHeight: 1.15,
      }}>{children}</h2>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

function Badge({ children, tone = 'default' }) {
  const tones = {
    default: { bg: 'var(--bg-2)', fg: 'var(--fg-2)' },
    win:     { bg: 'rgba(122,217,122,0.18)', fg: 'var(--win)' },
    draw:    { bg: 'rgba(245,208,74,0.18)',  fg: 'var(--draw)' },
    loss:    { bg: 'rgba(226,85,85,0.18)',   fg: 'var(--loss)' },
    accent:  { bg: 'rgba(245,208,74,0.18)',  fg: 'var(--accent)' },
  };
  const t = tones[tone] || tones.default;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap: 4,
      padding: '3px 8px', borderRadius: 999,
      background: t.bg, color: t.fg,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function Button({ children, variant = 'primary', onClick, disabled, type='button', style }) {
  const base = {
    height: 38, padding: '0 16px', borderRadius: 'var(--radius)',
    border: '1px solid transparent', fontSize: 14, fontWeight: 600,
    fontFamily: 'var(--font-body)', cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    transition: 'all .15s', opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary:   { background: 'var(--fg)', color: 'var(--bg)' },
    accent:    { background: 'var(--accent)', color: '#1a1a1a' },
    ghost:     { background: 'transparent', color: 'var(--fg)', border: '1px solid var(--line-2)' },
    danger:    { background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
            style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

// Simple icons via inline SVG (lucide-ish)
const Icon = {
  Trophy: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  Goal:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M12 12l3.5-2.5"/><path d="M12 12l-3.5-2.5"/><path d="M12 12l3.5 2.5"/><path d="M12 12l-3.5 2.5"/></svg>,
  Assist: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  Star:   (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.9L22 10l-5.5 4.7L18 22l-6-3.6L6 22l1.5-7.3L2 10l7.1-1.1L12 2z"/></svg>,
  Plus:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  X:      (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Calendar:(p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  Users:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Chevron:(p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  Whistle:(p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="14" r="6"/><path d="M14 9l8-3-2 7"/></svg>,
  Skull:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="M12.5 17l-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/></svg>,
};

// Player picker — searchable list
function PlayerPicker({ players, selected, onToggle, exclude = [], placeholder='Buscar jogador...' }) {
  const [q, setQ] = React.useState('');
  const filtered = players
    .filter(p => !exclude.includes(p.id))
    .filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <input className="input" placeholder={placeholder} value={q}
             onChange={e=>setQ(e.target.value)}
             style={{
               width:'100%', height: 38, padding: '0 12px',
               background: 'var(--surface-2)', border: '1px solid var(--line)',
               borderRadius: 'var(--radius)', color: 'var(--fg)', fontFamily: 'var(--font-body)',
               fontSize: 14, marginBottom: 10, outline: 'none',
             }}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 280, overflow:'auto' }}>
        {filtered.map(p => {
          const on = selected.includes(p.id);
          return (
            <button key={p.id} onClick={()=>onToggle(p.id)} type="button"
                    style={{
                      display:'flex', alignItems:'center', gap: 10,
                      padding: '6px 10px', borderRadius: 'var(--radius)',
                      border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'),
                      background: on ? 'rgba(245,208,74,0.12)' : 'var(--surface-2)',
                      color: 'var(--fg)', fontFamily: 'var(--font-body)',
                      fontSize: 13, cursor: 'pointer', textAlign:'left',
                    }}>
              <Avatar player={p} size={24}/>
              <span style={{ flex: 1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, {
  Avatar, PlayerChip, Card, Stat, SectionTitle, Badge, Button, Icon,
  PlayerPicker, colorFor, initialsOf,
});
