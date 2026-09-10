# QuizTogether

Create a room, invite your friends, and compete in real time.

QuizTogether is a small multiplayer quiz app. A leader creates a room and configures the quiz. Players join with a 5‑character code, and everyone plays the same questions in sync over WebSockets. Scores, timers and quiz state are decided on the server.

- **Web app:** Next.js 16 (App Router) + Tailwind CSS 4, deployed to Cloudflare Workers with the OpenNext adapter
- **Realtime server:** a Cloudflare Worker + one Durable Object per room (WebSocket Hibernation API, alarms, SQLite-backed storage)
- **No database, no polling, no external APIs**

---

## Contents

1. [Architecture](#architecture)
2. [Project structure](#project-structure)
3. [Getting started](#getting-started)
4. [Testing multiple players locally](#testing-multiple-players-locally)
5. [How the WebSocket protocol works](#how-the-websocket-protocol-works)
6. [How Durable Objects are used](#how-durable-objects-are-used)
7. [Game rules, scoring and security](#game-rules-scoring-and-security)
8. [Deploying to Cloudflare](#deploying-to-cloudflare)
9. [Environment variables](#environment-variables)
10. [Scripts](#scripts)
11. [Troubleshooting](#troubleshooting)
12. [Extending the app](#extending-the-app)

---

## Architecture

```
 Browser (Next.js client components)
   │
   │  1. POST /api/rooms            → create room, get { roomCode, playerId, sessionToken }
   │  2. POST /api/rooms/:code/join → reserve a seat, get credentials
   │  3. WSS  /api/rooms/:code/ws   → JOIN_ROOM { sessionToken }, then live events
   ▼
 quiz-together-realtime  (Cloudflare Worker: worker/src/index.ts)
   │  validates input + Origin, routes by room code:
   │  env.QUIZ_ROOM.idFromName(roomCode)
   ▼
 QuizRoom Durable Object  (one instance per room: worker/src/quiz-room.ts)
   │  authoritative room state, WebSockets, alarms (timers + expiry)
   ▼
 Pure game engine  (worker/src/game/engine.ts): unit tested

 quiz-together-web  (Cloudflare Worker via OpenNext) serves the Next.js pages.
```

### Why two Workers?

The app ships as **two Workers from one repository**:

| Worker | What it does | Built with |
| --- | --- | --- |
| `quiz-together-web` | Renders pages (landing, create, join, room) | Next.js + `@opennextjs/cloudflare` |
| `quiz-together-realtime` | Room API, WebSockets, Durable Objects | Plain Wrangler |

OpenNext is Cloudflare's recommended way to run Next.js on Workers. Its build output is a generated worker that owns the whole request pipeline. That makes it awkward to export a Durable Object class from it or to terminate WebSockets in it. Also, `next dev` can't host Durable Objects at all. Keeping the realtime server as a separate Worker means:

- local development matches production exactly (`next dev` + `wrangler dev`);
- the realtime server can be deployed, scaled and tested independently;
- the question bank and answer keys live **only** in the realtime Worker and never reach the browser bundle.

The browser talks to the realtime Worker directly, using `NEXT_PUBLIC_REALTIME_URL`. The Next.js server never needs to proxy game traffic.

### Why HTTP for create/join and WebSockets for everything else?

A Durable Object is addressed by room code, so the room has to exist before a socket can be routed to it. Create and join are one-shot, request/response operations. HTTP gives the forms clean inline errors ("Room is full", "Nickname taken"). Both calls return a secret **session token**. The socket then presents that token in `JOIN_ROOM`, and from then on all communication is real-time over that one socket.

---

## Project structure

```
.
├── src/                          Next.js app (App Router)
│   ├── app/
│   │   ├── layout.tsx            Shell, header, skip link
│   │   ├── page.tsx              Landing page
│   │   ├── create/page.tsx       Create room
│   │   ├── join/page.tsx         Join room (supports ?code=AB7KQ)
│   │   ├── room/[code]/page.tsx  Lobby / game / results
│   │   └── globals.css           Tailwind v4 entry
│   ├── components/
│   │   ├── ui/                   Button, Input, Select, Toggle, Card, Badge,
│   │   │                         Spinner, LoadingState, ErrorMessage
│   │   ├── lobby/                Lobby, RoomCode, PlayerList, PlayerAvatar
│   │   ├── quiz/                 GameScreen, QuizQuestion, AnswerButton, Timer,
│   │   │                         RevealSummary, Leaderboard, FinalResults,
│   │   │                         QuizSettingsForm, SettingsSummary
│   │   └── room/                 RoomClient, CreateRoomForm, JoinRoomForm,
│   │                             ConnectionStatus
│   ├── hooks/
│   │   ├── useQuizRoom.ts        WebSocket lifecycle, reconnection, actions
│   │   ├── useStoredSession.ts   Per-tab player credentials
│   │   └── useNow.ts             Server-synchronized countdowns
│   └── lib/                      api.ts, config.ts, session.ts, format.ts
├── shared/                       Imported by BOTH the web app and the worker
│   ├── types.ts                  Domain types (RoomStatus, QuizSettings, …)
│   ├── protocol.ts               WebSocket message types + close codes
│   ├── validation.ts             Input/message validation
│   ├── constants.ts              Options, timings, scoring constants
│   └── errors.ts                 Error codes → friendly messages
├── worker/                       Realtime Worker
│   ├── wrangler.jsonc            Durable Object binding + migration
│   └── src/
│       ├── index.ts              HTTP routes, CORS/Origin checks, WS routing
│       ├── quiz-room.ts          QuizRoom Durable Object
│       ├── env.ts                Worker bindings type
│       ├── game/
│       │   ├── engine.ts         Pure game rules (state machine)
│       │   ├── scoring.ts        Points calculation
│       │   ├── questions.ts      Question selection + QuestionProvider
│       │   └── types.ts          Server-only state (tokens, answer key)
│       ├── data/questions/       120 questions, 8 categories × 3 difficulties
│       └── lib/random.ts         Crypto-random codes, tokens, shuffles
├── tests/                        Vitest business-logic tests
├── wrangler.jsonc                Web app Worker (OpenNext)
├── open-next.config.ts
├── next.config.ts
└── .env.example
```

---

## Getting started

### Prerequisites

- **Node.js 22.12+** (tested on Node 24)
- npm 10+
- A Cloudflare account (only needed to deploy)

### 1. Install dependencies

```bash
npm install
```

> npm 11 may print an `allow-scripts` warning for `esbuild`, `workerd` and `unrs-resolver`. The tools work without those install scripts (their binaries ship as optional dependencies). If you prefer to run them, use `npm approve-scripts`.

### 2. Configure (optional for local dev)

```bash
cp .env.example .env.local
```

The defaults already point the web app at `http://localhost:8787`, so this step is only needed if you change ports or hosts.

### 3. Run both servers

```bash
npm run dev
```

This starts:

- **web** on http://localhost:3000 (`next dev`)
- **realtime** on http://localhost:8787 (`wrangler dev`, running the Worker + Durable Objects locally in `workerd`)

You can also run them in two terminals with `npm run dev:web` and `npm run dev:realtime`.

Open http://localhost:3000, click **Create Room**, and you'll land in the lobby.

### 4. Quality checks

```bash
npm run check
```

That runs ESLint, TypeScript for both the web app and the worker, and the Vitest suite.

---

## Testing multiple players locally

Player identity is stored in **`sessionStorage`**, which is scoped to a single browser tab:

- **Each tab is a separate player.** Create a room in one tab, then open http://localhost:3000/join in another tab (or window, or another browser) and join with the code.
- **Reloading a tab keeps the same player.** It reconnects with its stored session token, with no duplicate player.
- The lobby's **Copy invite link** button copies `http://localhost:3000/join?code=XXXXX`.

A typical session:

1. Tab A: Create Room as "Raison" and note the code (e.g. `624NA`).
2. Tabs B, C: Join Room with `624NA` as "John", "Sarah".
3. Tab A: tweak settings (players see them update live), then **Start Quiz**.
4. Answer from every tab and watch the answered count, reveal and leaderboard sync.
5. Try reloading a tab mid-question, or stopping `wrangler dev` briefly, to see reconnection.

**Phones on your Wi‑Fi:** run the servers on all interfaces and point the client at your machine's LAN IP:

```bash
npx next dev -H 0.0.0.0 --port 3000
npx wrangler dev --config worker/wrangler.jsonc --ip 0.0.0.0 --port 8787
```

Then set `NEXT_PUBLIC_REALTIME_URL=http://<your-ip>:8787` in `.env.local` and add `http://<your-ip>:3000` to `ALLOWED_ORIGINS` in `worker/wrangler.jsonc`. Restart both servers.

---

## How the WebSocket protocol works

All message types live in [`shared/protocol.ts`](shared/protocol.ts) and are shared by client and server, so a protocol change is a compile error on both sides.

### Connection lifecycle

1. The client opens `ws(s)://<realtime>/api/rooms/<CODE>/ws`.
2. The Worker checks the `Origin` and room-code format, then forwards the upgrade to the room's Durable Object.
3. The client sends `JOIN_ROOM { sessionToken }`. The server looks up the player, marks them connected, and broadcasts.
4. Every state change is broadcast as an **event plus a full personalized snapshot** (`room`). The client simply replaces its state, with no delta merging and no drift.
5. Every 15 s the client sends `{"type":"PING"}`. The Durable Object answers `{"type":"PONG"}` via `setWebSocketAutoResponse`, **without waking** a hibernating room. If nothing arrives for 40 s, the client treats the connection as dead and reconnects.

### Client → Server

| Message | Who | Purpose |
| --- | --- | --- |
| `JOIN_ROOM { sessionToken }` | anyone | Attach this socket to a player (first join and every reconnect) |
| `UPDATE_SETTINGS { settings }` | leader, lobby | Change quiz settings (synced to everyone) |
| `START_QUIZ` | leader, lobby | Select questions and start question 1 |
| `SUBMIT_ANSWER { questionIndex, choiceIndex }` | player, question open | Lock in an answer |
| `NEXT_QUESTION` | leader | Close the current question early, or skip the reveal pause |
| `PLAY_AGAIN` | leader, results | Back to the lobby with scores reset |
| `LEAVE_ROOM` | anyone | Leave permanently |
| `END_ROOM` | leader | Close the room for everyone |

Room creation and joining are the HTTP calls `POST /api/rooms` and `POST /api/rooms/:code/join` (see [Architecture](#why-http-for-createjoin-and-websockets-for-everything-else)). They take the place of `CREATE_ROOM` / `ROOM_CREATED` messages.

### Server → Client

Every event below is sent as `{ type, ...eventFields, room: ClientRoomState, serverTime }`:

| Event | When |
| --- | --- |
| `ROOM_STATE` | Reconnect, connection-status changes |
| `PLAYER_JOINED` / `PLAYER_LEFT` | Lobby membership changes |
| `LEADER_CHANGED` | Leader left or stayed disconnected |
| `SETTINGS_UPDATED` | Leader changed settings |
| `QUIZ_STARTED` | Quiz began (snapshot contains question 1) |
| `QUESTION_STARTED` | Each following question |
| `ANSWER_SUBMITTED` | Someone answered (updates "3/5 answered") |
| `ANSWER_REVEALED` | Question closed. Snapshot has the correct answer (if enabled) and the updated leaderboard |
| `QUIZ_FINISHED` | Final results |
| `QUIZ_RESET` | Play again |

Plus `ERROR { code, message }` (friendly, pre-written messages only), `ROOM_ENDED { reason, message }`, and `PONG`.

### Close codes

The client does **not** auto-reconnect after these application close codes: `4000` room ended, `4001` left room, `4401` invalid session, `4403` origin not allowed, `4404` room not found, `4409` session opened in another tab, `4429` too many connections. Any other close triggers reconnection with backoff (0.5 s → 10 s, 10 attempts), plus an immediate retry when the browser comes back online or the tab becomes visible.

---

## How Durable Objects are used

- **One object per room.** The Worker calls `env.QUIZ_ROOM.idFromName(roomCode)`, so every request for `AB7KQ`, from any user anywhere, reaches the same single-threaded instance. That instance is the authoritative server for the room.
- **RPC for HTTP operations.** `createRoom()` and `joinRoom()` are public methods called directly from the Worker (Workers RPC). WebSocket upgrades use `fetch()`.
- **State.** The room is one JSON document stored with `ctx.storage.put("room", …)` in the object's built-in SQLite-backed storage. It is loaded in the constructor inside `blockConcurrencyWhile`, and written after every change. Rooms are small (a few KB), so there's no need for tables or a separate database.
- **WebSocket Hibernation.** Sockets are accepted with `ctx.acceptWebSocket()`, and each socket's player id is stored with `serializeAttachment()`. Idle rooms (for example, a lobby waiting for friends) can be evicted from memory without dropping connections. When a message arrives, the object wakes, reloads state and continues.
- **Alarms instead of `setTimeout`.** Timers must survive hibernation, so the room keeps a single storage alarm set to the earliest pending deadline:
  - question time limit → reveal,
  - reveal pause → next question / results,
  - lobby players who disconnected more than 20 s ago → removed,
  - leader disconnected more than 30 s ago → leadership handed to a connected player,
  - room expiry → delete everything.
- **Expiry.** Rooms with nobody connected expire after **10 minutes**. Rooms with no activity at all expire after **60 minutes**. Ended and expired rooms call `storage.deleteAll()`.
- **Thin shell, pure core.** `quiz-room.ts` only loads, persists, broadcasts and schedules. All rules live in [`worker/src/game/engine.ts`](worker/src/game/engine.ts) as pure functions of `(state, now)`, which is what the tests exercise.

### Timer synchronization

The server stores `phaseEndsAt` (epoch ms) and includes `serverTime` in every message. Each client computes `clockOffset = serverTime − Date.now()` (keeping the maximum of recent samples, since latency only lowers it) and renders `phaseEndsAt − (Date.now() + clockOffset)`. All players therefore count down to the same instant, regardless of their device clocks. When time runs out, the server's alarm closes the question, not the client.

---

## Game rules, scoring and security

### Flow

`LOBBY → QUESTION → ANSWER_REVEAL → QUESTION → … → RESULTS → (PLAY_AGAIN → LOBBY | END_ROOM → ENDED)`

- A question closes when its timer expires, when **every connected player** has answered, or when the leader clicks **End question now**.
- The reveal pause lasts 7 s when correct answers are shown, or 4 s when they're hidden. The leader can skip it.
- Answers are **final once submitted** (one answer per player per question).

### Scoring (server-side only)

```
correct:   1000 + round(500 × (1 − elapsed / timeLimit))   → 1000–1500
incorrect: 0
```

`elapsed` is measured by the server from question start to when the answer is received. Answers that arrive within a 500 ms latency grace window after the deadline earn base points only. Points are **applied at reveal time**, so the live leaderboard can't leak who answered correctly mid-question.

### Question selection

`LocalQuestionProvider` picks from 120 local questions (8 categories × easy/medium/hard × 5). If a filter has too few questions, it fills from the same category first, then the same difficulty in other categories. With **Randomize questions** off, the order is deterministic and runs from easy to hard. With **Randomize answer choices** on, choices are shuffled once per quiz, so all players see the same order.

### What the server enforces

| Threat | Protection |
| --- | --- |
| Forged scores / correct answers | Clients only send a choice index. Correctness and points are computed in the Durable Object, and the answer key never leaves the worker until reveal (and only if enabled) |
| Fake leader actions | Leader identity comes from the socket's authenticated player id, never from the message |
| Stale or future question index | Must equal the server's current index |
| Late answers / double answers | Rejected (`QUESTION_CLOSED`, `ALREADY_ANSWERED`) |
| Impersonation / duplicate players | 256-bit random session tokens (compared in constant time); one live socket per player, where a newer tab replaces the old one |
| Full rooms, duplicate nicknames, started quizzes | Checked on join (case-insensitive nicknames, `allowLateJoin`) |
| Malformed input | Every WebSocket frame and HTTP body is size-limited and strictly validated (`shared/validation.ts`). Unknown fields are dropped |
| Cross-site usage | `Origin` allow-list (`ALLOWED_ORIGINS`) for HTTP and WebSocket upgrades; connection cap per room |
| Leaking internals | Only pre-written, user-friendly error messages are sent; unexpected errors are logged server-side |

---

## Deploying to Cloudflare

You deploy the realtime Worker first (so you know its URL), then the web app.

### 1. Log in

```bash
npx wrangler login
```

### 2. Deploy the realtime Worker

```bash
npm run deploy:realtime
```

Wrangler applies the Durable Object migration (`new_sqlite_classes: ["QuizRoom"]`) automatically on first deploy and prints a URL such as `https://quiz-together-realtime.<your-subdomain>.workers.dev`.

### 3. Point the web app at it

Create `.env.production`:

```bash
NEXT_PUBLIC_REALTIME_URL=https://quiz-together-realtime.<your-subdomain>.workers.dev
```

`NEXT_PUBLIC_*` values are inlined at build time, so they must be set **before** building.

### 4. Deploy the web app

```bash
npm run deploy:web
```

This runs `opennextjs-cloudflare build` and `opennextjs-cloudflare deploy`, and prints a URL such as `https://quiz-together-web.<your-subdomain>.workers.dev`.

### 5. Allow the web origin

Add the web app's origin to `ALLOWED_ORIGINS` in [`worker/wrangler.jsonc`](worker/wrangler.jsonc) (keep the localhost entries for development), then redeploy the realtime Worker:

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "http://localhost:3000,http://127.0.0.1:3000,https://quiz-together-web.<your-subdomain>.workers.dev"
}
```

```bash
npm run deploy:realtime
```

After the one-time setup, `npm run deploy` deploys both Workers.

### Optional: one domain

With a custom domain you can serve both Workers from the same hostname using [Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/). For example, route `quiz.example.com/api/*` to `quiz-together-realtime` and everything else to `quiz-together-web`, then set `NEXT_PUBLIC_REALTIME_URL=https://quiz.example.com`. Requests become same-origin, so CORS is no longer involved.

### Preview the production build locally

```bash
npm run preview
```

This runs the OpenNext build inside `workerd` on http://localhost:8787. Stop `npm run dev` first, or change a port, because the realtime Worker also defaults to 8787.

---

## Environment variables

| Variable | Where | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_REALTIME_URL` | `.env.local` / `.env.production` (web, build time) | `http://localhost:8787` | Base URL of the realtime Worker. `https` automatically becomes `wss` for sockets |
| `ALLOWED_ORIGINS` | `worker/wrangler.jsonc` → `vars` (or `wrangler deploy --var ALLOWED_ORIGINS:…`) | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated browser origins allowed to call the realtime Worker. `*` allows any (not recommended in production) |

No secrets are required.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Web (3000) + realtime (8787) together |
| `npm run dev:web` / `npm run dev:realtime` | Run one side only |
| `npm run build` | `next build` |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | TypeScript for the web app and the worker |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run check` | lint + typecheck + test |
| `npm run preview` | OpenNext production build, served locally by Wrangler |
| `npm run deploy` | Deploy realtime, then web |
| `npm run cf-typegen` | Generate `worker/worker-configuration.d.ts` from the Wrangler config (optional) |

---

## Troubleshooting

**"Unable to reach the quiz server."** The realtime Worker isn't reachable. Check that `npm run dev:realtime` is running and that http://localhost:8787/health returns `{"ok":true}`. In production, check `NEXT_PUBLIC_REALTIME_URL`, and remember to rebuild after changing it.

**"This site isn't allowed to connect to the quiz server."** The page's origin isn't in `ALLOWED_ORIGINS`. Note that `localhost` and `127.0.0.1` are different origins.

**Stuck on "Reconnecting…".** Look at the `wrangler dev` output (or `npx wrangler tail quiz-together-realtime` in production). Some corporate proxies and VPNs block WebSockets. Try another network.

**"Room not found" for a room that should exist.** Rooms expire after 10 minutes with nobody connected. Local Durable Object state lives in `.wrangler/state`; delete that folder to reset all local rooms.

**"Your session for this room has expired."** The player was removed. For example, they left, or disconnected in the lobby for over 20 seconds. Join again with a nickname.

**"This room was opened in another tab."** The same session was opened in a second tab (for example via "Duplicate tab", which copies `sessionStorage`). Click **Use this tab instead**, or use a fresh tab to join as a different player.

**Timer seems to pause in a background tab.** Browsers throttle timers in hidden tabs. The server stays authoritative, and the display corrects itself as soon as the tab is visible.

**Port already in use.** Change the port in `package.json` (`dev:web` / `dev:realtime`) and update `NEXT_PUBLIC_REALTIME_URL` / `ALLOWED_ORIGINS` accordingly.

**`compatibility_date` is in the future.** Update Wrangler (`npm install wrangler@latest`) or lower `compatibility_date` in the Wrangler configs.

**OpenNext build on Windows.** `opennextjs-cloudflare build` has been verified on native Windows 11 with Node 24. OpenNext still officially recommends Linux, macOS or WSL, so if a future version misbehaves on Windows, run `npm run preview` / `npm run deploy:web` from WSL or deploy from CI (e.g. GitHub Actions on `ubuntu-latest`).

---

## Extending the app

### Persisting quiz history with D1 (optional)

The MVP intentionally keeps rooms ephemeral. To keep a history of finished games:

1. `npx wrangler d1 create quiz-together` and add the `d1_databases` binding (e.g. `DB`) to `worker/wrangler.jsonc`.
2. Create tables with a migration, e.g. `games(id, room_code, finished_at, settings_json)` and `game_players(game_id, nickname, score, correct_answers, rank)`.
3. In `QuizRoom.commit()`, when the events include `QUIZ_FINISHED`, write `buildLeaderboard(room)` to D1 with `ctx.waitUntil(env.DB.batch([...]))`. A failed write never blocks the game.

Durable Object storage stays the source of truth for live rooms, and D1 only receives completed results.

### Using an external question source

Implement `QuestionProvider` from [`worker/src/game/questions.ts`](worker/src/game/questions.ts):

```ts
class ApiQuestionProvider implements QuestionProvider {
  async getQuestions(settings: QuizSettings): Promise<RoomQuestion[]> {
    const response = await fetch(`https://example.com/questions?category=${settings.category}`);
    const sources: QuestionSource[] = mapResponse(await response.json());
    return sources.map((q) => prepareQuestion(q, settings.randomizeAnswers, secureRandom));
  }
}
```

Then swap it in `QuizRoom`. The engine already re-validates room state after questions load, so a slow API can't cause an invalid start.

### Other ideas

- Rate-limit room creation with the [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
- Let leaders kick players (`KICK_PLAYER` → `removePlayer`).
- Add streak bonuses in `scoring.ts`, which is a single function with tests.
