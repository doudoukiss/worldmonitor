# Refactor Plan: WorldMonitor -> Personal Information Companion

## 1. Goal

Refactor WorldMonitor from a broad real-time intelligence dashboard into a
personal information companion that helps one person:

- define what they care about
- collect relevant signals across domains
- turn those signals into useful briefs
- capture notes and follow-ups
- maintain continuity over time

The right end state is not "more panels." The right end state is a system that
continuously answers:

- What matters to me today?
- What changed since the last time I looked?
- What should I read, save, ignore, or act on?
- What does the system remember about my interests and ongoing threads?

## 2. Recommended Product Direction

### Core idea

Keep the project's strongest asset:

- multi-domain ingestion
- map and panel visualization
- typed RPC/data pipeline
- LLM-generated briefs
- desktop-side local runtime

Change the organizing principle from:

- public variants + fixed panel dashboards

to:

- personal workspaces + follows + inbox + briefs + memory

### Practical interpretation

WorldMonitor should become a local-first intelligence and research cockpit for a
single user, with optional sync later.

That means the primary unit of organization becomes a **workspace**:

- "Global risk"
- "My investments"
- "My industry"
- "Travel / relocation"
- "Learning backlog"
- "My country / city / neighborhood"

Each workspace should have:

- followed entities, topics, and regions
- selected sources and feeds
- a default brief recipe
- pinned widgets and map layers
- saved notes and decisions
- automation and notification rules

## 3. Constraints From The Current Repo

The plan should respect what the codebase already is.

### What already exists and should be reused

- Class-based TypeScript SPA with strong modular seams in `src/app/`,
  `src/services/`, and `src/components/`
- Proto-first typed API path in `proto/`, `server/worldmonitor/`, and `api/*/v1/[rpc].ts`
- Existing concept of saved interests:
  - `src/components/MonitorPanel.ts`
  - `src/services/market-watchlist.ts`
- Existing personalized summary patterns:
  - country brief flow via `CountryIntelManager`
  - `DailyMarketBriefPanel` and `src/services/daily-market-brief.ts`
- Existing persistent local storage:
  - `src/services/persistent-cache.ts`
  - Tauri keychain and local sidecar support
- Existing agent/widget foothold:
  - `src/components/WidgetChatModal.ts`
  - `src/services/widget-store.ts`
- Existing command/search entry point:
  - `src/app/search-manager.ts`

### What should not be done

- Do not rewrite the frontend in React just because the product direction changes.
- Do not make auth and cloud sync the first milestone.
- Do not start by adding many new upstream feeds.
- Do not preserve the current variant-first architecture as the long-term UX
  model.

## 4. Product Thesis

### Current product model

The current product is organized around:

- variants
- static/default panel sets
- a dashboard-first mental model
- domain-heavy navigation

That works for a public monitoring tool, but it is weak for a personal
companion because it lacks:

- durable user identity beyond local settings
- a first-class saved-interest model
- a unified inbox
- note-taking and follow-up memory
- stable workflows around "read later", "watch", "explain", "brief me", and
  "what changed"

### Target product model

The personal companion should be organized around six first-class objects:

1. **Workspace**
2. **Follow**
3. **Item**
4. **Brief**
5. **Memory**
6. **Action**

#### Workspace

A user-defined container for a goal or area of focus.

#### Follow

A tracked thing such as:

- country
- company
- ticker
- topic
- source
- keyword set
- map region
- route / chokepoint
- custom query

#### Item

A normalized content object flowing through the system:

- article
- alert
- quote move
- flight event
- outage
- protest
- filing
- note
- captured URL

#### Brief

A generated synthesis over a workspace or follow set:

- morning brief
- end-of-day recap
- weekly watchlist brief
- "what changed since yesterday"
- "explain this topic to me"

#### Memory

The system's durable personal context:

- saved notes
- user preferences
- accepted summaries
- prior questions
- decisions made
- dismissed items
- why a follow exists

#### Action

A next step created from an item or brief:

- read later
- revisit tomorrow
- alert if worsens
- compare with another entity
- summarize weekly

## 5. What The UX Should Become

## 5.1 Replace variant-first navigation with workspace-first navigation

Keep the current variants only as **starter templates**.

Examples:

- `full` becomes "Global intelligence template"
- `finance` becomes "Markets template"
- `tech` becomes "Technology template"
- `happy` becomes "Positive signals template"
- `commodity` becomes "Commodity template"

But the runtime should load a chosen workspace, not a chosen variant.

## 5.2 Introduce a universal companion home

The default landing view should be a personal home with:

- today's brief
- "new since last visit"
- active follows
- saved actions
- one-click command/search/ask

This becomes more important than the current panel wall.

## 5.3 Introduce an inbox, not just panels

The system needs an **inbox** that can merge normalized items from all domains.

For each item, the user should be able to:

- save
- dismiss
- snooze
- tag
- attach to workspace
- ask for explanation
- generate a brief from related items

## 5.4 Promote ask-mode to a first-class surface

The search modal should evolve into:

- Search
- Command
- Ask
- Open workspace
- Follow entity
- Create brief
- Capture note

The current search and widget-agent foundations are enough to justify this.

## 6. Target Technical Architecture

## 6.1 Frontend shell refactor

### Current issue

`AppContext` and `DataLoaderManager` are broad and dashboard-centric.

### Target

Split the app shell into these top-level concerns:

- `session`
  - runtime mode
  - secrets
  - local capabilities
- `profile`
  - user preferences
  - default brief settings
  - language and tone
- `workspace`
  - active workspace
  - follows
  - layout
  - pinned views
- `inbox`
  - normalized items
  - unread / seen / saved / dismissed state
- `briefing`
  - recipes
  - generated outputs
  - freshness
- `memory`
  - notes
  - history
  - decisions

### Concrete file impact

Refactor these existing files first:

- `src/app/app-context.ts`
- `src/App.ts`
- `src/app/data-loader.ts`
- `src/app/search-manager.ts`

Do not attempt a full rewrite in one pass. Introduce new modules alongside the
old dashboard behavior and migrate incrementally.

## 6.2 Data model refactor

Add a personal layer above today's domain data.

### New core models

- `Profile`
- `Workspace`
- `Follow`
- `InboxItem`
- `BriefRecipe`
- `BriefRun`
- `MemoryNote`
- `ActionItem`
- `AutomationRule`

### Suggested initial storage location

Start local-first:

- IndexedDB in browser
- Tauri persistent cache / local storage in desktop

Use cloud sync later if needed.

This is the right first choice because:

- the repo already has local persistence patterns
- the desktop runtime is a strong fit for private personal data
- introducing auth and sync immediately would slow the refactor and distort the
  design

## 6.3 API and contract expansion

Do not try to force personal-companion state through existing market/news/etc.
services. Add dedicated services.

### Recommended first new services

- `profile/v1`
- `workspace/v1`
- `briefing/v1`
- `capture/v1`

### Example responsibilities

#### `profile/v1`

- read and update user defaults
- preferred language / tone / summary depth
- local vs sync mode

#### `workspace/v1`

- list workspaces
- create / rename / delete workspace
- add / remove follows
- attach widgets and layout

#### `briefing/v1`

- generate workspace brief
- generate delta brief
- generate topic explainers
- list prior brief runs

#### `capture/v1`

- capture URL
- capture free-form note
- save an item to memory
- attach an item to a workspace

## 6.4 Ranking and personalization layer

Right now the project is mostly source and domain driven. A personal companion
needs a ranking layer driven by user relevance.

Every normalized item should get scores such as:

- domain importance
- workspace relevance
- novelty
- urgency
- confidence / trust
- similarity to dismissed items
- similarity to saved items

This becomes the basis for:

- inbox sorting
- brief composition
- alert routing
- daily recap quality

## 6.5 Briefing system refactor

Generalize the successful patterns from:

- country intelligence brief
- daily market brief

into a reusable briefing engine.

### Brief types to support early

- `workspace_morning`
- `workspace_delta`
- `follow_digest`
- `topic_explainer`
- `decision_prep`

### Shared briefing pipeline

1. gather candidate items
2. score and dedupe
3. cluster into themes
4. enrich with related entities
5. build structured context
6. generate brief
7. store result and user feedback

## 6.6 Memory and continuity

This is the biggest gap between the current project and a true companion.

The companion needs durable memory of:

- what the user cares about
- what it already told the user
- what the user dismissed or saved
- what decisions the user made
- how the user's interests evolve

This should not start as an abstract vector-memory science project. Start with a
simple structured memory layer:

- notes
- tags
- linked items
- last-viewed timestamps
- saved/dismissed feedback
- per-workspace history

Semantic retrieval can be layered on later.

## 7. Migration Map From Existing Features

| Existing feature | Keep / change | Target role |
| --- | --- | --- |
| Variants | Keep, but demote | Starter workspace templates |
| `MonitorPanel` | Generalize | Followed topics / keyword rules |
| Market watchlist | Generalize | Tracked entities service |
| Country brief | Reuse pattern | Briefing engine for any workspace |
| Daily market brief | Reuse pattern | Recipe-based brief run |
| Search modal | Expand | Search + command + ask palette |
| Custom widgets | Keep and expand | Personal workspace cards |
| Persistent cache | Keep | Local-first companion store |
| Tauri runtime-config | Keep | Local secrets and private integrations |
| Map layers | Keep, but optionalize | Analysis surface inside workspaces |

## 8. Concrete Implementation Phases

## Phase 0: Product and architecture decisions

### Objectives

- decide local-first vs sync-first
- decide desktop-first vs equal web/desktop priority
- define the MVP companion feature set

### Recommendation

Choose:

- local-first
- desktop-priority, web-supported
- MVP focused on workspaces, inbox, briefs, notes, follows

### Output

- one-page architecture decision record
- wireframes for home, workspace, inbox, brief, ask-mode

## Phase 1: Untangle the app shell

### Objectives

- reduce `AppContext` sprawl
- create a place for workspace/profile/inbox state

### Concrete tasks

- create `src/app/session-store.ts`
- create `src/app/workspace-store.ts`
- create `src/app/inbox-store.ts`
- create `src/app/briefing-store.ts`
- route existing panel state through these stores gradually

### Acceptance criteria

- app still runs
- current dashboard behavior unchanged
- new stores exist and can back one workspace and one inbox prototype

## Phase 2: Introduce personal models and local storage

### Objectives

- store workspaces, follows, notes, and actions locally

### Concrete tasks

- add `src/services/profile-store.ts`
- add `src/services/workspace-store.ts`
- add `src/services/inbox-store.ts`
- add `src/services/note-store.ts`
- migrate `market-watchlist` and monitor keywords into the new follow model

### Acceptance criteria

- user can create a workspace
- user can add follows
- user can save or dismiss an item
- state persists across restarts

## Phase 3: Build the companion home and inbox

### Objectives

- make the app feel personal immediately

### Concrete tasks

- add `HomePanel` or `CompanionHomeView`
- add `InboxPanel`
- normalize item cards across domains
- add save/dismiss/snooze/tag actions

### Acceptance criteria

- landing view shows "new since last visit"
- inbox can merge at least news + markets + alerts into one stream
- item actions persist

## Phase 4: Generalize briefs into a briefing engine

### Objectives

- move from one-off summaries to reusable personal briefing workflows

### Concrete tasks

- extract shared logic from country and market brief flows
- add `BriefRecipe` and `BriefRun`
- add workspace morning brief
- add delta brief based on last open time

### Acceptance criteria

- one workspace can generate a morning brief
- one workspace can generate a "what changed" brief
- brief output is cached and reviewable later

## Phase 5: Evolve search into ask-mode

### Objectives

- turn discovery into interaction

### Concrete tasks

- extend `SearchManager` into command + ask flows
- support commands like:
  - follow
  - summarize
  - compare
  - save
  - explain
  - brief me
- reuse widget-agent patterns where sensible

### Acceptance criteria

- user can ask for a summary scoped to the active workspace
- user can create a follow from command/search
- user can capture a note from the command palette

## Phase 6: Add memory, notes, and actions

### Objectives

- make the system continuous rather than session-based

### Concrete tasks

- add note capture UI
- link notes to items, follows, and workspaces
- add action items and reminders
- track feedback such as "useful", "not useful", "too noisy"

### Acceptance criteria

- notes are attached to workspace context
- action items survive refresh and restart
- brief ranking can use saved/dismissed feedback

## Phase 7: Automation and notifications

### Objectives

- make the companion proactive

### Concrete tasks

- add `AutomationRule`
- support triggers such as:
  - keyword hit
  - threshold breach
  - item cluster spike
  - scheduled brief
- route to:
  - in-app inbox
  - desktop notification
  - email or webhook later

### Acceptance criteria

- user can create at least one rule per workspace
- notifications can be muted, snoozed, and tuned

## Phase 8: Optional sync and account layer

### Objectives

- support multi-device continuity only after the local companion is solid

### Recommendation

Use Convex only after the local model is stable.

Current Convex usage is minimal, which is good news: it means the project is not
deeply coupled to a server-side user model yet.

### Acceptance criteria

- export / import works first
- cloud sync is optional
- local-only mode remains supported

## 9. MVP Recommendation

The first meaningful personal-companion MVP should include only:

- workspace creation
- follows
- unified inbox
- save / dismiss / snooze
- one morning brief
- one delta brief
- notes
- command/search/ask entry point

Do not block this MVP on:

- auth
- billing
- cloud sync
- new public site variants
- massive map refactors

## 10. Highest-Leverage Refactors In The Existing Code

If I were sequencing engineering effort, I would start with these concrete
changes:

1. Split `AppContext` into smaller stores
2. Generalize `MonitorPanel` and market watchlists into a shared follow model
3. Extract a reusable briefing pipeline from country + market brief systems
4. Add a normalized inbox item model in `src/types/`
5. Add workspace persistence on top of `persistent-cache`
6. Expand `SearchManager` into search + command + ask
7. Keep the map and current panels as optional views inside workspaces

## 11. Risks

### Risk: trying to do product redesign and architecture rewrite at once

Mitigation:

- preserve current dashboard behavior while new companion features are added
- migrate one workflow at a time

### Risk: building sync/auth too early

Mitigation:

- local-first MVP
- export/import before cloud account work

### Risk: keeping variants as the primary UX

Mitigation:

- turn variants into templates
- make workspaces the main concept

### Risk: overusing LLMs without durable memory structure

Mitigation:

- build structured note, follow, and brief history first
- add semantic memory later

## 12. Bottom Line

The project should not be refactored into a generic chatbot wrapped around the
existing dashboard.

It should be refactored into a local-first personal intelligence system with:

- workspace-first navigation
- a unified inbox
- reusable briefing recipes
- durable notes and memory
- ask-mode over personal context
- optional map and panel surfaces for analysis

The current repo already contains many of the right ingredients. The main
refactor is to introduce a personal organizing model above the existing domain
data, not to replace the ingestion and analysis stack.
