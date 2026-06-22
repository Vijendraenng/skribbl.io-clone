# 🎨 Skribbl Clone

A production-ready full-stack multiplayer drawing and guessing game — a [skribbl.io](https://skribbl.io) clone built with React, Node.js, Socket.IO, and PostgreSQL.

**Live URL:** `https://your-skribbl-clone.onrender.com` ← replace after deployment

---

## ✨ Features

- 🏠 **Room System** — Create public/private rooms with a unique 6-character code
- 🎮 **Full Game Flow** — Turn-based rounds, word selection, drawing, guessing, scoring
- 🖊️ **Real-time Drawing** — HTML5 Canvas with brush, eraser, undo, clear; synced via Socket.IO
- 💬 **Chat & Guessing** — Live chat with guess validation, anti-spam protection
- 🏆 **Scoring & Leaderboard** — Speed-based scoring, round scores, game-over winner screen
- 💡 **Progressive Hints** — Letters revealed over time (configurable)
- ⚙️ **Room Settings** — Configurable max players, rounds, draw time, word choices, hints
- 🔄 **Reconnection** — Handles dropped connections gracefully
- 📱 **Responsive** — Works on desktop and mobile

---

## 🛠 Tech Stack

| Layer       | Technology             |
|-------------|------------------------|
| Frontend    | React 18 + TypeScript + Vite |
| Styling     | Tailwind CSS           |
| Canvas      | HTML5 Canvas API       |
| Backend     | Node.js + Express      |
| Real-time   | Socket.IO 4.x          |
| Database    | PostgreSQL (optional)  |
| Deployment  | Frontend: Vercel · Backend: Render |

---

## 📁 Folder Structure

```
skribbl-clone/
├── backend/
│   ├── src/
│   │   ├── classes/
│   │   │   ├── Player.js         # Player model with score tracking
│   │   │   ├── Game.js           # Round logic, turn order, scoring
│   │   │   ├── Room.js           # Room management, broadcasts
│   │   │   ├── GameManager.js    # Singleton managing all rooms
│   │   │   ├── WordManager.js    # Word selection and hint generation
│   │   │   └── SocketHandler.js  # All Socket.IO event handling
│   │   ├── config/
│   │   │   └── database.js       # PostgreSQL connection + schema init
│   │   ├── routes/
│   │   │   └── api.js            # REST endpoints
│   │   └── index.js              # Express + Socket.IO server entry
│   ├── data/
│   │   └── words.js              # Categorized word list
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   └── DrawingCanvas.tsx   # Canvas + toolbar
│   │   │   ├── chat/
│   │   │   │   └── ChatPanel.tsx       # Chat + guess input
│   │   │   └── game/
│   │   │       ├── PlayerList.tsx      # Sidebar player list
│   │   │       ├── TimerBar.tsx        # Countdown timer
│   │   │       ├── WordChooser.tsx     # Word selection overlay
│   │   │       └── RoundEndOverlay.tsx # Round end modal
│   │   ├── contexts/
│   │   │   └── GameContext.tsx         # Global game state + socket events
│   │   ├── hooks/
│   │   │   ├── useCanvas.ts            # Canvas drawing + sync logic
│   │   │   └── useTimer.ts             # Countdown timer hook
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── CreateRoomPage.tsx
│   │   │   ├── JoinRoomPage.tsx
│   │   │   ├── LobbyPage.tsx
│   │   │   ├── GamePage.tsx
│   │   │   └── GameOverPage.tsx
│   │   ├── types/index.ts              # TypeScript interfaces
│   │   └── utils/
│   │       ├── socket.ts               # Socket.IO singleton
│   │       └── avatars.ts              # Avatar list + color helper
│   └── package.json
│
└── database/
    └── schema.sql                      # PostgreSQL schema
```

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (optional — app runs without it, just without persistence)

### 1. Clone & Install

```bash
git clone <your-repo-url> skribbl-clone
cd skribbl-clone

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure Environment

**Backend** — `backend/.env`:
```
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/skribbl_clone
FRONTEND_URL=http://localhost:5173
```

**Frontend** — `frontend/.env`:
```
VITE_BACKEND_URL=http://localhost:3001
```

> The app works without a database — all game state is in-memory.

### 3. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open `http://localhost:5173`

---

## 🌐 Deployment

### Backend → Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo, point to `backend/`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add env vars: `NODE_ENV=production`, `FRONTEND_URL=<your-vercel-url>`
7. Optionally add a PostgreSQL database (Render free tier available)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Connect your repo, set **Root Directory** to `frontend`
3. Add env var: `VITE_BACKEND_URL=<your-render-backend-url>`
4. Deploy

---

## 🔌 Socket.IO Events Reference

### Room Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `create_room` | Client → Server | Create room with settings |
| `join_room` | Client → Server | Join by room code |
| `player_joined` | Server → Clients | Broadcast new player |
| `player_left` | Server → Clients | Broadcast player left |
| `start_game` | Client → Server | Host starts game |

### Game Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `game_started` | Server → Clients | Game begins |
| `round_start` | Server → Clients | New round, drawer announced |
| `word_choices` | Server → Drawer | 3 words to pick from |
| `word_assigned` | Server → Drawer | Chosen word confirmed |
| `word_hint` | Server → Others | Blank hint display |
| `hint_update` | Server → Others | Progressive hint reveal |
| `round_end` | Server → Clients | Round over + word reveal |
| `game_over` | Server → Clients | Final leaderboard |

### Drawing Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `draw_start` | Client → Server | Begin stroke |
| `draw_move` | Client → Server | Continue stroke |
| `draw_end` | Client → Server | End stroke |
| `draw_data` | Server → Clients | Broadcast stroke to viewers |
| `canvas_clear` | Client → Server | Clear canvas |
| `draw_undo` | Client → Server | Undo last stroke |

### Chat Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `guess` | Client → Server | Player submits a guess |
| `guess_result` | Server → Guesser | Correct/incorrect result |
| `player_guessed` | Server → All | Someone guessed correctly |
| `chat` | Client → Server | General chat message |
| `chat_message` | Server → Clients | Broadcast chat |

---

## 🏗 Architecture Overview

```
Client (React)
    │
    │  Socket.IO (WebSocket)
    ▼
SocketHandler
    │ attaches event handlers per socket
    ▼
GameManager (singleton)
    │ manages Map<roomCode, Room>
    ▼
Room
    ├── Player[] (Map)
    ├── Game
    │     ├── WordManager
    │     ├── round logic
    │     └── score calculation
    └── broadcast helpers (io.to(roomCode).emit)
```

**Drawing Sync Flow:**
1. Drawer draws → `draw_start/draw_move/draw_end` emitted to server
2. Server validates (is this the current drawer?)
3. Server stores stroke in `game.strokes[]`
4. Server broadcasts `draw_data` to all other clients in room
5. Clients replay strokes on their canvas

**Scoring Formula:**
- Base: `100 + (timeRatio × 400)` = 100–500 pts
- First correct guess bonus: +50 pts
- Drawer earns 30% of each correct guesser's points

---

## 📝 Code Walkthrough Notes

**Word matching** (`WordManager.validateGuess`): case-insensitive, trimmed, exact match. `isCloseGuess` uses Levenshtein distance ≤ 1 for "close!" feedback.

**Drawing batching** (`useCanvas.ts`): `draw_move` events are batched in a 16ms timeout (~60fps) before emitting to prevent flooding the socket.

**Anti-spam** (`Room.isSpamming`): 300ms cooldown per player between messages.

**Canvas undo** (`Game.undoLastStroke`): scans stroke history backwards for the last `draw_start`, splices from there. Clients that receive `draw_undone` clear canvas and replay the remaining strokes.

**Room cleanup** (`GameManager._cleanup`): runs every 5 minutes, removes empty rooms and finished rooms older than 30 minutes.
