# Frontend Runtime

## Observed Architecture Shape

The browser app is a TypeScript SPA with a class-based UI model. It behaves
more like a custom application framework than a typical modern Preact/React
tree.

The main active pieces are:

- `src/main.ts`
- `src/App.ts`
- `src/app/*.ts` manager classes
- `src/components/Panel.ts` and its subclasses
- `src/components/DeckGLMap.ts` and `src/components/GlobeMap.ts`
- `src/services/*.ts` data and integration layer

## Startup Sequence

### `src/main.ts`

This file does the outer shell work:

- imports global CSS and map CSS
- initializes Sentry
- injects Vercel analytics
- sets up URL / UTM handling
- creates the `App` instance

### `src/App.ts`

`App` is the real runtime root.

The constructor does a large amount of bootstrapping before `init()` even runs:

- resolves desktop vs browser mode
- resolves variant and stored layout state
- performs multiple one-time localStorage migrations
- constructs the shared `AppContext`
- instantiates subsystem managers

The manager split is clear and useful:

- `RefreshScheduler`
- `CountryIntelManager`
- `DesktopUpdater`
- `DataLoaderManager`
- `SearchManager`
- `PanelLayoutManager`
- `EventHandlerManager`

`App.init()` then performs the async part of boot:

1. IndexedDB and i18n init
2. optional ML worker init
3. desktop sidecar readiness wait
4. bootstrap hydration fetch
5. layout creation
6. shared UI wiring
7. search / map / country intel init
8. full data loading and refresh registration

## State Model

The app does not use Redux, Zustand, MobX, or similar.

Instead, `src/app/app-context.ts` defines a large mutable `AppContext` object
holding:

- map references
- panel instances
- panel settings
- layer toggles
- cached datasets
- in-flight request tracking
- modal and support UI references
- lifecycle flags

This is simple to follow once understood, but it means behavior is spread across
imperative managers rather than a single declarative state graph.

## Panel System

`src/components/Panel.ts` is the core UI primitive.

The base class provides:

- panel chrome and header rendering
- retry and fetch state helpers
- row and column resize persistence
- debounced content writes
- premium badge handling in desktop mode
- activity and status badge helpers

The repo currently contains 57 direct `class ... extends Panel` definitions.
That is the real panel system, even though `src/components/` also includes maps,
modals, banners, and helpers that are not panels.

## Map System

The map layer is dual-mode:

- `DeckGLMap.ts` for the flat WebGL map
- `GlobeMap.ts` for the 3D globe

### `DeckGLMap.ts`

This file is one of the biggest concentration points in the repo. It mixes:

- MapLibre integration
- deck.gl layer creation
- clustering
- popup behavior
- static config datasets
- runtime data overlays
- variant-aware layer menus

It is a strong indicator that map behavior is one of the highest-complexity
surfaces in the app.

### `GlobeMap.ts`

The globe implementation mirrors many of the same data concepts but renders
through `globe.gl`, with a single merged marker model keyed by `_kind`.

## Variant Resolution

Variant detection lives in `src/config/variant.ts` and is based on:

- explicit build env
- hostname
- desktop localStorage override

The active panel and layer defaults come from `src/config/panels.ts`, which
exports variant-aware `DEFAULT_PANELS`, `DEFAULT_MAP_LAYERS`, and
`MOBILE_DEFAULT_MAP_LAYERS`.

## Key Frontend Findings

### The service layer is very large

`src/services/` has 104 top-level TypeScript files. `DataLoaderManager` pulls in
many of them directly, making it the frontend orchestration hub for cross-domain
loading.

### Preact is present but minimal

The project description often says "Vanilla TypeScript", and that is still
directionally correct. The repo depends on Preact, but the active app is mostly
custom class + DOM code. Only one direct `preact` import showed up under `src/`.

### There is config duplication risk

The dedicated files in `src/config/variants/` still exist, but they do not
appear to be the active defaults consumed by `App.ts`. That creates a risk that
future edits land in the wrong config layer.
