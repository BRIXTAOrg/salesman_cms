import "server-only";

import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/drizzle";
import { roles, userRoles, users } from "../../../drizzle/schema";
import type {
  ResolvedRoleContext,
  RoleTargetResolver,
  WorkflowPurpose,
  WorkflowResolution,
} from "./role-context-types";

async function firstActiveOrganizationAdmin(
  db: AppDatabase,
): Promise<number | null> {
  const rows = await db
    .select({ userId: users.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(roles.orgRole, "Admin"), eq(users.status, "active")))
    .limit(1);

  return rows[0]?.userId ?? null;
}

function activeRule(
  context: ResolvedRoleContext,
  purpose: WorkflowPurpose,
) {
  return context.definition.workflows.find(
    (item) => item.enabled && item.purpose === purpose,
  );
}

export async function resolveWorkflowTarget(
  db: AppDatabase,
  args: {
    context: ResolvedRoleContext;
    purpose: WorkflowPurpose;
  },
): Promise<WorkflowResolution> {
  const rule = activeRule(args.context, args.purpose);
  if (!rule) {
    return {
      status: "not_required",
      purpose: args.purpose,
      reason: `Role ${args.context.activeRole.label} has no enabled ${args.purpose} route.`,
    };
  }

  const resolver: RoleTargetResolver = rule.target;

  if (resolver.kind === "self") {
    return {
      status: "resolved",
      purpose: args.purpose,
      resolver,
      userId: args.context.user.id,
      reason: "The Role workflow resolves this step to the current user.",
    };
  }

  if (resolver.kind === "reporting_manager") {
    if (!args.context.manager) {
      return {
        status: "unresolved",
        purpose: args.purpose,
        resolver,
        reason:
          "This workflow requires the reporting manager, but users.reports_to_id is empty for this user.",
      };
    }

    return {
      status: "resolved",
      purpose: args.purpose,
      resolver,
      userId: args.context.manager.id,
      reason: `Resolved through users.reports_to_id to ${args.context.manager.label}.`,
    };
  }

  if (resolver.kind === "organization_admin") {
    const userId = await firstActiveOrganizationAdmin(db);
    return userId
      ? {
          status: "resolved",
          purpose: args.purpose,
          resolver,
          userId,
          reason: "Resolved to the first active user holding the tenant Admin Role.",
        }
      : {
          status: "unresolved",
          purpose: args.purpose,
          resolver,
          reason: "No active tenant Admin user could be resolved.",
        };
  }

  if (resolver.kind === "role") {
    if (
      args.context.manager &&
      args.context.managerRoleIds.includes(resolver.roleId)
    ) {
      return {
        status: "resolved",
        purpose: args.purpose,
        resolver,
        userId: args.context.manager.id,
        reason:
          "The reporting manager also holds the target Role, so the relationship remains deterministic.",
      };
    }

    return {
      status: "unresolved",
      purpose: args.purpose,
      resolver,
      reason:
        "A target Role was configured, but there is no deterministic relationship from this user to one specific holder of that Role. Configure reporting-manager routing or add a future team/relationship resolver instead of choosing a random person.",
    };
  }

  return {
    status: "unresolved",
    purpose: args.purpose,
    reason: "Unknown Role workflow resolver.",
  };
}

export async function resolveRoleWorkflowTargets(
  db: AppDatabase,
  context: ResolvedRoleContext,
): Promise<Record<WorkflowPurpose, WorkflowResolution>> {
  const purposes: WorkflowPurpose[] = [
    "approval",
    "review",
    "escalation",
    "handoff",
  ];

  const results = await Promise.all(
    purposes.map((purpose) =>
      resolveWorkflowTarget(db, { context, purpose }),
    ),
  );

  return Object.fromEntries(
    results.map((item) => [item.purpose, item]),
  ) as Record<WorkflowPurpose, WorkflowResolution>;
}
