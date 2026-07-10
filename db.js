const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'agency.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'women',
  height INTEGER,
  bust INTEGER,
  waist INTEGER,
  hips INTEGER,
  shoe_size INTEGER,
  bio TEXT,
  photo_main TEXT,
  photos_json TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER,
  client_telegram_id TEXT NOT NULL,
  client_username TEXT,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  shoot_type TEXT,
  shoot_date TEXT,
  location TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  telegram_message_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (model_id) REFERENCES models(id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_telegram_id);
`);

module.exports = db;
