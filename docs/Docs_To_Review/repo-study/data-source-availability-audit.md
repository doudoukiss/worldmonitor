# Data Source Availability Audit

Snapshot taken on 2026-03-20 from the local checkout at
`/Users/sonics/project/worldmonitor`.

This note answers two practical questions:

1. Which source classes are actually usable in this checkout right now?
2. Which sources offer a free key or free signup path?

## Bottom Line

- In the current shell, none of the commonly used source credentials were set.
- That means anything guarded by runtime secrets is currently unavailable unless
  you add credentials and, in some cases, run extra infrastructure such as the
  relay or seed loops.
- The personal companion refactor plan is native Mac first, not Docker first.
  Docker remains optional for the existing full-stack self-hosted monitor.

## Current Environment Result

Checked on 2026-03-20:

- Missing: `FINNHUB_API_KEY`, `FRED_API_KEY`, `EIA_API_KEY`,
  `CLOUDFLARE_API_TOKEN`, `ACLED_ACCESS_TOKEN`, `UCDP_ACCESS_TOKEN`,
  `NASA_FIRMS_API_KEY`, `AISSTREAM_API_KEY`, `OPENSKY_CLIENT_ID`,
  `OPENSKY_CLIENT_SECRET`, `WINGBITS_API_KEY`, `WS_RELAY_URL`,
  `AVIATIONSTACK_API`, `ICAO_API_KEY`, `TRAVELPAYOUTS_API_TOKEN`,
  `OTX_API_KEY`, `ABUSEIPDB_API_KEY`, `URLHAUS_AUTH_KEY`, `WTO_API_KEY`,
  `WINDY_API_KEY`, and the LLM-related keys.

Practical consequence:

- Secret-gated runtime features are off by default in this checkout.
- Public and non-secret source paths are the only source class that can be used
  without adding more configuration.

Repo references:

- [`.env.example`](/Users/sonics/project/worldmonitor/.env.example#L5)
- [`src/services/runtime-config.ts`](/Users/sonics/project/worldmonitor/src/services/runtime-config.ts#L120)

## Runtime Direction

The current refactor plan is:

- local-first
- desktop-priority
- native Mac / Tauri first
- web-supported later
- cloud sync later if needed

This is explicit in:

- [`docs/Docs_To_Review/personal-information-companion-plan.md`](/Users/sonics/project/worldmonitor/docs/Docs_To_Review/personal-information-companion-plan.md#L44)
- [`docs/Docs_To_Review/personal-information-companion-plan.md`](/Users/sonics/project/worldmonitor/docs/Docs_To_Review/personal-information-companion-plan.md#L316)
- [`docs/Docs_To_Review/personal-information-companion-plan.md`](/Users/sonics/project/worldmonitor/docs/Docs_To_Review/personal-information-companion-plan.md#L473)

Docker is still supported for the current self-hosting path, but it is not the
primary target for the companion direction:

- [`SELF_HOSTING.md`](/Users/sonics/project/worldmonitor/SELF_HOSTING.md#L3)
- [`docs/api-key-deployment.mdx`](/Users/sonics/project/worldmonitor/docs/api-key-deployment.mdx#L7)

## Source Classes

## 1. Public / no-key sources

These are the safest base layer for a personal companion because they do not
depend on paid credentials.

Examples used in the repo:

- RSS and Atom feeds
- GDELT
- USGS earthquake feeds
- GDACS disaster alerts
- NASA EONET
- WorldPop
- static repo datasets under `shared/` and `src/config/`
- some World Bank and BIS seeded/public datasets
- some humanitarian and advisory feeds

Important caveat:

- Public upstream does not always mean zero operational work. Some public
  sources are fetched through seeders, relay paths, or local caching layers in
  this repo.

Useful references:

- [`docs/data-sources.mdx`](/Users/sonics/project/worldmonitor/docs/data-sources.mdx)
- [`scripts/seed-earthquakes.mjs`](/Users/sonics/project/worldmonitor/scripts/seed-earthquakes.mjs)
- [`scripts/seed-natural-events.mjs`](/Users/sonics/project/worldmonitor/scripts/seed-natural-events.mjs)
- [`scripts/seed-bis-data.mjs`](/Users/sonics/project/worldmonitor/scripts/seed-bis-data.mjs)

## 2. Free key or free signup sources

These are the best optional upgrades because they can usually be added without
immediate spend. "Free" here means the repo and/or current official provider
docs show a free plan, free signup, or free key path. Limits and license terms
still apply.

| Source | Repo use | Free signal | Notes |
| --- | --- | --- | --- |
| Finnhub | Primary stock quotes | Repo docs say free registration | Good low-cost market add-on for a personal companion. |
| EIA Open Data | Oil analytics | EIA says its open data is free and available via API | Repo still expects an API key. |
| FRED | Macro indicators | Official API docs require user account + API key | Straightforward free signup. |
| NASA FIRMS | Fire detection | Official FIRMS docs say to sign up for a free `MAP_KEY` by email | Rate-limited but usable. |
| AISStream | Vessel tracking | Official docs show user-generated API keys; official site advertises a free WebSocket API | Browser-direct use is not supported, so keep it behind a relay. |
| AviationStack | Flight ops / delays | Official pricing page has a free `$0` plan | Current free plan is small, but good for testing. |
| Windy Webcams | Webcam layer | Official pricing page has a Free plan and "Get API key" flow | Repo docs already describe a free tier. |
| CoinGecko Demo API | Crypto markets | Official docs expose a public/demo API key flow | The repo can also use CoinGecko without a key and fall back to CoinPaprika. |
| ACLED | Conflict and protest data | Repo docs say free for researchers | Eligibility and terms matter; do not assume broad commercial free use. |
| Telegram app credentials | Telegram OSINT relay | Official Telegram app registration is free | Useful only if you keep the MTProto relay path. |

Repo references:

- [`.env.example`](/Users/sonics/project/worldmonitor/.env.example#L45)
- [`docs/getting-started.mdx`](/Users/sonics/project/worldmonitor/docs/getting-started.mdx#L133)
- [`docs/webcam-layer.mdx`](/Users/sonics/project/worldmonitor/docs/webcam-layer.mdx#L17)

Official references:

- FRED API key: <https://fred.stlouisfed.org/docs/api/api_key.html>
- EIA Open Data: <https://www.eia.gov/opendata/>
- NASA FIRMS MAP key: <https://firms.modaps.eosdis.nasa.gov/api/map_key/>
- AISStream docs: <https://aisstream.io/documentation>
- AviationStack pricing: <https://aviationstack.com/pricing>
- Windy Webcams pricing: <https://api.windy.com/webcams/pricing>
- CoinGecko demo auth: <https://docs.coingecko.com/v3.0.1/reference/authentication>
- Telegram app registration: <https://my.telegram.org/apps>

## 3. Restricted, paid, approval-based, or not safely confirmed free

These should be treated as optional extras, not core assumptions.

| Source | Current read | Why it is risky to assume free |
| --- | --- | --- |
| Cloudflare Radar | Credential-gated | Repo docs conflict on whether free access is enough; do not assume it is broadly free. |
| Wingbits | Credential-gated | Repo still says "Contact Wingbits"; commercial terms may apply. |
| ICAO NOTAM API | Credential-gated | Official registration exists, but I did not verify a free general-access tier. |
| WTO data token | Credential-gated in repo | Free status was not safely confirmed. |
| UCDP token access | Credential-gated in repo | Token requirement is current, but free eligibility was not safely confirmed. |
| Travelpayouts | Optional/demo in repo | The repo treats it as optional demo data; current access terms should be checked before depending on it. |
| AbuseIPDB / OTX / URLhaus auth paths | Optional enrichment | Some of these may have free account tiers, but I did not fully re-verify current official terms. |
| CorridorRisk | Operationally fragile | Repo includes an API key placeholder, but the real blocker today is reliability and challenge pages. |

## 4. Public but operationally fragile

These may be free to query, but they are not stable enough to build the core
product around without fallback plans.

| Source | Risk |
| --- | --- |
| Yahoo Finance | Unofficial endpoint, no SLA, rate-limit and breakage risk |
| Polymarket | Server-side fetch path can be blocked by Cloudflare / JA3 issues |
| OREF | Requires residential proxy with Israeli exit IP |
| OpenSky | This repo treats it as relay-backed and rate-limit sensitive; production reliability is not "free and easy" |
| CorridorRisk | Can return HTML challenge pages instead of JSON |
| World Bank in edge-like paths | The repo already added a relay/proxy path because direct hosting environments can be blocked |

Repo references:

- [`server/worldmonitor/market/v1/_shared.ts`](/Users/sonics/project/worldmonitor/server/worldmonitor/market/v1/_shared.ts#L136)
- [`scripts/ais-relay.cjs`](/Users/sonics/project/worldmonitor/scripts/ais-relay.cjs#L85)
- [`scripts/ais-relay.cjs`](/Users/sonics/project/worldmonitor/scripts/ais-relay.cjs#L4238)
- [`scripts/ais-relay.cjs`](/Users/sonics/project/worldmonitor/scripts/ais-relay.cjs#L5801)

## Recommended Keep / Drop Bias For The Companion

For a first personal-companion version, I would keep the source strategy simple:

- Keep as core: RSS, GDELT, USGS, GDACS, NASA EONET, Open-Meteo, public World
  Bank and BIS data, static repo datasets, notes, local memory, user follows,
  and the best public market fallbacks.
- Add next: FRED, EIA, Finnhub, FIRMS, CoinGecko demo, and maybe AviationStack
  because these have straightforward free paths.
- Add only if you truly need them: AISStream, OpenSky, Telegram, ACLED, Windy,
  because they add more operational complexity.
- Defer until justified: Cloudflare Radar, Wingbits, ICAO, WTO, CorridorRisk,
  and any source whose current free/commercial status is unclear.

## Most Important Repo Drift I Found

- The repo currently states that UCDP access tokens have been required since
  2025, but the current UCDP docs say authenticated access was introduced in
  February 2026.
- The repo still frames Wingbits as a contact-sales style integration, while the
  current Wingbits site advertises self-serve API access with a free trial.
- The repo docs sometimes blur together "public upstream" and "usable in this
  local setup." Those are not the same thing when the code path still needs a
  relay, seed job, or local secret.

## Practical Answer To "Which Sources Can I Get Free Keys/APIs For?"

The cleanest "yes, free path exists" list is:

- Finnhub
- EIA
- FRED
- NASA FIRMS
- AISStream
- AviationStack
- Windy Webcams
- CoinGecko Demo API
- ACLED for eligible researcher use
- Telegram app credentials

The cautious "do not assume free without checking current terms first" list is:

- Cloudflare Radar
- Wingbits
- ICAO
- WTO
- UCDP
- Travelpayouts
- AbuseIPDB
- OTX
- URLhaus auth-based paths
- CorridorRisk
