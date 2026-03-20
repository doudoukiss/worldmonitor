import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function normalizeChannel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").slice(0, 64);
}

export const getSnapshot = query({
  args: {
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    const channel = normalizeChannel(args.channel);
    if (!channel) return null;
    const existing = await ctx.db
      .query("companionSyncSnapshots")
      .withIndex("by_channel", (q) => q.eq("channel", channel))
      .first();
    if (!existing) return null;
    return {
      channel: existing.channel,
      payload: existing.payload,
      fingerprint: existing.fingerprint,
      exportedAt: existing.exportedAt,
      updatedAt: existing.updatedAt,
      updatedByInstallationId: existing.updatedByInstallationId,
    };
  },
});

export const pushSnapshot = mutation({
  args: {
    channel: v.string(),
    payload: v.string(),
    fingerprint: v.string(),
    exportedAt: v.number(),
    installationId: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const channel = normalizeChannel(args.channel);
    if (!channel) {
      throw new Error("A valid sync channel is required.");
    }

    const existing = await ctx.db
      .query("companionSyncSnapshots")
      .withIndex("by_channel", (q) => q.eq("channel", channel))
      .first();

    const now = Date.now();
    if (
      existing &&
      args.force !== true &&
      existing.fingerprint !== args.fingerprint &&
      existing.exportedAt > args.exportedAt
    ) {
      return {
        status: "conflict" as const,
        fingerprint: existing.fingerprint,
        exportedAt: existing.exportedAt,
        updatedAt: existing.updatedAt,
        updatedByInstallationId: existing.updatedByInstallationId,
      };
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        payload: args.payload,
        fingerprint: args.fingerprint,
        exportedAt: args.exportedAt,
        updatedAt: now,
        updatedByInstallationId: args.installationId,
      });
    } else {
      await ctx.db.insert("companionSyncSnapshots", {
        channel,
        payload: args.payload,
        fingerprint: args.fingerprint,
        exportedAt: args.exportedAt,
        updatedAt: now,
        updatedByInstallationId: args.installationId,
      });
    }

    return {
      status: "pushed" as const,
      fingerprint: args.fingerprint,
      exportedAt: args.exportedAt,
      updatedAt: now,
      updatedByInstallationId: args.installationId,
    };
  },
});
