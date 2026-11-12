const mongoose = require('mongoose');

// A photo dropped into a Media Log folder, kept exactly as the player uploaded it (original bytes, no re-encoding, no resizing).
// Kept apart from BoardImage because board pictures are tidied away when no board uses them any more.
const museumPhotoSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    mime: { type: String, enum: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('MuseumPhoto', museumPhotoSchema);
