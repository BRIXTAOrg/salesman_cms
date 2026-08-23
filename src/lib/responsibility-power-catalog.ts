import type {
  PlatformDataSource,
  ResponsibilityBuilderMode,
  ResponsibilityExtensionConfig,
  ResponsibilityOutputRenderer,
  SmartBlockKind,
} from "@/lib/platform-vnext-types";

export const RESPONSIBILITY_MODES: Array<{
  key: ResponsibilityBuilderMode;
  label: string;
  description: string;
  templateKey: string;
}> = [
  { key: "form", label: "Form", description: "Collect inputs and submit a record.", templateKey: "simple_form" },
  { key: "track", label: "Track", description: "Capture a live route, elapsed time and distance.", templateKey: "route_session" },
  { key: "inspect", label: "Inspect", description: "Checklist + evidence + result.", templateKey: "inspection" },
  { key: "approve", label: "Approve", description: "Submit something into a role-based decision chain.", templateKey: "approval" },
  { key: "evidence", label: "Evidence", description: "Photo/signature/location/device proof.", templateKey: "evidence_capture" },
  { key: "journey", label: "Journey", description: "Start/stop session with route and travel evidence.", templateKey: "route_session" },
  { key: "expense", label: "Expense", description: "Amounts + receipts + derived total + approval.", templateKey: "expense_claim" },
  { key: "timer", label: "Timer", description: "Measure duration of a real-world job or activity.", templateKey: "maintenance" },
  { key: "checklist", label: "Checklist", description: "Repeatable checks with pass/fail evidence.", templateKey: "inspection" },
  { key: "survey", label: "Survey", description: "Ask questions while remembering slow-changing answers.", templateKey: "survey" },
];

export const SMART_BLOCK_CATALOG: Array<{
  kind: SmartBlockKind;
  label: string;
  description: string;
  group: "Capture" | "Tracking" | "Context" | "Data" | "Logic";
}> = [
  { kind: "photo", label: "Photo", description: "Camera evidence.", group: "Capture" },
  { kind: "gps", label: "GPS", description: "Current location and accuracy.", group: "Capture" },
  { kind: "signature", label: "Signature", description: "On-device signature proof.", group: "Capture" },
  { kind: "file", label: "File", description: "Attach a document or file.", group: "Capture" },
  { kind: "qr", label: "QR scan", description: "Scan a QR code into the record.", group: "Capture" },
  { kind: "barcode", label: "Barcode", description: "Scan a barcode into the record.", group: "Capture" },
  { kind: "audio", label: "Audio", description: "Capture a voice note or audio evidence.", group: "Capture" },
  { kind: "evidence_bundle", label: "Evidence bundle", description: "Capture multiple proof signals atomically.", group: "Capture" },
  { kind: "timer", label: "Timer", description: "Start/stop elapsed duration.", group: "Tracking" },
  { kind: "session_tracker", label: "Session tracker", description: "Start/stop a field session and freeze evidence.", group: "Tracking" },
  { kind: "route_tracking", label: "Route tracking", description: "Record route points while the session is active.", group: "Tracking" },
  { kind: "distance_travelled", label: "Distance travelled", description: "Derive distance from captured route points.", group: "Tracking" },
  { kind: "current_datetime", label: "Current date/time", description: "System-captured timestamp.", group: "Context" },
  { kind: "current_employee", label: "Current employee", description: "Signed-in employee context.", group: "Context" },
  { kind: "current_device", label: "Current device", description: "Device/install/app context.", group: "Context" },
  { kind: "current_manager", label: "Current manager", description: "Reporting manager from organization hierarchy.", group: "Context" },
  { kind: "entity_reference", label: "Entity reference", description: "Select an existing generic Entity/Data Source record.", group: "Data" },
  { kind: "responsibility_reference", label: "Responsibility reference", description: "Reference a record created by another Responsibility.", group: "Data" },
  { kind: "previous_value", label: "Previous value", description: "Reuse or confirm a remembered value.", group: "Data" },
  { kind: "computed_value", label: "Computed value", description: "Derive a value from fields/context/query results.", group: "Logic" },
  { kind: "repeating_section", label: "Repeating section", description: "Capture multiple items with the same field set.", group: "Logic" },
];

export const BUILT_IN_DATA_SOURCES: PlatformDataSource[] = [
  {
    id: -1,
    key: "context.current_user",
    title: "Current employee",
    sourceType: "context",
    sourceRef: "current_user",
    searchableFields: [],
    allowedFields: ["id", "name", "employeeCode", "department", "designation", "roles"],
    defaultFilters: [],
    offlinePolicy: { alwaysAvailable: true },
    config: {},
    isActive: true,
  },
  {
    id: -2,
    key: "context.current_device",
    title: "Current device",
    sourceType: "context",
    sourceRef: "current_device",
    searchableFields: [],
    allowedFields: ["installationId", "platform", "model", "osVersion", "appVersion", "online"],
    defaultFilters: [],
    offlinePolicy: { alwaysAvailable: true },
    config: {},
    isActive: true,
  },
  {
    id: -3,
    key: "context.current_manager",
    title: "Current manager",
    sourceType: "context",
    sourceRef: "current_manager",
    searchableFields: [],
    allowedFields: ["id", "name", "employeeCode", "department", "designation"],
    defaultFilters: [],
    offlinePolicy: { cacheWithWorkspace: true },
    config: {},
    isActive: true,
  },
  {
    id: -4,
    key: "session.current",
    title: "Current session",
    sourceType: "session",
    sourceRef: "current_session",
    searchableFields: [],
    allowedFields: ["id", "status", "startedAt", "endedAt", "durationSeconds", "startLocation", "endLocation"],
    defaultFilters: [],
    offlinePolicy: { alwaysAvailable: true },
    config: {},
    isActive: true,
  },
  {
    id: -5,
    key: "session.current_route",
    title: "Current route",
    sourceType: "session",
    sourceRef: "current_route",
    searchableFields: [],
    allowedFields: ["points", "distanceMeters", "durationSeconds", "startLocation", "endLocation"],
    defaultFilters: [],
    offlinePolicy: { alwaysAvailable: true },
    config: {},
    isActive: true,
  },
];

export const OUTPUT_RENDERERS: Array<{
  key: ResponsibilityOutputRenderer;
  label: string;
  description: string;
}> = [
  { key: "detail", label: "Detail", description: "One record at a time." },
  { key: "cards", label: "Cards", description: "Compact record cards." },
  { key: "table", label: "Table", description: "Office-friendly rows and columns." },
  { key: "timeline", label: "Timeline", description: "Chronological actions and workflow history." },
  { key: "gallery", label: "Gallery", description: "Evidence-first photo/media view." },
  { key: "map_points", label: "Map points", description: "Records plotted as locations." },
  { key: "map_route", label: "Map route", description: "Session route and distance." },
  { key: "metric", label: "Metric", description: "Single KPI/aggregate." },
  { key: "snapshot", label: "Snapshot", description: "Compact operational summary." },
];

export function createBlankResponsibilityExtension(): ResponsibilityExtensionConfig {
  return {
    schemaVersion: 2,
    builderMode: "form",
    smartBlocks: [],
    references: [],
    queries: [],
    memoryPolicies: [],
    fieldBehaviors: [],
    evidenceBundles: [],
    conditions: [],
    rules: [],
    computedFields: [],
    repeatableSections: [],
    session: {
      enabled: false,
      key: "session",
      label: "Work session",
      startActionLabel: "Start",
      stopActionLabel: "Stop",
      sampleEverySeconds: 20,
      sampleEveryMeters: 25,
      minimumAccuracyMeters: 50,
      allowOffline: true,
      freezeEvidenceOnStop: true,
      captureDevice: true,
    },
    flow: {
      enabled: false,
      startState: "draft",
      completeState: "completed",
      steps: [],
    },
    schedule: { enabled: false },
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
      viewOutputRoleIds: [],
      recordVisibility: "creator_and_manager",
    },
    outputDesign: {
      renderer: "detail",
      visibleFieldKeys: [],
    },
    offline: {
      enabled: true,
      prefetchReferences: true,
      maxReferenceRows: 500,
      optimisticMutations: true,
    },
    runtime: {
      syncMode: "immediate",
      referenceCachePolicy: "assigned",
      minAppManifestVersion: 2,
      pushRefresh: true,
      appResumeRefresh: true,
    },
    preview: {
      device: "phone",
      connectivity: "online",
    },
  };
}

export const SUPPORTED_SMART_BLOCKS = new Set(
  SMART_BLOCK_CATALOG.map((item) => item.kind),
);

export const BUILT_IN_SOURCE_KEYS = new Set(
  BUILT_IN_DATA_SOURCES.map((item) => item.key),
);

export const SUPPORTED_OUTPUT_RENDERERS = new Set(
  OUTPUT_RENDERERS.map((item) => item.key),
);
