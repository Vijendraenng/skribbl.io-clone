const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

/**
 * Initialize database tables
 */
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        nickname VARCHAR(50) NOT NULL,
        avatar VARCHAR(10) DEFAULT '🎨',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(36) PRIMARY KEY,
        room_code VARCHAR(8) UNIQUE NOT NULL,
        host_id VARCHAR(36) NOT NULL,
        settings JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'waiting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Games table
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(36) PRIMARY KEY,
        room_id VARCHAR(36) REFERENCES rooms(id) ON DELETE CASCADE,
        current_round INTEGER DEFAULT 0,
        total_rounds INTEGER NOT NULL,
        current_drawer_id VARCHAR(36),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Scores table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id VARCHAR(36) PRIMARY KEY,
        game_id VARCHAR(36) REFERENCES games(id) ON DELETE CASCADE,
        player_id VARCHAR(36) NOT NULL,
        player_name VARCHAR(50) NOT NULL,
        score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Words table
    await client.query(`
      CREATE TABLE IF NOT EXISTS words (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        word VARCHAR(100) NOT NULL,
        UNIQUE(category, word)
      )
    `);

    await client.query("COMMIT");
    console.log("✅ Database initialized successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Database initialization failed:", err.message);
    // Don't crash the server if DB isn't available
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
