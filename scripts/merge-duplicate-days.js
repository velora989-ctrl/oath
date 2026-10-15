// One-off cleanup for databases that already have several journals on the same day.
// Keeps the NEWEST journal of each (player, day), deletes the others and takes their points back.
//
//   node scripts/merge-duplicate-days.js           -> dry run, only prints what it would do
//   node scripts/merge-duplicate-days.js --apply   -> really does it
//
// Run it once before starting the new version (MongoDB can't build the one-journal-per-day index
// while duplicates exist). Back up your database first.
require('dotenv').config();
const mongoose = require('mongoose');
const Journal = require('../models/Journal');
const Player = require('../models/Player');
const { computeDay, STATS } = require('../services/dayStats');

const apply = process.argv.includes('--apply');

(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const groups = await Journal.aggregate([
    { $group: { _id: { player: '$player', date: '$date' }, ids: { $push: '$_id' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  console.log(`${groups.length} day(s) with more than one journal`);

  for (const g of groups) {
    const docs = await Journal.find({ _id: { $in: g.ids } }).sort({ createdAt: -1 });
    const [keep, ...extra] = docs;
    const give = { int: 0, end: 0, str: 0, arc: 0, wis: 0 };
    for (const d of extra) {
      const pts = computeDay(d.tasks).points;
      for (const k of STATS) give[k] += pts[k];
    }
    console.log(`player ${g._id.player} ${g._id.date}: keep ${keep._id}, remove ${extra.length}, take back`, give);
    if (!apply) continue;

    const inc = {};
    for (const k of STATS) if (give[k]) inc[`stats.${k}`] = -give[k];
    await Journal.deleteMany({ _id: { $in: extra.map((d) => d._id) } });
    if (Object.keys(inc).length) await Player.findByIdAndUpdate(g._id.player, { $inc: inc });
  }

  if (apply) {
    await Journal.syncIndexes();
    console.log('Done. Unique index is in place.');
  } else {
    console.log('Dry run only. Re-run with --apply to make these changes.');
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
