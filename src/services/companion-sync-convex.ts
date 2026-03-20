import { ConvexHttpClient } from 'convex/browser';

import { getCompanionSyncConvexUrl, normalizeCompanionSyncChannel } from './companion-sync';

export interface ConvexCompanionSyncRecord {
  channel: string;
  payload: string;
  fingerprint: string;
  exportedAt: number;
  updatedAt: number;
  updatedByInstallationId: string;
}

export interface ConvexCompanionSyncPushResult {
  status: 'pushed' | 'conflict';
  fingerprint: string;
  exportedAt: number;
  updatedAt: number;
  updatedByInstallationId: string;
}

function getConvexClient(): ConvexHttpClient {
  const url = getCompanionSyncConvexUrl();
  if (!url) {
    throw new Error('Convex sync is not configured. Set VITE_CONVEX_URL to enable the remote provider.');
  }
  return new ConvexHttpClient(url);
}

function getUntypedConvexClient(): {
  mutation: (name: string, args: unknown) => Promise<unknown>;
  query: (name: string, args: unknown) => Promise<unknown>;
} {
  return getConvexClient() as unknown as {
    mutation: (name: string, args: unknown) => Promise<unknown>;
    query: (name: string, args: unknown) => Promise<unknown>;
  };
}

export async function pushConvexCompanionSyncPayload(args: {
  channel: string;
  payload: string;
  fingerprint: string;
  exportedAt: number;
  installationId: string;
  force?: boolean;
}): Promise<ConvexCompanionSyncPushResult> {
  const channel = normalizeCompanionSyncChannel(args.channel);
  if (!channel) {
    throw new Error('A sync channel is required before pushing to Convex.');
  }
  const client = getUntypedConvexClient();
  return client.mutation('companionSync:pushSnapshot', {
    channel,
    payload: args.payload,
    fingerprint: args.fingerprint,
    exportedAt: args.exportedAt,
    installationId: args.installationId,
    force: args.force ?? false,
  }) as Promise<ConvexCompanionSyncPushResult>;
}

export async function pullConvexCompanionSyncPayload(channelInput: string): Promise<ConvexCompanionSyncRecord | null> {
  const channel = normalizeCompanionSyncChannel(channelInput);
  if (!channel) {
    throw new Error('A sync channel is required before pulling from Convex.');
  }
  const client = getUntypedConvexClient();
  return client.query('companionSync:getSnapshot', {
    channel,
  }) as Promise<ConvexCompanionSyncRecord | null>;
}
