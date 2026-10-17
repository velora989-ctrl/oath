// Archetypes (data/archetypes.json): the rule set that decides what is Signal and what is Noise for a player.
//   radical (hard)  = the original configuration of the site (data/activities.json as it is)
//   liberal (easy)  = everything except distractions is Signal
// A player chooses one at registration. Players without one (registered before archetypes existed) are radical.
const cfg = require('../data/archetypes.json');

const DEFAULT = cfg.default || 'radical';
const ARCHETYPES = cfg.archetypes;
const KEYS = Object.keys(ARCHETYPES);

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
