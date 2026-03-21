# How To Use The Personal Companion

Snapshot taken on 2026-03-21 from the local checkout at
`/Users/sonics/project/worldmonitor`.

This guide explains how to use the current personal companion features in the
way they are actually implemented today.

The companion is not a separate app. It is a set of panels inside the existing
WorldMonitor UI:

- `Companion Home`
- `Companion Inbox`
- `Companion Ask`
- `Companion Threads`

The simplest mental model is:

- a **workspace** is your current area of focus
- **follows** are the topics, assets, entities, or regions you care about
- the **inbox** is the stream of new items worth triaging
- **briefs** are generated summaries for that workspace
- **notes** are what you want to keep
- **actions** are what you want to do
- **threads** are durable topic buckets tying everything together

## 1. The Basic Workflow

If you only remember one workflow, use this:

1. Create one workspace for the thing you actually care about.
2. Add a few follows.
3. Review the inbox and save or dismiss items.
4. Generate a brief.
5. Ask a question about the workspace.
6. Save useful answers into notes or actions.
7. Create a thread for anything you want to keep tracking over time.

That is the intended practical loop.

## 2. Start With One Workspace

Open `Companion Home`.

If there is no active workspace yet:

- create one
- give it a clear name
- add a short description

Good examples:

- `Personal Finance`
- `China / Taiwan Risk`
- `Energy Watch`
- `Tech + AI Portfolio`

Do not create too many workspaces at first. One or two is enough.

## 3. Add Follows

Inside `Companion Home`, add follows for the things you want the workspace to
care about.

A follow has:

- a label
- a query

Examples for a personal finance workspace:

- `NVDA` -> `NVIDIA earnings AI datacenter GPU`
- `Oil` -> `Brent crude OPEC Strait of Hormuz refinery`
- `BTC` -> `bitcoin ETF flows stablecoins regulation`
- `Fed` -> `Federal Reserve rates inflation Powell`
- `Taiwan risk` -> `Taiwan semiconductor China military drills`

Practical advice:

- keep follows specific
- do not start with 30 follows
- start with 5 to 10 high-value ones

## 4. Use The Inbox As Your Triage Surface

Open `Companion Inbox`.

This is where you process new items for the active workspace.

For each item, do one of these:

- `Save` if it matters
- `Dismiss` if it is noise
- `Snooze` if it may matter later
- add a `tag` if you want lightweight grouping

Use the inbox like an analyst’s triage queue, not like a permanent archive.

Good habit:

- review only the top few items
- do not try to keep everything
- save only the things you would want to see again tomorrow

## 5. Generate Briefs

Back in `Companion Home`, use the brief section.

The main useful brief types are:

- `workspace_morning`
- `workspace_delta`

Use them like this:

- `workspace_morning`: “give me the current state of this workspace”
- `workspace_delta`: “what changed since I last checked”

Suggested habit:

- morning: run one morning brief for your main workspace
- later in the day: run a delta brief

This is the fastest way to turn the dashboard into a personal monitoring tool
instead of a raw feed wall.

## 6. Use Ask For Scoped Questions

Open `Companion Ask`.

This panel is most useful after you already have:

- a workspace
- some follows
- some inbox history
- at least one brief or note

Good questions:

- `What changed in my finance workspace today?`
- `Why does this oil move matter for my holdings?`
- `Compare NVIDIA and AMD risk right now`
- `Explain why Taiwan headlines are relevant to semis`
- `What is the most important thing I should watch this week?`

Bad questions:

- vague general chat with no workspace context
- broad questions unrelated to your follows

If an answer is useful:

- save it as a note
- save it as an action
- create a thread from it

## 7. Keep Notes For Durable Memory

Use notes when you want to preserve judgment, not just data.

Good note examples:

- `I care about Brent mainly as an inflation signal, not for direct exposure.`
- `Watch Taiwan only when it overlaps with semis or shipping.`
- `Ignore most crypto noise unless ETF flow or regulation changes.`

Use notes for:

- your reasoning
- your filters
- your priorities
- your “what matters / what does not” rules

This is what makes the companion personal instead of generic.

## 8. Turn Important Items Into Actions

Use actions when you want a concrete follow-up.

Examples:

- `Review NVDA earnings reaction`
- `Check bond yields after next Fed remarks`
- `Revisit oil exposure if Strait risk escalates`
- `Read the latest WTO trade restriction update`

Actions are better than notes when the outcome is:

- investigate
- read later
- compare
- decide
- review again on a deadline

## 9. Use Threads For Ongoing Topics

Open `Companion Threads`.

A thread is for any topic that will matter across multiple days or weeks.

Examples:

- `Semiconductor supply chain risk`
- `Oil shock watch`
- `Fed and rate path`
- `Taiwan escalation`

Create a thread when you notice a topic has:

- repeated inbox items
- repeated notes
- repeated ask runs
- repeated actions
- repeated brief references

Threads are the best place for “I want to keep tracking this story over time.”

## 10. Recommended Exact Workflow For A Personal Finance Setup

If your real goal is a personal finance companion, use this pattern.

### Workspace

Create one workspace called:

- `Personal Finance`

Description:

- `Macro, rates, energy, semis, crypto, and geopolitical signals that affect my holdings or risk appetite.`

### Follows

Start with:

- `Fed`
- `Oil`
- `Semis`
- `BTC`
- `US equities`
- `Taiwan risk`
- `Middle East shipping`

### Daily flow

Morning:

1. Open `Companion Home`
2. Run a morning brief
3. Open `Companion Inbox`
4. Save or dismiss the top items
5. Open `Companion Ask`
6. Ask one focused question

During the day:

1. Re-open the inbox
2. Snooze noise
3. Turn one or two important items into actions

End of day:

1. Run a delta brief
2. Save one short note about what mattered
3. Create or update a thread if a story is persisting

## 11. What Each Companion Panel Is Best For

### Companion Home

Use for:

- switching workspaces
- editing workspace metadata
- adding follows
- generating briefs
- seeing the high-level state

### Companion Inbox

Use for:

- triage
- save / dismiss / snooze
- tagging
- turning items into notes, actions, or threads

### Companion Ask

Use for:

- scoped reasoning over your current workspace
- comparison questions
- explanation questions
- deciding what matters

### Companion Threads

Use for:

- long-lived topics
- reviewing linked asks, briefs, notes, and actions
- building continuity over time

## 12. What To Ignore At First

Do not try to use everything at once.

At first, ignore:

- automation rules
- sync details
- backup/import/export
- multiple workspaces
- too many follows

The core value comes from this smaller loop:

- workspace
- follows
- inbox
- brief
- ask
- note/action

## 13. Signs You Are Using It Well

You are using the companion correctly if:

- your workspace has a clear purpose
- your follows are limited and specific
- your inbox gets smaller over time, not bigger
- your briefs feel relevant to your own context
- your notes capture judgment, not just copied headlines
- your actions are concrete
- your threads reflect ongoing topics you actually care about

## 14. Signs You Should Adjust

You should simplify if:

- every item gets saved
- your follows are too broad
- your asks are generic and repetitive
- you have many workspaces but no clear use for them
- your notes are just copied news summaries
- your inbox feels like another unread feed instead of a decision surface

## 15. Best Next Step

The best way to start is:

1. create a single `Personal Finance` workspace
2. add 5 to 7 follows
3. run one morning brief
4. process the inbox
5. ask one concrete question
6. save one note and one action

That is enough to make the current companion useful without learning every
feature at once.
