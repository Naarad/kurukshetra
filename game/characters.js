// Mahabharat character roster.
// Each character has stats, a basic attack, an active ability, and an ultimate "astra".
// Astras unlock based on conditions (kills, damage taken, time alive, allies remaining).

const CHARACTERS = {
  // ---------------- PANDAVAS ----------------
  yudhishthira: {
    name: 'Yudhishthira',
    team: 'pandavas',
    title: 'Dharmaraja',
    color: '#f5d76e',
    hp: 110,
    speed: 3.0,
    radius: 14,
    basic: { name: 'Spear Thrust', kind: 'melee', range: 38, damage: 14, cooldownMs: 600 },
    ability: {
      name: 'Aegis of Dharma',
      kind: 'buff_aura',
      radius: 90,
      durationMs: 4000,
      cooldownMs: 14000,
      effect: { damageReductionPct: 40 },
      desc: 'Allies in range take 40% less damage for 4s.'
    },
    astra: {
      name: 'Yamastra',
      kind: 'aoe_dot',
      radius: 130,
      damage: 22,
      ticks: 4,
      cooldownMs: 30000,
      unlock: { kind: 'allies_alive_ge', value: 2 },
      desc: 'Summons Yama\'s judgment in a wide ring; 4 ticks of damage to enemies inside.'
    },
    skillTree: ['+10 max HP', '+1 ally in aura', 'Aegis lasts 6s']
  },

  bhima: {
    name: 'Bhima',
    team: 'pandavas',
    title: 'Vrikodara',
    color: '#c0392b',
    hp: 160,
    speed: 2.6,
    radius: 18,
    basic: { name: 'Mace Smash', kind: 'melee', range: 44, damage: 26, cooldownMs: 850 },
    ability: {
      name: 'Wall Breaker',
      kind: 'wall_break',
      range: 50,
      cooldownMs: 4000,
      desc: 'Smashes a maze wall directly in front. Trap walls included.'
    },
    astra: {
      name: 'Vayavyastra',
      kind: 'cone_knockback',
      range: 220,
      arcDeg: 60,
      damage: 30,
      knockback: 90,
      cooldownMs: 25000,
      unlock: { kind: 'damage_dealt_ge', value: 120 },
      desc: 'A roaring gale: cone of wind that knocks enemies back and damages them.'
    },
    skillTree: ['Wall Breaker hits 2 walls', '+0.3 speed', '+30 max HP']
  },

  arjuna: {
    name: 'Arjuna',
    team: 'pandavas',
    title: 'Savyasachi',
    color: '#3498db',
    hp: 95,
    speed: 3.4,
    radius: 13,
    basic: { name: 'Gandiva Arrow', kind: 'projectile', range: 520, damage: 18, speed: 9, cooldownMs: 350 },
    ability: {
      name: 'Triple Shot',
      kind: 'multi_projectile',
      count: 3,
      spreadDeg: 12,
      damage: 14,
      speed: 9,
      cooldownMs: 6000,
      desc: 'Fires three Gandiva arrows in a tight spread.'
    },
    astra: {
      name: 'Pashupatastra',
      kind: 'piercing_beam',
      range: 800,
      width: 18,
      damage: 95,
      cooldownMs: 60000,
      unlock: { kind: 'time_alive_ge', value: 90 },
      desc: 'Shiva\'s ultimate. A piercing beam that obliterates anything in its line.'
    },
    skillTree: ['+1 arrow on Triple Shot', '+15% arrow speed', 'Pashupatastra recharges 20s faster']
  },

  nakula: {
    name: 'Nakula',
    team: 'pandavas',
    title: 'Ashvinikumara',
    color: '#1abc9c',
    hp: 90,
    speed: 4.0,
    radius: 12,
    basic: { name: 'Twin Daggers', kind: 'melee', range: 30, damage: 11, cooldownMs: 280 },
    ability: {
      name: 'Dash',
      kind: 'dash',
      distance: 130,
      cooldownMs: 5000,
      desc: 'Quick dash through gaps and small walls.'
    },
    astra: {
      name: 'Ashvastra',
      kind: 'haste_team',
      durationMs: 6000,
      speedBonusPct: 50,
      cooldownMs: 35000,
      unlock: { kind: 'kills_ge', value: 1 },
      desc: 'Calls the Ashvini twins; whole team gains +50% speed for 6s.'
    },
    skillTree: ['+2 dash distance', 'Daggers bleed (+5 dmg over 2s)', 'Dash phases through 1 trap']
  },

  sahadeva: {
    name: 'Sahadeva',
    team: 'pandavas',
    title: 'Tantra-jna',
    color: '#9b59b6',
    hp: 95,
    speed: 3.2,
    radius: 13,
    basic: { name: 'Sling Stone', kind: 'projectile', range: 360, damage: 13, speed: 8, cooldownMs: 450 },
    ability: {
      name: 'Foresight',
      kind: 'reveal',
      durationMs: 5000,
      cooldownMs: 12000,
      desc: 'Reveals all enemy positions and trap locations on the map for 5s.'
    },
    astra: {
      name: 'Sammohanastra',
      kind: 'aoe_stun',
      radius: 110,
      stunMs: 2500,
      cooldownMs: 30000,
      unlock: { kind: 'time_alive_ge', value: 60 },
      desc: 'Astra of bewilderment. Stuns all enemies inside the radius.'
    },
    skillTree: ['Foresight lasts 8s', 'Stun radius +30', 'Stones return after hit']
  },

  // ---------------- KAURAVAS ----------------
  duryodhana: {
    name: 'Duryodhana',
    team: 'kauravas',
    title: 'Suyodhana',
    color: '#8e44ad',
    hp: 140,
    speed: 2.9,
    radius: 16,
    basic: { name: 'Mace Strike', kind: 'melee', range: 42, damage: 22, cooldownMs: 750 },
    ability: {
      name: 'Iron Body',
      kind: 'self_armor',
      durationMs: 5000,
      cooldownMs: 15000,
      effect: { damageReductionPct: 60 },
      desc: 'Hardens his thigh-armored body; takes 60% less damage for 5s.'
    },
    astra: {
      name: 'Gadayuddha',
      kind: 'leap_smash',
      range: 200,
      radius: 70,
      damage: 55,
      cooldownMs: 28000,
      unlock: { kind: 'damage_taken_ge', value: 80 },
      desc: 'Leaps and slams, shockwave damages and stuns enemies.'
    },
    skillTree: ['Iron Body 80% reduction', '+25 max HP', 'Smash radius +30']
  },

  dushasana: {
    name: 'Dushasana',
    team: 'kauravas',
    title: 'Drag-arm',
    color: '#d35400',
    hp: 120,
    speed: 3.1,
    radius: 15,
    basic: { name: 'Slash', kind: 'melee', range: 36, damage: 18, cooldownMs: 500 },
    ability: {
      name: 'Grappling Pull',
      kind: 'pull',
      range: 240,
      pullStrength: 200,
      cooldownMs: 8000,
      desc: 'Pulls one enemy toward him, into traps if possible.'
    },
    astra: {
      name: 'Raktastra',
      kind: 'lifesteal',
      durationMs: 6000,
      lifestealPct: 75,
      cooldownMs: 28000,
      unlock: { kind: 'kills_ge', value: 1 },
      desc: 'Heals from 75% of damage dealt for 6s.'
    },
    skillTree: ['Pull range +60', 'Slash bleeds', 'Raktastra lasts 9s']
  },

  karna: {
    name: 'Karna',
    team: 'kauravas',
    title: 'Suryaputra',
    color: '#e67e22',
    hp: 110,
    speed: 3.2,
    radius: 14,
    basic: { name: 'Vijaya Bow', kind: 'projectile', range: 540, damage: 20, speed: 10, cooldownMs: 380 },
    ability: {
      name: 'Kavach Bless',
      kind: 'self_armor',
      durationMs: 8000,
      cooldownMs: 18000,
      effect: { damageReductionPct: 50 },
      desc: 'Surya\'s armor: 50% damage reduction for 8s.'
    },
    astra: {
      name: 'Vasavi Shakti',
      kind: 'guided_projectile',
      damage: 999,
      speed: 11,
      cooldownMs: 90000,
      maxUses: 1,
      unlock: { kind: 'time_alive_ge', value: 30 },
      desc: 'Indra\'s spear. Single-use, homes weakly, instant kill on hit.'
    },
    skillTree: ['+1 charge of Vasavi', 'Kavach lasts 12s', '+10% arrow damage']
  },

  ashwatthama: {
    name: 'Ashwatthama',
    team: 'kauravas',
    title: 'Chiranjeevi',
    color: '#16a085',
    hp: 105,
    speed: 3.3,
    radius: 14,
    basic: { name: 'Sword Slash', kind: 'melee', range: 40, damage: 17, cooldownMs: 500 },
    ability: {
      name: 'Night Stalker',
      kind: 'invisibility',
      durationMs: 4000,
      cooldownMs: 14000,
      desc: 'Becomes invisible for 4s (ends on attack).'
    },
    astra: {
      name: 'Narayanastra',
      kind: 'rain_projectiles',
      radius: 260,
      projectileCount: 30,
      damagePer: 12,
      cooldownMs: 60000,
      unlock: { kind: 'allies_alive_le', value: 1 },
      desc: 'Rains arrows over a wide area. Triggers only when his side is nearly fallen.'
    },
    skillTree: ['Invis lasts 6s', 'Slash heals 5 HP', '+10% Narayana damage']
  },

  shakuni: {
    name: 'Shakuni',
    team: 'kauravas',
    title: 'Gandhararaja',
    color: '#7f8c8d',
    hp: 80,
    speed: 3.5,
    radius: 12,
    basic: { name: 'Loaded Dice', kind: 'projectile', range: 280, damage: 10, speed: 7, cooldownMs: 350 },
    ability: {
      name: 'Trap Master',
      kind: 'place_trap_in_combat',
      cooldownMs: 6000,
      desc: 'Places a 1-tile spike trap on his current cell during combat.'
    },
    astra: {
      name: 'Mayastra',
      kind: 'illusion',
      decoys: 3,
      durationMs: 8000,
      cooldownMs: 30000,
      unlock: { kind: 'time_alive_ge', value: 45 },
      desc: 'Spawns 3 mirror-image decoys that fool the enemy.'
    },
    skillTree: ['+1 decoy', 'Trap deals double damage', 'Dice slows for 1s']
  },

  // ---------------- DIVINE / ELDER ----------------
  krishna: {
    name: 'Krishna',
    team: 'pandavas',
    title: 'Vasudeva · Govinda',
    color: '#1f6feb',
    hp: 100,
    speed: 3.6,
    radius: 14,
    basic: { name: 'Sudarshan Chakra', kind: 'projectile', range: 480, damage: 16, speed: 10, cooldownMs: 420 },
    ability: {
      name: 'Divine Vision',
      kind: 'reveal',
      durationMs: 6000,
      cooldownMs: 14000,
      desc: 'Lifts the fog of war. Reveals all enemies, traps and decoys to the entire Pandava team for 6s.'
    },
    astra: {
      name: 'Vishwarupa',
      kind: 'aoe_stun',
      radius: 220,
      stunMs: 3500,
      cooldownMs: 60000,
      maxUses: 1,
      unlock: { kind: 'allies_alive_le', value: 1 },
      desc: 'Reveals his cosmic form. All enemies in a wide radius are stunned in awe for 3.5s. Once per match.'
    },
    skillTree: ['Vision lasts 9s', 'Chakra returns to him', 'Vishwarupa radius +60']
  },

  bhishma: {
    name: 'Bhishma',
    team: 'kauravas',
    title: 'Pitamaha · Gangaputra',
    color: '#bdc3c7',
    hp: 200,
    speed: 2.4,
    radius: 18,
    basic: { name: "Pitamaha's Bow", kind: 'projectile', range: 620, damage: 26, speed: 11, cooldownMs: 480 },
    ability: {
      name: 'Adamant Stance',
      kind: 'rooted_power',
      durationMs: 5000,
      cooldownMs: 16000,
      damageBonusPct: 80,
      desc: 'Plants himself like a mountain. Cannot move for 5s but arrows deal +80% damage.'
    },
    astra: {
      name: 'Icchamrityu',
      kind: 'invulnerability',
      durationMs: 8000,
      cooldownMs: 90000,
      maxUses: 1,
      unlock: { kind: 'damage_taken_ge', value: 100 },
      desc: 'The boon of choosing his death. Cannot be killed for 8s — HP cannot drop below 1.'
    },
    skillTree: ['+50 max HP', 'Stance lasts 8s', 'Icchamrityu lasts 12s']
  }
};

// Each team's selectable roster (server enforces no duplicates across the whole match).
const TEAM_ROSTER = {
  pandavas: ['krishna', 'yudhishthira', 'bhima', 'arjuna', 'nakula', 'sahadeva'],
  kauravas: ['bhishma', 'duryodhana', 'dushasana', 'karna', 'ashwatthama', 'shakuni']
};

function buildPlayerState(charKey, basePlayer) {
  const c = CHARACTERS[charKey];
  if (!c) throw new Error('Unknown character: ' + charKey);
  return {
    ...basePlayer,
    character: charKey,
    name: c.name,
    title: c.title,
    color: c.color,
    team: c.team,
    hp: c.hp,
    maxHp: c.hp,
    speed: c.speed,
    radius: c.radius,
    facing: 0,
    cooldowns: { basic: 0, ability: 0, astra: 0 },
    astraReady: false,
    astraUsesLeft: c.astra.maxUses ?? Infinity,
    statusEffects: [],
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    spawnedAt: Date.now(),
    alive: true
  };
}

module.exports = { CHARACTERS, TEAM_ROSTER, buildPlayerState };
