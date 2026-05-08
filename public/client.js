// Kurukshetra client.
// One file, no build step. Renders four surfaces: join, character-select, arena, rules modal.

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let socket = null;
let mySocketId = null;
let myRoom = null;
let CHARACTERS = {};
let TEAM_ROSTER = { pandavas: [], kauravas: [] };
let lastSnap = null;
const input = { up: false, down: false, left: false, right: false, attack: false, ability: false, astra: false, facing: 0 };
let mouseWorld = { x: 0, y: 0 };

// client-side particle pool for projectile trails / impact bursts
const fxParticles = [];

// ----------------- screens -----------------
function show(screenId) {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  $('#' + screenId).classList.remove('hidden');
}

// ----------------- mobile detection -----------------
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (IS_TOUCH) document.body.classList.add('is-mobile');

// ----------------- rules modal -----------------
function openRules() { $('#rules-modal').classList.remove('hidden'); }
function closeRules() { $('#rules-modal').classList.add('hidden'); }
$$('#btnRulesJoin, #btnRulesLobby, #btnRulesArena').forEach(el => el && el.addEventListener('click', openRules));
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close-rules]')) closeRules();
  if (e.target.id === 'rules-modal') closeRules();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRules(); });

// ----------------- join -----------------
$('#btnJoin').addEventListener('click', async () => {
  const name = $('#displayName').value.trim() || 'Warrior';
  const room = $('#roomId').value.trim() || 'kurukshetra';
  const cdata = await fetch('/api/characters').then(r => r.json());
  CHARACTERS = cdata.CHARACTERS;
  TEAM_ROSTER = cdata.TEAM_ROSTER;

  socket = io();
  socket.on('joined', ({ roomId, you }) => {
    mySocketId = you;
    myRoom = roomId;
    $('.brand .room').textContent = '· room: ' + roomId;
    show('screen-select');
    renderRosters();
    // bring up the voice bar — mic is opt-in via the button
    $('#voice-bar').classList.remove('hidden');
    if (window.Voice) window.Voice.init(socket, mySocketId);
  });
  socket.on('snapshot', onSnapshot);
  socket.emit('joinRoom', { roomId: room, displayName: name });
});

// ----------------- voice UI -----------------
$('#btnVoiceEnable').addEventListener('click', async () => {
  const ok = await window.Voice.enableMic();
  if (ok) {
    $('#btnVoiceEnable').textContent = '🎤 Mic on';
    $('#btnVoiceEnable').classList.remove('primary-voice');
    $('#btnVoiceMute').classList.remove('hidden');
  } else {
    alert('Could not access the microphone. Check browser permissions.');
  }
});
$('#btnVoiceMute').addEventListener('click', () => {
  window.Voice.toggleMute();
  const muted = window.Voice.isMuted();
  const btn = $('#btnVoiceMute');
  btn.textContent = muted ? '🔇 Muted' : '🔇 Mute';
  btn.classList.toggle('muted', muted);
});
window.onVoiceStateChange = () => {
  // re-render badges if needed; cheap
};

function updateVoiceChannelLabel(snap) {
  const el = $('#voiceChannel');
  if (!el) return;
  if (snap.phase === 'break') {
    el.textContent = '🔓 Open battlefield';
    el.classList.remove('team'); el.classList.add('open');
  } else {
    el.textContent = '🛡 Team channel only';
    el.classList.remove('open'); el.classList.add('team');
  }
}

// ----------------- mode toggle (auto vs manual) -----------------
$$('.mode-btn').forEach(b => b.addEventListener('click', () => {
  const mode = b.dataset.mode;
  socket?.emit('setAssignmentMode', { mode });
}));
function setLobbyMode(mode) {
  $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#auto-lobby').classList.toggle('hidden', mode !== 'auto');
  $('#manual-select').classList.toggle('hidden', mode !== 'manual');
}

// ----------------- maze-style toggle (classical vs free-build) -----------------
$$('.maze-btn').forEach(b => b.addEventListener('click', () => {
  socket?.emit('setMazeMode', { mode: b.dataset.maze });
}));
function setMazeModeUI(mode) {
  $$('.maze-btn').forEach(b => b.classList.toggle('active', b.dataset.maze === mode));
}

// ----------------- leave room -----------------
function leaveRoom() {
  // confirm if mid-match
  const inMatch = lastSnap && (lastSnap.phase === 'setup' || lastSnap.phase === 'break');
  if (inMatch && !confirm('Leave the field? You will abandon the round in progress.')) return;
  // tear down voice
  if (window.Voice) window.Voice.disableMic && window.Voice.disableMic();
  // tell server
  socket?.emit('leaveRoom');
  // local cleanup
  if (socket) { socket.disconnect(); socket = null; }
  lastSnap = null;
  mySocketId = null;
  myRoom = null;
  // hide voice bar + briefing + overlays
  $('#voice-bar').classList.add('hidden');
  $('#briefing').classList.add('hidden');
  $('#overlay').classList.add('hidden');
  $('#mobile-controls').classList.add('hidden');
  // back to join screen with their name preserved (we never cleared the input)
  show('screen-join');
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-leave]')) leaveRoom();
});

// ----------------- music toggle -----------------
$('#btnMusic')?.addEventListener('click', async () => {
  if (!window.Music) return;
  if (!window.Music.isStarted()) {
    await window.Music.start();
    $('#btnMusic').textContent = '🎵 On';
  } else {
    window.Music.toggleMute();
    $('#btnMusic').textContent = window.Music.isMuted() ? '🔈 Music' : '🎵 On';
  }
});

// auto-lobby ready button
$('#btnReadyAuto').addEventListener('click', () => {
  const me = lastSnap?.players.find(p => p.socketId === mySocketId);
  socket.emit('setReady', { ready: !(me && me.ready) });
});

// add/remove bot buttons
$('#btnAddBot')?.addEventListener('click', () => socket?.emit('addBot'));
$('#btnClearBots')?.addEventListener('click', () => socket?.emit('removeBots'));

function renderAutoLobby(snap) {
  const bench = $('#playerBench');
  bench.innerHTML = '';
  for (const p of snap.players) {
    const tile = document.createElement('div');
    const voiceCls = p.voiceEnabled ? (p.voiceMuted ? ' voice-muted' : ' voice-on') : '';
    tile.className = 'player-tile' + (p.socketId === mySocketId ? ' is-me' : '') + (p.ready ? ' is-ready' : '') + (p.isBot ? ' is-bot' : '') + voiceCls;
    const initial = p.isBot ? '🤖' : (p.displayName || '?').charAt(0).toUpperCase();
    const voiceTag = p.voiceEnabled ? (p.voiceMuted ? ' · 🔇' : ' · 🎤') : '';
    const status = p.isBot ? 'AI · auto-ready' : (p.ready ? 'Ready for war' : 'Awaiting…');
    tile.innerHTML = `
      <div class="voice-dot"></div>
      <div class="avatar">${escapeHtml(initial)}</div>
      <div class="meta">
        <div class="name">${escapeHtml(p.displayName)}${voiceTag}</div>
        <div class="status">${status}${p.socketId === mySocketId ? ' · you' : ''}</div>
      </div>
    `;
    bench.appendChild(tile);
  }
  const me = snap.players.find(p => p.socketId === mySocketId);
  const readyCount = snap.players.filter(p => p.ready).length;
  $('#btnReadyAuto').textContent = me && me.ready ? 'Cancel ready' : 'I\'m ready';
  $('#readySummary').textContent = `${readyCount}/${snap.players.length} ready · need 2+ players to begin`;
}

// ----------------- character select (manual mode) -----------------
function renderRosters() {
  for (const team of ['pandavas', 'kauravas']) {
    const el = $('#roster-' + team);
    el.innerHTML = '';
    for (const key of TEAM_ROSTER[team]) {
      const c = CHARACTERS[key];
      const card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.char = key;
      card.dataset.team = team;
      card.style.setProperty('--card-glow', c.color);
      card.innerHTML = `
        <div class="swatch" style="background:${c.color}; box-shadow:0 0 14px ${c.color}66"></div>
        <div class="picker"></div>
        <h3>${c.name}</h3>
        <div class="title">${c.title}</div>
        <div class="stats">HP ${c.hp} · SPD ${c.speed.toFixed ? c.speed.toFixed(1) : c.speed}</div>
        <div class="ab"><b>${c.basic.name}</b> · ${c.basic.kind}</div>
        <div class="ab"><b>${c.ability.name}</b> — ${c.ability.desc || ''}</div>
        <div class="astra">★ ${c.astra.name} — ${c.astra.desc || ''}</div>
      `;
      card.addEventListener('click', () => {
        if (card.classList.contains('locked') || card.classList.contains('taken-by-other')) return;
        socket.emit('switchTeam', { team });
        socket.emit('pickCharacter', { character: key });
      });
      el.appendChild(card);
    }
  }
  $$('.join-team').forEach(b => b.addEventListener('click', () => {
    socket.emit('switchTeam', { team: b.dataset.team });
  }));
  $('#btnReady').addEventListener('click', () => {
    const me = lastSnap?.players.find(p => p.socketId === mySocketId);
    socket.emit('setReady', { ready: !(me && me.ready) });
  });
}

function updateSelectScreen(snap) {
  const me = snap.players.find(p => p.socketId === mySocketId);
  // build a global taken map: charKey -> player
  const takenByOther = new Map();
  for (const p of snap.players) {
    if (p.character && p.socketId !== mySocketId) takenByOther.set(p.character, p);
  }
  for (const team of ['pandavas', 'kauravas']) {
    const teammates = snap.players.filter(p => p.team === team);
    $(`.team-col[data-team="${team}"] .count`).textContent = `(${teammates.length})`;
    $$(`#roster-${team} .char-card`).forEach(card => {
      const k = card.dataset.char;
      // wipe state
      card.classList.remove('picked', 'locked', 'taken-by-other');
      card.querySelector('.stamp')?.remove();
      const owner = snap.players.find(p => p.character === k);
      const pickerEl = card.querySelector('.picker');
      pickerEl.textContent = owner ? owner.displayName : '';

      if (owner && owner.socketId === mySocketId) {
        card.classList.add('picked');
      } else if (takenByOther.has(k)) {
        card.classList.add('taken-by-other');
        const stamp = document.createElement('div');
        stamp.className = 'stamp';
        stamp.textContent = (owner.displayName || 'TAKEN').slice(0, 10).toUpperCase();
        card.appendChild(stamp);
      } else if (me && me.team !== team) {
        card.classList.add('locked');
      }
    });
  }
  // ready list
  const readyList = snap.players.map(p => `${p.displayName}${p.ready ? ' ✓' : ''}${p.character ? ' (' + (CHARACTERS[p.character]?.name || '?') + ')' : ''}`).join(' · ');
  $('#readyList').textContent = readyList;
  $('#btnReady').textContent = me && me.ready ? 'Cancel ready' : "I'm ready";
  $('#btnReady').disabled = !(me && me.character);
}

// ----------------- arena -----------------
const canvas = $('#game');
const ctx = canvas.getContext('2d');
let camera = { x: 0, y: 0, scale: 1 };
let setupHover = null;

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  // don't capture keys while typing into inputs
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') input.up = true;
  if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') input.down = true;
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') input.left = true;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') input.right = true;
  if (e.key === ' ') input.attack = true;
  if (e.key === 'e' || e.key === 'E') input.ability = true;
  if (e.key === 'q' || e.key === 'Q') input.astra = true;
});
window.addEventListener('keyup', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') input.up = false;
  if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') input.down = false;
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') input.left = false;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') input.right = false;
  if (e.key === ' ') input.attack = false;
  if (e.key === 'e' || e.key === 'E') input.ability = false;
  if (e.key === 'q' || e.key === 'Q') input.astra = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  mouseWorld.x = sx + camera.x;
  mouseWorld.y = sy + camera.y;
  if (lastSnap?.maze) {
    const cs = lastSnap.maze.cellSize;
    setupHover = { x: Math.floor(mouseWorld.x / cs), y: Math.floor(mouseWorld.y / cs) };
  }
});
canvas.addEventListener('mousedown', (e) => {
  // setup-phase tile-edit takes priority over combat clicks
  if (lastSnap?.phase === 'setup' && setupHover) {
    const isFree = lastSnap.mazeMode === 'freebuild';
    if (e.button === 0) {
      if (isFree && (e.shiftKey || e.altKey)) {
        socket?.emit('toggleWall', { x: setupHover.x, y: setupHover.y });
      } else {
        socket?.emit('placeTrap', { x: setupHover.x, y: setupHover.y });
      }
    } else if (e.button === 2 && isFree) {
      socket?.emit('toggleWall', { x: setupHover.x, y: setupHover.y });
    }
    return; // don't also send attack/ability while sculpting
  }
  if (e.button === 0) input.attack = true;
  if (e.button === 2) input.ability = true;
});
canvas.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.attack = false;
  if (e.button === 2) input.ability = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 30 Hz input pump
setInterval(() => {
  if (!socket || !lastSnap) return;
  const me = lastSnap.players.find(p => p.socketId === mySocketId);
  if (!me) return;
  // On desktop: aim with mouse. On mobile: aim is set by the right-stick handler.
  if (!IS_TOUCH) {
    const dx = mouseWorld.x - me.x;
    const dy = mouseWorld.y - me.y;
    input.facing = Math.atan2(dy, dx);
  }
  socket.emit('input', { ...input });
}, 33);

// ----------------- snapshot handler -----------------
function onSnapshot(snap) {
  // particle hooks: spawn FX where new projectiles appeared (cheap visual flair)
  if (lastSnap && snap.projectiles) {
    for (const pr of snap.projectiles) {
      if (Math.random() < 0.5) {
        fxParticles.push({
          x: pr.x, y: pr.y, vx: (Math.random() - .5) * .6, vy: (Math.random() - .5) * .6,
          life: 360, max: 360,
          color: pr.piercing ? '#ffd76e' : (pr.team === 'pandavas' ? '#5dade2' : '#ec7063'),
          r: 1 + Math.random() * 2
        });
      }
    }
  }
  // briefing card: only when we ENTER setup (and have maze info)
  if (snap.phase === 'setup' && (!lastSnap || lastSnap.phase !== 'setup') && snap.maze) {
    showBriefing(snap.maze);
  }
  // music phase
  if (window.Music && (!lastSnap || lastSnap.phase !== snap.phase)) {
    window.Music.setPhase(snap.phase);
  }
  // maze mode UI
  if (snap.mazeMode) setMazeModeUI(snap.mazeMode);
  lastSnap = snap;
  if (window.Voice) window.Voice.onSnapshot(snap);
  updateVoiceChannelLabel(snap);
  if (snap.phase === 'lobby' || snap.phase === 'character_select' || snap.phase === 'match_over') {
    show('screen-select');
    setLobbyMode(snap.assignmentMode || 'auto');
    if ((snap.assignmentMode || 'auto') === 'auto') {
      renderAutoLobby(snap);
    } else {
      updateSelectScreen(snap);
    }
  } else {
    show('screen-arena');
    updateArena(snap);
    // toggle mobile-controls visibility once we're in arena
    $('#mobile-controls').classList.toggle('hidden', !IS_TOUCH);
  }
}

function updateArena(snap) {
  const me = snap.players.find(p => p.socketId === mySocketId);

  // header
  const phaseEl = $('.phase-banner');
  const phaseLabels = {
    setup: `${cap(snap.defendingTeam)} setting traps in ${snap.maze.name}`,
    break: `${cap(snap.attackingTeam)} breaking the ${snap.maze.name}`,
    round_over: 'Round over',
    match_over: 'Match complete'
  };
  const remaining = Math.max(0, Math.ceil((snap.phaseEndsAt - Date.now()) / 1000));
  phaseEl.textContent = `Round ${snap.round} · ${phaseLabels[snap.phase] || snap.phase} · ${remaining}s`;
  $('.score .pandavas b').textContent = snap.score.pandavas;
  $('.score .kauravas b').textContent = snap.score.kauravas;
  $('#legend').classList.toggle('setup', snap.phase === 'setup');

  // me card + abilities
  if (me) {
    const c = CHARACTERS[me.character] || {};
    const meCard = $('#myCard');
    meCard.style.setProperty('--my-color', me.color);
    meCard.innerHTML = `
      <div class="name" style="color:${me.color}">${me.name}</div>
      <div class="title">${me.title || ''} · ${cap(me.team)}</div>
      <div class="hpbar"><div class="fill" style="width:${(me.hp / me.maxHp) * 100}%"></div></div>
      <div class="stats-line">HP ${me.hp}/${me.maxHp} · Kills ${me.kills} · Dmg ${me.damageDealt}</div>
    `;
    const abilHTML = [];
    abilHTML.push(abilityRow('LMB', c.basic?.name, me.cooldowns.basic, me.cooldowns.basic === 0, false, false));
    abilHTML.push(abilityRow('E', c.ability?.name, me.cooldowns.ability, me.cooldowns.ability === 0, false, false));
    abilHTML.push(abilityRow('Q', c.astra?.name, me.cooldowns.astra, me.astraReady && me.cooldowns.astra === 0, !me.astraReady, me.astraReady));
    $('#abilities').innerHTML = abilHTML.join('');
  }
  // events
  $('#events').innerHTML = (snap.events || []).map(e => `<div>${escapeHtml(e.text)}</div>`).join('');

  // round over / match over banner
  if (snap.phase === 'round_over' || snap.phase === 'match_over') {
    showOverlay(snap);
  } else {
    $('#overlay').classList.add('hidden');
  }

  // render the canvas
  renderCanvas(snap, me);
}

function abilityRow(key, label, cd, ready, locked = false, astraArmed = false) {
  const cdSec = cd > 0 ? Math.ceil(cd / 1000) + 's' : 'ready';
  const cls = ['ab-row', ready && cd === 0 ? 'ready' : '', locked ? 'locked' : '', astraArmed ? 'astra-armed' : ''].join(' ');
  return `<div class="${cls}"><span class="key">${key}</span><span class="label">${label || '—'}</span><span class="cd">${locked ? '🔒' : cdSec}</span></div>`;
}

function showOverlay(snap) {
  let title, sub;
  if (snap.phase === 'match_over') {
    const winner = snap.score.pandavas > snap.score.kauravas ? 'Pandavas' : 'Kauravas';
    const emblem = winner === 'Pandavas' ? '🪷' : '🐍';
    title = `${emblem} ${winner} win the war`;
    sub = `Final: 🪷 Pandavas ${snap.score.pandavas} – 🐍 Kauravas ${snap.score.kauravas}`;
  } else {
    title = `Round ${snap.round} ended`;
    sub = `Pandavas ${snap.score.pandavas} – Kauravas ${snap.score.kauravas}. Next round soon...`;
  }
  $('#overlay').innerHTML = `<div class="panel"><h2>${title}</h2><p>${sub}</p></div>`;
  $('#overlay').classList.remove('hidden');
}

// =========================================================
//  Canvas render — atmospheric maze
// =========================================================
function renderCanvas(snap, me) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!snap.maze) return;
  const cs = snap.maze.cellSize;
  const worldW = snap.maze.width * cs;
  const worldH = snap.maze.height * cs;

  // camera follow
  if (me) {
    camera.x = clamp(me.x - W / 2, 0, Math.max(0, worldW - W));
    camera.y = clamp(me.y - H / 2, 0, Math.max(0, worldH - H));
  }

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawFloor(snap, worldW, worldH, cs);
  drawWalls(snap, cs);
  drawSpecialTiles(snap, me, cs);
  drawTraps(snap, me, cs);
  drawDecoys(snap);
  drawProjectiles(snap);
  drawParticles();
  drawPlayers(snap, me);

  ctx.restore();

  // post-pass overlays in screen space
  drawFogOfWar(snap, me, W, H);
  drawVignette(W, H);
  drawSetupHelpers(snap, me, cs); // before fog? after? — draw in world space already. So redo separately:
}

// ---- FLOOR ----
function drawFloor(snap, worldW, worldH, cs) {
  // base: dark battlefield earth
  ctx.fillStyle = '#1a0f06';
  ctx.fillRect(0, 0, worldW, worldH);

  // subtle warm radial light around field center
  const grad = ctx.createRadialGradient(worldW / 2, worldH / 2, 80, worldW / 2, worldH / 2, Math.max(worldW, worldH));
  grad.addColorStop(0, 'rgba(80, 40, 12, 0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, worldW, worldH);

  // tile lines (very faint)
  ctx.strokeStyle = 'rgba(80,55,20,.10)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= snap.maze.width; x++) {
    ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, worldH); ctx.stroke();
  }
  for (let y = 0; y <= snap.maze.height; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(worldW, y * cs); ctx.stroke();
  }

  // splatter / debris freckles, deterministic by maze name so they don't dance
  const seed = simpleHash(snap.maze.name);
  for (let i = 0; i < 200; i++) {
    const r1 = pseudo(seed + i * 17);
    const r2 = pseudo(seed + i * 31);
    const r3 = pseudo(seed + i * 53);
    const x = r1 * worldW;
    const y = r2 * worldH;
    const size = 1 + r3 * 2.5;
    ctx.fillStyle = r3 > 0.5 ? 'rgba(120,30,30,.18)' : 'rgba(60,40,20,.25)';
    ctx.fillRect(x, y, size, size);
  }
}

// ---- WALLS — chiseled stone with depth ----
function drawWalls(snap, cs) {
  const wallSet = new Set(snap.maze.walls);
  for (const w of snap.maze.walls) {
    const [wx, wy] = w.split(',').map(Number);
    const x = wx * cs, y = wy * cs;
    // base block
    const g = ctx.createLinearGradient(x, y, x, y + cs);
    g.addColorStop(0, '#6b4a1f');
    g.addColorStop(0.5, '#4a3115');
    g.addColorStop(1, '#2a1d0a');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, cs, cs);
    // top-light highlight
    ctx.fillStyle = 'rgba(255,210,140,.10)';
    ctx.fillRect(x, y, cs, 2);
    // bottom shadow
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(x, y + cs - 3, cs, 3);
    // brick crack — only if neighbor is not a wall, gives a chunky look
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
    // corner stipple
    ctx.fillStyle = 'rgba(255,200,120,.12)';
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillRect(x + cs - 4, y + cs - 4, 2, 2);
  }
}

// ---- ENTRY / EXIT — pulsing glow ----
function drawSpecialTiles(snap, me, cs) {
  const t = Date.now() / 600;
  const pulse = 0.5 + 0.5 * Math.sin(t);
  const ent = snap.maze.entry, ex = snap.maze.exit;

  // entry — green pulsing
  drawGlowTile(ent.x * cs, ent.y * cs, cs, '#2ecc71', 0.25 + pulse * 0.35);
  // exit — gold pulsing
  drawGlowTile(ex.x * cs, ex.y * cs, cs, '#f5d76e', 0.25 + pulse * 0.45);

  // labels
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ENTRY', ent.x * cs + cs / 2, ent.y * cs + cs / 2 + 3);
  ctx.fillText('EXIT', ex.x * cs + cs / 2, ex.y * cs + cs / 2 + 3);
  ctx.textAlign = 'start';

  // suggested trap zones during setup, only for defenders
  if (snap.phase === 'setup' && me && me.team === snap.defendingTeam) {
    ctx.strokeStyle = 'rgba(231,126,34,.6)';
    ctx.setLineDash([4, 4]);
    for (const z of snap.maze.suggestedTrapZones || []) {
      ctx.strokeRect(z.x * cs, z.y * cs, z.w * cs, z.h * cs);
    }
    ctx.setLineDash([]);
    if (setupHover) {
      ctx.fillStyle = `rgba(231,126,34,${0.25 + pulse * 0.25})`;
      ctx.fillRect(setupHover.x * cs, setupHover.y * cs, cs, cs);
    }
  }
}

function drawGlowTile(x, y, cs, color, alpha) {
  // outer glow
  const g = ctx.createRadialGradient(x + cs / 2, y + cs / 2, 2, x + cs / 2, y + cs / 2, cs * 1.6);
  g.addColorStop(0, hexToRgba(color, alpha));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - cs, y - cs, cs * 3, cs * 3);
  // inner tile
  ctx.fillStyle = hexToRgba(color, 0.35);
  ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
  ctx.strokeStyle = hexToRgba(color, 0.9);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2.5, y + 2.5, cs - 5, cs - 5);
}

// ---- TRAPS — visible to your own team only (or once triggered) ----
function drawTraps(snap, me, cs) {
  const sparkle = (Date.now() / 200) % 2 < 1;
  for (const t of snap.traps) {
    const x = t.x * cs, y = t.y * cs;
    if (me && t.team === me.team) {
      // friendly trap — clearly visible spike pattern
      ctx.fillStyle = 'rgba(231,76,60,.55)';
      ctx.fillRect(x + 3, y + 3, cs - 6, cs - 6);
      ctx.fillStyle = '#7b1f1f';
      // four spikes pointing inward
      const cx = x + cs / 2, cy = y + cs / 2;
      ctx.beginPath();
      ctx.moveTo(cx, y + 5); ctx.lineTo(cx - 3, cy); ctx.lineTo(cx + 3, cy); ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, y + cs - 5); ctx.lineTo(cx - 3, cy); ctx.lineTo(cx + 3, cy); ctx.closePath();
      ctx.fill();
      if (sparkle) {
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
    } else if (!t.armed) {
      // triggered — visible to all
      ctx.fillStyle = 'rgba(180,40,40,.45)';
      ctx.fillRect(x + 4, y + 4, cs - 8, cs - 8);
      ctx.strokeStyle = 'rgba(255,80,80,.5)';
      ctx.strokeRect(x + 4.5, y + 4.5, cs - 9, cs - 9);
    }
  }
}

// ---- DECOYS (Shakuni's Mayastra) ----
function drawDecoys(snap) {
  for (const d of snap.decoys || []) {
    drawCharacterBlob(d.x, d.y, 14, d.color, 0, '?', 0.55, 1);
  }
}

// ---- PROJECTILES ----
function drawProjectiles(snap) {
  for (const pr of snap.projectiles) {
    const isPiercing = pr.piercing;
    const color = isPiercing ? '#ffd76e' : (pr.team === 'pandavas' ? '#5dade2' : '#ec7063');
    // halo
    const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, isPiercing ? 18 : 10);
    g.addColorStop(0, hexToRgba(color, 0.7));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(pr.x - 18, pr.y - 18, 36, 36);
    // core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, isPiercing ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- particles tick + render ----
function drawParticles() {
  for (let i = fxParticles.length - 1; i >= 0; i--) {
    const p = fxParticles[i];
    p.x += p.vx; p.y += p.vy; p.life -= 33;
    if (p.life <= 0) { fxParticles.splice(i, 1); continue; }
    ctx.globalAlpha = (p.life / p.max) * 0.7;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- PLAYERS ----
function drawPlayers(snap, me) {
  const now = Date.now();
  for (const p of snap.players) {
    if (!p.alive) continue;
    let alpha = 1;
    if (p.invisibleUntil && p.invisibleUntil > now && p.socketId !== mySocketId) {
      if (me && me.team !== p.team) alpha = 0.07;
    }
    const isInvulnerable = p.invulnerableUntil && p.invulnerableUntil > now;
    drawCharacterBlob(p.x, p.y, p.radius, p.color, p.facing, (p.name || '?').charAt(0), alpha, p.hp / p.maxHp, isInvulnerable);
    // name tag
    const voiceGlyph = p.voiceEnabled ? (p.voiceMuted ? ' 🔇' : ' 🎤') : '';
    ctx.fillStyle = p.team === 'pandavas' ? '#5a8cff' : '#ff6b58';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(p.name + voiceGlyph, p.x, p.y - p.radius - 9);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'start';
  }
}

function drawCharacterBlob(x, y, r, color, facing, label, alpha = 1, hpPct = 1, invulnerable = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  // soft glow under character
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  glow.addColorStop(0, hexToRgba(color, 0.5));
  glow.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);

  // body radial fill
  const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  bg.addColorStop(0, lighten(color, 0.4));
  bg.addColorStop(1, color);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // facing wedge
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r + 8, facing - 0.22, facing + 0.22);
  ctx.closePath();
  ctx.fill();

  // outline
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

  // initial
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'start';

  // hp ring
  ctx.beginPath();
  ctx.strokeStyle = '#2a1408';
  ctx.lineWidth = 3.5;
  ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = hpPct > 0.5 ? '#2ecc71' : (hpPct > 0.25 ? '#f1c40f' : '#e74c3c');
  ctx.lineWidth = 3.5;
  ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPct);
  ctx.stroke();

  // invulnerable shimmer (Bhishma's Icchamrityu)
  if (invulnerable) {
    const t = Date.now() / 200;
    ctx.strokeStyle = `rgba(245,215,110,${0.5 + 0.4 * Math.sin(t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r + 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r + 13, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
}

// ---- FOG OF WAR — vignette around the player, lifts during reveal ----
function drawFogOfWar(snap, me, W, H) {
  if (!me) return;
  const now = Date.now();
  const revealActive = snap.players.some(p => p.team === me.team && p.revealUntil && p.revealUntil > now);
  if (revealActive) return;
  // dark vignette: fully visible within ~280px, fades to dark beyond
  const sx = me.x - camera.x;
  const sy = me.y - camera.y;
  const inner = 200, outer = 480;
  const g = ctx.createRadialGradient(sx, sy, inner, sx, sy, outer);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawVignette(W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// helper that's called from world-space; left as no-op (already drawn inside drawSpecialTiles)
function drawSetupHelpers() {}

// =========================================================
//  Pre-round vyuha briefing
// =========================================================
let briefingTimer = null;
function showBriefing(maze) {
  const el = $('#briefing');
  if (!el || !maze) return;
  el.querySelector('.briefing-period').textContent = maze.period || '';
  el.querySelector('.briefing-name').textContent = maze.name || '';
  el.querySelector('.briefing-architect').textContent = maze.architect ? `Devised by ${maze.architect}` : '';
  el.querySelector('.briefing-lore').textContent = maze.lore || '';
  el.querySelector('.strat-att').textContent = maze.strategy?.attackers || '';
  el.querySelector('.strat-def').textContent = maze.strategy?.defenders || '';
  el.classList.remove('hidden');
  if (briefingTimer) clearTimeout(briefingTimer);
  briefingTimer = setTimeout(() => el.classList.add('hidden'), 8000);
}
document.addEventListener('click', (e) => {
  if (e.target.matches('.briefing-dismiss') || e.target.id === 'briefing') {
    $('#briefing').classList.add('hidden');
    if (briefingTimer) { clearTimeout(briefingTimer); briefingTimer = null; }
  }
});

// ----------------- helpers -----------------
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function escapeHtml(s) { return (s + '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

function hexToRgba(hex, a) {
  if (hex[0] !== '#') return hex;
  const h = hex.slice(1);
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex, amt) {
  if (hex[0] !== '#') return hex;
  const h = hex.slice(1);
  let r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  let g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  let b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  r = Math.min(255, r + (255 - r) * amt);
  g = Math.min(255, g + (255 - g) * amt);
  b = Math.min(255, b + (255 - b) * amt);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pseudo(seed) {
  // mulberry32
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
}

// =========================================================
// Mobile touch controls — twin virtual joysticks + buttons
// =========================================================
function setupTouchControls() {
  if (!IS_TOUCH) return;

  const moveZone = $('#touch-move');
  const aimZone = $('#touch-aim');
  const moveKnob = $('#moveKnob');
  const aimKnob = $('#aimKnob');
  const RADIUS = 56; // max knob displacement in px

  // Generic stick handler
  function attachStick(zone, knob, onUpdate, onTap) {
    let pointerId = null;
    let centerX = 0, centerY = 0;
    let movedFar = false;

    function reset() {
      knob.style.transform = 'translate(0,0)';
      onUpdate(0, 0); // released
      pointerId = null;
      movedFar = false;
    }

    zone.addEventListener('pointerdown', (e) => {
      if (pointerId !== null) return;
      pointerId = e.pointerId;
      const rect = zone.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      try { zone.setPointerCapture(pointerId); } catch (_) {}
      handleMove(e);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      handleMove(e);
      e.preventDefault();
    });
    function endHandler(e) {
      if (e.pointerId !== pointerId) return;
      // tap detection — if the knob never moved far, treat as a tap
      if (!movedFar && onTap) onTap();
      try { zone.releasePointerCapture(pointerId); } catch (_) {}
      reset();
      e.preventDefault();
    }
    zone.addEventListener('pointerup', endHandler);
    zone.addEventListener('pointercancel', endHandler);

    function handleMove(e) {
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const d = Math.hypot(dx, dy);
      const clamped = Math.min(d, RADIUS);
      if (d > 14) movedFar = true;
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * clamped;
      const ky = Math.sin(ang) * clamped;
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
      onUpdate(d > 8 ? Math.cos(ang) * (clamped / RADIUS) : 0,
               d > 8 ? Math.sin(ang) * (clamped / RADIUS) : 0);
    }
  }

  // Move stick → input.up/down/left/right
  attachStick(moveZone, moveKnob, (nx, ny) => {
    input.up = ny < -0.25;
    input.down = ny > 0.25;
    input.left = nx < -0.25;
    input.right = nx > 0.25;
  });

  // Aim stick → input.facing; tap fires basic attack
  let aimHoldTimer = null;
  attachStick(aimZone, aimKnob, (nx, ny) => {
    if (Math.hypot(nx, ny) > 0.2) {
      input.facing = Math.atan2(ny, nx);
      // hold-to-fire
      input.attack = true;
    } else {
      input.attack = false;
    }
  }, () => {
    // tap → quick fire pulse
    input.attack = true;
    if (aimHoldTimer) clearTimeout(aimHoldTimer);
    aimHoldTimer = setTimeout(() => { input.attack = false; }, 180);
  });

  // Action buttons
  function bindHold(btnId, key) {
    const btn = $('#' + btnId);
    btn.addEventListener('pointerdown', (e) => { input[key] = true; e.preventDefault(); });
    const release = (e) => { input[key] = false; if (e) e.preventDefault(); };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }
  bindHold('btnAbility', 'ability');
  bindHold('btnAstra', 'astra');

  // Tap canvas during setup → place a trap (mobile-friendly)
  canvas.addEventListener('touchend', (e) => {
    if (lastSnap?.phase === 'setup' && setupHover) {
      socket?.emit('placeTrap', { x: setupHover.x, y: setupHover.y });
    }
  });
  // also keep mouseWorld in sync for touch
  canvas.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    mouseWorld.x = sx + camera.x;
    mouseWorld.y = sy + camera.y;
    if (lastSnap?.maze) {
      const cs = lastSnap.maze.cellSize;
      setupHover = { x: Math.floor(mouseWorld.x / cs), y: Math.floor(mouseWorld.y / cs) };
    }
  }, { passive: true });
}

setupTouchControls();
