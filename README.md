# tokens make you drink water

A small floating widget for your Mac desktop that turns the tokens you burned today
into glasses of water you owe. It reads the usage that Claude Code, Codex and Cursor
already leave on your machine, so there is nothing to sign in to and no API key to
paste. Launch it and it already knows.

```
            ┌──────────────────┐
            │  today       ••• │
            │                  │
            │        1         │
            │   GLASS OWED     │
            │     ┌──────┐     │
            │     │▓▓▓▓▓▓│     │   the glass fills as tokens accrue;
            │     │▓▓▓▓▓▓│     │   when it tops out the counter ticks up
            │     └──────┘     │
            │ 128,200 tokens   │
            │     · 462 mL     │
            │      ✳  ✿        │   a mark per source with usage today
            │ ┌──────────────┐ │
            │ │I had a glass │ │
            │ │  of water    │ │
            │ └──────────────┘ │
            └──────────────────┘
```

- **Counter** — whole glasses you owe right now
- **Glass** — how far the tokens have filled the next one
- **Totals** — today's tokens and today's water
- **Marks** — one monochrome glyph per source that actually reported usage today
- **The button** — _I had a glass of water_ takes one off the counter. The partial fill
  stays where it is, because those tokens are already spent.

Everything resets at local midnight. Black, white and grey only, including the water.

## Run it

Requires Node 22 or newer (the app reads a SQLite file with `node:sqlite`) and macOS
for the frosted-glass window and the tray icon.

```bash
npm install
npm run dev          # Electron widget, live reload
npm run build:mac    # unsigned .dmg in release/
```

Other scripts:

```bash
npm run dev:web      # the widget UI alone in a browser on http://127.0.0.1:43117
npm run typecheck    # strict TS across main, preload, renderer and tests
npm test             # vitest: the water maths and every collector
```

### Try it with sample usage

If this machine has no Claude Code, Codex or Cursor history, generate some:

```bash
node scripts/demo-logs.mjs /tmp/tmyw-demo
CLAUDE_CONFIG_DIR=/tmp/tmyw-demo/claude CODEX_HOME=/tmp/tmyw-demo/codex npm run dev
```

`npm run dev:web` does the same thing for the UI only: with no Electron bridge present,
the renderer falls back to a seeded in-memory preview whose usage keeps growing, so the
glass visibly fills. It reads no files and makes no requests.

### Getting around

- Drag the widget anywhere; the position is remembered.
- Right-click it, or click **•••**, for settings: units, water rate, glass size, which
  sources to use, and manual token entry.
- The tray icon shows and hides the widget, forces a refresh, logs a glass, and quits.
- `Esc` closes settings.

## How each source is read

Nothing here is a special integration. These tools keep their own local records, and the
widget reads the numbers out of them — the same approach [`ccusage`][ccusage] takes.

| Source | Where it looks | What it takes |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/**/*.jsonl` and `~/.config/claude/…`; `CLAUDE_CONFIG_DIR` overrides and may list several paths | `message.usage` on assistant lines: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`; `CODEX_HOME` overrides | `event_msg` lines with `payload.type === "token_count"`, per-turn `info.last_token_usage` only |
| Cursor | the session JWT in `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`, then one `POST` to `cursor.com` | per-model `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens` |
| Manual | whatever you type in settings | one number, for claude.ai, ChatGPT, a phone — anything with no local log |

Details that matter:

- **Only files touched today are opened**, and each one is read forward from the byte
  offset where the last sync stopped, so a sync over a long session is cheap. A
  half-written trailing line is left for the next pass.
- **Claude Code lines are deduplicated by message id**, because sidechains and resumed
  sessions replay the same assistant line verbatim.
- **Codex's `total_token_usage` is ignored.** It is a running cumulative snapshot
  repeated on every event; summing it would multiply your real usage several times over.
  Only `last_token_usage`, the per-turn delta, is counted. Codex reports cached tokens
  inside `input_tokens`, so they are split back out to keep every source comparable.
- **Cursor keeps no token counts on disk.** The only way to see them is the endpoint its
  own dashboard calls, `POST /api/dashboard/get-aggregated-usage-events`, with the
  session cookie built from the JWT already on this Mac
  (`WorkosCursorSessionToken=<sub>::<jwt>`). That endpoint is undocumented and may change
  or disappear without notice, so it is strictly best-effort, throttled to once every
  five minutes, cached for the rest of the day if a later request fails, and switchable
  off in settings. A Cursor API key (`crsr_…`) cannot read usage; only the session can.
  `state.vscdb` is copied to a temp file and read read-only, never written. If macOS
  blocks the read, set `CURSOR_SESSION_TOKEN` or grant Full Disk Access.
- **Cache reads are not counted by default.** They are real tokens but a small fraction
  of the compute, and they dominate agent logs by an order of magnitude — counting them
  turns an ordinary day into several hundred glasses. There is a toggle in settings.
- **Every source fails quietly.** Not installed, no permission, an endpoint that changed
  shape: the source shows as _unavailable_ in settings, contributes zero, and the widget
  carries on. No source is ever required, and a source with no usage today shows no mark.

## Privacy

Everything stays on your machine.

- Session logs are parsed for **token counts only**. Prompts, responses, file contents,
  file names and project paths are never read, stored, or sent anywhere. The parsers look
  at `usage` objects and skip every other line in the file.
- There is **no backend, no account, no telemetry, no analytics, no database** — just one
  local JSON file for your settings and today's counter.
- There is exactly **one network call in the whole app**: Cursor's own usage endpoint,
  with your own session, to a host you are already logged into. Turn it off in settings
  and the app makes no requests at all.
- The renderer runs with context isolation on, no Node integration, and a strict CSP. It
  can only call the handful of typed methods in `src/preload/index.ts`.

## The water methodology, and why you should not trust it too much

The default sum is deliberately simple:

| | |
| --- | --- |
| Water per 1,000 tokens | **3.6 mL** |
| One glass | **250 mL** (~8.5 US fl oz) |
| So one glass costs | **~69,000 tokens** |

3.6 mL per 1,000 tokens means a 1,000-token exchange costs about 3.6 mL. That lands
deliberately between the two camps of published figures, which disagree by about two
orders of magnitude because they are measuring different things:

| Estimate | Per unit | Scope |
| --- | --- | --- |
| [Google, _Measuring the environmental impact of AI inference_ (2025)][google] | **0.26 mL** per median Gemini text prompt | measured in production, includes idle capacity and datacenter overhead; on-site water only |
| [Sam Altman, _The Gentle Singularity_ (2025)][altman], as [reported by The Verge][verge] | **0.000085 gallons ≈ 0.32 mL** per average ChatGPT query | unsourced, no methodology published |
| **This app's default** | **3.6 mL** per 1,000 tokens | a middling guess for a GPT-4o-class model including power-generation water |
| [Li et al., _Making AI Less "Thirsty"_ (2023)][thirsty] | **~500 mL** per 10–50 responses, i.e. **10–50 mL** each | on-site cooling evaporation **and** off-site water used to generate the electricity |
| Washington Post with UC Riverside | **~519 mL** for one 100-word GPT-4 email | worst-case datacenter and region |

[MIT Technology Review's energy-and-water investigation][mittr] is the best read on why
these numbers are so far apart and why none of them is simply "the" answer.

And then the caveats on top of the caveats: reasoning models drink more than this app
assumes, a cached read drinks far less than a fresh one, a token is not a query, the input
side is cheaper than the output side, and the water cost of a datacenter in Iowa is not
the water cost of one in Finland. Settings expose the mL-per-1,000-tokens rate and the
glass size precisely so you can dial in whichever estimate you believe — drop the rate to
`0.3` for roughly the vendor figures, push it to `30` for the academic high end.

**This is a hydration nudge, not a carbon ledger.** The number that actually matters is
whether you drank the water.

## How it is built

- Electron + Vite + React + TypeScript (`electron-vite`), Tailwind for the widget
- A frameless, transparent, always-on-top `BrowserWindow` with macOS
  `vibrancy: 'under-window'` and `visualEffectState: 'active'`, so it reads as frosted
  glass on the desktop. Every macOS-only option is guarded by `process.platform`, so the
  app still starts on Linux and Windows — just without the vibrancy.
- The tray glyph and the glass are drawn in code: the tray icon is a grayscale+alpha PNG
  encoded at runtime, the glass is hand-written SVG. No binary image assets.
- Platform marks are simplified single-colour glyphs drawn in this repo, not copied brand
  files, so they match the monochrome theme and ship no third-party trademark assets.
- `node:sqlite` (bundled with Node 22 and Electron) reads `state.vscdb`, so there is no
  native module to compile.
- `electron-store` keeps settings, today's counter and the widget position.

```
src/
  main/              tray, widget window, IPC, day state
    collectors/      claudeCode.ts, codex.ts, cursor.ts, manual.ts
  preload/           the typed bridge, the renderer's only capability
  renderer/          widget UI, Glass.tsx, logos/, the settings panel
  shared/            water formula, units, types, constants
tests/               vitest, against synthetic session logs
```

Not in this first slice: real OAuth for any provider, platform usage APIs with pasted API
keys, Windows and Linux packaging, per-model water multipliers, and reminder
notifications.

## A note on what cannot be verified without a Mac

The collectors, the water maths, the day roll-over and the whole UI are covered by tests
and run anywhere. The macOS-specific pieces — window vibrancy, the template tray icon
tinting itself for the menu bar, `LSUIElement` hiding the Dock tile, and Full Disk Access
prompts — can only be judged on macOS.

## Licence

MIT. See [LICENSE](LICENSE).

[ccusage]: https://github.com/ryoppippi/ccusage
[thirsty]: https://arxiv.org/abs/2304.03271
[altman]: https://blog.samaltman.com/the-gentle-singularity
[google]: https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference
[verge]: https://www.theverge.com/news/685045/sam-altman-average-chatgpt-energy-water
[mittr]: https://www.technologyreview.com/2025/05/20/1116327/ai-energy-usage-climate-footprint-big-tech/
