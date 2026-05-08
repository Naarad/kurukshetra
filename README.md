# ⚔️ Kurukshetra — Pandavas vs Kauravas

A real-time multiplayer maze-war game inspired by the battle formations (vyuhas) of the Mahabharat. Two teams take turns: one side sets up traps inside the vyuha, the other races to break out alive. Each character has their own divine astras that unlock under specific conditions (kills, time alive, allies fallen, damage dealt/taken).

**Stack:** Node.js + Express + Socket.io + HTML5 Canvas. No build step. Single process. Designed to be tunneled through ngrok so friends on different networks can play together.

---

## Quick start

```bash
cd kurukshetra
npm install
npm start
```

Then open `http://localhost:3000` in two browser tabs to test locally. (Or just one tab + add a bot — see below.)

---

## 🤖 Playing with bots

Don't have enough friends online? Click **🤖 Add bot** in the auto-assign lobby. Each click spawns one AI-controlled warrior. Bots have a Mahabharat-flavored name (Vyasa, Sanjaya, Vidura, Sikhandi, …), an 🤖 avatar, and a dashed border so you can tell them apart from humans.

When the match starts the auto-assign casts the lots over the full mix of humans and bots, so any character can land on either side.

The bot AI:
- During **setup**: defenders sprinkle 2-3 spike traps in the suggested zones; attackers idle.
- During **break**: attackers head toward the exit, fight enemies in line of sight along the way; defenders patrol around the exit and chase the nearest attacker.
- They use abilities opportunistically (Bhima breaks walls when stuck, Nakula dashes at enemies, Karna's Kavach pops near combat) and fire their astras the moment they unlock.

Click **Clear bots** to remove them all. You need at least one human in the room to start a match.

---

## 📦 Push to GitHub

```bash
# from inside the kurukshetra folder
git init
git add .
git commit -m "Initial commit: Kurukshetra"

# create a new EMPTY repo on github.com (no README, no .gitignore — we have those)
# then connect it:
git remote add origin https://github.com/YOUR_USERNAME/kurukshetra.git
git branch -M main
git push -u origin main
```

If GitHub asks you to authenticate:
- HTTPS: it'll prompt for a username and a Personal Access Token (not your password). Generate one at https://github.com/settings/tokens — give it `repo` scope.
- SSH: replace the remote URL with `git@github.com:YOUR_USERNAME/kurukshetra.git` and make sure your SSH key is uploaded to GitHub.

The included `.gitignore` already excludes `node_modules`, `.env`, log files, and macOS clutter — so the push stays small.

After it's on GitHub, deploying to Render is a few clicks (see Option C below) and you get a permanent public URL friends can hit any time.

## Play with friends over the internet

You have four free options. Pick whichever fits how persistent you need the link to be. **All voice chat needs HTTPS** (browsers refuse mic access over plain HTTP) — every option below serves over HTTPS.

### Option A — Cloudflare Tunnel (recommended; free, persistent, no time limits)

```bash
brew install cloudflared            # macOS — or download from Cloudflare's site
npm start                           # in one terminal
cloudflared tunnel --url http://localhost:3000   # in another
```

Cloudflare prints a `https://<random>.trycloudflare.com` URL. WebSockets supported. No 2-hour cap. No bandwidth metering.

### Option B — localhost.run (zero install, just SSH)

```bash
npm start
ssh -R 80:localhost:3000 nokey@localhost.run
```

You get a `https://<random>.lhr.life` URL instantly. Free, no signup. WebSockets work.

### Option C — Deploy permanently to Render (free tier)

For something that stays online without your laptop running:

1. Push the `kurukshetra` folder to a GitHub repo.
2. Go to https://render.com → New → **Web Service** → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Render gives you a permanent `https://kurukshetra-xxx.onrender.com` URL.
5. Free tier sleeps after 15 minutes of inactivity (first request after that takes ~30s to wake).

Railway and fly.io work similarly with comparable free tiers.

### Option D — ngrok (if your free quota resets)

```bash
ngrok http 3000
```

---

## How a match works

1. **Lobby.** Everyone joins the same room code. Pick a side (Pandavas / Kauravas) and a character. Press *I'm ready*.
2. **The match auto-starts** when everyone is ready (minimum 1 player per side; recommended 3v3).
3. **Each round** uses one of the four vyuhas: Chakravyuha → Padmavyuha → Garudavyuha → Makaravyuha.
4. **Setup phase (60s):** the *defending* team sees the maze and clicks tiles to place spike traps (max 4 per defender). Attackers see only the walls.
5. **Break phase (3 min):** attackers spawn at the **green ENTRY** tile and must reach the **gold EXIT** tile alive. Even one survivor counts as a win.
6. **Round ends when** an attacker reaches the exit (attackers win), all attackers fall (defenders win), or the timer runs out (defenders win).
7. **Teams swap** attacker/defender roles each round. **First to 3 round wins** takes the match.

---

## Controls

| Action | Key |
|---|---|
| Move | WASD or arrow keys |
| Aim | Mouse |
| Basic attack | Space or Left-click |
| Active ability | E or Right-click |
| Astra (when unlocked) | Q |
| Place a trap (setup phase) | Left-click a tile |

**Mobile:** touch devices auto-show two virtual joysticks (left = move, right = aim & fire) plus floating buttons for ability/astra. Tap a tile during setup to place a trap.

---

## 🎤 Voice chat

Click **🎤 Enable mic** in the bar at the bottom. After granting permission, your voice goes peer-to-peer over WebRTC to every other player who has also enabled their mic. The channel auto-swaps:

- **🛡 Team channel** — lobby, setup phase, between rounds. Only your teammates hear you.
- **🔓 Open battlefield** — combat / break phase. Everyone hears everyone, taunts and alliances allowed.

Use **🔇 Mute** to silence yourself without dropping the call. Speaker / mute state shows on each player's tile in the lobby and next to their name in the arena.

> Voice requires HTTPS — all four hosting options above provide it. On `http://localhost:3000` it works too because browsers treat localhost as trusted.

---

## The roster

### Pandavas
| Character | Ability | Astra | Unlock |
|---|---|---|---|
| **Yudhishthira** *(Dharmaraja)* | Aegis of Dharma — team aura, –40% dmg | **Yamastra** — wide AoE damage-over-time | 2+ allies alive |
| **Bhima** *(Vrikodara)* | Wall Breaker — smashes maze walls | **Vayavyastra** — wind cone, knockback | 120 dmg dealt |
| **Arjuna** *(Savyasachi)* | Triple Shot — 3 Gandiva arrows | **Pashupatastra** — piercing kill-beam | Alive 90s |
| **Nakula** *(Ashvinikumara)* | Dash — fast displacement | **Ashvastra** — team haste +50% | 1 kill |
| **Sahadeva** *(Tantra-jna)* | Foresight — reveal enemies & traps | **Sammohanastra** — AoE stun | Alive 60s |

### Kauravas
| Character | Ability | Astra | Unlock |
|---|---|---|---|
| **Duryodhana** *(Suyodhana)* | Iron Body — –60% dmg for 5s | **Gadayuddha** — leap & shockwave | 80 dmg taken |
| **Dushasana** | Grappling Pull — drag enemy into traps | **Raktastra** — 75% lifesteal | 1 kill |
| **Karna** *(Suryaputra)* | Kavach Bless — –50% dmg for 8s | **Vasavi Shakti** — single-use guided one-shot | Alive 30s |
| **Ashwatthama** *(Chiranjeevi)* | Night Stalker — invisibility | **Narayanastra** — arrow rain | When team is down to ≤1 ally |
| **Shakuni** *(Gandhararaja)* | Trap Master — drop traps mid-fight | **Mayastra** — 3 mirror decoys | Alive 45s |

Each character also has a 3-step skill tree noted in `game/characters.js` ready for future progression.

---

## The four vyuhas

| Vyuha | Lore |
|---|---|
| **Chakravyuha** | The spiral wheel arranged by Drona on Day 13. Abhimanyu broke six rings before falling. |
| **Padmavyuha** | The lotus formation. Only Arjuna and Krishna fully knew how to enter and exit. |
| **Garudavyuha** | The eagle formation, named for Vishnu's mount. Sweeping wings and a killing beak. |
| **Makaravyuha** | The crocodile formation. Long, narrow, with a crushing jaw at the head. |

Mazes are generated procedurally from the patterns in `game/vyuhas.js` — tweak the constants there to redesign them.

---

## Project layout

```
kurukshetra/
├─ server.js              # Express + Socket.io entrypoint
├─ game/
│  ├─ characters.js       # Roster, abilities, astras
│  ├─ vyuhas.js           # Procedural maze generators
│  └─ engine.js           # Server-authoritative match loop (30 Hz)
├─ public/
│  ├─ index.html          # Lobby + select + arena layout
│  ├─ style.css
│  └─ client.js           # Canvas renderer + input pump
├─ smoke-test.js          # End-to-end socket flow test
├─ package.json
└─ README.md
```

## Running the smoke test

```bash
node smoke-test.js
```

It boots the server on port 3199, connects two socket.io clients, walks them through join → pick character → ready, and verifies the match reaches the setup phase with snapshots flowing.

## Tweaking the game

- **Match length:** `ROUNDS_TO_WIN` in `game/engine.js`.
- **Phase timers:** `SETUP_MS` and `ROUND_MS` in `game/engine.js`.
- **Map size:** `GRID_W`, `GRID_H`, `CELL` in `game/vyuhas.js`.
- **New character:** add an entry to `CHARACTERS` in `game/characters.js`, then add the key to `TEAM_ROSTER`.
- **New astra effect:** add a `case` to `tryAstra` in `game/engine.js`.

---

## Known caveats

- Real-time movement runs over WebSockets; high-latency players may feel rubberbanding because the server is fully authoritative (no client prediction). For LAN or sub-100ms ngrok this is fine.
- Trap visibility: defenders see their own traps; attackers only see traps after triggering them.
- The "Ashwatthama goes Narayanastra" condition (`allies_alive_le 1`) only fires once his team is nearly wiped — by design, it's a desperation move.
