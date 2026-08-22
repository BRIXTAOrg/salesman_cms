import "server-only";

import { createHash } from "node:crypto";

import type {
  CompiledResponsibilityManifest,
  ResponsibilityExtensionConfig,
} from "@/lib/platform-vnext-types";

export function blankResponsibilityExtension(): ResponsibilityExtensionConfig {
  return {
    schemaVersion: 1,
    references: [],
    queries: [],
    memoryPolicies: [],
    evidenceBundles: [],
    conditions: [],
    computedFields: [],
    repeatableSections: [],
    schedule: {
      enabled: false,
    },
    geofence: {
      enabled: false,
      radiusMeters: 200,
      behavior: "warn",
    },
    access: {
      useRoleIds: [],
      readRoleIds: [],
      createRoleIds: [],
      updateRoleIds: [],
      deleteRoleIds: [],
      reviewRoleIds: [],
      recordVisibility: "creator_and_manager",
    },
    offline: {
      enabled: true,
      prefetchReferences: true,
      maxReferenceRows: 500,
      optimisticMutations: true,
    },
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function numberArray(value: unknown) {
  return asArray<unknown>(value)
    .map(Number)
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function normalizeResponsibilityExtension(
  raw: unknown,
): ResponsibilityExtensionConfig {
  const base = blankResponsibilityExtension();
  const value = asObject(raw);
  const access = asObject(value.access);
  const schedule = asObject(value.schedule);
  const geofence = asObject(value.geofence);
  const offline = asObject(value.offline);

  return {
    schemaVersion: 1,
    references: asArray(value.references),
    queries: asArray(value.queries),
    memoryPolicies: asArray(value.memoryPolicies),
    evidenceBundles: asArray(value.evidenceBundles),
    conditions: asArray(value.conditions),
    computedFields: asArray(value.computedFields),
    repeatableSections: asArray(value.repeatableSections),
    schedule: {
      ...base.schedule,
      ...schedule,
      enabled: schedule.enabled === true,
    },
    geofence: {
      ...base.geofence,
      ...geofence,
      enabled: geofence.enabled === true,
      radiusMeters: Number(geofence.radiusMeters ?? base.geofence.radiusMeters),
    },
    access: {
      ...base.access,
      ...access,
      useRoleIds: numberArray(access.useRoleIds),
      readRoleIds: numberArray(access.readRoleIds),
      createRoleIds: numberArray(access.createRoleIds),
      updateRoleIds: numberArray(access.updateRoleIds),
      deleteRoleIds: numberArray(access.deleteRoleIds),
      reviewRoleIds: numberArray(access.reviewRoleIds),
      recordVisibility:
        typeof access.recordVisibility === "string"
          ? (access.recordVisibility as ResponsibilityExtensionConfig["access"]["recordVisibility"])
          : base.access.recordVisibility,
    },
    offline: {
      ...base.offline,
      ...offline,
      enabled: offline.enabled !== false,
      prefetchReferences: offline.prefetchReferences !== false,
      optimisticMutations: offline.optimisticMutations !== false,
      maxReferenceRows: Number(
        offline.maxReferenceRows ?? base.offline.maxReferenceRows,
      ),
    },
    metadata: asObject(value.metadata),
  };
}

export function compileResponsibilityManifest(args: {
  responsibilityId: number;
  responsibilityKey: string;
  responsibilityTitle: string;
  version: number;
  baseDefinition: Record<string, unknown>;
  extension: unknown;
}): CompiledResponsibilityManifest {
  return {
    manifestVersion: 1,
    responsibilityId: args.responsibilityId,
    responsibilityKey: args.responsibilityKey,
    responsibilityTitle: args.responsibilityTitle,
    version: args.version,
    generatedAt: new Date().toISOString(),
    baseDefinition: args.baseDefinition,
    extension: normalizeResponsibilityExtension(args.extension),
  };
}

export function hashResponsibilityManifest(
  manifest: CompiledResponsibilityManifest,
) {
  return createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
}
