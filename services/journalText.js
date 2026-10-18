// Turns what the player typed into ONE paragraph before it is saved or sent to the AI.
// Every line break (Enter key) becomes ". " so the model never sees "\n" noise and reads one continuous text.
//   "7am wake up\n8am gym\n\n9am school"  ->  "7am wake up. 8am gym. 9am school"
// A line that already ends with . ! ? ; or : keeps its own punctuation (no ".." or ":.").
function flattenJournal(text) {
  const lines = String(text == null ? '' : text)
    .replace(/\\r\\n|\\n|\\r/g, '\n') // a literal backslash-n typed or pasted as text counts as a line break too
    .split(/\r\n|\r|\n|\u2028|\u2029/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean); // empty lines are dropped

  let out = '';
  lines.forEach((line, i) => {
    out += line;
    if (i === lines.length - 1) return;
    out += /[.!?;:]$/.test(line) ? ' ' : '. ';
  });
  return out;
}

module.exports = { flattenJournal };
