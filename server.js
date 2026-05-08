// Kurukshetra — Mahabharat-themed multiplayer maze war.
// Single-process Node.js + Socket.io + Express. Designed for ngrok hosting.

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Match } = require('./game/engine');
const { CHARACTERS, TEAM_ROSTER } = require('./game/characters');

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/characters', (req, res) => {
  res.json({ CHARACTERS, TEAM_ROSTER });
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

  socket.on('joinRoom', ({ roomId, displayName }) => {
    if (currentRoom) socket.leave(currentRoom);
    const r = (roomId || 'kurukshetra').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'kurukshetra';
    socket.join(r);
    currentRoom = r;
    const match = getRoom(r);
    if (match.phase !== 'lobby' && match.phase !== 'match_over') {
      // mid-match: still join as spectator-but-bench (shows in next round)
    }
    match.addPlayer(socket.id, displayName);
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
