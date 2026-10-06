import "server-only";

/*
 * BRIXTA_FIELD_APP_V1 — CMS-side reading of field-app config and state.
 * Config cleaning comes from the shared contract (./field-app-contract.ts),
 * the same file the phone's API uses, so the CMS and the app always agree
 * on stages, steps, conditions and who is assigned.
 */

import {
  inputSpec,
  readFieldAppConfig,
  type FieldInput,
} from "./field-app-contract";

export type FieldStageView = {
  key: string;
  label: string;
  tone: "neutral" | "info" | "good" | "warning" | "danger";
  closed: boolean;
};

export type FieldInputView = Pick<FieldInput, "key" | "label" | "type" | "unit" | "max">;

export type FieldSectionView = {
  key: string;
  title: string;
  fields: FieldInputView[];
};

export type FieldConfigView = {
  title: string;
  titleField: string | null;
  subtitleFields: string[];
  priorityField: string | null;
  locationField: string | null;
  followUpField: string | null;
  tableFields: Array<{ key: string; label: string }>;
  stages: FieldStageView[];
  sections: FieldSectionView[];
};

export type FieldAssignee = {
  userId: number;
  name: string;
  at: string;
  byName: string | null;
};

/** Columns shown in the CMS table when a list doesn't name its own. */
const PREFERRED_TABLE_FIELDS = [
  "key_person_name",
  "construction_stage",
  "customer_interest",
  "follow_up_date",
];

function str(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function readFieldConfig(entityConfig: unknown, entityTitle: string): FieldConfigView | null {
  const config = readFieldAppConfig(entityConfig, entityTitle);
  if (!config) return null;

  const sections: FieldSectionView[] = config.sections.map((section) => ({
    key: section.key,
    title: section.title,
    fields: section.fields
      .filter((field) => inputSpec(field.type).collects)
      .map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        unit: field.unit,
        max: field.max,
      })),
  }));

  const allFields = sections.flatMap((section) => section.fields);
  const labelOf = (fieldKey: string) => allFields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
  const tableKeys = config.tableFields.length
    ? config.tableFields
    : PREFERRED_TABLE_FIELDS.filter((fieldKey) => allFields.some((field) => field.key === fieldKey));
  const fallbackKeys = tableKeys.length
    ? tableKeys
    : allFields
        .filter((field) => !["photos", "gps", "signature"].includes(field.type))
        .slice(0, 2)
        .map((field) => field.key);

  return {
    title: config.title,
    titleField: config.titleField,
    subtitleFields: config.subtitleFields,
    priorityField: config.priorityField,
    locationField: config.locationField,
    followUpField: config.followUpField,
    tableFields: fallbackKeys.slice(0, 4).map((fieldKey) => ({ key: fieldKey, label: labelOf(fieldKey) })),
    stages: config.stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      tone: stage.tone,
      closed: stage.closed,
    })),
    sections,
  };
}

export function fieldStateOf(data: Record<string, unknown>) {
  const raw = data.__field && typeof data.__field === "object" ? (data.__field as Record<string, unknown>) : {};
  const assigneeRaw = raw.assignee && typeof raw.assignee === "object" ? (raw.assignee as Record<string, unknown>) : null;
  const assignee: FieldAssignee | null =
    assigneeRaw && Number.isInteger(assigneeRaw.userId)
      ? {
          userId: Number(assigneeRaw.userId),
          name: str(assigneeRaw.name) || `Employee ${assigneeRaw.userId}`,
          at: str(assigneeRaw.at, 40),
          byName: str(assigneeRaw.byName) || null,
        }
      : null;
  const sections =
    raw.sections && typeof raw.sections === "object" && !Array.isArray(raw.sections)
      ? (raw.sections as Record<string, { completedAt?: string; byName?: string | null }>)
      : {};
  return {
    stage: str(raw.stage, 60) || "new",
    lastVisitAt: str(raw.lastVisitAt, 40) || null,
    lastVisitBy: str(raw.lastVisitBy) || null,
    followUpAt: str(raw.followUpAt, 40) || null,
    sections,
    assignee,
  };
}

export function stageView(config: FieldConfigView, stageKey: string): FieldStageView {
  return (
    config.stages.find((stage) => stage.key === stageKey) ??
    config.stages[0] ?? { key: "new", label: "Not visited", tone: "neutral", closed: false }
  );
}

export function pointOf(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Record<string, unknown>;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function displayOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayOf).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const point = pointOf(value);
    if (point) return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
    return "";
  }
  return String(value);
}
