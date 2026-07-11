const express = require('express');
const db = require('../db');
const { updateNotificationMessage, answerCallbackQuery, sendMessage } = require('../telegram');
const { getAdminIds } = require('../middleware/telegram-auth');

const router = express.Router();
const APP_URL = process.env.PUBLIC_URL || '';

router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // отвечаем Telegram сразу, дальше обрабатываем асинхронно
  const update = req.body;

  try {
    if (update.message && update.message.text) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    }
  } catch (e) {
    console.error('[telegram webhook] error', e);
  }
});

async function handleMessage(message) {
  const text = message.text.trim();
  const chatId = message.chat.id;

  if (text.startsWith('/start')) {
    await sendMessage(chatId,
      'Добро пожаловать в <b>Loveinasia</b> — модельное агентство.\n\nСмотрите каталог, выбирайте модель и отправляйте заявку прямо здесь, в Telegram.',
      { reply_markup: { inline_keyboard: [[{ text: '📂 Открыть каталог', web_app: { url: `${APP_URL}/miniapp/` } }]] } }
    );
    return;
  }

  if (text.startsWith('/admin')) {
    const adminIds = getAdminIds();
    if (!adminIds.includes(String(message.from.id))) {
      await sendMessage(chatId,
        `У вас нет доступа к админ-панели.\n\nВаш Telegram ID: <code>${message.from.id}</code>\n\nПерешлите это сообщение (или просто этот ID) администратору агентства — он сможет открыть вам доступ через раздел «Сотрудники» в админке.`
      );
      return;
    }
    await sendMessage(chatId,
      '⚙️ Админ-панель агентства',
      { reply_markup: { inline_keyboard: [[{ text: '🛠 Открыть админку', web_app: { url: `${APP_URL}/admin-app/` } }]] } }
    );
  }
}

async function handleCallback(cq) {
  if (!cq.data) return;
  const [action, bookingIdRaw] = cq.data.split(':');
  const bookingId = Number(bookingIdRaw);
  if (!bookingId) return;

  if (action === 'contact_info') {
    const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId);
    if (!booking) return;
    const parts = [];
    if (booking.client_phone) parts.push(`Тел: ${booking.client_phone}`);
    if (booking.client_contact) parts.push(`Контакт: ${booking.client_contact}`);
    parts.push('Написать через бота можно в админке, кнопкой «Написать клиенту».');
    await answerCallbackQuery(cq.id, parts.join('\n').slice(0, 200), true);
    return;
  }

  if (!['confirm', 'decline'].includes(action)) return;

  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId);
  if (!booking) return;

  const newStatus = action === 'confirm' ? 'confirmed' : 'declined';
  db.prepare(`UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(newStatus, bookingId);
  const updated = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId);
  const model = booking.model_id ? db.prepare(`SELECT name FROM models WHERE id = ?`).get(booking.model_id) : null;

  await updateNotificationMessage(booking.telegram_message_id, updated, model ? model.name : null);
  await answerCallbackQuery(cq.id, newStatus === 'confirmed' ? 'Заявка подтверждена' : 'Заявка отклонена');

  try {
    await sendMessage(booking.client_telegram_id,
      newStatus === 'confirmed'
        ? `✅ Ваша заявка с моделью${model ? ' ' + model.name : ''} подтверждена. Мы свяжемся с вами для уточнения деталей.`
        : `❌ К сожалению, по вашей заявке${model ? ' с моделью ' + model.name : ''} — отказ. Можете отправить новую заявку с другими датами.`
    );
  } catch (e) {
    console.warn('[telegram] не удалось написать клиенту напрямую', e.message);
  }
}

module.exports = router;
