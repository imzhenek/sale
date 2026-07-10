const express = require('express');
const db = require('../db');
const { requireTelegramAuth } = require('../middleware/telegram-auth');
const { sendBookingNotification } = require('../telegram');

const router = express.Router();

// Каталог доступен без строгой проверки подписи, чтобы превью успевало
// подгружаться быстро, но мы всё равно читаем initData если он есть.
router.get('/models', (req, res) => {
  const category = req.query.category || 'all';
  const models = category === 'all'
    ? db.prepare(`SELECT * FROM models WHERE status = 'active' ORDER BY sort_order, id DESC`).all()
    : db.prepare(`SELECT * FROM models WHERE status = 'active' AND category = ? ORDER BY sort_order, id DESC`).all(category);
  res.json({ models });
});

router.get('/models/:slug', (req, res) => {
  const model = db.prepare(`SELECT * FROM models WHERE slug = ? AND status = 'active'`).get(req.params.slug);
  if (!model) return res.status(404).json({ error: 'not_found' });
  model.photos = JSON.parse(model.photos_json || '[]');
  res.json({ model });
});

// Всё, что создаёт заявку или читает личные данные — только с подписью Telegram
router.use(requireTelegramAuth);

router.post('/bookings', async (req, res) => {
  const { slug, client_name, client_phone, shoot_type, shoot_date, location, comment } = req.body;

  if (!client_name) {
    return res.status(400).json({ error: 'validation', message: 'Укажите имя' });
  }

  const model = slug ? db.prepare(`SELECT * FROM models WHERE slug = ?`).get(slug) : null;

  const info = db.prepare(`
    INSERT INTO bookings (model_id, client_telegram_id, client_username, client_name, client_phone, shoot_type, shoot_date, location, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    model ? model.id : null,
    String(req.tgUser.id),
    req.tgUser.username || null,
    client_name,
    client_phone || null,
    shoot_type || null,
    shoot_date || null,
    location || null,
    comment || null
  );

  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(info.lastInsertRowid);

  try {
    const messageId = await sendBookingNotification(booking, model ? model.name : null);
    if (messageId) db.prepare(`UPDATE bookings SET telegram_message_id = ? WHERE id = ?`).run(messageId, booking.id);
  } catch (e) {
    console.error('[booking] telegram notify failed', e);
  }

  res.json({ booking });
});

router.get('/my-bookings', (req, res) => {
  const bookings = db.prepare(`
    SELECT bookings.*, models.name as model_name, models.slug as model_slug
    FROM bookings LEFT JOIN models ON models.id = bookings.model_id
    WHERE client_telegram_id = ?
    ORDER BY bookings.created_at DESC
  `).all(String(req.tgUser.id));
  res.json({ bookings });
});

module.exports = router;
