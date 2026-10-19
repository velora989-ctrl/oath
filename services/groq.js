const fs = require('fs');
const path = require('path');
const Journal = require('../models/Journal');
const { computeDay, displayDuration, parseClock, parseMinutes, DAY_MINUTES } = require('./dayStats');
const { promptCatalogue, toModelText, classify, limitName, limitText, hasPrivateTerm, isGoodName } = require('./activities');
const emojiCatalogue = require('./emojis');
const archetypes = require('./archetypes');
const { flattenJournal } = require('./journalText');

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
      const given = STATS.filter((k) => t.points?.[k] > 0).map((k) => `${k}=${t.points[k]}`);
      if (!given.length) continue;
      lines.push(`- "${t.name}" (${t.duration}) -> ${given.join(', ')}`);
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
  console.log('ARCHETYPE:', archetype);
  console.log(archetypes.get(archetype).rules);
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
        max_completion_tokens: 8000,      // room for reasoning + JSON output
        reasoning_effort: 'low',          // gpt-oss supports low | medium | high
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `JOURNAL:\n${journalText}` }
        ],
      }),

    });
    if (!res.ok) {
      const err = new Error(`Groq HTTP ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    if (!text || !text.trim()) {
      console.error('Empty Groq response:', {
        model,
        finish_reason: choice?.finish_reason,
        usage: data.usage,
        hasReasoning: !!choice?.message?.reasoning,
        journalLen: journalText?.length,
      });
      throw new Error(`Empty Groq response (${model}, finish=${choice?.finish_reason})`);
    }
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

// One task earns at most MAX_POINTS_PER_TASK in total, however many stats it is spread over.
// Over the limit, every stat is scaled down together so the split stays the same.
function capTotal(points) {
  const sum = () => STATS.reduce((a, k) => a + points[k], 0);
  const total = sum();
  if (total <= MAX_POINTS_PER_TASK) return;
  const f = MAX_POINTS_PER_TASK / total;
  for (const k of STATS) if (points[k] > 0) points[k] = Math.max(1, Math.floor(points[k] * f));
  while (sum() > MAX_POINTS_PER_TASK) { // flooring to at least 1 can still leave it over: trim the biggest stat
    const big = STATS.reduce((a, k) => (points[k] > points[a] ? k : a), STATS[0]);
    points[big] -= 1;
  }
}

function sanitizeTask(raw, archetype) {
  // The listed activities are classified by the server from data/activities.json (the model's own
  // signal/noise guess is ignored for them). Unlisted activities keep the model's signal/noise judgement.
  const c = classify({ activity: raw?.activity, name: raw?.name, type: raw?.type }, archetype);
  // Name: Unknown and sleep keep their fixed label. Every other task (listed or not) is named by the model from the
  // player's own words, so the activity log says what was really done ("Podcast On Commute", not just "YouTube podcast").
  // The listed label is only the fallback when the model's name is missing or a placeholder.
  const useModelName = !(c.category === 'Unknown' || c.activity === 'sleep') && isGoodName(raw?.name);
  const name = limitName(useModelName ? raw.name : c.name || raw?.name || 'Untitled activity') || 'Untitled activity'; // at most MAX_NAME characters
  // Description (hover text): one short line of what the player did. Never kept for Unknown tasks or anything that
  // mentions a private word, so private activities can never leak through it.
  const rawDesc = limitText(raw?.description);
  const description = c.category === 'Unknown' || hasPrivateTerm(rawDesc) ? '' : rawDesc;
  const type = c.type; // tracking class: 'signal' | 'noise' (Unknown activities are noise)
  const points = zeroPoints();

  if (type === 'signal' && !c.noPoints) { // noPoints: routine basics of the liberal archetype are signal but earn nothing
    // A task can earn points in SEVERAL stats (e.g. gym + cooking in one block = str + arc).
    let given = {};
    for (const k of STATS) {
      const v = Math.round(Number(raw?.points?.[k]));
      if (Number.isFinite(v) && v > 0) given[k] = v;
    }
    // Stat guard: a listed activity belongs to one stat (podcast / business video / books = int, gym = str, ...).
    // If the model gave it nothing there (say a business podcast scored as END), its points move to the right stat.
    if (c.stat && !(given[c.stat] > 0)) {
      const sum = Object.values(given).reduce((a, b) => a + b, 0);
      given = sum > 0 ? { [c.stat]: sum } : given;
    }
    for (const k of Object.keys(given)) points[k] = given[k];
    capTotal(points);
  }

  // image (services/emojis.js): Unknown -> the private image; listed activity -> its fixed image from
  // activities.json; otherwise the model's pick (an image key), then a keyword match on the name, then the default
  const emoji = c.category === 'Unknown' ? c.image : c.image || emojiCatalogue.pick({ modelValue: raw?.emoji, name });

  return {
    emoji, // Unknown always gets the neutral image
    name,
    description,
    type,
    activity: c.activity, // 'unknown' for every Unknown activity, never the specific one
    category: c.category === 'Unknown' ? 'Noise' : c.category, // journal category: Signal | Noise (an Unknown task is Noise)
    duration: displayDuration(String(raw?.duration || 'unknown').trim().slice(0, 30)), // stored in minutes
    start: parseClock(raw?.start), // clock time the block began (minutes after midnight), undefined when the model gave none
    points,
  };
}

function sanitize(parsed, archetype) {
  const tasks = (Array.isArray(parsed?.tasks) ? parsed.tasks : []).slice(0, 40).map((t) => sanitizeTask(t, archetype));
  // A task without a start time follows the previous one (tasks are in day order and add up to 24h);
  // the first one then starts at 12:00am. The end of a task is always start + duration.
  let next = 0;
  for (const t of tasks) {
    if (!Number.isFinite(t.start)) t.start = next;
    next = (t.start + parseMinutes(t.duration)) % DAY_MINUTES;
  }
  // The ratio is computed from the task durations, not taken from the model.
  return { tasks, signal_to_noise_ratio: computeDay(tasks).ratio };
}

// ---------- public API ----------

async function analyzeJournal(journalText, playerId, archetype) {
  const systemPrompt = await buildSystemPrompt(playerId, archetype);
  const raw = await callGroq(systemPrompt, toModelText(flattenJournal(journalText))); // one paragraph, no line breaks
  const result = sanitize(parseJson(raw), archetype);
  const day = computeDay(result.tasks);
  console.log('SANITIZED TASK COUNT:', result.tasks.length);
  console.log('SIGNAL MINUTES:', day.signalMinutes);
  console.log('NOISE MINUTES:', day.noiseMinutes);
  console.log('SLEEP MINUTES:', day.necessityMinutes);
  console.log(
    'TOTAL TRACKED HOURS:',
    (day.signalMinutes + day.noiseMinutes + day.necessityMinutes) / 60
  );
  if (result.tasks.length === 0) throw new Error('Model returned no tasks');
  return result;
}

module.exports = { analyzeJournal, sanitize };
