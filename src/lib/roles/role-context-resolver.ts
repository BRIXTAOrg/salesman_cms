import "server-only";

import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/drizzle";
import { roles, userRoles, users } from "../../../drizzle/schema";
import { getRoleContextDefinition } from "./role-context-store";
import type {
  ResolvedRoleContext,
  ResolvedRoleReference,
  ResolvedUserReference,
} from "./role-context-types";

function roleLabel(row: { id: number; orgRole?: string | null; jobRole?: string | null }) {
  return row.orgRole || row.jobRole || `Role ${row.id}`;
}

function userLabel(row: {
  id: number;
  displayName?: string | null;
  username?: string | null;
  email: string;
}) {
  return row.displayName || row.username || row.email || `User ${row.id}`;
}

async function getUserRoles(
  db: AppDatabase,
  userId: number,
): Promise<ResolvedRoleReference[]> {
  const rows = await db
    .select({
      id: roles.id,
      orgRole: roles.orgRole,
      jobRole: roles.jobRole,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return rows.map((row) => ({ id: row.id, label: roleLabel(row) }));
}

export async function resolveRoleContext(
  db: AppDatabase,
  args: {
    userId: number;
    preferredRoleId?: number | null;
  },
): Promise<ResolvedRoleContext> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      department: users.department,
      designation: users.designation,
      area: users.area,
      zone: users.zone,
      reportsToId: users.reportsToId,
    })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);

  if (!user) {
    throw new Error(`Cannot resolve Role Context: user ${args.userId} does not exist.`);
  }

  const assignedRoles = await getUserRoles(db, user.id);
  const activeRole =
    (args.preferredRoleId
      ? assignedRoles.find((item) => item.id === args.preferredRoleId)
      : null) ??
    assignedRoles[0];

  if (!activeRole) {
    throw new Error(
      `Cannot resolve Role Context: user ${user.id} has no stable user_roles assignment.`,
    );
  }

  const definition = await getRoleContextDefinition(db, activeRole.id);
  if (!definition) {
    throw new Error(`Cannot resolve Role Context: role ${activeRole.id} does not exist.`);
  }

  let manager: ResolvedUserReference | null = null;
  let managerRoleIds: number[] = [];

  if (user.reportsToId) {
    const [managerRow] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        department: users.department,
        designation: users.designation,
        area: users.area,
        zone: users.zone,
      })
      .from(users)
      .where(eq(users.id, user.reportsToId))
      .limit(1);

    if (managerRow) {
      manager = {
        id: managerRow.id,
        label: userLabel(managerRow),
        department: managerRow.department,
        designation: managerRow.designation,
        area: managerRow.area,
        zone: managerRow.zone,
      };
      managerRoleIds = (await getUserRoles(db, managerRow.id)).map((item) => item.id);
    }
  }

  return {
    user: {
      id: user.id,
      label: userLabel(user),
      department: user.department,
      designation: user.designation,
      area: user.area,
      zone: user.zone,
    },
    roles: assignedRoles,
    activeRole,
    definition,
    manager,
    managerRoleIds,
    runtime: {
      department: user.department,
      designation: user.designation,
      area: user.area,
      zone: user.zone,
    },
    capabilities: definition.capabilities,
    visibility: definition.visibility.filter((item) => item.enabled),
  };
}
