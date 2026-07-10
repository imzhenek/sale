const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireTelegramAuth, requireAdmin } = require('../middleware/telegram-auth');
const { updateNotificationMessage } = require('../telegram');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Разрешены только JPG, PNG, WEBP'));
  }
});

function slugify(str) {
  const translit = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return str.toLowerCase().split('').map(ch => translit[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `model-${Date.now()}`;
}

router.use(requireTelegramAuth, requireAdmin);

router.get('/summary', (req, res) => {
  const modelsCount = db.prepare(`SELECT COUNT(*) c FROM models`).get().c;
  const newBookings = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE status = 'new'`).get().c;
  const recentBookings = db.prepare(`
    SELECT bookings.*, models.name as model_name
    FROM bookings LEFT JOIN models ON models.id = bookings.model_id
    ORDER BY bookings.created_at DESC LIMIT 8
  `).all();
  res.json({ modelsCount, newBookings, recentBookings });
});

// --- Models ---
router.get('/models', (req, res) => {
  const models = db.prepare(`SELECT * FROM models ORDER BY sort_order, id DESC`).all();
  res.json({ models });
});

router.get('/models/:id', (req, res) => {
  const model = db.prepare(`SELECT * FROM models WHERE id = ?`).get(req.params.id);
  if (!model) return res.status(404).json({ error: 'not_found' });
  model.photos = JSON.parse(model.photos_json || '[]');
  res.json({ model });
});

router.post('/models', upload.fields([{ name: 'photo_main', maxCount: 1 }, { name: 'photos', maxCount: 8 }]), (req, res) => {
  const { name, category, height, bust, weight, age, city, nationality, services, price, bio, status } = req.body;
  if (!name) return res.status(400).json({ error: 'validation', message: 'Укажите имя' });

  const slugBase = slugify(name);
  let slug = slugBase, i = 1;
  while (db.prepare(`SELECT id FROM models WHERE slug = ?`).get(slug)) slug = `${slugBase}-${++i}`;

  const photoMain = req.files['photo_main'] ? `/uploads/${req.files['photo_main'][0].filename}` : null;
  const photos = (req.files['photos'] || []).map(f => `/uploads/${f.filename}`);

  const info = db.prepare(`
    INSERT INTO models (slug, name, category, height, bust, weight, age, city, nationality, services, price, bio, photo_main, photos_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(slug, name, category || 'women', height || null, bust || null, weight || null, age || null, city || null, nationality || null, services || null, price || null, bio || null, photoMain, JSON.stringify(photos), status || 'active');

  res.json({ id: info.lastInsertRowid, slug });
});

router.put('/models/:id', upload.fields([{ name: 'photo_main', maxCount: 1 }, { name: 'photos', maxCount: 8 }]), (req, res) => {
  const model = db.prepare(`SELECT * FROM models WHERE id = ?`).get(req.params.id);
  if (!model) return res.status(404).json({ error: 'not_found' });

  const { name, category, height, bust, weight, age, city, nationality, services, price, bio, status } = req.body;
  let photoMain = model.photo_main;
  if (req.files['photo_main']) photoMain = `/uploads/${req.files['photo_main'][0].filename}`;

  let photos = JSON.parse(model.photos_json || '[]');
  if (req.files['photos'] && req.files['photos'].length) {
    photos = photos.concat(req.files['photos'].map(f => `/uploads/${f.filename}`));
  }

  db.prepare(`
    UPDATE models SET name=?, category=?, height=?, bust=?, weight=?, age=?, city=?, nationality=?, services=?, price=?, bio=?, photo_main=?, photos_json=?, status=?
    WHERE id = ?
  `).run(name, category || 'women', height || null, bust || null, weight || null, age || null, city || null, nationality || null, services || null, price || null, bio || null, photoMain, JSON.stringify(photos), status || 'active', req.params.id);

  res.json({ ok: true });
});

router.delete('/models/:id', (req, res) => {
  db.prepare(`DELETE FROM models WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// --- Bookings ---
router.get('/bookings', (req, res) => {
  const status = req.query.status || 'all';
  const bookings = status === 'all'
    ? db.prepare(`SELECT bookings.*, models.name as model_name FROM bookings LEFT JOIN models ON models.id = bookings.model_id ORDER BY bookings.created_at DESC`).all()
    : db.prepare(`SELECT bookings.*, models.name as model_name FROM bookings LEFT JOIN models ON models.id = bookings.model_id WHERE bookings.status = ? ORDER BY bookings.created_at DESC`).all(status);
  res.json({ bookings });
});

router.post('/bookings/:id/status', async (req, res) => {
  const { status } = req.body;
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'not_found' });

  db.prepare(`UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, booking.id);
  const updated = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(booking.id);
  const model = booking.model_id ? db.prepare(`SELECT name FROM models WHERE id = ?`).get(booking.model_id) : null;

  try {
    await updateNotificationMessage(booking.telegram_message_id, updated, model ? model.name : null);
  } catch (e) {
    console.error('[admin] failed to update telegram message', e);
  }

  res.json({ ok: true });
});

module.exports = router;
