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
  AlertCircle,
} from "lucide-react";

import DashboardShell from "@/app/dashboard/dashboardShell";
import {
  requireApplianceSession,
} from "@/lib/appliance-backend";

export const metadata: Metadata = {
  title: "BRIXTA Workspace",
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
          Loading workspace...
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

  const auth = await requireApplianceSession(false);

  if (!auth.ok) {
    if (auth.status === 401) {
      redirect("/");
    }

    return (
      <AccessBlocked
        title="Access blocked"
        description={auth.error}
      />
    );
  }

  const session = auth.session;
  const primaryJob = session.jobRoles?.[0] ?? "";
  const roleDisplay =
    primaryJob && session.orgRole
      ? `${session.orgRole}:${primaryJob}`
      : session.orgRole || primaryJob || "Team Member";

  return (
    <DashboardShell
      user={{
        id: session.userId,
        email: session.email,
        username: session.username,
      }}
      role={roleDisplay}
      permissions={session.permissions}
      jobRoles={session.jobRoles}
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
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <form action="/api/auth/logout" method="post" className="mt-6">
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
