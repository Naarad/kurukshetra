// Procedural generators for Mahabharat battle formations.
// Each returns: { width, height, cellSize, walls: Set<"x,y">, entry: {x,y}, exit: {x,y}, name, lore }
// Coords are in tile units. World pixel size = width*cellSize x height*cellSize.

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

// CHAKRAVYUHA — concentric rings with rotating gaps (the spiral that killed Abhimanyu).
function chakravyuha() {
  const walls = emptyWalls();
  addBorder(walls);
  const cx = Math.floor(GRID_W / 2);
  const cy = Math.floor(GRID_H / 2);
  const rings = [4, 7, 10, 13];
  rings.forEach((r, idx) => {
    // gap angle rotates per ring so it's a real spiral puzzle
    const gapAngle = (idx * 1.1) % (Math.PI * 2);
    for (let a = 0; a < 360; a += 4) {
      const rad = a * Math.PI / 180;
      // skip a ~30 deg gap so the player can pass through
      const diff = Math.abs(((rad - gapAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (diff < 0.26) continue;
      const x = Math.round(cx + Math.cos(rad) * r);
      const y = Math.round(cy + Math.sin(rad) * r);
      if (x > 0 && x < GRID_W - 1 && y > 0 && y < GRID_H - 1) walls.add(key(x, y));
    }
  });
  return {
    name: 'Chakravyuha',
    lore: 'The spiral wheel formation. Drona arranged it on Day 13. Abhimanyu broke six rings before falling.',
    width: GRID_W, height: GRID_H, cellSize: CELL,
    walls,
    entry: { x: 1, y: cy },
    exit: { x: cx, y: cy },
    suggestedTrapZones: [
      { x: cx - 6, y: cy - 6, w: 12, h: 12 }
    ]
  };
}

// PADMAVYUHA — lotus petals: chambered arcs around a center.
function padmavyuha() {
  const walls = emptyWalls();
  addBorder(walls);
  const cx = Math.floor(GRID_W / 2);
  const cy = Math.floor(GRID_H / 2);
  const petals = 6;
  const petalLen = 12;
  for (let p = 0; p < petals; p++) {
    const angle = (p / petals) * Math.PI * 2;
    for (let l = 2; l < petalLen; l++) {
      // two diverging walls per petal
      const ax = Math.round(cx + Math.cos(angle - 0.18) * l);
      const ay = Math.round(cy + Math.sin(angle - 0.18) * l);
      const bx = Math.round(cx + Math.cos(angle + 0.18) * l);
      const by = Math.round(cy + Math.sin(angle + 0.18) * l);
      if (l > 2) {
        if (ax > 0 && ax < GRID_W - 1 && ay > 0 && ay < GRID_H - 1) walls.add(key(ax, ay));
        if (bx > 0 && bx < GRID_W - 1 && by > 0 && by < GRID_H - 1) walls.add(key(bx, by));
      }
    }
  }
  return {
    name: 'Padmavyuha',
    lore: 'The lotus formation. Arjuna and Krishna alone knew how to enter and exit fully.',
    width: GRID_W, height: GRID_H, cellSize: CELL,
    walls,
    entry: { x: 1, y: 1 },
    exit: { x: cx, y: cy },
    suggestedTrapZones: [
      { x: cx - 4, y: cy - 4, w: 8, h: 8 }
    ]
  };
}

// GARUDAVYUHA — eagle wings spread wide with a beak chokepoint at the front.
function garudavyuha() {
  const walls = emptyWalls();
  addBorder(walls);
  const cx = Math.floor(GRID_W / 2);
  const cy = Math.floor(GRID_H / 2);

  // body / spine
  for (let y = cy - 2; y <= cy + 2; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      if (x === cx - 8 || x === cx + 8 || y === cy - 2 || y === cy + 2) walls.add(key(x, y));
    }
  }
  // wings sweeping back
  for (let i = 0; i < 14; i++) {
    walls.add(key(cx - i, cy - 2 - Math.floor(i * 0.6)));
    walls.add(key(cx + i, cy - 2 - Math.floor(i * 0.6)));
    walls.add(key(cx - i, cy + 2 + Math.floor(i * 0.6)));
    walls.add(key(cx + i, cy + 2 + Math.floor(i * 0.6)));
  }
  // beak chokepoint at the right
  for (let i = 0; i < 6; i++) {
    walls.add(key(cx + 8 + i, cy - i));
    walls.add(key(cx + 8 + i, cy + i));
  }
  return {
    name: 'Garudavyuha',
    lore: 'The eagle formation, named for Vishnu\'s mount. Wide wings, killing beak at the spearhead.',
    width: GRID_W, height: GRID_H, cellSize: CELL,
    walls,
    entry: { x: 1, y: cy },
    exit: { x: GRID_W - 2, y: cy },
    suggestedTrapZones: [
      { x: cx + 5, y: cy - 3, w: 10, h: 6 }
    ]
  };
}

// MAKARAVYUHA — long crocodile body with a snapping head.
function makaravyuha() {
  const walls = emptyWalls();
  addBorder(walls);
  const cy = Math.floor(GRID_H / 2);

  // long body channel walls (top and bottom)
  for (let x = 4; x < GRID_W - 8; x++) {
    walls.add(key(x, cy - 4));
    walls.add(key(x, cy + 4));
  }
  // ribs
  for (let x = 6; x < GRID_W - 10; x += 4) {
    for (let dy = -3; dy <= 3; dy++) {
      if (dy === 0) continue;
      walls.add(key(x, cy + dy));
    }
  }
  // jaw at the right
  for (let i = 0; i < 6; i++) {
    walls.add(key(GRID_W - 8 + i, cy - 4 - i));
    walls.add(key(GRID_W - 8 + i, cy + 4 + i));
  }
  return {
    name: 'Makaravyuha',
    lore: 'The crocodile formation. Long, narrow, with a crushing jaw at the head.',
    width: GRID_W, height: GRID_H, cellSize: CELL,
    walls,
    entry: { x: 1, y: cy },
    exit: { x: GRID_W - 2, y: cy },
    suggestedTrapZones: [
      { x: GRID_W - 14, y: cy - 3, w: 8, h: 6 }
    ]
  };
}

const VYUHAS = {
  chakravyuha,
  padmavyuha,
  garudavyuha,
  makaravyuha
};

function generate(name) {
  const fn = VYUHAS[name];
  if (!fn) throw new Error('Unknown vyuha: ' + name);
  const v = fn();
  // Convert Set to Array for transmission
  return { ...v, walls: Array.from(v.walls) };
}

function isWalkable(walls, x, y) {
  return !walls.has(key(x, y));
}

module.exports = { VYUHAS, generate, isWalkable, key, CELL, GRID_W, GRID_H };
