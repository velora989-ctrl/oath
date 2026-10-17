require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

for (const v of ['MONGODB_URI', 'JWT_SECRET', 'GROQ_API_KEY']) {
  if (!process.env[v]) {
    console.error(`Missing ${v} in .env (see .env.example)`);
    process.exit(1);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// slow down password guessing
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/journals', require('./routes/journals'));
app.use('/api/emojis', require('./routes/emojis'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/archetypes', require('./routes/archetypes'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Optional: serve the frontend from the same server (set STATIC_DIR in .env)
const staticDir = process.env.STATIC_DIR || path.join(__dirname, 'public');
app.use(express.static(staticDir));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = process.env.PORT || 3000;
connectDB()
  .then(() => app.listen(port, () => console.log(`Mira's Grove running on http://localhost:${port}`)))
  .catch((err) => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
