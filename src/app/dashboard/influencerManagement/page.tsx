// src/app/dashboard/influencerManagement/page.tsx
import { Suspense } from 'react';
import { InfluencerManagementTabs } from './tabsLoader';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { verifySession, hasPermission } from '@/lib/auth';

export default function InfluencersPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Influencers Management
        </h2>
      </div>

      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <InfluencersDynamicContent />
      </Suspense>
    </div>
  );
}

async function InfluencersDynamicContent() {
  await connection();

  const session = await verifySession();
  if (!session || !session.userId) {
    redirect('/');
  }

  const userPerms = session.permissions || [];

  const canSeeListInfluencers = hasPermission(userPerms, ['READ', 'ALL_ACCESS']);
  const canSeeAnything = canSeeListInfluencers;

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
      <InfluencerManagementTabs
        canSeeListInfluencers={canSeeListInfluencers}
      />
    </div>
  );
}