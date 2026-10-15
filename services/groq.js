const fs = require('fs');
const path = require('path');
const Journal = require('../models/Journal');
const { computeDay } = require('./dayStats');
const emojis = require('../data/emojis.json');

const PROMPT_TEMPLATE = fs.readFileSync(path.join(__dirname, '../prompts/journalPrompt.txt'), 'utf8');
const STATS = ['int', 'end', 'str', 'arc', 'wis'];
const MAX_POINTS_PER_TASK = 8;

const emojiUrls = new Set(emojis.map((e) => e.url));
const defaultEmoji = (emojis.find((e) => e.default) || emojis[0]).url;

// ---------- private-activity handling ----------
// Some models refuse or error out when a journal mentions sexual self-pleasure. It is a normal part of
// a day, so the words are swapped for a neutral phrase BEFORE the text goes to the model. The saved
// journal text stays exactly as the player wrote it; only the AI sees the neutral wording.
const PRIVATE_RE = /\b(masturbat\w*|self[\s-]*pleasur\w*|self[\s-]*gratif\w*|jerk(?:ing|ed)?\s+off|jack(?:ing|ed)?\s+off|wank\w*|fap+(?:ing|ped)?|goon(?:ing|ed|er|s)?|porn\w*)\b/gi;
const PRIVATE_PHRASE = 'private personal time';
const toModelText = (text) => text.replace(PRIVATE_RE, PRIVATE_PHRASE);

// Sleep is a necessity, whatever the model says.
const SLEEP_RE = /\b(sleep|sleeping|slept|nap|napping)\b/i;

// ---------- prompt building ----------

function emojiCatalogueText() {
  return emojis.map((e) => `- ${e.name}: ${e.url}`).join('\n');
}

// Last distinct signal tasks of this player, so the model can score relative to past evaluations.
async function previousEvaluationsText(playerId) {
  const recent = await Journal.find({ player: playerId }).sort({ createdAt: -1 }).limit(15).select('tasks');
  const seen = new Set();
  const lines = [];
  for (const j of recent) {
    for (const t of j.tasks) {
      if (t.type !== 'signal') continue;
      const key = t.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const stat = STATS.find((k) => t.points?.[k] > 0);
      if (!stat) continue;
      lines.push(`- "${t.name}" (${t.duration}) -> ${stat}=${t.points[stat]}`);
      if (lines.length >= 25) break;
    }
    if (lines.length >= 25) break;
  }
  return lines.length
    ? lines.join('\n')
    : 'No previous evaluations yet. Use the baseline anchors from section 3.';
}

async function buildSystemPrompt(playerId) {
  const prev = await previousEvaluationsText(playerId);
  const catalogue = emojiCatalogueText();
  // function replacers so "$" in the text is never treated as a special pattern
  return PROMPT_TEMPLATE.replace('{{EMOJI_CATALOGUE}}', () => catalogue).replace('{{PREVIOUS_EVALUATIONS}}', () => prev);
}

// ---------- Groq call (OpenAI-compatible chat completions) ----------

async function callGroqModel(model, key, systemPrompt, journalText) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' }, // JSON mode (the prompt already says "JSON")
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `JOURNAL:\n${journalText}` },
        ],
      }),
    });
    if (!res.ok) {
      const err = new Error(`Groq HTTP ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Empty Groq response (${model})`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// GROQ_MODEL may be a comma-separated list; the next model is tried only if one is missing/unavailable (404).
async function callGroq(systemPrompt, journalText) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set');
  const models = (process.env.GROQ_MODEL || 'openai/gpt-oss-120b,openai/gpt-oss-20b')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  let lastErr;
  for (const model of models) {
    try {
      return await callGroqModel(model, key, systemPrompt, journalText);
    } catch (err) {
      lastErr = err;
      if (err.status !== 404) throw err;
      console.warn(`Groq model ${model} unavailable, trying next`);
    }
  }
  throw lastErr;
}

function parseJson(text) {
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

// ---------- validation: never trust model output blindly ----------

const zeroPoints = () => ({ int: 0, end: 0, str: 0, arc: 0, wis: 0 });

function sanitizeTask(raw) {
  // signal = a real task, necessity = sleep, anything else (noise, junk) = noise.
  const name = String(raw?.name || 'Untitled activity').trim().slice(0, 60);
  let type = String(raw?.type).toLowerCase();
  type = type === 'signal' ? 'signal' : type === 'necessity' ? 'necessity' : 'noise';
  if (SLEEP_RE.test(name)) type = 'necessity';
  const points = zeroPoints();

  if (type === 'signal') {
    // single-stat rule: keep only the strongest stat, capped
    let best = null;
    for (const k of STATS) {
      const v = Math.round(Number(raw?.points?.[k]));
      if (Number.isFinite(v) && v > 0 && (!best || v > best.v)) best = { k, v };
    }
    if (best) points[best.k] = Math.min(best.v, MAX_POINTS_PER_TASK);
  }

  return {
    emoji: emojiUrls.has(raw?.emoji) ? raw.emoji : defaultEmoji,
    name,
    type,
    duration: String(raw?.duration || 'unknown').trim().slice(0, 30),
    points,
  };
}

function sanitize(parsed) {
  const tasks = (Array.isArray(parsed?.tasks) ? parsed.tasks : []).slice(0, 40).map(sanitizeTask);
  // The ratio is computed from the task durations, not taken from the model.
  return { tasks, signal_to_noise_ratio: computeDay(tasks).ratio };
}

// ---------- public API ----------

async function analyzeJournal(journalText, playerId) {
  const systemPrompt = await buildSystemPrompt(playerId);
  const raw = await callGroq(systemPrompt, toModelText(journalText));
  const result = sanitize(parseJson(raw));
  if (result.tasks.length === 0) throw new Error('Model returned no tasks');
  return result;
}

module.exports = { analyzeJournal };
