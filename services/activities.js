// SINGLE SOURCE OF TRUTH loader for activity classification (data/activities.json).
//
//  - journal category  = what the journal UI shows: Signal | Noise | Unknown | Necessity
//  - tracking class    = what ratios, totals, charts and AI prompts count: Signal | Noise | Necessity
// Unknown activities are shown as "Unknown" everywhere and are ALWAYS counted as Noise.
// Necessity (sleep only) is left out of the signal/noise ratio and hidden from the activity log (calendar only).
// Nothing else in the code base may decide what is signal or noise for the listed activities.

const cfg = require('../data/activities.json');
const fs = require('fs');
const path = require('path');
const emojiCatalogue = require('./emojis');
const archetypes = require('./archetypes');

const UNKNOWN_LABEL = cfg.unknownLabel || 'Unknown';
const MAX_NAME = cfg.maxNameLength || 30; // a task name is never longer than this (the activity log shows it in full)
const UNKNOWN_ID = 'unknown'; // the only id ever stored / sent to the browser for Unknown activities
const defaultEmoji = emojiCatalogue.defaultUrl;

const norm = (v) => String(v || '').trim().toLowerCase();
// tracking is Signal, Noise or Necessity (sleep). Anything else is Noise.
const cap = (v) => (norm(v) === 'signal' ? 'Signal' : norm(v) === 'necessity' ? 'Necessity' : 'Noise');

const ACTIVITIES = cfg.activities.map((a) => {
  const journal = ['signal', 'noise', 'unknown', 'necessity'].includes(norm(a.journal)) ? a.journal : 'Noise';
  // Hard rule: an Unknown journal category can never be tracked as Signal.
  const tracking = norm(journal) === 'unknown' ? 'Noise' : cap(a.tracking);
  return {
    ...a,
    journal,
    tracking,
    isUnknown: norm(journal) === 'unknown',
    modelId: a.alias || a.id,
    re: a.terms && a.terms.length ? new RegExp(`\\b(?:${a.terms.join('|')})\\b`, 'i') : null,
  };
});

// A fixed image that is missing on disk would show a broken picture: say so once at start-up.
for (const a of ACTIVITIES) {
  if (a.image && !fs.existsSync(path.join(__dirname, '../public', a.image))) {
    console.warn(`activities.json: the image ${a.image} of "${a.id}" does not exist in public/`);
  }
}

const byId = new Map();
for (const a of ACTIVITIES) {
  byId.set(a.id, a);
  if (!byId.has(a.modelId)) byId.set(a.modelId, a); // alias resolves to the first row sharing it
}

const UNKNOWN_RE = new RegExp(`\\b(?:${(cfg.unknownTerms || []).join('|')})\\b`, 'gi');
const UNKNOWN_RE_TEST = new RegExp(UNKNOWN_RE.source, 'i');

const findById = (id) => byId.get(norm(id).replace(/[^a-z0-9_]/g, '')) || null;

// Safety net when the model did not give a usable id: look at the activity name.
// Unknown terms are checked first so they can never leak out as an ordinary label.
function findByName(name) {
  const n = String(name || '');
  // anything literally called "Unknown" is an Unknown activity (always Noise)
  if (n.trim().toLowerCase().replace(/[^a-z]/g, '') === UNKNOWN_LABEL.toLowerCase()) return ACTIVITIES.find((a) => a.isUnknown) || null;
  if (UNKNOWN_RE_TEST.test(n)) return ACTIVITIES.find((a) => a.isUnknown) || null;
  return ACTIVITIES.find((a) => a.re && a.re.test(n)) || null;
}

// How one listed activity counts for an archetype: { journal, tracking, noPoints }.
// The archetype can only flip activities named in its "overrides" (data/archetypes.json). Unknown stays Noise and
// sleep stays Necessity whatever the archetype says; radical has no overrides, so it is exactly data/activities.json.
function effective(a, archetype) {
  const arch = archetypes.get(archetype);
  const ov = !a.isUnknown && a.tracking !== 'Necessity' ? arch.overrides[a.id] : null;
  if (!ov) return { journal: a.journal, tracking: a.tracking, noPoints: false };
  const t = cap(ov);
  return { journal: t, tracking: t, noPoints: (arch.noPoints || []).includes(a.id) };
}

// The list the AI model sees (one line per model id).
function promptCatalogue(archetype) {
  const seen = new Set();
  const lines = [];
  for (const a of ACTIVITIES) {
    if (seen.has(a.modelId)) continue;
    seen.add(a.modelId);
    const label = a.alias ? 'personal time (the neutral phrase used in the journal)' : a.label;
    const e = effective(a, archetype);
    let counts = e.tracking === 'Necessity' ? 'NECESSITY (left out of the signal/noise ratio)' : e.tracking.toUpperCase();
    if (e.noPoints) counts += ' (earns no points)';
    lines.push(`- ${a.modelId}: ${label} -> counts as ${counts}`);
  }
  return lines.join('\n');
}

// Text that goes to the AI: explicit private words are swapped for a neutral phrase.
const toModelText = (text) => String(text || '').replace(UNKNOWN_RE, 'personal time');

// Keeps a task name within MAX_NAME characters, cutting at a word boundary when there is one.
function limitName(name) {
  const n = String(name == null ? '' : name).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (n.length <= MAX_NAME) return n;
  const cut = n.slice(0, MAX_NAME);
  const i = cut.lastIndexOf(' ');
  return (i >= Math.floor(MAX_NAME / 2) ? cut.slice(0, i) : cut).replace(/[\s,;:\-–]+$/, '');
}

// What the rest of the app should see for one activity name / id.
// archetype = the player's archetype ('liberal' | 'radical'; anything else = radical).
//  -> { activity, name, type (tracking: 'signal'|'noise'), category (journal: 'Signal'|'Noise'|'Unknown'), emoji? }
function classify({ activity, name, type }, archetype) {
  const a = findById(activity) || findByName(name);
  if (a) {
    if (a.isUnknown) {
      return { activity: UNKNOWN_ID, name: UNKNOWN_LABEL, type: 'noise', category: 'Unknown', image: emojiCatalogue.privateUrl, fixed: true };
    }
    const e = effective(a, archetype);
    return { activity: a.id, name: a.label, type: e.tracking.toLowerCase(), category: e.journal, image: a.image || null, fixed: true, noPoints: e.noPoints, stat: a.stat || null };
  }
  // not on the list: keep the model's own judgement (necessity = old sleep type = noise)
  const t = norm(type) === 'signal' ? 'signal' : 'noise';
  return { activity: 'other', name: null, type: t, category: t === 'signal' ? 'Signal' : 'Noise', image: null, fixed: false };
}

// The short "what I did" text shown when the player hovers a task name. One line, plain text, never longer than MAX_DESC.
const MAX_DESC = cfg.maxDescriptionLength || 140;
const hasPrivateTerm = (text) => UNKNOWN_RE_TEST.test(String(text || ''));
function limitText(text, max = MAX_DESC) {
  const t = String(text == null ? '' : text).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const i = cut.lastIndexOf(' ');
  return (i >= Math.floor(max / 2) ? cut.slice(0, i) : cut).replace(/[\s,;:\-–]+$/, '') + '…';
}
// A usable task name: not empty and not a placeholder like "Activity" / "Task" / "Untitled".
const GENERIC_NAME = /^(?:untitled(?: activity)?|activity|task|other|misc(?:ellaneous)?|stuff|things?|unknown activity|n\/a|none)$/i;
const isGoodName = (n) => !!limitName(n) && !GENERIC_NAME.test(limitName(n));

module.exports = { MAX_NAME, MAX_DESC, limitName, limitText, hasPrivateTerm, isGoodName, ACTIVITIES, UNKNOWN_LABEL, UNKNOWN_ID, findById, findByName, promptCatalogue, toModelText, classify, defaultEmoji };
