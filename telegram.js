const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

const STATUS_LABELS = {
  new: '🆕 Новая',
  confirmed: '✅ Подтверждена',
  declined: '❌ Отклонена',
  done: '🏁 Съёмка проведена'
};

function bookingText(booking, modelName) {
  const lines = [
    `<b>НОВАЯ ЗАЯВКА! #${booking.id}</b>`,
    `Статус: ${STATUS_LABELS[booking.status] || booking.status}`,
    ``,
    `Модель: ${modelName || 'не выбрана / общий запрос'}`,
    `Клиент: ${booking.client_name}${booking.client_username ? ' (@' + booking.client_username + ')' : ''}`,
    booking.client_phone ? `Телефон: ${booking.client_phone}` : null,
    booking.shoot_type ? `Тип съёмки: ${booking.shoot_type}` : null,
    booking.shoot_date ? `Желаемая дата: ${booking.shoot_date}` : null,
    booking.location ? `Локация: ${booking.location}` : null,
    booking.comment ? `Комментарий: ${booking.comment}` : null
  ].filter(Boolean);
  return lines.join('\n');
}

async function sendBookingNotification(booking, modelName) {
  if (!API || !CHAT_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы — уведомление не отправлено');
    return null;
  }
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: bookingText(booking, modelName),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Подтвердить', callback_data: `confirm:${booking.id}` },
          { text: '❌ Отклонить', callback_data: `decline:${booking.id}` }
        ]]
      }
    })
  });
  const data = await res.json();
  if (data.ok) return String(data.result.message_id);
  console.error('[telegram] sendMessage error', data);
  return null;
}

async function updateNotificationMessage(messageId, booking, modelName) {
  if (!API || !CHAT_ID || !messageId) return;
  await fetch(`${API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_id: Number(messageId),
      text: bookingText(booking, modelName),
      parse_mode: 'HTML',
      reply_markup: booking.status === 'new' ? {
        inline_keyboard: [[
          { text: '✅ Подтвердить', callback_data: `confirm:${booking.id}` },
          { text: '❌ Отклонить', callback_data: `decline:${booking.id}` }
        ]]
      } : { inline_keyboard: [] }
    })
  });
}

async function answerCallbackQuery(callbackQueryId, text) {
  if (!API) return;
  await fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text })
  });
}

async function sendMessage(chatId, text, extra = {}) {
  if (!API) return null;
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra })
  });
  return res.json();
}

module.exports = {
  sendBookingNotification,
  updateNotificationMessage,
  answerCallbackQuery,
  sendMessage,
  STATUS_LABELS
};
