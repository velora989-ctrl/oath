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

// Three kinds: "signal" (a real task), "necessity" (sleep) and "noise" (everything else).
// Necessities are left out of the signal/noise ratio, because they are not a choice.
const taskType = (t) => (t && (t.type === 'signal' || t.type === 'necessity') ? t.type : 'noise');

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
const fmtMinutes = (n) => {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

// null when the day is fine, otherwise a message for the player.
function checkDay(tasks) {
  const example = 'for example "8 hours sleep, 2 hours games, 3 hours study"';
  const missing = (tasks || []).filter((t) => !hasDuration(t.duration));
  if (missing.length) {
    const names = missing.slice(0, 3).map((t) => `"${t.name}"`).join(', ');
    return `Say how long each thing took, ${example}. No duration found for ${names}${missing.length > 3 ? ' and more' : ''}.`;
  }
  const total = (tasks || []).reduce((sum, t) => sum + parseMinutes(t.duration), 0);
  if (total === DAY_MINUTES) return null;
  const diff = Math.abs(DAY_MINUTES - total);
  return total < DAY_MINUTES
    ? `Your day adds up to ${fmtMinutes(total)}, but a day has 24h: ${fmtMinutes(diff)} missing. Define every hour, ${example}.`
    : `Your day adds up to ${fmtMinutes(total)}, but a day has 24h: ${fmtMinutes(diff)} too many. Define every hour, ${example}.`;
}

function computeDay(tasks) {
  const points = { int: 0, end: 0, str: 0, arc: 0, wis: 0 };
  let signalMinutes = 0;
  let noiseMinutes = 0;
  let necessityMinutes = 0;
  for (const t of tasks || []) {
    const minutes = parseMinutes(t.duration);
    const type = taskType(t);
    if (type === 'signal') signalMinutes += minutes;
    else if (type === 'necessity') necessityMinutes += minutes;
    else noiseMinutes += minutes;
    for (const k of STATS) points[k] += (t.points && t.points[k]) || 0;
  }
  const total = signalMinutes + noiseMinutes; // necessities (sleep) are not part of the ratio
  const ratio = total ? Math.round((signalMinutes / total) * 1000) / 1000 : 0.5;
  const totalPoints = STATS.reduce((sum, k) => sum + points[k], 0);
  return { signalMinutes, noiseMinutes, necessityMinutes, ratio, points, totalPoints };
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

module.exports = { STATS, DATE_RE, MONTH_RE, DAY_MINUTES, parseMinutes, checkDay, computeDay, journalView, isRealDate, isFutureDate, todayUTC };
