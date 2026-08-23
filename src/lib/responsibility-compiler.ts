import "server-only";

import { createHash } from "node:crypto";

import type {
  CompiledResponsibilityManifest,
  ResponsibilityExtensionConfig,
} from "@/lib/platform-vnext-types";
import {
  createBlankResponsibilityExtension,
} from "@/lib/responsibility-power-catalog";

export function blankResponsibilityExtension(): ResponsibilityExtensionConfig {
  return createBlankResponsibilityExtension();
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
  const session = asObject(value.session);
  const flow = asObject(value.flow);
  const outputDesign = asObject(value.outputDesign);
  const runtime = asObject(value.runtime);
  const preview = asObject(value.preview);

  const builderMode =
    typeof value.builderMode === "string"
      ? value.builderMode
      : base.builderMode;

  return {
    schemaVersion: 2,
    builderMode:
      [
        "form",
        "track",
        "inspect",
        "approve",
        "evidence",
        "journey",
        "expense",
        "timer",
        "checklist",
        "survey",
      ].includes(builderMode)
        ? (builderMode as ResponsibilityExtensionConfig["builderMode"])
        : base.builderMode,
    templateKey:
      typeof value.templateKey === "string"
        ? value.templateKey
        : undefined,
    smartBlocks: asArray(value.smartBlocks),
    references: asArray(value.references),
    queries: asArray(value.queries),
    memoryPolicies: asArray(value.memoryPolicies),
    fieldBehaviors: asArray(value.fieldBehaviors),
    evidenceBundles: asArray(value.evidenceBundles),
    conditions: asArray(value.conditions),
    rules: asArray(value.rules),
    computedFields: asArray(value.computedFields),
    repeatableSections: asArray(value.repeatableSections),
    session: {
      ...base.session,
      ...session,
      enabled: session.enabled === true,
      sampleEverySeconds: Number(
        session.sampleEverySeconds ?? base.session.sampleEverySeconds,
      ),
      sampleEveryMeters: Number(
        session.sampleEveryMeters ?? base.session.sampleEveryMeters,
      ),
      minimumAccuracyMeters: Number(
        session.minimumAccuracyMeters ?? base.session.minimumAccuracyMeters,
      ),
      allowOffline: session.allowOffline !== false,
      freezeEvidenceOnStop: session.freezeEvidenceOnStop !== false,
      captureDevice: session.captureDevice !== false,
    },
    flow: {
      ...base.flow,
      ...flow,
      enabled: flow.enabled === true,
      steps: asArray(flow.steps),
    },
    schedule: {
      ...base.schedule,
      ...schedule,
      enabled: schedule.enabled === true,
    },
    geofence: {
      ...base.geofence,
      ...geofence,
      enabled: geofence.enabled === true,
      radiusMeters: Number(
        geofence.radiusMeters ?? base.geofence.radiusMeters,
      ),
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
      viewOutputRoleIds: numberArray(access.viewOutputRoleIds),
      recordVisibility:
        typeof access.recordVisibility === "string"
          ? (access.recordVisibility as ResponsibilityExtensionConfig["access"]["recordVisibility"])
          : base.access.recordVisibility,
    },
    outputDesign: {
      ...base.outputDesign,
      ...outputDesign,
      renderer:
        typeof outputDesign.renderer === "string"
          ? (outputDesign.renderer as ResponsibilityExtensionConfig["outputDesign"]["renderer"])
          : base.outputDesign.renderer,
      visibleFieldKeys: asArray<unknown>(outputDesign.visibleFieldKeys).map(String),
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
    runtime: {
      ...base.runtime,
      ...runtime,
      minAppManifestVersion: Number(
        runtime.minAppManifestVersion ?? base.runtime.minAppManifestVersion,
      ),
      pushRefresh: runtime.pushRefresh !== false,
      appResumeRefresh: runtime.appResumeRefresh !== false,
    },
    preview: {
      ...base.preview,
      ...preview,
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
    manifestVersion: 2,
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
