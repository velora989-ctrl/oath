// npm run check:groq  - reads .env and makes one tiny real call to Groq, so you know the key and model work.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { chat, getKey, getModels } = require('../services/groqClient');

(async () => {
  if (!getKey()) { console.error('GROQ_API_KEY is missing in .env'); process.exit(1); }
  console.log('Models to try:', getModels().join(', '));
  try {
    const t0 = Date.now();
    const out = await chat({ system: 'Reply with JSON only.', user: 'Return {"ok":true}', json: true, maxTokens: 500, timeoutMs: 20_000 });
    console.log(`Groq works (${Date.now() - t0} ms):`, out.trim());
  } catch (e) {
    console.error('Groq check failed:', e.message, e.detail ? `\n${e.detail}` : '');
    process.exit(1);
  }
})();
