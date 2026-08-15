
export type SetupCheck = {
  key: string;
  status: "good" | "warning" | "info" | string;
  label: string;
  actionKey?: string;
};

export type SetupHealth = {
  ready: boolean;
  checks: SetupCheck[];
};

export type AdminHome = {
  generatedAt: string;
  today: {
    date: string;
    activeEmployees: number;
    present: number;
    onLeave: number;
    notCheckedIn: number;
    pendingApprovals: number;
    pendingTada: number;
    openAttention: number;
  };
  needsAttention: Array<{
    key: string;
    severity: string;
    title: string;
    body?: string | null;
    actionKey?: string;
    entityType?: string | null;
    entityId?: string | null;
  }>;
  frequentActions: Array<{
    key: string;
    label: string;
    href: string;
    icon?: string;
    pinned?: boolean;
    usageCount?: number;
  }>;
  setupHealth: SetupHealth;
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
  mobileAccess?: boolean;
  lastSeenAt?: string | null;
  lastLoginAt?: string | null;
  directResponsibilityCount?: number;
};

export type Capability = {
  id: number;
  key: string;
  title: string;
  type: string;
  description?: string | null;
  icon?: string | null;
  config?: Record<string, unknown> | null;
  isActive?: boolean;
  directAssignments?: number;
  assignmentRules?: number;
  source?: {
    kind?: string;
    ruleId?: number;
  };
};

export type EmployeeDetail = {
  employee: Employee;
  capabilities: Capability[];
  directCapabilityIds: number[];
  devices: Device[];
  recentWork: WorkItem[];
  runtime?: {
    lastLoginAt?: string | null;
    lastBootstrapAt?: string | null;
    lastSeenAt?: string | null;
    lastSyncAt?: string | null;
    currentDeviceId?: string | null;
  } | null;
};

export type CapabilityRule = {
  id: number;
  capabilityId: number;
  subjectType: string;
  subjectValue?: string | null;
  effect: string;
  priority: number;
  enabled: boolean;
  config?: Record<string, unknown> | null;
};

export type WorkItem = {
  id: string;
  capabilityId?: number | null;
  assigneeUserId: number;
  createdByUserId?: number | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueAt?: string | null;
  payload?: Record<string, unknown>;
  approvalRequired?: boolean;
  approvalAreaKey?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
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

export type Device = {
  id: string;
  userId: number;
  deviceId: string;
  platform: string;
  appVersion?: string | null;
  pushToken?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type WorkspaceSetting = {
  key: string;
  value: unknown;
  updatedAt?: string | null;
};
