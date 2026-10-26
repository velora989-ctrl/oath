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
// a board can hold up to 40 written papers, so its route gets a bigger body limit (must come before the global parser)
app.use('/api/board', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '50kb' }));

// slow down password guessing
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/journals', require('./routes/journals'));
app.use('/api/emojis', require('./routes/emojis'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/archetypes', require('./routes/archetypes'));
app.use('/api/board', require('./routes/board'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Optional: serve the frontend from the same server (set STATIC_DIR in .env)
const staticDir = process.env.STATIC_DIR || path.join(__dirname, 'public');
app.use(express.static(staticDir));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'That is too big to save.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = process.env.PORT || 3000;
connectDB()
  .then(() => require('./models/Player').updateMany({ character: 'pip' }, { $set: { character: 'crimson' } }))   // Pip became The Crimson Lord
  .then(() => require('./models/Board').collection.dropIndex('player_1').catch(() => {}))   // boards used to be one per player (unique); now a player can have several
  .then(() => app.listen(port, () => console.log(`Mira's Grove running on http://localhost:${port}`)))
  .catch((err) => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
