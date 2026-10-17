// Drop-in API client for the Mira's Grove frontend.
// Include BEFORE app.js:  <script src="api.js"></script>
// If the frontend is served by a different origin than the backend, set API_BASE to e.g. 'http://localhost:3000'.
(function () {
  const API_BASE = '';
  const TOKEN_KEY = 'grove_token';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

  async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(API_BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) setToken(null); // expired/invalid token
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  window.GroveAPI = {
    isLoggedIn: () => !!getToken(),
    logout: () => setToken(null),

    async register(name, email, password) {
      const d = await request('POST', '/api/auth/register', { name, email, password });
      setToken(d.token);
      return d.player;
    },
    async login(email, password) {
      const d = await request('POST', '/api/auth/login', { email, password });
      setToken(d.token);
      return d.player;
    },
    me: () => request('GET', '/api/auth/me').then((d) => d.player),

    // public reads (work without logging in)
    getPlayers: () => request('GET', '/api/players').then((d) => d.players),
    getPlayer: (id) => request('GET', `/api/players/${id}`).then((d) => d.player),
    getPlayerJournals: (id, opts = {}) => {
      const q = new URLSearchParams({ limit: opts.limit || 30 });
      if (opts.date) q.set('date', opts.date); // YYYY-MM-DD
      return request('GET', `/api/players/${id}/journals?${q}`).then((d) => d.journals);
    },
    // one day's journal: { ... } or null if nothing was written that day
    getJournalByDate: (id, date) => request('GET', `/api/players/${id}/journal/${date}`).then((d) => d.journal),
    // calendar overview of one month (YYYY-MM): [{ date, ratio, signalMinutes, noiseMinutes, points, totalPoints, tasks }]
    getCalendar: (id, month) => request('GET', `/api/players/${id}/calendar?month=${month}`),
    getCharacters: () => request('GET', '/api/characters').then((d) => d.characters),
    // pick your character (once, from the ones nobody has); resolves to the updated player
    chooseCharacter: (character) => request('POST', '/api/auth/character', { character }).then((d) => d.player),
    // the archetypes (liberal = easy, radical = hard) with their simple-language descriptions
    getArchetypes: () => request('GET', '/api/archetypes').then((d) => d.archetypes),
    // pick your archetype (once); resolves to the updated player
    chooseArchetype: (archetype) => request('POST', '/api/auth/archetype', { archetype }).then((d) => d.player),
    getEmojis: () => request('GET', '/api/emojis').then((d) => d.emojis),

    // authenticated writes (own data only)
    // resolves to { journal: { tasks, signal_to_noise_ratio, points, ... }, gained, player }
    // one journal per day: a second one for the same day is rejected with an error
   
    submitJournal: (text, date) => request('POST', '/api/journals', { text, date }),
    deleteJournal: (id) => request('DELETE', `/api/journals/${id}`),
  };
})();
