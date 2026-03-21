# Trading Market Companion MVP Spec

Snapshot taken on 2026-03-21 from the local checkout at
`/Users/sonics/project/worldmonitor`.

This document turns the higher-level plan in
`docs/Docs_To_Review/trading-market-companion-plan.md` into a concrete MVP
specification.

It is intentionally narrow. The goal is to ship a small local-first system that
is reliable and useful, not to recreate WorldMonitor.

## 1. MVP Goal

Build a local-first market intelligence companion that:

- tracks a small set of watchlists
- refreshes a small number of market and macro sources predictably
- generates briefings
- computes a few clear signals
- sends Telegram alerts
- stores notes and actions locally

The MVP should be useful for one user on one Mac before anything else.

## 2. MVP Source Stack

### Required

- Finnhub
- FRED
- EIA
- CoinGecko
- curated RSS
- GDELT DOC 2.0
- Telegram Bot API

### Optional but supported in MVP

- Ollama
- Yahoo Finance fallback
- BIS

### Explicitly out of scope

- maps
- TV
- webcams
- sync
- multi-user accounts
- cloud deployment
- broad geopolitical ingestion
- relay infrastructure

## 3. Runtime Model

The MVP should be a two-part local system:

### 1. Local backend

Responsibilities:

- provider fetches
- cache management
- scheduler
- signal computation
- briefing generation
- Telegram delivery
- local API for frontend

### 2. Local frontend

Responsibilities:

- dashboard
- watchlists
- briefs
- alerts history
- notes
- actions
- settings

## 4. Recommended Tech Shape

This is the recommended minimal stack.

### Backend

- TypeScript
- one local HTTP server
- SQLite
- cron-like in-process scheduler

### Frontend

- simple web UI
- one route shell with a few pages or tabs

### LLM

- Ollama via OpenAI-compatible endpoint if configured
- rules-based fallback if not configured

## 5. Config Contract

The MVP should support these environment variables.

### Required for full functionality

- `FINNHUB_API_KEY`
- `FRED_API_KEY`
- `EIA_API_KEY`
- `COINGECKO_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### Optional

- `OLLAMA_API_URL`
- `OLLAMA_MODEL`
- `YAHOO_FALLBACK_ENABLED`
- `BIS_ENABLED`

### Example local env

```env
FINNHUB_API_KEY=
FRED_API_KEY=
EIA_API_KEY=
COINGECKO_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
OLLAMA_API_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
YAHOO_FALLBACK_ENABLED=true
BIS_ENABLED=false
```

## 6. Primary Product Surfaces

The MVP should have six UI sections.

### Dashboard

Shows:

- market regime
- macro pulse
- energy state
- watchlist movers
- latest important headlines
- current alert state

### Watchlists

Supports:

- one or more watchlists
- price changes
- volume context
- recent related headlines

### Briefs

Supports:

- morning brief
- intraday delta brief
- end-of-day brief
- energy brief

### Alerts

Shows:

- triggered alerts
- current rule status
- Telegram delivery result

### Journal

Supports:

- notes
- actions
- save from brief
- save from alert

### Settings

Supports:

- API keys
- Ollama config
- refresh cadence
- Telegram delivery settings

## 7. MVP Modules

These are the concrete modules the backend should have.

## 7.1 Core infrastructure

### `config`

Responsibilities:

- read env
- validate config
- expose feature availability

Exports:

- `loadConfig()`
- `isSourceEnabled(sourceId)`
- `getConfiguredProviders()`

### `db`

Responsibilities:

- SQLite connection
- migrations
- typed query helpers

Exports:

- `openDb()`
- `runMigrations()`

### `scheduler`

Responsibilities:

- manage recurring refresh jobs
- manage on-demand jobs
- expose job status

Exports:

- `startScheduler()`
- `runJobNow(jobId)`

### `cache`

Responsibilities:

- in-memory TTL cache for hot reads
- avoid duplicate upstream fetches

Exports:

- `getCached()`
- `setCached()`
- `withSingleFlight()`

## 7.2 Source clients

### `sources/finnhub`

Responsibilities:

- quote fetch
- candles fetch
- company news fetch
- earnings/event fetch

Main methods:

- `fetchQuotes(symbols)`
- `fetchCandles(symbol, resolution, from, to)`
- `fetchCompanyNews(symbol, from, to)`

### `sources/fred`

Responsibilities:

- fetch series observations
- normalize macro series

Main methods:

- `fetchSeries(seriesId)`
- `fetchSeriesBatch(seriesIds)`

### `sources/eia`

Responsibilities:

- fetch petroleum and energy datasets
- normalize energy snapshots

Main methods:

- `fetchEnergySeries(seriesId)`
- `fetchInventorySnapshot()`
- `fetchProductionSnapshot()`

### `sources/coingecko`

Responsibilities:

- fetch crypto quotes
- fetch stablecoin and market context

Main methods:

- `fetchCryptoQuotes(ids)`
- `fetchStablecoinSummary()`

### `sources/rss`

Responsibilities:

- fetch curated feeds
- normalize articles
- deduplicate obvious duplicates

Main methods:

- `fetchFeed(feedId)`
- `fetchAllFeeds()`

### `sources/gdelt`

Responsibilities:

- run thematic document searches
- normalize documents into headline events

Main methods:

- `searchDocuments(query, options)`

### `sources/yahoo`

Responsibilities:

- fallback quotes for selected symbols

Main methods:

- `fetchFallbackQuotes(symbols)`

### `sources/bis`

Responsibilities:

- slower structural macro context

Main methods:

- `fetchPolicyRates()`
- `fetchExchangeRateContext()`

### `delivery/telegram`

Responsibilities:

- send Telegram alerts
- send briefing summaries

Main methods:

- `sendMessage(text)`
- `sendAlert(alert)`
- `sendBrief(brief)`

## 7.3 Domain services

### `watchlists`

Responsibilities:

- manage watchlists
- link assets to watchlists
- compute watchlist summaries

### `briefing`

Responsibilities:

- generate brief inputs
- build text summaries
- call Ollama if available
- fall back to rules-based text

### `signals`

Responsibilities:

- compute regime and energy signals
- compute watchlist pressure
- compute alert candidates

### `alerts`

Responsibilities:

- evaluate rules
- persist alert events
- trigger Telegram delivery

### `journal`

Responsibilities:

- notes
- actions
- save-from-brief
- save-from-alert

## 8. Database Schema

Use SQLite with the following MVP tables.

### `assets`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `symbol` | text unique | e.g. `AAPL`, `BTC`, `CL=F` |
| `label` | text | display label |
| `asset_type` | text | equity, etf, index, commodity, crypto, macro |
| `provider` | text | primary provider |
| `active` | integer | 1 or 0 |
| `created_at` | integer | unix ms |

### `watchlists`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `name` | text | user-defined |
| `description` | text | optional |
| `sort_order` | integer | ui ordering |
| `created_at` | integer | unix ms |

### `watchlist_assets`

| Column | Type | Notes |
| --- | --- | --- |
| `watchlist_id` | text | fk |
| `asset_id` | text | fk |
| `sort_order` | integer | ui ordering |
| `alert_enabled` | integer | 1 or 0 |

### `quote_snapshots`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `asset_id` | text | fk |
| `provider` | text | finnhub, yahoo, coingecko |
| `price` | real | current price |
| `change_pct` | real | percent move |
| `volume` | real | nullable |
| `high` | real | nullable |
| `low` | real | nullable |
| `snapshot_at` | integer | unix ms |

### `macro_snapshots`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `series_id` | text | e.g. `DGS10` |
| `provider` | text | fred or bis |
| `value` | real | normalized value |
| `snapshot_at` | integer | unix ms |

### `energy_snapshots`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `inventory_change` | real | normalized if needed |
| `production_level` | real | nullable |
| `wti_reference` | real | nullable |
| `brent_reference` | real | nullable |
| `energy_state` | text | calm, firm, stressed, shock |
| `snapshot_at` | integer | unix ms |

### `headline_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `source_type` | text | rss or gdelt |
| `source_name` | text | source label |
| `title` | text | headline |
| `url` | text | canonical link |
| `published_at` | integer | unix ms |
| `theme` | text | energy, rates, semis, etc |
| `severity` | text | low, medium, high |

### `brief_runs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `brief_type` | text | morning, delta, close, energy |
| `summary` | text | final text |
| `provider` | text | ollama or fallback |
| `generated_at` | integer | unix ms |

### `alert_rules`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `name` | text | user label |
| `rule_type` | text | move, regime, energy, watchlist |
| `scope` | text | asset, watchlist, global |
| `threshold_json` | text | serialized config |
| `enabled` | integer | 1 or 0 |
| `cooldown_sec` | integer | cooldown |

### `alert_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `rule_id` | text | fk |
| `title` | text | alert title |
| `body` | text | alert body |
| `status` | text | pending, sent, failed |
| `sent_at` | integer | nullable |
| `created_at` | integer | unix ms |

### `journal_entries`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text pk | internal id |
| `entry_type` | text | note or action |
| `title` | text | required |
| `body` | text | optional |
| `status` | text | open, done, archived |
| `linked_asset_symbols` | text | serialized list |
| `linked_brief_id` | text | nullable |
| `linked_alert_id` | text | nullable |
| `created_at` | integer | unix ms |

## 9. Watchlist Design

The MVP should ship with three starter watchlists.

### `macro`

Suggested contents:

- `SPY`
- `QQQ`
- `TLT`
- `GLD`
- `UUP`
- `BTC`
- `ETH`

### `energy`

Suggested contents:

- `CL=F`
- `BZ=F`
- `XLE`
- `XOM`
- `CVX`

### `semis`

Suggested contents:

- `NVDA`
- `AMD`
- `TSM`
- `ASML`
- `SOXX`

The user can edit them, but the MVP should feel useful on first launch.

## 10. Refresh Jobs

The scheduler should define these jobs.

### `quotes.fast`

- every 60 seconds
- fetch watchlist quotes from Finnhub
- use Yahoo fallback when enabled and necessary

### `crypto.fast`

- every 60 seconds
- fetch CoinGecko quotes for configured crypto assets

### `macro.medium`

- every 30 minutes
- fetch configured FRED series

### `energy.medium`

- every 30 minutes
- fetch EIA energy datasets used by MVP

### `bis.slow`

- once daily
- fetch BIS structural data if enabled

### `news.medium`

- every 5 minutes
- fetch curated RSS
- fetch selected GDELT thematic searches

### `signals.fast`

- every 60 seconds after quote refresh
- recompute signal states

### `alerts.fast`

- after signal updates
- evaluate enabled rules

## 11. Suggested FRED Series

The MVP should not try to ingest dozens of macro series.

Use a small set first:

- `DGS2`
- `DGS10`
- `T10Y2Y`
- `FEDFUNDS`
- `CPIAUCSL`
- `UNRATE`
- `DXY` equivalent if chosen via another source, not FRED directly if awkward

The exact list can be adjusted, but the principle is:

- few series
- high-signal series
- easy-to-explain series

## 12. Suggested EIA Inputs

The MVP should focus on the most market-relevant energy inputs.

Use:

- crude inventory change
- gasoline inventory change
- distillate inventory change
- production trend
- optional refinery utilization later

The first version should not attempt to mirror the full EIA surface.

## 13. GDELT Query Set

Use a small fixed thematic query set first.

### Suggested themes

- `energy`
- `rates`
- `inflation`
- `tariffs`
- `shipping disruption`
- `semiconductors`

Each theme should have one or two tuned query strings, not a giant search matrix.

## 14. Signal Formulas

These should be simple and legible.

## 14.1 Market regime

Output:

- `risk_on`
- `neutral`
- `risk_off`

Inputs:

- SPY daily move
- QQQ daily move
- TLT daily move
- BTC daily move
- current energy state

Suggested MVP scoring:

- start at `0`
- add `+1` if SPY > 0.75%
- add `+1` if QQQ > 1.0%
- add `+1` if BTC > 2.0%
- subtract `1` if TLT < -1.0%
- subtract `1` if energy state is `stressed`
- subtract `2` if energy state is `shock`

Interpretation:

- score `>= 2` => `risk_on`
- score `-1` to `1` => `neutral`
- score `<= -2` => `risk_off`

## 14.2 Energy state

Output:

- `calm`
- `firm`
- `stressed`
- `shock`

Inputs:

- Brent or WTI move
- latest inventory surprise
- production direction
- energy-related high-severity headlines

Suggested MVP scoring:

- start at `0`
- add `+1` if crude > 1.5% up on the day
- add `+1` if crude > 3.0% up on the day
- add `+1` if inventory draw is meaningfully tighter than prior trend
- add `+1` if production trend weakens
- add `+1` if high-severity energy headlines appear

Interpretation:

- `0` => `calm`
- `1` => `firm`
- `2-3` => `stressed`
- `>=4` => `shock`

## 14.3 Watchlist pressure

Output:

- numeric score `0-100`

Inputs:

- largest negative move
- largest positive move
- number of assets above threshold move
- related headlines

Suggested MVP formula:

- base `0`
- add up to `30` from worst negative mover
- add up to `20` from strongest positive mover
- add up to `25` from breadth of threshold moves
- add up to `25` from related headline severity

This is not meant to be perfect. It is meant to be stable and interpretable.

## 15. Brief Types

The MVP should ship four brief types.

### `morning`

Purpose:

- overnight and current-state summary

Inputs:

- latest quotes
- regime
- macro pulse
- energy state
- top headlines

### `delta`

Purpose:

- what changed since last open or last brief

Inputs:

- changed quotes
- changed signals
- new headlines

### `close`

Purpose:

- end-of-day review

Inputs:

- session movers
- signal changes
- key headlines

### `energy`

Purpose:

- dedicated oil and petroleum summary

Inputs:

- energy snapshots
- crude context
- energy headlines

## 16. Briefing Logic

### If Ollama is available

- generate compact structured narrative
- cap output length aggressively
- include short bullet-like sections in prose

### If Ollama is unavailable

- use deterministic fallback templates
- generate brief from top signal changes and top headlines

The fallback path must be good enough that the product is still usable.

## 17. Alert Rules

The MVP should support only a few alert types.

### `asset_move`

Trigger:

- one asset crosses move threshold

Example:

- `NVDA down 4%`

### `watchlist_pressure`

Trigger:

- watchlist pressure score crosses threshold

Example:

- `Semis watchlist pressure > 70`

### `energy_state_change`

Trigger:

- energy state changes upward

Example:

- `firm -> stressed`

### `regime_change`

Trigger:

- market regime changes

Example:

- `neutral -> risk_off`

### `scheduled_brief`

Trigger:

- time-based

Example:

- send morning brief at 08:00 local time

## 18. Telegram Message Contract

Telegram messages should stay short.

### Alert format

```text
[Risk-Off Alert]
Regime changed from neutral to risk_off.
SPY -1.4%, QQQ -2.1%, BTC -3.6%, energy stressed.
```

### Brief format

```text
[Morning Brief]
Risk regime is neutral. Energy is firm. Semis are the key watchlist today.
Main themes: rates, oil, semis.
Top item: ...
```

## 19. API Surface

The backend should expose a small HTTP API.

### Read endpoints

- `GET /health`
- `GET /watchlists`
- `GET /dashboard`
- `GET /briefs`
- `GET /alerts`
- `GET /journal`
- `GET /settings/status`

### Write endpoints

- `POST /watchlists`
- `POST /watchlists/:id/assets`
- `POST /briefs/generate`
- `POST /alerts/rules`
- `POST /journal`
- `POST /journal/actions/:id/complete`
- `POST /settings/test-telegram`

## 20. Frontend MVP Layout

Use a simple tab layout.

### Top nav tabs

- Dashboard
- Watchlists
- Briefs
- Alerts
- Journal
- Settings

### Dashboard cards

- Regime
- Energy State
- Macro Pulse
- Watchlist Movers
- Headlines
- Latest Alerts

## 21. Health Model

The system should always show source health.

Each provider should report:

- configured or missing
- last success time
- last failure time
- stale or fresh

This is one of the most useful lessons to keep from WorldMonitor.

## 22. Logging And Diagnostics

The MVP should keep lightweight logs for:

- source fetch failures
- alert sends
- brief generation
- scheduler runs

Do not overbuild observability first, but do not hide failure state either.

## 23. MVP Acceptance Criteria

The MVP is complete when all of these are true.

### Product

- one user can create and edit watchlists
- dashboard updates without manual refresh
- one morning brief can be generated
- one delta brief can be generated
- at least three alert rule types work
- Telegram delivery works
- notes and actions persist locally

### Technical

- app starts locally with one command
- SQLite schema migrates automatically
- source health is visible
- missing providers degrade clearly
- Ollama is optional, not required

### Operational

- quote refresh remains predictable
- stale data is visible
- alert spam is controlled with cooldowns

## 24. Recommended Build Order

Build in this order:

1. config + db + health
2. watchlists + quote ingestion
3. macro + energy ingestion
4. dashboard
5. signals
6. briefs
7. alerts + Telegram
8. journal

That is the shortest path to a useful product.
