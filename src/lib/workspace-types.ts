import type {
  ResponsibilityDefinition,
} from "@/lib/appliance-types";

export type WorkspaceNavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  description?: string | null;
};

export type WorkspaceNavGroup = {
  key: string;
  label: string;
  items: WorkspaceNavItem[];
};

export type WorkspaceMetric = {
  key: string;
  label: string;
  value: number | string;
  hint?: string | null;
  href?: string | null;
};

export type WorkspaceAttention = {
  key: string;
  severity: "info" | "warning" | "danger";
  title: string;
  body?: string | null;
  href?: string | null;
};

export type WorkspaceFlowStep = {
  id: number;
  key: string;
  title: string;
  type: string;
  actionKey?: string | null;
  sortOrder: number;
  prerequisite?: {
    stepId: number;
    requiredStatus: string;
  } | null;
  runtime: {
    blocked: number;
    ready: number;
    inProgress: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
    completed: number;
  };
};

export type WorkspaceFlow = {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  versionId: number;
  version: number;
  status: string;
  runtime: {
    active: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  steps: WorkspaceFlowStep[];
};

export type WorkspaceManifest = {
  generatedAt: string;

  identity: {
    userId: number;
    companyName: string;
    username: string;
    roles: string[];
    permissions: string[];
  };

  navigation: WorkspaceNavGroup[];

  responsibilities: Array<{
    id: number;
    key: string;
    title: string;
    type: "record";
    route: string;
    dependencies: string[];
    definition: ResponsibilityDefinition;
  }>;

  workflows: WorkspaceFlow[];

  // Kept for shell compatibility. Platform Core does not infer bespoke
  // resources such as dealers/distributors; references are Responsibilities.
  resources: string[];

  controlCenter: {
    title: string;
    subtitle: string;
    stats: WorkspaceMetric[];
    attention: WorkspaceAttention[];
    quickActions: WorkspaceNavItem[];
  };
};
