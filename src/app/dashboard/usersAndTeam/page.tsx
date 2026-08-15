// src/app/dashboard/usersAndTeam/page.tsx
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import {
  hasPermission,
  verifySession,
} from "@/lib/auth";

import {
  UsersAndTeamTabs,
} from "./tabsLoader";

export default function UsersAndTeamPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Users & Team Management Page
        </h2>
      </div>

      <Suspense
        fallback={
          <p className="mt-4 text-muted-foreground">
            Loading...
          </p>
        }
      >
        <UsersAndTeamDynamicContent />
      </Suspense>
    </div>
  );
}

export async function UsersAndTeamDynamicContent() {
  await connection();

  const session =
    await verifySession();

  if (
    !session ||
    !session.userId
  ) {
    redirect("/");
  }

  const userPerms =
    session.permissions || [];

  const adminUser = {
    id: session.userId,
    orgRole:
      session.orgRole,
    jobRole:
      session.jobRoles,
    username:
      session.username,
    email:
      session.email,
  };

  const canSeeUsers =
    hasPermission(
      userPerms,
      [
        "READ",
        "UPDATE",
        "WRITE",
        "ALL_ACCESS",
      ],
    );

  const canSeeTeamView =
    hasPermission(
      userPerms,
      [
        "READ",
        "UPDATE",
        "WRITE",
        "ALL_ACCESS",
      ],
    );

  const canManageMobileWorkspace =
    hasPermission(
      userPerms,
      [
        "WRITE",
        "UPDATE",
        "ALL_ACCESS",
      ],
    );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <UsersAndTeamTabs
        adminUser={
          adminUser
        }
        canSeeUsers={
          canSeeUsers
        }
        canSeeTeamView={
          canSeeTeamView
        }
        canManageMobileWorkspace={
          canManageMobileWorkspace
        }
      />
    </div>
  );
}
