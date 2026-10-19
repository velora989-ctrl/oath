// Pure helpers for "one journal per day": dates, durations, signal/noise ratio and daily points.
// No database or network access in here, so it is easy to test.

const STATS = ['int', 'end', 'str', 'arc', 'wis'];
const DEFAULT_MINUTES = 30; // used when the player did not say how long something took
const MAX_TASK_MINUTES = 24 * 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const { classify, limitName } = require('./activities');
const archetypes = require('./archetypes');
const emojiCatalogue = require('./emojis');

// "45 min" -> 45, "1.5 h" -> 90, "1h 30m" -> 90, "unknown" -> 30
function parseMinutes(duration) {
  let total = 0;
  String(duration == null ? '' : duration).replace(
    /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)(?![a-z])/gi,
    (match, n, unit) => {
      total += /^h/i.test(unit) ? Number(n) * 60 : Number(n);
      return match;
    }
  );
  if (!(total > 0)) return DEFAULT_MINUTES;
  return Math.min(Math.round(total), MAX_TASK_MINUTES);
}

// Tracking has three kinds: "signal", "noise" and "necessity". Necessity is sleep only: it is left out of the
// signal/noise ratio (only the remaining hours of the day count). Anything else (Unknown-category activities,
// old non-sleep "necessity" entries, junk) is noise.
const taskType = (t) => (t && t.type === 'signal' ? 'signal' : t && t.type === 'necessity' ? 'necessity' : 'noise');

// Durations are always DISPLAYED like "30min", "1hr", "3hr 30min" ("90 mins" / "1.5 h" -> "1hr 30min").
// The meaning of the data does not change.
function fmtMins(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m}min`;
  return m ? `${h}hr ${m}min` : `${h}hr`;
}
const displayDuration = (duration) => (hasDuration(duration) ? fmtMins(parseMinutes(duration)) : String(duration == null ? 'unknown' : duration));

// A day has exactly 24 hours, and every activity must say how long it took.
const DAY_MINUTES = 24 * 60;
const hasDuration = (duration) => {
  let found = false;
  String(duration == null ? '' : duration).replace(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)(?![a-z])/gi, (m, n) => {
    if (Number(n) > 0) found = true;
    return m;
  });
  return found;
};
const fmtMinutes = fmtMins;

// ---- clock times for the activity log ("9:00am – 11:00am") ----
// A task stores only its START as minutes after midnight (0-1439); the end is start + duration, so the two can never disagree.
// "9:00am", "09:00", "21:30", "9pm", "9 p.m." -> minutes after midnight; anything else -> undefined
function parseClock(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v >= 0 && v < DAY_MINUTES ? Math.round(v) : undefined;
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\.?\s*$/i.exec(String(v == null ? '' : v));
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = m[3] && m[3].toLowerCase();
  if (min > 59) return undefined;
  if (ap) {
    if (h < 1 || h > 12) return undefined;
    h = (h % 12) + (ap === 'p' ? 12 : 0);
  } else if (h === 24 && min === 0) h = 0;
  else if (h > 23) return undefined;
  return h * 60 + min;
}
// 0 -> "12:00am", 540 -> "9:00am", 1290 -> "9:30pm"
function fmtClock(m, suffix = true) {
  m = ((Math.round(Number(m) || 0) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')}${suffix ? (h < 12 ? 'am' : 'pm') : ''}`;
}
// "9:00 – 11:00", 12-hour digits without am/pm so the text can be bigger (the end wraps past midnight: "11:30 – 12:30"); '' when the task has no start time (old days)
const fmtRange = (start, minutes) => (Number.isFinite(start) ? `${fmtClock(start, false)} \u2013 ${fmtClock(start + minutes, false)}` : '');

// null when the day is fine, otherwise a message for the player.
function checkDay(tasks) {
  const example = 'for example "8hr sleep, 2hr games, 3hr study"';
  const missing = (tasks || []).filter((t) => !hasDuration(t.duration));
  if (missing.length) {
    const names = missing.slice(0, 3).map((t) => `"${t.name}"`).join(', ');
    return `Say how long each thing took, ${example}. No duration found for ${names}${missing.length > 3 ? ' and more' : ''}.`;
  }
  const total = (tasks || []).reduce((sum, t) => sum + parseMinutes(t.duration), 0);
  if (total === DAY_MINUTES) return null;
  const diff = Math.abs(DAY_MINUTES - total);
  return total < DAY_MINUTES
    ? `Your day adds up to ${fmtMinutes(total)}, but a day has ${fmtMinutes(DAY_MINUTES)}: ${fmtMinutes(diff)} missing. Define every hour, ${example}.`
    : `Your day adds up to ${fmtMinutes(total)}, but a day has ${fmtMinutes(DAY_MINUTES)}: ${fmtMinutes(diff)} too many. Define every hour, ${example}.`;
}

function computeDay(tasks) {
  const points = { int: 0, end: 0, str: 0, arc: 0, wis: 0 };
  let signalMinutes = 0;
  let noiseMinutes = 0;
  let necessityMinutes = 0; // sleep: shown in the calendar only, never part of the ratio
  for (const t of tasks || []) {
    const minutes = parseMinutes(t.duration);
    const type = taskType(t);
    if (type === 'signal') signalMinutes += minutes;
    else if (type === 'necessity') necessityMinutes += minutes;
    else noiseMinutes += minutes; // includes Unknown activities
    for (const k of STATS) points[k] += (t.points && t.points[k]) || 0;
  }
  const total = signalMinutes + noiseMinutes; // the hours left after sleep
  const ratio = total ? Math.round((signalMinutes / total) * 1000) / 1000 : 0.5;
  const totalPoints = STATS.reduce((sum, k) => sum + points[k], 0);
  return { signalMinutes, noiseMinutes, necessityMinutes, ratio, points, totalPoints };
}

// One task as the browser may see it. Unknown activities are always named "Unknown", get a neutral image and
// are tracked as noise; the specific activity is never exposed.
function presentTask(t, archetype) {
  let c = classify({ activity: t.activity, name: t.name, type: t.type }, archetype);
  // Entries saved before activity ids existed: only re-label what the rules require (Unknown + sleep), so the
  // points already granted for other old tasks are never changed behind the player's back.
  const legacy = !t.activity;
  if (legacy && c.fixed && c.category !== 'Unknown' && c.activity !== 'sleep') c = classify({ type: t.type }, archetype);
  const base = { emoji: t.emoji, name: limitName(t.name), description: t.description || '', duration: displayDuration(t.duration), start: Number.isFinite(t.start) ? t.start : undefined, time: fmtRange(t.start, parseMinutes(t.duration)), points: t.points };
  if (c.fixed && c.category === 'Unknown') {
    return { ...base, emoji: c.image, name: c.name, description: '', type: 'noise', category: 'Noise', activity: c.activity, points: { int: 0, end: 0, str: 0, arc: 0, wis: 0 } };
  }
  // the image: a fixed one from activities.json, else the one saved with the task (old placeholder icons are replaced by name)
  if (c.fixed) return { ...base, name: c.activity === 'sleep' || legacy ? c.name : limitName(t.name) || c.name, emoji: c.image || emojiCatalogue.reuse({ stored: t.emoji, name: c.name }), type: c.type, category: c.category, activity: c.activity, points: c.type === 'signal' ? t.points : { int: 0, end: 0, str: 0, arc: 0, wis: 0 } };
  return { ...base, emoji: emojiCatalogue.reuse({ stored: t.emoji, name: t.name }), type: c.type, category: c.category, activity: c.activity };
}

// What the API sends for one journal. Derived numbers are always recomputed from the tasks.
function journalView(doc) {
  const o = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  // Every task is re-classified from the single source of truth (data/activities.json), so old entries
  // that were saved with explicit names / the old "necessity" type are shown correctly too.
  // each journal is shown under the archetype it was written in (older ones have none = radical)
  const tasks = (o.tasks || []).map((t) => presentTask(t, o.archetype));
  const day = computeDay(tasks);
  return {
    _id: o._id,
    id: o._id,
    player: o.player,
    date: o.date,
    archetype: archetypes.norm(o.archetype),
    // rawText (the written journal entry) is deliberately NOT sent: past entries are not viewable in the app.
    tasks,
    signal_to_noise_ratio: day.ratio,
    signalMinutes: day.signalMinutes,
    noiseMinutes: day.noiseMinutes,
    necessityMinutes: day.necessityMinutes,
    points: day.points,
    totalPoints: day.totalPoints,
    createdAt: o.createdAt,
  };
}

// A real calendar date in YYYY-MM-DD form (rejects 2026-02-31).
function isRealDate(s) {
  if (!DATE_RE.test(s || '')) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// The server does not know the player's time zone, so a date only counts as "future"
// if it is ahead of the earliest "today" anywhere on Earth (UTC+14).
function isFutureDate(s, now = new Date()) {
  const limit = new Date(now.getTime() + 14 * 3600 * 1000).toISOString().slice(0, 10);
  return s > limit;
}

const todayUTC = (now = new Date()) => now.toISOString().slice(0, 10);

module.exports = { parseClock, fmtClock, fmtRange, presentTask, displayDuration, STATS, DATE_RE, MONTH_RE, DAY_MINUTES, parseMinutes, checkDay, computeDay, journalView, isRealDate, isFutureDate, todayUTC };
