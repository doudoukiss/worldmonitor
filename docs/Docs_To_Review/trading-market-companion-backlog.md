# Trading Market Companion Implementation Backlog

Snapshot taken on 2026-03-21 from the local checkout at
`/Users/sonics/project/worldmonitor`.

This backlog turns
`docs/Docs_To_Review/trading-market-companion-mvp-spec.md`
into a concrete implementation sequence.

It assumes a new repo, not a continuation of the current WorldMonitor codebase.

## 1. Delivery Strategy

The build should proceed in seven milestones:

1. foundation
2. market data core
3. macro and energy core
4. dashboard and watchlists
5. briefs
6. alerts
7. journal and polish

The priority is to produce a usable local system quickly, not to maximize early
architecture polish.

## 2. Proposed Repo Shape

Use this structure in the new repo:

```text
trading-market-companion/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── config/
│   ├── db/
│   ├── sources/
│   ├── domain/
│   ├── scheduler/
│   ├── delivery/
│   ├── shared/
│   └── ui/
├── docs/
├── scripts/
└── data/
```

## 3. Milestone 1: Foundation

Goal:

- local app boots
- config loads
- database opens
- health page works

## 3.1 Project bootstrap

Task:

- create the new repo
- initialize package manager workspace
- set up TypeScript, linting, formatting, and test runner

Suggested ownership:

- `apps/api/*`
- `apps/web/*`
- root workspace config

Acceptance:

- one install command works
- one dev command works
- typecheck passes

## 3.2 Environment and config module

Task:

- implement env parsing and validation
- expose source availability and feature flags

Files:

- `packages/config/src/env.ts`
- `packages/config/src/index.ts`
- `.env.example`

Acceptance:

- app can distinguish `configured`, `missing`, and `optional`
- startup fails clearly on malformed config

## 3.3 Database bootstrap

Task:

- add SQLite connection
- add migrations runner
- add migration folder

Files:

- `packages/db/src/client.ts`
- `packages/db/src/migrate.ts`
- `packages/db/migrations/0001_init.sql`

Acceptance:

- db file is created automatically
- migrations run on startup

## 3.4 API server skeleton

Task:

- add local backend entrypoint
- add health endpoint
- add settings-status endpoint

Files:

- `apps/api/src/server.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/routes/settings.ts`

Acceptance:

- `GET /health` works
- `GET /settings/status` works

## 3.5 Web app shell

Task:

- add frontend shell
- add basic navigation tabs
- add source-status display

Files:

- `apps/web/src/main.tsx` or equivalent
- `apps/web/src/app.tsx`
- `apps/web/src/pages/*`

Acceptance:

- web app loads
- health status is visible

## 4. Milestone 2: Market Data Core

Goal:

- watchlist quotes refresh reliably

## 4.1 Asset and watchlist schema

Task:

- add tables:
  - `assets`
  - `watchlists`
  - `watchlist_assets`
  - `quote_snapshots`

Files:

- `packages/db/migrations/0002_watchlists.sql`

Acceptance:

- watchlists can be stored and queried

## 4.2 Finnhub client

Task:

- implement Finnhub quote client
- implement basic candles fetch
- normalize symbol results

Files:

- `packages/sources/src/finnhub/client.ts`
- `packages/sources/src/finnhub/types.ts`
- `packages/sources/src/finnhub/normalize.ts`

Acceptance:

- quotes can be fetched for a symbol batch
- errors are normalized

## 4.3 Yahoo fallback client

Task:

- implement quote fallback for selected assets

Files:

- `packages/sources/src/yahoo/client.ts`

Acceptance:

- fallback works for at least core indices and commodity proxies

## 4.4 Quote ingestion service

Task:

- fetch quotes for active watchlists
- store snapshots
- keep latest snapshot cache

Files:

- `packages/domain/src/quotes/service.ts`
- `packages/domain/src/quotes/repository.ts`

Acceptance:

- latest quotes are queryable
- older snapshots remain stored

## 4.5 Quote scheduler job

Task:

- add `quotes.fast` job

Files:

- `packages/scheduler/src/jobs/quotes-fast.ts`

Acceptance:

- quotes refresh on schedule

## 5. Milestone 3: Macro And Energy Core

Goal:

- macro and energy state exist as first-class system inputs

## 5.1 Macro schema

Task:

- add `macro_snapshots`

Files:

- `packages/db/migrations/0003_macro.sql`

## 5.2 FRED client

Task:

- implement FRED observations fetch
- support batch refresh of selected series

Files:

- `packages/sources/src/fred/client.ts`
- `packages/sources/src/fred/series.ts`

Acceptance:

- core macro series refresh and normalize cleanly

## 5.3 BIS client

Task:

- implement optional BIS structural macro fetch

Files:

- `packages/sources/src/bis/client.ts`

Acceptance:

- BIS can be turned on and stored

## 5.4 Energy schema

Task:

- add `energy_snapshots`

Files:

- `packages/db/migrations/0004_energy.sql`

## 5.5 EIA client

Task:

- implement targeted EIA dataset fetches
- normalize inventory and production inputs

Files:

- `packages/sources/src/eia/client.ts`
- `packages/sources/src/eia/normalize.ts`

Acceptance:

- at least one inventory snapshot and one production snapshot can be stored

## 5.6 Macro and energy scheduler jobs

Task:

- add:
  - `macro.medium`
  - `energy.medium`
  - optional `bis.slow`

Files:

- `packages/scheduler/src/jobs/macro-medium.ts`
- `packages/scheduler/src/jobs/energy-medium.ts`
- `packages/scheduler/src/jobs/bis-slow.ts`

Acceptance:

- macro and energy tables refresh on schedule

## 6. Milestone 4: Dashboard And Watchlists

Goal:

- product becomes usable without briefs or alerts yet

## 6.1 Watchlist APIs

Task:

- create watchlist CRUD endpoints
- add asset attach/remove endpoints

Files:

- `apps/api/src/routes/watchlists.ts`

Acceptance:

- user can create, rename, and edit watchlists

## 6.2 Dashboard aggregation service

Task:

- aggregate latest quotes
- aggregate macro state
- aggregate energy state
- aggregate recent headlines placeholder

Files:

- `packages/domain/src/dashboard/service.ts`
- `apps/api/src/routes/dashboard.ts`

Acceptance:

- `GET /dashboard` returns a usable snapshot

## 6.3 Web watchlist views

Task:

- implement watchlist list and detail views
- show latest quote cards and changes

Files:

- `apps/web/src/pages/watchlists/*`

Acceptance:

- watchlists are editable in UI

## 6.4 Web dashboard

Task:

- implement dashboard cards:
  - regime placeholder
  - energy placeholder
  - movers
  - macro pulse

Files:

- `apps/web/src/pages/dashboard/*`

Acceptance:

- dashboard is useful before briefs are added

## 7. Milestone 5: Headline Layer

Goal:

- explain market moves with a small headline layer

## 7.1 Headline schema

Task:

- add `headline_events`

Files:

- `packages/db/migrations/0005_headlines.sql`

## 7.2 RSS client

Task:

- add curated RSS fetcher
- normalize articles
- dedupe by URL/title

Files:

- `packages/sources/src/rss/client.ts`
- `packages/sources/src/rss/feeds.ts`

Acceptance:

- curated feed set refreshes successfully

## 7.3 GDELT client

Task:

- implement DOC 2.0 thematic search client
- define initial query set

Files:

- `packages/sources/src/gdelt/client.ts`
- `packages/sources/src/gdelt/queries.ts`

Acceptance:

- at least `energy`, `rates`, and `semis` themes work

## 7.4 Headline ingestion jobs

Task:

- add `news.medium`

Files:

- `packages/scheduler/src/jobs/news-medium.ts`

Acceptance:

- headlines persist and appear in the dashboard

## 8. Milestone 6: Signal Engine

Goal:

- turn raw data into interpretable state

## 8.1 Signal schema

Task:

- add table for latest signal state and history

Files:

- `packages/db/migrations/0006_signals.sql`

## 8.2 Market regime computation

Task:

- implement the MVP regime formula

Files:

- `packages/domain/src/signals/market-regime.ts`

Acceptance:

- returns `risk_on`, `neutral`, or `risk_off`

## 8.3 Energy state computation

Task:

- implement the MVP energy-state formula

Files:

- `packages/domain/src/signals/energy-state.ts`

Acceptance:

- returns `calm`, `firm`, `stressed`, or `shock`

## 8.4 Watchlist pressure computation

Task:

- implement numeric watchlist pressure score

Files:

- `packages/domain/src/signals/watchlist-pressure.ts`

Acceptance:

- score exists for each watchlist

## 8.5 Signal refresh job

Task:

- add `signals.fast`

Files:

- `packages/scheduler/src/jobs/signals-fast.ts`

Acceptance:

- signals are recomputed after quote refreshes

## 9. Milestone 7: Briefs

Goal:

- the product produces readable summaries

## 9.1 Brief schema

Task:

- add `brief_runs`

Files:

- `packages/db/migrations/0007_briefs.sql`

## 9.2 Brief input builder

Task:

- assemble structured input for:
  - morning
  - delta
  - close
  - energy

Files:

- `packages/domain/src/briefing/input-builder.ts`

## 9.3 Ollama integration

Task:

- implement optional local Ollama provider
- add provider health check

Files:

- `packages/domain/src/briefing/ollama.ts`

Acceptance:

- can generate one brief through Ollama when configured

## 9.4 Fallback briefing generator

Task:

- deterministic fallback formatter

Files:

- `packages/domain/src/briefing/fallback.ts`

Acceptance:

- briefs still work without Ollama

## 9.5 Brief APIs and UI

Task:

- add generate/list endpoints
- add web UI page

Files:

- `apps/api/src/routes/briefs.ts`
- `apps/web/src/pages/briefs/*`

Acceptance:

- user can generate and review briefs

## 10. Milestone 8: Alerts

Goal:

- useful alerts reach Telegram reliably

## 10.1 Alert schema

Task:

- add:
  - `alert_rules`
  - `alert_events`

Files:

- `packages/db/migrations/0008_alerts.sql`

## 10.2 Telegram delivery module

Task:

- implement send-message module

Files:

- `packages/delivery/src/telegram.ts`

Acceptance:

- test message works

## 10.3 Alert rule engine

Task:

- implement rules:
  - `asset_move`
  - `watchlist_pressure`
  - `energy_state_change`
  - `regime_change`
  - `scheduled_brief`

Files:

- `packages/domain/src/alerts/engine.ts`
- `packages/domain/src/alerts/rules/*`

Acceptance:

- at least three rules trigger correctly

## 10.4 Alert scheduler

Task:

- add `alerts.fast`

Files:

- `packages/scheduler/src/jobs/alerts-fast.ts`

Acceptance:

- alerts are evaluated after signal changes

## 10.5 Alert UI

Task:

- add alert rule management
- add alert history page

Files:

- `apps/web/src/pages/alerts/*`

Acceptance:

- user can create, enable, and disable rules

## 11. Milestone 9: Journal

Goal:

- the product supports decisions, not just monitoring

## 11.1 Journal schema

Task:

- add `journal_entries`

Files:

- `packages/db/migrations/0009_journal.sql`

## 11.2 Journal service

Task:

- support notes and actions
- support save-from-brief and save-from-alert

Files:

- `packages/domain/src/journal/service.ts`

## 11.3 Journal APIs and UI

Task:

- add CRUD endpoints
- add journal page

Files:

- `apps/api/src/routes/journal.ts`
- `apps/web/src/pages/journal/*`

Acceptance:

- notes and actions persist and are editable

## 12. Milestone 10: Operational Polish

Goal:

- system is trustworthy and debuggable

## 12.1 Source health tracking

Task:

- track per-source:
  - last success
  - last failure
  - stale state
  - error message

Files:

- `packages/domain/src/health/*`

Acceptance:

- health page shows source status clearly

## 12.2 Logging

Task:

- add lightweight structured logs for:
  - fetches
  - scheduler jobs
  - alert sends
  - brief generation

Files:

- `packages/shared/src/logger.ts`

## 12.3 Seeded starter data

Task:

- add starter assets and watchlists

Files:

- `scripts/seed-starter-data.ts`

Acceptance:

- fresh install is usable immediately

## 13. Cross-Cutting Rules

These apply to the whole implementation.

### Simplicity

- do not introduce Redis in MVP
- do not introduce relay infrastructure in MVP
- do not introduce cloud sync in MVP

### Determinism

- all scheduled jobs must persist last-run status
- stale data must be visible in UI

### Fallbacks

- missing Ollama must not block briefs
- missing Yahoo fallback must not block core quotes
- missing BIS must not block macro state

### Alert safety

- every alert rule must have cooldown support
- every Telegram send must be persisted with result state

## 14. Testing Backlog

At minimum, add tests for:

- env parsing
- db migrations
- Finnhub normalization
- EIA normalization
- FRED normalization
- signal formulas
- brief fallback generation
- Telegram payload formatting
- alert cooldown behavior

Suggested files:

- `packages/config/src/*.test.ts`
- `packages/domain/src/signals/*.test.ts`
- `packages/domain/src/alerts/*.test.ts`
- `packages/domain/src/briefing/*.test.ts`

## 15. MVP Exit Criteria

The implementation backlog is complete when:

- one local command starts the product
- watchlists refresh automatically
- dashboard is meaningful
- one morning brief and one delta brief work
- Telegram alerts work
- notes and actions persist
- source health is visible
- missing providers degrade gracefully

## 16. Recommended Immediate Next Tasks

If starting today, do these first:

1. create the new repo and workspace structure
2. implement config and SQLite bootstrap
3. implement Finnhub client and watchlist schema
4. build `GET /health`, `GET /dashboard`, and `GET /watchlists`
5. build the simplest web dashboard shell

That is the shortest path to turning the spec into a running system.
