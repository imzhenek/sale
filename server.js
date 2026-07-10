require('dotenv').config();
const express = require('express');
const path = require('path');

const apiPublic = require('./routes/api-public');
const apiAdmin = require('./routes/api-admin');
const telegramWebhook = require('./routes/telegram-webhook');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/telegram', telegramWebhook);
app.use('/api', apiPublic);
app.use('/api/admin', apiAdmin);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Agency mini app backend running on http://localhost:${PORT}`);
});
