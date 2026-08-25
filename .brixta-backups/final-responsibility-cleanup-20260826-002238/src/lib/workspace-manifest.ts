import "server-only";

import type {
  PlatformRuntime,
  Responsibility,
  WorkflowRuntime,
} from "@/lib/appliance-types";
import type {
  WorkspaceFlow,
  WorkspaceManifest,
  WorkspaceNavGroup,
  WorkspaceNavItem,
} from "@/lib/workspace-types";

export type WorkspaceIdentity = {
  userId: number;
  companyName: string;
  username: string;
  email?: string;
  orgRole?: string;
  jobRoles?: string[];
  permissions?: string[];
};

type BuildWorkspaceInput = {
  identity: WorkspaceIdentity;
  responsibilities: Responsibility[];
  runtime: PlatformRuntime;
  pendingApprovals?: number;
};

function keyForGroup(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function addNav(
  map: Map<string, {
    label: string;
    items: Map<string, WorkspaceNavItem>;
  }>,
  label: string,
  item: WorkspaceNavItem,
) {
  const key = keyForGroup(label);
  const group = map.get(key) ?? {
    label,
    items: new Map<string, WorkspaceNavItem>(),
  };

  if (!group.items.has(item.key)) {
    group.items.set(item.key, item);
  }

  map.set(key, group);
}

function navGroups(
  map: Map<string, {
    label: string;
    items: Map<string, WorkspaceNavItem>;
  }>,
): WorkspaceNavGroup[] {
  const preferred = [
    "Management",
    "Field App Control",
  ];

  return [...map.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      items: [...group.items.values()],
    }))
    .sort((a, b) => {
      const ai = preferred.indexOf(a.label);
      const bi = preferred.indexOf(b.label);

      if (ai === -1 && bi === -1) {
        return a.label.localeCompare(b.label);
      }
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

function countState(
  rows: Array<{
    status: string;
    count: number;
  }>,
  status: string,
) {
  return rows
    .filter((row) => row.status === status)
    .reduce((sum, row) => sum + Number(row.count ?? 0), 0);
}

function emptyStepRuntime() {
  return {
    blocked: 0,
    ready: 0,
    inProgress: 0,
    pendingApproval: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
  };
}

function mapWorkflow(
  workflow: WorkflowRuntime,
): WorkspaceFlow | null {
  if (!workflow.version) {
    return null;
  }

  return {
    id: workflow.id,
    key: workflow.key,
    name: workflow.name,
    description: workflow.description,
    versionId: workflow.version.id,
    version: workflow.version.number,
    status: "published",
    runtime: {
      active: countState(workflow.instances, "active"),
      completed: countState(workflow.instances, "completed"),
      rejected: countState(workflow.instances, "rejected"),
      cancelled: countState(workflow.instances, "cancelled"),
    },
    steps: workflow.steps.map((step) => {
      const runtime = emptyStepRuntime();

      runtime.blocked = countState(step.states, "blocked");
      runtime.ready = countState(step.states, "ready");
      runtime.inProgress = countState(step.states, "in_progress");
      runtime.pendingApproval = countState(step.states, "pending_approval");
      runtime.approved = countState(step.states, "approved");
      runtime.rejected = countState(step.states, "rejected");
      runtime.completed = countState(step.states, "completed");

      return {
        id: step.id,
        key: step.stepKey,
        title: step.title,
        type: step.stepType,
        actionKey: step.actionKey,
        sortOrder: step.sortOrder,
        prerequisite: null,
        runtime,
      };
    }),
  };
}

/**
 * Convert the backend's canonical Platform Core runtime into the single UI
 * projection consumed by Sidebar + Control Center.
 *
 * There are deliberately no Journey Plan / Dealer / TA-DA / Attendance
 * branches here. An active Responsibility always resolves to the same generic
 * work route: /dashboard/work/<responsibility-key>.
 */
export function buildWorkspaceManifest({
  identity,
  responsibilities,
  runtime,
  pendingApprovals = 0,
}: BuildWorkspaceInput): WorkspaceManifest {
  const permissions = identity.permissions ?? [];
  const canManage =
    permissions.includes("ALL_ACCESS") ||
    permissions.includes("WRITE") ||
    permissions.includes("UPDATE");

  const activeResponsibilities = responsibilities.filter(
    (item) => item.isActive !== false,
  );

  const workflows = runtime.workflows
    .map(mapWorkflow)
    .filter((item): item is WorkspaceFlow => Boolean(item));

  const nav = new Map<string, {
    label: string;
    items: Map<string, WorkspaceNavItem>;
  }>();

  // ---- Management -----------------------------------------------------
  addNav(nav, "Management", {
    key: "control_center",
    label: "Control Center",
    href: "/dashboard",
    icon: "gauge",
  });

  if (canManage) {
    addNav(nav, "Management", {
      key: "employees",
      label: "Employees",
      href: "/dashboard/workforce/employees",
      icon: "users",
    });

    addNav(nav, "Management", {
      key: "organization",
      label: "Organization",
      href: "/dashboard/workforce/organization",
      icon: "network",
    });

    addNav(nav, "Management", {
      key: "dashboard_access",
      label: "Dashboard Access",
      href: "/dashboard/usersAndTeam",
      icon: "user-cog",
    });
  }

  // ---- Field App Control -------------------------------------------
  // Two sub-sections within the same group: "App Setup" (the builder
  // surfaces an admin uses to define how the field app behaves) and
  // "Dynamic Fields" (the actual Responsibilities/fields created via the
  // builder, i.e. what shows up as work in the app).
  if (canManage) {
    addNav(nav, "Field App Control", {
      key: "responsibilities",
      label: "Responsibilities",
      href: "/dashboard/workspace/responsibilities",
      icon: "blocks",
      section: "App Setup",
    });

    addNav(nav, "Field App Control", {
      key: "workflows",
      label: "Workflows",
      href: "/dashboard/workspace/workflows",
      icon: "git-branch",
      section: "App Setup",
    });

    addNav(nav, "Field App Control", {
      key: "assignments",
      label: "Assignments",
      href: "/dashboard/workspace/assignments",
      icon: "clipboard-list",
      section: "App Setup",
    });
  }

  const workflowHasApproval = workflows.some((workflow) =>
    workflow.steps.some((step) => step.type === "approval"),
  );

  if (workflowHasApproval) {
    addNav(nav, "Field App Control", {
      key: "approvals",
      label: "Approvals",
      href: "/dashboard/workspace/approvals",
      icon: "badge-check",
      section: "App Setup",
    });
  }

  for (const responsibility of activeResponsibilities) {
    addNav(nav, "Field App Control", {
      key: `responsibility:${responsibility.key}`,
      label: responsibility.title,
      href: `/dashboard/work/${encodeURIComponent(responsibility.key)}`,
      icon: responsibility.icon || "blocks",
      description: responsibility.description,
      section: "Dynamic Fields",
    });
  }

  const navigation = navGroups(nav);

  const recordCountByKey = new Map(
    runtime.responsibilities.map((item) => [
      item.responsibilityKey,
      Number(item.count ?? 0),
    ]),
  );

  const stats: WorkspaceManifest["controlCenter"]["stats"] = [];

  for (const workflow of workflows) {
    if (workflow.runtime.active > 0) {
      stats.push({
        key: `${workflow.key}:active`,
        label: `${workflow.name} active`,
        value: workflow.runtime.active,
        hint: `${workflow.steps.length} step${workflow.steps.length === 1 ? "" : "s"}`,
        href: "/dashboard/workspace/workflows",
      });
    }

    const waiting = workflow.steps.reduce(
      (sum, step) => sum + step.runtime.pendingApproval,
      0,
    );

    if (waiting > 0) {
      stats.push({
        key: `${workflow.key}:approval`,
        label: `${workflow.name} awaiting approval`,
        value: waiting,
        href: "/dashboard/workspace/approvals",
      });
    }

    if (workflow.runtime.completed > 0) {
      stats.push({
        key: `${workflow.key}:completed`,
        label: `${workflow.name} completed`,
        value: workflow.runtime.completed,
        href: "/dashboard/workspace/workflows",
      });
    }
  }

  // Record counts are useful only when something actually exists; zero-value
  // cards are omitted so the Control Center does not become an empty catalog.
  for (const responsibility of activeResponsibilities) {
    const count = recordCountByKey.get(responsibility.key) ?? 0;
    if (count <= 0) continue;

    stats.push({
      key: `records:${responsibility.key}`,
      label: responsibility.title,
      value: count,
      hint: "records",
      href: `/dashboard/work/${encodeURIComponent(responsibility.key)}`,
    });
  }

  if (stats.length === 0) {
    stats.push({
      key: "active_responsibilities",
      label: "Active responsibilities",
      value: activeResponsibilities.length,
      hint: workflows.length
        ? `${workflows.length} published workflow${workflows.length === 1 ? "" : "s"}`
        : "No published workflow yet",
      href: canManage
        ? "/dashboard/workspace/responsibilities"
        : "/dashboard",
    });
  }

  const attention: WorkspaceManifest["controlCenter"]["attention"] = [];

  if (pendingApprovals > 0) {
    attention.push({
      key: "pending_approvals",
      severity: "warning",
      title: `${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} waiting for you`,
      body: "A workflow is waiting for a decision before downstream work can continue.",
      href: "/dashboard/workspace/approvals",
    });
  }

  for (const workflow of workflows) {
    const blocked = workflow.steps.reduce(
      (sum, step) => sum + step.runtime.blocked,
      0,
    );

    if (blocked > 0) {
      attention.push({
        key: `blocked:${workflow.key}`,
        severity: "warning",
        title: `${blocked} ${workflow.name} step${blocked === 1 ? "" : "s"} blocked`,
        body: "A prerequisite or approval is preventing progress.",
        href: "/dashboard/workspace/workflows",
      });
    }
  }

  const fieldAppControlItems =
    navigation.find(
      (group) => group.key === "field_app_control",
    )?.items ?? [];

  const workItems = fieldAppControlItems.filter(
    (item) => item.section === "Dynamic Fields",
  );

  const workspaceItems = fieldAppControlItems.filter(
    (item) => item.key === "approvals",
  );

  return {
    generatedAt: new Date().toISOString(),
    identity: {
      userId: identity.userId,
      companyName: identity.companyName,
      username: identity.username || identity.email || "User",
      roles: [
        identity.orgRole,
        ...(identity.jobRoles ?? []),
      ].filter((value): value is string => Boolean(value)),
      permissions,
    },
    navigation,
    responsibilities: activeResponsibilities.map((responsibility) => ({
      id: responsibility.id,
      key: responsibility.key,
      title: responsibility.title,
      type: "record" as const,
      route: `/dashboard/work/${encodeURIComponent(responsibility.key)}`,
      dependencies: [],
      definition: responsibility.definition,
    })),
    workflows,
    resources: [],
    controlCenter: {
      title:
        workflows.length === 1
          ? workflows[0].name
          : workflows.length > 1
            ? "Operations"
            : "Control Center",
      subtitle:
        workflows.length > 0
          ? "Live work, bottlenecks and decisions derived from active Responsibilities and published Workflows."
          : activeResponsibilities.length > 0
            ? "Active Responsibilities are ready. Publish a Workflow when work needs sequencing, prerequisites or approvals."
            : "Create a Responsibility to define the first piece of work in this company.",
      stats: stats.slice(0, 8),
      attention,
      quickActions: [...workItems, ...workspaceItems].slice(0, 6),
    },
  };
}