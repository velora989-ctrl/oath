const mongoose = require('mongoose');

// A picture pinned on a notice board. The browser re-encodes uploads, the server checks the file signature (routes/board.js),
// and the bytes are kept here so a board never depends on a folder on the server's disk.
const boardImageSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    mime: { type: String, enum: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('BoardImage', boardImageSchema);
