// src/app/dashboard/institutionManagement/page.tsx
import { Suspense } from 'react';
import { InstitutionManagementTabs } from './tabsLoader';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { verifySession, hasPermission } from '@/lib/auth';

export default function InstitutionsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Institutions Management
        </h2>
      </div>

      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <InstitutionsDynamicContent />
      </Suspense>
    </div>
  );
}

async function InstitutionsDynamicContent() {
  await connection();

  const session = await verifySession();
  if (!session || !session.userId) {
    redirect('/');
  }

  const userPerms = session.permissions || [];

  const canSeeListInstitutions = hasPermission(userPerms, ['READ', 'ALL_ACCESS']);
  const canSeeAnything = canSeeListInstitutions;

  if (!canSeeAnything) {
    return (
      <div className="mt-4">
        <h3 className="text-xl font-semibold tracking-tight text-red-600">Access Denied</h3>
        <p className="text-neutral-500">
          You do not have permission to view this section.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 overflow-x-hidden">
      <InstitutionManagementTabs
        canSeeListInstitutions={canSeeListInstitutions}
      />
    </div>
  );
}