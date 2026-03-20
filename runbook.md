# WorldMonitor Runbook

## Purpose

This project is a local-first application.

- Main local runtime: Vite web app on your Mac
- Optional local desktop runtime: Tauri app on your Mac
- Optional remote pieces: Vercel, Railway, Convex

You do not need cloud services to run the project locally.

## Normal Local Startup

From the repo root:

```bash
npm install
npm run dev
```

Expected result:

- Vite starts a local dev server
- You open the printed localhost URL in your browser
- The app runs with local persistence even if many API keys are missing

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

## Local-First Companion Behavior

The personal companion currently works locally without Convex.

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
- sync diagnostics

## Optional Sync

Remote sync is optional.

Without Convex:

- local persistence works
- backup/export works
- import works
- manual sync works

With Convex:

- the same companion snapshot can move across installs
- probe/push/pull/force-push become available

Required only for optional remote sync:

- `CONVEX_URL`
- `VITE_CONVEX_URL`
- a deployed Convex project

## Verification Commands

```bash
npm run typecheck
npm run typecheck:api
npm run test:data
npm run test:sidecar
```

## Common Problems

### No `.env.local`

That is fine for local-first development.

You only need `.env.local` when you want:

- specific premium data sources
- Convex remote sync
- desktop/cloud fallback behavior

### Convex Not Configured

That only affects optional remote sync and registration/contact flows.

The local app should still run.

### Missing API Keys

Many panels degrade gracefully.

The app still starts, but some data sources stay unavailable.

## Current Recommendation

Use the project locally first:

1. run `npm run dev`
2. verify the browser app starts
3. use the companion locally
4. only add Convex later if you want cross-install sync
