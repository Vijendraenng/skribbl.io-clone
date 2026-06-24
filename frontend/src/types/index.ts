// ─── Player & Room ────────────────────────────────────────────────────────

export interface Player {
  id: string;
  socketId: string;
  nickname: string;
  avatar: string;
  score: number;
  roundScore: number;
  hasGuessedCorrectly: boolean;
  isReady: boolean;
  isConnected: boolean;
}

export interface RoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hintsEnabled: boolean;
  maxHints: number;
  isPrivate: boolean;
}

export interface Room {
  id: string;
  roomCode: string;
  hostId: string;
  settings: RoomSettings;
  status: "waiting" | "playing" | "finished";
  players: Player[];
  playerCount: number;
}

// ─── Game ────────────────────────────────────────────────────────────────

export type GamePhase =
  | "waiting"
  | "choosing"
  | "drawing"
  | "round_end"
  | "game_over";

export interface GameState {
  gameId: string;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentDrawerId: string | null;
  currentDrawerName: string | null;
  players: Player[];
  drawTime: number;
  roundStartTime: number | null;
}

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
}

// ─── Drawing ──────────────────────────────────────────────────────────────

export type DrawTool = "pen" | "eraser" | "fill";

export interface DrawSettings {
  color: string;
  size: number;
  tool: DrawTool;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface DrawEvent {
  type: "draw_start" | "draw_move" | "draw_end";
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  tool?: DrawTool;
}

// ─── Chat ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  type: "guess" | "chat" | "system" | "correct";
  timestamp: number;
}

// ─── Socket Payloads ─────────────────────────────────────────────────────

export interface GuessResult {
  correct: boolean;
  points?: number;
  word?: string;
}

export interface PlayerGuessedPayload {
  playerId: string;
  playerName: string;
  points: number;
  players: Player[];
}

export interface RoundEndPayload {
  word: string;
  scores: LeaderboardEntry[];
  drawerId: string;
}

export interface GameOverPayload {
  winner: LeaderboardEntry | null;
  leaderboard: LeaderboardEntry[];
}

export interface RoundStartPayload {
  round: number;
  totalRounds: number;
  drawerId: string;
  drawerName: string;
  drawTime: number;
}
