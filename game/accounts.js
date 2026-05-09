// File-based account storage. Suitable for small deployments.
// On Render's free tier the disk is ephemeral — data resets on each
// service restart/redeploy. For real persistence point this at a
// proper Postgres / Redis adapter (just swap loadDB / saveDB).

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const SECRET = process.env.JWT_SECRET || 'kurukshetra-dharma-yuddha-' + Math.random().toString(36).slice(2, 10);

let db = { users: {} };       // username -> { username, hash, createdAt }
let matchHistory = {};        // username -> [ matchRecord, ... ]

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function loadDB() {
  ensureDir();
  try { db = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (_) { db = { users: {} }; }
  try { matchHistory = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8')); } catch (_) { matchHistory = {}; }
}
function save() {
  ensureDir();
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2)); } catch (e) { console.warn('save users', e); }
  try { fs.writeFileSync(MATCHES_FILE, JSON.stringify(matchHistory, null, 2)); } catch (e) { console.warn('save matches', e); }
}
loadDB();

const VALID_USER = /^[a-zA-Z0-9_]{3,18}$/;

async function register(username, password) {
  if (!VALID_USER.test(username)) throw new Error('Username must be 3-18 chars: a-z, A-Z, 0-9, _');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
  if (db.users[username]) throw new Error('Username already taken');
  const hash = await bcrypt.hash(password, 10);
  db.users[username] = { username, hash, createdAt: Date.now() };
  save();
  return signToken(username);
}

async function login(username, password) {
  const u = db.users[username];
  if (!u) throw new Error('No such warrior');
  const ok = await bcrypt.compare(password, u.hash);
  if (!ok) throw new Error('Wrong password');
  return signToken(username);
}

function signToken(username) {
  const token = jwt.sign({ u: username }, SECRET, { expiresIn: '30d' });
  return { token, username };
}

function verifyToken(token) {
  if (!token) return null;
  try { return jwt.verify(token, SECRET).u; } catch (_) { return null; }
}

function recordMatch(username, record) {
  if (!username || !db.users[username]) return;
  if (!matchHistory[username]) matchHistory[username] = [];
  matchHistory[username].unshift(record);
  if (matchHistory[username].length > 100) matchHistory[username].pop();
  save();
}

function getStats(username) {
  const list = matchHistory[username] || [];
  const total = list.length;
  let wins = 0, kills = 0, dmg = 0;
  const byChar = {};
  for (const m of list) {
    if (m.won) wins++;
    kills += m.kills || 0;
    dmg += m.damageDealt || 0;
    const c = m.character || 'unknown';
    byChar[c] = byChar[c] || { played: 0, wins: 0, kills: 0 };
    byChar[c].played++;
    if (m.won) byChar[c].wins++;
    byChar[c].kills += m.kills || 0;
  }
  return {
    username,
    total, wins, losses: total - wins,
    winRate: total ? (wins / total) : 0,
    kills, damageDealt: dmg,
    byCharacter: byChar,
    recent: list.slice(0, 20)
  };
}

module.exports = { register, login, verifyToken, recordMatch, getStats };
