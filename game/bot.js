// Server-side bot AI.
// Bots are players without a socket. They have isBot=true and the engine
// runs simulateBot(bot, match) each tick to fill in fake input + actions.
// Behavior is intentionally simple but feels alive:
//  - SETUP: defenders sprinkle traps near suggested zones; attackers idle.
//  - BREAK: attackers head toward exit, shoot enemies in line of sight.
//           defenders patrol around exit and chase the nearest attacker.
//  - Always: trigger ability when off cooldown if it'd help.
//  - Always: fire astra the moment it's ready.

const { CHARACTERS } = require('./characters');

const BOT_NAMES = [
  'Vyasa', 'Sanjaya', 'Vidura', 'Drupada', 'Virata', 'Kripacharya',
  'Sikhandi', 'Ghatotkacha', 'Iravan', 'Uttara', 'Drauni', 'Satyaki',
  'Yuyutsu', 'Jayadratha', 'Bhagadatta'
];

let botCounter = 0;
function makeBotId() {
  return 'bot-' + (++botCounter) + '-' + Math.random().toString(36).slice(2, 6);
}

function pickBotName(usedNames) {
  const free = BOT_NAMES.filter(n => !usedNames.has(n));
  if (free.length) return free[Math.floor(Math.random() * free.length)];
  return 'Bot-' + botCounter;
}

// ---------------- bot behavior per tick ----------------
function simulateBot(bot, match, now) {
  if (!bot.alive) return;

  // SETUP: defenders place traps occasionally
  if (match.phase === 'setup') {
    if (bot.team === match.defendingTeam) {
      const placed = match.traps.filter(t => t.owner === bot.socketId).length;
      const cap = 3;
      if (placed < cap && (!bot.lastTrapAt || now - bot.lastTrapAt > 1500)) {
        const zone = (match.maze.suggestedTrapZones || [])[0];
        if (zone) {
          const tx = zone.x + Math.floor(Math.random() * zone.w);
          const ty = zone.y + Math.floor(Math.random() * zone.h);
          if (!match.wallSet.has(tx + ',' + ty) &&
              !match.traps.find(t => t.x === tx && t.y === ty)) {
            match.placeTrap(bot.socketId, tx, ty);
            bot.lastTrapAt = now;
          }
        }
      }
    }
    // bots can't move during setup
    return;
  }

  if (match.phase !== 'break') return;

  // ---- BREAK: combat behavior ----
  const enemies = [...match.players.values()].filter(p => p.alive && p.team !== bot.team);
  const nearest = nearestEnemy(bot, enemies);

  // Pick a goal point.
  let goal = null;
  if (bot.team === match.attackingTeam) {
    // head to exit by default
    const ex = match.maze.exit;
    goal = { x: ex.x * match.maze.cellSize + 16, y: ex.y * match.maze.cellSize + 16 };
    // but if a close enemy threatens, fight first
    if (nearest && dist(bot, nearest) < 220) goal = { x: nearest.x, y: nearest.y };
  } else {
    // defenders chase nearest attacker, otherwise patrol around exit
    if (nearest) goal = { x: nearest.x, y: nearest.y };
    else {
      const ex = match.maze.exit;
      const t = now / 800 + (bot.botPatrolPhase || 0);
      goal = {
        x: ex.x * match.maze.cellSize + 16 + Math.cos(t) * 80,
        y: ex.y * match.maze.cellSize + 16 + Math.sin(t) * 80
      };
    }
  }

  // movement: greedy toward goal with wall sliding
  const desired = directionTo(bot, goal);
  // probe: if blocked ahead, try to slide
  const c = CHARACTERS[bot.character];
  const speed = c.speed;
  const tryX = bot.x + desired.x * speed * 2;
  const tryY = bot.y + desired.y * speed * 2;
  let dx = desired.x, dy = desired.y;
  if (match.collides(tryX, bot.y, bot.radius) && match.collides(bot.x, tryY, bot.radius)) {
    // both blocked — try perpendicular
    dx = -desired.y; dy = desired.x;
  } else if (match.collides(tryX, bot.y, bot.radius)) {
    dx = 0;
  } else if (match.collides(bot.x, tryY, bot.radius)) {
    dy = 0;
  }

  // facing: toward nearest enemy if any, else toward goal
  const facingTarget = nearest ? nearest : goal;
  const facing = Math.atan2(facingTarget.y - bot.y, facingTarget.x - bot.x);

  // synthesize inputs (the engine reads input via lastInputs map)
  const input = {
    up: dy < -0.2,
    down: dy > 0.2,
    left: dx < -0.2,
    right: dx > 0.2,
    attack: false,
    ability: false,
    astra: false,
    facing
  };

  // attack only if there's a target with line of sight in range
  if (nearest) {
    const range = c.basic.kind === 'projectile' ? c.basic.range * 0.7 : 50;
    if (dist(bot, nearest) < range && hasLineOfSight(match, bot, nearest)) {
      input.attack = true;
    }
  }

  // use ability opportunistically
  if (bot.cooldowns.ability === 0 && shouldUseAbility(bot, c, match, nearest)) {
    input.ability = true;
  }

  // fire astra the moment it's available
  if (bot.astraReady && bot.cooldowns.astra === 0 && bot.astraUsesLeft > 0) {
    input.astra = true;
  }

  match.lastInputs.set(bot.socketId, input);
}

function shouldUseAbility(bot, c, match, nearest) {
  // simple per-kind heuristics
  const k = c.ability.kind;
  if (k === 'wall_break') {
    // Bhima — break a wall ahead if blocked toward goal
    return Math.random() < 0.05;
  }
  if (k === 'dash') {
    // Nakula — dash toward enemy if any
    return !!nearest && dist(bot, nearest) < 200;
  }
  if (k === 'self_armor' || k === 'buff_aura') {
    // duryodhana, karna, yudhishthira — use when enemy near
    return !!nearest && dist(bot, nearest) < 240;
  }
  if (k === 'multi_projectile') {
    // arjuna — when enemy in range
    return !!nearest && dist(bot, nearest) < 360;
  }
  if (k === 'reveal') {
    // sahadeva, krishna — periodic
    return Math.random() < 0.02;
  }
  if (k === 'invisibility') {
    return !!nearest && dist(bot, nearest) < 180;
  }
  if (k === 'pull') {
    return !!nearest && dist(bot, nearest) < 200;
  }
  if (k === 'place_trap_in_combat') {
    return Math.random() < 0.02;
  }
  if (k === 'rooted_power') {
    // bhishma — only if enemy is in range and not too close (so movement loss matters less)
    return !!nearest && dist(bot, nearest) < 500 && dist(bot, nearest) > 100;
  }
  return false;
}

// ---------------- helpers ----------------
function nearestEnemy(self, list) {
  let best = null, bestD = Infinity;
  for (const e of list) {
    const d = dist(self, e);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function directionTo(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}
// quick LoS: sample along the line; if any sample hits a wall, no LoS.
function hasLineOfSight(match, a, b) {
  const cs = match.maze.cellSize;
  const steps = Math.ceil(dist(a, b) / (cs * 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const cx = Math.floor(x / cs), cy = Math.floor(y / cs);
    if (match.wallSet.has(cx + ',' + cy)) return false;
  }
  return true;
}

module.exports = { makeBotId, pickBotName, simulateBot };
