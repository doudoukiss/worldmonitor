import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const syncSource = fs.readFileSync(new URL('../src/services/companion-sync.ts', import.meta.url), 'utf8');
const backupSource = fs.readFileSync(new URL('../src/services/companion-backup.ts', import.meta.url), 'utf8');
const syncJobsSource = fs.readFileSync(new URL('../src/services/sync-job-store.ts', import.meta.url), 'utf8');

test('companion sync snapshot tracks installation identity, channel, conflict, and remote state', () => {
  assert.match(syncSource, /installationId:\s*string/);
  assert.match(syncSource, /lastProbedAt:\s*number \| null/);
  assert.match(syncSource, /syncChannel:\s*string/);
  assert.match(syncSource, /remoteFingerprint:\s*string \| null/);
  assert.match(syncSource, /remoteInstallationId:\s*string \| null/);
  assert.match(syncSource, /lastConflictAt:\s*number \| null/);
  assert.match(syncSource, /normalizeCompanionSyncChannel/);
  assert.match(syncSource, /buildCompanionSyncReadiness/);
  assert.match(syncSource, /buildCompanionSyncComparison/);
  assert.match(syncSource, /buildCompanionSyncRecommendation/);
  assert.match(syncSource, /VITE_CONVEX_URL/);
});

test('companion backup contract includes sync metadata and sync jobs', () => {
  assert.match(backupSource, /loadCompanionSyncSnapshot/);
  assert.match(backupSource, /saveCompanionSyncSnapshot/);
  assert.match(backupSource, /loadSyncJobSnapshot/);
  assert.match(backupSource, /saveSyncJobSnapshot/);
  assert.match(backupSource, /sync:\s*Pick/);
  assert.match(backupSource, /syncJobs:\s*ReturnType<typeof loadSyncJobSnapshot>/);
});

test('sync job store records bounded local sync history', () => {
  assert.match(syncJobsSource, /wm-companion-sync-jobs-v1/);
  assert.match(syncJobsSource, /jobs\.map\(cloneJob\)\.slice\(0,\s*100\)/);
  assert.match(syncJobsSource, /export function recordSyncJob/);
  assert.match(syncJobsSource, /export function listSyncJobs/);
});

test('sync UI wiring includes a remote probe path', () => {
  const panelLayoutSource = fs.readFileSync(new URL('../src/app/panel-layout.ts', import.meta.url), 'utf8');
  const panelSource = fs.readFileSync(new URL('../src/components/CompanionHomePanel.ts', import.meta.url), 'utf8');
  assert.match(panelLayoutSource, /onProbeSync:\s*async/);
  assert.match(panelLayoutSource, /onResetSyncDiagnostics/);
  assert.match(panelLayoutSource, /operation:\s*'probe'/);
  assert.match(panelSource, /Check Remote/);
  assert.match(panelSource, /Reset Status/);
  assert.match(panelSource, /onProbeSync/);
});
