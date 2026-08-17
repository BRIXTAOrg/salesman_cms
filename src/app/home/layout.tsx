// src/app/home/layout.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { withTenantSchema } from "@/lib/drizzle";
import { users } from "../../../drizzle";
import { eq } from "drizzle-orm";
import HomeShell from "@/app/home/homeShell";
import type { Metadata } from "next";
import { verifySession } from "@/lib/auth";
import { AlertCircle } from 'lucide-react';
import { JOB_ROLES, ORG_ROLES } from '@/lib/Reusable-constants';

export const metadata: Metadata = {
  icons: { icon: "/favicon.ico" },
};

export default function CemTemChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
      <AuthenticatedHomeLayout>{children}</AuthenticatedHomeLayout>
    </Suspense>
  );
}

export async function AuthenticatedHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  // 1. Verify custom session
  const session = await verifySession();

  if (!session || !session.userId || !session.schemaName) {
    redirect("/");
  }

  // 2. Fetch User from DB using local integer ID -- scoped to this
  // session's tenant schema, same as every other tenant-table query.
  const result = await withTenantSchema(session.schemaName, (db) =>
    db
      .select({
        userId: users.id,
        email: users.email,
        status: users.status,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
  );

  const dbUser = result[0];

  if (!dbUser) redirect('/api/auth/logout');

  // --- EXTRACT ROLES & PERMISSIONS ---
  const finalOrgRole = session.orgRole || '';
  const userJobRoles = session.jobRoles || [];
  const userPerms = session.permissions || [];

  console.log('🎯 Org Role:', finalOrgRole);
  console.log('🎯 Job Roles:', userJobRoles);
  console.log('🎯 Permissions:', userPerms);

  // --- NEW STRICT SAFETY CHECK ---
  const hasValidOrgRole = ORG_ROLES.includes(finalOrgRole);
  const hasValidJobRole = userJobRoles.some(role => JOB_ROLES.includes(role));
  const hasPermissions = userPerms.length > 0;

  if ((!hasValidOrgRole && !hasValidJobRole) || !hasPermissions) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="text-center p-8 bg-card border border-border rounded-xl shadow-2xl max-w-md w-full">
          <div className="flex justify-center mb-4">
            <div className="bg-destructive/10 p-3 rounded-full">
              <AlertCircle className="w-12 h-12 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-8">
            Your account does not have the necessary roles or permissions to view the Best Cement CMS.
          </p>

          <form action="/api/auth/logout" method="post" className="w-full">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              Return to Home Page
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Extract the JobRole & OrgRole of user
  const primaryJob = userJobRoles.length > 0 ? userJobRoles[0] : '';

  // Formats as "Manager:Technical-Sales" or just the Org role if no Job role exists
  const primaryRoleDisplay = primaryJob && finalOrgRole ? `${finalOrgRole}:${primaryJob}`
    : finalOrgRole || primaryJob || 'Team Member';

  // --- HYDRATE WITH 'READ' BY DEFAULT ---
  // Ensure the UI knows they can at least "see" the tabs available to their company
  const hydratedPermissions = Array.from(new Set([...userPerms, 'READ']));

  const mappedUser = {
    id: dbUser.userId,
    email: dbUser.email,
    username: dbUser.username,
  };

  return (
    <HomeShell
      user={mappedUser}
      role={primaryRoleDisplay}
      permissions={hydratedPermissions}
      jobRoles={userJobRoles}
    >
      {children}
    </HomeShell>
  );
}