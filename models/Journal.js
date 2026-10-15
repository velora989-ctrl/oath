const mongoose = require('mongoose');

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
    // 'necessity' only exists in old entries; it is now treated as noise everywhere.
    type: { type: String, enum: ['signal', 'noise', 'necessity'], required: true },
    duration: { type: String, default: 'unknown' },
    points: { type: pointsSchema, default: () => ({}) },
  },
  { _id: false }
);

const journalSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD, the day the journal is about
    rawText: { type: String, required: true, maxlength: 5000 },
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
