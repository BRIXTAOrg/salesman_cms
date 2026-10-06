import "server-only";

/*
 * BRIXTA_FIELD_APP_PUBLISH_V1
 *
 * Draft → publish → versions for a list's field app.
 *
 *   config.fieldApp         what phones use right now (published)
 *   config.fieldAppDraft    work in progress, never seen by phones
 *   config.fieldAppHistory  earlier published versions (newest first)
 *
 * Only /api/platform/field-apps/[id] writes these keys. The generic entity
 * PATCH keeps whatever is stored for them.
 */

import {
  allInputs,
  inputSpec,
  normalizeFieldApp,
  type FieldAppConfig,
} from "./field-app-contract";

export const FIELD_APP_KEYS = ["fieldApp", "fieldAppDraft", "fieldAppHistory"] as const;

export const HISTORY_LIMIT = 10;

export type FieldAppDraft = {
  config: FieldAppConfig;
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
  basedOnVersion: number;
};

export type FieldAppHistoryEntry = {
  version: number;
  publishedAt: string | null;
  publishedBy: string | null;
  note: string | null;
  config: FieldAppConfig;
};

export type FieldAppStore = {
  published: FieldAppConfig | null;
  draft: FieldAppDraft | null;
  history: FieldAppHistoryEntry[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readFieldAppStore(entityConfig: unknown, entityTitle: string): FieldAppStore {
  const config = asRecord(entityConfig) ?? {};

  const publishedRaw = asRecord(config.fieldApp);
  const published = publishedRaw ? normalizeFieldApp(publishedRaw, entityTitle) : null;
  if (published && publishedRaw && publishedRaw.enabled !== true) published.enabled = false;

  const draftRaw = asRecord(config.fieldAppDraft);
  const draftConfig = draftRaw ? asRecord(draftRaw.config) : null;
  const draft: FieldAppDraft | null =
    draftRaw && draftConfig
      ? {
          config: normalizeFieldApp(draftConfig, entityTitle),
          revision: Number.isInteger(draftRaw.revision) ? Number(draftRaw.revision) : 1,
          updatedAt: typeof draftRaw.updatedAt === "string" ? draftRaw.updatedAt : "",
          updatedBy: typeof draftRaw.updatedBy === "string" ? draftRaw.updatedBy : null,
          basedOnVersion: Number.isInteger(draftRaw.basedOnVersion) ? Number(draftRaw.basedOnVersion) : 0,
        }
      : null;

  const history: FieldAppHistoryEntry[] = [];
  if (Array.isArray(config.fieldAppHistory)) {
    for (const item of config.fieldAppHistory.slice(0, HISTORY_LIMIT)) {
      const entry = asRecord(item);
      const snapshot = entry ? asRecord(entry.config) : null;
      if (!entry || !snapshot) continue;
      history.push({
        version: Number.isInteger(entry.version) ? Number(entry.version) : 0,
        publishedAt: typeof entry.publishedAt === "string" ? entry.publishedAt : null,
        publishedBy: typeof entry.publishedBy === "string" ? entry.publishedBy : null,
        note: typeof entry.note === "string" ? entry.note : null,
        config: normalizeFieldApp(snapshot, entityTitle),
      });
    }
  }

  return { published, draft, history };
}

export function summaryOf(config: FieldAppConfig | null) {
  if (!config) return null;
  const inputs = allInputs(config).filter((field) => inputSpec(field.type).collects);
  return {
    steps: config.sections.length,
    questions: inputs.length,
    conditional: inputs.filter((field) => field.showWhen).length,
  };
}

type FieldDefinition = {
  key: string;
  label: string;
  dataType: string;
  required?: boolean;
  config?: Record<string, unknown>;
};

/**
 * Adds a list column for every new question so answers show up in tables,
 * exports and Connections like any other field. Existing columns are never
 * changed or removed.
 */
export function mergeFieldDefinitions(
  existing: FieldDefinition[],
  config: FieldAppConfig,
): { definitions: FieldDefinition[]; added: string[] } {
  const definitions = [...existing];
  const known = new Set(existing.map((field) => field.key));
  const added: string[] = [];
  for (const section of config.sections) {
    for (const input of section.fields) {
      const dataType = inputSpec(input.type).dataType;
      if (!dataType || known.has(input.key)) continue;
      known.add(input.key);
      added.push(input.key);
      definitions.push({
        key: input.key,
        label: input.label,
        dataType,
        required: false,
        config: { fieldApp: true, fieldAppSection: section.key, fieldAppType: input.type },
      });
    }
  }
  return { definitions, added };
}

/** Columns whose stored type clashes with the question now using the key. */
export function typeClashes(existing: FieldDefinition[], config: FieldAppConfig) {
  const clashes: Array<{ key: string; label: string; column: string; question: string }> = [];
  for (const input of allInputs(config)) {
    const dataType = inputSpec(input.type).dataType;
    const column = existing.find((field) => field.key === input.key);
    if (!dataType || !column) continue;
    const compatible =
      column.dataType === dataType ||
      // text columns can hold anything readable
      (column.dataType === "text" && ["text", "number", "date", "boolean"].includes(dataType));
    if (!compatible) {
      clashes.push({ key: input.key, label: input.label, column: column.dataType, question: dataType });
    }
  }
  return clashes;
}
