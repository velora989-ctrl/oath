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
    cr: { type: [Number], default: undefined }, // crop: the part trimmed off the picture's left, top, right, bottom (0-0.95 each)
  },
  { _id: false }
);

// A player can keep several boards (one for a book, one for a project...), each with its own name.
// Old databases have one unnamed board per player behind a unique index on "player"; server.js drops that index at start-up and
// an unnamed board is simply shown as "My board".
const boardSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    name: { type: String, default: 'My board', trim: true, maxlength: 40 },
    order: { type: Number, default: 0 },
    count: { type: Number, default: 0 }, // how many papers / pictures are pinned (for the board list)
    papers: { type: [paperSchema], default: [] },
  },
  { timestamps: true }
);
boardSchema.index({ player: 1, order: 1 });

module.exports = mongoose.model('Board', boardSchema);
