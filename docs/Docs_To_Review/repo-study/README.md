# WorldMonitor Repo Study

Snapshot taken on 2026-03-20 from the local checkout at
`/Users/sonics/project/worldmonitor`.

This folder is an internal study pack, not a source-of-truth spec. It records
what the repo appears to do today based on reading the active entry points,
runtime glue, build config, and guardrail tests.

## Scope

- Read the top-level docs and build configs.
- Traced the browser SPA entry points and core orchestration classes.
- Traced the proto, server, edge gateway, bootstrap, seed, and health paths.
- Traced the Tauri desktop shell and Node.js sidecar boundary.
- Checked test, pre-push, and CI guardrails.

## Verified Quick Stats

| Metric | Value | Notes |
| --- | --- | --- |
| Active site variants | 5 | `full`, `tech`, `finance`, `happy`, `commodity` |
| Top-level `src/components/*.ts` files | 87 | Mix of panels, maps, modals, support components |
| Concrete `class ... extends Panel` definitions | 57 | Class-based panel model is still the main UI pattern |
| Top-level `src/services/*.ts` files | 104 | Large service layer and data adapters |
| `src` TypeScript files | 374 | No `.tsx` files in `src` |
| Direct `preact` imports in `src` | 1 | `src/components/VerificationChecklist.ts` |
| Proto service definitions | 25 | `find proto/worldmonitor -name service.proto` |
| RPC edge catch-all files | 25 | `api/**/[rpc].ts` |
| Legacy top-level edge JS endpoints | 22 | `api/*.js` excluding `_*.js` helpers |
| Top-level test files in `tests/` | 64 | `node:test` plus targeted HTML harnesses |
| Locales | 21 | `src/locales/*.json` |

## Main Takeaways

1. The app is still primarily a hand-rolled, class-based TypeScript SPA, even
   though the dependency list includes Preact.
2. The real frontend source of truth for variant defaults is
   `src/config/panels.ts`, not the parallel files in `src/config/variants/`.
3. The server/API layer is strongly proto-first now. New typed endpoints go
   through `proto/` -> `src/generated/` -> `server/worldmonitor/` ->
   `api/<domain>/v1/[rpc].ts`.
4. The desktop runtime is not a thin wrapper. It has its own trust boundary,
   key management, local token flow, dynamic sidecar loading, and SSRF /
   networking safeguards.
5. Some human docs have drifted behind the repo. The biggest gaps are variant
   count, locale count, panel count, and where active config actually lives.

## Files In This Pack

- `beginner-tutorial.md`
- `repo-inventory.md`
- `frontend-runtime.md`
- `api-data-pipeline.md`
- `desktop-security.md`
- `quality-and-drift.md`
- `data-source-availability-audit.md`
- `gui-source-map.md`
