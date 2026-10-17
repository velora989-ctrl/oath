// The emoji (image) catalogue: data/emojis.json, generated from your images by tools/build_emojis.py.
//
// Which image a task gets, in order:
//   1. Unknown activities  -> the private "unknown" image (always, nothing else can change it)
//   2. listed activities   -> the fixed `image` in data/activities.json (school, gym, sleep, ...)
//   3. the model's pick    -> it answers with an image KEY from the catalogue below (a URL is accepted too)
//   4. keyword match       -> words in the task name against each image's names ("homework", "anime", ...)
//   5. the default image   -> the entry marked "default" in data/emojis.json
// Images marked "private" are never offered to the model and never picked by keywords.

const catalogue = require('../data/emojis.json');

const ITEMS = catalogue.map((e) => ({
  key: String(e.key),
  url: e.url,
  names: e.names && e.names.length ? e.names : [e.name || e.key],
  keywords: (e.keywords && e.keywords.length ? e.keywords : [e.name || e.key]).map((k) => String(k).toLowerCase()),
  isPrivate: !!e.private,
  isDefault: !!e.default,
}));

const byKey = new Map(ITEMS.map((i) => [i.key.toLowerCase(), i]));
const byUrl = new Map(ITEMS.map((i) => [i.url, i]));
const PUBLIC_ITEMS = ITEMS.filter((i) => !i.isPrivate);

const defaultItem = ITEMS.find((i) => i.isDefault && !i.isPrivate) || PUBLIC_ITEMS[0] || ITEMS[0];
const privateItem = ITEMS.find((i) => i.isPrivate) || defaultItem;

const defaultUrl = defaultItem.url;
const privateUrl = privateItem.url;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// one regex per image: any of its keywords as a whole word (a plural / "ing" ending is fine: game, games, gaming)
const matchers = PUBLIC_ITEMS.map((item) => ({
  item,
  res: item.keywords.map((k) => ({ len: k.length, re: new RegExp(`\\b${esc(k).replace(/\s+/g, '\\s+')}(?:s|es|ing)?\\b`, 'i') })),
}));

// The image a task NAME points to ("Math homework" -> study_school), or null. The longest matching keyword wins.
function byName(name) {
  const n = String(name || '');
  let best = null;
  for (const m of matchers) {
    for (const r of m.res) {
      if (r.re.test(n) && (!best || r.len > best.len)) best = { len: r.len, item: m.item };
    }
  }
  return best ? best.item : null;
}

// What the model wrote in the `emoji` field: an image key ("gym") or one of the catalogue URLs. Private images are not allowed.
function fromModel(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  const item = byKey.get(v.toLowerCase()) || byUrl.get(v) || null;
  return item && !item.isPrivate ? item : null;
}

// Image for a NEW task (the model's pick -> keywords -> default). Returns a URL.
function pick({ modelValue, name }) {
  const item = fromModel(modelValue) || byName(name) || defaultItem;
  return item.url;
}

// Image for an OLD saved task. Its stored URL is kept when it is still in the catalogue; entries saved with the
// old placeholder icons (eat.png, walk.png...) get a new image from their name instead.
function reuse({ stored, name }) {
  const item = byUrl.get(stored);
  if (item && !item.isPrivate) return item.url;
  return (byName(name) || defaultItem).url;
}

// The list the AI model sees: "- gym: gym, calisthenics, physical exercise"
function promptCatalogue() {
  return PUBLIC_ITEMS.map((i) => `- ${i.key}: ${i.names.join(', ')}`).join('\n');
}

module.exports = { ITEMS, defaultUrl, privateUrl, byName, fromModel, pick, reuse, promptCatalogue };
