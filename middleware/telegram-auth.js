const { validateInitData } = require('../utils/telegram-auth');
const db = require('../db');

function getAdminIds() {
  const fromDb = db.prepare(`SELECT telegram_id FROM admins`).all().map(r => r.telegram_id);
  if (fromDb.length) return fromDb;

  // Аварийный fallback: если таблица админов почему-то пуста (например, свежая
  // база без миграции), не остаёмся без доступа — используем переменную окружения.
  return (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Достаёт initData из заголовка Authorization: tma <initData>,
// проверяет подпись, кладёт req.tgUser
function requireTelegramAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const initData = header.startsWith('tma ') ? header.slice(4) : header;

  const result = validateInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
  if (!result || !result.user) {
    return res.status(401).json({ error: 'unauthorized', message: 'Не удалось подтвердить пользователя Telegram' });
  }
  req.tgUser = result.user;
  next();
}

function requireAdmin(req, res, next) {
  const adminIds = getAdminIds();
  if (!req.tgUser || !adminIds.includes(String(req.tgUser.id))) {
    return res.status(403).json({ error: 'forbidden', message: 'Доступ только для администраторов агентства' });
  }
  next();
}

module.exports = { requireTelegramAuth, requireAdmin, getAdminIds };
