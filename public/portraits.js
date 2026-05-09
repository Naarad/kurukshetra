// =========================================================
// Kurukshetra character emblems — medallion / seal style SVG.
// Each character is represented by an iconic glyph centered on
// a gold-trimmed coin in their team / signature color. No faces
// — just clean, thematic, instantly recognizable badges.
// Exposes window.Portraits.svg(charKey, opts) → string of SVG.
// =========================================================
(function () {
  const CHAR = {
    krishna:      { color: '#1f6feb', accent: '#ffd86e', glyph: 'chakra',     letter: 'क' },
    yudhishthira: { color: '#7a5208', accent: '#ffd86e', glyph: 'crown',      letter: 'य' },
    bhima:        { color: '#8a1c1c', accent: '#ffd86e', glyph: 'mace',       letter: 'भ' },
    arjuna:       { color: '#1f4673', accent: '#ffd86e', glyph: 'bow',        letter: 'अ' },
    nakula:       { color: '#0e7a5a', accent: '#ffd86e', glyph: 'twin',       letter: 'न' },
    sahadeva:     { color: '#5a2a8a', accent: '#ffd86e', glyph: 'scroll',     letter: 'स' },
    bhishma:      { color: '#5a5a5a', accent: '#e8e8e8', glyph: 'arrow_bed',  letter: 'भी' },
    duryodhana:   { color: '#3e1640', accent: '#c0392b', glyph: 'mace',       letter: 'दु' },
    dushasana:    { color: '#5e2410', accent: '#c0392b', glyph: 'flame',      letter: 'दु' },
    karna:        { color: '#a36210', accent: '#ffd86e', glyph: 'sun',        letter: 'क' },
    ashwatthama:  { color: '#0e6a4a', accent: '#5dd4ad', glyph: 'gem',        letter: 'अ' },
    shakuni:      { color: '#3a3a3a', accent: '#cccccc', glyph: 'dice',       letter: 'श' }
  };

  // Team colors used for outer ring fallback when no ring is requested
  const TEAM_RING = { pandava: '#5a8cff', kaurava: '#ff6b58' };

  function svg(charKey, opts = {}) {
    const c = CHAR[charKey] || CHAR.arjuna;
    const size = opts.size || 64;
    const ring = opts.ring || null;
    const id = 'p_' + charKey + '_' + Math.floor(Math.random() * 1e6);
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="g_${id}" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="${lighten(c.color, 0.45)}"/>
      <stop offset="60%" stop-color="${c.color}"/>
      <stop offset="100%" stop-color="${darken(c.color, 0.55)}"/>
    </radialGradient>
    <linearGradient id="gold_${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe294"/>
      <stop offset="50%" stop-color="#d6a23f"/>
      <stop offset="100%" stop-color="#7a5208"/>
    </linearGradient>
  </defs>
  <!-- outer team ring -->
  <circle cx="32" cy="32" r="31.5" fill="${ring || '#1a0e04'}" />
  <!-- outer gold rim -->
  <circle cx="32" cy="32" r="29" fill="url(#gold_${id})" />
  <!-- inner shadow rim -->
  <circle cx="32" cy="32" r="26.5" fill="${darken(c.color, 0.7)}" />
  <!-- center field -->
  <circle cx="32" cy="32" r="25" fill="url(#g_${id})" />
  <!-- ornamental dots around the rim -->
  ${ornamentDots(c.accent)}
  <!-- main glyph -->
  <g transform="translate(32 32)">
    ${glyphFor(c.glyph, c.accent)}
  </g>
  <!-- top highlight -->
  <ellipse cx="32" cy="14" rx="14" ry="3" fill="#ffffff" opacity="0.18"/>
  <!-- corner letter chip -->
  <g transform="translate(50 50)">
    <circle r="9" fill="${darken(c.color, 0.6)}" stroke="${c.accent}" stroke-width="1"/>
    <text y="3.5" text-anchor="middle" font-family="serif" font-size="10" font-weight="700" fill="${c.accent}">${c.letter}</text>
  </g>
</svg>`.trim();
  }

  function ornamentDots(color) {
    let s = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const x = 32 + Math.cos(a) * 27.7;
      const y = 32 + Math.sin(a) * 27.7;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.9" fill="${color}" opacity="0.85"/>`;
    }
    return s;
  }

  // ---- glyphs (drawn around origin in a 40×40 box, scaled appropriately) ----
  function glyphFor(name, accent) {
    switch (name) {
      case 'chakra':
        return chakra(accent);
      case 'crown':
        return crown(accent);
      case 'mace':
        return mace(accent);
      case 'bow':
        return bow(accent);
      case 'twin':
        return twin(accent);
      case 'scroll':
        return scroll(accent);
      case 'arrow_bed':
        return arrowBed(accent);
      case 'flame':
        return flame(accent);
      case 'sun':
        return sun(accent);
      case 'gem':
        return gem(accent);
      case 'dice':
        return dice(accent);
      default:
        return '';
    }
  }

  function chakra(c) {
    // 8-spoke chakra, classic Krishna's Sudarshan
    let spokes = '';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x1 = Math.cos(a) * 4, y1 = Math.sin(a) * 4;
      const x2 = Math.cos(a) * 14, y2 = Math.sin(a) * 14;
      spokes += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    let teeth = '';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x1 = Math.cos(a) * 14;
      const y1 = Math.sin(a) * 14;
      const x2 = Math.cos(a) * 16;
      const y2 = Math.sin(a) * 16;
      teeth += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`;
    }
    return `
${teeth}
<circle r="14" fill="none" stroke="${c}" stroke-width="2"/>
${spokes}
<circle r="3.5" fill="${c}"/>
<circle r="1.4" fill="#1a0a04"/>`;
  }

  function crown(c) {
    return `
<path d="M-15 6 L-12 -10 L-6 -2 L0 -14 L6 -2 L12 -10 L15 6 Z"
      fill="${c}" stroke="#1a0a04" stroke-width="1.2"/>
<rect x="-15" y="6" width="30" height="3" fill="${c}" stroke="#1a0a04" stroke-width="1"/>
<circle cx="0" cy="-9" r="2" fill="#c0392b" stroke="#1a0a04" stroke-width="0.6"/>
<circle cx="-12" cy="-7" r="1.4" fill="#fff" opacity="0.7"/>
<circle cx="12" cy="-7" r="1.4" fill="#fff" opacity="0.7"/>`;
  }

  function mace(c) {
    return `
<rect x="-1.6" y="-2" width="3.2" height="18" fill="${c}" stroke="#1a0a04" stroke-width="0.8"/>
<rect x="-3" y="14" width="6" height="2.5" fill="${c}" stroke="#1a0a04" stroke-width="0.8"/>
<g transform="translate(0 -7)">
  <circle r="9" fill="${c}" stroke="#1a0a04" stroke-width="1.2"/>
  <circle r="6" fill="none" stroke="#1a0a04" stroke-width="0.6"/>
  ${spikes(8, 9, 12, c)}
</g>`;
  }
  function spikes(count, r1, r2, color) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x1 = Math.cos(a) * r1, y1 = Math.sin(a) * r1;
      const x2 = Math.cos(a) * r2, y2 = Math.sin(a) * r2;
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
    }
    return s;
  }

  function bow(c) {
    return `
<!-- bow body -->
<path d="M-12 -14 Q14 0 -12 14" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<!-- string -->
<line x1="-12" y1="-14" x2="-12" y2="14" stroke="${c}" stroke-width="0.8" opacity="0.85"/>
<!-- arrow -->
<line x1="-10" y1="0" x2="14" y2="0" stroke="${c}" stroke-width="1.6"/>
<polygon points="14,-3 18,0 14,3" fill="${c}"/>
<!-- fletching -->
<polygon points="-10,-2 -12,0 -10,2" fill="${c}"/>`;
  }

  function twin(c) {
    // twin daggers crossed (Nakula / Sahadeva — Ashvini twins)
    return `
<g transform="rotate(-25)">
  <rect x="-1" y="-12" width="2" height="14" fill="${c}"/>
  <rect x="-2.5" y="2" width="5" height="2" fill="${c}"/>
  <rect x="-0.7" y="4" width="1.4" height="3" fill="${c}"/>
</g>
<g transform="rotate(25)">
  <rect x="-1" y="-12" width="2" height="14" fill="${c}"/>
  <rect x="-2.5" y="2" width="5" height="2" fill="${c}"/>
  <rect x="-0.7" y="4" width="1.4" height="3" fill="${c}"/>
</g>`;
  }

  function scroll(c) {
    return `
<rect x="-10" y="-8" width="20" height="16" rx="2" fill="${c}" opacity="0.95"/>
<rect x="-12" y="-8" width="2" height="16" rx="1" fill="${c}"/>
<rect x="10"  y="-8" width="2" height="16" rx="1" fill="${c}"/>
<line x1="-7" y1="-3" x2="7" y2="-3" stroke="#1a0a04" stroke-width="0.8"/>
<line x1="-7" y1="0"  x2="7" y2="0"  stroke="#1a0a04" stroke-width="0.8"/>
<line x1="-7" y1="3"  x2="7" y2="3"  stroke="#1a0a04" stroke-width="0.8"/>`;
  }

  function arrowBed(c) {
    // Bhishma's bed of arrows — multiple arrows pointing up
    let arrows = '';
    for (let i = -2; i <= 2; i++) {
      const x = i * 4;
      arrows += `
        <line x1="${x}" y1="-12" x2="${x}" y2="12" stroke="${c}" stroke-width="1.6"/>
        <polygon points="${x - 2},-12 ${x},-15 ${x + 2},-12" fill="${c}"/>
        <polygon points="${x - 2},12 ${x},14 ${x + 2},12" fill="${c}"/>`;
    }
    return arrows;
  }

  function flame(c) {
    return `
<path d="M0 -14 Q-8 -6 -7 0 Q-9 8 0 14 Q9 8 7 0 Q8 -6 0 -14 Z" fill="${c}" stroke="#1a0a04" stroke-width="0.8"/>
<path d="M0 -10 Q-4 -4 -3 2 Q-4 8 0 10 Q4 8 3 2 Q4 -4 0 -10 Z" fill="#ffe294" opacity="0.7"/>`;
  }

  function sun(c) {
    let rays = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x1 = Math.cos(a) * 9, y1 = Math.sin(a) * 9;
      const x2 = Math.cos(a) * 15, y2 = Math.sin(a) * 15;
      rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    return `
${rays}
<circle r="8" fill="${c}" stroke="#1a0a04" stroke-width="0.8"/>
<circle r="4" fill="none" stroke="#1a0a04" stroke-width="0.6"/>`;
  }

  function gem(c) {
    return `
<polygon points="0,-13 9,-3 5,12 -5,12 -9,-3" fill="${c}" stroke="#1a0a04" stroke-width="1.2"/>
<polygon points="0,-13 9,-3 -9,-3" fill="${lighten(c, 0.3)}" opacity="0.85"/>
<polygon points="0,-13 -9,-3 -5,12" fill="${darken(c, 0.2)}" opacity="0.7"/>
<line x1="-9" y1="-3" x2="9" y2="-3" stroke="#1a0a04" stroke-width="0.6"/>
<circle r="2" cy="3" fill="#fff" opacity="0.5"/>`;
  }

  function dice(c) {
    return `
<rect x="-12" y="-12" width="14" height="14" rx="2" fill="${c}" stroke="#1a0a04" stroke-width="1.2"/>
<circle cx="-5" cy="-5" r="1.4" fill="#1a0a04"/>
<circle cx="-5" cy="-5" r="0.5" fill="#fff" opacity="0.5"/>
<rect x="-2" y="-2" width="14" height="14" rx="2" fill="${c}" stroke="#1a0a04" stroke-width="1.2"/>
<circle cx="2"  cy="2" r="1.2" fill="#1a0a04"/>
<circle cx="5"  cy="5" r="1.2" fill="#1a0a04"/>
<circle cx="8"  cy="8" r="1.2" fill="#1a0a04"/>`;
  }

  function darken(hex, amt) {
    const [r, g, b] = parseHex(hex);
    return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
  }
  function lighten(hex, amt) {
    const [r, g, b] = parseHex(hex);
    return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
  }
  function parseHex(hex) {
    if (hex[0] !== '#') return [200, 200, 200];
    const h = hex.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // Old TRAITS shape kept for backward compat with the canvas player blob
  // (skin tone etc.) — but now it just returns a color hint.
  const TRAITS = {};
  Object.keys(CHAR).forEach(k => {
    TRAITS[k] = {
      skin: lighten(CHAR[k].color, 0.5),
      hair: '#1a0a04',
      beard: false,
      hat: 'none',
      motif: CHAR[k].glyph
    };
  });

  window.Portraits = { svg, TRAITS, CHAR };
})();
