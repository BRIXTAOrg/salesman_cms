export type PlatformEntityField = {
  key: string;
  label: string;
  dataType: string;
  required?: boolean;
  config?: Record<string, unknown>;
};

export type PlatformEntityType = {
  id: number;
  key: string;
  title: string;
  description?: string | null;
  fieldDefinitions: PlatformEntityField[];
  displayTemplate?: string | null;
  searchableFields: string[];
  config: Record<string, unknown>;
  isActive: boolean;
};

export type PlatformEntityRecord = {
  id: string;
  entityTypeId: number;
  externalKey?: string | null;
  status: string;
  data: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PlatformDataSourceType =
  | "table"
  | "responsibility_records"
  | "entity_store"
  | "context"
  | "session"
  | "external";

export type PlatformDataSource = {
  id: number;
  key: string;
  title: string;
  sourceType: PlatformDataSourceType | string;
  sourceRef: string;
  displayField?: string | null;
  valueField?: string | null;
  searchableFields: string[];
  allowedFields: string[];
  defaultFilters: Array<Record<string, unknown>>;
  offlinePolicy: Record<string, unknown>;
  config: Record<string, unknown>;
  isActive: boolean;
};

export type ResponsibilityBuilderMode =
  | "form"
  | "track"
  | "inspect"
  | "approve"
  | "evidence"
  | "journey"
  | "expense"
  | "timer"
  | "checklist"
  | "survey";

export type SmartBlockKind =
  | "audio"
  | "timer"
  | "route_tracking"
  | "distance_travelled"
  | "session_tracker"
  | "current_datetime"
  | "current_employee"
  | "current_device"
  | "current_manager"
  | "entity_reference"
  | "responsibility_reference"
  | "previous_value"
  | "computed_value"
  | "repeating_section"
  | "evidence_bundle"
  | "signature"
  | "file"
  | "qr"
  | "barcode"
  | "gps"
  | "photo";

export type SmartBlock = {
  key: string;
  label: string;
  kind: SmartBlockKind;
  sourceKey?: string;
  fieldKey?: string;
  required?: boolean;
  config: Record<string, unknown>;
};

export type ReferenceFilterValue =
  | { kind: "literal"; value: unknown }
  | { kind: "field"; fieldKey: string }
  | { kind: "context"; contextKey: string }
  | { kind: "query"; queryKey: string };

export type ReferenceFilter = {
  sourceField: string;
  operator: "eq" | "neq" | "in" | "contains" | "gt" | "gte" | "lt" | "lte";
  valueFrom: ReferenceFilterValue;
};

export type ReferenceBinding = {
  key: string;
  label: string;
  sourceKey: string;
  mode: "one" | "many";
  searchable: boolean;
  required?: boolean;
  displayTemplate?: string;
  filter?: ReferenceFilter[];
  offline?: {
    enabled: boolean;
    maxRows?: number;
  };
};

export type QueryBinding = {
  key: string;
  label: string;
  sourceKey: string;
  mode: "first" | "latest" | "many" | "count" | "sum" | "average";
  limit?: number;
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  filter?: ReferenceFilter[];
  selectFields?: string[];
};

export type FieldMemoryPolicy = {
  fieldKey: string;
  scopeSourceKey?: string;
  scopeReferenceFieldKey?: string;
  mode:
    | "every_time"
    | "remember_forever"
    | "ttl"
    | "until_changed"
    | "every_n_uses";
  ttlSeconds?: number;
  everyNUses?: number;
  confirmationMode?: "silent_prefill" | "confirm_or_change";
};

export type FieldBehaviorPolicy = {
  fieldKey: string;
  presentation: "normal" | "hidden" | "read_only" | "system_captured";
  prefillFrom?:
    | { kind: "previous_value" }
    | { kind: "context"; contextKey: string }
    | { kind: "query"; queryKey: string }
    | { kind: "computed"; computedKey: string };
  requiredWhen?: GenericCondition;
};

export type EvidenceBundle = {
  key: string;
  label: string;
  capture: {
    photo?: boolean;
    location?: boolean;
    timestamp?: boolean;
    device?: boolean;
    signature?: boolean;
    audio?: boolean;
    file?: boolean;
    barcode?: boolean;
    qr?: boolean;
  };
  required?: Array<keyof EvidenceBundle["capture"]>;
};

export type ConditionOperand =
  | { kind: "field"; fieldKey: string }
  | { kind: "context"; contextKey: string }
  | { kind: "query"; queryKey: string }
  | { kind: "computed"; computedKey: string }
  | { kind: "literal"; value: unknown };

export type GenericCondition = {
  key: string;
  left: Exclude<ConditionOperand, { kind: "literal" }>;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "exists"
    | "not_exists"
    | "contains";
  right?: unknown;
  rightOperand?: ConditionOperand;
};

export type ResponsibilityRulePhase =
  | "before_start"
  | "before_submit"
  | "before_action"
  | "after_submit";

export type ResponsibilityRuleEffect =
  | "block"
  | "warn"
  | "require_field"
  | "show_field"
  | "hide_field";

export type ResponsibilityRuleDefinition = {
  key: string;
  label: string;
  phase: ResponsibilityRulePhase;
  actionKey?: string;
  condition: GenericCondition;
  effect: ResponsibilityRuleEffect;
  targetFieldKey?: string;
  message?: string;
};

export type ComputedField = {
  key: string;
  label: string;
  operation:
    | "sum"
    | "average"
    | "count"
    | "multiply"
    | "divide"
    | "subtract"
    | "days_since"
    | "distance_meters"
    | "duration_seconds"
    | "expression";
  inputs: string[];
  expression?: string;
  dataType?: string;
};

export type RepeatableSection = {
  key: string;
  label: string;
  minItems?: number;
  maxItems?: number;
  fieldKeys: string[];
};

export type SessionTrackingConfig = {
  enabled: boolean;
  key: string;
  label: string;
  startActionLabel: string;
  stopActionLabel: string;
  sampleEverySeconds: number;
  sampleEveryMeters: number;
  minimumAccuracyMeters: number;
  allowOffline: boolean;
  freezeEvidenceOnStop: boolean;
  captureDevice: boolean;
  captureBattery?: boolean;
};

export type ResponsibilitySchedule = {
  enabled: boolean;
  activeFrom?: string;
  activeUntil?: string;
  cadence?:
    | { kind: "daily" }
    | { kind: "weekly"; days: number[] }
    | { kind: "monthly"; day: number }
    | { kind: "interval"; seconds: number };
};

export type ResponsibilityGeofence = {
  enabled: boolean;
  referenceFieldKey?: string;
  radiusMeters?: number;
  behavior?: "warn" | "block";
};

export type ResponsibilityFlowActor = {
  kind: "submitter" | "reports_to" | "role" | "specific_user";
  roleId?: number;
  userId?: number;
};

export type ResponsibilityFlowStep = {
  key: string;
  label: string;
  actor: ResponsibilityFlowActor;
  actionLabel: string;
  successState: string;
  rejectState?: string;
  allowOffline?: boolean;
};

export type ResponsibilityFlow = {
  enabled: boolean;
  startState: string;
  completeState: string;
  steps: ResponsibilityFlowStep[];
};

export type ResponsibilityAccess = {
  useRoleIds: number[];
  readRoleIds: number[];
  createRoleIds: number[];
  updateRoleIds: number[];
  deleteRoleIds: number[];
  reviewRoleIds: number[];
  viewOutputRoleIds: number[];
  recordVisibility:
    | "creator"
    | "creator_and_manager"
    | "department"
    | "roles"
    | "organization";
};

export type ResponsibilityOfflinePolicy = {
  enabled: boolean;
  prefetchReferences: boolean;
  maxReferenceRows?: number;
  optimisticMutations: boolean;
};

export type ResponsibilityOutputRenderer =
  | "detail"
  | "cards"
  | "table"
  | "timeline"
  | "gallery"
  | "map_points"
  | "map_route"
  | "metric"
  | "snapshot";

export type ResponsibilityOutputDesign = {
  renderer: ResponsibilityOutputRenderer;
  visibleFieldKeys: string[];
  titleFieldKey?: string;
  subtitleFieldKey?: string;
  groupByFieldKey?: string;
  metricFieldKey?: string;
  mapLocationFieldKey?: string;
  routeFieldKey?: string;
};

export type ResponsibilityRuntimePolicy = {
  syncMode: "immediate" | "background" | "manual_allowed";
  referenceCachePolicy: "none" | "assigned" | "recent" | "first_n" | "all_bounded";
  minAppManifestVersion: number;
  pushRefresh: boolean;
  appResumeRefresh: boolean;
};

export type ResponsibilityPreviewConfig = {
  roleId?: number;
  device: "phone" | "tablet" | "rugged";
  connectivity: "online" | "offline";
};

export type ResponsibilityExtensionConfig = {
  schemaVersion: 2;
  builderMode: ResponsibilityBuilderMode;
  templateKey?: string;
  smartBlocks: SmartBlock[];
  references: ReferenceBinding[];
  queries: QueryBinding[];
  memoryPolicies: FieldMemoryPolicy[];
  fieldBehaviors: FieldBehaviorPolicy[];
  evidenceBundles: EvidenceBundle[];
  conditions: GenericCondition[];
  rules: ResponsibilityRuleDefinition[];
  computedFields: ComputedField[];
  repeatableSections: RepeatableSection[];
  session: SessionTrackingConfig;
  flow: ResponsibilityFlow;
  schedule: ResponsibilitySchedule;
  geofence: ResponsibilityGeofence;
  access: ResponsibilityAccess;
  outputDesign: ResponsibilityOutputDesign;
  offline: ResponsibilityOfflinePolicy;
  runtime: ResponsibilityRuntimePolicy;
  preview: ResponsibilityPreviewConfig;
  metadata?: Record<string, unknown>;
};

export type CompiledResponsibilityManifest = {
  manifestVersion: 2;
  responsibilityId: number;
  responsibilityKey: string;
  responsibilityTitle: string;
  version: number;
  generatedAt: string;
  baseDefinition: Record<string, unknown>;
  extension: ResponsibilityExtensionConfig;
};

export type ResponsibilityValidationIssue = {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
};
