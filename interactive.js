/* =============================================================
   Gallery carousel + Tweaks palette
   ============================================================= */
(function () {
  // ------- Gallery -------
  const slides = Array.from(document.querySelectorAll('.gallery-slide'));
  const dotsWrap = document.getElementById('gal-dots');
  const curEl = document.getElementById('gal-cur');
  const totalEl = document.getElementById('gal-total');
  const capEl = document.getElementById('gal-caption');
  const prevBtn = document.getElementById('gal-prev');
  const nextBtn = document.getElementById('gal-next');

  let cur = 0;
  totalEl.textContent = String(slides.length).padStart(2, '0');

  // build dots
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'gallery-dot' + (i === 0 ? ' active' : '');
    b.setAttribute('aria-label', `${i + 1}번 이미지로 이동`);
    b.addEventListener('click', () => go(i));
    dotsWrap.appendChild(b);
  });
  const dots = Array.from(dotsWrap.children);

  function go(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle('active', idx === cur));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === cur));
    curEl.textContent = String(cur + 1).padStart(2, '0');
    const cap = slides[cur].dataset.caption || '';
    capEl.textContent = cap;
  }

  prevBtn.addEventListener('click', () => go(cur - 1));
  nextBtn.addEventListener('click', () => go(cur + 1));

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') go(cur - 1);
    if (e.key === 'ArrowRight') go(cur + 1);
  });

  // ------- Tweaks: palette variants pulled from the interior art -------
  const PALETTES = /*EDITMODE-BEGIN*/{
    "active": "nathan"
  }/*EDITMODE-END*/;

  const PRESETS = {
    nathan: {
      label: '나단',
      tokens: {
        '--navy': '#2a2e5f', '--navy-soft': '#3c4178',
        '--ivory': '#f4ede1', '--ivory-deep': '#ece3d2', '--cream': '#faf6ee',
        '--sage': '#7f9a95', '--teal': '#4f6f72',
        '--terracotta': '#c07559', '--slate-blue': '#8da1b8',
        '--ink': '#1f2033', '--muted': '#6d6a62', '--rule': '#d9cfbb',
      },
      swatch: 'linear-gradient(135deg, #2a2e5f 0 50%, #c07559 50% 100%)',
    },
    sage: {
      label: '세이지',
      tokens: {
        '--navy': '#2f4a42', '--navy-soft': '#456a5f',
        '--ivory': '#f2ecdf', '--ivory-deep': '#e4dcc9', '--cream': '#f8f3e7',
        '--sage': '#8aa69f', '--teal': '#4f6f72',
        '--terracotta': '#b8664d', '--slate-blue': '#8a9a8b',
        '--ink': '#1f2a26', '--muted': '#6b6b5c', '--rule': '#cfc6b0',
      },
      swatch: 'linear-gradient(135deg, #2f4a42 0 50%, #b8664d 50% 100%)',
    },
    terracotta: {
      label: '테라코타',
      tokens: {
        '--navy': '#8a3a28', '--navy-soft': '#a55745',
        '--ivory': '#faf0e4', '--ivory-deep': '#f0e0ce', '--cream': '#fdf7ec',
        '--sage': '#7f9a95', '--teal': '#4f6f72',
        '--terracotta': '#2a2e5f', '--slate-blue': '#8da1b8',
        '--ink': '#2a1a12', '--muted': '#7a5a4c', '--rule': '#e3cdb4',
      },
      swatch: 'linear-gradient(135deg, #8a3a28 0 50%, #2a2e5f 50% 100%)',
    },
    pride: {
      label: '프라이드',
      tokens: {
        '--navy': '#1f2033', '--navy-soft': '#3a3c66',
        '--ivory': '#fbf6ec', '--ivory-deep': '#f2e9d6', '--cream': '#fefbf4',
        '--sage': '#d17d52', '--teal': '#6b3e95',
        '--terracotta': '#e0a233', '--slate-blue': '#3a7db5',
        '--ink': '#1f2033', '--muted': '#6d6a62', '--rule': '#d9cfbb',
      },
      swatch: 'conic-gradient(from 210deg, #d0405b, #e0a233, #4e9a3f, #3a7db5, #6b3e95, #d0405b)',
    },
  };

  const row = document.getElementById('palette-row');
  Object.entries(PRESETS).forEach(([key, p]) => {
    const b = document.createElement('button');
    b.className = 'tweaks-swatch';
    b.style.background = p.swatch;
    b.dataset.key = key;
    const lab = document.createElement('span');
    lab.textContent = p.label;
    b.appendChild(lab);
    b.addEventListener('click', () => applyPalette(key));
    row.appendChild(b);
  });

  function applyPalette(key) {
    const p = PRESETS[key]; if (!p) return;
    const root = document.documentElement;
    Object.entries(p.tokens).forEach(([k, v]) => root.style.setProperty(k, v));
    Array.from(row.children).forEach(c => c.classList.toggle('active', c.dataset.key === key));
    // persist via host (no-op outside tweak mode)
    try {
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { active: key } }, '*');
    } catch {}
  }

  applyPalette(PALETTES.active || 'nathan');

  // ------- Tweak mode wiring -------
  const panel = document.getElementById('tweaks');
  window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type === '__activate_edit_mode') panel.classList.add('open');
    if (d.type === '__deactivate_edit_mode') panel.classList.remove('open');
  });
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
})();
