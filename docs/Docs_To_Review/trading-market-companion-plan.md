# Trading Market Companion Plan

Snapshot taken on 2026-03-21 from the local checkout at
`/Users/sonics/project/worldmonitor`.

This is a rewritten plan for a new project that uses WorldMonitor only as a
reference.

The goal is not to rebuild WorldMonitor with fewer panels. The goal is to build
a much smaller system focused on trading global financial markets with a narrow,
deliberate source stack.

This version was re-checked against:

- `docs/data-sources.mdx`
- `docs/Docs_To_Review/repo-study/api-data-pipeline.md`
- `docs/Docs_To_Review/repo-study/data-source-availability-audit.md`

So the source decisions below are based not only on what sounds good in theory,
but also on what WorldMonitor itself already proved useful, what it treats as
core market data, and which source classes introduce operational complexity.

## 1. Product Goal

Build a local-first trading market companion that helps answer:

- what changed in global markets
- what changed in macro and rates
- what changed in energy
- what risk regime we are in now
- which assets or watchlists need attention
- which events should trigger a Telegram alert

It should be:

- smaller than WorldMonitor
- easier to reason about
- easier to refresh reliably
- more explicit about why each data source exists

## 2. What WorldMonitor Teaches Us

WorldMonitor's docs point to three useful lessons for the new project.

### Lesson 1: The market surfaces that matter are already narrower than the full app

From `docs/data-sources.mdx`, the clearly market-relevant source classes are:

- Finnhub-style market quotes
- Yahoo Finance as quote fallback
- CoinGecko crypto pricing
- EIA oil analytics
- FRED and BIS macro data
- WTO trade policy data
- Polymarket as optional sentiment overlay
- curated RSS / news discovery

That is already a much smaller universe than the rest of WorldMonitor.

### Lesson 2: Relay and seed-heavy sources are where operational complexity explodes

From `api-data-pipeline.md`, WorldMonitor relies heavily on:

- Redis bootstrap hydration
- seed loops
- relay services
- edge gateways
- stale cache fallback chains

That architecture makes sense for a broad intelligence product, but it is too
heavy for the first version of a trading-focused local companion.

The new project should therefore bias toward sources that can be fetched and
cached by a single local backend without:

- relay infrastructure
- long-running seed farms
- multi-tier cache choreography

### Lesson 3: "Public" is not the same thing as "operationally simple"

From `data-source-availability-audit.md`, some sources are public or low-cost
but still operationally fragile in practice.

That means the new project should prefer sources that are both:

- useful for trading
- simple to operate locally

## 3. Source Selection Principle

For this new project, a data source should be kept only if it does at least one
of these jobs well:

1. direct market pricing
2. macro / rates context
3. energy / commodity context
4. market-moving headline discovery
5. alert delivery

Everything else is noise for v1.

So the new project should prefer:

- structured official data
- stable public or low-friction APIs
- sources that clearly improve trading decisions

And it should reject:

- broad geopolitical novelty feeds
- live media
- infrastructure feeds that do not directly improve trading decisions
- sources that need complex relay or seed architectures

## 4. Selected Data Sources

This is the recommended source stack.

### Core sources

These should be in the MVP.

#### 1. Finnhub

Role:

- primary market data API for equities, ETFs, forex, and event context

Use for:

- watchlist quotes
- daily and intraday candles
- ETF and equity snapshots
- earnings calendar
- company news for watched names

Why keep it:

- it is directly relevant to trading
- you already have a key
- it covers a lot of market surface area with one provider

#### 2. FRED

Role:

- primary macro and rates source

Use for:

- policy rate context
- Treasury yields and curve proxies
- inflation series
- labor and growth context
- liquidity and credit indicators

Why keep it:

- official and structured
- very high signal for cross-asset trading
- much better as a macro backbone than ad hoc scraped sources

Important:

- this is not in your current `keys.txt`, but it should still be included in
  the new plan

#### 3. EIA

Role:

- primary energy and petroleum source

Use for:

- crude and petroleum context
- inventories
- production
- weekly petroleum status-derived signals
- energy regime scoring

Why keep it:

- official and structured
- highly relevant to oil, inflation, rates, equities, and risk sentiment
- you already have a key

#### 4. CoinGecko Demo API

Role:

- primary crypto spot market context

Use for:

- BTC / ETH / majors
- stablecoin health context
- sector/category context if needed later

Why keep it:

- crypto is relevant to global risk appetite
- simpler than adding a separate exchange abstraction first
- useful even if crypto is a secondary focus

Important:

- CoinGecko now expects an API key even for the demo plan, so treat this as a
  real configured dependency, not a no-key freebie

#### 5. BIS

Role:

- secondary macro structure source

Use for:

- policy-rate comparisons
- real effective exchange rates
- credit-to-GDP and cross-country macro structure

Why keep it:

- `docs/data-sources.mdx` shows BIS as part of the finance variant's macro
  backbone
- it is more structured and durable than trying to derive all macro context
  from ad hoc news

Why secondary instead of primary:

- FRED should still be the first macro backbone for MVP
- BIS is best used as a slower, structural layer rather than high-frequency
  refresh data

#### 6. GDELT DOC 2.0

Role:

- public machine-readable headline discovery layer

Use for:

- market-moving news search
- thematic scans such as:
  - `oil supply disruption`
  - `tariffs`
  - `central bank`
  - `semiconductors`
  - `shipping disruption`

Why keep it:

- public
- flexible
- better for structured event scanning than a pile of raw RSS feeds alone

#### 7. Curated RSS

Role:

- small editorial headline layer

Use for:

- top market and macro headlines
- a human-readable briefing layer

Keep this intentionally small:

- Reuters
- Financial Times
- CNBC
- Bloomberg if a stable feed path exists in practice
- one central-bank / official policy bucket

Why keep it:

- briefings need readable editorial headlines
- not everything should come from search-like APIs

But:

- RSS should be secondary, not the system backbone

#### 8. Telegram Bot API

Role:

- outbound alert delivery

Use for:

- push alerts to you
- optional command interface later

Why keep it:

- you already have bot credentials
- it gives the product immediate operational value

Important:

- in this new system, Telegram should be a delivery channel
- it should not be used as the primary market intelligence ingestion source

### Optional sources

These are useful, but should not be in MVP unless the core system is already
stable.

#### Polymarket

Role:

- optional prediction-market sentiment overlay

Use for:

- event probability context
- cross-checking macro and political market narratives

Why optional:

- useful, but not necessary for reliable core trading workflows
- should not distract from the main quote + macro + energy system

#### Yahoo Finance

Role:

- fallback for some quotes and indices

Why optional only:

- unofficial and fragile
- acceptable as a fallback, not as a core dependency

#### WTO

Role:

- optional trade-policy overlay

Use for:

- tariff and trade-restriction context
- cross-border trade friction summaries

Why optional:

- WorldMonitor treats WTO as useful, but it is slower-moving context, not a
  first-order MVP dependency
- it is more useful after the core market, macro, and energy stack already
  works

#### One public calendar source beyond Finnhub

Examples:

- central bank calendar
- major economic release calendar

Why optional:

- Finnhub plus FRED may already cover enough for MVP

## 5. Explicitly Rejected Sources

These should not be part of the new trading-focused system.

- live TV
- live webcams
- AIS
- OpenSky
- Windy webcam layers
- OREF
- Telegram channel scraping
- ACLED
- UCDP
- broad cyber IOC feeds
- large conflict maps
- country instability systems
- global infrastructure map layers
- broad humanitarian and displacement feeds

Reason:

- they increase system complexity much more than they increase trading value
- `data-sources.mdx` shows many of these are intelligence-first rather than
  market-first
- `api-data-pipeline.md` shows many depend on the broad WorldMonitor relay /
  seed model that we want to avoid

## 6. Final Recommended Source Stack

This is the stack I recommend for the new product.

### MVP core

- Finnhub
- FRED
- EIA
- BIS
- CoinGecko Demo API
- GDELT DOC 2.0
- small curated RSS layer
- Telegram Bot API
- optional local Ollama for summarization

### Fallbacks

- Yahoo Finance only as quote fallback
- rule-based summaries if Ollama is offline

### Phase-2 additions

- Polymarket
- WTO
- one cleaner economic calendar source if needed

## 7. Why This Stack Is Better Than Reusing WorldMonitor Broadly

WorldMonitor mixes:

- browser fetches
- relay-backed fetches
- seeded data
- edge handlers
- many optional credentials
- many fallback paths

That is powerful, but not ideal for a compact market product.

The new stack is better because it is:

- narrower
- easier to cache
- easier to monitor
- easier to explain
- aligned to trading use cases

## 8. Product Surfaces

The new system should have five product surfaces.

### 1. Dashboard

Shows:

- risk regime
- major cross-asset moves
- macro pulse
- energy state
- watchlist highlights

### 2. Watchlists

Supports watchlists such as:

- macro
- equities
- ETFs
- commodities
- crypto
- FX proxies

### 3. Briefing

Supports:

- morning brief
- intraday delta brief
- energy brief
- end-of-day market brief

### 4. Alerts

Supports:

- Telegram delivery
- threshold-based triggers
- scheduled summary delivery

### 5. Journal

Supports:

- notes
- actions
- save-from-brief
- save-from-alert

## 9. Recommended Data Model

Use a much smaller model than WorldMonitor.

### Asset

- symbol
- asset type
- label
- venue / provider

### Watchlist

- id
- name
- assets
- tags

### Quote Snapshot

- symbol
- price
- change
- volume
- timestamp
- provider

### Macro Snapshot

- series id
- value
- timestamp
- category
- provider

### Energy Snapshot

- inventory metrics
- production metrics
- petroleum summary metrics
- derived energy regime

### Headline Event

- title
- source
- timestamp
- linked assets
- linked themes
- severity

### Brief Run

- type
- generated time
- summary
- references

### Alert Rule

- scope
- trigger
- threshold
- cooldown
- delivery target

### Journal Entry

- note
- linked assets
- linked brief
- linked alert

## 10. Architecture

The new project should be local-first, but not frontend-only.

### Runtime target

Default:

- local web app on your Mac

Optional later:

- desktop wrapper

### Backend shape

Use one small local backend for:

- provider fetching
- caching
- scheduled refresh
- signal generation
- Telegram alert delivery
- brief generation

Do not start with:

- Vercel edge functions
- Railway relay
- Redis seed loops
- multi-runtime secret plumbing

The strongest lesson from `api-data-pipeline.md` is that the new project should
not start proto-first or gateway-first. WorldMonitor's typed pipeline is clean,
but it exists to support a very broad multi-domain product. The new project
should start with a simpler local service boundary first.

### Storage

Use:

- SQLite first

That is enough for:

- snapshots
- watchlists
- alert history
- notes
- brief history

## 11. Refresh Model

The new system should have one simple refresh model.

### Suggested cadence

- Finnhub quotes: 30 to 60 seconds
- CoinGecko: 60 seconds
- curated RSS: 5 minutes
- GDELT scans: 5 minutes
- EIA: 15 to 60 minutes depending on endpoint
- FRED: 15 to 60 minutes depending on series
- BIS: daily or slower
- alert evaluation: after each relevant refresh

This gives a predictable and stable system.

## 12. Signal Engine

The system should convert raw source data into a small number of useful
trading signals.

### Market regime

Derived from:

- equity index trend
- rates context
- volatility proxies
- energy pressure
- crypto risk appetite
- macro structure from FRED and BIS

### Energy shock

Derived from:

- crude move
- inventory context
- production context
- supply disruption headlines

### Risk-off pulse

Derived from:

- cross-asset weakness
- oil strength
- rates pressure
- crypto weakness

### Watchlist pressure

Derived from:

- top movers
- top losers
- unusual volume
- linked news clusters

## 13. Telegram Design

Telegram should be used for delivery, not ingestion.

### MVP alert examples

- `Risk-off alert: equities weaker, oil firmer, crypto softer`
- `Energy alert: inventory surprise changed energy regime`
- `Watchlist alert: NVDA breached move threshold on elevated volume`
- `Morning brief ready`

### Later bot commands

- `/brief`
- `/status`
- `/watchlist macro`
- `/energy`

## 14. Ollama Design

Ollama should remain optional.

Use it for:

- brief synthesis
- headline compression
- short narrative summaries

Do not depend on it for:

- quote refresh
- core calculations
- alert evaluation

The system must still function when Ollama is offline.

## 15. MVP Scope

### Keep

- watchlists
- quotes
- macro dashboard
- energy dashboard
- market-moving headlines
- Telegram alerts
- briefs
- notes / journal

### Skip

- maps
- live media
- broad geopolitics
- broad intelligence panels
- sync systems
- very large customization surface

## 16. Concrete Build Phases

### Phase 1: Foundation

- create a new repo
- define config for:
  - `FINNHUB_API_KEY`
  - `FRED_API_KEY`
  - `EIA_API_KEY`
  - `COINGECKO_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
  - `OLLAMA_API_URL`
  - `OLLAMA_MODEL`
- add health page for provider status

Acceptance:

- app starts locally
- each provider reports configured or missing clearly

### Phase 2: Market Core

- implement Finnhub quote service
- implement Yahoo fallback service
- implement watchlists
- store quote snapshots

Acceptance:

- watchlists refresh reliably

### Phase 3: Macro And Energy Core

- implement FRED service
- implement BIS service
- implement EIA service
- derive macro and energy state

Acceptance:

- dashboard shows usable macro and energy context

### Phase 4: Headline Layer

- implement small curated RSS ingestion
- implement GDELT thematic search layer
- link headlines to watchlists and themes

Acceptance:

- dashboard can explain why a move matters

### Phase 5: Briefing

- implement morning brief
- implement delta brief
- implement energy brief
- use Ollama when available, fallback when not

Acceptance:

- briefs work with and without Ollama

### Phase 6: Alerts

- implement alert rule engine
- send alerts via Telegram Bot API

Acceptance:

- alerts arrive reliably to your Telegram chat

### Phase 7: Journal

- implement notes
- implement actions
- allow save-from-brief and save-from-alert

Acceptance:

- the product supports a real daily workflow, not just passive viewing

## 17. What To Reuse From WorldMonitor

Reuse:

- local-first config ideas
- summarization fallback ideas
- watchlist and companion concepts
- some market and economic service patterns
- the discipline of documenting source classes and fallback behavior

Do not reuse directly:

- the full panel system
- the full variant system
- the map-first architecture
- the relay-heavy ingestion model
- the very broad source catalog

## 18. Revised Source Decision

After re-checking WorldMonitor's own docs, the source decision should be:

### Use in MVP

- Finnhub
- FRED
- EIA
- BIS
- CoinGecko
- curated RSS
- GDELT DOC 2.0
- Telegram Bot API
- Ollama as optional summarizer

### Use later if justified

- Yahoo Finance fallback
- Polymarket
- WTO
- an economic calendar source

### Do not bring over from WorldMonitor

- live media
- broad intelligence feeds
- relay-driven ingestion systems
- map-first infrastructure and conflict layers

This is the best balance between:

- trading usefulness
- operational simplicity
- what WorldMonitor already taught us works

## 19. Bottom Line

The best new system is not “WorldMonitor but smaller”.

It is:

- a local-first trading market companion
- built around Finnhub, FRED, EIA, CoinGecko, GDELT, a small RSS layer, and
  Telegram delivery
- with Ollama as an optional local briefing engine

That source set is small enough to stay reliable and broad enough to cover the
main inputs a global macro / cross-asset trader actually needs.
