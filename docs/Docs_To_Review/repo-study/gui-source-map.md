# GUI Source Map

Snapshot taken on 2026-03-21 from the local checkout at
`/Users/sonics/project/worldmonitor`.

This document maps the data and media sources that the current GUI can display.
It separates:

- exact built-in TV/video sources
- other external live/API sources shown in panels or map layers
- local static datasets that are rendered in the GUI but are not fetched live

It is a code-reading document, not a provider contract. For entitlement,
pricing, and key availability, also see `data-source-availability-audit.md`.

## How To Read This

- `Source` means the upstream provider or feed family.
- `Access path` means how this repo reaches it today.
- `Rendered where` means the visible GUI surface.
- `Processing` distinguishes between local playback/rendering and remote fetch.

## Video And TV Sources

### Live News Panel

The Live News panel is defined in
`src/components/LiveNewsPanel.ts`.

Playback model:

- YouTube channels are resolved through `src/services/live-news.ts` ->
  `api/youtube/live.js`.
- `api/youtube/live.js` first tries the Railway relay, then falls back to direct
  YouTube fetch/scrape.
- Embeds are served through `api/youtube/embed.js`.
- Direct broadcaster streams use remote HLS `.m3u8` manifests.
- Playback and decode happen locally in the browser on your Mac.

#### Default full-variant channels

| Channel | Upstream access |
| --- | --- |
| Bloomberg | YouTube `@markets` fallback video |
| Sky News | YouTube `@SkyNews` fallback video |
| Euronews | YouTube `@euronews` fallback video |
| DW | YouTube `@DWNews` fallback video |
| CNBC | YouTube `@CNBC` fallback video |
| CNN | YouTube `@CNN` fallback video |
| France 24 | YouTube `@FRANCE24` fallback video |
| Al Arabiya | YouTube `@AlArabiya` fallback-only |
| Al Jazeera English | YouTube `@AlJazeeraEnglish` fallback-only |

#### Default tech-variant channels

| Channel | Upstream access |
| --- | --- |
| Bloomberg | YouTube `@markets` fallback video |
| Yahoo Finance | YouTube `@YahooFinance` fallback video |
| CNBC | YouTube `@CNBC` fallback video |
| Sen Space Live / NASA | YouTube `@NASA` fallback-only |

#### Optional built-in live channels

These are all currently hard-coded in the GUI and can be toggled by the user.

| Region | Channels |
| --- | --- |
| North America | Bloomberg, CNBC, Yahoo Finance, CNN, Fox News, Newsmax, ABC News, CBS News, NBC News, CBC News, CTV News, Reuters TV, Sen Space Live |
| Europe | Sky News, Euronews, DW, France 24, BBC News, GB News, The Guardian, France 24 English, RTVE 24H, Phoenix, RTP3, TRT Haber, NTV Turkey, CNN Turk, TV Rain, RT, TVP Info, Telewizja Republika, WELT, Tagesschau24, Euronews FR, Euronews GR, SKAI TV, ERT News, France 24 FR, France Info, BFMTV, TV5 Monde Info, NRK1, Al Jazeera Balkans |
| Latin America | CNN Brasil, Jovem Pan News, Record News, Band Jornalismo, TN, C5N, MILENIO, Noticias Caracol, NTN24, T13, DW Espanol, RT Espanol, CGTN Espanol |
| Asia | TBS NEWS DIG, ANN News, NTV News Japan, CTI News Taiwan, WION, NDTV 24x7, CGTN, CNA, NHK World Japan, Arirang News, India Today, ABP News |
| Middle East | Al Arabiya, Al Jazeera English, Al Hadath, Sky News Arabia, TRT World, Iran International, CGTN Arabic, Kan 11, i24NEWS Israel, Asharq News, Al Jazeera Arabic, Al Jazeera Mubasher, Al Arabiya Business, Al Qahera News, Press TV, DW Arabic, RT Arabic, Rudaw |
| Africa | Africanews, Channels TV, KTN News, eNCA, SABC News, Arise News |
| Oceania | ABC News Australia |

#### Direct HLS stream providers embedded in the panel

These are the clearest examples where the repo already knows a direct remote
stream URL instead of relying only on a YouTube embed:

- CTV News
- Reuters TV
- GB News
- The Guardian
- Phoenix
- RTP3
- RT
- Record News
- DW Espanol
- RT Espanol
- CGTN Espanol
- CGTN
- Arirang News
- ABP News
- Al Jazeera Mubasher
- Al Arabiya Business
- Al Qahera News
- Press TV
- DW Arabic
- RT Arabic
- Rudaw
- SABC News
- ERT News
- TV5 Monde Info
- NRK1
- Al Jazeera Balkans
- plus a `DIRECT_HLS_MAP` for core channels including Sky News, Euronews, DW,
  France 24, Al Arabiya, Al Jazeera, Bloomberg, CNN, ABC News, NBC News,
  NDTV, i24NEWS, CGTN Arabic, TRT World, Sky News Arabia, Al Hadath, RT,
  ABC News Australia, BBC News, and Tagesschau24

### Live Webcams Panel

The Live Webcams panel is defined in
`src/components/LiveWebcamsPanel.ts`.

Playback model:

- These feeds are currently hard-coded as YouTube live sources with fallback
  video IDs.
- The browser on your Mac plays the remote stream locally.
- There is no local transcoding or heavy local video analysis by default.

#### Current built-in webcam feeds

| Region | Feed |
| --- | --- |
| Iran-focused | Tehran, Tel Aviv, Jerusalem, Middle East multicam |
| Middle East | Jerusalem, Tehran, Tel Aviv, Mecca, Beirut |
| Europe | Kyiv, Odessa, Paris, St. Petersburg, London |
| Americas | Washington DC, New York, Los Angeles, Miami |
| Asia-Pacific | Taipei, Shanghai, Tokyo, Seoul, Sydney |
| Space | ISS Earth View, NASA TV, SpaceX, Space Walk |

All of these are currently backed by YouTube channel handles plus fallback
video IDs.

### Windy Webcam Layer

This is separate from the YouTube-based webcam panel.

| Source | Access path | Rendered where | Processing |
| --- | --- | --- | --- |
| Windy Webcams API | `server/worldmonitor/webcam/v1/list-webcams.ts` and `get-webcam-image.ts` | Globe and deck.gl webcam layer, webcam popups | Metadata fetched remotely; image/player URL rendered locally |

Notes:

- The GUI fetches webcam metadata and thumbnail/player URLs, not raw ingest.
- Images are cached client-side for 9 minutes in `src/services/webcams/index.ts`.

## GUI External Source Inventory

This section groups the non-video sources that the GUI displays today.

### News, RSS, And Intelligence Feeds

| Source family | Access path | Rendered where | Notes |
| --- | --- | --- | --- |
| RSS feeds from many publishers | `src/config/feeds.ts`, `src/services/rss.ts`, `api/rss-proxy.js`, `server/worldmonitor/news/v1/_feeds.ts` | World news, regional news, sector news, intel feed, think tanks, finance, tech, government, layoffs | Multi-outlet aggregation; fetch is proxied/filtered, parsing is client-side for some paths |
| GDELT Doc API | `src/services/gdelt-intel.ts`, server intelligence RPCs | Live Intelligence, country intel, some scoring/briefing surfaces | Topic intelligence and news search |
| GDELT Geo API | unrest and positive-event server handlers | Protest tracking, geo events, positive-event geo | News-derived geolocated events |
| Telegram curated channels | `api/telegram-feed.js`, `src/services/telegram-intel.ts` | Telegram Intel panel | Polled on Railway relay via GramJS MTProto |
| OREF Home Front Command alerts | relay + `src/services/oref-alerts.ts` | Israel Sirens panel, alerts, CII boost | Residential proxy path on relay |
| PizzINT / Pentagon-area activity | intelligence services and panel wiring | PizzInt indicator, strategic posture, country intel | Mixed local scoring plus upstream data collection |

### Conflict, Protest, And Risk Sources

| Source family | Access path | Rendered where | Notes |
| --- | --- | --- | --- |
| ACLED | server conflict/unrest handlers, shared ACLED auth/cache | Protest/conflict panels, map unrest/conflict layers, CII inputs | Token-gated |
| UCDP | seeded into Redis and served by `server/worldmonitor/conflict/v1/list-ucdp-events.ts` | UCDP panel, UCDP map layer, conflict classification | Current code expects seeded/relay flow |
| HDX HAPI / humanitarian summaries | `src/services/conflict/index.ts` | Conflict summaries and humanitarian context | Used in conflict model, not a raw map-only layer |
| Security advisory feeds | seeded advisory pipeline | Security Advisories panel, CII floors/boosts | Gov advisory and health feeds |
| Sanctions data | sanctions services and server RPCs | Sanctions Pressure panel, map sanctions layer | Includes OFAC-style sanction context |

### Natural, Climate, Weather, And Environmental Sources

| Source family | Access path | Rendered where | Notes |
| --- | --- | --- | --- |
| USGS earthquakes | seeded on Railway, served via seismology RPCs | Natural events panel, map quake markers, correlation | Earthquakes |
| NASA EONET | seeded natural events flow | Natural events panel and map | Storms, wildfires, volcanoes, floods |
| GDACS | seeded natural events flow | Natural events panel and map | UN disaster alerts |
| NWS weather alerts | weather services / seeded cache | Weather layer and weather-related risk context | Public US severe weather alerts |
| Open-Meteo ERA5 | seeded climate RPCs | Climate Anomalies panel | Reanalysis/baseline anomaly calculations |
| NASA FIRMS / VIIRS | thermal, wildfire, and fire panels/services | Fires map layer, Satellite Fires panel, Thermal Escalation panel | Public fallback exists; key can enhance paths |
| RainViewer | direct fetch in `DeckGLMap.ts` | Weather radar overlay | Browser fetches remote radar tile manifest and tiles |
| Radiation and nuclear monitoring feeds | radiation services and config datasets | Radiation Watch panel, nuclear/radiation map layers | Mix of live/public sources and local datasets |

### Maritime, Aviation, Transport, And Infrastructure Sources

| Source family | Access path | Rendered where | Notes |
| --- | --- | --- | --- |
| AISStream | relay / maritime services / seeded caches | AIS vessel layer, maritime disruption analysis, chokepoints | Live vessel positions |
| USNI fleet data | `src/services/usni-fleet` via maritime services | Military vessel enrichment | Merged with AIS-derived vessel view |
| OpenSky Network | aviation tracking server/services | Military flights layer, Airline Intel tracking tab | Anonymous or relay-auth path depending runtime |
| Wingbits | aircraft enrichment services | Flight popup enrichment, military flight enrichment | Operator/owner/type/live enrichment |
| FAA NASSTATUS / ASWS | aviation handlers | Airline Intel Ops tab, delay surfaces | US airport delays, ground stops |
| AviationStack | aviation server handlers | Airline Intel Ops, Flights, Airlines | Flight status and delay-derived analytics |
| ICAO NOTAM | aviation shared server handlers | Airline Intel Ops and closure detection | Airport and airspace closures |
| Travelpayouts | aviation pricing handlers | Airline Intel Prices tab | Flight price search |
| Cloudflare Radar | infrastructure handlers / seed jobs | Internet outage map layer and infrastructure views | Token-gated in some paths |
| NGA cable advisories / cable-health inputs | cable services | Cable health, supply-chain and infrastructure cascade | Undersea cable disruption context |

### Markets, Macro, Energy, Trade, And Finance Sources

| Source family | Access path | Rendered where | Notes |
| --- | --- | --- | --- |
| Finnhub | market services and/or proxies | Markets, watchlists, some stock quotes | Primary stock quotes when configured |
| Yahoo Finance | market services, finance/news feeds | Markets, Gulf Economies, some finance/news fallbacks | Backup for indices and commodities, plus finance RSS |
| CoinGecko | market services/proxy | Crypto and stablecoin panels | Public/demonstration-friendly |
| CoinPaprika and similar fallbacks | market runtime fallbacks | Crypto surfaces in fallback mode | Used when primary path is unavailable |
| FRED | economic services / seeded RPCs | Economic panel, macro signals, shipping-rate inputs | Keyed or seeded depending path |
| EIA | `api/eia/[[...path]].js` and economic services | Oil analytics, energy complex, renewable energy context | Keyed |
| BIS | economic server handlers and seeds | Central bank / BIS views, macro policy data | Policy rates, REER, credit-to-GDP |
| USASpending.gov | economic services | Government spending and contract analysis | Public |
| Polymarket | prediction services and relay fallbacks | Predictions panel, country intel/prediction widgets | Probability market contracts |
| WTO API | trade server handlers / seeds | Trade Policy panel | Restrictions, tariffs, flows, barriers |
| Customs/tariff and trade support data | trade services | Trade Policy and supply-chain context | Mixed public and seeded sources |

### Cyber And Threat Intelligence Sources

| Source family | Access path | Rendered where | Notes |
| --- | --- | --- | --- |
| Feodo Tracker | cyber/intel services | Cyber threat layer and related panels | abuse.ch C2 data |
| URLhaus | cyber/intel services | Cyber threat layer | abuse.ch malware URL data |
| AlienVault OTX | cyber/intel services | Cyber threat layer and intel context | Pulse IOC feeds |
| AbuseIPDB | cyber/intel services | Cyber threat enrichment | Crowd-sourced malicious IP reports |
| Ransomware.live | cyber/intel services | Cyber/ransomware intel surfaces | Active ransomware reporting |
| ipinfo / free IP geolocation fallback | cyber enrichment helpers | Cyber threat map geolocation | Enrichment, not a user-facing primary feed |

### Displacement, Humanitarian, And Positive-Event Sources

| Source family | Access path | Rendered where | Notes |
| --- | --- | --- | --- |
| UN OCHA HAPI / UNHCR-related data | displacement services and server handlers | Displacement panel, country instability inputs | Refugees, asylum seekers, IDPs |
| Positive-event RSS and GDELT Geo | positive-events handlers and services | Happy variant panels and positive-event map layers | Curated positive feed plus geo enrichment |
| Giving / humanitarian feeds | giving services/handlers | Global Giving panel | Donation and humanitarian support visibility |

## Local Static Datasets Rendered In The GUI

These are shown on the map or in panels, but they are not fetched live from an
external API at render time.

| Dataset | Local source |
| --- | --- |
| Military bases | `src/config/bases-expanded.ts` |
| Ports | `src/config/ports.ts` |
| Pipelines | `src/config/pipelines.ts` |
| Airports | `src/config/airports.ts` |
| AI datacenters | `src/config/ai-datacenters.ts` |
| Irradiators | `src/config/irradiators.ts` |
| Countries, labels, geometry helpers | `src/config/countries.ts`, `src/config/geo.ts` |
| Trade routes and waterways | `src/config/trade-routes.ts` and related config |
| Finance, commodity, tech geo reference layers | `src/config/finance-geo.ts`, `src/config/commodity-geo.ts`, `src/config/tech-geo.ts` |
| Market symbol lists and watchlist defaults | `shared/*.json`, `src/config/markets.ts`, `src/config/commodity-markets.ts` |
| Startup hubs, accelerators, AI labs, regulations, FDI, miners | corresponding `src/config/*.ts` files |

## Local Vs Remote Processing Summary

### Processed locally on your Mac

- Final playback of YouTube and HLS video streams
- Map rendering in deck.gl / MapLibre / D3
- Client-side RSS parsing for some browser feed paths
- Client-side caches for webcam images, live video discovery, and companion data
- Some browser ML/inference and summarization fallback flows

### Resolved remotely before local display

- YouTube live discovery through `api/youtube/live.js` and sometimes Railway
- Seeded datasets served from server/edge/Redis-backed RPCs
- Telegram feed polling
- OREF siren polling
- AIS relay ingestion
- Any provider that requires credentials, relay access, or seed jobs

## Practical Bottom Line

For TV and webcam playback, the GUI is mostly an embed-and-play client:

- remote providers host the actual stream
- this repo discovers, proxies, or embeds the playable URL
- your Mac plays the media locally

For the rest of the GUI, the project is a mix of:

- direct browser fetches to public APIs
- edge/API proxy calls
- relay-backed credentialed fetches
- seeded Redis-backed datasets
- local static config rendered as map or panel data
