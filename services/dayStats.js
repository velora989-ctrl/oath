// Pure helpers for "one journal per day": dates, durations, signal/noise ratio and daily points.
// No database or network access in here, so it is easy to test.

const STATS = ['int', 'end', 'str', 'arc', 'wis'];
const DEFAULT_MINUTES = 30; // used when the player did not say how long something took
const MAX_TASK_MINUTES = 24 * 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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

// Only "signal" counts as signal. Everything else (including legacy "necessity") is noise.
const taskType = (t) => (t && t.type === 'signal' ? 'signal' : 'noise');

function computeDay(tasks) {
  const points = { int: 0, end: 0, str: 0, arc: 0, wis: 0 };
  let signalMinutes = 0;
  let noiseMinutes = 0;
  for (const t of tasks || []) {
    const minutes = parseMinutes(t.duration);
    if (taskType(t) === 'signal') signalMinutes += minutes;
    else noiseMinutes += minutes;
    for (const k of STATS) points[k] += (t.points && t.points[k]) || 0;
  }
  const total = signalMinutes + noiseMinutes;
  const ratio = total ? Math.round((signalMinutes / total) * 1000) / 1000 : 0.5;
  const totalPoints = STATS.reduce((sum, k) => sum + points[k], 0);
  return { signalMinutes, noiseMinutes, ratio, points, totalPoints };
}

// What the API sends for one journal. Derived numbers are always recomputed from the tasks.
function journalView(doc) {
  const o = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const tasks = (o.tasks || []).map((t) => ({ ...t, type: taskType(t) }));
  const day = computeDay(tasks);
  return {
    _id: o._id,
    id: o._id,
    player: o.player,
    date: o.date,
    rawText: o.rawText,
    tasks,
    signal_to_noise_ratio: day.ratio,
    signalMinutes: day.signalMinutes,
    noiseMinutes: day.noiseMinutes,
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

module.exports = { STATS, DATE_RE, MONTH_RE, parseMinutes, computeDay, journalView, isRealDate, isFutureDate, todayUTC };
