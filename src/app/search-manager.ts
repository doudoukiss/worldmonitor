import type { AppContext, AppModule } from '@/app/app-context';
import type { SearchResult } from '@/components/SearchModal';
import type { Follow, NewsItem, MapLayers, Workspace } from '@/types';
import type { MapView } from '@/components';
import type { Command } from '@/config/commands';
import { SearchModal } from '@/components';
import { CIIPanel } from '@/components';
import { SITE_VARIANT, STORAGE_KEYS } from '@/config';
import { getAllowedLayerKeys } from '@/config/map-layer-definitions';
import type { MapVariant } from '@/config/map-layer-definitions';
import { LAYER_PRESETS, LAYER_KEY_MAP } from '@/config/commands';
import { calculateCII, TIER1_COUNTRIES } from '@/services/country-instability';
import { CURATED_COUNTRIES } from '@/config/countries';
import { getCountryBbox } from '@/services/country-geometry';
import { INTEL_HOTSPOTS, CONFLICT_ZONES, MILITARY_BASES, UNDERSEA_CABLES, NUCLEAR_FACILITIES } from '@/config/geo';
import { PIPELINES } from '@/config/pipelines';
import { AI_DATA_CENTERS } from '@/config/ai-datacenters';
import { GAMMA_IRRADIATORS } from '@/config/irradiators';
import { TECH_COMPANIES } from '@/config/tech-companies';
import { AI_RESEARCH_LABS } from '@/config/ai-research-labs';
import { STARTUP_ECOSYSTEMS } from '@/config/startup-ecosystems';
import { TECH_HQS, ACCELERATORS } from '@/config/tech-geo';
import { STOCK_EXCHANGES, FINANCIAL_CENTERS, CENTRAL_BANKS, COMMODITY_HUBS } from '@/config/finance-geo';
import { trackSearchResultSelected, trackCountrySelected } from '@/services/analytics';
import { saveAction } from '@/services/action-store';
import { commitAutomationEvent, evaluateBriefAutomationRules } from '@/services/automation-engine';
import { saveAskRun } from '@/services/ask-store';
import { listAutomationRules } from '@/services/automation-store';
import { buildWorkspaceAskRun } from '@/services/companion-ask';
import { buildWorkspaceBriefInputSignature, buildWorkspaceBriefRun, selectWorkspaceBriefItems } from '@/services/companion-briefing';
import { t } from '@/services/i18n';
import { listNotes, saveNote } from '@/services/note-store';
import { listThreads } from '@/services/thread-store';
import { saveToStorage, setTheme } from '@/utils';
import { CountryIntelManager } from '@/app/country-intel';

export interface SearchManagerCallbacks {
  openCountryBriefByCode: (code: string, country: string) => void;
  activateWorkspace: (workspaceId: string) => void;
}

export class SearchManager implements AppModule {
  private ctx: AppContext;
  private callbacks: SearchManagerCallbacks;
  private boundKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private highlightTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

  constructor(ctx: AppContext, callbacks: SearchManagerCallbacks) {
    this.ctx = ctx;
    this.callbacks = callbacks;
  }

  init(): void {
    this.setupSearchModal();
    this.updateSearchIndex();
  }

  destroy(): void {
    if (this.boundKeydownHandler) {
      document.removeEventListener('keydown', this.boundKeydownHandler);
      this.boundKeydownHandler = null;
    }
  }

  private setupSearchModal(): void {
    const searchOptions = SITE_VARIANT === 'tech'
      ? { placeholder: t('modals.search.placeholderTech') }
      : SITE_VARIANT === 'happy'
        ? { placeholder: 'Search or type a command...' }
        : SITE_VARIANT === 'finance'
          ? { placeholder: t('modals.search.placeholderFinance') }
          : { placeholder: t('modals.search.placeholder') };
    this.ctx.searchModal = new SearchModal(this.ctx.container, searchOptions);

    if (SITE_VARIANT === 'happy') {
      // Happy variant: no geopolitical/military/infrastructure sources
    } else if (SITE_VARIANT === 'tech') {
      this.ctx.searchModal.registerSource('techcompany', TECH_COMPANIES.map(c => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.sector} ${c.city} ${c.keyProducts?.join(' ') || ''}`.trim(),
        data: c,
      })));

      this.ctx.searchModal.registerSource('ailab', AI_RESEARCH_LABS.map(l => ({
        id: l.id,
        title: l.name,
        subtitle: `${l.type} ${l.city} ${l.focusAreas?.join(' ') || ''}`.trim(),
        data: l,
      })));

      this.ctx.searchModal.registerSource('startup', STARTUP_ECOSYSTEMS.map(s => ({
        id: s.id,
        title: s.name,
        subtitle: `${s.ecosystemTier} ${s.topSectors?.join(' ') || ''} ${s.notableStartups?.join(' ') || ''}`.trim(),
        data: s,
      })));

      this.ctx.searchModal.registerSource('datacenter', AI_DATA_CENTERS.map(d => ({
        id: d.id,
        title: d.name,
        subtitle: `${d.owner} ${d.chipType || ''}`.trim(),
        data: d,
      })));

      this.ctx.searchModal.registerSource('cable', UNDERSEA_CABLES.map(c => ({
        id: c.id,
        title: c.name,
        subtitle: c.major ? 'Major internet backbone' : 'Undersea cable',
        data: c,
      })));

      this.ctx.searchModal.registerSource('techhq', TECH_HQS.map(h => ({
        id: h.id,
        title: h.company,
        subtitle: `${h.type === 'faang' ? 'Big Tech' : h.type === 'unicorn' ? 'Unicorn' : 'Public'} • ${h.city}, ${h.country}`,
        data: h,
      })));

      this.ctx.searchModal.registerSource('accelerator', ACCELERATORS.map(a => ({
        id: a.id,
        title: a.name,
        subtitle: `${a.type} • ${a.city}, ${a.country}${a.notable ? ` • ${a.notable.slice(0, 2).join(', ')}` : ''}`,
        data: a,
      })));
    } else {
      this.ctx.searchModal.registerSource('hotspot', INTEL_HOTSPOTS.map(h => ({
        id: h.id,
        title: h.name,
        subtitle: `${h.subtext || ''} ${h.keywords?.join(' ') || ''} ${h.description || ''}`.trim(),
        data: h,
      })));

      this.ctx.searchModal.registerSource('conflict', CONFLICT_ZONES.map(c => ({
        id: c.id,
        title: c.name,
        subtitle: `${c.parties?.join(' ') || ''} ${c.keywords?.join(' ') || ''} ${c.description || ''}`.trim(),
        data: c,
      })));

      this.ctx.searchModal.registerSource('base', MILITARY_BASES.map(b => ({
        id: b.id,
        title: b.name,
        subtitle: `${b.type} ${b.description || ''}`.trim(),
        data: b,
      })));

      this.ctx.searchModal.registerSource('pipeline', PIPELINES.map(p => ({
        id: p.id,
        title: p.name,
        subtitle: `${p.type} ${p.operator || ''} ${p.countries?.join(' ') || ''}`.trim(),
        data: p,
      })));

      this.ctx.searchModal.registerSource('cable', UNDERSEA_CABLES.map(c => ({
        id: c.id,
        title: c.name,
        subtitle: c.major ? 'Major cable' : '',
        data: c,
      })));

      this.ctx.searchModal.registerSource('datacenter', AI_DATA_CENTERS.map(d => ({
        id: d.id,
        title: d.name,
        subtitle: `${d.owner} ${d.chipType || ''}`.trim(),
        data: d,
      })));

      this.ctx.searchModal.registerSource('nuclear', NUCLEAR_FACILITIES.map(n => ({
        id: n.id,
        title: n.name,
        subtitle: `${n.type} ${n.operator || ''}`.trim(),
        data: n,
      })));

      this.ctx.searchModal.registerSource('irradiator', GAMMA_IRRADIATORS.map(g => ({
        id: g.id,
        title: `${g.city}, ${g.country}`,
        subtitle: g.organization || '',
        data: g,
      })));
    }

    if (SITE_VARIANT === 'finance') {
      this.ctx.searchModal.registerSource('exchange', STOCK_EXCHANGES.map(e => ({
        id: e.id,
        title: `${e.shortName} - ${e.name}`,
        subtitle: `${e.tier} • ${e.city}, ${e.country}${e.marketCap ? ` • $${e.marketCap}T` : ''}`,
        data: e,
      })));

      this.ctx.searchModal.registerSource('financialcenter', FINANCIAL_CENTERS.map(f => ({
        id: f.id,
        title: f.name,
        subtitle: `${f.type} financial center${f.gfciRank ? ` • GFCI #${f.gfciRank}` : ''}${f.specialties ? ` • ${f.specialties.slice(0, 3).join(', ')}` : ''}`,
        data: f,
      })));

      this.ctx.searchModal.registerSource('centralbank', CENTRAL_BANKS.map(b => ({
        id: b.id,
        title: `${b.shortName} - ${b.name}`,
        subtitle: `${b.type}${b.currency ? ` • ${b.currency}` : ''} • ${b.city}, ${b.country}`,
        data: b,
      })));

      this.ctx.searchModal.registerSource('commodityhub', COMMODITY_HUBS.map(h => ({
        id: h.id,
        title: h.name,
        subtitle: `${h.type} • ${h.city}, ${h.country}${h.commodities ? ` • ${h.commodities.slice(0, 3).join(', ')}` : ''}`,
        data: h,
      })));
    }

    this.ctx.searchModal.registerSource('country', this.buildCountrySearchItems());

    this.ctx.searchModal.setActivePanels(Object.keys(this.ctx.panels));
    this.ctx.searchModal.setOnSelect((result) => this.handleSearchResult(result));
    this.ctx.searchModal.setOnCommand((cmd, query) => this.handleCommand(cmd, query));

    this.boundKeydownHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (this.ctx.searchModal?.isOpen()) {
          this.ctx.searchModal.close();
        } else {
          this.updateSearchIndex();
          this.ctx.searchModal?.open();
        }
      }
    };
    document.addEventListener('keydown', this.boundKeydownHandler);
  }

  private handleSearchResult(result: SearchResult): void {
    trackSearchResultSelected(result.type);
    switch (result.type) {
      case 'news': {
        const item = result.data as NewsItem;
        this.scrollToPanel('politics');
        this.highlightNewsItem(item.link);
        break;
      }
      case 'hotspot': {
        const hotspot = result.data as typeof INTEL_HOTSPOTS[0];
        this.ctx.map?.setView('global');
        setTimeout(() => { this.ctx.map?.triggerHotspotClick(hotspot.id); }, 300);
        break;
      }
      case 'conflict': {
        const conflict = result.data as typeof CONFLICT_ZONES[0];
        this.ctx.map?.setView('global');
        setTimeout(() => { this.ctx.map?.triggerConflictClick(conflict.id); }, 300);
        break;
      }
      case 'market': {
        this.scrollToPanel('markets');
        break;
      }
      case 'prediction': {
        this.scrollToPanel('polymarket');
        break;
      }
      case 'base': {
        const base = result.data as typeof MILITARY_BASES[0];
        this.ctx.map?.setView('global');
        setTimeout(() => { this.ctx.map?.triggerBaseClick(base.id); }, 300);
        break;
      }
      case 'pipeline': {
        const pipeline = result.data as typeof PIPELINES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('pipelines');
        this.ctx.mapLayers.pipelines = true;
        setTimeout(() => { this.ctx.map?.triggerPipelineClick(pipeline.id); }, 300);
        break;
      }
      case 'cable': {
        const cable = result.data as typeof UNDERSEA_CABLES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('cables');
        this.ctx.mapLayers.cables = true;
        setTimeout(() => { this.ctx.map?.triggerCableClick(cable.id); }, 300);
        break;
      }
      case 'datacenter': {
        const dc = result.data as typeof AI_DATA_CENTERS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('datacenters');
        this.ctx.mapLayers.datacenters = true;
        setTimeout(() => { this.ctx.map?.triggerDatacenterClick(dc.id); }, 300);
        break;
      }
      case 'nuclear': {
        const nuc = result.data as typeof NUCLEAR_FACILITIES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('nuclear');
        this.ctx.mapLayers.nuclear = true;
        setTimeout(() => { this.ctx.map?.triggerNuclearClick(nuc.id); }, 300);
        break;
      }
      case 'irradiator': {
        const irr = result.data as typeof GAMMA_IRRADIATORS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('irradiators');
        this.ctx.mapLayers.irradiators = true;
        setTimeout(() => { this.ctx.map?.triggerIrradiatorClick(irr.id); }, 300);
        break;
      }
      case 'earthquake':
      case 'outage':
        this.ctx.map?.setView('global');
        break;
      case 'techcompany': {
        const company = result.data as typeof TECH_COMPANIES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('techHQs');
        this.ctx.mapLayers.techHQs = true;
        setTimeout(() => { this.ctx.map?.setCenter(company.lat, company.lon, 4); }, 300);
        break;
      }
      case 'ailab': {
        const lab = result.data as typeof AI_RESEARCH_LABS[0];
        this.ctx.map?.setView('global');
        setTimeout(() => { this.ctx.map?.setCenter(lab.lat, lab.lon, 4); }, 300);
        break;
      }
      case 'startup': {
        const ecosystem = result.data as typeof STARTUP_ECOSYSTEMS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('startupHubs');
        this.ctx.mapLayers.startupHubs = true;
        setTimeout(() => { this.ctx.map?.setCenter(ecosystem.lat, ecosystem.lon, 4); }, 300);
        break;
      }
      case 'techevent':
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('techEvents');
        this.ctx.mapLayers.techEvents = true;
        break;
      case 'techhq': {
        const hq = result.data as typeof TECH_HQS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('techHQs');
        this.ctx.mapLayers.techHQs = true;
        setTimeout(() => { this.ctx.map?.setCenter(hq.lat, hq.lon, 4); }, 300);
        break;
      }
      case 'accelerator': {
        const acc = result.data as typeof ACCELERATORS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('accelerators');
        this.ctx.mapLayers.accelerators = true;
        setTimeout(() => { this.ctx.map?.setCenter(acc.lat, acc.lon, 4); }, 300);
        break;
      }
      case 'exchange': {
        const exchange = result.data as typeof STOCK_EXCHANGES[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('stockExchanges');
        this.ctx.mapLayers.stockExchanges = true;
        setTimeout(() => { this.ctx.map?.setCenter(exchange.lat, exchange.lon, 4); }, 300);
        break;
      }
      case 'financialcenter': {
        const fc = result.data as typeof FINANCIAL_CENTERS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('financialCenters');
        this.ctx.mapLayers.financialCenters = true;
        setTimeout(() => { this.ctx.map?.setCenter(fc.lat, fc.lon, 4); }, 300);
        break;
      }
      case 'centralbank': {
        const bank = result.data as typeof CENTRAL_BANKS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('centralBanks');
        this.ctx.mapLayers.centralBanks = true;
        setTimeout(() => { this.ctx.map?.setCenter(bank.lat, bank.lon, 4); }, 300);
        break;
      }
      case 'commodityhub': {
        const hub = result.data as typeof COMMODITY_HUBS[0];
        this.ctx.map?.setView('global');
        this.ctx.map?.enableLayer('commodityHubs');
        this.ctx.mapLayers.commodityHubs = true;
        setTimeout(() => { this.ctx.map?.setCenter(hub.lat, hub.lon, 4); }, 300);
        break;
      }
      case 'country': {
        const { code, name } = result.data as { code: string; name: string };
        trackCountrySelected(code, name, 'search');
        this.callbacks.openCountryBriefByCode(code, name);
        break;
      }
      case 'workspace': {
        const workspace = result.data as Workspace;
        if (workspace.id === this.ctx.sessionStore.getSnapshot().activeWorkspaceId) {
          this.scrollToPanel('monitors');
          break;
        }
        this.callbacks.activateWorkspace(workspace.id);
        break;
      }
      case 'follow': {
        const follow = result.data as Follow;
        if (follow.kind === 'ticker') {
          this.scrollToPanel('markets');
        } else {
          this.scrollToPanel('monitors');
        }
        break;
      }
    }
  }

  private buildCompanionCommandPayload(query: string, patterns: RegExp[]): string {
    const trimmed = query.trim();
    for (const pattern of patterns) {
      const next = trimmed.replace(pattern, '').trim();
      if (next !== trimmed) return next;
    }
    return trimmed;
  }

  private createManualFollowFromQuery(query: string): void {
    const workspace = this.ctx.workspaceStore.getActiveWorkspace(
      this.ctx.sessionStore.getSnapshot().activeWorkspaceId,
    );
    if (!workspace) return;

    const normalized = query.trim();
    if (!normalized) return;

    const timestamp = Date.now();
    const symbolCandidate = normalized.toUpperCase();
    const isTicker = /^[A-Z0-9.\-]{1,8}$/.test(symbolCandidate);
    this.ctx.workspaceStore.updateWorkspace(workspace.id, {
      follows: [
        ...workspace.follows,
        {
          id: `follow-command:${timestamp}`,
          kind: isTicker ? 'ticker' : 'custom_query',
          label: isTicker ? symbolCandidate : normalized,
          query: normalized,
          source: 'manual',
          symbol: isTicker ? symbolCandidate : undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    });
    this.updateSearchIndex();
    this.scrollToPanel('companion-home');
  }

  private captureCommandNote(query: string): void {
    const workspace = this.ctx.workspaceStore.getActiveWorkspace(
      this.ctx.sessionStore.getSnapshot().activeWorkspaceId,
    );
    if (!workspace) return;

    const body = query.trim();
    if (!body) return;

    const title = body.length > 48 ? `${body.slice(0, 45)}...` : body;
    saveNote({
      workspaceId: workspace.id,
      title,
      body,
      tags: ['captured'],
      linkedItemIds: [],
      linkedFollowIds: [],
    });
    this.scrollToPanel('companion-home');
  }

  private askWorkspaceFromQuery(query: string): void {
    const workspace = this.ctx.workspaceStore.getActiveWorkspace(
      this.ctx.sessionStore.getSnapshot().activeWorkspaceId,
    );
    if (!workspace) return;

    const question = query.trim();
    if (!question) return;

    void buildWorkspaceAskRun({
      workspace,
      question,
      items: this.ctx.inboxStore.listItems(workspace.id),
      briefRuns: this.ctx.briefingStore.listRuns(workspace.id),
      notes: listNotes(workspace.id),
      threads: listThreads(workspace.id),
    }).then((run) => {
      saveAskRun({
        workspaceId: run.workspaceId,
        intent: run.intent,
        question: run.question,
        answer: run.answer,
        citedItemIds: run.citedItemIds,
        citedBriefRunIds: run.citedBriefRunIds,
        citedNoteIds: run.citedNoteIds,
        citedFollowIds: run.citedFollowIds,
        citedThreadIds: run.citedThreadIds,
      });
      this.scrollToPanel('companion-ask');
    }).catch((error) => {
      console.warn('[SearchManager] Failed to generate workspace ask run:', error);
    });
  }

  private generateWorkspaceBriefFromCommand(query: string): void {
    const workspace = this.ctx.workspaceStore.getActiveWorkspace(
      this.ctx.sessionStore.getSnapshot().activeWorkspaceId,
    );
    if (!workspace) return;

    const recipeKind = /\b(change|changed|delta|since|new)\b/i.test(query)
      ? 'workspace_delta'
      : 'workspace_morning';
    const recipe = this.ctx.briefingStore.listRecipes(workspace.id)
      .find((entry) => entry.kind === recipeKind);
    if (!recipe) return;

    const session = this.ctx.sessionStore.getSnapshot();
    const scopedItems = this.ctx.inboxStore.listItems(workspace.id);
    const candidateItems = selectWorkspaceBriefItems(recipe, scopedItems, session.previousVisitedAt);
    const inputSignature = buildWorkspaceBriefInputSignature(recipe, candidateItems, session.previousVisitedAt);
    const reusableRun = this.ctx.briefingStore.findReusableRun(recipe.id, inputSignature);
    if (reusableRun) {
      this.scrollToPanel('companion-home');
      return;
    }

    void buildWorkspaceBriefRun({
      workspace,
      recipe,
      items: scopedItems,
      threads: listThreads(workspace.id),
      previousVisitedAt: session.previousVisitedAt,
    }).then((run) => {
      this.ctx.briefingStore.saveRun(run);
      const events = evaluateBriefAutomationRules(
        workspace,
        listAutomationRules(workspace.id),
        run,
      );
      for (const event of events.slice(0, 3)) {
        const committed = commitAutomationEvent(event);
        if (committed.action === 'create_action') {
          saveAction({
            workspaceId: workspace.id,
            title: `Automation: ${committed.subtitle}`,
            status: 'open',
            relatedItemIds: [],
            relatedFollowIds: [],
            dueAt: Date.now() + 24 * 60 * 60 * 1000,
          });
          continue;
        }
        this.ctx.inboxStore.addSystemItem({
          id: committed.dedupeKey,
          workspaceId: workspace.id,
          title: committed.title,
          subtitle: committed.subtitle,
          score: committed.score,
          metadata: committed.metadata,
        });
      }
      this.scrollToPanel('companion-home');
    }).catch((error) => {
      console.warn('[SearchManager] Failed to generate workspace brief:', error);
    });
  }

  private handleCommand(cmd: Command, rawQuery = ''): void {
    const colonIdx = cmd.id.indexOf(':');
    if (colonIdx === -1) return;
    const category = cmd.id.slice(0, colonIdx);
    const action = cmd.id.slice(colonIdx + 1);

    switch (category) {
      case 'nav':
        this.ctx.map?.setView(action as MapView);
        {
          const sel = document.getElementById('regionSelect') as HTMLSelectElement;
          if (sel) sel.value = action;
        }
        break;

      case 'layers': {
        const allowed = getAllowedLayerKeys((SITE_VARIANT || 'full') as MapVariant);
        if (action === 'all') {
          for (const key of Object.keys(this.ctx.mapLayers)) {
            this.ctx.mapLayers[key as keyof MapLayers] = allowed.has(key as keyof MapLayers);
          }
        } else if (action === 'none') {
          for (const key of Object.keys(this.ctx.mapLayers))
            this.ctx.mapLayers[key as keyof MapLayers] = false;
        } else {
          const preset = LAYER_PRESETS[action];
          if (preset) {
            for (const key of Object.keys(this.ctx.mapLayers))
              this.ctx.mapLayers[key as keyof MapLayers] = false;
            for (const layer of preset) {
              if (allowed.has(layer)) this.ctx.mapLayers[layer] = true;
            }
          }
        }
        saveToStorage(STORAGE_KEYS.mapLayers, this.ctx.mapLayers);
        this.ctx.map?.setLayers(this.ctx.mapLayers);
        break;
      }

      case 'layer': {
        const layerKey = (LAYER_KEY_MAP[action] || action) as keyof MapLayers;
        if (!(layerKey in this.ctx.mapLayers)) return;
        const variantAllowed = getAllowedLayerKeys((SITE_VARIANT || 'full') as MapVariant);
        if (!variantAllowed.has(layerKey)) return;
        this.ctx.mapLayers[layerKey] = !this.ctx.mapLayers[layerKey];
        saveToStorage(STORAGE_KEYS.mapLayers, this.ctx.mapLayers);
        if (this.ctx.mapLayers[layerKey]) {
          this.ctx.map?.enableLayer(layerKey);
        } else {
          this.ctx.map?.setLayers(this.ctx.mapLayers);
        }
        break;
      }

      case 'panel':
        this.scrollToPanel(action);
        break;

      case 'view':
        if (action === 'dark' || action === 'light') {
          setTheme(action);
        } else if (action === 'fullscreen') {
          if (document.fullscreenElement) {
            try { void document.exitFullscreen()?.catch(() => {}); } catch {}
          } else {
            const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
            if (el.requestFullscreen) {
              try { void el.requestFullscreen()?.catch(() => {}); } catch {}
            } else if (el.webkitRequestFullscreen) {
              try { el.webkitRequestFullscreen(); } catch {}
            }
          }
        } else if (action === 'settings') {
          this.ctx.unifiedSettings?.open();
        } else if (action === 'refresh') {
          window.location.reload();
        }
        break;

      case 'time':
        this.ctx.map?.setTimeRange(action as import('@/components').TimeRange);
        break;

      case 'country': {
        const name = TIER1_COUNTRIES[action]
          || CURATED_COUNTRIES[action]?.name
          || new Intl.DisplayNames(['en'], { type: 'region' }).of(action)
          || action;
        trackCountrySelected(action, name, 'command');
        this.callbacks.openCountryBriefByCode(action, name);
        break;
      }

      case 'country-map': {
        const bbox = getCountryBbox(action);
        if (bbox) {
          const [minLon, minLat, maxLon, maxLat] = bbox;
          const lat = (minLat + maxLat) / 2;
          const lon = (minLon + maxLon) / 2;
          const span = Math.max(maxLat - minLat, maxLon - minLon);
          const zoom = span > 40 ? 3 : span > 15 ? 4 : span > 5 ? 5 : 6;
          this.ctx.map?.setView('global');
          setTimeout(() => { this.ctx.map?.setCenter(lat, lon, zoom); }, 300);
        }
        break;
      }

      case 'companion': {
        if (action === 'follow') {
          const payload = this.buildCompanionCommandPayload(rawQuery, [
            /^(follow|track|watch|add follow)\s+/i,
          ]);
          this.createManualFollowFromQuery(payload);
        } else if (action === 'ask') {
          const payload = this.buildCompanionCommandPayload(rawQuery, [
            /^(ask|explain|compare|why does this matter|why|question)\s+/i,
          ]);
          this.askWorkspaceFromQuery(payload);
        } else if (action === 'note') {
          const payload = this.buildCompanionCommandPayload(rawQuery, [
            /^(note|capture note|remember|memo)\s+/i,
          ]);
          this.captureCommandNote(payload);
        } else if (action === 'brief') {
          const payload = this.buildCompanionCommandPayload(rawQuery, [
            /^(brief me|summarize|summary|what changed|workspace brief)\s*/i,
          ]);
          this.generateWorkspaceBriefFromCommand(payload || rawQuery);
        }
        break;
      }
    }
  }

  private scrollToPanel(panelId: string): void {
    const panel = document.querySelector(`[data-panel="${panelId}"]`);
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.applyHighlight(panel);
    }
  }

  private highlightNewsItem(itemId: string): void {
    setTimeout(() => {
      const item = document.querySelector(`[data-news-id="${CSS.escape(itemId)}"]`);
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.applyHighlight(item);
      }
    }, 100);
  }

  private applyHighlight(el: Element): void {
    const prev = this.highlightTimers.get(el);
    if (prev) clearTimeout(prev);
    el.classList.remove('search-highlight');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('search-highlight');
    this.highlightTimers.set(el, setTimeout(() => {
      el.classList.remove('search-highlight');
      this.highlightTimers.delete(el);
    }, 3100));
  }

  updateSearchIndex(): void {
    if (!this.ctx.searchModal) return;

    this.ctx.searchModal.setActivePanels(Object.keys(this.ctx.panels));
    this.ctx.searchModal.registerSource('country', this.buildCountrySearchItems());
    this.ctx.searchModal.registerSource('workspace', this.buildWorkspaceSearchItems());
    this.ctx.searchModal.registerSource('follow', this.buildFollowSearchItems());

    const newsItems = this.ctx.allNews.slice(0, 500).map(n => ({
      id: n.link,
      title: n.title,
      subtitle: n.source,
      data: n,
    }));
    console.log(`[Search] Indexing ${newsItems.length} news items (allNews total: ${this.ctx.allNews.length})`);
    this.ctx.searchModal.registerSource('news', newsItems);

    if (this.ctx.latestPredictions.length > 0) {
      this.ctx.searchModal.registerSource('prediction', this.ctx.latestPredictions.map(p => ({
        id: p.title,
        title: p.title,
        subtitle: `${Math.round(p.yesPrice)}% probability`,
        data: p,
      })));
    }

    if (this.ctx.latestMarkets.length > 0) {
      this.ctx.searchModal.registerSource('market', this.ctx.latestMarkets.map(m => ({
        id: m.symbol,
        title: `${m.symbol} - ${m.name}`,
        subtitle: `$${m.price?.toFixed(2) || 'N/A'}`,
        data: m,
      })));
    }
  }

  private buildCountrySearchItems(): { id: string; title: string; subtitle: string; data: { code: string; name: string } }[] {
    const panelScores = (this.ctx.panels.cii as CIIPanel | undefined)?.getScores() ?? [];
    const scores = panelScores.length > 0 ? panelScores : calculateCII();
    const ciiByCode = new Map(scores.map((score) => [score.code, score]));
    return Object.entries(TIER1_COUNTRIES).map(([code, name]) => {
      const score = ciiByCode.get(code);
      return {
        id: code,
        title: `${CountryIntelManager.toFlagEmoji(code)} ${name}`,
        subtitle: score ? `CII: ${score.score}/100 • ${score.level}` : 'Country Brief',
        data: { code, name },
      };
    });
  }

  private buildWorkspaceSearchItems(): { id: string; title: string; subtitle: string; data: Workspace }[] {
    const activeWorkspaceId = this.ctx.sessionStore.getSnapshot().activeWorkspaceId;
    return this.ctx.workspaceStore.listWorkspaces().map((workspace) => {
      const summary = this.ctx.inboxStore.getWorkspaceSummary(workspace.id);
      return {
        id: workspace.id,
        title: workspace.name,
        subtitle: `${workspace.id === activeWorkspaceId ? 'Active' : 'Saved'} • ${workspace.follows.length} follows • ${summary.total} inbox items`,
        data: workspace,
      };
    });
  }

  private buildFollowSearchItems(): { id: string; title: string; subtitle: string; data: Follow }[] {
    const workspace = this.ctx.workspaceStore.getActiveWorkspace(this.ctx.sessionStore.getSnapshot().activeWorkspaceId);
    if (!workspace) return [];
    return workspace.follows.map((follow) => ({
      id: follow.id,
      title: follow.label,
      subtitle: follow.kind === 'ticker'
        ? `Tracked ticker • ${follow.query}`
        : follow.kind === 'keyword_set'
          ? `Tracked keywords • ${follow.query}`
          : `Tracked follow • ${follow.query}`,
      data: follow,
    }));
  }
}
