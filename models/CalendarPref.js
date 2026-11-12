const mongoose = require('mongoose');

// A player's changes to the school calendar (Holidays tab): a working day turned into a holiday (h = 1, with an optional
// note of what it is for) or a planner holiday / Sunday turned into a working day (h = 0). One document per player.
const daySchema = new mongoose.Schema(
  {
    d: { type: String, required: true, maxlength: 10 }, // YYYY-MM-DD
    h: { type: Number, required: true }, // 1 = holiday, 0 = working day, 2 = exam day (red)
    n: { type: String, default: '', maxlength: 60 },
  },
  { _id: false }
);

// to-do lists and notes written beside a day in the calendar's Day Book
const noteSchema = new mongoose.Schema(
  {
    d: { type: String, required: true, maxlength: 10 }, // YYYY-MM-DD
    n: { type: String, default: '', maxlength: 1000 }, // free notes
    t: { type: [{ x: { type: String, maxlength: 120 }, d: { type: Boolean, default: false }, _id: false }], default: [] }, // to-do items
  },
  { _id: false }
);

const calendarPrefSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, unique: true },
    days: { type: [daySchema], default: [] },
    notes: { type: [noteSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CalendarPref', calendarPrefSchema);
