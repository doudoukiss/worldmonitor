# Next Big Update Plan: Companion Runtime v2

## 1. Status Check

The current personal-companion plan is mostly completed at the acceptance-criteria
level.

Completed or materially satisfied:

- Phase 1: app shell stores exist and back the companion runtime
- Phase 2: local profile, workspace, inbox, notes, follows, and actions persist
- Phase 3: companion home + inbox + normalized item actions exist
- Phase 4: workspace morning/delta briefs exist and are reviewable later
- Phase 5: command/search can create follows, capture notes, and generate briefs
- Phase 6: notes/actions/reminders/feedback are wired into workspace context
- Phase 7: automation rules exist, can be tuned/muted, and can emit inbox/desktop notifications
- Phase 8: export/import works, local-only mode remains supported, and sync is optional

Still partial rather than complete in spirit:

- ask-mode is still command-first rather than a deeper conversational surface
- automation triggers are narrower than the full vision in the original doc
- optional sync has a provider seam and manual push/pull, but not a real remote provider
- account/cloud identity is intentionally not implemented yet

## 2. Product Goal For The Next Update

Move from a functional personal companion to a genuinely high-retention daily-use
system.

The next update should focus on four upgrades:

1. better ask/research workflows
2. stronger workspace memory and thread continuity
3. richer proactive automation
4. a real remote sync provider, still optional

## 3. Recommended Update Theme

Name this update:

**Companion Runtime v2: Ask, Remember, Sync**

This should feel like a quality jump, not a feature dump. The system should stop
feeling like a dashboard with personal overlays and start feeling like a true
workspace companion.

## 4. Major Workstreams

## 4.1 Ask Workspace

### Objective

Turn the current command/search surface into a real ask/research mode scoped to
the active workspace.

### Concrete work

- add a dedicated ask panel or modal mode on top of `SearchManager`
- support `summarize`, `compare`, `explain`, and `why does this matter` flows
- let ask-mode cite:
  - current inbox items
  - recent brief runs
  - saved notes
  - followed entities
- store ask history per workspace
- allow saving an answer into notes or actions

### Acceptance criteria

- user can ask a workspace question and get a scoped answer
- answer can cite source items from the current workspace
- answer can be saved as note or action

## 4.2 Threads And Memory

### Objective

Promote isolated notes/actions into durable threads.

### Concrete work

- add `Thread` or `TopicMemory` as a first-class local model
- allow linking:
  - inbox items
  - notes
  - actions
  - brief runs
  - follows
- add thread views such as:
  - "What changed in this thread?"
  - "Recent notes and actions"
  - "Why am I following this?"
- support manual thread creation from item/note/action

### Acceptance criteria

- one workspace can maintain at least one durable thread
- notes/actions/items can all attach to that thread
- briefing and ask-mode can reference thread context

## 4.3 Automation v2

### Objective

Make automation meaningfully proactive instead of event-reactive only.

### Concrete work

- expand triggers beyond the current rule set:
  - keyword/follow hit
  - score threshold breach
  - repeated signal spike
  - scheduled brief run
  - stale workspace reminder
- expand actions:
  - create inbox item
  - desktop notification
  - auto-create action
  - queue brief recipe run
- add lightweight automation history
- add per-rule quiet hours / mute windows

### Acceptance criteria

- user can create multiple rule types per workspace
- user can review what a rule fired on
- scheduled or recurring automation exists for at least one brief flow

## 4.4 Sync Provider

### Objective

Turn the current manual sync seam into a real optional remote provider.

### Recommendation

Use the existing local-first backup document as the sync payload contract.
Only after that, add a remote adapter. Convex is still the most natural first
candidate because the repo already has a small foothold there.

### Concrete work

- define sync payload versioning and conflict policy
- add provider interface with:
  - push
  - pull
  - sync status
  - conflict/error state
- implement one remote provider:
  - recommended first target: Convex
- keep manual provider as fallback
- preserve local-only mode as default

### Acceptance criteria

- user can opt into a real remote provider
- same workspace state can move between two installs
- local-only mode still works with no account

## 5. Technical Plan

## 5.1 New Models

Add:

- `Thread`
- `AskRun`
- `AutomationEvent`
- `SyncJob` or sync-state record

Likely homes:

- `src/types/index.ts`
- `src/services/*-store.ts`
- `src/app/*-store.ts` where app-level orchestration is needed

## 5.2 UI Surfaces

Add or expand:

- companion ask panel/modal
- thread list + thread detail view
- automation history section
- sync status / conflict section

Primary files likely touched:

- `src/components/CompanionHomePanel.ts`
- `src/components/SearchModal.ts`
- `src/app/search-manager.ts`
- `src/app/panel-layout.ts`

## 5.3 Service Layer

Add:

- `src/services/thread-store.ts`
- `src/services/ask-store.ts`
- `src/services/automation-history-store.ts`
- `src/services/companion-sync-convex.ts` or equivalent provider

## 5.4 Integration Rules

- keep local-first storage authoritative unless sync is explicitly enabled
- do not make remote sync a hard dependency of app startup
- do not bypass the typed backup payload; remote sync should use the same core document
- do not scatter ask/memory logic into unrelated panels; keep companion behavior in companion services and app orchestration

## 6. Suggested Delivery Sequence

## Milestone 1: Ask Workspace

- scoped ask runs
- answer history
- save answer to note/action

## Milestone 2: Threads

- thread model
- link notes/items/actions/follows
- thread detail surface

## Milestone 3: Automation v2

- scheduled rules
- automation history
- richer actions

## Milestone 4: Real Optional Sync

- remote provider contract
- one provider implementation
- conflict and status UX

## 7. Risks

- the class-based panel shell can become harder to reason about if ask/thread/sync logic is spread across components
- sync can easily corrupt local state if conflict handling is vague
- automation can become noisy unless rule history and mute controls stay simple and visible
- ask-mode can feel fake if it does not clearly scope itself to workspace memory and cite concrete items

## 8. MVP For This Update

If scope needs tightening, ship only:

- workspace ask mode with saved runs
- one durable thread type
- scheduled morning brief automation
- one real optional remote sync provider

That would be a meaningful product jump without overextending the current codebase.
