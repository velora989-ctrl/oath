# Mira's Grove – Backend

Express + MongoDB + Groq.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in `MONGODB_URI`, `JWT_SECRET`, `GROQ_API_KEY`.
3. `data/emojis.json` currently holds the 5 icons found in your design (eat, study, game, boot, sleep) in `public/emojis/`. Add more icons there, with a name and a URL each, so the model has more to choose from. Keep exactly one `"default": true` (used if the model returns an unknown URL).
4. `npm start`

The frontend is already included: `public/index.html` is your exported design, patched to use this backend. The server serves it at `/`, so there is nothing else to host and no CORS to deal with. Open http://localhost:3000.

## API
| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | no | `{name,email,password}` -> `{token, player}` |
| POST | /api/auth/login | no | `{email,password}` -> `{token, player}` |
| GET | /api/auth/me | yes | own player |
| GET | /api/players | no | all players, ranked by total points |
| GET | /api/players/:id | no | one player (stats are public) |
| GET | /api/players/:id/journals | no | a player's journals, newest day first (`?date=YYYY-MM-DD` for one day) |
| GET | /api/players/:id/journal/:date | no | that player's journal for one day, or `{journal: null}` |
| GET | /api/players/:id/calendar?month=YYYY-MM | no | every day of the month that has a journal: signal/noise ratio, points gained, tasks (no journal text) |
| POST | /api/journals | yes | `{text, date?}` -> Groq analysis, saved, stats updated. **One per day**: a second one for the same day gets `409` |
| DELETE | /api/journals/:id | yes (owner) | delete journal and take back its points (this is also how you "rewrite" a day) |
| GET | /api/emojis | no | the emoji catalogue |

Anyone can read any player's data (including past days); only the logged-in player can add or delete their own journals. Stats are only changed by journals.

## One journal per day, signal vs noise
- A player has at most **one journal per date** (unique index on `player + date`). Writing for a past day that is still empty is allowed; writing for a future day is refused. Once a day is saved it is locked.
- Only deliberate **tasks** are `signal` (studying, coding, training, skill practice, meditation, real work...). Everything else is `noise`: eating, sleeping/rest, school/college attendance, chatting or talking to a girl/friends, video games, scrolling, etc. There is no "necessity" type any more (old entries are shown as noise). Edit the rules in `prompts/journalPrompt.txt`.
- The **signal/noise ratio** is calculated by the server from the task durations (`services/dayStats.js`), not by the model: signal minutes / (signal + noise minutes). If a duration is unknown, 30 min is assumed.
- Points only come from signal tasks, as before (single stat per task, max 8).
- **Already have data?** Run `node scripts/merge-duplicate-days.js` (dry run) and then with `--apply` once. It keeps the newest journal of each day and takes the points of the removed ones back. MongoDB cannot build the one-per-day index while duplicates exist.

## Journal document
```json
{
  "date": "2026-10-14",
  "rawText": "...",
  "tasks": [{ "emoji": "url", "name": "Morning Gym Session", "type": "signal", "duration": "1 h",
              "points": { "int": 0, "end": 0, "str": 5, "arc": 0, "wis": 0 } }],
  "signal_to_noise_ratio": 0.2,
  "signalMinutes": 180, "noiseMinutes": 720,
  "points": { "int": 7, "end": 0, "str": 5, "arc": 0, "wis": 0 }, "totalPoints": 12
}
```
The model only returns `tasks`. The server validates them: unknown emoji URLs fall back to the default, noise always gets 0 points, signal tasks keep only their strongest stat, capped at 8. Everything else in the document is derived from the tasks.

## Frontend
`public/index.html` is generated from your design export by `tools/build_frontend.py`. When you re-export the design from your tool, rebuild with:

    python3 tools/build_frontend.py "path/to/Mira's Grove.html"

The script patches the export (anchored edits, fails loudly if the design changed too much) and writes `public/index.html`. The day navigation and calendar live in `tools/journal_block.js` (journal page), `tools/glue.js` (loading data, switching players) and `tools/auth.css` (styles). What it changes:
- "Edit Stats" button and panel removed; that slot is now a "Log out" button. Stats only change through journals.
- Login / register panel in the same parchment style. Name is limited to 16 characters (the stats panel is small).
- Left stats panel shows the logged-in player (Mira portrait). The top card on the right shows another player; click it again to cycle through all players. Stats, level and title come from the server.
- Journal page: shows the viewed player's journal for the date in the date field. Change the date by typing it (dd/mm/yyyy), with the `<` `>` buttons, or with the **Calendar** button. Opening the journal always starts on today.
- One entry per day: an empty day you may write on is editable (unsent text is remembered per day). A saved day is locked and shows the saved text, the signal/noise pie, the points of that day (Growth) and the activity log.
- **Calendar**: a parchment panel with the month. Days with a journal show the points gained and a small green/red signal/noise bar. Click a day to see its signal/noise ratio, points gained and every task; "Open this journal" jumps to that day (double-click a day does the same). Future days are greyed out.
- **Other players**: the player cards at the top right stay clickable while the journal is open. Click the other player's card (again to cycle through everyone) and the journal, calendar and every past day switch to that player, read-only.
- Level is computed on the server from total points (`THRESHOLDS`/`TITLES` in `models/Player.js`).
- The pie shows the day's signal/noise ratio (computed by the server from the task durations).
