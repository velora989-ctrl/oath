// The playable characters (data/characters.json) and the player limit.
const cfg = require('../data/characters.json');
const fs = require('fs');
const path = require('path');

const CHARACTERS = cfg.characters;
const KEYS = CHARACTERS.map((c) => c.key);
const MAX_PLAYERS = Math.max(1, parseInt(process.env.MAX_PLAYERS, 10) || 5);
const FULL_MESSAGE = 'The Grove is full. Talk to the admins to get your spot.';

for (const c of CHARACTERS) {
  for (const f of [c.face, c.icon]) {
    if (!fs.existsSync(path.join(__dirname, '../public', f))) console.warn(`characters.json: ${f} of "${c.key}" does not exist in public/`);
  }
}
if (CHARACTERS.length < MAX_PLAYERS) console.warn(`characters.json has ${CHARACTERS.length} characters but MAX_PLAYERS is ${MAX_PLAYERS}: the last players could not pick one`);

module.exports = { CHARACTERS, KEYS, MAX_PLAYERS, FULL_MESSAGE, isValid: (k) => KEYS.includes(k) };
