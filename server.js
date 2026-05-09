// Kurukshetra — Mahabharat-themed multiplayer maze war.
// Single-process Node.js + Socket.io + Express. Designed for ngrok hosting.

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const { Match } = require('./game/engine');
const { CHARACTERS, TEAM_ROSTER } = require('./game/characters');
const accounts = require('./game/accounts');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/characters', (req, res) => {
  res.json({ CHARACTERS, TEAM_ROSTER });
});

// ---- account routes ----
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const { token, username: u } = await accounts.register(username, password);
    res.cookie('kurukshetra_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ ok: true, username: u });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const { token, username: u } = await accounts.login(username, password);
    res.cookie('kurukshetra_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ ok: true, username: u });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('kurukshetra_token');
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => {
  const u = accounts.verifyToken(req.cookies.kurukshetra_token);
  if (!u) return res.json({ ok: false });
  res.json({ ok: true, username: u });
});
app.get('/api/me/history', (req, res) => {
  const u = accounts.verifyToken(req.cookies.kurukshetra_token);
  if (!u) return res.status(401).json({ ok: false });
  res.json({ ok: true, stats: accounts.getStats(u) });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map(); // roomId -> Match

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Match(roomId, io));
  return rooms.get(roomId);
}

io.on('connection', (socket) => {
  let currentRoom = null;
  // try to read auth cookie from the original handshake
  const cookieHeader = socket.handshake.headers.cookie || '';
  const tokenMatch = cookieHeader.match(/kurukshetra_token=([^;]+)/);
  const authedUser = tokenMatch ? accounts.verifyToken(decodeURIComponent(tokenMatch[1])) : null;

  socket.on('joinRoom', ({ roomId, displayName }) => {
    if (currentRoom) socket.leave(currentRoom);
    const r = (roomId || 'kurukshetra').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'kurukshetra';
    socket.join(r);
    currentRoom = r;
    const match = getRoom(r);
    if (match.phase !== 'lobby' && match.phase !== 'match_over') {
      // mid-match: still join as spectator-but-bench (shows in next round)
    }
    // logged-in users get their account name; guests use the typed name
    match.addPlayer(socket.id, authedUser || displayName, { authedUser });
    socket.emit('joined', { roomId: r, you: socket.id });
    match.broadcast();
  });

  socket.on('switchTeam', ({ team }) => {
    if (!currentRoom) return;
    getRoom(currentRoom).switchTeam(socket.id, team);
    getRoom(currentRoom).broadcast();
  });

  socket.on('setAssignmentMode', ({ mode }) => {
    if (!currentRoom) return;
    getRoom(currentRoom).setAssignmentMode(mode);
    getRoom(currentRoom).broadcast();
  });

  socket.on('addBot', () => {
    if (!currentRoom) return;
    getRoom(currentRoom).addBot();
    getRoom(currentRoom).broadcast();
  });

  socket.on('leaveRoom', () => {
    if (!currentRoom) return;
    const m = getRoom(currentRoom);
    socket.to(currentRoom).emit('voice-peer-left', { peerId: socket.id });
    socket.leave(currentRoom);
    m.removePlayer(socket.id);
    if (m.players.size === 0) {
      m.destroy();
      rooms.delete(currentRoom);
    } else {
      m.broadcast();
    }
    currentRoom = null;
    socket.emit('leftRoom');
  });

  socket.on('removeBots', () => {
    if (!currentRoom) return;
    getRoom(currentRoom).removeAllBots();
    getRoom(currentRoom).broadcast();
  });

  socket.on('pickCharacter', ({ character }) => {
    if (!currentRoom) return;
    getRoom(currentRoom).pickCharacter(socket.id, character);
    getRoom(currentRoom).broadcast();
  });

  socket.on('setReady', ({ ready }) => {
    if (!currentRoom) return;
    getRoom(currentRoom).setReady(socket.id, ready);
    const m = getRoom(currentRoom);
    m.broadcast();
    if (m.canStart() && m.phase === 'lobby') m.startMatch();
  });

  socket.on('input', (input) => {
    if (!currentRoom) return;
    getRoom(currentRoom).setInput(socket.id, input);
  });

  socket.on('placeTrap', ({ x, y }) => {
    if (!currentRoom) return;
    getRoom(currentRoom).placeTrap(socket.id, x, y);
  });

  socket.on('toggleWall', ({ x, y }) => {
    if (!currentRoom) return;
    getRoom(currentRoom).toggleWall(socket.id, x, y);
  });

  socket.on('setMazeMode', ({ mode }) => {
    if (!currentRoom) return;
    getRoom(currentRoom).setMazeMode(mode);
    getRoom(currentRoom).broadcast();
  });

  // -------- WebRTC voice signaling (relay only) --------
  // Forward SDP / ICE between peers in the same room without inspecting them.
  socket.on('voice-signal', ({ to, payload }) => {
    if (!currentRoom || !to) return;
    const m = getRoom(currentRoom);
    if (!m.players.has(to)) return;
    io.to(to).emit('voice-signal', { from: socket.id, payload });
  });

  socket.on('voice-state', ({ enabled, muted }) => {
    if (!currentRoom) return;
    const m = getRoom(currentRoom);
    const p = m.players.get(socket.id);
    if (!p) return;
    p.voiceEnabled = !!enabled;
    p.voiceMuted = !!muted;
    m.broadcast();
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const m = getRoom(currentRoom);
    // notify peers so they can tear down their RTCPeerConnections
    socket.to(currentRoom).emit('voice-peer-left', { peerId: socket.id });
    m.removePlayer(socket.id);
    if (m.players.size === 0) {
      m.destroy();
      rooms.delete(currentRoom);
    } else {
      m.broadcast();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Kurukshetra server listening on http://localhost:${PORT}`);
  console.log(`Expose with:  ngrok http ${PORT}`);
});
