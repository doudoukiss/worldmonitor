import type { Monitor, PanelConfig, MapLayers } from '@/types';
import type { AppContext } from '@/app/app-context';
import {
  REFRESH_INTERVALS,
  DEFAULT_PANELS,
  DEFAULT_MAP_LAYERS,
  MOBILE_DEFAULT_MAP_LAYERS,
  STORAGE_KEYS,
  SITE_VARIANT,
  ALL_PANELS,
  VARIANT_DEFAULTS,
  getEffectivePanelConfig,
} from '@/config';
import { sanitizeLayersForVariant } from '@/config/map-layer-definitions';
import type { MapVariant } from '@/config/map-layer-definitions';
import { initDB, cleanOldSnapshots, isAisConfigured, initAisStream, isOutagesConfigured, disconnectAisStream } from '@/services';
import { getMarketWatchlistEntries } from '@/services/market-watchlist';
import { mlWorker } from '@/services/ml-worker';
import { getAiFlowSettings, subscribeAiFlowChange, isHeadlineMemoryEnabled } from '@/services/ai-flow-settings';
import { startLearning } from '@/services/country-instability';
import { loadFromStorage, parseMapUrlState, saveToStorage, isMobileDevice } from '@/utils';
import type { ParsedMapUrlState } from '@/utils';
import { SignalModal, IntelligenceGapBadge, BreakingNewsBanner } from '@/components';
import { initBreakingNewsAlerts, destroyBreakingNewsAlerts } from '@/services/breaking-news-alerts';
import type { ServiceStatusPanel } from '@/components/ServiceStatusPanel';
import type { StablecoinPanel } from '@/components/StablecoinPanel';
import type { ETFFlowsPanel } from '@/components/ETFFlowsPanel';
import type { MacroSignalsPanel } from '@/components/MacroSignalsPanel';
import type { StrategicPosturePanel } from '@/components/StrategicPosturePanel';
import type { StrategicRiskPanel } from '@/components/StrategicRiskPanel';
import type { GulfEconomiesPanel } from '@/components/GulfEconomiesPanel';
import { isDesktopRuntime, waitForSidecarReady } from '@/services/runtime';
import { getSecretState } from '@/services/runtime-config';
import { BETA_MODE } from '@/config/beta';
import { trackEvent, trackDeeplinkOpened } from '@/services/analytics';
import { preloadCountryGeometry, getCountryNameByCode } from '@/services/country-geometry';
import { initI18n } from '@/services/i18n';

import { computeDefaultDisabledSources, getLocaleBoostedSources, getTotalFeedCount } from '@/config/feeds';
import { fetchBootstrapData } from '@/services/bootstrap';
import { DesktopUpdater } from '@/app/desktop-updater';
import { CountryIntelManager } from '@/app/country-intel';
import { SearchManager } from '@/app/search-manager';
import { RefreshScheduler } from '@/app/refresh-scheduler';
import { PanelLayoutManager } from '@/app/panel-layout';
import { DataLoaderManager } from '@/app/data-loader';
import { EventHandlerManager } from '@/app/event-handlers';
import { SessionStore } from '@/app/session-store';
import { WorkspaceStore } from '@/app/workspace-store';
import { InboxStore } from '@/app/inbox-store';
import { BriefingStore } from '@/app/briefing-store';
import { coerceWorkspaceTemplateId } from '@/services/workspace-store';
import { activateWorkspaceRuntime } from '@/services/workspace-runtime';
import { resolveUserRegion, resolvePreciseUserCoordinates, type PreciseCoordinates } from '@/utils/user-location';
import { showProBanner } from '@/components/ProBanner';
import {
  listAutomationRules,
} from '@/services/automation-store';
import { saveAction } from '@/services/action-store';
import {
  commitAutomationEvent,
  evaluateBriefAutomationRules,
  evaluateInboxAutomationRules,
  evaluateWorkspaceAutomationRules,
} from '@/services/automation-engine';
import { buildWorkspaceBriefInputSignature, buildWorkspaceBriefRun, selectWorkspaceBriefItems } from '@/services/companion-briefing';
import {
  CorrelationEngine,
  militaryAdapter,
  escalationAdapter,
  economicAdapter,
  disasterAdapter,
} from '@/services/correlation-engine';
import type { CorrelationPanel } from '@/components/CorrelationPanel';

const CYBER_LAYER_ENABLED = import.meta.env.VITE_ENABLE_CYBER_LAYER === 'true';

export type { CountryBriefSignals } from '@/app/app-context';

export class App {
  private state: AppContext;
  private pendingDeepLinkCountry: string | null = null;
  private pendingDeepLinkExpanded = false;
  private pendingDeepLinkStoryCode: string | null = null;

  private panelLayout: PanelLayoutManager;
  private dataLoader: DataLoaderManager;
  private eventHandlers: EventHandlerManager;
  private searchManager: SearchManager;
  private countryIntel: CountryIntelManager;
  private refreshScheduler: RefreshScheduler;
  private desktopUpdater: DesktopUpdater;

  private modules: { destroy(): void }[] = [];
  private unsubAiFlow: (() => void) | null = null;
  private visiblePanelPrimed = new Set<string>();
  private visiblePanelPrimeRaf: number | null = null;
  private readonly handleViewportPrime = (): void => {
    if (this.visiblePanelPrimeRaf !== null) return;
    this.visiblePanelPrimeRaf = window.requestAnimationFrame(() => {
      this.visiblePanelPrimeRaf = null;
      void this.primeVisiblePanelData();
    });
  };

  private isPanelNearViewport(panelId: string, marginPx = 400): boolean {
    const panel = this.state.panels[panelId] as { isNearViewport?: (marginPx?: number) => boolean } | undefined;
    return panel?.isNearViewport?.(marginPx) ?? false;
  }

  private isAnyPanelNearViewport(panelIds: string[], marginPx = 400): boolean {
    return panelIds.some((panelId) => this.isPanelNearViewport(panelId, marginPx));
  }

  private shouldRefreshIntelligence(): boolean {
    return this.isAnyPanelNearViewport(['cii', 'strategic-risk', 'strategic-posture'])
      || !!this.state.countryBriefPage?.isVisible();
  }

  private shouldRefreshFirms(): boolean {
    return this.isPanelNearViewport('satellite-fires');
  }

  private shouldRefreshCorrelation(): boolean {
    return this.isAnyPanelNearViewport(['military-correlation', 'escalation-correlation', 'economic-correlation', 'disaster-correlation']);
  }

  private clonePanelSettings(panelSettings: Record<string, PanelConfig>): Record<string, PanelConfig> {
    return Object.fromEntries(
      Object.entries(panelSettings).map(([key, value]) => [key, { ...value }]),
    );
  }

  private canHotApplyWorkspace(workspace: import('@/types').Workspace): boolean {
    return !Object.entries(workspace.panelSettings).some(([key, config]) => (
      key !== 'map' && config.enabled && !this.state.panels[key]
    ));
  }

  private activateWorkspace(workspaceId: string): void {
    if (workspaceId === this.state.sessionStore.getSnapshot().activeWorkspaceId) return;

    this.syncCompanionStores();
    const workspace = this.state.workspaceStore.getWorkspace(workspaceId);
    if (!workspace) return;

    this.state.sessionStore.setActiveWorkspaceId(workspaceId);

    if (!this.canHotApplyWorkspace(workspace)) {
      activateWorkspaceRuntime(workspace);
      return;
    }

    this.state.panelSettings = this.clonePanelSettings(workspace.panelSettings);
    this.state.mapLayers = { ...workspace.mapLayers };
    saveToStorage(STORAGE_KEYS.panels, this.state.panelSettings);
    saveToStorage(STORAGE_KEYS.mapLayers, this.state.mapLayers);

    this.panelLayout.applyPanelSettings();
    this.eventHandlers.applyPanelSettings();
    this.state.map?.setLayers(this.state.mapLayers);
    this.dataLoader.syncDataFreshnessWithLayers();
    this.eventHandlers.syncUrlState();
    this.state.unifiedSettings?.refreshPanelToggles();
    this.searchManager.updateSearchIndex();
    this.syncCompanionStores();
    this.eventHandlers.showToast(`Switched to ${workspace.name}`);
  }

  private syncCompanionStores(): void {
    const defaultWorkspace = this.state.workspaceStore.ensureDefaultWorkspace({
      template: coerceWorkspaceTemplateId(SITE_VARIANT),
      monitors: this.state.monitors,
      marketWatchlist: getMarketWatchlistEntries(),
      panelSettings: this.state.panelSettings,
      mapLayers: this.state.mapLayers,
    });

    const currentSession = this.state.sessionStore.getSnapshot();
    if (!this.state.workspaceStore.getWorkspace(currentSession.activeWorkspaceId)) {
      this.state.sessionStore.setActiveWorkspaceId(defaultWorkspace.id);
    }

    const activeWorkspace = this.state.workspaceStore.getActiveWorkspace(
      this.state.sessionStore.getSnapshot().activeWorkspaceId,
    ) ?? defaultWorkspace;

    if (!activeWorkspace.legacyBacked) {
      this.state.workspaceStore.updateWorkspace(activeWorkspace.id, {
        panelSettings: this.state.panelSettings,
        mapLayers: this.state.mapLayers,
        pinnedPanelIds: Object.keys(this.state.panelSettings)
          .filter((key) => this.state.panelSettings[key]?.enabled)
          .slice(0, 12),
      });
    }

    this.state.briefingStore.ensureDefaultRecipes(activeWorkspace);
    this.state.inboxStore.ensureWelcomeItem(activeWorkspace);
    this.state.inboxStore.syncFromSignals({
      workspace: activeWorkspace,
      news: this.state.allNews,
      markets: this.state.latestMarkets,
      predictions: this.state.latestPredictions,
    });

    const automationRules = listAutomationRules(activeWorkspace.id);
    const automationEvents = evaluateInboxAutomationRules(
      activeWorkspace,
      automationRules,
      this.state.inboxStore.listItems(activeWorkspace.id),
    );
    for (const event of automationEvents.slice(0, 6)) {
      const committed = commitAutomationEvent(event);
      if (committed.action === 'create_action') {
        const sourceItemId = typeof committed.metadata.sourceItemId === 'string'
          ? committed.metadata.sourceItemId
          : null;
        saveAction({
          workspaceId: activeWorkspace.id,
          title: `Automation: ${committed.subtitle}`,
          status: 'open',
          relatedItemIds: sourceItemId ? [sourceItemId] : [],
          relatedFollowIds: [],
          dueAt: Date.now() + 24 * 60 * 60 * 1000,
        });
        continue;
      }
      this.state.inboxStore.addSystemItem({
        id: committed.dedupeKey,
        workspaceId: activeWorkspace.id,
        title: committed.title,
        subtitle: committed.subtitle,
        score: committed.score,
        metadata: committed.metadata,
      });
    }

    const latestBriefGeneratedAt = this.state.briefingStore.listRecipes(activeWorkspace.id)
      .map((recipe) => this.state.briefingStore.getLatestRun(recipe.id)?.generatedAt ?? null)
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => b - a)[0] ?? null;

    const workspaceEvents = evaluateWorkspaceAutomationRules(
      activeWorkspace,
      automationRules,
      {
        previousVisitedAt: this.state.sessionStore.getSnapshot().previousVisitedAt,
        latestBriefGeneratedAt,
      },
    );

    for (const event of workspaceEvents.slice(0, 3)) {
      const committed = commitAutomationEvent(event);
      if (committed.action === 'queue_brief') {
        const recipe = this.state.briefingStore.listRecipes(activeWorkspace.id)
          .find((entry) => entry.kind === 'workspace_morning');
        if (recipe) {
          const session = this.state.sessionStore.getSnapshot();
          const scopedItems = this.state.inboxStore.listItems(activeWorkspace.id);
          const candidateItems = selectWorkspaceBriefItems(recipe, scopedItems, session.previousVisitedAt);
          const inputSignature = buildWorkspaceBriefInputSignature(recipe, candidateItems, session.previousVisitedAt);
          const reusableRun = this.state.briefingStore.findReusableRun(recipe.id, inputSignature);
          if (!reusableRun) {
            void buildWorkspaceBriefRun({
              workspace: activeWorkspace,
              recipe,
              items: scopedItems,
              previousVisitedAt: session.previousVisitedAt,
            }).then((run) => {
              this.state.briefingStore.saveRun(run);
              const briefEvents = evaluateBriefAutomationRules(
                activeWorkspace,
                automationRules,
                run,
              );
              for (const briefEvent of briefEvents.slice(0, 3)) {
                const committedBriefEvent = commitAutomationEvent(briefEvent);
                if (committedBriefEvent.action === 'create_action') {
                  saveAction({
                    workspaceId: activeWorkspace.id,
                    title: `Automation: ${committedBriefEvent.subtitle}`,
                    status: 'open',
                    relatedItemIds: [],
                    relatedFollowIds: [],
                    dueAt: Date.now() + 24 * 60 * 60 * 1000,
                  });
                  continue;
                }
                this.state.inboxStore.addSystemItem({
                  id: committedBriefEvent.dedupeKey,
                  workspaceId: activeWorkspace.id,
                  title: committedBriefEvent.title,
                  subtitle: committedBriefEvent.subtitle,
                  score: committedBriefEvent.score,
                  metadata: committedBriefEvent.metadata,
                });
              }
            }).catch((error) => {
              console.warn('[Automation] Failed queued brief generation:', error);
            });
          }
        }
        continue;
      }
      if (committed.action === 'create_action') {
        saveAction({
          workspaceId: activeWorkspace.id,
          title: `Automation: ${committed.title}`,
          status: 'open',
          relatedItemIds: [],
          relatedFollowIds: [],
          dueAt: Date.now() + 24 * 60 * 60 * 1000,
        });
        continue;
      }
      this.state.inboxStore.addSystemItem({
        id: committed.dedupeKey,
        workspaceId: activeWorkspace.id,
        title: committed.title,
        subtitle: committed.subtitle,
        score: committed.score,
        metadata: committed.metadata,
      });
    }
  }

  private async primeVisiblePanelData(forceAll = false): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    const primeTask = (key: string, task: () => Promise<unknown>): void => {
      if (this.visiblePanelPrimed.has(key) || this.state.inFlight.has(key)) return;
      const wrapped = (async () => {
        this.state.inFlight.add(key);
        try {
          await task();
          this.visiblePanelPrimed.add(key);
        } finally {
          this.state.inFlight.delete(key);
        }
      })();
      tasks.push(wrapped);
    };

    const shouldPrime = (id: string): boolean => forceAll || this.isPanelNearViewport(id);
    const shouldPrimeAny = (ids: string[]): boolean => forceAll || this.isAnyPanelNearViewport(ids);

    if (shouldPrime('service-status')) {
      const panel = this.state.panels['service-status'] as ServiceStatusPanel | undefined;
      if (panel) primeTask('service-status', () => panel.fetchStatus());
    }
    if (shouldPrime('macro-signals')) {
      const panel = this.state.panels['macro-signals'] as MacroSignalsPanel | undefined;
      if (panel) primeTask('macro-signals', () => panel.fetchData());
    }
    if (shouldPrime('etf-flows')) {
      const panel = this.state.panels['etf-flows'] as ETFFlowsPanel | undefined;
      if (panel) primeTask('etf-flows', () => panel.fetchData());
    }
    if (shouldPrime('stablecoins')) {
      const panel = this.state.panels.stablecoins as StablecoinPanel | undefined;
      if (panel) primeTask('stablecoins', () => panel.fetchData());
    }
    if (shouldPrime('telegram-intel')) {
      primeTask('telegram-intel', () => this.dataLoader.loadTelegramIntel());
    }
    if (shouldPrime('gulf-economies')) {
      const panel = this.state.panels['gulf-economies'] as GulfEconomiesPanel | undefined;
      if (panel) primeTask('gulf-economies', () => panel.fetchData());
    }
    if (shouldPrimeAny(['markets', 'heatmap', 'commodities', 'crypto', 'energy-complex'])) {
      primeTask('markets', () => this.dataLoader.loadMarkets());
    }
    if (shouldPrime('polymarket')) {
      primeTask('predictions', () => this.dataLoader.loadPredictions());
    }
    if (shouldPrime('economic')) {
      primeTask('fred', () => this.dataLoader.loadFredData());
      primeTask('spending', () => this.dataLoader.loadGovernmentSpending());
      primeTask('bis', () => this.dataLoader.loadBisData());
    }
    if (shouldPrime('energy-complex')) {
      primeTask('oil', () => this.dataLoader.loadOilAnalytics());
    }
    if (shouldPrime('trade-policy')) {
      primeTask('tradePolicy', () => this.dataLoader.loadTradePolicy());
    }
    if (shouldPrime('supply-chain')) {
      primeTask('supplyChain', () => this.dataLoader.loadSupplyChain());
    }
    if (getSecretState('WORLDMONITOR_API_KEY').present) {
      if (shouldPrime('stock-analysis')) {
        primeTask('stockAnalysis', () => this.dataLoader.loadStockAnalysis());
      }
      if (shouldPrime('stock-backtest')) {
        primeTask('stockBacktest', () => this.dataLoader.loadStockBacktest());
      }
      if (shouldPrime('daily-market-brief')) {
        primeTask('dailyMarketBrief', () => this.dataLoader.loadDailyMarketBrief());
      }
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);

    const PANEL_ORDER_KEY = 'panel-order';
    const PANEL_SPANS_KEY = 'worldmonitor-panel-spans';

    const isMobile = isMobileDevice();
    const isDesktopApp = isDesktopRuntime();
    const monitors = loadFromStorage<Monitor[]>(STORAGE_KEYS.monitors, []);
    const marketWatchlist = getMarketWatchlistEntries();

    // Use mobile-specific defaults on first load (no saved layers)
    const defaultLayers = isMobile ? MOBILE_DEFAULT_MAP_LAYERS : DEFAULT_MAP_LAYERS;

    let mapLayers: MapLayers;
    let panelSettings: Record<string, PanelConfig>;

    // Check if variant changed - reset all settings to variant defaults
    const storedVariant = localStorage.getItem('worldmonitor-variant');
    const currentVariant = SITE_VARIANT;
    console.log(`[App] Variant check: stored="${storedVariant}", current="${currentVariant}"`);
    if (storedVariant !== currentVariant) {
      // Variant changed — seed new variant's panels but preserve existing user choices
      console.log('[App] Variant changed - seeding new defaults, preserving user choices');
      localStorage.setItem('worldmonitor-variant', currentVariant);
      // Reset map layers for the new variant (map layers are not user-personalized the same way)
      localStorage.removeItem(STORAGE_KEYS.mapLayers);
      mapLayers = sanitizeLayersForVariant({ ...defaultLayers }, currentVariant as MapVariant);
      // Load existing panel prefs (if any) and seed new variant's panels
      panelSettings = loadFromStorage<Record<string, PanelConfig>>(STORAGE_KEYS.panels, {});
      for (const key of (VARIANT_DEFAULTS[currentVariant] ?? [])) {
        if (!(key in panelSettings)) {
          panelSettings[key] = { ...getEffectivePanelConfig(key, currentVariant), enabled: true };
        }
      }
    } else {
      mapLayers = sanitizeLayersForVariant(
        loadFromStorage<MapLayers>(STORAGE_KEYS.mapLayers, defaultLayers),
        currentVariant as MapVariant,
      );
      panelSettings = loadFromStorage<Record<string, PanelConfig>>(
        STORAGE_KEYS.panels,
        DEFAULT_PANELS
      );

      // One-time migration: preserve user preferences across panel key renames.
      const PANEL_KEY_RENAMES_MIGRATION_KEY = 'worldmonitor-panel-key-renames-v2.6';
      if (!localStorage.getItem(PANEL_KEY_RENAMES_MIGRATION_KEY)) {
        const keyRenames: Array<[string, string]> = [
          ['live-youtube', 'live-webcams'],
          ['pinned-webcams', 'windy-webcams'],
        ];
        let migrated = false;
        for (const [legacyKey, nextKey] of keyRenames) {
          if (!panelSettings[legacyKey] || panelSettings[nextKey]) continue;
          panelSettings[nextKey] = {
            ...DEFAULT_PANELS[nextKey],
            ...panelSettings[legacyKey],
            name: DEFAULT_PANELS[nextKey]?.name ?? panelSettings[legacyKey].name,
          };
          delete panelSettings[legacyKey];
          migrated = true;
        }
        if (migrated) saveToStorage(STORAGE_KEYS.panels, panelSettings);
        localStorage.setItem(PANEL_KEY_RENAMES_MIGRATION_KEY, 'done');
      }

      // Merge in any panels from ALL_PANELS that didn't exist when settings were saved
      for (const key of Object.keys(ALL_PANELS)) {
        if (!(key in panelSettings)) {
          const isDefault = (VARIANT_DEFAULTS[SITE_VARIANT] ?? []).includes(key);
          panelSettings[key] = { ...getEffectivePanelConfig(key, SITE_VARIANT), enabled: isDefault };
        }
      }

      // One-time migration: expose all panels to existing users (previously variant-gated)
      const UNIFIED_MIGRATION_KEY = 'worldmonitor-unified-panels-v1';
      if (!localStorage.getItem(UNIFIED_MIGRATION_KEY)) {
        const variantDefaults = new Set(VARIANT_DEFAULTS[SITE_VARIANT] ?? []);
        for (const key of Object.keys(ALL_PANELS)) {
          if (!(key in panelSettings)) {
            panelSettings[key] = { ...getEffectivePanelConfig(key, SITE_VARIANT), enabled: variantDefaults.has(key) };
          }
        }
        saveToStorage(STORAGE_KEYS.panels, panelSettings);
        localStorage.setItem(UNIFIED_MIGRATION_KEY, 'done');
      }
      console.log('[App] Loaded panel settings from storage:', Object.entries(panelSettings).filter(([_, v]) => !v.enabled).map(([k]) => k));

      // One-time migration: reorder panels for existing users (v1.9 panel layout)
      const PANEL_ORDER_MIGRATION_KEY = 'worldmonitor-panel-order-v1.9';
      if (!localStorage.getItem(PANEL_ORDER_MIGRATION_KEY)) {
        const savedOrder = localStorage.getItem(PANEL_ORDER_KEY);
        if (savedOrder) {
          try {
            const order: string[] = JSON.parse(savedOrder);
            const priorityPanels = ['insights', 'strategic-posture', 'cii', 'strategic-risk'];
            const filtered = order.filter(k => !priorityPanels.includes(k) && k !== 'live-news');
            const liveNewsIdx = order.indexOf('live-news');
            const newOrder = liveNewsIdx !== -1 ? ['live-news'] : [];
            newOrder.push(...priorityPanels.filter(p => order.includes(p)));
            newOrder.push(...filtered);
            localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(newOrder));
            console.log('[App] Migrated panel order to v1.9 layout');
          } catch {
            // Invalid saved order, will use defaults
          }
        }
        localStorage.setItem(PANEL_ORDER_MIGRATION_KEY, 'done');
      }

      // Tech variant migration: move insights to top (after live-news)
      if (currentVariant === 'tech') {
        const TECH_INSIGHTS_MIGRATION_KEY = 'worldmonitor-tech-insights-top-v1';
        if (!localStorage.getItem(TECH_INSIGHTS_MIGRATION_KEY)) {
          const savedOrder = localStorage.getItem(PANEL_ORDER_KEY);
          if (savedOrder) {
            try {
              const order: string[] = JSON.parse(savedOrder);
              const filtered = order.filter(k => k !== 'insights' && k !== 'live-news');
              const newOrder: string[] = [];
              if (order.includes('live-news')) newOrder.push('live-news');
              if (order.includes('insights')) newOrder.push('insights');
              newOrder.push(...filtered);
              localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(newOrder));
              console.log('[App] Tech variant: Migrated insights panel to top');
            } catch {
              // Invalid saved order, will use defaults
            }
          }
          localStorage.setItem(TECH_INSIGHTS_MIGRATION_KEY, 'done');
        }
      }
    }

    // One-time migration: prune removed panel keys from stored settings and order
    const PANEL_PRUNE_KEY = 'worldmonitor-panel-prune-v1';
    if (!localStorage.getItem(PANEL_PRUNE_KEY)) {
      const validKeys = new Set(Object.keys(ALL_PANELS));
      let pruned = false;
      for (const key of Object.keys(panelSettings)) {
        if (!validKeys.has(key) && key !== 'runtime-config') {
          delete panelSettings[key];
          pruned = true;
        }
      }
      if (pruned) saveToStorage(STORAGE_KEYS.panels, panelSettings);
      for (const orderKey of [PANEL_ORDER_KEY, PANEL_ORDER_KEY + '-bottom-set', PANEL_ORDER_KEY + '-bottom']) {
        try {
          const raw = localStorage.getItem(orderKey);
          if (!raw) continue;
          const arr = JSON.parse(raw);
          if (!Array.isArray(arr)) continue;
          const filtered = arr.filter((k: string) => validKeys.has(k));
          if (filtered.length !== arr.length) localStorage.setItem(orderKey, JSON.stringify(filtered));
        } catch { localStorage.removeItem(orderKey); }
      }
      localStorage.setItem(PANEL_PRUNE_KEY, 'done');
    }

    // One-time migration: clear stale panel ordering and sizing state
    const LAYOUT_RESET_MIGRATION_KEY = 'worldmonitor-layout-reset-v2.5';
    if (!localStorage.getItem(LAYOUT_RESET_MIGRATION_KEY)) {
      const hadSavedOrder = !!localStorage.getItem(PANEL_ORDER_KEY);
      const hadSavedSpans = !!localStorage.getItem(PANEL_SPANS_KEY);
      if (hadSavedOrder || hadSavedSpans) {
        localStorage.removeItem(PANEL_ORDER_KEY);
        localStorage.removeItem(PANEL_ORDER_KEY + '-bottom');
        localStorage.removeItem(PANEL_ORDER_KEY + '-bottom-set');
        localStorage.removeItem(PANEL_SPANS_KEY);
        console.log('[App] Applied layout reset migration (v2.5): cleared panel order/spans');
      }
      localStorage.setItem(LAYOUT_RESET_MIGRATION_KEY, 'done');
    }

    // Desktop key management panel must always remain accessible in Tauri.
    if (isDesktopApp) {
      if (!panelSettings['runtime-config']) {
        panelSettings['runtime-config'] = {
          name: 'Desktop Configuration',
          enabled: true,
          priority: 2,
        };
        saveToStorage(STORAGE_KEYS.panels, panelSettings);
      }
    }

    const initialUrlState: ParsedMapUrlState | null = parseMapUrlState(window.location.search, mapLayers);
    if (initialUrlState.layers) {
      mapLayers = sanitizeLayersForVariant(initialUrlState.layers, currentVariant as MapVariant);
      initialUrlState.layers = mapLayers;
    }
    if (!CYBER_LAYER_ENABLED) {
      mapLayers.cyberThreats = false;
    }
    // One-time migration: reduce default-enabled sources (full variant only)
    if (currentVariant === 'full') {
      const baseKey = 'worldmonitor-sources-reduction-v3';
      if (!localStorage.getItem(baseKey)) {
        const defaultDisabled = computeDefaultDisabledSources();
        saveToStorage(STORAGE_KEYS.disabledFeeds, defaultDisabled);
        localStorage.setItem(baseKey, 'done');
        const total = getTotalFeedCount();
        console.log(`[App] Sources reduction: ${defaultDisabled.length} disabled, ${total - defaultDisabled.length} enabled`);
      }
      // Locale boost: additively enable locale-matched sources (runs once per locale)
      const userLang = ((navigator.language ?? 'en').split('-')[0] ?? 'en').toLowerCase();
      const localeKey = `worldmonitor-locale-boost-${userLang}`;
      if (userLang !== 'en' && !localStorage.getItem(localeKey)) {
        const boosted = getLocaleBoostedSources(userLang);
        if (boosted.size > 0) {
          const current = loadFromStorage<string[]>(STORAGE_KEYS.disabledFeeds, []);
          const updated = current.filter(name => !boosted.has(name));
          saveToStorage(STORAGE_KEYS.disabledFeeds, updated);
          console.log(`[App] Locale boost (${userLang}): enabled ${current.length - updated.length} sources`);
        }
        localStorage.setItem(localeKey, 'done');
      }
    }

    const disabledSources = new Set(loadFromStorage<string[]>(STORAGE_KEYS.disabledFeeds, []));
    const sessionStore = new SessionStore();
    const workspaceStore = new WorkspaceStore();
    const inboxStore = new InboxStore();
    const briefingStore = new BriefingStore();

    const defaultWorkspace = workspaceStore.ensureDefaultWorkspace({
      template: coerceWorkspaceTemplateId(SITE_VARIANT),
      monitors,
      marketWatchlist,
      panelSettings,
      mapLayers,
    });

    if (!workspaceStore.getWorkspace(sessionStore.getSnapshot().activeWorkspaceId)) {
      sessionStore.setActiveWorkspaceId(defaultWorkspace.id);
    }

    const activeWorkspace = workspaceStore.getActiveWorkspace(sessionStore.getSnapshot().activeWorkspaceId) ?? defaultWorkspace;
    briefingStore.ensureDefaultRecipes(activeWorkspace);
    inboxStore.ensureWelcomeItem(activeWorkspace);

    // Build shared state object
    this.state = {
      map: null,
      isMobile,
      isDesktopApp,
      container: el,
      sessionStore,
      workspaceStore,
      inboxStore,
      briefingStore,
      panels: {},
      newsPanels: {},
      panelSettings,
      mapLayers,
      allNews: [],
      newsByCategory: {},
      latestMarkets: [],
      latestPredictions: [],
      latestClusters: [],
      intelligenceCache: {},
      cyberThreatsCache: null,
      disabledSources,
      currentTimeRange: '7d',
      inFlight: new Set(),
      seenGeoAlerts: new Set(),
      monitors,
      signalModal: null,
      statusPanel: null,
      searchModal: null,
      findingsBadge: null,
      breakingBanner: null,
      playbackControl: null,
      exportPanel: null,
      unifiedSettings: null,
      pizzintIndicator: null,
      correlationEngine: null,
      llmStatusIndicator: null,
      countryBriefPage: null,
      countryTimeline: null,
      positivePanel: null,
      countersPanel: null,
      progressPanel: null,
      breakthroughsPanel: null,
      heroPanel: null,
      digestPanel: null,
      speciesPanel: null,
      renewablePanel: null,
      tvMode: null,
      happyAllItems: [],
      isDestroyed: false,
      isPlaybackMode: false,
      isIdle: false,
      initialLoadComplete: false,
      resolvedLocation: 'global',
      initialUrlState,
      PANEL_ORDER_KEY,
      PANEL_SPANS_KEY,
    };

    // Instantiate modules (callbacks wired after all modules exist)
    this.refreshScheduler = new RefreshScheduler(this.state);
    this.countryIntel = new CountryIntelManager(this.state);
    this.desktopUpdater = new DesktopUpdater(this.state);

    this.dataLoader = new DataLoaderManager(this.state, {
      renderCriticalBanner: (postures) => this.panelLayout.renderCriticalBanner(postures),
      refreshOpenCountryBrief: () => this.countryIntel.refreshOpenBrief(),
      syncCompanionStores: () => this.syncCompanionStores(),
    });

    this.searchManager = new SearchManager(this.state, {
      openCountryBriefByCode: (code, country) => this.countryIntel.openCountryBriefByCode(code, country),
      activateWorkspace: (workspaceId) => this.activateWorkspace(workspaceId),
    });

    this.panelLayout = new PanelLayoutManager(this.state, {
      openCountryStory: (code, name) => this.countryIntel.openCountryStory(code, name),
      openCountryBrief: (code) => {
        const name = CountryIntelManager.resolveCountryName(code);
        void this.countryIntel.openCountryBriefByCode(code, name);
      },
      activateWorkspace: (workspaceId) => this.activateWorkspace(workspaceId),
      loadAllData: () => this.dataLoader.loadAllData(),
      updateMonitorResults: () => this.dataLoader.updateMonitorResults(),
      loadSecurityAdvisories: () => this.dataLoader.loadSecurityAdvisories(),
      syncCompanionStores: () => this.syncCompanionStores(),
    });

    this.eventHandlers = new EventHandlerManager(this.state, {
      updateSearchIndex: () => this.searchManager.updateSearchIndex(),
      loadAllData: () => this.dataLoader.loadAllData(),
      flushStaleRefreshes: () => this.refreshScheduler.flushStaleRefreshes(),
      setHiddenSince: (ts) => this.refreshScheduler.setHiddenSince(ts),
      loadDataForLayer: (layer) => { void this.dataLoader.loadDataForLayer(layer as keyof MapLayers); },
      waitForAisData: () => this.dataLoader.waitForAisData(),
      syncDataFreshnessWithLayers: () => this.dataLoader.syncDataFreshnessWithLayers(),
      ensureCorrectZones: () => this.panelLayout.ensureCorrectZones(),
      syncCompanionStores: () => this.syncCompanionStores(),
      refreshOpenCountryBrief: () => this.countryIntel.refreshOpenBrief(),
      stopLayerActivity: (layer) => this.dataLoader.stopLayerActivity(layer),
    });

    // Wire cross-module callback: DataLoader → SearchManager
    this.dataLoader.updateSearchIndex = () => this.searchManager.updateSearchIndex();

    // Track destroy order (reverse of init)
    this.modules = [
      this.desktopUpdater,
      this.panelLayout,
      this.countryIntel,
      this.searchManager,
      this.dataLoader,
      this.refreshScheduler,
      this.eventHandlers,
    ];
  }

  public async init(): Promise<void> {
    const initStart = performance.now();
    this.state.sessionStore.markVisit();
    await initDB();
    await initI18n();
    const aiFlow = getAiFlowSettings();
    if (aiFlow.browserModel || isDesktopRuntime()) {
      await mlWorker.init();
      if (BETA_MODE) mlWorker.loadModel('summarization-beta').catch(() => { });
    }

    if (aiFlow.headlineMemory) {
      mlWorker.init().then(ok => {
        if (ok) mlWorker.loadModel('embeddings').catch(() => { });
      }).catch(() => { });
    }

    this.unsubAiFlow = subscribeAiFlowChange((key) => {
      if (key === 'browserModel') {
        const s = getAiFlowSettings();
        if (s.browserModel) {
          mlWorker.init();
        } else if (!isHeadlineMemoryEnabled()) {
          mlWorker.terminate();
        }
      }
      if (key === 'headlineMemory') {
        if (isHeadlineMemoryEnabled()) {
          mlWorker.init().then(ok => {
            if (ok) mlWorker.loadModel('embeddings').catch(() => { });
          }).catch(() => { });
        } else {
          mlWorker.unloadModel('embeddings').catch(() => { });
          const s = getAiFlowSettings();
          if (!s.browserModel && !isDesktopRuntime()) {
            mlWorker.terminate();
          }
        }
      }
    });

    // Check AIS configuration before init
    if (!isAisConfigured()) {
      this.state.mapLayers.ais = false;
    } else if (this.state.mapLayers.ais) {
      initAisStream();
    }

    // Wait for sidecar readiness on desktop so bootstrap hits a live server
    if (isDesktopRuntime()) {
      await waitForSidecarReady(3000);
    }

    // Hydrate in-memory cache from bootstrap endpoint (before panels construct and fetch)
    await fetchBootstrapData();

    const geoCoordsPromise: Promise<PreciseCoordinates | null> =
      this.state.isMobile && this.state.initialUrlState?.lat === undefined && this.state.initialUrlState?.lon === undefined
        ? resolvePreciseUserCoordinates(5000)
        : Promise.resolve(null);

    const resolvedRegion = await resolveUserRegion();
    this.state.resolvedLocation = resolvedRegion;

    // Phase 1: Layout (creates map + panels — they'll find hydrated data)
    this.panelLayout.init();
    showProBanner(this.state.container);

    const mobileGeoCoords = await geoCoordsPromise;
    if (mobileGeoCoords && this.state.map) {
      this.state.map.setCenter(mobileGeoCoords.lat, mobileGeoCoords.lon, 6);
    }

    // Happy variant: pre-populate panels from persistent cache for instant render
    if (SITE_VARIANT === 'happy') {
      await this.dataLoader.hydrateHappyPanelsFromCache();
    }

    // Phase 2: Shared UI components
    this.state.signalModal = new SignalModal();
    this.state.signalModal.setLocationClickHandler((lat, lon) => {
      this.state.map?.setCenter(lat, lon, 4);
    });
    if (!this.state.isMobile) {
      this.state.findingsBadge = new IntelligenceGapBadge();
      this.state.findingsBadge.setOnSignalClick((signal) => {
        if (this.state.countryBriefPage?.isVisible()) return;
        if (localStorage.getItem('wm-settings-open') === '1') return;
        this.state.signalModal?.showSignal(signal);
      });
      this.state.findingsBadge.setOnAlertClick((alert) => {
        if (this.state.countryBriefPage?.isVisible()) return;
        if (localStorage.getItem('wm-settings-open') === '1') return;
        this.state.signalModal?.showAlert(alert);
      });
    }

    if (!this.state.isMobile) {
      initBreakingNewsAlerts();
      this.state.breakingBanner = new BreakingNewsBanner();
    }

    // Phase 3: UI setup methods
    this.eventHandlers.startHeaderClock();
    this.eventHandlers.setupPlaybackControl();
    this.eventHandlers.setupStatusPanel();
    this.eventHandlers.setupPizzIntIndicator();
    this.eventHandlers.setupLlmStatusIndicator();
    this.eventHandlers.setupExportPanel();

    // Correlation engine
    const correlationEngine = new CorrelationEngine();
    correlationEngine.registerAdapter(militaryAdapter);
    correlationEngine.registerAdapter(escalationAdapter);
    correlationEngine.registerAdapter(economicAdapter);
    correlationEngine.registerAdapter(disasterAdapter);
    this.state.correlationEngine = correlationEngine;
    this.eventHandlers.setupUnifiedSettings();

    // Phase 4: SearchManager, MapLayerHandlers, CountryIntel
    this.searchManager.init();
    this.eventHandlers.setupMapLayerHandlers();
    this.countryIntel.init();

    // Phase 5: Event listeners + URL sync
    this.eventHandlers.init();
    // Capture deep link params BEFORE URL sync overwrites them
    const initState = parseMapUrlState(window.location.search, this.state.mapLayers);
    this.pendingDeepLinkCountry = initState.country ?? null;
    this.pendingDeepLinkExpanded = initState.expanded === true;
    const earlyParams = new URLSearchParams(window.location.search);
    this.pendingDeepLinkStoryCode = earlyParams.get('c') ?? null;
    this.eventHandlers.setupUrlStateSync();

    this.state.countryBriefPage?.onStateChange?.(() => {
      this.eventHandlers.syncUrlState();
    });

    // Start deep link handling early — its retry loop polls hasSufficientData()
    // independently, so it must not be gated behind loadAllData() which can hang.
    this.handleDeepLinks();

    // Phase 6: Data loading
    this.dataLoader.syncDataFreshnessWithLayers();
    await preloadCountryGeometry();
    // Prime panel-specific data concurrently with bulk loading.
    // primeVisiblePanelData owns ETF, Stablecoins, Gulf Economies, etc. that
    // are NOT part of loadAllData. Running them in parallel prevents those
    // panels from being blocked when a loadAllData batch is slow.
    window.addEventListener('scroll', this.handleViewportPrime, { passive: true });
    window.addEventListener('resize', this.handleViewportPrime);
    await Promise.all([
      this.dataLoader.loadAllData(true),
      this.primeVisiblePanelData(true),
    ]);

    // Initial correlation engine run
    if (this.state.correlationEngine) {
      void this.state.correlationEngine.run(this.state).then(() => {
        for (const domain of ['military', 'escalation', 'economic', 'disaster'] as const) {
          const panel = this.state.panels[`${domain}-correlation`] as CorrelationPanel | undefined;
          panel?.updateCards(this.state.correlationEngine!.getCards(domain));
        }
      });
    }

    startLearning();

    // Hide unconfigured layers after first data load
    if (!isAisConfigured()) {
      this.state.map?.hideLayerToggle('ais');
    }
    if (isOutagesConfigured() === false) {
      this.state.map?.hideLayerToggle('outages');
    }
    if (!CYBER_LAYER_ENABLED) {
      this.state.map?.hideLayerToggle('cyberThreats');
    }

    // Phase 7: Refresh scheduling
    this.setupRefreshIntervals();
    this.eventHandlers.setupSnapshotSaving();
    cleanOldSnapshots().catch((e) => console.warn('[Storage] Snapshot cleanup failed:', e));

    // Phase 8: Update checks
    this.desktopUpdater.init();

    // Analytics
    trackEvent('wm_app_loaded', {
      load_time_ms: Math.round(performance.now() - initStart),
      panel_count: Object.keys(this.state.panels).length,
    });
    this.eventHandlers.setupPanelViewTracking();
    this.syncCompanionStores();
  }

  public destroy(): void {
    this.state.isDestroyed = true;
    window.removeEventListener('scroll', this.handleViewportPrime);
    window.removeEventListener('resize', this.handleViewportPrime);
    if (this.visiblePanelPrimeRaf !== null) {
      window.cancelAnimationFrame(this.visiblePanelPrimeRaf);
      this.visiblePanelPrimeRaf = null;
    }

    // Destroy all modules in reverse order
    for (let i = this.modules.length - 1; i >= 0; i--) {
      this.modules[i]!.destroy();
    }

    // Clean up subscriptions, map, AIS, and breaking news
    this.unsubAiFlow?.();
    this.state.breakingBanner?.destroy();
    destroyBreakingNewsAlerts();
    this.state.map?.destroy();
    disconnectAisStream();
  }

  private handleDeepLinks(): void {
    const url = new URL(window.location.href);
    const DEEP_LINK_INITIAL_DELAY_MS = 1500;

    // Check for country brief deep link: ?c=IR (captured early before URL sync)
    const storyCode = this.pendingDeepLinkStoryCode ?? url.searchParams.get('c');
    this.pendingDeepLinkStoryCode = null;
    if (url.pathname === '/story' || storyCode) {
      const countryCode = storyCode;
      if (countryCode) {
        trackDeeplinkOpened('country', countryCode);
        const countryName = getCountryNameByCode(countryCode.toUpperCase()) || countryCode;
        setTimeout(() => {
          this.countryIntel.openCountryBriefByCode(countryCode.toUpperCase(), countryName, {
            maximize: true,
          });
          this.eventHandlers.syncUrlState();
        }, DEEP_LINK_INITIAL_DELAY_MS);
        return;
      }
    }

    // Check for country brief deep link: ?country=UA or ?country=UA&expanded=1
    const deepLinkCountry = this.pendingDeepLinkCountry;
    const deepLinkExpanded = this.pendingDeepLinkExpanded;
    this.pendingDeepLinkCountry = null;
    this.pendingDeepLinkExpanded = false;
    if (deepLinkCountry) {
      trackDeeplinkOpened('country', deepLinkCountry);
      const cName = CountryIntelManager.resolveCountryName(deepLinkCountry);
      setTimeout(() => {
        this.countryIntel.openCountryBriefByCode(deepLinkCountry, cName, {
          maximize: deepLinkExpanded,
        });
        this.eventHandlers.syncUrlState();
      }, DEEP_LINK_INITIAL_DELAY_MS);
    }
  }

  private setupRefreshIntervals(): void {
    // Always refresh news for all variants
    this.refreshScheduler.scheduleRefresh('news', () => this.dataLoader.loadNews(), REFRESH_INTERVALS.feeds);

    // Happy variant only refreshes news -- skip all geopolitical/financial/military refreshes
    if (SITE_VARIANT !== 'happy') {
      this.refreshScheduler.registerAll([
        {
          name: 'markets',
          fn: () => this.dataLoader.loadMarkets(),
          intervalMs: REFRESH_INTERVALS.markets,
          condition: () => this.isAnyPanelNearViewport(['markets', 'heatmap', 'commodities', 'crypto', 'crypto-heatmap', 'defi-tokens', 'ai-tokens', 'other-tokens']),
        },
        {
          name: 'predictions',
          fn: () => this.dataLoader.loadPredictions(),
          intervalMs: REFRESH_INTERVALS.predictions,
          condition: () => this.isPanelNearViewport('polymarket'),
        },
        {
          name: 'forecasts',
          fn: () => this.dataLoader.loadForecasts(),
          intervalMs: REFRESH_INTERVALS.forecasts,
          condition: () => this.isPanelNearViewport('forecast'),
        },
        { name: 'pizzint', fn: () => this.dataLoader.loadPizzInt(), intervalMs: REFRESH_INTERVALS.pizzint, condition: () => SITE_VARIANT === 'full' },
        { name: 'natural', fn: () => this.dataLoader.loadNatural(), intervalMs: REFRESH_INTERVALS.natural, condition: () => this.state.mapLayers.natural },
        { name: 'weather', fn: () => this.dataLoader.loadWeatherAlerts(), intervalMs: REFRESH_INTERVALS.weather, condition: () => this.state.mapLayers.weather },
        { name: 'fred', fn: () => this.dataLoader.loadFredData(), intervalMs: REFRESH_INTERVALS.fred, condition: () => this.isPanelNearViewport('economic') },
        { name: 'spending', fn: () => this.dataLoader.loadGovernmentSpending(), intervalMs: REFRESH_INTERVALS.spending, condition: () => this.isPanelNearViewport('economic') },
        { name: 'bis', fn: () => this.dataLoader.loadBisData(), intervalMs: REFRESH_INTERVALS.bis, condition: () => this.isPanelNearViewport('economic') },
        { name: 'oil', fn: () => this.dataLoader.loadOilAnalytics(), intervalMs: REFRESH_INTERVALS.oil, condition: () => this.isPanelNearViewport('energy-complex') },
        { name: 'firms', fn: () => this.dataLoader.loadFirmsData(), intervalMs: REFRESH_INTERVALS.firms, condition: () => this.shouldRefreshFirms() },
        { name: 'ais', fn: () => this.dataLoader.loadAisSignals(), intervalMs: REFRESH_INTERVALS.ais, condition: () => this.state.mapLayers.ais },
        { name: 'cables', fn: () => this.dataLoader.loadCableActivity(), intervalMs: REFRESH_INTERVALS.cables, condition: () => this.state.mapLayers.cables },
        { name: 'cableHealth', fn: () => this.dataLoader.loadCableHealth(), intervalMs: REFRESH_INTERVALS.cableHealth, condition: () => this.state.mapLayers.cables },
        { name: 'flights', fn: () => this.dataLoader.loadFlightDelays(), intervalMs: REFRESH_INTERVALS.flights, condition: () => this.state.mapLayers.flights },
        {
          name: 'cyberThreats', fn: () => {
            this.state.cyberThreatsCache = null;
            return this.dataLoader.loadCyberThreats();
          }, intervalMs: REFRESH_INTERVALS.cyberThreats, condition: () => CYBER_LAYER_ENABLED && this.state.mapLayers.cyberThreats
        },
      ]);
    }

    if (SITE_VARIANT === 'finance') {
      this.refreshScheduler.scheduleRefresh(
        'stock-analysis',
        () => this.dataLoader.loadStockAnalysis(),
        REFRESH_INTERVALS.stockAnalysis,
        () => getSecretState('WORLDMONITOR_API_KEY').present && this.isPanelNearViewport('stock-analysis'),
      );
      this.refreshScheduler.scheduleRefresh(
        'daily-market-brief',
        () => this.dataLoader.loadDailyMarketBrief(),
        REFRESH_INTERVALS.dailyMarketBrief,
        () => getSecretState('WORLDMONITOR_API_KEY').present && this.isPanelNearViewport('daily-market-brief'),
      );
      this.refreshScheduler.scheduleRefresh(
        'stock-backtest',
        () => this.dataLoader.loadStockBacktest(),
        REFRESH_INTERVALS.stockBacktest,
        () => getSecretState('WORLDMONITOR_API_KEY').present && this.isPanelNearViewport('stock-backtest'),
      );
    }

    // Panel-level refreshes (moved from panel constructors into scheduler for hidden-tab awareness + jitter)
    this.refreshScheduler.scheduleRefresh(
      'service-status',
      () => (this.state.panels['service-status'] as ServiceStatusPanel).fetchStatus(),
      REFRESH_INTERVALS.serviceStatus,
      () => this.isPanelNearViewport('service-status')
    );
    this.refreshScheduler.scheduleRefresh(
      'stablecoins',
      () => (this.state.panels.stablecoins as StablecoinPanel).fetchData(),
      REFRESH_INTERVALS.stablecoins,
      () => this.isPanelNearViewport('stablecoins')
    );
    this.refreshScheduler.scheduleRefresh(
      'etf-flows',
      () => (this.state.panels['etf-flows'] as ETFFlowsPanel).fetchData(),
      REFRESH_INTERVALS.etfFlows,
      () => this.isPanelNearViewport('etf-flows')
    );
    this.refreshScheduler.scheduleRefresh(
      'macro-signals',
      () => (this.state.panels['macro-signals'] as MacroSignalsPanel).fetchData(),
      REFRESH_INTERVALS.macroSignals,
      () => this.isPanelNearViewport('macro-signals')
    );
    this.refreshScheduler.scheduleRefresh(
      'strategic-posture',
      () => (this.state.panels['strategic-posture'] as StrategicPosturePanel).refresh(),
      REFRESH_INTERVALS.strategicPosture,
      () => this.isPanelNearViewport('strategic-posture')
    );
    this.refreshScheduler.scheduleRefresh(
      'strategic-risk',
      () => (this.state.panels['strategic-risk'] as StrategicRiskPanel).refresh(),
      REFRESH_INTERVALS.strategicRisk,
      () => this.isPanelNearViewport('strategic-risk')
    );

    // Server-side temporal anomalies (news + satellite_fires)
    if (SITE_VARIANT !== 'happy') {
      this.refreshScheduler.scheduleRefresh('temporalBaseline', () => this.dataLoader.refreshTemporalBaseline(), REFRESH_INTERVALS.temporalBaseline, () => this.shouldRefreshIntelligence());
    }

    // WTO trade policy data — annual data, poll every 10 min to avoid hammering upstream
    if (SITE_VARIANT === 'full' || SITE_VARIANT === 'finance' || SITE_VARIANT === 'commodity') {
      this.refreshScheduler.scheduleRefresh('tradePolicy', () => this.dataLoader.loadTradePolicy(), REFRESH_INTERVALS.tradePolicy, () => this.isPanelNearViewport('trade-policy'));
      this.refreshScheduler.scheduleRefresh('supplyChain', () => this.dataLoader.loadSupplyChain(), REFRESH_INTERVALS.supplyChain, () => this.isPanelNearViewport('supply-chain'));
    }

    // Telegram Intel (near real-time, 60s refresh)
    this.refreshScheduler.scheduleRefresh(
      'telegram-intel',
      () => this.dataLoader.loadTelegramIntel(),
      REFRESH_INTERVALS.telegramIntel,
      () => this.isPanelNearViewport('telegram-intel')
    );

    this.refreshScheduler.scheduleRefresh(
      'gulf-economies',
      () => (this.state.panels['gulf-economies'] as GulfEconomiesPanel).fetchData(),
      REFRESH_INTERVALS.gulfEconomies,
      () => this.isPanelNearViewport('gulf-economies')
    );

    // Refresh intelligence signals for CII (geopolitical variant only)
    if (SITE_VARIANT === 'full') {
      this.refreshScheduler.scheduleRefresh('intelligence', () => {
        const { military, iranEvents } = this.state.intelligenceCache;
        this.state.intelligenceCache = {};
        if (military) this.state.intelligenceCache.military = military;
        if (iranEvents) this.state.intelligenceCache.iranEvents = iranEvents;
        return this.dataLoader.loadIntelligenceSignals();
      }, REFRESH_INTERVALS.intelligence, () => this.shouldRefreshIntelligence());
    }

    // Correlation engine refresh
    this.refreshScheduler.scheduleRefresh(
      'correlation-engine',
      async () => {
        const engine = this.state.correlationEngine;
        if (!engine) return;
        await engine.run(this.state);
        for (const domain of ['military', 'escalation', 'economic', 'disaster'] as const) {
          const panel = this.state.panels[`${domain}-correlation`] as CorrelationPanel | undefined;
          panel?.updateCards(engine.getCards(domain));
        }
      },
      REFRESH_INTERVALS.correlationEngine,
      () => this.shouldRefreshCorrelation(),
    );
  }
}
