# API And Data Pipeline

## The Typed API Path

The typed API stack is now clearly proto-first.

The path is:

1. Define or change protobuf contracts in `proto/worldmonitor/...`
2. Run `make generate`
3. Generated output lands in:
   - `src/generated/client/`
   - `src/generated/server/`
   - `docs/api/`
4. Implement handler functions in `server/worldmonitor/<domain>/v1/`
5. Expose them through a thin edge gateway file in `api/<domain>/v1/[rpc].ts`

This is not just conceptual. The generated server route factories are wired
directly into the edge gateway wrappers.

## Gateway Design

`server/gateway.ts` is the central request pipeline for typed domain APIs.

It applies:

- origin filtering
- CORS headers
- preflight handling
- API key checks
- endpoint or global rate limiting
- route matching
- POST-to-GET fallback for stale clients
- top-level handler error boundary
- cache headers and ETag behavior

The design goal is bundle isolation by domain. Each domain edge function pulls
only the code it needs.

## Route Matching

`server/router.ts` is deliberately simple:

- static routes get O(1) map lookup
- dynamic routes get a light segment matcher

This keeps the gateway small and removes dependency on a larger router library.

## Typed Domain Layout

The `server/worldmonitor/` tree is organized by domain and version:

- `server/worldmonitor/market/v1/handler.ts`
- `server/worldmonitor/news/v1/handler.ts`
- `server/worldmonitor/intelligence/v1/handler.ts`
- etc.

The `handler.ts` files are thin composition layers. The actual work usually
lives in one-file-per-RPC modules beside them.

## Caching Model

Caching is layered, not single-tier.

### Redis helpers

`server/_shared/redis.ts` provides:

- plain JSON get / set
- batch get
- in-flight miss coalescing with `cachedFetchJson`
- negative caching via a sentinel
- optional sidecar-local cache behavior in desktop mode

### Example pattern

`server/worldmonitor/market/v1/list-market-quotes.ts` shows the intended cache
shape clearly:

1. try bootstrap/seed data from Redis
2. try in-memory cache inside the handler module
3. fall through to `cachedFetchJson(...)`
4. fetch upstream only when needed
5. preserve stale memory fallback on failure

That same "seed cache -> local cache -> shared Redis cache -> upstream" pattern
appears to be a recurring design choice across domains.

## Bootstrap Hydration

`api/bootstrap.js` is a read-only aggregator over Redis keys.

Important characteristics:

- it separates keys into `fast` and `slow` tiers
- it batches Redis GETs with the Upstash pipeline API
- it intentionally reads unprefixed production cache keys
- the frontend consumes it through `src/services/bootstrap.ts`

On the client side, `fetchBootstrapData()` fetches both tiers concurrently with
short timeouts and stores values in a one-shot hydration cache. Panels can then
consume hydrated data before making their own calls.

## Seed And Relay Path

The repo has two data-population modes:

- on-demand typed RPC handlers
- background seeders and relay loops

### `scripts/_seed-utils.mjs`

This file gives the shared seed conventions:

- Redis lock acquisition
- atomic publish
- payload size guard
- `seed-meta:*` freshness writes
- retry helpers

### `scripts/ais-relay.cjs`

Despite the name, this is broader than AIS relay.

It acts as a Railway long-running service with:

- WebSocket relay behavior
- upstream auth and rate limiting
- OREF polling and persistence
- Redis persistence helpers
- RSS/domain controls
- long-lived in-memory data management

The architecture docs describe this as a combined relay and seed service, and
the code matches that description.

## Health Monitoring

`api/health.js` is effectively a cache and seed freshness auditor.

It checks:

- bootstrap keys
- standalone keys
- `seed-meta:*` timestamps and record counts
- on-demand key exceptions
- fallback cascades such as live / stale / backup chains

This endpoint is doing more than a ping; it is a data freshness control plane.

## Legacy Edge Endpoints Still Matter

The repo still contains 22 top-level legacy JS endpoints under `api/`.

The guardrail test in `tests/edge-functions.test.mjs` makes the intent clear:

- new data endpoints should use the proto/sebuf path
- legacy JS files are allowlisted exceptions

That means the migration toward typed gateways is real, but the legacy layer is
still operational and maintained.
