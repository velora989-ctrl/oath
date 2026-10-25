# Mira's Grove – Backend

Express + MongoDB + Groq.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in `MONGODB_URI`, `JWT_SECRET`, `GROQ_API_KEY`.
3. The activity images live in `public/emojis/` and are listed in `data/emojis.json`. Both are generated from your source images by `python3 tools/build_emojis.py "path/to/emojis_renamed"` (needs `pip install pillow`); see "Activity images" below. The generated files are already included.
4. `npm start`

The frontend is already included: `public/index.html` is your exported design, patched to use this backend. The server serves it at `/`, so there is nothing else to host and no CORS to deal with. Open http://localhost:3000.

## API
| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | no | `{name,email,password}` -> `{token, player}`. Once `MAX_PLAYERS` (default 6) people exist: `403` "The Grove is full. Talk to the admins to get your spot." |
| POST | /api/auth/login | no | `{email,password}` -> `{token, player}` |
| POST | /api/auth/character | yes | `{character}` -> `{player}`. Chosen once, from the characters nobody has (`409` if taken or already chosen) |
| GET | /api/characters | no | every character with `taken: true/false` |
| POST | /api/auth/archetype | yes | `{archetype: "liberal"\|"radical"} (Tarnished / Elden Lord)` -> `{player}`. Chosen once (`409` if already chosen) |
| GET | /api/archetypes | no | the archetypes with their simple-language descriptions (shown while registering) |
| GET | /api/auth/me | yes | own player |
| GET | /api/players | no | all players, ranked by total points |
| GET | /api/players/:id | no | one player (stats are public) |
| GET | /api/players/:id/journals | no | a player's days (tasks, ratio, points - no entry text), newest first (`?date=YYYY-MM-DD` for one day) |
| GET | /api/players/:id/journal/:date | no | that player's day (no entry text), or `{journal: null}` |
| GET | /api/players/:id/calendar?month=YYYY-MM | no | every day of the month that has a journal: signal/noise ratio, points gained, tasks (no journal text) |
| POST | /api/journals | yes | `{text, date?}` -> Groq analysis, saved, stats updated. **One per day**: a second one for the same day gets `409` |
| DELETE | /api/journals/:id | yes (owner) | delete journal and take back its points (this is also how you "rewrite" a day) |
| GET | /api/emojis | no | the emoji catalogue |

Anyone can read any player's data (including past days); only the logged-in player can add or delete their own journals. Stats are only changed by journals.

## Players and characters
- The Grove holds at most `MAX_PLAYERS` people (default 6, set in `.env`). Anyone else who tries to register gets "The Grove is full. Talk to the admins to get your spot." Existing players can always log in. To make room or to let someone in, change `MAX_PLAYERS` or delete a player in MongoDB.
- Characters live in `data/characters.json` (images in `public/characters/`): Mira, The Crimson Lord (the red-coated man, formerly Pip), The Dice Lord, The Scholar, The Noble, The Duchess. (Pip is still the little sprite on the map tiles.) Keep at least as many as `MAX_PLAYERS`. To add one, drop the image in `public/characters/` and add a row.
- Right after registering, the player picks a character nobody else has (then an archetype, see "Archetypes") (taken ones are greyed out). A player without a character (for example one who registered before this existed) gets the same picker at the next login. Two players can never share a character (unique index on `character`).
- When the site opens, the player's own character is shown first (portrait in the stats panel and the small icon on the first player card); the second card shows the player you are looking at.

## Task names
A task name is at most 30 characters (`maxNameLength` in `data/activities.json`; the server cuts longer ones at a word boundary and the model is told the limit). The activity log shows the whole name: the text gets smaller and, if needed, goes on two lines instead of being cut with "...".

## Task names and hover descriptions
- **Name** (activity log): 2-5 words, Title Case, max 30 characters, in the player's own words and saying what was really done ("Business Podcast", "Podcast On Commute"). The naming rules are in `prompts/journalPrompt.txt` (NAMING). Listed activities are now named by the model too; the label in `data/activities.json` ("YouTube podcast") is only the fallback when the model's name is empty or a placeholder like "Activity". Sleep keeps the name "Sleep" and Unknown activities keep "Unknown".
- **Description**: one short sentence (max 140 characters, `maxDescriptionLength` in `data/activities.json`) of what the player did, saved with each task as `description`. In the browser, hovering a task name (activity log and calendar day list) shows the name and its description. Old days have no description and show the name only.
- Privacy: Unknown tasks and any description containing a private word get an empty description on the server, so it can never leak through the hover text.

## Signal, Noise and Unknown (one source of truth)
`data/activities.json` is the ONLY place that decides how a listed activity is classified. It has the 20 definitive activities with two fields each:
- `journal` - what the journal UI shows: **Signal**, **Noise** or **Unknown**.
- `tracking` - what every ratio, total, chart, percentage and AI prompt counts: **Signal**, **Noise** or **Necessity** (sleep only, see below).

Unknown activities (Gooning, Writing, Masturbation / self-pleasure) keep the name **"Unknown"** and the neutral image, but they are **Noise**: red marker in the activity log, red "Noise" badge in the calendar, red part of the pie, and they **always count as Noise** in the maths (`services/activities.js` forces `tracking = Noise` for any Unknown row, even if the JSON said otherwise). To keep them private the app never stores or sends *which* of them it was: all three are saved as one neutral `Unknown` activity with the neutral `unknown` image.

Other rules from the spec: school, tuition and studying for school are Noise; personal-growth study, business videos, podcasts, fiction / non-fiction books and the gym are Signal; **sleep is a Necessity** (see "Sleep" below). Old non-sleep "necessity" entries are read as Noise.

How it flows:
- The model is given the activity list and returns an `activity` id for each task. The **server** then forces the signal/noise class and points rules from the JSON (and the name for sleep and Unknown) - the model's own signal/noise guess is ignored for listed activities. Activities that are not on the list (coding, guitar practice, a video game...) use the id `other` and keep the model's signal/noise judgement (rules in `prompts/journalPrompt.txt`).
- Explicit private words are swapped for the neutral phrase "personal time" before the text goes to the model (`unknownTerms` in the JSON), so the model never sees them and never refuses.
- Old saved entries are re-labelled when they are read (`presentTask` in `services/dayStats.js`), so past "Private Time" rows show as Unknown without touching the database. Points already granted are never recalculated.
- The signal/noise ratio is calculated by the server from the task durations: signal minutes / (signal + noise minutes). **Sleep is not part of it**: only the hours left after sleep are the total. If a duration is unknown, 30 min is assumed. Points only come from Signal tasks: a task can earn points in several stats, max 8 in total per task (see "Points and stats").

To change a classification, edit the row in `data/activities.json`. Nothing else needs to change.

## Journal text
Every line break (Enter) in the journal becomes `". "` and the entry is saved and sent to the AI as ONE paragraph (`services/journalText.js`). A line that already ends in `. ! ? ; :` keeps its own punctuation, and empty lines are dropped.

## Points and stats
- A signal task can earn points in **several** stats when the block really holds different kinds of effort (gym + cooking = STR + ARC). The total of one task is at most 8 (scaled down together if the model goes over); splitting never gives extra points.
- **Mixed blocks**: if one block combines signal and noise (podcast while commuting), the signal part wins: the block is Signal, named and scored after the signal part (podcast = INT).
- Stat definitions (also in `prompts/journalPrompt.txt`):

| Stat | What earns it |
|---|---|
| INT | consuming meaningful content (philosophy, business, self-improvement) in any form: books, videos, podcasts, studying |
| STR | anything physical: gym, running, sports, yoga |
| ARC | anything creative: singing, music, painting, drawing, cooking |
| END | meaningful action and execution: shooting/editing videos, building websites, projects, writing scripts, researching |
| WIS | only meditation and self-reflection |

- Listed activities carry a `stat` in `data/activities.json` (podcast / business video / books / study for growth = int, gym = str, shorts creation = end). If the AI scores one of them in a different stat, the server moves its points to the right one (`services/groq.js`).
- Writing a script / plan / code for a project is real work (END), not the private listed "writing" activity.

## Archetypes (Tarnished / Elden Lord)
Registration has three steps: account -> **character** -> **archetype**. An archetype is a rule set that decides what is Signal and what is Noise for that player. It is chosen once and cannot be changed (`409`), like the character.

| Archetype | Mode | Meaning |
|---|---|---|
| `liberal` = **Tarnished** | easy | Everything except distractions is Signal. School, institutions, studying, chores, meals, exercise... are Signal. Scrolling, web series, video games and other time-wasters are Noise. |
| `radical` = **Elden Lord** | hard | The configuration the site had before archetypes existed (`data/activities.json` exactly as it is): only growth is Signal; school, tuition, chores, meals, resting, games, scrolling and series are Noise. |

- Everything lives in `data/archetypes.json` (`services/archetypes.js` loads and checks it at start-up). Every archetype has the same fixed blocks: `key`, `name`, `mode`, `display` (registration screen texts: summary, signal, noise), `counting` (`overrides`: listed activities that flip to Signal, by id; `noPoints`: routine basics, Signal for the ratio but 0 points) and `prompt` (`signal`, `noise`, `notes[]`, built into `{{ARCHETYPE_RULES}}` in `prompts/journalPrompt.txt`). Radical has no overrides, so it behaves exactly as before.
- Sleep stays a Necessity and the private **Unknown** activities stay Noise in every archetype.
- `data/activities.json` is still the single source of truth for the listed activities; an archetype only overrides the ids it names. `classify(..., archetype)` in `services/activities.js` applies it.
- Players who have no archetype (registered before this existed) count as **radical** and get the picker at their next login. Every journal stores the archetype it was written in (`Journal.archetype`), so a saved day is always shown the way it was counted.
- To change the descriptions, the liberal list or the points rule, edit `data/archetypes.json`. Nothing else needs to change.

## Sleep (necessity)
Sleep is the only **Necessity** activity (`data/activities.json`, row 10).
- It is **not shown in the activity log** (journal page). It is shown **only in the calendar**: in the selected day's task list (blue "Necessity" badge) and as `N sleep (not counted)` under the signal/noise bar.
- It is **left out of the signal/noise ratio and the pie**: ratio = signal / (signal + noise), where signal + noise are the hours left after sleep.
- It still counts towards the 24h check (a day must add up to 24h, sleep included), earns no points, and old entries named sleep / slept / nap are read as Necessity too (no database change needed).
- API: each journal / calendar day has `necessityMinutes` next to `signalMinutes` and `noiseMinutes`; sleep stays in `tasks` with `type: "necessity"`, `category: "Necessity"` (the browser hides it from the log).
- The AI prompt (`prompts/journalPrompt.txt`) tells the model to log sleep as its own task (`activity: "sleep"`, `type: "necessity"`).

## Activity images
Every task in the activity log and the calendar gets an image. Which one, in order:
1. **Unknown activities** always get the private `unknown` image (the model never sees or picks it).
2. **Listed activities** use the fixed `image` of their row in `data/activities.json` (school, wake up, morning routine, breakfast, bath, tuition and study for school share `study_school`, study for growth and both book types share the reading image, sleep, both YouTube rows share `yt_business`, dinner, park, gym). `rest` has no image yet.
3. **Everything else** (coding, guitar, games...): the model answers with an image **key** from the catalogue in the prompt (`emoji` field, e.g. `coding`).
4. If the model's pick is missing or invalid, the words in the task name are matched against each image's names ("homework" -> `study_school`, "anime" -> `series`; `services/emojis.js`).
5. Otherwise the default image (`project`, the entry with `"default": true`).

Old saved entries are re-imaged when they are read, so entries saved with the old placeholder icons get the right image too (no database change).

**Adding / renaming images.** Name each source file after what it shows; one image can serve several activities: `gym, calisthenics, physical exercise.png`. The first name becomes its key (`gym`). Text in brackets, e.g. `making notes(Except academics)`, is shown to the model but not used for keyword matching. Then run `python3 tools/build_emojis.py "folder"`: it trims the empty space around each icon, makes it square (256x256, transparent) and rewrites `public/emojis/` and `data/emojis.json`. To pin an image to a listed activity, set `"image": "/emojis/<key>.png"` on its row in `data/activities.json`. The prompt (`prompts/journalPrompt.txt`, sections 4 and 5) lists the images and the activity ids for the model.

## Past journal entries are hidden
The app only shows **charts** (the signal/noise pie, the calendar bars) and the **activity log**. The text of a saved entry is never shown and the API no longer sends `rawText` at all; it stays in the database for the record. You can still write today's entry (or an empty past day), and the day arrows / calendar still switch between days to show that day's chart and activity log.

## Durations are shown as hours and minutes
Everything is displayed as `30min`, `1hr`, `1hr 30min`, `3hr 30min`... (activity log, calendar, error messages). The format lives in one function, `fmtMins` in `services/dayStats.js`, and `fmtMin` in `tools/journal_block.js` for the browser. The server converts old `90 mins` / `1.5 h` style values when it reads them; the calculations always used minutes and are unchanged.

## Every hour must be defined
A journal is refused (400, nothing saved, no points) unless every activity has a duration and the durations add up to **exactly 24h** (sleep included), e.g. `8hr sleep, 2hr games, 3hr study, ...`. The message says how many hours are missing or too many (`checkDay` in `services/dayStats.js`).

## Journal document
```json
{
  "date": "2026-10-14",
  "rawText": "...",
  "tasks": [{ "emoji": "url", "name": "Gym", "activity": "gym", "category": "Signal", "type": "signal", "duration": "1hr",
              "points": { "int": 0, "end": 0, "str": 5, "arc": 0, "wis": 0 } }],
  "signal_to_noise_ratio": 0.2,
  "signalMinutes": 180, "noiseMinutes": 720, "necessityMinutes": 480,
  "points": { "int": 7, "end": 0, "str": 5, "arc": 0, "wis": 0 }, "totalPoints": 12
}
```
`type` is the tracking class (`signal` | `noise` | `necessity`), `category` is the journal category (`Signal` | `Noise` | `Unknown` | `Necessity`). The model only returns `tasks`. The server validates them: classification comes from `data/activities.json`, the image is chosen as described in "Activity images", noise always gets 0 points, signal tasks keep only their strongest stat, capped at 8. `rawText` is not part of what the API sends. Everything else in the document is derived from the tasks.

## Frontend
`public/index.html` is generated from your design export by `tools/build_frontend.py`. When you re-export the design from your tool, rebuild with:

    python3 tools/build_frontend.py "path/to/Mira's Grove.html"

The script patches the export (anchored edits, fails loudly if the design changed too much) and writes `public/index.html`. The day navigation and calendar live in `tools/journal_block.js` (journal page), `tools/glue.js` (loading data, switching players), `tools/auth.css` (styles) and `tools/frontend_patches.py` (fullscreen button). What it changes:
- "Edit Stats" button and panel removed; that slot is now a "Log out" button. Stats only change through journals.
- Login / register panel in the same parchment style. Name is limited to 16 characters (the stats panel is small).
- Left stats panel shows the logged-in player. The right sidebar has **six player cards**: one card per character, always in this order for everyone: Mira, The Noble (red-haired girl), The Dice Lord, The Scholar, The Crimson Lord, The Duchess. Click a card to look at that player; the stats panel and the journal switch to them. When you log in your own card is selected. A character nobody has chosen yet is shown normally, but the mouse pointer on it is "not-allowed" and clicking does nothing. The order is `ORDER` in `tools/glue.js`. Stats, level and title come from the server.
- Journal page: shows the viewed player's journal for the date in the date field. Change the date by typing it (dd/mm/yyyy), with the `<` `>` buttons, or with the **Calendar** button. Opening the journal always starts on today.
- One entry per day: an empty day you may write on is editable (unsent text is remembered per day). A saved day is locked and shows only the signal/noise pie, the points of that day (Growth) and the activity log (without sleep) - never the saved text.
- **Calendar**: a parchment panel with the month. Days with a journal show the points gained and a small green/red signal/noise bar. Click a day to see its signal/noise ratio, points gained and every task; "View this day" jumps to that day (double-click a day does the same). Future days are greyed out.
- **Other players**: the six player cards at the right stay clickable while the journal is open. Click a player's card and the journal, calendar and every past day switch to that player, read-only.
- The **Reminders** and **Achievements** tabs open a full-screen picture (`public/ui/reminders.png`, `achievements.png`), no functions yet; click or press Esc to close.
- The bottom-right **Fullscreen** button (YouTube-style four-corner icon, tooltip "Fullscreen" / "Exit fullscreen") really toggles fullscreen and keeps its icon in sync when you leave with Esc or the browser's controls. The login screen has its own fullscreen button (bottom right), so fullscreen works before logging in.
- Level is computed on the server from total points (`THRESHOLDS`/`TITLES` in `models/Player.js`).
- The pie shows the day's signal/noise ratio (computed by the server from the task durations).

## Game feel: sound effects + animation (`public/fx.js`, `public/fx.css`)
Loaded last by `index.html` (and added by `tools/build_frontend.py`, so a rebuild keeps them). They only listen to the existing page; no design or backend code changed.
- **Sounds** are synthesized live with the Web Audio API (no audio files): button hover/click, page flips, book open/close, footsteps and tile arrival, stat-up arpeggio, level-up fanfare, "quest logged" jingle, "analysing" bubbling, error bonk, typing ticks, calendar, login screens. Press **M** or use the speaker button (next to Undo, and on the login screen) to mute. The choice is remembered.
- **Animation**: panels fly in after login, art buttons lift/squash, portrait and icons breathe, stat count-up with floating `+N`, LEVEL UP banner with confetti and screen shake, journal book opens/closes in 3D, activity rows and pie animate in, calendar cells pop, login panel drops in and shakes on errors.
- **Particles** (canvas over the map): fireflies, falling leaves, mushroom spores, footstep dust, tile ripples, destination marker, glow under Mira.
- `prefers-reduced-motion` turns off the big movement; sounds stay.

## Clock times in the activity log
Each activity-log row shows `9:00 – 11:00` (12-hour digits, no am/pm) and, to the right of it, the length (`2hr`). The log box is wider (it now reaches the page edge past the scrollbar).
- The model returns `start` for every task (24h `HH:MM`, see `prompts/journalPrompt.txt`, "START TIME"). The server stores only the start (`Journal.tasks[].start`, minutes after midnight) and always computes the end as start + duration, so the two can never disagree. Past midnight wraps (`10:45 – 2:15`).
- A task with no start from the model follows the previous task (the first starts at 12:00am), which is right for journals written as `2hr games, 3hr study`.
- The API sends `start` and `time` (the display string) on every task, including the calendar's task list. Days saved before this change have no start, so they keep showing just the duration (no database change needed).
- Helpers: `parseClock`, `fmtClock`, `fmtRange` in `services/dayStats.js`. Row layout: `rowHTML` in `tools/journal_block.js`, columns in `tools/auth.css`.

## Start screen (`public/title.css`, `title.js`, `title.jpg`)
Opening the site first shows the Oath cover picture (`title.jpg`) with "Press Any Button". Markup is the `<div id="title">` at the top of `<body>` (also added by `tools/build_frontend.py`).
- While it is shown, the page loads in the background for at least 2.6 s (up to 7.5 s on a slow connection): fonts, every stage image decoded, the character pictures, and your sign-in. A progress bar fills, then "Loading" turns into "Press Any Button". Pressing earlier is remembered and starts the moment loading finishes.
- Any key, click, tap or gamepad button starts it: boom + chord sound (`titleStart` in `fx.js`), flash, the picture rushes toward you and dissolves into the menu, then the menu animates in (login panel drops in, or the game panels fly in if you were already signed in).
- Animation: slow push-in, mouse parallax, glow and sunbeam over the logo, fireflies, pollen and leaves.
- The game goes **full screen** on that first press (browsers only allow it from a key press, click or tap, so it cannot happen earlier). Esc leaves full screen; the Fullscreen button toggles it again. After a reload (e.g. logging out) the first click or key brings it back.
- After "Log out" the page reloads straight to the login menu (no start screen); everywhere else it shows every time. To change the picture, replace `public/title.jpg` (16:9).

## Notice board (Reminders tab)
The **Reminders** tab (2nd tab under the stage) opens the notice board of the player whose card is selected (yours by default). `public/board.js` + `board.css`, art in `public/ui/`.
- **Everybody can look, only the owner can change.** Other players see the board read-only (no handles, no typing, no Edit button); the server enforces it too (`PUT /api/board` always writes your own board).
- **Edit board** (gold button, top right) unlocks it. Then you get the paper tray, a labelled toolbar and Canva-style selection: click an item, drag it to move, drag the 8 dots to resize (corners keep a picture's shape; Shift does the same for papers), drag the round arrow to turn it (snaps to straight / 45 degrees, Alt = free). Arrow keys nudge, Delete removes, Ctrl+D duplicates, Ctrl+Z / Ctrl+Shift+Z undo / redo, drop a paper on the tray to throw it away. "Done editing" (or Esc) locks it again.
- **Writing**: Title / Heading / Subheading / Body / Fine print / Handwritten, 11 fonts, sizes 10-60, bold / italic / underline, colours, alignment, dividers.
- **Pictures**: "Add image", drop a file on the board, or paste one. Any type the browser can open (PNG, JPG, GIF, WebP, SVG, AVIF...) works, transparent PNGs keep their transparency. The browser shrinks and re-encodes it, uploads it (`POST /api/board/images`, stored in MongoDB as `BoardImage`, max 5 MB, SVG is never stored) and pins it. **Vintage style** turns the picture into an aged parchment look (Parchment / Old photo / Ink sketch) and back to normal; Flip mirrors it.
- **Saving**: `localStorage` at once, server a moment later (`GET /api/board` own, `GET /api/board/:playerId` anyone's, `PUT /api/board`, max 60 items; pictures nobody uses any more are deleted after a day).
- **Wiring**: `server.js` mounts `/api/board` (2 MB body limit for that route); `api.js` has `getBoard(playerId?)`, `saveBoard`, `uploadBoardImage`; `index.html` loads `board.css` / `board.js`, and `act('r')` calls `openBoard(GroveWho())` (`window.GroveWho` is in `tools/glue.js`; the same patches are in `tools/build_frontend.py`).
