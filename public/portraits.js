// =========================================================
// Kurukshetra character portraits — procedurally drawn SVG.
// Each character has distinctive features (skin tone, hair,
// beard, headwear, motif). No external image assets needed.
// Exposes window.Portraits.svg(charKey, opts) → string of SVG.
// =========================================================
(function () {
  // skin: bronze / fair / dark / blue (Krishna)
  // hair: black / white / grey / brown
  // headwear: crown, peacock-feather, helmet, hood, headband, none
  // motif: mace, bow, daggers, dice, chakra, none
  const TRAITS = {
    krishna:      { skin: '#2c5fa8', hair: '#000', beard: false, hat: 'peacock', motif: 'flute',  bg: '#143a6a' },
    yudhishthira: { skin: '#d2a878', hair: '#1a1108', beard: true,  hat: 'crown',    motif: 'staff',  bg: '#5e3e10' },
    bhima:        { skin: '#9c5e2b', hair: '#000',    beard: true,  hat: 'none',     motif: 'mace',   bg: '#5a1f12' },
    arjuna:       { skin: '#c89868', hair: '#000',    beard: false, hat: 'headband', motif: 'bow',    bg: '#1f4673' },
    nakula:       { skin: '#d8b288', hair: '#000',    beard: false, hat: 'circlet',  motif: 'dagger', bg: '#0f5f48' },
    sahadeva:     { skin: '#c8a070', hair: '#000',    beard: false, hat: 'circlet',  motif: 'scroll', bg: '#3a1f5a' },
    bhishma:      { skin: '#cfb89a', hair: '#e8e8e8', beard: true,  hat: 'crown',    motif: 'bow',    bg: '#4a4a4a' },
    duryodhana:   { skin: '#a86840', hair: '#000',    beard: true,  hat: 'crown',    motif: 'mace',   bg: '#3e1640' },
    dushasana:    { skin: '#a85a30', hair: '#000',    beard: true,  hat: 'none',     motif: 'mace',   bg: '#5e2410' },
    karna:        { skin: '#d49a52', hair: '#3a1a08', beard: false, hat: 'helmet',   motif: 'bow',    bg: '#7a3a08' },
    ashwatthama:  { skin: '#bfa176', hair: '#1a1108', beard: false, hat: 'gem',      motif: 'sword',  bg: '#1a4a3a' },
    shakuni:      { skin: '#a8845a', hair: '#5a4a30', beard: true,  hat: 'hood',     motif: 'dice',   bg: '#3a3a3a' }
  };

  function svg(charKey, opts = {}) {
    const t = TRAITS[charKey] || TRAITS.arjuna;
    const size = opts.size || 64;
    const showBg = opts.bg !== false;
    const ring = opts.ring || null; // optional ring color (team accent)
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" aria-label="${charKey}">
  ${showBg ? bg(t.bg, ring) : ''}
  <!-- shoulders -->
  <path d="M6 60 Q12 44 22 42 H42 Q52 44 58 60 Z" fill="${shoulderColor(t)}" />
  <path d="M22 42 Q24 48 32 50 Q40 48 42 42 Z" fill="${shadow(t.skin)}" />
  <!-- neck -->
  <rect x="28" y="38" width="8" height="6" rx="2" fill="${t.skin}" />
  <!-- head -->
  <ellipse cx="32" cy="28" rx="11" ry="13" fill="${t.skin}" />
  <!-- ear -->
  <ellipse cx="20" cy="28" rx="2" ry="3" fill="${shadow(t.skin)}" />
  <ellipse cx="44" cy="28" rx="2" ry="3" fill="${shadow(t.skin)}" />
  <!-- hair shadow on forehead, behind hat -->
  ${hairTop(t)}
  <!-- eyes -->
  <ellipse cx="27" cy="28" rx="1.2" ry="1.6" fill="#1a0a04"/>
  <ellipse cx="37" cy="28" rx="1.2" ry="1.6" fill="#1a0a04"/>
  <!-- brow -->
  <path d="M24 24 Q27 22 30 24" stroke="${t.hair}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <path d="M34 24 Q37 22 40 24" stroke="${t.hair}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <!-- nose -->
  <path d="M32 28 Q31 32 32 34 Q33 33 32 32" stroke="${shadow(t.skin)}" stroke-width="1" fill="none"/>
  <!-- mouth -->
  <path d="M28 36 Q32 38 36 36" stroke="#3a1a0c" stroke-width="1" fill="none" stroke-linecap="round"/>
  ${t.beard ? beard(t) : ''}
  <!-- tilak (forehead mark) on most -->
  ${tilak(charKey, t)}
  <!-- headwear -->
  ${headwear(t)}
  <!-- motif badge bottom-corner -->
  ${motif(t)}
</svg>`.trim();
  }

  function bg(color, ring) {
    const stop1 = lighten(color, 0.25);
    const stop2 = darken(color, 0.4);
    return `
<defs>
  <radialGradient id="bgg" cx="50%" cy="35%" r="80%">
    <stop offset="0" stop-color="${stop1}"/>
    <stop offset="1" stop-color="${stop2}"/>
  </radialGradient>
</defs>
<circle cx="32" cy="32" r="32" fill="url(#bgg)"/>
${ring ? `<circle cx="32" cy="32" r="30.5" fill="none" stroke="${ring}" stroke-width="2"/>` : ''}
`;
  }

  function shoulderColor(t) {
    // armored upper-body in a darkened skin or armor color
    return darken(t.skin, 0.55);
  }

  function hairTop(t) {
    // hair fringe under headwear
    if (t.hat === 'none' || t.hat === 'headband' || t.hat === 'circlet' || t.hat === 'gem') {
      return `<path d="M21 22 Q24 16 32 16 Q40 16 43 22 Q40 18 32 19 Q24 18 21 22 Z" fill="${t.hair}"/>`;
    }
    return `<path d="M22 22 Q24 18 32 18 Q40 18 42 22 Z" fill="${t.hair}" opacity="0.85"/>`;
  }

  function beard(t) {
    return `
<path d="M24 36 Q24 44 32 47 Q40 44 40 36 Q38 41 32 42 Q26 41 24 36 Z" fill="${t.hair}"/>
<path d="M28 39 Q30 44 32 44 Q34 44 36 39" stroke="${darken(t.hair, 0.3)}" stroke-width="0.6" fill="none"/>`;
  }

  function tilak(key, t) {
    if (key === 'shakuni' || key === 'duryodhana' || key === 'dushasana') return '';
    const color = key === 'krishna' ? '#fbe23a' : '#c0392b';
    return `<rect x="31.2" y="18" width="1.6" height="4.5" rx="0.6" fill="${color}"/>`;
  }

  function headwear(t) {
    switch (t.hat) {
      case 'crown': return `
<path d="M20 18 L24 8 L28 16 L32 6 L36 16 L40 8 L44 18 Z" fill="#f5d76e" stroke="#7a5208" stroke-width="0.6"/>
<rect x="20" y="17" width="24" height="3" fill="#b58610"/>
<circle cx="32" cy="11" r="1.4" fill="#c0392b"/>`;
      case 'peacock': return `
<!-- forehead band -->
<rect x="20" y="17" width="24" height="3" rx="1" fill="#fbe23a"/>
<!-- peacock feather -->
<path d="M44 16 Q52 6 50 0 Q48 6 46 12" fill="#1f8a5a"/>
<ellipse cx="49" cy="6" rx="2.2" ry="3.4" fill="#2c5fa8"/>
<ellipse cx="49" cy="6" rx="1" ry="1.8" fill="#fbe23a"/>
<ellipse cx="49" cy="6" rx="0.4" ry="0.8" fill="#1a0a04"/>`;
      case 'helmet': return `
<path d="M20 20 Q22 8 32 8 Q42 8 44 20 L42 22 H22 Z" fill="#8b6f3a" stroke="#3a2a08" stroke-width="0.6"/>
<rect x="22" y="20" width="20" height="3" fill="#b58610"/>
<circle cx="32" cy="12" r="2" fill="#fbe23a"/>
<rect x="31" y="8" width="2" height="8" fill="#fbe23a"/>`;
      case 'headband': return `
<rect x="20" y="20" width="24" height="3" rx="1" fill="#1f4673"/>
<path d="M20 22 L18 18 L16 24" fill="#1f4673"/>`;
      case 'circlet': return `
<rect x="22" y="20" width="20" height="2" rx="1" fill="#b58610"/>
<circle cx="32" cy="20" r="1.4" fill="#f5d76e"/>`;
      case 'hood': return `
<path d="M14 20 Q14 6 32 6 Q50 6 50 20 L46 22 Q44 16 32 16 Q20 16 18 22 Z" fill="#3a3022"/>
<path d="M16 20 Q16 8 32 8 Q48 8 48 20" fill="none" stroke="#1a1408" stroke-width="0.8"/>`;
      case 'gem': return `
<rect x="20" y="20" width="24" height="3" rx="1" fill="#1a4a3a"/>
<path d="M30 16 L32 12 L34 16 L32 18 Z" fill="#5dd4ad" stroke="#2a6048" stroke-width="0.5"/>
<path d="M32 12 L32 18" stroke="#fff" stroke-width="0.5" opacity="0.7"/>`;
      case 'none':
      default: return '';
    }
  }

  function motif(t) {
    // small motif badge bottom-right
    const cx = 53, cy = 53, r = 7;
    let inner = '';
    switch (t.motif) {
      case 'mace':   inner = `<circle cx="${cx + 1}" cy="${cy - 2}" r="3" fill="#5a3014"/><rect x="${cx - 0.5}" y="${cy - 1}" width="1" height="6" fill="#7a4a1a"/>`; break;
      case 'bow':    inner = `<path d="M${cx - 3} ${cy - 3} Q${cx + 4} ${cy} ${cx - 3} ${cy + 3}" stroke="#7a4a1a" stroke-width="1.2" fill="none"/><line x1="${cx - 3}" y1="${cy - 3}" x2="${cx - 3}" y2="${cy + 3}" stroke="#3a1a08" stroke-width="0.6"/>`; break;
      case 'dagger': inner = `<rect x="${cx - 0.5}" y="${cy - 4}" width="1" height="6" fill="#cccccc"/><rect x="${cx - 1.5}" y="${cy + 1}" width="3" height="2" fill="#7a4a1a"/>`; break;
      case 'dice':   inner = `<rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" rx="1" fill="#f0e6c8"/><circle cx="${cx - 1}" cy="${cy - 1}" r="0.6" fill="#1a0a04"/><circle cx="${cx + 1}" cy="${cy + 1}" r="0.6" fill="#1a0a04"/>`; break;
      case 'flute':  inner = `<rect x="${cx - 3.5}" y="${cy - 0.5}" width="7" height="1.5" rx="0.5" fill="#d4a050"/><circle cx="${cx - 2}" cy="${cy + 0.2}" r="0.3" fill="#3a1a08"/><circle cx="${cx + 1}" cy="${cy + 0.2}" r="0.3" fill="#3a1a08"/>`; break;
      case 'staff':  inner = `<rect x="${cx - 0.5}" y="${cy - 4}" width="1" height="8" fill="#7a5a2a"/><circle cx="${cx}" cy="${cy - 4}" r="1.4" fill="#f5d76e"/>`; break;
      case 'chakra': inner = `<circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="#f5d76e" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="0.8" fill="#f5d76e"/>`; break;
      case 'sword':  inner = `<rect x="${cx - 0.5}" y="${cy - 4}" width="1" height="6" fill="#cccccc"/><rect x="${cx - 2}" y="${cy + 1}" width="4" height="1" fill="#7a4a1a"/><rect x="${cx - 0.5}" y="${cy + 1}" width="1" height="3" fill="#7a4a1a"/>`; break;
      case 'scroll': inner = `<rect x="${cx - 3}" y="${cy - 2}" width="6" height="4" rx="1" fill="#f0e6c8"/><line x1="${cx - 2}" y1="${cy - 1}" x2="${cx + 2}" y2="${cy - 1}" stroke="#7a4a1a" stroke-width="0.4"/><line x1="${cx - 2}" y1="${cy}" x2="${cx + 2}" y2="${cy}" stroke="#7a4a1a" stroke-width="0.4"/>`; break;
      default: return '';
    }
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a0a04" stroke="#7a5208" stroke-width="0.6"/>${inner}`;
  }

  function darken(hex, amt) {
    const [r, g, b] = parseHex(hex);
    return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
  }
  function lighten(hex, amt) {
    const [r, g, b] = parseHex(hex);
    return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
  }
  function shadow(hex) { return darken(hex, 0.3); }
  function parseHex(hex) {
    if (hex[0] !== '#') return [200, 200, 200];
    const h = hex.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  window.Portraits = { svg, TRAITS };
})();
