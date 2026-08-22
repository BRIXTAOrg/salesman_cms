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

export type ReferenceBinding = {
  key: string;
  label: string;
  sourceKey: string;
  mode: "one" | "many";
  searchable: boolean;
  required?: boolean;
  displayTemplate?: string;
  filter?: Array<{
    sourceField: string;
    operator: "eq" | "neq" | "in" | "contains";
    valueFrom:
      | { kind: "literal"; value: unknown }
      | { kind: "field"; fieldKey: string }
      | { kind: "context"; contextKey: string };
  }>;
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
  filter?: ReferenceBinding["filter"];
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

export type EvidenceBundle = {
  key: string;
  label: string;
  capture: {
    photo?: boolean;
    location?: boolean;
    timestamp?: boolean;
    signature?: boolean;
    audio?: boolean;
    barcode?: boolean;
    qr?: boolean;
  };
  required?: Array<keyof EvidenceBundle["capture"]>;
};

export type GenericCondition = {
  key: string;
  left:
    | { kind: "field"; fieldKey: string }
    | { kind: "context"; contextKey: string }
    | { kind: "query"; queryKey: string };
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

export type ResponsibilityAccess = {
  useRoleIds: number[];
  readRoleIds: number[];
  createRoleIds: number[];
  updateRoleIds: number[];
  deleteRoleIds: number[];
  reviewRoleIds: number[];
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

export type ResponsibilityExtensionConfig = {
  schemaVersion: 1;
  references: ReferenceBinding[];
  queries: QueryBinding[];
  memoryPolicies: FieldMemoryPolicy[];
  evidenceBundles: EvidenceBundle[];
  conditions: GenericCondition[];
  computedFields: ComputedField[];
  repeatableSections: RepeatableSection[];
  schedule: ResponsibilitySchedule;
  geofence: ResponsibilityGeofence;
  access: ResponsibilityAccess;
  offline: ResponsibilityOfflinePolicy;
  metadata?: Record<string, unknown>;
};

export type CompiledResponsibilityManifest = {
  manifestVersion: 1;
  responsibilityId: number;
  responsibilityKey: string;
  responsibilityTitle: string;
  version: number;
  generatedAt: string;
  baseDefinition: Record<string, unknown>;
  extension: ResponsibilityExtensionConfig;
};
