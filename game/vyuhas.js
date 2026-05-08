// Procedural generators for Mahabharat battle formations.
// Each generator is seeded so subsequent rounds produce visually different
// variants of the same formation flavor (different ring counts, gap angles,
// mirror, jitter, entry/exit positions). The pattern stays recognizable.

const CELL = 32;
const GRID_W = 50;
const GRID_H = 36;

function key(x, y) { return x + ',' + y; }
function emptyWalls() { return new Set(); }

function addBorder(walls) {
  for (let x = 0; x < GRID_W; x++) {
    walls.add(key(x, 0));
    walls.add(key(x, GRID_H - 1));
  }
  for (let y = 0; y < GRID_H; y++) {
    walls.add(key(0, y));
    walls.add(key(GRID_W - 1, y));
  }
}

// mulberry32 PRNG so the same seed gives the same maze (useful for testing)
function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(rng, lo, hi) { return Math.floor(lo + rng() * (hi - lo + 1)); }
function inBounds(x, y) { return x > 0 && x < GRID_W - 1 && y > 0 && y < GRID_H - 1; }
function formationResult(v) { return { ...v, width: GRID_W, height: GRID_H, cellSize: CELL }; }

// CHAKRAVYUHA — concentric rings with rotating gaps
function chakravyuha(seed) {
  const rng = makeRng(seed);
  const walls = emptyWalls();
  addBorder(walls);
  const cx = Math.floor(GRID_W / 2) + randInt(rng, -3, 3);
  const cy = Math.floor(GRID_H / 2) + randInt(rng, -2, 2);
  const numRings = randInt(rng, 3, 5);
  const baseR = randInt(rng, 3, 5);
  const ringStep = randInt(rng, 3, 4);
  const gapWidth = 0.20 + rng() * 0.18;
  const baseGapAngle = rng() * Math.PI * 2;
  const angleStep = (rng() * 1.6) - 0.8;

  for (let idx = 0; idx < numRings; idx++) {
    const r = baseR + idx * ringStep;
    const gapAngle = (baseGapAngle + idx * angleStep) % (Math.PI * 2);
    for (let a = 0; a < 360; a += 4) {
      const rad = a * Math.PI / 180;
      const diff = Math.abs(((rad - gapAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (diff < gapWidth) continue;
      const x = Math.round(cx + Math.cos(rad) * r);
      const y = Math.round(cy + Math.sin(rad) * r);
      if (inBounds(x, y)) walls.add(key(x, y));
    }
  }
  const entrySide = randInt(rng, 0, 3);
  const entry = pickEntry(entrySide, cy, cx);
  return formationResult({
    name: 'Chakravyuha',
    period: 'Day 13',
    architect: 'Drona',
    lore: 'The spiral wheel formation arranged by Drona on the thirteenth day of Kurukshetra. Concentric rings of soldiers, each gap rotated, designed so an attacker who entered could not find their way out. Abhimanyu, son of Arjuna, learned the entry but not the exit — he broke six rings before the seventh closed and seven warriors slew him together.',
    strategy: {
      attackers: 'Move radially toward the center. Watch the rotation of each ring — the gaps don\'t line up.',
      defenders: 'Trap the gaps and the centre. The deeper an attacker goes, the harder it is for them to retreat.'
    },
    walls,
    entry,
    exit: { x: cx, y: cy },
    suggestedTrapZones: [{ x: cx - 6, y: cy - 6, w: 12, h: 12 }]
  });
}

// PADMAVYUHA — lotus petals
function padmavyuha(seed) {
  const rng = makeRng(seed);
  const walls = emptyWalls();
  addBorder(walls);
  const cx = Math.floor(GRID_W / 2) + randInt(rng, -2, 2);
  const cy = Math.floor(GRID_H / 2) + randInt(rng, -2, 2);
  const petals = randInt(rng, 5, 8);
  const petalLen = randInt(rng, 9, 13);
  const petalRot = rng() * Math.PI * 2;
  const opening = 0.14 + rng() * 0.14;
  for (let p = 0; p < petals; p++) {
    const angle = petalRot + (p / petals) * Math.PI * 2;
    for (let l = 2; l < petalLen; l++) {
      const ax = Math.round(cx + Math.cos(angle - opening) * l);
      const ay = Math.round(cy + Math.sin(angle - opening) * l);
      const bx = Math.round(cx + Math.cos(angle + opening) * l);
      const by = Math.round(cy + Math.sin(angle + opening) * l);
      if (l > 2) {
        if (inBounds(ax, ay)) walls.add(key(ax, ay));
        if (inBounds(bx, by)) walls.add(key(bx, by));
      }
    }
  }
  return formationResult({
    name: 'Padmavyuha',
    period: 'Day 13',
    architect: 'Drona',
    lore: 'The lotus formation. Petals radiate outward from a central command. In legend, only Krishna and Arjuna fully knew how to enter and exit — every other warrior who tried was caught between the petals.',
    strategy: {
      attackers: 'Find a petal whose tip opens outward. Push to the centre between two petals; never along their length.',
      defenders: 'Place traps in the corridors between petals — that\'s where attackers must funnel.'
    },
    walls,
    entry: { x: 1, y: 1 + randInt(rng, 0, GRID_H - 3) },
    exit: { x: cx, y: cy },
    suggestedTrapZones: [{ x: cx - 4, y: cy - 4, w: 8, h: 8 }]
  });
}

// GARUDAVYUHA — eagle wings spread wide with a beak
function garudavyuha(seed) {
  const rng = makeRng(seed);
  const walls = emptyWalls();
  addBorder(walls);
  const cx = Math.floor(GRID_W / 2) + randInt(rng, -3, 3);
  const cy = Math.floor(GRID_H / 2) + randInt(rng, -2, 2);
  const wingSpan = randInt(rng, 12, 16);
  const beakLen = randInt(rng, 5, 8);
  const wingSlope = 0.4 + rng() * 0.4;
  const mirrored = rng() > 0.5;
  const beakDir = mirrored ? -1 : 1;

  for (let y = cy - 2; y <= cy + 2; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      if (x === cx - 8 || x === cx + 8 || y === cy - 2 || y === cy + 2) {
        if (inBounds(x, y)) walls.add(key(x, y));
      }
    }
  }
  for (let i = 0; i < wingSpan; i++) {
    const drop = Math.floor(i * wingSlope);
    [
      [cx - i, cy - 2 - drop],
      [cx + i, cy - 2 - drop],
      [cx - i, cy + 2 + drop],
      [cx + i, cy + 2 + drop]
    ].forEach(([x, y]) => { if (inBounds(x, y)) walls.add(key(x, y)); });
  }
  for (let i = 0; i < beakLen; i++) {
    [
      [cx + (8 + i) * beakDir, cy - i],
      [cx + (8 + i) * beakDir, cy + i]
    ].forEach(([x, y]) => { if (inBounds(x, y)) walls.add(key(x, y)); });
  }
  return formationResult({
    name: 'Garudavyuha',
    period: 'Day 6',
    architect: 'Bhishma',
    lore: 'The eagle formation, named for Vishnu\'s mount. Wings sweep wide to envelop, the beak forms a killing chokepoint at the spear-tip. Used to overwhelm a single point and then close the wings around survivors.',
    strategy: {
      attackers: 'Avoid the beak — it\'s a death funnel. Try to swing wide around a wing tip.',
      defenders: 'Trap the beak chokepoint. Anyone caught there has nowhere to run.'
    },
    walls,
    entry: { x: 1, y: cy },
    exit: { x: GRID_W - 2, y: cy },
    suggestedTrapZones: [{ x: cx + 5 * beakDir, y: cy - 3, w: 10, h: 6 }]
  });
}

// MAKARAVYUHA — long crocodile body with snapping jaw
function makaravyuha(seed) {
  const rng = makeRng(seed);
  const walls = emptyWalls();
  addBorder(walls);
  const cy = Math.floor(GRID_H / 2) + randInt(rng, -2, 2);
  const channelHalf = randInt(rng, 3, 5);
  const ribGap = randInt(rng, 3, 5);
  const jawLen = randInt(rng, 5, 7);
  const mirrored = rng() > 0.5;

  const left = mirrored ? GRID_W - 4 : 4;
  const right = mirrored ? 8 : GRID_W - 8;
  const stepDir = mirrored ? -1 : 1;
  const xStart = Math.min(left, right), xEnd = Math.max(left, right);

  for (let x = xStart; x < xEnd; x++) {
    walls.add(key(x, cy - channelHalf));
    walls.add(key(x, cy + channelHalf));
  }
  for (let x = xStart + 2; x < xEnd; x += ribGap) {
    for (let dy = -channelHalf + 1; dy <= channelHalf - 1; dy++) {
      if (dy === 0) continue;
      if (inBounds(x, cy + dy)) walls.add(key(x, cy + dy));
    }
  }
  for (let i = 0; i < jawLen; i++) {
    [
      [right + i * stepDir, cy - channelHalf - i],
      [right + i * stepDir, cy + channelHalf + i]
    ].forEach(([x, y]) => { if (inBounds(x, y)) walls.add(key(x, y)); });
  }
  return formationResult({
    name: 'Makaravyuha',
    period: 'Day 8',
    architect: 'Bhishma',
    lore: 'The crocodile formation. A long, narrow corridor of warriors with a crushing jaw at the head. Designed to channel the enemy into a tight kill-zone.',
    strategy: {
      attackers: 'Speed through the body — don\'t linger between the ribs. The jaw closes fast.',
      defenders: 'Place traps in the rib gaps and inside the jaw. The corridor leaves nowhere to dodge.'
    },
    walls,
    entry: mirrored ? { x: GRID_W - 2, y: cy } : { x: 1, y: cy },
    exit: mirrored ? { x: 1, y: cy } : { x: GRID_W - 2, y: cy },
    suggestedTrapZones: [
      mirrored
        ? { x: 6, y: cy - 3, w: 8, h: 6 }
        : { x: GRID_W - 14, y: cy - 3, w: 8, h: 6 }
    ]
  });
}

// FREE BUILD — empty arena, defenders design the maze themselves
function freebuild(seed) {
  const walls = emptyWalls();
  addBorder(walls);
  return formationResult({
    name: 'Free Build',
    period: 'Custom',
    architect: 'You',
    lore: 'No formation laid down by ancients. The defending team designs the field from scratch — every wall and every trap is theirs to place. Use the extended setup phase to craft a deathtrap of your own making.',
    strategy: {
      attackers: 'You are walking into someone\'s imagination. Expect anything.',
      defenders: 'Place walls to funnel attackers, then traps to punish where they must walk. You have 90 seconds.'
    },
    walls,
    entry: { x: 1, y: Math.floor(GRID_H / 2) },
    exit: { x: GRID_W - 2, y: Math.floor(GRID_H / 2) },
    suggestedTrapZones: []
  });
}

function pickEntry(side, cy, cx) {
  switch (side) {
    case 0: return { x: 1, y: cy };
    case 1: return { x: GRID_W - 2, y: cy };
    case 2: return { x: cx, y: 1 };
    default: return { x: cx, y: GRID_H - 2 };
  }
}

const VYUHAS = { chakravyuha, padmavyuha, garudavyuha, makaravyuha, freebuild };

function generate(name, seed) {
  const fn = VYUHAS[name];
  if (!fn) throw new Error('Unknown vyuha: ' + name);
  const s = (seed === undefined) ? (Date.now() & 0xffffffff) : seed;
  const v = fn(s);
  return { ...v, walls: Array.from(v.walls), seed: s };
}

function isWalkable(walls, x, y) { return !walls.has(key(x, y)); }

module.exports = { VYUHAS, generate, isWalkable, key, CELL, GRID_W, GRID_H };
