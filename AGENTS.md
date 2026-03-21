# AGENTS.md

Current agent entry point for WorldMonitor. Read this before making changes.

## What This Repo Is

WorldMonitor is a large local-first global intelligence dashboard with:

- a browser SPA in `src/`
- typed proto-first server handlers in `server/`
- legacy and typed API entry points in `api/`
- a Tauri desktop shell in `src-tauri/`
- seed and relay scripts in `scripts/`
- a growing local-first personal companion layered into the existing UI

The repo is broad, but the current checkout is being used primarily as a local
Mac app and as a reference point for a narrower future trading-focused system.

## Current Local Status

As of 2026-03-21 in this checkout:

- the main dev app runs locally on `http://localhost:3000`
- `.env.local` exists and is active for local development
- local Ollama is configured via:
  - `OLLAMA_API_URL=http://127.0.0.1:11434`
  - `OLLAMA_MODEL=qwen2.5:7b`
- `EIA_API_KEY` is configured in `.env.local`
- `FINNHUB_API_KEY` is configured in `.env.local`
- `keys.txt` is reference-only and is not read directly by the app
- Telegram bot credentials in `keys.txt` do not activate the repo's current
  Telegram intel ingestion path
- Convex sync remains optional and is not required for the local companion

Do not assume all upstream data sources are active just because code exists for
them. Many still depend on relay jobs, seeds, premium credentials, or optional
cloud wiring.

## Repository Map

```text
.
├── src/                    # Browser SPA, still mostly class-based
│   ├── app/                # Runtime orchestration, panel layout, search, events
│   ├── components/         # Panels, maps, modals, companion UI
│   ├── config/             # Panels, variants, layers, markets, feeds
│   ├── services/           # Business logic, fetchers, stores, adapters
│   ├── types/              # Shared TS types
│   ├── utils/              # Browser/runtime helpers
│   ├── workers/            # Web workers
│   ├── generated/          # Proto-generated code, do not hand-edit
│   └── App.ts              # Main app shell
├── api/                    # Edge entry points, mostly plain JS or thin RPC files
├── server/                 # Typed server handlers and gateway logic
├── proto/                  # Proto contracts
├── shared/                 # Cross-runtime JSON and reference data
├── scripts/                # Seeds, relays, fetch helpers, maintenance
├── src-tauri/              # Desktop shell and sidecar
├── tests/                  # Node test runner suites
├── e2e/                    # Playwright specs
├── docs/                   # Mintlify docs and internal notes
└── docs/Docs_To_Review/    # Internal repo-study and future-project planning docs
```

## How To Run

```bash
npm install
npm run dev
npm run dev:tech
npm run dev:finance
npm run dev:commodity
npm run dev:happy
npm run typecheck
npm run typecheck:api
npm run test:data
npm run test:sidecar
make generate
```

Current local browser URL:

```text
http://localhost:3000
```

## Architecture Rules

### Dependency direction

```text
types -> config -> services -> components -> app -> App.ts
```

- `types/` should not depend on internal runtime layers
- `config/` should stay close to `types/`
- `services/` should hold business logic and persistence
- `components/` should not become the source of truth for data
- `app/` orchestrates the runtime

### Edge/API constraints

- legacy `api/*.js` files are self-contained edge functions
- they must not import from `../src/` or `../server/`
- use same-directory helpers and packages only
- these boundaries are guarded by tests and bundle checks

### Server layer

- `server/` is the typed handler layer bundled into edge/server entry points
- shared caching, headers, rate limiting, and LLM helpers live under
  `server/_shared/`
- handler code should use cache helpers and include request-varying params in
  cache keys

### Proto flow

```text
proto -> codegen -> src/generated -> server handlers -> API wiring
```

- regenerate after proto changes
- do not hand-edit generated files
- keep request parsing and cache keys explicit

## Variant Reality

The repo still ships multiple variants:

- `full`
- `tech`
- `finance`
- `commodity`
- `happy`

Important practical note:

- `src/config/panels.ts` is still the effective source of truth for active panel
  defaults and runtime exports
- `src/config/variants/` exists, but future contributors should verify whether a
  change belongs there before assuming it is active

## Companion Reality

The personal companion now exists inside the current shell. The main panels are:

- `Companion Home`
- `Companion Inbox`
- `Companion Ask`
- `Companion Threads`

The companion is local-first and currently supports:

- workspaces
- follows
- inbox triage
- brief runs
- ask history
- notes
- actions
- threads
- automation rules and history
- export/import
- optional sync diagnostics and provider flows

Useful internal docs:

- `docs/Docs_To_Review/repo-study/how-to-use-personal-companion.md`
- `docs/Docs_To_Review/personal-information-companion-plan.md`
- `docs/Docs_To_Review/next-big-update-plan.md`

## Local Services And Keys

### `.env.local`

Use `.env.local` for local development values.

Current useful local entries in this checkout:

- `OLLAMA_API_URL`
- `OLLAMA_MODEL`
- `EIA_API_KEY`
- `FINNHUB_API_KEY`

### `keys.txt`

`keys.txt` is not read directly by the app. Treat it as a manual reference
store, not a runtime source.

### Telegram

Telegram bot credentials are not the same thing as the repo's current Telegram
intel ingestion credentials. The relay path expects MTProto-style values such
as:

- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION`

### Ollama

Local Ollama is intended for local AI summarization and companion flows. It is
not involved in TV or webcam playback.

Health check:

```bash
curl http://127.0.0.1:11434/api/tags
```

## Practical Source Guidance

Do not assume "listed in `docs/data-sources.mdx`" means "working in this local
checkout right now."

When evaluating a source, check:

1. is it public or keyed
2. does it need a relay or seed loop
3. is the key actually configured here
4. does the current runtime path use browser, edge, sidecar, or relay access

Helpful internal references:

- `docs/data-sources.mdx`
- `docs/Docs_To_Review/repo-study/data-source-availability-audit.md`
- `docs/Docs_To_Review/repo-study/gui-source-map.md`

## Critical Conventions

- do not use `fetch.bind(globalThis)`; use `(...args) => globalThis.fetch(...args)`
- include `User-Agent` in server-side fetches where the upstream expects it
- cache keys must include request-varying params
- new data sources should be wired into bootstrap/hydration if they are part of
  the primary runtime experience
- generated code is not hand-edited
- treat desktop and relay code as separate trust/runtime boundaries

## Testing

Main commands:

```bash
npm run typecheck
npm run typecheck:api
npm run test:data
npm run test:sidecar
npm run test:e2e
```

For docs work:

```bash
npx markdownlint-cli2 'docs/Docs_To_Review/**/*.md' 'runbook.md' 'AGENTS.md'
```

## Internal Docs Worth Reading First

Read these before making large decisions:

- `runbook.md`
- `ARCHITECTURE.md`
- `docs/Docs_To_Review/repo-study/README.md`
- `docs/Docs_To_Review/repo-study/frontend-runtime.md`
- `docs/Docs_To_Review/repo-study/api-data-pipeline.md`
- `docs/Docs_To_Review/repo-study/desktop-security.md`
- `docs/Docs_To_Review/repo-study/quality-and-drift.md`

If the repo docs and the code disagree, trust the code and update the docs.
