const mongoose = require('mongoose');
const { KEYS: ARCHETYPE_KEYS } = require('../services/archetypes');

const pointsSchema = new mongoose.Schema(
  {
    int: { type: Number, default: 0 },
    end: { type: Number, default: 0 },
    str: { type: Number, default: 0 },
    arc: { type: Number, default: 0 },
    wis: { type: Number, default: 0 },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true }, // url from the catalogue
    name: { type: String, required: true },
    description: { type: String, default: '', maxlength: 200 }, // short "what I did", shown when hovering the name (empty for Unknown / old entries)
    // TRACKING class, used by every ratio / total / chart: 'signal' or 'noise'.
    // 'necessity' = sleep: hidden from the activity log, left out of the signal/noise ratio.
    type: { type: String, enum: ['signal', 'noise', 'necessity'], required: true },
    // activity id from data/activities.json ('unknown' for every Unknown activity) and the JOURNAL category
    // shown in the UI. Both are optional so entries saved before this change still load.
    activity: { type: String, default: undefined },
    category: { type: String, enum: ['Signal', 'Noise', 'Unknown', 'Necessity'], default: undefined },
    duration: { type: String, default: 'unknown' },
    points: { type: pointsSchema, default: () => ({}) },
  },
  { _id: false }
);

const journalSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD, the day the journal is about
    // the player's archetype when this day was written, so the day always shows the way it was counted (unset = radical)
    archetype: { type: String, enum: ARCHETYPE_KEYS, default: undefined },
    rawText: { type: String, required: true, maxlength: 5000 }, // stored for the record, never sent to the browser
    tasks: { type: [taskSchema], default: [] },
    signal_to_noise_ratio: { type: Number, min: 0, max: 1, default: 0.5 },
  },
  { timestamps: true }
);

journalSchema.index({ player: 1, createdAt: -1 });
// One journal per player per day. (If your database already has several entries on one day,
// run `node scripts/merge-duplicate-days.js --apply` once, otherwise MongoDB cannot build this index.)
journalSchema.index({ player: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Journal', journalSchema);
