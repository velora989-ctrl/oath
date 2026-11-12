const express = require('express');
const rateLimit = require('express-rate-limit');
const { chat, getKey } = require('../services/groqClient');

const router = express.Router();

// "Suggest" next to the boss / mini boss name in the New Boss form: turns a goal into 3 short plain names with Groq.
// Open to guests too (no login), so it is rate limited. The key stays on the server (GROQ_API_KEY, GROQ_MODEL in .env).
router.use(rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const SYSTEM = `You turn a goal into short, simple names. Suggest exactly 3 different names for it.

Rules:
- 2 to 4 words, under 22 characters.
- Plain everyday English. No fantasy, no jokes, no fancy words.
- Say what the goal is, like a clear title.
- Start with an action word when it fits (Land, Send, Post, Finish, Get).
- Title Case. No emojis, quotes or punctuation.
- Give 3 different ways to say it, not 3 copies of the same name.

Reply with JSON only: {"names":["","",""]}

Examples:
Goal: I want to get 3 new clients this month -> {"names":["Land 3 Clients","Get New Clients","Win 3 Clients"]}
Goal: send a message to 12 people on instagram -> {"names":["Send 12 DMs","Message 12 People","DM 12 Leads"]}
Goal: reach ten thousand subscribers on youtube -> {"names":["Reach 10k Subs","Hit 10k Subscribers","Grow To 10k"]}`;

const clean = (a) => {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(a) ? a : []) {
    const s = String(x).replace(/["'.!?,:;]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  return out.slice(0, 3);
};

// POST /api/names { goal } -> { names: [3 names] }
router.post('/', async (req, res) => {
  const goal = String((req.body && req.body.goal) || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
  if (!goal) return res.status(400).json({ error: 'Write the goal first' });
  if (!getKey()) return res.status(503).json({ error: 'No GROQ_API_KEY on the server (.env)' });
  try {
    const text = await chat({
      system: SYSTEM,
      user: `Goal: ${goal}`,
      temperature: 0.7,
      maxTokens: 1000,         // gpt-oss "thinks" first; 500 could be used up before any name is written
      reasoningEffort: 'low',
      timeoutMs: 20_000,
    });
    const m = text.match(/\{[\s\S]*\}/);
    const names = m ? clean(JSON.parse(m[0]).names) : [];
    if (names.length) return res.json({ names });
    console.error('Names: Groq answered but no names could be read:', text.slice(0, 200));
    return res.status(502).json({ error: 'No names came back, try again' });
  } catch (err) {
    console.error('Names error:', err.message);
    const known = err.status === 401 || err.status === 403 || err.status === 429 || err.status === 0;
    return res.status(502).json({ error: known ? err.message : 'No names came back, try again' });
  }
});

module.exports = router;
