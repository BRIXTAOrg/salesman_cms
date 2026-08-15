import {
  Suspense,
  type ReactNode,
} from "react";
import {
  redirect,
} from "next/navigation";
import type {
  Metadata,
} from "next";
import {
  connection,
} from "next/server";
import {
  eq,
} from "drizzle-orm";
import {
  AlertCircle,
} from "lucide-react";

import DashboardShell from "@/app/dashboard/dashboardShell";
import {
  db,
} from "@/lib/drizzle";
import {
  verifySession,
} from "@/lib/auth";
import {
  users,
} from "../../../drizzle";

export const metadata: Metadata = {
  title: "Field Control",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Loading Field Control...
        </div>
      }
    >
      <AuthenticatedLayout>
        {children}
      </AuthenticatedLayout>
    </Suspense>
  );
}

async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  const session =
    await verifySession();

  if (!session?.userId) {
    redirect("/");
  }

  const [dbUser] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      status: users.status,
    })
    .from(users)
    .where(
      eq(
        users.id,
        session.userId,
      ),
    )
    .limit(1);

  if (!dbUser) {
    redirect("/api/auth/logout");
  }

  if (dbUser.status !== "active") {
    return (
      <AccessBlocked
        title="Account inactive"
        description="This dashboard account is not active. Contact an administrator."
      />
    );
  }

  const permissions =
    session.permissions ?? [];

  if (permissions.length === 0) {
    return (
      <AccessBlocked
        title="Access not configured"
        description="Your account exists, but no dashboard permissions have been assigned yet."
      />
    );
  }

  const primaryJob =
    session.jobRoles?.[0] ?? "";

  const roleDisplay =
    primaryJob &&
    session.orgRole
      ? `${session.orgRole}:${primaryJob}`
      : session.orgRole ||
        primaryJob ||
        "Team Member";

  return (
    <DashboardShell
      user={{
        id: dbUser.id,
        email: dbUser.email,
        username:
          dbUser.username,
      }}
      role={roleDisplay}
      permissions={permissions}
      jobRoles={
        session.jobRoles ?? []
      }
    >
      {children}
    </DashboardShell>
  );
}

function AccessBlocked({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>

        <h1 className="mt-4 text-2xl font-semibold">
          {title}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>

        <form
          action="/api/auth/logout"
          method="post"
          className="mt-6"
        >
          <button
            type="submit"
            className="h-10 w-full rounded-xl bg-foreground px-4 text-sm font-medium text-background"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
