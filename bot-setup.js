// Запускать один раз (и повторно — при смене URL): node bot-setup.js
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.PUBLIC_URL; // напр. https://your-app.up.railway.app
const API = `https://api.telegram.org/bot${TOKEN}`;

if (!TOKEN || !APP_URL) {
  console.error('Заполните TELEGRAM_BOT_TOKEN и PUBLIC_URL в .env перед запуском');
  process.exit(1);
}

async function call(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  console.log(method, data.ok ? 'OK' : data);
  return data;
}

(async () => {
  // Постоянная кнопка меню рядом с полем ввода — открывает каталог
  await call('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Каталог',
      web_app: { url: `${APP_URL}/miniapp/` }
    }
  });

  await call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Открыть каталог моделей' },
      { command: 'admin', description: 'Админ-панель агентства' }
    ]
  });

  // Вебхук для входящих команд и колбэков от инлайн-кнопок
  await call('setWebhook', { url: `${APP_URL}/telegram/webhook` });

  console.log('\nГотово. Бот настроен на', APP_URL);
})();
