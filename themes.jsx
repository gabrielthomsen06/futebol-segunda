// themes.jsx — Three visual vibes

const THEMES = {
  estadio: {
    name: 'Estádio',
    fonts: {
      head: '"Bebas Neue", "Oswald", system-ui, sans-serif',
      body: '"Inter", system-ui, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, monospace',
    },
    googleFonts: 'family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600',
    vars: {
      '--bg':         '#0d1f15',
      '--bg-2':       '#11281c',
      '--surface':    '#163524',
      '--surface-2':  '#1d4530',
      '--line':       'rgba(255,255,255,0.08)',
      '--line-2':     'rgba(255,255,255,0.14)',
      '--fg':         '#f1f5ed',
      '--fg-2':       'rgba(241,245,237,0.7)',
      '--fg-3':       'rgba(241,245,237,0.45)',
      '--accent':     '#f5d04a',
      '--accent-2':   '#7ad97a',
      '--danger':     '#e25555',
      '--win':        '#7ad97a',
      '--draw':       '#f5d04a',
      '--loss':       '#e25555',
      '--radius':     '6px',
      '--radius-lg':  '10px',
      '--shadow':     '0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.35)',
      '--head-tracking': '0.04em',
      '--head-transform': 'uppercase',
      '--head-weight': '400',
      '--card-tex': "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.05))",
      '--page-tex': "radial-gradient(1200px 600px at 30% -10%, rgba(122,217,122,0.06), transparent 60%), radial-gradient(900px 500px at 90% 110%, rgba(245,208,74,0.05), transparent 60%)",
    },
  },
  minimal: {
    name: 'Minimal',
    fonts: {
      head: '"Geist", "Inter", system-ui, sans-serif',
      body: '"Geist", "Inter", system-ui, sans-serif',
      mono: '"Geist Mono", ui-monospace, monospace',
    },
    googleFonts: 'family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500',
    vars: {
      '--bg':         '#fafaf7',
      '--bg-2':       '#f3f2ed',
      '--surface':    '#ffffff',
      '--surface-2':  '#f6f5f1',
      '--line':       'rgba(20,20,15,0.08)',
      '--line-2':     'rgba(20,20,15,0.14)',
      '--fg':         '#15140f',
      '--fg-2':       'rgba(21,20,15,0.62)',
      '--fg-3':       'rgba(21,20,15,0.4)',
      '--accent':     '#15140f',
      '--accent-2':   '#3d8b4a',
      '--danger':     '#c14040',
      '--win':        '#2d7a3d',
      '--draw':       '#a37418',
      '--loss':       '#c14040',
      '--radius':     '8px',
      '--radius-lg':  '14px',
      '--shadow':     '0 0.5px 0 rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.04)',
      '--head-tracking': '-0.02em',
      '--head-transform': 'none',
      '--head-weight': '600',
      '--card-tex': 'none',
      '--page-tex': 'none',
    },
  },
  varzea: {
    name: 'Várzea',
    fonts: {
      head: '"Archivo Black", "Anton", system-ui, sans-serif',
      body: '"Space Grotesk", system-ui, sans-serif',
      mono: '"Space Mono", ui-monospace, monospace',
    },
    googleFonts: 'family=Archivo+Black&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700',
    vars: {
      '--bg':         '#fef5d8',
      '--bg-2':       '#fce99c',
      '--surface':    '#ffffff',
      '--surface-2':  '#fef0b5',
      '--line':       '#1a1a1a',
      '--line-2':     '#1a1a1a',
      '--fg':         '#1a1a1a',
      '--fg-2':       '#1a1a1a',
      '--fg-3':       'rgba(26,26,26,0.55)',
      '--accent':     '#ff4a1c',
      '--accent-2':   '#1f7a3d',
      '--danger':     '#d11a1a',
      '--win':        '#1f7a3d',
      '--draw':       '#c97a00',
      '--loss':       '#d11a1a',
      '--radius':     '0px',
      '--radius-lg':  '0px',
      '--shadow':     '4px 4px 0 #1a1a1a',
      '--head-tracking': '0',
      '--head-transform': 'uppercase',
      '--head-weight': '900',
      '--card-tex': 'none',
      '--page-tex': 'none',
    },
  },
};

function applyTheme(themeKey) {
  const t = THEMES[themeKey] || THEMES.estadio;
  const root = document.documentElement;
  for (const k in t.vars) root.style.setProperty(k, t.vars[k]);
  root.style.setProperty('--font-head', t.fonts.head);
  root.style.setProperty('--font-body', t.fonts.body);
  root.style.setProperty('--font-mono', t.fonts.mono);
  // Load Google fonts once per theme
  const id = 'gf-' + themeKey;
  if (!document.getElementById(id)) {
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?${t.googleFonts}&display=swap`;
    document.head.appendChild(l);
  }
  document.body.dataset.theme = themeKey;
}

Object.assign(window, { THEMES, applyTheme });
