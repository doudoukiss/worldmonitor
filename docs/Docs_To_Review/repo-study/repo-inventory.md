# Repo Inventory

## What The Repository Actually Contains

The repo is not just one web app. It is a multi-runtime workspace with at least
six distinct pieces:

| Area | Purpose | Primary entry points |
| --- | --- | --- |
| Browser SPA | Main dashboard | `src/main.ts`, `src/App.ts` |
| Edge API layer | Vercel endpoints and gateways | `api/`, `server/gateway.ts` |
| Proto contract layer | Typed RPC contracts and OpenAPI output | `proto/`, `Makefile`, `src/generated/`, `docs/api/` |
| Desktop app | Tauri shell and local sidecar | `src-tauri/src/main.rs`, `src-tauri/sidecar/local-api-server.mjs` |
| Relay / seed services | Railway long-running jobs and feed writers | `scripts/ais-relay.cjs`, `scripts/seed-*.mjs` |
| Public docs / marketing extras | Mintlify docs, Astro blog, separate pro test app | `docs/`, `blog-site/`, `pro-test/` |

## Top-Level Directory Read

| Path | Observed role |
| --- | --- |
| `src/` | Main SPA code. Almost entirely TypeScript classes and utilities. |
| `api/` | Two kinds of endpoints: top-level legacy JS handlers and typed domain gateways in `api/<domain>/v1/[rpc].ts`. |
| `server/` | Shared typed handler implementations and gateway plumbing used by the domain gateways. |
| `proto/` | Sebuf + protobuf contracts. This is the API contract root. |
| `src-tauri/` | Rust shell plus Node.js sidecar. Desktop is a first-class runtime, not a packaging afterthought. |
| `scripts/` | Seeders, packaging, relay service, data fetch helpers. |
| `tests/` | Mostly `node:test` coverage for handlers, configs, cache logic, MDX, and guardrails. |
| `e2e/` | Playwright specs and screenshot-style map harnesses. |
| `docs/` | Public Mintlify docs plus some review/backlog docs. |
| `blog-site/` | Separate Astro site built into `public/blog/` on main build. |
| `pro-test/` | Separate React/Tailwind app, apparently exploratory or marketing related. |
| `convex/` | Minimal backend footprint, mainly for contact / registration workflows. |

## Build And Runtime Entry Points

### Web build

- `package.json` drives Vite for the SPA.
- `vite.config.ts` does more than bundling:
  - injects variant-specific HTML metadata
  - precompresses assets with Brotli
  - mounts a local sebuf API plugin for dev parity
  - adds a Polymarket dev shim

### Browser startup

- `src/main.ts` initializes Sentry and Vercel analytics.
- `src/main.ts` then instantiates `App`.
- `src/App.ts` is the real orchestration center.

### Edge/API startup

- New typed API routes are thin wrappers like
  `api/market/v1/[rpc].ts`.
- Those wrappers call `createDomainGateway(...)` from
  `server/gateway.ts`.
- The gateway receives routes generated from protobuf service stubs plus a
  domain handler from `server/worldmonitor/<domain>/v1/handler.ts`.

### Desktop startup

- `src-tauri/src/main.rs` launches the Tauri app, creates trusted windows, and
  manages secrets and local sidecar lifecycle.
- The Node.js sidecar then dynamically loads handlers out of `api/`.

## Notable Structural Observations

### The SPA is mostly not framework-driven

Despite the dependency list containing `preact`, the working pattern in `src/`
is still:

- class-based UI objects
- direct DOM mutation
- shared mutable app context
- explicit manager classes for subsystems

There are no `.tsx` files in `src`, and only one direct `preact` import was
found under `src/`.

### `src/config/variants/*.ts` looks secondary today

The repo still contains dedicated variant config files under
`src/config/variants/`, but the active defaults imported by `App.ts` come from
`src/config/panels.ts` via `src/config/index.ts`.

That makes `src/config/panels.ts` the practical source of truth for:

- default panel availability
- default layer toggles
- mobile layer defaults
- panel category grouping

### Public docs are not the only documentation layer

There is a split between:

- canonical-ish public docs in `docs/`
- internal review / scratch docs in `docs/Docs_To_Review/`
- architectural summary docs like `ARCHITECTURE.md`

Those documents are useful, but they are not perfectly synchronized with the
active code paths.
