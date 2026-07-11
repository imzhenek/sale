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

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  name TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);
`);

// Разово переносим админов из переменной окружения ADMIN_TELEGRAM_IDS в базу,
// чтобы дальше ими можно было управлять прямо из админки, без Railway.
const legacyAdminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const insertAdmin = db.prepare(`INSERT OR IGNORE INTO admins (telegram_id, name) VALUES (?, ?)`);
for (const id of legacyAdminIds) {
  insertAdmin.run(id, null);
}

// Миграция: добавляем колонку веса, если её ещё нет (для уже задеплоенных баз)
const modelColumns = db.prepare(`PRAGMA table_info(models)`).all().map(c => c.name);
if (!modelColumns.includes('weight')) {
  db.exec(`ALTER TABLE models ADD COLUMN weight INTEGER`);
}
if (!modelColumns.includes('city')) {
  db.exec(`ALTER TABLE models ADD COLUMN city TEXT`);
}
if (!modelColumns.includes('age')) {
  db.exec(`ALTER TABLE models ADD COLUMN age INTEGER`);
}
if (!modelColumns.includes('services')) {
  db.exec(`ALTER TABLE models ADD COLUMN services TEXT`);
}
if (!modelColumns.includes('services_extra')) {
  db.exec(`ALTER TABLE models ADD COLUMN services_extra TEXT`);
}
if (!modelColumns.includes('featured')) {
  db.exec(`ALTER TABLE models ADD COLUMN featured INTEGER DEFAULT 0`);
}
if (!modelColumns.includes('price')) {
  db.exec(`ALTER TABLE models ADD COLUMN price TEXT`);
}
if (!modelColumns.includes('nationality')) {
  db.exec(`ALTER TABLE models ADD COLUMN nationality TEXT`);
}

const bookingColumns = db.prepare(`PRAGMA table_info(bookings)`).all().map(c => c.name);
if (!bookingColumns.includes('source')) {
  db.exec(`ALTER TABLE bookings ADD COLUMN source TEXT DEFAULT 'miniapp'`);
}
if (!bookingColumns.includes('client_contact')) {
  db.exec(`ALTER TABLE bookings ADD COLUMN client_contact TEXT`);
}
if (!bookingColumns.includes('client_relevance')) {
  db.exec(`ALTER TABLE bookings ADD COLUMN client_relevance TEXT DEFAULT 'actual'`);
}

module.exports = db;
