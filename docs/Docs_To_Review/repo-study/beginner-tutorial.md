# Beginner Tutorial

This tutorial is for someone who is new to the WorldMonitor repo and wants a
safe path from "I just cloned it" to "I can make a small change without getting
lost."

It is intentionally practical. It does not try to explain every subsystem.

## 1. What You Are Looking At

WorldMonitor is not just one frontend app.

You are working inside a repo that contains:

- a browser SPA in `src/`
- typed API contracts in `proto/`
- typed server handlers in `server/`
- edge endpoints in `api/`
- a desktop app in `src-tauri/`
- seed and relay scripts in `scripts/`
- tests in `tests/` and `e2e/`

If you are a beginner, do not try to understand everything at once. Start with
the web app path:

- `src/main.ts`
- `src/App.ts`
- `src/app/`
- `src/components/`
- `src/services/`

## 2. Install And Run The App

From the repo root:

```bash
npm install
npm run dev
```

The main app uses Vite, so the default local URL is usually:

```text
http://localhost:5173
```

Other variants:

```bash
npm run dev:tech
npm run dev:finance
npm run dev:happy
npm run dev:commodity
```

## 3. Learn The Main Runtime Path

If you only read four files first, read these:

### `src/main.ts`

This is the browser entry point. It sets up global concerns and creates the app.

### `src/App.ts`

This is the real orchestration center. It:

- loads saved settings
- resolves the active variant
- creates the shared app state
- builds managers for layout, data loading, events, search, refresh, and
  country intelligence

### `src/app/app-context.ts`

This defines the big shared mutable state object used across the app.

### `src/components/Panel.ts`

This is the base class for most panel UI pieces.

## 4. Understand The Frontend Pattern

This repo does not mainly use React-style component trees.

The dominant pattern is:

- TypeScript classes
- direct DOM updates
- manager classes
- a shared mutable `AppContext`

That means if you are debugging behavior, you usually want to find:

1. where data is loaded
2. where it is stored in `AppContext`
3. which panel or map class reads it

## 5. Know The Important Directories

### `src/components/`

UI classes, especially panels and maps.

Examples:

- `LiveNewsPanel.ts`
- `MarketPanel.ts`
- `DeckGLMap.ts`
- `GlobeMap.ts`

### `src/services/`

Data fetchers, adapters, analysis logic, and helpers. If a panel needs data,
the fetch logic is usually here.

### `src/config/`

Static configuration, feeds, geo data, layer definitions, market symbols, and
variant-dependent defaults.

Important beginner note:

The active default panel and map-layer exports currently come from
`src/config/panels.ts`.

### `proto/`

Typed API contract definitions. If you need a new typed backend endpoint, this
is the start of the chain.

### `server/worldmonitor/`

Typed backend handlers grouped by domain and version.

### `api/`

Edge entry points. Most new typed endpoints go through `api/<domain>/v1/[rpc].ts`.

## 6. Make Your First Safe Change

The easiest beginner-friendly changes are:

- tweak panel copy or labels
- update a panel's rendering logic
- add a small config entry
- fix a docs mismatch
- add or adjust a test

Avoid these as your first change unless you already know the stack:

- `DeckGLMap.ts`
- `GlobeMap.ts`
- `src-tauri/`
- proto contract changes
- seed / relay scripts
- auth, rate limiting, or security-sensitive edge code

## 7. How To Add A Small Panel Change

If you want to change an existing panel:

1. Find the panel class in `src/components/`
2. Find where it gets data from
3. Find where the panel is enabled in `src/config/panels.ts`
4. Run the app and confirm the panel appears in your current variant
5. Run typecheck and relevant tests after editing

Useful commands:

```bash
npm run typecheck
npm run test:data
```

## 8. How To Add A New Typed API Method

This is the high-level path for a new typed endpoint:

1. Add request and response messages in `proto/worldmonitor/<domain>/v1/`
2. Add the RPC to that domain's `service.proto`
3. Run:

```bash
make generate
```

4. Implement the handler in `server/worldmonitor/<domain>/v1/`
5. Export it from the domain `handler.ts`
6. Use it from the frontend through the generated client or a service wrapper

If you are new, do not start here unless the change really needs backend work.

## 9. Common Rules That Will Save You Time

### Edge JS files have strict limits

Top-level legacy `api/*.js` edge functions are intentionally restricted. Tests
enforce that they must stay self-contained and cannot import from `../src/` or
`../server/`.

### Generated files are not hand-edited

Do not manually edit `src/generated/` output unless you are debugging codegen.

### Variant behavior matters

A feature might exist in the repo but not show up in your current variant. When
something seems missing, check:

- `src/config/variant.ts`
- `src/config/panels.ts`
- `src/config/map-layer-definitions.ts`

### Desktop is special

The Tauri app and sidecar have their own runtime and security constraints.
Treat desktop-specific code as a separate environment.

## 10. Commands You Will Actually Use

```bash
npm run dev
npm run dev:tech
npm run typecheck
npm run typecheck:api
npm run test:data
npm run test:sidecar
npm run test:e2e
make generate
```

## 11. A Good Reading Order For Beginners

Read in this order:

1. `AGENTS.md`
2. `README.md`
3. `ARCHITECTURE.md`
4. `src/main.ts`
5. `src/App.ts`
6. `src/app/app-context.ts`
7. `src/components/Panel.ts`
8. one real panel you care about
9. one related service file

That order gives you the "shape" of the app before the details.

## 12. Beginner Pitfalls

### Editing the wrong variant config

There are variant files under `src/config/variants/`, but the active defaults
used by the app currently come from `src/config/panels.ts`.

### Assuming this is a normal React app

It is not. Most UI behavior is class-based and imperative.

### Changing generated artifacts by hand

If the change starts in `proto/`, regenerate the outputs.

### Ignoring tests that enforce architecture boundaries

This repo uses tests not just for behavior, but also for structure and allowed
import patterns.

## 13. Good First Tasks

- Fix outdated wording in docs that no longer matches the codebase
- Improve a small panel's formatting or empty state
- Add a focused unit test for a service helper
- Document a confusing runtime path you had to learn

Once you can do those comfortably, move on to:

- adding a new panel
- extending a typed RPC
- changing a map layer

## 14. If You Get Lost

When debugging, always reduce the question to one of these:

- Which file creates this thing?
- Which service loads its data?
- Which config enables it?
- Which variant shows it?
- Is this browser, edge, server, relay, or desktop code?

That framing works well in this repo because the architecture is broad, but the
subsystems are still fairly explicit once you identify the right runtime.
