-- ============================================================
-- Skribbl Clone Database Schema
-- Run this to initialize your PostgreSQL database
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id         VARCHAR(36) PRIMARY KEY,
  nickname   VARCHAR(50) NOT NULL,
  avatar     VARCHAR(10) DEFAULT '🎨',
  created_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id         VARCHAR(36) PRIMARY KEY,
  room_code  VARCHAR(8)  UNIQUE NOT NULL,
  host_id    VARCHAR(36) NOT NULL,
  settings   JSONB       DEFAULT '{}',
  status     VARCHAR(20) DEFAULT 'waiting',
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id               VARCHAR(36) PRIMARY KEY,
  room_id          VARCHAR(36) REFERENCES rooms(id) ON DELETE CASCADE,
  current_round    INTEGER     DEFAULT 0,
  total_rounds     INTEGER     NOT NULL,
  current_drawer_id VARCHAR(36),
  status           VARCHAR(20) DEFAULT 'active',
  created_at       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id          VARCHAR(36) PRIMARY KEY,
  game_id     VARCHAR(36) REFERENCES games(id) ON DELETE CASCADE,
  player_id   VARCHAR(36) NOT NULL,
  player_name VARCHAR(50) NOT NULL,
  score       INTEGER     DEFAULT 0,
  created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- Words table (optional: seed from backend/data/words.js)
CREATE TABLE IF NOT EXISTS words (
  id       SERIAL      PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  word     VARCHAR(100) NOT NULL,
  UNIQUE(category, word)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code    ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_games_room    ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_scores_game   ON scores(game_id);
CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_id);
