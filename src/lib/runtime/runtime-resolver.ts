import "server-only";

import type { AppDatabase } from "@/lib/drizzle";
import type { CompiledResponsibilityManifest } from "@/lib/platform-vnext-types";
import { resolveRoleContext } from "@/lib/roles/role-context-resolver";
import { resolveRoleWorkflowTargets } from "@/lib/roles/role-workflow-resolver";
import type { ResolvedResponsibilityRuntime } from "./runtime-types";

/**
 * Combines a published Responsibility contract with one real user's current
 * Role Context. This is where "generic Responsibility" becomes "Rahul's app".
 *
 * The published manifest remains generic; actual manager/user values are
 * injected here at runtime.
 */
export async function resolveResponsibilityRuntime(
  db: AppDatabase,
  args: {
    userId: number;
    targetRoleId: number;
    manifest: CompiledResponsibilityManifest;
  },
): Promise<ResolvedResponsibilityRuntime> {
  const roleContext = await resolveRoleContext(db, {
    userId: args.userId,
    preferredRoleId: args.targetRoleId,
  });

  if (roleContext.activeRole.id !== args.targetRoleId) {
    throw new Error(
      `User ${args.userId} does not currently hold target Role ${args.targetRoleId}.`,
    );
  }

  const workflow = await resolveRoleWorkflowTargets(db, roleContext);

  return {
    responsibilityId: args.manifest.responsibilityId,
    responsibilityKey: args.manifest.responsibilityKey,
    responsibilityTitle: args.manifest.responsibilityTitle,
    version: args.manifest.version,
    manifest: args.manifest,
    targetRoleId: args.targetRoleId,
    context: {
      userId: roleContext.user.id,
      roleId: roleContext.activeRole.id,
      managerUserId: roleContext.manager?.id ?? null,
      department: roleContext.runtime.department,
      designation: roleContext.runtime.designation,
      area: roleContext.runtime.area,
      zone: roleContext.runtime.zone,
    },
    workflow,
  };
}
