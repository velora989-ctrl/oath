// Drop-in API client for the Mira's Grove frontend.
// Include BEFORE app.js:  <script src="api.js"></script>
// If the frontend is served by a different origin than the backend, set API_BASE to e.g. 'http://localhost:3000'.
(function () {
  const API_BASE = '';
  window.GROVE_API_BASE = API_BASE; // other scripts (e.g. the boss-name Suggest) use the same server address
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

    // the notice boards (Reminders tab). A player keeps several named boards; everybody can read them, only the owner can change them.
    // getBoards(playerId) -> [{ id, name, count, updatedAt }]; getBoard(boardId) -> { id, name, papers, updatedAt }
    getBoards: (playerId) => request('GET', `/api/board/list/${playerId}`).then((d) => d.boards),
    getBoard: (boardId) => request('GET', `/api/board/b/${boardId}`).then((d) => d.board),
    createBoard: (name) => request('POST', '/api/board/b', { name }).then((d) => d.board),
    saveBoard: (boardId, papers) => request('PUT', `/api/board/b/${boardId}`, { papers }),
    renameBoard: (boardId, name) => request('PUT', `/api/board/b/${boardId}`, { name }).then((d) => d.board),
    deleteBoard: (boardId) => request('DELETE', `/api/board/b/${boardId}`),
    // the Holidays tab: your own changes to the school calendar. getHolidays() -> [{ d: 'YYYY-MM-DD', h: 1|2|0, n }]; saveHolidays(list) replaces them.
    // (Named differently from getCalendar(id, month) above, which is the journal's calendar: two methods with the same name overwrote each other.)
    getHolidays: () => request('GET', '/api/calendar').then((d) => d.days),
    saveHolidays: (days) => request('PUT', '/api/calendar', { days }).then((d) => d.days),
    // the Day Book's to-dos and notes: getCalNotes() -> [{ d, n, t: [{ x, d }] }]; saveCalNotes(list) replaces them
    getCalNotes: () => request('GET', '/api/calendar/notes').then((d) => d.notes),
    saveCalNotes: (notes) => request('PUT', '/api/calendar/notes', { notes }).then((d) => d.notes),
    // the Creators Museum (Patch button): your own creators, videos and timestamps. getMuseum() -> [creator]; saveMuseum(list) replaces them.
    // museumInfo(videoId) -> { title, author, dur, chapters }; museumPlaylist(listId) -> { title, items } (needs YOUTUBE_API_KEY on the server)
    getMuseum: () => request('GET', '/api/museum').then((d) => d.creators),
    saveMuseum: (creators) => request('PUT', '/api/museum', { creators }),
    // the Bosses button: your goals as bosses and the Hall of Fame. getBosses() -> { list, hall }; saveBosses({ list, hall }) replaces them
    getBosses: () => request('GET', '/api/bosses'),
    saveBosses: (data) => request('PUT', '/api/bosses', data),
    // look at another player's bosses (read-only): getPlayerBosses(playerId) -> { list, hall }
    getPlayerBosses: (id) => request('GET', `/api/bosses/player/${id}`),
    // reel & video folders (the folder level next to the castle on the level map): getFolders() -> [folder]; saveFolders(list) replaces them
    getFolders: () => request('GET', '/api/museum/folders').then((d) => d.folders),
    saveFolders: (folders) => request('PUT', '/api/museum/folders', { folders }),
    museumInfo: (id) => request('GET', `/api/museum/info/${id}`),
    museumPlaylist: (id) => request('GET', `/api/museum/playlist/${id}`),
    museumReel: (code) => request('GET', `/api/museum/reel/${code}`),
    // pin a picture: upload the (already shrunk) image, get its id back
    async uploadBoardImage(blob) {
      const res = await fetch(API_BASE + '/api/board/images', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'application/octet-stream', Authorization: `Bearer ${getToken()}` },
        body: blob,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      return data;
    },
    // folder photos: the ORIGINAL file is uploaded untouched and shown exactly as it is
    async uploadMuseumPhoto(file) {
      const res = await fetch(API_BASE + '/api/museum/photos', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream', Authorization: `Bearer ${getToken()}` },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      return data;
    },
    museumPhotoUrl: (id) => `${API_BASE}/api/museum/photos/${id}`,
    deleteMuseumPhoto: (id) => fetch(API_BASE + `/api/museum/photos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } }).catch(() => {}),
    boardImageUrl: (id) => `${API_BASE}/api/board/images/${id}`,
  };
})();
