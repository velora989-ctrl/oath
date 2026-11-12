const mongoose = require('mongoose');

// A player's bosses (the Bosses button): real-life goals turned into a boss with an HP bar and mini bosses, plus the Hall of Fame
// of defeated ones. The shape is checked and cleaned in routes/bosses.js before it is saved. One document per player.
const bossSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, unique: true },
    list: { type: [mongoose.Schema.Types.Mixed], default: [] }, // active bosses
    hall: { type: [mongoose.Schema.Types.Mixed], default: [] }, // defeated bosses (the Hall of Fame)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Boss', bossSchema);
