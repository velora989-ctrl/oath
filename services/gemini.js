const fs = require('fs');
const path = require('path');
const Journal = require('../models/Journal');
const emojis = require('../data/emojis.json');

const PROMPT_TEMPLATE = fs.readFileSync(path.join(__dirname, '../prompts/journalPrompt.txt'), 'utf8');
const STATS = ['int', 'end', 'str', 'arc', 'wis'];
const TYPES = ['signal', 'noise', 'necessity'];
const MAX_POINTS_PER_TASK = 8;

const emojiUrls = new Set(emojis.map((e) => e.url));
const defaultEmoji = (emojis.find((e) => e.default) || emojis[0]).url;

// ---------- prompt building ----------

function emojiCatalogueText() {
  return emojis.map((e) => `- ${e.name}: ${e.url}`).join('\n');
}

// Last distinct signal tasks of this player, so Gemini can score relative to past evaluations.
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

// ---------- Gemini call ----------

async function callGemini(systemPrompt, journalText) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `JOURNAL:\n${journalText}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text) throw new Error(`Empty Gemini response: ${JSON.stringify(data.promptFeedback || {})}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
}

// ---------- validation: never trust model output blindly ----------

const zeroPoints = () => ({ int: 0, end: 0, str: 0, arc: 0, wis: 0 });

function sanitizeTask(raw) {
  const type = TYPES.includes(String(raw?.type).toLowerCase()) ? String(raw.type).toLowerCase() : 'necessity';
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
    name: String(raw?.name || 'Untitled activity').trim().slice(0, 60),
    type,
    duration: String(raw?.duration || 'unknown').trim().slice(0, 30),
    points,
  };
}

function sanitize(parsed) {
  const tasks = (Array.isArray(parsed?.tasks) ? parsed.tasks : []).slice(0, 40).map(sanitizeTask);
  let ratio = Number(parsed?.signal_to_noise_ratio);
  if (!Number.isFinite(ratio)) ratio = 0.5;
  ratio = Math.min(1, Math.max(0, ratio));
  if (!tasks.some((t) => t.type === 'signal' || t.type === 'noise')) ratio = 0.5;
  return { tasks, signal_to_noise_ratio: ratio };
}

// ---------- public API ----------

async function analyzeJournal(journalText, playerId) {
  const systemPrompt = await buildSystemPrompt(playerId);
  const raw = await callGemini(systemPrompt, journalText);
  const result = sanitize(parseJson(raw));
  if (result.tasks.length === 0) throw new Error('Gemini returned no tasks');
  return result;
}

module.exports = { analyzeJournal };
