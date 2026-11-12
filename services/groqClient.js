// One place that talks to Groq, used by the journal analysis (services/groq.js) and the boss-name
// "Suggest" button (routes/names.js). Everything comes from .env:
//   GROQ_API_KEY   required
//   GROQ_MODEL     optional, comma-separated fallback list (default below)
//   GROQ_BASE_URL  optional, only for testing against a local mock

const DEFAULT_MODELS = 'openai/gpt-oss-120b,openai/gpt-oss-20b';
const BASE_URL = () => (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');

// .env values sometimes carry quotes or stray spaces; strip them so the key still works
const clean = (v) => String(v == null ? '' : v).trim().replace(/^['"]+|['"]+$/g, '').trim();

const getKey = () => clean(process.env.GROQ_API_KEY);
const getModels = () => {
  const list = clean(process.env.GROQ_MODEL || DEFAULT_MODELS).split(',').map(clean).filter(Boolean);
  return list.length ? list : DEFAULT_MODELS.split(',');
};

// A short, human-readable reason for the common Groq failures
function explain(status) {
  if (status === 401 || status === 403) return 'Groq rejected GROQ_API_KEY - check the key in .env';
  if (status === 429) return 'Groq rate limit reached - wait a moment and try again';
  if (status >= 500) return 'Groq is having trouble right now - try again shortly';
  return `Groq error ${status}`;
}

// A bad / retired model name comes back as 404, or as 400 mentioning the model: then the next model is tried.
const isModelProblem = (err) =>
  err.status === 404 || (err.status === 400 && /model/i.test(err.detail || ''));

async function callModel(model, key, { messages, temperature, maxTokens, json, reasoningEffort, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = {
      model,
      temperature,
      max_completion_tokens: maxTokens,
      messages,
    };
    if (reasoningEffort && /gpt-oss/i.test(model)) body.reasoning_effort = reasoningEffort; // only gpt-oss understands it
    if (json) body.response_format = { type: 'json_object' };

    let res;
    try {
      res = await fetch(`${BASE_URL()}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
    } catch (e) {
      const err = new Error(e.name === 'AbortError' ? `Groq timed out (${model})` : `Could not reach Groq: ${e.message}`);
      err.status = 0;
      throw err;
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      const err = new Error(`${explain(res.status)} (${model})`);
      err.status = res.status;
      err.detail = detail;
      throw err;
    }

    const data = await res.json();
    const choice = data.choices && data.choices[0];
    const text = choice && choice.message && choice.message.content;
    if (!text || !String(text).trim()) {
      const err = new Error(`Groq sent an empty answer (${model}, finish=${choice && choice.finish_reason})`);
      err.status = 0;
      err.empty = true;
      throw err;
    }
    return String(text);
  } finally {
    clearTimeout(timer);
  }
}

// chat({ system, user, temperature, maxTokens, json, reasoningEffort, timeoutMs }) -> the model's text
async function chat({ system, user, temperature = 0.3, maxTokens = 2000, json = false, reasoningEffort = 'low', timeoutMs = 60_000 }) {
  const key = getKey();
  if (!key) {
    const err = new Error('GROQ_API_KEY is not set in .env');
    err.status = 503;
    throw err;
  }
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  let lastErr;
  for (const model of getModels()) {
    try {
      return await callModel(model, key, { messages, temperature, maxTokens, json, reasoningEffort, timeoutMs });
    } catch (err) {
      lastErr = err;
      if (!isModelProblem(err)) throw err; // key / rate-limit / network problems will not be fixed by another model
      console.warn(`Groq model ${model} unavailable (${err.status}), trying the next one`);
    }
  }
  throw lastErr;
}

module.exports = { chat, getKey, getModels };
