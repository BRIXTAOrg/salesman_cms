export type CrudOperation =
  | "create"
  | "read"
  | "update"
  | "delete";

export type PrimitiveInput = {
  key: string;
  dataType: string;
};

export type PrimitiveOutput = {
  key: string;
};

export type PrimitiveCatalog = {
  version: string;
  input: PrimitiveInput[];
  output: PrimitiveOutput[];
  workflow: Array<{
    key: string;
  }>;
  capture?: Array<{
    key: string;
    dataType: string;
  }>;
};

export type ResponsibilityField = {
  key: string;
  label: string;
  inputType: string;
  dataType: string;
  required: boolean;
  config: Record<string, unknown>;
};

export type ResponsibilityActionVisibilityMode =
  | "always"
  | "no_record"
  | "latest_status_is"
  | "latest_status_is_not";

export type ResponsibilityActionStyle =
  | "primary"
  | "secondary"
  | "danger";

export type ResponsibilityAppAction = {
  key: string;
  label: string;
  operation: "create" | "update";
  status: string;
  style: ResponsibilityActionStyle;
  fieldKeys: string[];
  requiredFieldKeys: string[];
  visibility: {
    mode: ResponsibilityActionVisibilityMode;
    status?: string;
  };
  target?: {
    strategy: "latest_record" | "latest_status";
    status?: string;
  };
  capture?: {
    location?: {
      fieldKey: string;
      required?: boolean;
    };
  };
  successMessage?: string;
};

export type ResponsibilityAppDefinition = {
  renderer: "action_form_v1" | string;
  actions: ResponsibilityAppAction[];
  config: Record<string, unknown>;
};

export type ResponsibilitySurfaceRenderer =
  | "detail"
  | "card"
  | "list"
  | "table"
  | "timeline"
  | "calendar"
  | "gallery"
  | "map"
  | "route"
  | "metric"
  | "chart"
  | "document"
  | "receipt"
  | "dashboard"
  | "notification";

export type ResponsibilitySurfaceDefinition = {
  id: string;
  label: string;
  renderer: ResponsibilitySurfaceRenderer;
  surface: "app" | "dashboard";
  actorIds: string[];
  stateIds: string[];
  visibleKeys: string[];
  actionIds: string[];
  config: Record<string, unknown>;
};

export type ResponsibilitySurfaceManifest = {
  version: 1;
  app: ResponsibilitySurfaceDefinition[];
  dashboard: ResponsibilitySurfaceDefinition[];
};

export type ResponsibilityDefinition = {
  schemaVersion: number;
  input: {
    renderer: string;
    strict: boolean;
    fields: ResponsibilityField[];
  };
  app?: ResponsibilityAppDefinition;
  output: {
    renderer: string;
    config: Record<string, unknown>;
  };
  crud: Record<CrudOperation, boolean>;
  surfaces?: ResponsibilitySurfaceManifest;
  raw?: Record<string, unknown>;
};

export type Responsibility = {
  id: number;
  key: string;
  title: string;
  type?: string;
  description?: string | null;
  icon?: string | null;
  config?: Record<string, unknown> | null;
  definition: ResponsibilityDefinition;
  isActive?: boolean;
  directAssignments?: number;
  assignmentRules?: number;
  source?: {
    kind?: string;
    ruleId?: number;
  };
};

// Compatibility aliases for a few untouched presentation components while the
// physical database table is still named mobile_capabilities.
export type Capability = Responsibility;

export type ResponsibilityRule = {
  id: number;
  capabilityId: number;
  subjectType: string;
  subjectValue?: string | null;
  effect: string;
  priority: number;
  enabled: boolean;
  config?: Record<string, unknown> | null;
};

export type CapabilityRule = ResponsibilityRule;

export type Role = {
  id: number;
  orgRole?: string | null;
  jobRole?: string | null;
  grantedPerms?: string[];
  label: string;
};

export type ReportingPolicyMode =
  | "unset"
  | "specific_user"
  | "role"
  | "top_level";

export type ReportingScope =
  | "same_department"
  | "same_area"
  | "same_zone"
  | "same_department_area"
  | "same_department_zone"
  | "organization";

export type ReportingPolicy = {
  version: 1;
  mode: ReportingPolicyMode;
  userId?: number;
  roleId?: number;
  scope?: ReportingScope;
};

export type ReportingPerson = {
  id: number;
  employeeCode?: string | null;
  name?: string | null;
  department?: string | null;
  designation?: string | null;
  area?: string | null;
  zone?: string | null;
  status?: string | null;
};

export type ReportingSnapshot = {
  success?: boolean;

  policy: ReportingPolicy;

  resolution: {
    status:
      | "resolved"
      | "top_level"
      | "unset"
      | "no_match"
      | "ambiguous"
      | "invalid";

    managerId?: number | null;
    candidateIds?: number[];
    reason?: string;
  };

  manager?: ReportingPerson | null;
  candidates?: ReportingPerson[];
  path?: ReportingPerson[];
  pathStatus?: string;
};

export type DepartmentAuthority =
  | {
      kind: "none";
    }
  | {
      kind: "employee";
      userId: number;
    }
  | {
      kind: "role";
      roleId: number;
    };

export type Department = {
  id: string;
  key: string;
  name: string;
  defaultAuthority: DepartmentAuthority;
  memberCount?: number;
  resolvedUserIds?: number[];
  createdAt?: string;
  updatedAt?: string;
};

export type Employee = {
  id: number;
  employeeCode?: string | null;
  name?: string | null;
  username?: string | null;
  department?: string | null;
  designation?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  role?: string | null;
  area?: string | null;
  zone?: string | null;
  status?: string | null;
  reportsToId?: number | null;

  reportingPolicy?: ReportingPolicy;
  reportingMode?: ReportingPolicyMode;
  reportingStatus?:
    | "resolved"
    | "top_level"
    | "unset"
    | "no_match"
    | "ambiguous"
    | "invalid";

  reportingManagerName?: string | null;
  reportingCandidateCount?: number;
  directReportCount?: number;

  mobileAccess?: boolean;
  lastSeenAt?: string | null;
  lastLoginAt?: string | null;
  directResponsibilityCount?: number;
};

export type EmployeeDetail = {
  success?: boolean;
  employee: Employee;
  responsibilities: Responsibility[];
  directResponsibilityIds: number[];
  directRoleIds: number[];
  reporting?: ReportingSnapshot;

  runtime?: {
    lastLoginAt?: string | null;
    lastBootstrapAt?: string | null;
    lastSeenAt?: string | null;
    lastSyncAt?: string | null;
    currentDeviceId?: string | null;
  } | null;

  capabilities?: Responsibility[];
  directCapabilityIds?: number[];
};

export type GenericRecord = {
  id: string;
  responsibilityId: number;
  responsibilityKey: string;
  responsibilityTitle: string;
  userId: number;
  employeeName?: string | null;
  employeeCode?: string | null;
  status: string;
  payload: Record<string, unknown>;
  serverVersion?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type Approval = {
  id: string;
  sourceType: string;
  sourceId: string;
  areaKey: string;
  title: string;
  requesterUserId?: number | null;
  assignedAdminUserId?: number | null;
  status: string;
  payload?: Record<string, unknown>;
  requestedAt?: string | null;
  decidedAt?: string | null;
  decidedByUserId?: number | null;
  decisionNote?: string | null;
};

export type WorkflowStep = {
  id: number;
  workflowVersionId: number;
  stepKey: string;
  title: string;
  stepType: "action" | "approval" | string;
  actionDefinitionId?: number | null;
  actionKey?: string | null;
  handlerKey?: string | null;
  approvalPolicyId?: number | null;
  sortOrder: number;
  config?: Record<string, unknown> | null;
  dependencies?: Array<{
    stepId: number;
    dependsOnStepId: number;
    requiredStatus: string;
  }>;
};

export type WorkflowVersion = {
  id: number;
  workflowId: number;
  version: number;
  status: string;
  createdByUserId?: number | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  steps: WorkflowStep[];
};

export type WorkflowDefinition = {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdByUserId?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  versions: WorkflowVersion[];
};

export type WorkflowRuntime = {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  version: {
    id: number;
    number: number;
  } | null;
  instances: Array<{
    workflowVersionId: number;
    status: string;
    count: number;
  }>;
  steps: Array<{
    id: number;
    workflowVersionId: number;
    stepKey: string;
    title: string;
    stepType: string;
    actionKey?: string | null;
    sortOrder: number;
    states: Array<{
      workflowVersionId: number;
      workflowStepId: number;
      status: string;
      count: number;
    }>;
  }>;
};

export type PlatformRuntime = {
  success: boolean;
  responsibilities: Array<{
    responsibilityId: number;
    responsibilityKey: string;
    title: string;
    count: number;
  }>;
  workflows: WorkflowRuntime[];
};
