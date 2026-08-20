import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";

import type {
  AppDatabase,
  Session,
} from "@/lib/auth";

import {
  mobileCapabilities,
  roles,
  userRoles,
  users,
} from "../../drizzle/schema";

import {
  approvalRequests,
} from "../../drizzle/applianceSchema";

import {
  actionDefinitions,
  workflowDefinitions,
  workflowInstances,
  workflowStepDependencies,
  workflowStepInstances,
  workflowSteps,
  workflowVersions,
} from "../../drizzle/workflowSchema";

import type {
  WorkspaceAttention,
  WorkspaceFlow,
  WorkspaceManifest,
  WorkspaceMetric,
  WorkspaceNavGroup,
  WorkspaceNavItem,
} from "@/lib/workspace-types";

type CapabilityRow = typeof mobileCapabilities.$inferSelect;

type SurfaceDefinition = {
  group: string;
  label: string;
  href: string;
  icon: string;
  dependencies?: string[];
};

const CAPABILITY_SURFACES: Record<string, SurfaceDefinition> = {
  attendance: {
    group: "Work",
    label: "Attendance",
    href: "/dashboard/slmAttendance",
    icon: "calendar-check",
  },
  leave: {
    group: "Work",
    label: "Leave",
    href: "/dashboard/slmLeaves",
    icon: "calendar-off",
  },
  live_location: {
    group: "Work",
    label: "Live Location",
    href: "/dashboard/slmGeotracking",
    icon: "map-pin",
  },
  journey_plan: {
    group: "Field Work",
    label: "Journey Plans",
    href: "/dashboard/permanentJourneyPlan",
    icon: "route",
    dependencies: ["dealers"],
  },
  ta_da: {
    group: "Money",
    label: "TA / DA",
    href: "/dashboard/tadaBill",
    icon: "receipt",
  },
};

const ACTION_SURFACES: Record<string, SurfaceDefinition> = {
  "journey_plan.create": {
    group: "Field Work",
    label: "Journey Plans",
    href: "/dashboard/permanentJourneyPlan",
    icon: "route",
    dependencies: ["dealers"],
  },
  "journey_plan.approve": {
    group: "Workspace",
    label: "Approvals",
    href: "/dashboard/workspace/approvals",
    icon: "badge-check",
  },
  "visit_report.create": {
    group: "Field Work",
    label: "Visit Reports",
    href: "/dashboard/reports",
    icon: "file-chart",
    dependencies: ["dealers"],
  },
};

const RESOURCE_SURFACES: Record<string, SurfaceDefinition> = {
  dealers: {
    group: "Resources",
    label: "Dealers",
    href: "/dashboard/dealerManagement",
    icon: "store",
  },
  distributors: {
    group: "Resources",
    label: "Distributors",
    href: "/dashboard/distributorManagement",
    icon: "warehouse",
  },
  outlets: {
    group: "Resources",
    label: "Outlets",
    href: "/dashboard/outletManagement",
    icon: "store",
  },
  institutions: {
    group: "Resources",
    label: "Institutions",
    href: "/dashboard/institutionManagement",
    icon: "landmark",
  },
  influencers: {
    group: "Resources",
    label: "Influencers",
    href: "/dashboard/influencerManagement",
    icon: "building",
  },
  devices: {
    group: "Resources",
    label: "Devices",
    href: "/dashboard/workforce/devices",
    icon: "smartphone",
  },
};

function objectConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
}

function configDependencies(capability: CapabilityRow) {
  const config = objectConfig(capability.config);
  const dependencies = new Set<string>(
    stringArray(config.dependencies),
  );

  const fields = Array.isArray(config.fields)
    ? config.fields
    : [];

  for (const rawField of fields) {
    const field = objectConfig(rawField);

    if (typeof field.source === "string" && field.source.trim()) {
      dependencies.add(field.source.trim());
    }
  }

  for (const dependency of CAPABILITY_SURFACES[capability.key]?.dependencies ?? []) {
    dependencies.add(dependency);
  }

  return [...dependencies];
}

function configSurface(
  capability: CapabilityRow,
): SurfaceDefinition | null {
  const config = objectConfig(capability.config);
  const admin = objectConfig(config.admin);
  const navigation = objectConfig(admin.navigation);

  if (navigation.enabled === false) {
    return null;
  }

  if (
    typeof navigation.href === "string" &&
    navigation.href.trim()
  ) {
    return {
      group:
        typeof navigation.group === "string" && navigation.group.trim()
          ? navigation.group.trim()
          : "Work",
      label:
        typeof navigation.label === "string" && navigation.label.trim()
          ? navigation.label.trim()
          : capability.title,
      href: navigation.href.trim(),
      icon:
        typeof navigation.icon === "string" && navigation.icon.trim()
          ? navigation.icon.trim()
          : "blocks",
      dependencies: configDependencies(capability),
    };
  }

  return CAPABILITY_SURFACES[capability.key] ?? null;
}

function customCapabilitySurface(
  capability: CapabilityRow,
): SurfaceDefinition {
  return {
    group: "Work",
    label: capability.title,
    href: `/dashboard/work/${encodeURIComponent(capability.key)}`,
    icon: "blocks",
    dependencies: configDependencies(capability),
  };
}

function addNav(
  map: Map<string, Map<string, WorkspaceNavItem>>,
  groupLabel: string,
  item: WorkspaceNavItem,
) {
  const groupKey = groupLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const group = map.get(groupKey) ?? new Map<string, WorkspaceNavItem>();

  if (!group.has(item.key)) {
    group.set(item.key, item);
  }

  map.set(groupKey, group);
}

function navGroups(
  navMap: Map<string, Map<string, WorkspaceNavItem>>,
): WorkspaceNavGroup[] {
  const preferred = [
    "Control",
    "People",
    "Work",
    "Field Work",
    "Money",
    "Resources",
    "Workspace",
    "Administration",
  ];

  const labelFor = new Map<string, string>();

  for (const [key, items] of navMap.entries()) {
    const anyItem = [...items.values()][0];
    const matchingPreferred = preferred.find(
      (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_") === key,
    );

    labelFor.set(key, matchingPreferred ?? anyItem?.key ?? key);
  }

  return [...navMap.entries()]
    .map(([key, items]) => ({
      key,
      label:
        preferred.find(
          (label) =>
            label.toLowerCase().replace(/[^a-z0-9]+/g, "_") === key,
        ) ?? key.replace(/_/g, " "),
      items: [...items.values()],
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

export async function buildWorkspaceManifest(
  db: AppDatabase,
  session: Session,
): Promise<WorkspaceManifest> {
  const [roleRows, capabilityRows, employeeCountRows, pendingApprovalRows] =
    await Promise.all([
      db
        .select({
          orgRole: roles.orgRole,
          jobRole: roles.jobRole,
          grantedPerms: roles.grantedPerms,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, session.userId)),

      db
        .select()
        .from(mobileCapabilities)
        .where(eq(mobileCapabilities.isActive, true))
        .orderBy(asc(mobileCapabilities.title)),

      db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(eq(users.status, "active")),

      db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(approvalRequests)
        .where(eq(approvalRequests.status, "pending")),
    ]);

  const currentPermissions = Array.from(
    new Set(
      roleRows.flatMap((row) =>
        Array.isArray(row.grantedPerms)
          ? row.grantedPerms
          : [],
      ),
    ),
  );

  const currentRoles = Array.from(
    new Set(
      roleRows.flatMap((row) =>
        [row.orgRole, row.jobRole].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  );

  const canManage =
    currentPermissions.includes("ALL_ACCESS") ||
    currentPermissions.includes("WRITE") ||
    currentPermissions.includes("UPDATE");

  const definitionRows = await db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.isActive, true))
    .orderBy(asc(workflowDefinitions.name));

  const definitionIds = definitionRows.map((row) => row.id);

  const publishedVersions = definitionIds.length
    ? await db
        .select()
        .from(workflowVersions)
        .where(
          and(
            inArray(workflowVersions.workflowId, definitionIds),
            eq(workflowVersions.status, "published"),
          ),
        )
        .orderBy(
          asc(workflowVersions.workflowId),
          desc(workflowVersions.version),
        )
    : [];

  const latestVersionByWorkflow = new Map<
    number,
    (typeof publishedVersions)[number]
  >();

  for (const version of publishedVersions) {
    if (!latestVersionByWorkflow.has(version.workflowId)) {
      latestVersionByWorkflow.set(version.workflowId, version);
    }
  }

  const selectedVersions = [...latestVersionByWorkflow.values()];
  const selectedVersionIds = selectedVersions.map((row) => row.id);

  const stepRows = selectedVersionIds.length
    ? await db
        .select({
          id: workflowSteps.id,
          workflowVersionId: workflowSteps.workflowVersionId,
          stepKey: workflowSteps.stepKey,
          title: workflowSteps.title,
          stepType: workflowSteps.stepType,
          sortOrder: workflowSteps.sortOrder,
          actionKey: actionDefinitions.key,
        })
        .from(workflowSteps)
        .leftJoin(
          actionDefinitions,
          eq(workflowSteps.actionDefinitionId, actionDefinitions.id),
        )
        .where(inArray(workflowSteps.workflowVersionId, selectedVersionIds))
        .orderBy(
          asc(workflowSteps.workflowVersionId),
          asc(workflowSteps.sortOrder),
        )
    : [];

  const stepIds = stepRows.map((row) => row.id);

  const [dependencyRows, stepRuntimeRows, instanceRuntimeRows] =
    await Promise.all([
      stepIds.length
        ? db
            .select()
            .from(workflowStepDependencies)
            .where(inArray(workflowStepDependencies.stepId, stepIds))
        : Promise.resolve([]),

      stepIds.length
        ? db
            .select({
              workflowStepId: workflowStepInstances.workflowStepId,
              status: workflowStepInstances.status,
              count: sql<number>`count(*)::int`,
            })
            .from(workflowStepInstances)
            .where(inArray(workflowStepInstances.workflowStepId, stepIds))
            .groupBy(
              workflowStepInstances.workflowStepId,
              workflowStepInstances.status,
            )
        : Promise.resolve([]),

      selectedVersionIds.length
        ? db
            .select({
              workflowVersionId: workflowInstances.workflowVersionId,
              status: workflowInstances.status,
              count: sql<number>`count(*)::int`,
            })
            .from(workflowInstances)
            .where(inArray(workflowInstances.workflowVersionId, selectedVersionIds))
            .groupBy(
              workflowInstances.workflowVersionId,
              workflowInstances.status,
            )
        : Promise.resolve([]),
    ]);

  const dependencyByStep = new Map<
    number,
    { stepId: number; requiredStatus: string }
  >();

  for (const dependency of dependencyRows) {
    if (!dependencyByStep.has(dependency.stepId)) {
      dependencyByStep.set(dependency.stepId, {
        stepId: dependency.dependsOnStepId,
        requiredStatus: dependency.requiredStatus,
      });
    }
  }

  const stepRuntime = new Map<number, ReturnType<typeof emptyStepRuntime>>();

  for (const row of stepRuntimeRows) {
    const runtime = stepRuntime.get(row.workflowStepId) ?? emptyStepRuntime();

    switch (row.status) {
      case "blocked":
        runtime.blocked = Number(row.count);
        break;
      case "ready":
        runtime.ready = Number(row.count);
        break;
      case "in_progress":
        runtime.inProgress = Number(row.count);
        break;
      case "pending_approval":
        runtime.pendingApproval = Number(row.count);
        break;
      case "approved":
        runtime.approved = Number(row.count);
        break;
      case "rejected":
        runtime.rejected = Number(row.count);
        break;
      case "completed":
        runtime.completed = Number(row.count);
        break;
    }

    stepRuntime.set(row.workflowStepId, runtime);
  }

  const instanceRuntime = new Map<
    number,
    {
      active: number;
      completed: number;
      rejected: number;
      cancelled: number;
    }
  >();

  for (const row of instanceRuntimeRows) {
    const runtime = instanceRuntime.get(row.workflowVersionId) ?? {
      active: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0,
    };

    if (row.status === "active") runtime.active = Number(row.count);
    if (row.status === "completed") runtime.completed = Number(row.count);
    if (row.status === "rejected") runtime.rejected = Number(row.count);
    if (row.status === "cancelled") runtime.cancelled = Number(row.count);

    instanceRuntime.set(row.workflowVersionId, runtime);
  }

  const workflows: WorkspaceFlow[] = definitionRows
    .map((definition) => {
      const version = latestVersionByWorkflow.get(definition.id);

      if (!version) return null;

      const steps = stepRows
        .filter((step) => step.workflowVersionId === version.id)
        .map((step) => ({
          id: step.id,
          key: step.stepKey,
          title: step.title,
          type: step.stepType,
          actionKey: step.actionKey,
          sortOrder: step.sortOrder,
          prerequisite: dependencyByStep.get(step.id) ?? null,
          runtime: stepRuntime.get(step.id) ?? emptyStepRuntime(),
        }));

      return {
        id: definition.id,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        versionId: version.id,
        version: version.version,
        status: version.status,
        runtime: instanceRuntime.get(version.id) ?? {
          active: 0,
          completed: 0,
          rejected: 0,
          cancelled: 0,
        },
        steps,
      };
    })
    .filter((item): item is WorkspaceFlow => Boolean(item));

  const resources = new Set<string>();

  const responsibilities = capabilityRows.map((capability) => {
    const dependencies = configDependencies(capability);

    for (const dependency of dependencies) {
      resources.add(dependency);
    }

    const config = objectConfig(capability.config);
    const origin =
      config.origin === "custom" || capability.type !== "native"
        ? "custom"
        : "builtin";

    const surface =
      configSurface(capability) ??
      (origin === "custom" ? customCapabilitySurface(capability) : null);

    return {
      id: capability.id,
      key: capability.key,
      title: capability.title,
      type: capability.type,
      origin: origin as "builtin" | "custom",
      route: surface?.href ?? null,
      dependencies,
    };
  });

  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      const surface = step.actionKey
        ? ACTION_SURFACES[step.actionKey]
        : undefined;

      for (const dependency of surface?.dependencies ?? []) {
        resources.add(dependency);
      }
    }
  }

  const navMap = new Map<string, Map<string, WorkspaceNavItem>>();

  addNav(navMap, "Control", {
    key: "control_center",
    label: "Control Center",
    href: "/dashboard",
    icon: "gauge",
  });

  if (canManage) {
    addNav(navMap, "People", {
      key: "employees",
      label: "Employees",
      href: "/dashboard/workforce/employees",
      icon: "users",
    });

    addNav(navMap, "People", {
      key: "organization",
      label: "Organization",
      href: "/dashboard/workforce/organization",
      icon: "network",
    });

    addNav(navMap, "Workspace", {
      key: "responsibilities",
      label: "Responsibilities",
      href: "/dashboard/workspace/responsibilities",
      icon: "blocks",
    });

    addNav(navMap, "Workspace", {
      key: "workflows",
      label: "Workflows",
      href: "/dashboard/workspace/workflows",
      icon: "git-branch",
    });

    addNav(navMap, "Workspace", {
      key: "assignments",
      label: "Assignments",
      href: "/dashboard/workspace/assignments",
      icon: "clipboard-list",
    });
  }

  let workflowHasApproval = false;

  for (const capability of capabilityRows) {
    const config = objectConfig(capability.config);
    const origin =
      config.origin === "custom" || capability.type !== "native"
        ? "custom"
        : "builtin";

    const surface =
      configSurface(capability) ??
      (origin === "custom" ? customCapabilitySurface(capability) : null);

    if (!surface) continue;

    addNav(navMap, surface.group, {
      key: `capability:${capability.key}`,
      label: surface.label,
      href: surface.href,
      icon: surface.icon,
      description: capability.description,
    });

    for (const dependency of surface.dependencies ?? []) {
      resources.add(dependency);
    }
  }

  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      if (step.type === "approval") {
        workflowHasApproval = true;
      }

      if (!step.actionKey) continue;

      const surface = ACTION_SURFACES[step.actionKey];
      if (!surface) continue;

      addNav(navMap, surface.group, {
        key: `action:${step.actionKey}`,
        label: surface.label,
        href: surface.href,
        icon: surface.icon,
      });

      for (const dependency of surface.dependencies ?? []) {
        resources.add(dependency);
      }
    }
  }

  if (canManage && workflowHasApproval) {
    addNav(navMap, "Workspace", {
      key: "approvals",
      label: "Approvals",
      href: "/dashboard/workspace/approvals",
      icon: "badge-check",
    });
  }

  for (const resourceKey of resources) {
    const surface = RESOURCE_SURFACES[resourceKey];

    if (!surface) continue;

    addNav(navMap, "Resources", {
      key: `resource:${resourceKey}`,
      label: surface.label,
      href: surface.href,
      icon: surface.icon,
    });
  }

  if (canManage) {
    addNav(navMap, "Administration", {
      key: "dashboard_access",
      label: "Dashboard Access",
      href: "/dashboard/usersAndTeam",
      icon: "user-cog",
    });

    addNav(navMap, "Administration", {
      key: "setup",
      label: "Setup",
      href: "/dashboard/administration/setup",
      icon: "settings",
    });
  }

  const stats: WorkspaceMetric[] = [];

  for (const workflow of workflows) {
    stats.push({
      key: `${workflow.key}:active`,
      label: `${workflow.name} active`,
      value: workflow.runtime.active,
      hint: `${workflow.steps.length} step${workflow.steps.length === 1 ? "" : "s"}`,
      href: "/dashboard/workspace/workflows",
    });

    const waiting = workflow.steps.reduce(
      (sum, step) => sum + step.runtime.pendingApproval,
      0,
    );

    const thisWorkflowHasApproval =
      workflow.steps.some((step) => step.type === "approval");

    if (thisWorkflowHasApproval) {
      stats.push({
        key: `${workflow.key}:approval`,
        label: `${workflow.name} awaiting approval`,
        value: waiting,
        href: "/dashboard/workspace/approvals",
      });
    }

    stats.push({
      key: `${workflow.key}:completed`,
      label: `${workflow.name} completed`,
      value: workflow.runtime.completed,
      href: "/dashboard/workspace/workflows",
    });
  }

  if (workflows.length === 0) {
    stats.push({
      key: "responsibilities",
      label: "Active responsibilities",
      value: capabilityRows.length,
      href: "/dashboard/workspace/responsibilities",
    });

    stats.push({
      key: "employees",
      label: "Active employees",
      value: Number(employeeCountRows[0]?.count ?? 0),
      href: "/dashboard/workforce/employees",
    });
  }

  const attention: WorkspaceAttention[] = [];

  const pendingApprovals = Number(pendingApprovalRows[0]?.count ?? 0);

  if (pendingApprovals > 0 && workflowHasApproval) {
    attention.push({
      key: "pending_approvals",
      severity: "warning",
      title: `${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} waiting`,
      body: "Workflow approvals are blocking downstream work.",
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

  const navigation = navGroups(navMap);

  const operationalItems = navigation
    .filter((group) =>
      ["work", "field_work", "money", "resources"].includes(group.key),
    )
    .flatMap((group) => group.items);

  const workspaceItems = navigation
    .find((group) => group.key === "workspace")
    ?.items ?? [];

  const quickActions = [
    ...operationalItems,
    ...workspaceItems,
  ].slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),

    identity: {
      userId: session.userId,
      companyName: session.companyName,
      username: session.username || session.email || "User",
      roles: currentRoles,
      permissions: currentPermissions,
    },

    navigation,

    responsibilities,

    workflows,

    resources: [...resources].sort(),

    controlCenter: {
      title:
        workflows.length === 1
          ? workflows[0].name
          : workflows.length > 1
            ? "Operations"
            : "Control Center",

      subtitle:
        workflows.length > 0
          ? "Live status, bottlenecks and actions derived from your active workflows."
          : "Create a workflow to make the workspace, navigation and metrics process-driven.",

      stats: stats.slice(0, 8),
      attention,
      quickActions,
    },
  };
}
