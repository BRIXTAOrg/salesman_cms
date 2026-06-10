// src/app/dashboard/page.tsx
import { Suspense } from 'react';
import { verifySession } from '@/lib/auth';
import { db } from '@/lib/drizzle';
import { users } from '../../../drizzle';
import { eq } from 'drizzle-orm';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import SimpleWelcomePage from '@/app/dashboard/welcome/page';
import LinearGraphs from './linearGraphs';
import PieGraphs from './pieGraphs';

const allowedNonAdminRoles = [
  'senior-executive',
  'executive',
  'junior-executive',
];

// 1. The Static Shell 
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

// 2. The Dynamic Content (Runs at request-time)
async function DashboardContent() {
  await connection();

  // Custom JWT Check
  const session = await verifySession();

  if (!session || !session.userId) {
    redirect('/');
  }

  // Look up user by your local integer ID now, instead of WorkOS string ID
  const result = await db
    .select({
      username: users.username
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const dbUser = result[0];

  if (!dbUser) {
    redirect('/login');
  }

  // CONDITIONAL RENDER
  const userRole = session.orgRole || '';
  if (allowedNonAdminRoles.includes(userRole)) {
    return <SimpleWelcomePage username={dbUser.username || 'Team Member'} />;
  }

  // Extract roles for RBAC in widgets
  const jobRoles = session.jobRoles || [];
  const permissions = session.permissions || [];

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your field operations and team metrics.</p>
        </div>
      </div>

      {/* Top Row: Pie Charts (Attendance & Leaves) : No RBAC yet */}
      <div className="w-full">
        <PieGraphs />
      </div>

      {/* Bottom Row: Linear/Area Graphs (Sales, Techical-Sales, Reports-MIS) */}
      {/* <div className="w-full">
        <LinearGraphs jobRoles={jobRoles} permissions={permissions} />
      </div> */}
    </div>
  );
}