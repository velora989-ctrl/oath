// Archetypes (data/archetypes.json): the rule set that decides what is Signal and what is Noise for a player.
//   radical (hard)  = the original configuration of the site (data/activities.json as it is)
//   liberal (easy)  = everything except distractions is Signal
// A player chooses one at registration. Players without one (registered before archetypes existed) are radical.
//
// The file has ONE fixed layout (see its _readme). Every archetype block is checked at start-up, and the rest of the
// app gets a flat object per archetype: { key, name, mode, summary, signal, noise, overrides, noPoints, rules }.
const fs = require('fs');
const path = require('path');
const cfg = require('../data/archetypes.json');

const DEFAULT = cfg.default || 'radical';
const RAW = cfg.archetypes || {};
const KEYS = Object.keys(RAW);

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

// ---- layout check: say exactly what is wrong instead of failing later in a strange place ----
function validate() {
  const problems = [];
  let activityIds = null;
  try {
    activityIds = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/activities.json'), 'utf8')).activities.map((a) => a.id));
  } catch (e) { /* activities.json problems are reported by services/activities.js */ }

  if (!KEYS.length) problems.push('"archetypes" is empty');
  if (!RAW[DEFAULT]) problems.push(`"default" is "${DEFAULT}" but there is no such archetype`);
  for (const k of KEYS) {
    const a = RAW[k] || {};
    const at = (field) => `archetypes.${k}.${field}`;
    if (a.key !== k) problems.push(`${at('key')} must be "${k}"`);
    for (const f of ['name', 'mode']) if (!isStr(a[f])) problems.push(`${at(f)} is missing`);
    for (const f of ['summary', 'signal', 'noise']) if (!isStr(a.display?.[f])) problems.push(`${at('display.' + f)} is missing`);
    if (!a.counting || typeof a.counting.overrides !== 'object' || a.counting.overrides === null) problems.push(`${at('counting.overrides')} must be an object ({} if none)`);
    if (!Array.isArray(a.counting?.noPoints)) problems.push(`${at('counting.noPoints')} must be a list ([] if none)`);
    for (const f of ['signal', 'noise']) if (!isStr(a.prompt?.[f])) problems.push(`${at('prompt.' + f)} is missing`);
    if (!Array.isArray(a.prompt?.notes) || a.prompt.notes.some((n) => !isStr(n))) problems.push(`${at('prompt.notes')} must be a list of texts ([] if none)`);
    if (activityIds) {
      for (const id of [...Object.keys(a.counting?.overrides || {}), ...(a.counting?.noPoints || [])]) {
        if (!activityIds.has(id)) problems.push(`${at('counting')} names "${id}", which is not an activity id in data/activities.json`);
      }
    }
  }
  if (problems.length) throw new Error('data/archetypes.json is not valid:\n - ' + problems.join('\n - '));
}
validate();

// the text that goes into {{ARCHETYPE_RULES}} in the AI prompt
const buildRules = (p) => [`- **SIGNAL:** ${p.signal}`, `- **NOISE:** ${p.noise}`, ...p.notes.map((n) => `- ${n}`)].join('\n');

const ARCHETYPES = {};
for (const k of KEYS) {
  const a = RAW[k];
  ARCHETYPES[k] = {
    key: a.key,
    name: a.name,
    mode: a.mode,
    summary: a.display.summary,
    signal: a.display.signal,
    noise: a.display.noise,
    overrides: a.counting.overrides,
    noPoints: a.counting.noPoints,
    rules: buildRules(a.prompt),
  };
}

const isValid = (k) => KEYS.includes(k);
// any missing / unknown value gives the default (radical)
const get = (k) => ARCHETYPES[isValid(k) ? k : DEFAULT];
const norm = (k) => (isValid(k) ? k : DEFAULT);

// what the registration screen needs (no prompt text)
const publicList = () => KEYS.map((k) => {
  const { key, name, mode, summary, signal, noise } = ARCHETYPES[k];
  return { key, name, mode, summary, signal, noise };
});

module.exports = { DEFAULT, KEYS, isValid, get, norm, publicList };
