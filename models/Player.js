const mongoose = require('mongoose');
const { KEYS: CHARACTER_KEYS } = require('../services/characters');
const { KEYS: ARCHETYPE_KEYS } = require('../services/archetypes');

// Level thresholds on total points. Tune freely; the frontend only displays what the server sends.
const THRESHOLDS = [0, 25, 75, 150, 250, 375, 525, 700, 900];
const TITLES = ['Seedling', 'Sprout', 'Wanderer', 'Ranger', 'Warden', 'Druid', 'Guardian', 'Sage', 'Legend'];

const statsSchema = new mongoose.Schema(
  {
    int: { type: Number, default: 0 }, // Intelligence
    end: { type: Number, default: 0 }, // Endurance
    str: { type: Number, default: 0 }, // Strength
    arc: { type: Number, default: 0 }, // Arcane
    wis: { type: Number, default: 0 }, // Wisdom
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 16 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    // the character this player chose (services/characters.js); unset until they pick one, and never shared by two players
    character: { type: String, enum: CHARACTER_KEYS, default: undefined },
    // 'liberal' (easy) or 'radical' (hard), chosen once at registration (services/archetypes.js). Unset = radical, the original rules.
    archetype: { type: String, enum: ARCHETYPE_KEYS, default: undefined },
    stats: { type: statsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// one player per character (players that have not chosen yet are left out of the index)
playerSchema.index({ character: 1 }, { unique: true, partialFilterExpression: { character: { $type: 'string' } } });

// Everything the public (other players) is allowed to see. Never email/password.
playerSchema.methods.toPublic = function () {
  const s = this.stats || {};
  const stats = { int: s.int || 0, end: s.end || 0, str: s.str || 0, arc: s.arc || 0, wis: s.wis || 0 };
  const totalPoints = stats.int + stats.end + stats.str + stats.arc + stats.wis;
  const level = THRESHOLDS.filter((t) => totalPoints >= t).length;
  return {
    id: this._id,
    name: this.name,
    avatar: this.avatar,
    character: this.character || null,
    archetype: this.archetype || null, // null = not chosen yet (counts as radical)
    stats,
    totalPoints,
    level,
    title: TITLES[level - 1],
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Player', playerSchema);
