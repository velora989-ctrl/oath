const fs = require('fs');
const path = require('path');
const Journal = require('../models/Journal');
const { computeDay, displayDuration } = require('./dayStats');
const { promptCatalogue, toModelText, classify, limitName } = require('./activities');
const emojiCatalogue = require('./emojis');
const archetypes = require('./archetypes');

const PROMPT_TEMPLATE = fs.readFileSync(path.join(__dirname, '../prompts/journalPrompt.txt'), 'utf8');
const STATS = ['int', 'end', 'str', 'arc', 'wis'];
const MAX_POINTS_PER_TASK = 8;

// ---------- activity classification ----------
// What counts as Signal / Noise / Unknown lives ONLY in data/activities.json (services/activities.js).
// Explicit private words are swapped for a neutral phrase BEFORE the text goes to the model (so it never
// refuses), and the server - not the model - decides how every listed activity is classified and shown.
// The saved journal text itself is not changed or shown anywhere in the app.

// ---------- prompt building ----------

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

async function buildSystemPrompt(playerId, archetype) {
  const prev = await previousEvaluationsText(playerId);
  const catalogue = emojiCatalogue.promptCatalogue();
  const activities = promptCatalogue(archetype);
  // function replacers so "$" in the text is never treated as a special pattern
  return PROMPT_TEMPLATE.replace('{{ARCHETYPE_RULES}}', () => archetypes.get(archetype).rules)
    .replace('{{ACTIVITY_CATALOGUE}}', () => activities)
    .replace('{{EMOJI_CATALOGUE}}', () => catalogue)
    .replace('{{PREVIOUS_EVALUATIONS}}', () => prev);
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

function sanitizeTask(raw, archetype) {
  // The listed activities are classified by the server from data/activities.json (the model's own
  // signal/noise guess is ignored for them). Unlisted activities keep the model's signal/noise judgement.
  const c = classify({ activity: raw?.activity, name: raw?.name, type: raw?.type }, archetype);
  const name = limitName(c.name || raw?.name || 'Untitled activity') || 'Untitled activity'; // at most MAX_NAME characters
  const type = c.type; // tracking class: 'signal' | 'noise' (Unknown activities are noise)
  const points = zeroPoints();

  if (type === 'signal' && !c.noPoints) { // noPoints: routine basics of the liberal archetype are signal but earn nothing
    // single-stat rule: keep only the strongest stat, capped
    let best = null;
    for (const k of STATS) {
      const v = Math.round(Number(raw?.points?.[k]));
      if (Number.isFinite(v) && v > 0 && (!best || v > best.v)) best = { k, v };
    }
    if (best) points[best.k] = Math.min(best.v, MAX_POINTS_PER_TASK);
  }

  // image (services/emojis.js): Unknown -> the private image; listed activity -> its fixed image from
  // activities.json; otherwise the model's pick (an image key), then a keyword match on the name, then the default
  const emoji = c.category === 'Unknown' ? c.image : c.image || emojiCatalogue.pick({ modelValue: raw?.emoji, name });

  return {
    emoji, // Unknown always gets the neutral image
    name,
    type,
    activity: c.activity, // 'unknown' for every Unknown activity, never the specific one
    category: c.category === 'Unknown' ? 'Noise' : c.category, // journal category: Signal | Noise (an Unknown task is Noise)
    duration: displayDuration(String(raw?.duration || 'unknown').trim().slice(0, 30)), // stored in minutes
    points,
  };
}

function sanitize(parsed, archetype) {
  const tasks = (Array.isArray(parsed?.tasks) ? parsed.tasks : []).slice(0, 40).map((t) => sanitizeTask(t, archetype));
  // The ratio is computed from the task durations, not taken from the model.
  return { tasks, signal_to_noise_ratio: computeDay(tasks).ratio };
}

// ---------- public API ----------

async function analyzeJournal(journalText, playerId, archetype) {
  const systemPrompt = await buildSystemPrompt(playerId, archetype);
  const raw = await callGroq(systemPrompt, toModelText(journalText));
  const result = sanitize(parseJson(raw), archetype);
  if (result.tasks.length === 0) throw new Error('Model returned no tasks');
  return result;
}

module.exports = { analyzeJournal };
