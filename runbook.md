# WorldMonitor Runbook

## Purpose

This repo still runs primarily as a local app on your Mac.

- Main runtime: Vite web app
- Optional desktop runtime: Tauri shell
- Optional cloud pieces: Vercel, Railway, Convex

The current checkout is local-first and usable without Convex.

## Current Local Status

As of 2026-03-21 in this checkout:

- the dev app runs locally at `http://localhost:3000`
- `.env.local` exists and is being used for local development
- `OLLAMA_API_URL` points to `http://127.0.0.1:11434`
- `OLLAMA_MODEL` is set to `qwen2.5:7b`
- `EIA_API_KEY` is configured
- `FINNHUB_API_KEY` is configured
- `keys.txt` is not read directly by the app
- Telegram bot credentials in `keys.txt` are not wired into the current
  Telegram intel path

## Normal Local Startup

From the repo root:

```bash
npm install
npm run dev
```

Expected result:

- Vite starts the local dev server on `http://localhost:3000`
- the browser app runs with local persistence
- configured local services such as Ollama are available if their env vars are
  set

## Local Variants

```bash
npm run dev
npm run dev:tech
npm run dev:finance
npm run dev:commodity
npm run dev:happy
```

## Local Desktop Startup

Use this only if you want the Tauri shell instead of the browser app.

```bash
npm run desktop:dev
```

This is still a local Mac workflow.

## Local Env And Keys

The app does not automatically ingest `keys.txt`.

Use `.env.local` for the local web runtime. In this checkout it already carries
the safe values that were wired from `keys.txt`:

- `OLLAMA_API_URL`
- `OLLAMA_MODEL`
- `EIA_API_KEY`
- `FINNHUB_API_KEY`

The Telegram values in `keys.txt` are not enough to enable the current
Telegram ingestion path. That path expects MTProto relay credentials such as:

- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION`

## Local Ollama

Ollama is now usable locally in this repo when the local service is running.

Recommended current model:

- `qwen2.5:7b`

Practical checks:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

Ollama is used for local summarization and related AI flows. It is not involved
in TV or webcam playback.

## Companion Workflow

The personal companion runs locally inside the main app. The current panels are:

- `Companion Home`
- `Companion Inbox`
- `Companion Ask`
- `Companion Threads`

What persists locally:

- profile
- workspaces
- follows
- inbox state
- brief recipes and runs
- ask history
- threads
- notes
- actions
- automation rules and history
- sync diagnostics and sync job history

Recommended practical use:

1. create one workspace
2. add a few follows
3. triage the inbox
4. run a brief
5. ask one scoped question
6. save useful answers into notes, actions, or threads

Detailed usage guide:

- [`docs/Docs_To_Review/repo-study/how-to-use-personal-companion.md`](/Users/sonics/project/worldmonitor/docs/Docs_To_Review/repo-study/how-to-use-personal-companion.md)

## TV And Webcam Resource Use

TV and webcam panels are some of the heavier local surfaces because playback and
decode happen in your browser on your Mac.

If you close or disable those panels:

- local CPU, memory, and bandwidth use drops
- video playback stops
- unrelated non-video polling elsewhere in the app can still continue

If you do not need video, disable those panels in the settings UI.

## Optional Sync

Remote sync is optional.

Without Convex:

- local persistence works
- backup/export works
- import works
- manual local sync flows work

With Convex:

- the same companion snapshot can move across installs
- probe, push, pull, and force-push become available

Required only for optional remote sync:

- `VITE_CONVEX_URL`
- a deployed Convex project

Convex is not required for the local companion experience.

## Verification Commands

```bash
npm run typecheck
npm run typecheck:api
npm run test:data
npm run test:sidecar
```

## Common Problems

### Data Looks Stale

Possible causes:

- the relevant source is public but relay- or seed-dependent in this repo
- the required API key is not configured
- the current panel depends on an optional upstream that is down or rate-limited

This is one reason the simplified trading-focused follow-on project should use a
smaller source set.

### Ollama Is Installed But Not Working

Check both:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```

If the API does not answer, the app cannot use local Ollama even if Homebrew
shows the service as started.

### Convex Not Configured

That only affects optional remote sync and a few cloud-oriented flows. The
local app should still run.

## Current Recommendation

Use the project locally first:

1. run `npm run dev`
2. verify the browser app starts on `http://localhost:3000`
3. use the companion locally
4. disable TV and webcam panels if you do not need them
5. only add Convex later if you want cross-install sync
