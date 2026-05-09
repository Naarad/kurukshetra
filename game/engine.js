// Server-authoritative real-time engine.
// One Match instance per room. Tick at 30 Hz, broadcast snapshots to clients.

const { CHARACTERS, TEAM_ROSTER, buildPlayerState } = require('./characters');
const { generate, key, CELL, GRID_W, GRID_H } = require('./vyuhas');
const { makeBotId, pickBotName, simulateBot } = require('./bot');
const accounts = require('./accounts');

const TICK_MS = 1000 / 30;
const SETUP_MS = 60_000;        // 60s to place traps in classical mode
const SETUP_MS_FREE = 90_000;   // 90s when defenders also design the maze
const ROUND_MS = 180_000;       // 3 min max per round
const ROUNDS_TO_WIN = 3;        // best of 5

class Match {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.players = new Map();   // socketId -> player
    this.projectiles = [];
    this.traps = [];            // {x,y,owner,team,kind,armed:true}
    this.maze = null;           // current vyuha (with walls Set on server side)
    this.wallSet = new Set();
    this.phase = 'lobby';       // lobby | character_select | setup | break | round_over | match_over
    this.round = 0;
    this.score = { pandavas: 0, kauravas: 0 };
    this.attackingTeam = 'pandavas';
    this.defendingTeam = 'kauravas';
    this.phaseEndsAt = 0;
    this.tickHandle = null;
    this.lastInputs = new Map(); // socketId -> {up,down,left,right,facing,attack,ability,astra}
    this.events = [];            // small toast queue
    this.assignmentMode = 'auto'; // 'auto' | 'manual'
    this.mazeMode = 'classical';  // 'classical' | 'freebuild'
  }

  setMazeMode(mode) {
    if (this.phase !== 'lobby') return;
    if (mode !== 'classical' && mode !== 'freebuild') return;
    this.mazeMode = mode;
  }

  setAssignmentMode(mode) {
    if (this.phase !== 'lobby') return;
    if (mode !== 'auto' && mode !== 'manual') return;
    this.assignmentMode = mode;
    if (mode === 'auto') {
      // wipe character/team picks so the random draw is fresh
      for (const p of this.players.values()) {
        p.character = null;
        p.ready = false;
      }
    }
  }

  // Shuffle players, split evenly into Pandavas/Kauravas, give each a unique character.
  autoAssign() {
    const ids = Array.from(this.players.keys());
    // Fisher-Yates
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const half = Math.ceil(ids.length / 2);
    const pandavaPool = shuffleCopy(TEAM_ROSTER.pandavas);
    const kauravaPool = shuffleCopy(TEAM_ROSTER.kauravas);
    ids.forEach((id, idx) => {
      const p = this.players.get(id);
      if (idx < half) {
        p.team = 'pandavas';
        p.character = pandavaPool.shift() || pandavaPool[0];
      } else {
        p.team = 'kauravas';
        p.character = kauravaPool.shift() || kauravaPool[0];
      }
      p.ready = true;
    });
    this.pushEvent('Sage Vyasa has cast the lots — the war begins.');
  }

  // -------- lobby ops --------
  addPlayer(socketId, displayName, opts = {}) {
    const teamCounts = this.teamCounts();
    const team = teamCounts.pandavas <= teamCounts.kauravas ? 'pandavas' : 'kauravas';
    this.players.set(socketId, {
      socketId,
      displayName: displayName || ('Warrior-' + socketId.slice(0, 4)),
      authedUser: opts.authedUser || null,
      team,
      character: null,
      ready: false,
      x: 0, y: 0,
      alive: true
    });
    this.lastInputs.set(socketId, {});
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.lastInputs.delete(socketId);
  }

  // Add a computer-controlled player to fill an empty slot.
  addBot() {
    if (this.phase !== 'lobby') return false;
    if (this.players.size >= 12) return false;
    const usedNames = new Set([...this.players.values()].map(p => p.displayName));
    const id = makeBotId();
    const name = pickBotName(usedNames);
    const teamCounts = this.teamCounts();
    const team = teamCounts.pandavas <= teamCounts.kauravas ? 'pandavas' : 'kauravas';
    this.players.set(id, {
      socketId: id,
      displayName: name,
      team,
      character: null,
      ready: true,         // bots are always ready
      isBot: true,
      x: 0, y: 0,
      alive: true,
      botPatrolPhase: Math.random() * Math.PI * 2
    });
    this.lastInputs.set(id, {});
    return true;
  }

  removeAllBots() {
    if (this.phase !== 'lobby') return;
    for (const [id, p] of this.players) {
      if (p.isBot) {
        this.players.delete(id);
        this.lastInputs.delete(id);
      }
    }
  }

  teamCounts() {
    const c = { pandavas: 0, kauravas: 0 };
    this.players.forEach(p => c[p.team]++);
    return c;
  }

  switchTeam(socketId, team) {
    const p = this.players.get(socketId);
    if (!p || this.phase !== 'lobby') return;
    if (team !== 'pandavas' && team !== 'kauravas') return;
    p.team = team;
    p.character = null;
  }

  pickCharacter(socketId, charKey) {
    const p = this.players.get(socketId);
    if (!p) return;
    const c = CHARACTERS[charKey];
    if (!c || c.team !== p.team) return;
    // global uniqueness: no two players in the room may share a character
    for (const other of this.players.values()) {
      if (other !== p && other.character === charKey) return;
    }
    p.character = charKey;
  }

  setReady(socketId, ready) {
    const p = this.players.get(socketId);
    if (!p) return;
    if (this.assignmentMode === 'auto') {
      p.ready = !!ready;
    } else {
      p.ready = !!ready && !!p.character;
    }
  }

  canStart() {
    if (this.players.size < 2) return false;
    // need at least one human (bots-only matches make no sense)
    const humans = [...this.players.values()].filter(p => !p.isBot);
    if (humans.length < 1) return false;
    if (this.assignmentMode === 'auto') {
      // auto: every human must be ready (bots are auto-ready)
      for (const p of humans) {
        if (!p.ready) return false;
      }
      return true;
    }
    // manual: need balanced teams + everyone has a character + ready
    const counts = this.teamCounts();
    if (counts.pandavas < 1 || counts.kauravas < 1) return false;
    for (const p of this.players.values()) {
      if (!p.character || !p.ready) return false;
    }
    return true;
  }

  // -------- match flow --------
  startMatch() {
    if (!this.canStart()) return;
    if (this.assignmentMode === 'auto') {
      this.autoAssign();
    }
    this.round = 0;
    this.score = { pandavas: 0, kauravas: 0 };
    this.attackingTeam = 'pandavas';
    this.defendingTeam = 'kauravas';
    this.startRound();
    if (!this.tickHandle) {
      this.tickHandle = setInterval(() => this.tick(), TICK_MS);
    }
  }

  startRound() {
    this.round++;
    this.projectiles = [];
    this.traps = [];
    // pick a vyuha (free build, or cycle through the classical four)
    let vyuhaName;
    if (this.mazeMode === 'freebuild') {
      vyuhaName = 'freebuild';
    } else {
      const vyuhaList = ['chakravyuha', 'padmavyuha', 'garudavyuha', 'makaravyuha'];
      vyuhaName = vyuhaList[(this.round - 1) % vyuhaList.length];
    }
    const v = generate(vyuhaName); // each call gets a fresh seed → new layout
    this.maze = v;
    this.wallSet = new Set(v.walls);

    // hydrate combat state for all players
    for (const p of this.players.values()) {
      const fresh = buildPlayerState(p.character, {
        socketId: p.socketId,
        displayName: p.displayName,
        team: p.team
      });
      Object.assign(p, fresh);
    }

    this.phase = 'setup';
    const setupDur = this.mazeMode === 'freebuild' ? SETUP_MS_FREE : SETUP_MS;
    this.phaseEndsAt = Date.now() + setupDur;
    if (this.mazeMode === 'freebuild') {
      this.pushEvent(`Round ${this.round}: Free Build. ${capitalize(this.defendingTeam)} draw the maze (${setupDur / 1000}s).`);
    } else {
      this.pushEvent(`Round ${this.round}: ${this.maze.name}. ${capitalize(this.defendingTeam)} place traps.`);
    }
  }

  startBreakPhase() {
    // place attackers at entry tile, defenders scattered inside
    const ex = this.maze.exit;
    for (const p of this.players.values()) {
      p.alive = true;
      if (p.team === this.attackingTeam) {
        const en = this.maze.entry;
        p.x = en.x * CELL + CELL / 2 + (Math.random() - 0.5) * 8;
        p.y = en.y * CELL + CELL / 2 + (Math.random() - 0.5) * 8;
      } else {
        // place around the exit / center
        const angle = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 80;
        p.x = ex.x * CELL + Math.cos(angle) * r;
        p.y = ex.y * CELL + Math.sin(angle) * r;
        // snap to walkable
        const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
        if (this.wallSet.has(key(cx, cy))) {
          p.x = ex.x * CELL + CELL / 2;
          p.y = ex.y * CELL + CELL / 2;
        }
      }
      p.cooldowns = { basic: 0, ability: 0, astra: 0 };
      p.spawnedAt = Date.now();
      p.kills = 0;
      p.damageDealt = 0;
      p.damageTaken = 0;
    }
    this.phase = 'break';
    this.phaseEndsAt = Date.now() + ROUND_MS;
    this.pushEvent(`Break phase! ${capitalize(this.attackingTeam)} must reach the exit and survive.`);
  }

  endRound(winnerTeam, reason) {
    if (this.phase === 'round_over' || this.phase === 'match_over') return;
    this.score[winnerTeam]++;
    this.phase = 'round_over';
    this.phaseEndsAt = Date.now() + 6000;
    this.pushEvent(`Round ${this.round} won by ${capitalize(winnerTeam)} — ${reason}`);
    // swap attacker/defender for the next round
    const tmp = this.attackingTeam;
    this.attackingTeam = this.defendingTeam;
    this.defendingTeam = tmp;
    if (this.score[winnerTeam] >= ROUNDS_TO_WIN) {
      this.phase = 'match_over';
      this.phaseEndsAt = Date.now() + 12000;
      this.pushEvent(`Match over! ${capitalize(winnerTeam)} win the war.`);
      this._recordMatchHistory(winnerTeam);
    }
  }

  _recordMatchHistory(winnerTeam) {
    for (const p of this.players.values()) {
      if (!p.authedUser || p.isBot) continue;
      accounts.recordMatch(p.authedUser, {
        endedAt: Date.now(),
        team: p.team,
        won: p.team === winnerTeam,
        character: p.character,
        kills: p.kills || 0,
        damageDealt: p.damageDealt || 0,
        damageTaken: p.damageTaken || 0,
        roomId: this.roomId
      });
    }
  }

  // -------- inputs --------
  setInput(socketId, input) {
    if (!this.players.has(socketId)) return;
    this.lastInputs.set(socketId, input || {});
  }

  placeTrap(socketId, tileX, tileY, kind = 'spike') {
    if (this.phase !== 'setup') return;
    const p = this.players.get(socketId);
    if (!p || p.team !== this.defendingTeam) return;
    if (this.wallSet.has(key(tileX, tileY))) return;
    if (this.traps.find(t => t.x === tileX && t.y === tileY)) return;
    if (this.traps.filter(t => t.owner === socketId).length >= 4) return;
    if (tileX < 1 || tileY < 1 || tileX >= GRID_W - 1 || tileY >= GRID_H - 1) return;
    this.traps.push({ x: tileX, y: tileY, owner: socketId, team: p.team, kind, armed: true });
  }

  // Free-build only: defenders may add or remove walls during setup.
  toggleWall(socketId, tileX, tileY) {
    if (this.phase !== 'setup') return;
    if (this.mazeMode !== 'freebuild') return;
    const p = this.players.get(socketId);
    if (!p || p.team !== this.defendingTeam) return;
    if (tileX < 1 || tileY < 1 || tileX >= GRID_W - 1 || tileY >= GRID_H - 1) return;
    // protect entry & exit
    if ((tileX === this.maze.entry.x && tileY === this.maze.entry.y) ||
        (tileX === this.maze.exit.x && tileY === this.maze.exit.y)) return;
    const k = key(tileX, tileY);
    if (this.wallSet.has(k)) {
      this.wallSet.delete(k);
      this.maze.walls = this.maze.walls.filter(w => w !== k);
    } else {
      this.wallSet.add(k);
      this.maze.walls.push(k);
      // remove any trap on that tile
      this.traps = this.traps.filter(t => !(t.x === tileX && t.y === tileY));
    }
  }

  // -------- tick --------
  tick() {
    const now = Date.now();
    if (this.phase === 'setup') {
      // bots place traps during setup
      for (const p of this.players.values()) {
        if (p.isBot) simulateBot(p, this, now);
      }
      if (now >= this.phaseEndsAt) this.startBreakPhase();
    } else if (this.phase === 'break') {
      this.simulateCombat(now);
      this.checkRoundEnd(now);
    } else if (this.phase === 'round_over') {
      if (now >= this.phaseEndsAt) {
        if (this.score.pandavas >= ROUNDS_TO_WIN || this.score.kauravas >= ROUNDS_TO_WIN) {
          this.phase = 'match_over';
          this.phaseEndsAt = Date.now() + 12000;
        } else {
          this.startRound();
        }
      }
    } else if (this.phase === 'match_over') {
      if (now >= this.phaseEndsAt) {
        // back to lobby for rematch
        this.phase = 'lobby';
        for (const p of this.players.values()) p.ready = false;
      }
    }
    this.broadcast();
  }

  simulateCombat(now) {
    // ---- bot AI: synthesize their inputs first ----
    for (const p of this.players.values()) {
      if (p.isBot) simulateBot(p, this, now);
    }

    // ---- player movement & ability use ----
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const inp = this.lastInputs.get(p.socketId) || {};
      let dx = 0, dy = 0;
      if (inp.up) dy -= 1;
      if (inp.down) dy += 1;
      if (inp.left) dx -= 1;
      if (inp.right) dx += 1;
      const len = Math.hypot(dx, dy) || 1;
      // status effects (stun, slow, haste)
      let speedMul = 1;
      let stunned = false;
      let rooted = false;
      p.statusEffects = p.statusEffects.filter(e => e.until > now);
      for (const e of p.statusEffects) {
        if (e.kind === 'stun') stunned = true;
        if (e.kind === 'rooted') rooted = true;
        if (e.kind === 'slow') speedMul *= 0.5;
        if (e.kind === 'haste') speedMul *= 1 + (e.bonusPct || 0) / 100;
      }
      if (rooted) speedMul = 0;
      if (!stunned) {
        const nx = p.x + (dx / len) * p.speed * speedMul;
        const ny = p.y + (dy / len) * p.speed * speedMul;
        if (!this.collides(nx, p.y, p.radius)) p.x = nx;
        if (!this.collides(p.x, ny, p.radius)) p.y = ny;
        if (typeof inp.facing === 'number') p.facing = inp.facing;
      }
      // cooldowns tick down
      for (const k of Object.keys(p.cooldowns)) {
        if (p.cooldowns[k] > 0) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - TICK_MS);
      }
      // check astra unlock
      const c = CHARACTERS[p.character];
      if (!p.astraReady && this.checkAstraUnlock(p, c)) {
        p.astraReady = true;
        this.pushEvent(`${p.name} unlocks ${c.astra.name}!`);
      }
      // actions
      if (inp.attack) this.tryBasic(p, c, now);
      if (inp.ability) this.tryAbility(p, c, now);
      if (inp.astra) this.tryAstra(p, c, now);

      // trap check
      const tx = Math.floor(p.x / CELL), ty = Math.floor(p.y / CELL);
      const trap = this.traps.find(t => t.x === tx && t.y === ty && t.armed && t.team !== p.team);
      if (trap) {
        trap.armed = false;
        this.applyDamage(null, p, 35, 'trap');
        this.pushEvent(`${p.name} sprung a trap.`);
      }
    }

    // ---- projectiles ----
    const surviving = [];
    for (const proj of this.projectiles) {
      proj.x += proj.vx;
      proj.y += proj.vy;
      proj.life -= TICK_MS;
      if (proj.life <= 0) continue;
      // wall collide unless piercing-beam
      const cx = Math.floor(proj.x / CELL), cy = Math.floor(proj.y / CELL);
      if (this.wallSet.has(key(cx, cy)) && !proj.piercing) continue;

      let hit = false;
      for (const target of this.players.values()) {
        if (!target.alive) continue;
        if (target.team === proj.team) continue;
        const d = Math.hypot(target.x - proj.x, target.y - proj.y);
        if (d < target.radius + (proj.width || 4)) {
          const owner = this.players.get(proj.owner);
          this.applyDamage(owner, target, proj.damage, proj.kind || 'arrow');
          if (!proj.piercing) { hit = true; break; }
        }
      }
      if (!hit) surviving.push(proj);
    }
    this.projectiles = surviving;
  }

  checkAstraUnlock(p, c) {
    const u = c.astra.unlock;
    if (!u) return true;
    const allies = [...this.players.values()].filter(x => x.team === p.team && x.alive && x !== p).length;
    switch (u.kind) {
      case 'allies_alive_ge': return allies >= u.value;
      case 'allies_alive_le': return allies <= u.value;
      case 'damage_dealt_ge': return p.damageDealt >= u.value;
      case 'damage_taken_ge': return p.damageTaken >= u.value;
      case 'kills_ge': return p.kills >= u.value;
      case 'time_alive_ge': return (Date.now() - p.spawnedAt) / 1000 >= u.value;
      default: return true;
    }
  }

  tryBasic(p, c, now) {
    if (p.cooldowns.basic > 0) return;
    p.cooldowns.basic = c.basic.cooldownMs;
    if (c.basic.kind === 'projectile') {
      this.spawnProjectile(p, c.basic);
    } else if (c.basic.kind === 'melee') {
      this.applyMelee(p, c.basic.range, c.basic.damage);
    }
  }

  tryAbility(p, c, now) {
    if (p.cooldowns.ability > 0) return;
    const a = c.ability;
    p.cooldowns.ability = a.cooldownMs;
    switch (a.kind) {
      case 'multi_projectile': {
        for (let i = 0; i < a.count; i++) {
          const off = (i - (a.count - 1) / 2) * (a.spreadDeg * Math.PI / 180);
          this.spawnProjectile(p, { ...c.basic, damage: a.damage, speed: a.speed }, off);
        }
        break;
      }
      case 'wall_break': {
        const ahead = this.tileAhead(p, a.range);
        if (this.wallSet.has(key(ahead.x, ahead.y))) {
          this.wallSet.delete(key(ahead.x, ahead.y));
          // remove from maze.walls array as well
          this.maze.walls = this.maze.walls.filter(w => w !== key(ahead.x, ahead.y));
          this.pushEvent(`${p.name} smashes through a wall.`);
        }
        // also clear traps on that tile
        this.traps = this.traps.filter(t => !(t.x === ahead.x && t.y === ahead.y));
        break;
      }
      case 'dash': {
        const ang = p.facing;
        const tx = p.x + Math.cos(ang) * a.distance;
        const ty = p.y + Math.sin(ang) * a.distance;
        if (!this.collides(tx, ty, p.radius)) { p.x = tx; p.y = ty; }
        break;
      }
      case 'reveal': {
        p.statusEffects.push({ kind: 'reveal_self', until: now + a.durationMs });
        // server marks the player as a "revealer" so client shows enemies
        p.revealUntil = now + a.durationMs;
        break;
      }
      case 'self_armor': {
        p.statusEffects.push({ kind: 'armor', pct: a.effect.damageReductionPct, until: now + a.durationMs });
        break;
      }
      case 'buff_aura': {
        for (const ally of this.players.values()) {
          if (ally.team === p.team && ally.alive) {
            const d = Math.hypot(ally.x - p.x, ally.y - p.y);
            if (d <= a.radius) ally.statusEffects.push({ kind: 'armor', pct: a.effect.damageReductionPct, until: now + a.durationMs });
          }
        }
        break;
      }
      case 'invisibility': {
        p.invisibleUntil = now + a.durationMs;
        break;
      }
      case 'pull': {
        let nearest = null, bestD = a.range;
        for (const other of this.players.values()) {
          if (other.team === p.team || !other.alive) continue;
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d < bestD) { bestD = d; nearest = other; }
        }
        if (nearest) {
          const ang = Math.atan2(p.y - nearest.y, p.x - nearest.x);
          nearest.x += Math.cos(ang) * a.pullStrength;
          nearest.y += Math.sin(ang) * a.pullStrength;
          // simple wall clamp: undo if collides
          if (this.collides(nearest.x, nearest.y, nearest.radius)) {
            nearest.x -= Math.cos(ang) * a.pullStrength;
            nearest.y -= Math.sin(ang) * a.pullStrength;
          }
        }
        break;
      }
      case 'place_trap_in_combat': {
        const tx = Math.floor(p.x / CELL), ty = Math.floor(p.y / CELL);
        if (!this.wallSet.has(key(tx, ty)) && !this.traps.find(t => t.x === tx && t.y === ty)) {
          this.traps.push({ x: tx, y: ty, owner: p.socketId, team: p.team, kind: 'spike', armed: true });
        }
        break;
      }
      case 'rooted_power': {
        // Bhishma's Adamant Stance: rooted but high damage
        p.statusEffects.push({ kind: 'rooted', until: now + a.durationMs });
        p.statusEffects.push({ kind: 'damage_amp', pct: a.damageBonusPct, until: now + a.durationMs });
        break;
      }
      default: break;
    }
  }

  tryAstra(p, c, now) {
    if (!p.astraReady) return;
    if (p.cooldowns.astra > 0) return;
    if (p.astraUsesLeft <= 0) return;
    const a = c.astra;
    p.cooldowns.astra = a.cooldownMs;
    p.astraUsesLeft--;
    this.pushEvent(`${p.name} unleashes ${a.name}!`);
    switch (a.kind) {
      case 'aoe_dot': {
        // schedule N ticks
        let i = 0;
        const tickIv = setInterval(() => {
          i++;
          for (const target of this.players.values()) {
            if (!target.alive || target.team === p.team) continue;
            const d = Math.hypot(target.x - p.x, target.y - p.y);
            if (d < a.radius) this.applyDamage(p, target, a.damage, a.name);
          }
          if (i >= a.ticks) clearInterval(tickIv);
        }, 700);
        break;
      }
      case 'cone_knockback': {
        for (const target of this.players.values()) {
          if (!target.alive || target.team === p.team) continue;
          const dx = target.x - p.x, dy = target.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d > a.range) continue;
          const ang = Math.atan2(dy, dx);
          const facing = p.facing;
          let diff = Math.abs(((ang - facing + Math.PI) % (Math.PI * 2)) - Math.PI);
          if (diff < (a.arcDeg * Math.PI / 180) / 2) {
            this.applyDamage(p, target, a.damage, a.name);
            const nx = target.x + Math.cos(ang) * a.knockback;
            const ny = target.y + Math.sin(ang) * a.knockback;
            if (!this.collides(nx, ny, target.radius)) { target.x = nx; target.y = ny; }
          }
        }
        break;
      }
      case 'piercing_beam': {
        // spawn a fast piercing projectile
        const speed = 30;
        this.projectiles.push({
          owner: p.socketId, team: p.team,
          x: p.x, y: p.y,
          vx: Math.cos(p.facing) * speed, vy: Math.sin(p.facing) * speed,
          damage: a.damage, life: 1500, kind: a.name, piercing: true, width: a.width / 2
        });
        break;
      }
      case 'haste_team': {
        for (const ally of this.players.values()) {
          if (ally.team === p.team && ally.alive) {
            ally.statusEffects.push({ kind: 'haste', bonusPct: a.speedBonusPct, until: now + a.durationMs });
          }
        }
        break;
      }
      case 'aoe_stun': {
        for (const target of this.players.values()) {
          if (!target.alive || target.team === p.team) continue;
          const d = Math.hypot(target.x - p.x, target.y - p.y);
          if (d < a.radius) target.statusEffects.push({ kind: 'stun', until: now + a.stunMs });
        }
        break;
      }
      case 'leap_smash': {
        const tx = p.x + Math.cos(p.facing) * a.range;
        const ty = p.y + Math.sin(p.facing) * a.range;
        if (!this.collides(tx, ty, p.radius)) { p.x = tx; p.y = ty; }
        for (const target of this.players.values()) {
          if (!target.alive || target.team === p.team) continue;
          const d = Math.hypot(target.x - p.x, target.y - p.y);
          if (d < a.radius) {
            this.applyDamage(p, target, a.damage, a.name);
            target.statusEffects.push({ kind: 'stun', until: now + 1500 });
          }
        }
        break;
      }
      case 'lifesteal': {
        p.lifestealUntil = now + a.durationMs;
        p.lifestealPct = a.lifestealPct;
        break;
      }
      case 'guided_projectile': {
        // weak homing — find nearest enemy and fire
        let target = null, best = Infinity;
        for (const t of this.players.values()) {
          if (!t.alive || t.team === p.team) continue;
          const d = Math.hypot(t.x - p.x, t.y - p.y);
          if (d < best) { best = d; target = t; }
        }
        if (target) {
          const ang = Math.atan2(target.y - p.y, target.x - p.x);
          this.projectiles.push({
            owner: p.socketId, team: p.team,
            x: p.x, y: p.y,
            vx: Math.cos(ang) * a.speed, vy: Math.sin(ang) * a.speed,
            damage: a.damage, life: 4000, kind: a.name
          });
        }
        break;
      }
      case 'rain_projectiles': {
        // rain all over current map
        for (let i = 0; i < a.projectileCount; i++) {
          const tx = Math.random() * GRID_W * CELL;
          const ty = Math.random() * GRID_H * CELL;
          this.projectiles.push({
            owner: p.socketId, team: p.team,
            x: tx, y: ty - 200,
            vx: 0, vy: 12,
            damage: a.damagePer, life: 2000, kind: a.name
          });
        }
        break;
      }
      case 'illusion': {
        // spawn temporary decoys as fake entries broadcast separately
        if (!this.decoys) this.decoys = [];
        for (let i = 0; i < a.decoys; i++) {
          this.decoys.push({
            owner: p.socketId, color: p.color, name: p.name,
            x: p.x + (Math.random() - 0.5) * 40,
            y: p.y + (Math.random() - 0.5) * 40,
            until: now + a.durationMs
          });
        }
        break;
      }
      case 'invulnerability': {
        // Bhishma's Icchamrityu — HP cannot drop below 1 for the duration
        p.invulnerableUntil = now + a.durationMs;
        break;
      }
      default: break;
    }
  }

  spawnProjectile(p, basic, angleOffset = 0) {
    const ang = p.facing + angleOffset;
    const sp = basic.speed || 8;
    this.projectiles.push({
      owner: p.socketId, team: p.team,
      x: p.x + Math.cos(ang) * (p.radius + 6),
      y: p.y + Math.sin(ang) * (p.radius + 6),
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      damage: basic.damage,
      life: (basic.range / sp) * TICK_MS,
      kind: basic.name
    });
  }

  applyMelee(p, range, damage) {
    for (const target of this.players.values()) {
      if (!target.alive || target.team === p.team) continue;
      const dx = target.x - p.x, dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range + target.radius) continue;
      const ang = Math.atan2(dy, dx);
      let diff = Math.abs(((ang - p.facing + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (diff < Math.PI / 2.5) this.applyDamage(p, target, damage, 'melee');
    }
  }

  applyDamage(attacker, target, raw, source) {
    if (!target.alive) return;
    let dmg = raw;
    const now = Date.now();
    for (const e of target.statusEffects) {
      if (e.kind === 'armor' && e.until > now) dmg *= 1 - (e.pct / 100);
    }
    if (attacker) {
      for (const e of attacker.statusEffects || []) {
        if (e.kind === 'damage_amp' && e.until > now) dmg *= 1 + (e.pct / 100);
      }
    }
    dmg = Math.round(dmg);
    target.hp -= dmg;
    target.damageTaken += dmg;
    // Icchamrityu: cannot fall below 1 HP while invulnerable
    if (target.invulnerableUntil && target.invulnerableUntil > now && target.hp < 1) {
      target.hp = 1;
    }
    if (attacker) {
      attacker.damageDealt += dmg;
      if (attacker.lifestealUntil && attacker.lifestealUntil > now) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.round(dmg * (attacker.lifestealPct || 0) / 100));
      }
    }
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      if (attacker) attacker.kills++;
      this.pushEvent(`${target.name} has fallen${attacker ? ' to ' + attacker.name : ''}.`);
    }
  }

  tileAhead(p, range) {
    const x = Math.floor((p.x + Math.cos(p.facing) * range) / CELL);
    const y = Math.floor((p.y + Math.sin(p.facing) * range) / CELL);
    return { x, y };
  }

  collides(x, y, r) {
    // sample 4 corners
    const points = [
      [x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r], [x, y]
    ];
    for (const [px, py] of points) {
      const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);
      if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return true;
      if (this.wallSet.has(key(cx, cy))) return true;
    }
    return false;
  }

  checkRoundEnd(now) {
    if (now >= this.phaseEndsAt) {
      // attackers ran out of time — defenders win
      this.endRound(this.defendingTeam, 'attackers ran out of time');
      return;
    }
    // attackers win if any attacker reaches the exit tile while alive
    const ex = this.maze.exit;
    for (const p of this.players.values()) {
      if (p.team === this.attackingTeam && p.alive) {
        const d = Math.hypot(p.x - (ex.x * CELL + CELL / 2), p.y - (ex.y * CELL + CELL / 2));
        if (d < CELL * 1.2) {
          this.endRound(this.attackingTeam, `${p.name} reached the exit alive`);
          return;
        }
      }
    }
    // defenders win if all attackers are dead
    const attackersAlive = [...this.players.values()].some(p => p.team === this.attackingTeam && p.alive);
    if (!attackersAlive) {
      this.endRound(this.defendingTeam, 'all attackers fallen');
    }
  }

  pushEvent(text) {
    this.events.push({ text, at: Date.now() });
    if (this.events.length > 12) this.events.shift();
  }

  // -------- broadcast --------
  snapshot() {
    const now = Date.now();
    return {
      roomId: this.roomId,
      phase: this.phase,
      round: this.round,
      score: this.score,
      attackingTeam: this.attackingTeam,
      defendingTeam: this.defendingTeam,
      phaseEndsAt: this.phaseEndsAt,
      assignmentMode: this.assignmentMode,
      mazeMode: this.mazeMode,
      maze: this.maze ? {
        name: this.maze.name,
        lore: this.maze.lore,
        period: this.maze.period,
        architect: this.maze.architect,
        strategy: this.maze.strategy,
        width: this.maze.width, height: this.maze.height, cellSize: this.maze.cellSize,
        walls: Array.from(this.wallSet),
        entry: this.maze.entry, exit: this.maze.exit,
        suggestedTrapZones: this.maze.suggestedTrapZones
      } : null,
      players: [...this.players.values()].map(p => ({
        socketId: p.socketId,
        displayName: p.displayName,
        team: p.team,
        character: p.character,
        name: p.name,
        title: p.title,
        color: p.color,
        ready: p.ready,
        isBot: !!p.isBot,
        voiceEnabled: !!p.voiceEnabled,
        voiceMuted: !!p.voiceMuted,
        x: p.x, y: p.y, facing: p.facing,
        hp: p.hp, maxHp: p.maxHp, alive: p.alive,
        radius: p.radius,
        kills: p.kills, damageDealt: p.damageDealt,
        astraReady: p.astraReady, astraUsesLeft: p.astraUsesLeft,
        cooldowns: p.cooldowns,
        invisibleUntil: p.invisibleUntil || 0,
        revealUntil: p.revealUntil || 0,
        invulnerableUntil: p.invulnerableUntil || 0,
        statusEffects: (p.statusEffects || []).map(e => ({ kind: e.kind, until: e.until }))
      })),
      projectiles: this.projectiles.map(pr => ({ x: pr.x, y: pr.y, team: pr.team, kind: pr.kind, piercing: !!pr.piercing })),
      traps: this.traps.map(t => ({ x: t.x, y: t.y, team: t.team, armed: t.armed })),
      decoys: (this.decoys || []).filter(d => d.until > now),
      events: this.events.slice(-5)
    };
  }

  broadcast() {
    this.io.to(this.roomId).emit('snapshot', this.snapshot());
  }

  destroy() {
    if (this.tickHandle) clearInterval(this.tickHandle);
  }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function shuffleCopy(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { Match };
