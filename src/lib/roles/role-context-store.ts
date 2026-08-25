import "server-only";

import { eq, inArray } from "drizzle-orm";

import { roleContextProfiles } from "../../../drizzle/roleContextSchema";
import { roles } from "../../../drizzle/schema";
import type { AppDatabase } from "@/lib/drizzle";
import {
  createDefaultRoleContext,
  normalizeRoleContextDefinition,
} from "./role-context-normalizer";
import type { RoleContextDefinition } from "./role-context-types";

function labelOf(role: { id: number; orgRole?: string | null; jobRole?: string | null }) {
  return role.orgRole || role.jobRole || `Role ${role.id}`;
}

export async function getRoleContextDefinition(
  db: AppDatabase,
  roleId: number,
): Promise<RoleContextDefinition | null> {
  const [role] = await db
    .select({
      id: roles.id,
      orgRole: roles.orgRole,
      jobRole: roles.jobRole,
    })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  if (!role) return null;

  const [profile] = await db
    .select({
      definition: roleContextProfiles.definition,
    })
    .from(roleContextProfiles)
    .where(eq(roleContextProfiles.roleId, roleId))
    .limit(1);

  return profile
    ? normalizeRoleContextDefinition({
        roleId,
        label: labelOf(role),
        value: profile.definition,
      })
    : createDefaultRoleContext(roleId, labelOf(role));
}

export async function listRoleContextDefinitions(
  db: AppDatabase,
  roleIds?: number[],
): Promise<RoleContextDefinition[]> {
  const roleRows = roleIds?.length
    ? await db
        .select({
          id: roles.id,
          orgRole: roles.orgRole,
          jobRole: roles.jobRole,
        })
        .from(roles)
        .where(inArray(roles.id, roleIds))
    : await db
        .select({
          id: roles.id,
          orgRole: roles.orgRole,
          jobRole: roles.jobRole,
        })
        .from(roles);

  if (!roleRows.length) return [];

  const profiles = await db
    .select({
      roleId: roleContextProfiles.roleId,
      definition: roleContextProfiles.definition,
    })
    .from(roleContextProfiles)
    .where(inArray(roleContextProfiles.roleId, roleRows.map((item) => item.id)));

  const profileByRole = new Map(
    profiles.map((item) => [item.roleId, item.definition]),
  );

  return roleRows.map((role) =>
    profileByRole.has(role.id)
      ? normalizeRoleContextDefinition({
          roleId: role.id,
          label: labelOf(role),
          value: profileByRole.get(role.id),
        })
      : createDefaultRoleContext(role.id, labelOf(role)),
  );
}

export async function saveRoleContextDefinition(
  db: AppDatabase,
  args: {
    roleId: number;
    value: unknown;
    updatedByUserId?: number | null;
  },
): Promise<RoleContextDefinition | null> {
  const [role] = await db
    .select({
      id: roles.id,
      orgRole: roles.orgRole,
      jobRole: roles.jobRole,
    })
    .from(roles)
    .where(eq(roles.id, args.roleId))
    .limit(1);

  if (!role) return null;

  const definition = normalizeRoleContextDefinition({
    roleId: args.roleId,
    label: labelOf(role),
    value: args.value,
  });

  await db
    .insert(roleContextProfiles)
    .values({
      roleId: args.roleId,
      schemaVersion: definition.schemaVersion,
      definition: definition as unknown as Record<string, unknown>,
      updatedByUserId: args.updatedByUserId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: roleContextProfiles.roleId,
      set: {
        schemaVersion: definition.schemaVersion,
        definition: definition as unknown as Record<string, unknown>,
        updatedByUserId: args.updatedByUserId ?? null,
        updatedAt: new Date(),
      },
    });

  return definition;
}
