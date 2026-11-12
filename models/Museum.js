const mongoose = require('mongoose');

// The Creators Museum: the people a player wants to study (Caleb Ralston...), each in one hall (self-help, business, productivity),
// with the YouTube videos they saved for that person (and the timestamps they noted on them) and the books they put on that person's shelf. One document per player.
const tsSchema = new mongoose.Schema({ t: { type: Number, required: true }, l: { type: String, default: '', maxlength: 80 } }, { _id: false });
const videoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 40 }, // YouTube video id (kind v) or playlist id (kind l)
    kind: { type: String, enum: ['v', 'l', 'r', 'p'], default: 'v' }, // v video, l playlist, r Instagram reel, p photo
    title: { type: String, default: '', maxlength: 160 },
    author: { type: String, default: '', maxlength: 80 }, // channel name; for a reel: the @username
    thumb: { type: String, default: '', maxlength: 60000 }, // reel picture (small data: image or https link)
    src: { type: String, default: '', maxlength: 24 }, // photo (kind p): id of the original file kept on the server
    w: { type: Number, default: 0 }, // photo width in pixels (original)
    h: { type: Number, default: 0 }, // photo height in pixels (original)
    dur: { type: Number, default: 0 }, // seconds, 0 = unknown
    at: { type: Number, default: 0 }, // when it was added (ms)
    list: { type: String, default: '', maxlength: 40 }, // the playlist it came from
    done: { type: Boolean, default: false }, // ticked as watched (fills the pebble path to the next level on the map)
    note: { type: String, default: '', maxlength: 2000 }, // your own notes on the back of a reel card (folders)
    ts: { type: [tsSchema], default: [] },
  },
  { _id: false }
);
// a book on a creator's shelf: picked from a Google Books search (cover + total pages come from there; the pages can be corrected by hand)
const bookSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 40 }, // Google Books volume id
    title: { type: String, default: '', maxlength: 160 },
    authors: { type: String, default: '', maxlength: 120 },
    cover: { type: String, default: '', maxlength: 400 }, // https cover picture
    pages: { type: Number, default: 0 }, // total pages, 0 = unknown
    at: { type: Number, default: 0 }, // when it was added (ms)
  },
  { _id: false }
);
const creatorSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 40 },
    name: { type: String, required: true, maxlength: 60 },
    hall: { type: String, enum: ['self', 'biz', 'prod'], required: true },
    note: { type: String, default: '', maxlength: 300 },
    at: { type: Number, default: 0 },
    img: { type: String, default: '', maxlength: 60000 },
    slot: { type: Number, default: -1 },
    lists: { type: [{ id: String, title: { type: String, maxlength: 160 }, _id: false }], default: [] },
    videos: { type: [videoSchema], default: [] },
    books: { type: [bookSchema], default: [] },
  },
  { _id: false }
);
// a reel & video folder (the folder level beside the castle): a named box that holds Instagram reels and YouTube videos, same shape as a creator's wall
const folderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 40 },
    name: { type: String, required: true, maxlength: 60 },
    col: { type: Number, default: 0 }, // colour of the folder (0-5)
    at: { type: Number, default: 0 },
    lists: { type: [{ id: String, title: { type: String, maxlength: 160 }, _id: false }], default: [] },
    videos: { type: [videoSchema], default: [] },
    books: { type: [bookSchema], default: [] }, // books added inside the folder
  },
  { _id: false }
);
const museumSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, unique: true },
    creators: { type: [creatorSchema], default: [] },
    folders: { type: [folderSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Museum', museumSchema);
