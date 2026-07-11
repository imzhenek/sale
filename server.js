require('dotenv').config();
const express = require('express');
const path = require('path');

const apiPublic = require('./routes/api-public');
const apiAdmin = require('./routes/api-admin');
const apiSite = require('./routes/api-site');
const telegramWebhook = require('./routes/telegram-webhook');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Загруженные фото лежат в data/uploads (не в public!) — именно эта папка
// будет смонтирована как постоянный диск (Railway Volume), поэтому URL
// /uploads/... нужно раздавать отдельно, явным маршрутом.
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

app.use('/telegram', telegramWebhook);
app.use('/api/admin', apiAdmin);
app.use('/api/site', apiSite);
app.use('/api', apiPublic);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Agency mini app backend running on http://localhost:${PORT}`);
});
