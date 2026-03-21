# Quality Guardrails And Drift Notes

## Guardrails That Are Clearly Enforced

### Pre-push hook

`.husky/pre-push` runs a meaningful local quality gate:

- `npm run typecheck`
- `npm run typecheck:api`
- CJS syntax validation for scripts
- bundle checks for legacy edge JS files
- edge function guardrail tests
- markdown lint
- MDX lint
- proto freshness check when proto-related paths changed
- desktop/web version sync check

This is a strong signal that the repo expects contributors to preserve runtime
boundaries and generated artifacts, not just pass TypeScript.

### CI

The active workflows cover:

- typecheck
- unit/data tests
- proto freshness
- docker publishing
- desktop build
- Linux app smoke testing
- markdown lint

The CI set is broader than the short workflow table in some docs suggests.

### Edge-function isolation rules

`tests/edge-functions.test.mjs` enforces several important boundaries:

- top-level legacy JS edge files cannot use `node:` imports
- those JS edge files cannot import from `../server/`
- those JS edge files cannot import from `../src/`
- new top-level JS endpoints must be explicitly allowlisted

That means the repo has an intentional split:

- legacy self-contained edge JS
- typed domain gateways in TypeScript

### Proto freshness

`make generate` is treated as a required part of contract changes, not an
optional developer convenience.

## Drift Observed During Review

### `CONTRIBUTING.md` is behind the repo

Examples of likely stale statements:

- says there are 3 variants, but active code supports 5
- says 14 languages, but `src/locales/` has 21 JSON files
- says about 50 panels, but `src/components/` now has 87 top-level files and 57
  direct `Panel` subclasses
- says 17 domain services, but the repo currently has 25 `service.proto` files
- older docs disagree about whether the dev server should be `3000` or `5173`;
  this checkout is currently running on `http://localhost:3000`

### Variant config has two stories

There are dedicated files under `src/config/variants/`, but the active exports
used by `App.ts` come from `src/config/panels.ts`.

That can mislead future contributors into editing the wrong file set.

### The "Vanilla TypeScript" description is mostly true, but incomplete

The app is overwhelmingly custom TypeScript + DOM code, but the dependency graph
does include Preact and there is at least one direct Preact component file.

### Documentation counts appear partially stale

The top-level docs are still directionally useful, but counts such as number of
variants, languages, panels, or services should be verified from code before
reusing them in new docs.

### Local-runtime docs can drift even when the code is fine

During follow-up work on 2026-03-21, the local setup changed in ways that some
internal notes had not yet caught up with:

- `.env.local` was added and is now part of the normal local workflow in this
  checkout
- local Ollama is configured
- `EIA_API_KEY` and `FINNHUB_API_KEY` are configured locally
- `keys.txt` still exists, but remains reference-only rather than a runtime
  source

This is a reminder that contributor docs should distinguish between:

- repo capability in theory
- the current checked-out local environment

## Suggested Follow-Up Maintenance

1. Pick one variant-config source of truth and either delete or annotate the
   secondary one.
2. Refresh `CONTRIBUTING.md` with current variant, locale, service, and dev-port
   facts.
3. Add a short internal note explaining which docs are canonical for:
   runtime topology, contracts, and contributor workflow.
4. If `pro-test/` is still active, document its relationship to the main app.
   If not, label it as experimental to reduce confusion.
