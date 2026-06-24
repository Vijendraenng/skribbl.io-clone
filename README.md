# 🎨 Skribbl Clone

A production-ready full-stack multiplayer drawing and guessing game — a [skribbl.io](https://skribbl.io) clone built with React, Node.js, Socket.IO, and PostgreSQL.

**Live URL:** `https://your-app.vercel.app` ← update after deployment

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏠 Room System | Create public or private rooms with a unique 6-character code |
| 🌐 Public Room Browser | Browse and join open rooms live with auto-refresh every 4 seconds |
| 🔗 Invite Links | Share a link — others enter their nickname and join instantly |
| 🎮 Full Game Flow | Turn-based rounds, word selection, drawing, guessing, scoring |
| 🖊️ Real-time Drawing | HTML5 Canvas synced via Socket.IO with brush, eraser, fill bucket, undo, clear |
| 💬 Chat & Guessing | Live chat with guess validation, close-guess detection, anti-spam |
| 🏆 Scoring & Leaderboard | Speed-based scoring, round scores, winner screen |
| 💡 Progressive Hints | Fixed letter reveal order per round, configurable count |
| 🔄 Reconnection | Page refresh keeps you in the room for 60 seconds |
| 🆔 Persistent Identity | Player ID, nickname, avatar saved in localStorage across sessions |
| 🔁 Play Again | Host restarts game — all players redirected to lobby together |
| 📱 Responsive | Mobile: canvas on top, chat below, scrollable. Desktop: fixed 3-column layout |
| 🚪 Exit Button | Leave room from lobby or game at any time |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Canvas | HTML5 Canvas API |
| Backend | Node.js + Express |
| Real-time | Socket.IO 4.x |
| Database | PostgreSQL (optional — app runs fully in-memory without it) |
| Deployment | Frontend: Vercel · Backend: Render |

---

## 📁 Folder Structure

```
skribbl-clone/
├── backend/
│   ├── src/
│   │   ├── classes/
│   │   │   ├── Player.js         # Player model — score, avatar, connection state
│   │   │   ├── Game.js           # Round logic, turn order, hint reveal, scoring
│   │   │   ├── Room.js           # Room management, game flow, broadcasts
│   │   │   ├── GameManager.js    # Singleton — all rooms, 60s grace period on empty
│   │   │   ├── WordManager.js    # Word selection, deterministic hint generation
│   │   │   └── SocketHandler.js  # All Socket.IO event handling (OOP)
│   │   ├── config/
│   │   │   └── database.js       # PostgreSQL pool + schema init
│   │   ├── routes/
│   │   │   └── api.js            # REST: GET /api/rooms, GET /api/health
│   │   └── index.js              # Express + Socket.IO server entry point
│   ├── data/
│   │   └── words.js              # 150+ words across 5 categories
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   └── DrawingCanvas.tsx   # Canvas + color/size/tool toolbar
│   │   │   ├── chat/
│   │   │   │   └── ChatPanel.tsx       # Chat + guess input, hides guesses from drawer
│   │   │   └── game/
│   │   │       ├── PlayerList.tsx      # Player sidebar with scores
│   │   │       ├── TimerBar.tsx        # Animated countdown bar
│   │   │       ├── WordChooser.tsx     # Word selection overlay (15s countdown)
│   │   │       └── RoundEndOverlay.tsx # Round end modal with word reveal
│   │   ├── contexts/
│   │   │   └── GameContext.tsx         # All socket events + global game state
│   │   ├── hooks/
│   │   │   ├── useCanvas.ts            # Drawing, flood fill, remote sync, undo
│   │   │   └── useTimer.ts             # Countdown timer hook
│   │   ├── pages/
│   │   │   ├── HomePage.tsx            # Nickname + avatar picker, live room count
│   │   │   ├── CreateRoomPage.tsx      # Room settings sliders
│   │   │   ├── JoinRoomPage.tsx        # Join by code or invite link
│   │   │   ├── PublicRoomsPage.tsx     # Live public room browser
│   │   │   ├── LobbyPage.tsx           # Pre-game lobby, copy invite link
│   │   │   ├── GamePage.tsx            # Main game screen
│   │   │   └── GameOverPage.tsx        # Winner + leaderboard + play again
│   │   ├── types/index.ts              # All TypeScript interfaces
│   │   ├── vite-env.d.ts               # Vite import.meta.env types
│   │   └── utils/
│   │       ├── socket.ts               # Socket.IO singleton
│   │       └── avatars.ts              # 24 emoji avatars + color helper
│   ├── .env.example
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── package.json
│
└── database/
    └── schema.sql                      # PostgreSQL schema (run once to init)
```

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (optional — skip `DATABASE_URL` to run fully in-memory)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/skribbl-clone.git
cd skribbl-clone

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

**`backend/.env`**
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/skribbl_clone
FRONTEND_URL=http://localhost:5173
```

**`frontend/.env`**
```env
VITE_BACKEND_URL=http://localhost:3001
```

> Skip `DATABASE_URL` entirely to run without a database. All game state is in-memory.

### 3. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173`

---

## 🌐 Deployment

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/skribbl-clone.git
git push -u origin main
```

### Step 2 — Deploy Backend on Render

1. [render.com](https://render.com) → **New Web Service** → connect your repo
2. Set **Root Directory** to `backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | *(set after Vercel deploy)* |
| `DATABASE_URL` | *(optional — from Render PostgreSQL)* |

6. Copy your Render URL: `https://skribbl-clone-backend.onrender.com`

### Step 3 — Deploy Frontend on Vercel

1. [vercel.com](https://vercel.com) → **New Project** → connect your repo
2. Set **Root Directory** to `frontend`
3. Environment variable:

| Key | Value |
|-----|-------|
| `VITE_BACKEND_URL` | `https://skribbl-clone-backend.onrender.com` |

4. Deploy. Copy your Vercel URL: `https://skribbl-clone.vercel.app`

### Step 4 — Connect the two

Back on Render → your Web Service → **Environment** tab:
- Set `FRONTEND_URL` = `https://skribbl-clone.vercel.app`
- Save → Render auto-redeploys

### Step 5 — Verify

Visit `https://skribbl-clone-backend.onrender.com/api/health`

Expected response:
```json
{ "status": "ok", "rooms": 0, "uptime": 42.3 }
```

> **Note:** Render free tier sleeps after 15 min of inactivity. First visit takes ~30s to wake up. Upgrade to Starter ($7/mo) for always-on.

---

## 🔌 Socket.IO Events

### Room Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `create_room` | C → S | `{ nickname, avatar, settings }` | Create room |
| `join_room` | C → S | `{ roomCode, nickname, avatar }` | Join by code |
| `reconnect_room` | C → S | `{ roomCode, playerId, nickname }` | Rejoin after refresh |
| `player_joined` | S → C | `{ player, players }` | New player joined |
| `player_reconnected` | S → C | `{ player, players }` | Player reconnected |
| `player_left` | S → C | `{ players, newHostId }` | Player disconnected |
| `start_game` | C → S | `{}` | Host starts game |
| `play_again` | C → S | `{}` | Host restarts game |
| `redirect_to_lobby` | S → C | `{ roomCode }` | All players go to lobby |

### Game Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `game_started` | S → C | `{ game }` | Game begins |
| `round_start` | S → C | `{ round, totalRounds, drawerId, drawerName, drawTime }` | New round |
| `word_choices` | S → Drawer | `{ words, timeLimit }` | 3 words to pick |
| `word_chosen` | C → S | `{ word }` | Drawer chose word |
| `word_assigned` | S → Drawer | `{ word, hint }` | Word confirmed |
| `word_hint` | S → Others | `{ hint, wordLength }` | Blank hint shown |
| `hint_update` | S → Others | `{ hint }` | More letters revealed |
| `round_end` | S → C | `{ word, scores, drawerId }` | Round over |
| `game_over` | S → C | `{ winner, leaderboard }` | Game finished |

### Drawing Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `draw_start` | C → S | `{ x, y, color, size, tool }` | Begin stroke |
| `draw_move` | C → S | `{ x, y }` | Continue stroke (batched ~60fps) |
| `draw_end` | C → S | `{}` | End stroke |
| `draw_data` | S → C | `{ type, ...stroke }` | Broadcast to viewers |
| `canvas_fill` | C → S | `{ x, y, color }` | Flood fill |
| `canvas_clear` | C → S | `{}` | Clear canvas |
| `draw_undo` | C → S | `{}` | Undo last stroke |
| `canvas_cleared` | S → C | `{}` | Broadcast clear |
| `draw_undone` | S → C | `{ strokes }` | Replay strokes after undo |

### Chat Events
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `guess` | C → S | `{ text }` | Submit a guess |
| `chat` | C → S | `{ text }` | General chat |
| `guess_result` | S → Guesser | `{ correct, points, word }` | Your guess result |
| `player_guessed` | S → All | `{ playerId, playerName, points }` | Someone got it right |
| `close_guess` | S → Guesser | `{ text }` | Your guess was very close |
| `chat_message` | S → C | `{ playerId, playerName, text, type }` | Broadcast message |

---

## 🏗 Architecture

```
Browser (React + TypeScript)
         │
         │  WebSocket (Socket.IO)  +  HTTPS (REST)
         ▼
Express Server (Node.js)
         │
    SocketHandler ──── handles all socket events
         │
    GameManager ──────── singleton Map<roomCode, Room>
         │
       Room ─────────── players, settings, game flow, broadcasts
         ├── Player[]   score, avatar, connection state
         ├── Game       round logic, turn order, scoring
         │    └── WordManager   words, hint reveal order
         └── io.to(roomCode)   Socket.IO room broadcast
```

### Key Design Decisions

**Drawing sync** — Drawer's `draw_move` events are batched in a 16ms `setTimeout` before emitting (~60fps). Server stores all strokes in `game.strokes[]` so late-joining or reconnecting players can replay the full canvas.

**Flood fill** — Implemented as a pixel stack flood-fill on the `ImageData` with ±32 color tolerance per channel. Synced to others via `canvas_fill` event and replayed on undo/reconnect.

**Hint system** — `WordManager.buildHintRevealOrder(word)` shuffles letter indices once per round and stores them in `Game.hintRevealOrder`. Every `hint_update` slices more of this fixed array — revealed letters never change position mid-round.

**Reconnection** — `GameManager.handleDisconnect()` marks the player as disconnected but keeps them in the room for 60 seconds via `setTimeout`. If they reconnect in time, the timer is cancelled and their socket mapping is restored.

**Persistent identity** — `playerId`, `nickname`, `avatar`, `roomCode` stored in both `localStorage` and `sessionStorage`. On mount, `GameContext` emits `reconnect_room` to restore the socket channel if the user refreshes.

**Scoring** — `points = round(100 + timeRatio × 400)` where `timeRatio = (drawTime - elapsed) / drawTime`. First correct guess adds 50 bonus points. Drawer earns 30% of each correct guesser's points.

**Play Again** — Host emits `play_again` → server resets room status + clears game + resets all scores → broadcasts `redirect_to_lobby` to every socket in the room → `GameContext` handles the event and uses React Router `navigate()` (no page reload).

---

## 📝 Code Walkthrough

**`Room.js`** — Central coordinator. Manages player map, calls `Game` methods, handles timers for word choosing and hint intervals, broadcasts to Socket.IO rooms.

**`Game.js`** — Pure game logic. No I/O. Tracks turn order, current word, stroke history, scores. `startDrawPhase()` builds the hint reveal order and starts the draw timer.

**`SocketHandler.js`** — One method per event, all validation happens here before calling Room/Game methods. OOP structure makes it easy to add new events.

**`GameContext.tsx`** — Single source of truth for all client state. Listens to every socket event and updates React state. Components just read from context — no direct socket calls except through context actions.

**`useCanvas.ts`** — Handles both drawer input (mouse/touch → emit) and remote rendering (receive → draw). Single `remoteStrokeRef` tracks in-progress remote strokes without breaking Rules of Hooks.

---

## 🐛 Known Limitations

- Game state is in-memory only — server restart clears all rooms (unless PostgreSQL is configured)
- Render free tier sleeps after 15 min — first connection is slow
- No spectator mode — players must join before the game starts
- No custom word lists (yet)

---

## 📄 License

MIT