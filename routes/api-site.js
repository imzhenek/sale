const express = require('express');
const db = require('../db');
const { sendBookingNotification } = require('../telegram');

const router = express.Router();

// Заявки с сайта не привязаны к Telegram ID клиента, поэтому телефон
// обязателен — это единственный способ агентству с ним связаться.
router.post('/bookings', async (req, res) => {
  const { slug, client_name, client_phone, client_contact, shoot_date, comment } = req.body;

  if (!client_name || !client_phone) {
    return res.status(400).json({ error: 'validation', message: 'Укажите имя и телефон' });
  }

  const model = slug ? db.prepare(`SELECT * FROM models WHERE slug = ?`).get(slug) : null;

  if (model && model.status === 'coming_soon') {
    return res.status(400).json({ error: 'not_bookable', message: 'Эта модель пока недоступна для записи' });
  }

  const info = db.prepare(`
    INSERT INTO bookings (model_id, client_telegram_id, client_name, client_phone, client_contact, shoot_date, comment, source)
    VALUES (?, 'website', ?, ?, ?, ?, ?, 'website')
  `).run(model ? model.id : null, client_name, client_phone, client_contact || null, shoot_date || null, comment || null);

  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(info.lastInsertRowid);

  try {
    const messageId = await sendBookingNotification(booking, model ? model.name : null);
    if (messageId) db.prepare(`UPDATE bookings SET telegram_message_id = ? WHERE id = ?`).run(messageId, booking.id);
  } catch (e) {
    console.error('[site booking] telegram notify failed', e);
  }

  res.json({ booking });
});

module.exports = router;
