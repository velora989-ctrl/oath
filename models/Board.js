const mongoose = require('mongoose');

// One notice board per player: the papers pinned on it (position, size, rotation, style and the written text as safe HTML).
const paperSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 40 },
    style: { type: String, required: true, maxlength: 24 }, // parch, notice, tea, ledger, slip, scrap, letter, map, image
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    w: { type: Number, default: 300 },
    h: { type: Number, default: 300 },
    rot: { type: Number, default: 0 },
    z: { type: Number, default: 1 },
    seed: { type: Number, default: 1 }, // shape of the torn edge
    html: { type: String, default: '', maxlength: 20000 },
    // pictures only (style 'image'): the BoardImage id, the look (0 normal, 1 parchment, 2 old photo, 3 ink sketch), mirrored, has transparency
    img: { type: String, default: '', maxlength: 24 },
    fx: { type: Number, default: 0 },
    flip: { type: Number, default: 0 },
    alpha: { type: Number, default: 0 },
  },
  { _id: false }
);

const boardSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, unique: true },
    papers: { type: [paperSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Board', boardSchema);
