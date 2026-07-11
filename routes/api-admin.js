const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireTelegramAuth, requireAdmin } = require('../middleware/telegram-auth');
const { updateNotificationMessage, sendMessage } = require('../telegram');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
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
  const { name, category, height, bust, weight, age, city, nationality, services, services_extra, price, bio, status, featured } = req.body;
  if (!name) return res.status(400).json({ error: 'validation', message: 'Укажите имя' });

  const slugBase = slugify(name);
  let slug = slugBase, i = 1;
  while (db.prepare(`SELECT id FROM models WHERE slug = ?`).get(slug)) slug = `${slugBase}-${++i}`;

  const photoMain = req.files['photo_main'] ? `/uploads/${req.files['photo_main'][0].filename}` : null;
  const photos = (req.files['photos'] || []).map(f => `/uploads/${f.filename}`);

  const info = db.prepare(`
    INSERT INTO models (slug, name, category, height, bust, weight, age, city, nationality, services, services_extra, price, bio, photo_main, photos_json, status, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(slug, name, category || 'women', height || null, bust || null, weight || null, age || null, city || null, nationality || null, services || null, services_extra || null, price || null, bio || null, photoMain, JSON.stringify(photos), status || 'active', featured === '1' ? 1 : 0);

  res.json({ id: info.lastInsertRowid, slug });
});

router.put('/models/:id', upload.fields([{ name: 'photo_main', maxCount: 1 }, { name: 'photos', maxCount: 8 }]), (req, res) => {
  const model = db.prepare(`SELECT * FROM models WHERE id = ?`).get(req.params.id);
  if (!model) return res.status(404).json({ error: 'not_found' });

  const { name, category, height, bust, weight, age, city, nationality, services, services_extra, price, bio, status, featured } = req.body;
  let photoMain = model.photo_main;
  if (req.files['photo_main']) photoMain = `/uploads/${req.files['photo_main'][0].filename}`;

  let photos = JSON.parse(model.photos_json || '[]');
  if (req.files['photos'] && req.files['photos'].length) {
    photos = photos.concat(req.files['photos'].map(f => `/uploads/${f.filename}`));
  }

  db.prepare(`
    UPDATE models SET name=?, category=?, height=?, bust=?, weight=?, age=?, city=?, nationality=?, services=?, services_extra=?, price=?, bio=?, photo_main=?, photos_json=?, status=?, featured=?
    WHERE id = ?
  `).run(name, category || 'women', height || null, bust || null, weight || null, age || null, city || null, nationality || null, services || null, services_extra || null, price || null, bio || null, photoMain, JSON.stringify(photos), status || 'active', featured === '1' ? 1 : 0, req.params.id);

  res.json({ ok: true });
});

router.post('/models/:id/delete', (req, res) => {
  const deleteModel = db.transaction((id) => {
    // Отвязываем заявки от удаляемой модели, но не удаляем их —
    // история обращений клиентов должна сохраниться.
    db.prepare(`UPDATE bookings SET model_id = NULL WHERE model_id = ?`).run(id);
    db.prepare(`DELETE FROM models WHERE id = ?`).run(id);
  });

  try {
    deleteModel(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin] failed to delete model', e);
    res.status(500).json({ error: 'delete_failed', message: 'Не удалось удалить модель' });
  }
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

router.post('/bookings/:id/delete', (req, res) => {
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'not_found' });
  db.prepare(`DELETE FROM bookings WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

router.post('/bookings/:id/message', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'validation', message: 'Введите текст сообщения' });

  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'not_found' });

  try {
    await sendMessage(booking.client_telegram_id, `✉️ Сообщение от агентства:\n\n${text.trim()}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin] failed to message client', e);
    res.status(502).json({ error: 'telegram_failed', message: 'Не удалось отправить сообщение. Возможно, клиент ещё не писал боту.' });
  }
});

// --- Сотрудники (доступ к админке) ---
router.get('/admins', (req, res) => {
  const admins = db.prepare(`SELECT * FROM admins ORDER BY added_at`).all();
  res.json({ admins, currentAdminId: String(req.tgUser.id) });
});

router.post('/admins', (req, res) => {
  const { telegram_id, name } = req.body;
  const cleanId = (telegram_id || '').toString().trim().replace(/[^0-9]/g, '');
  if (!cleanId) return res.status(400).json({ error: 'validation', message: 'Укажите корректный Telegram ID (только цифры)' });

  try {
    db.prepare(`INSERT INTO admins (telegram_id, name) VALUES (?, ?)`).run(cleanId, (name || '').trim() || null);
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'duplicate', message: 'Этот Telegram ID уже есть в списке сотрудников' });
    }
    console.error('[admin] failed to add admin', e);
    res.status(500).json({ error: 'server_error', message: 'Не удалось добавить сотрудника' });
  }
});

router.post('/admins/:id/delete', (req, res) => {
  const target = db.prepare(`SELECT * FROM admins WHERE id = ?`).get(req.params.id);
  if (!target) return res.status(404).json({ error: 'not_found' });

  const totalAdmins = db.prepare(`SELECT COUNT(*) c FROM admins`).get().c;
  if (totalAdmins <= 1) {
    return res.status(400).json({ error: 'last_admin', message: 'Нельзя удалить последнего администратора — доступ к админке будет потерян' });
  }
  if (target.telegram_id === String(req.tgUser.id)) {
    return res.status(400).json({ error: 'self_delete', message: 'Нельзя удалить самого себя' });
  }

  db.prepare(`DELETE FROM admins WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
