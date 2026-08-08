// src/app/dashboard/distributorManagement/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ListDistrubutorsPage from '@/app/dashboard/distributorManagement/listDistributors';

interface DistributorsManagementTabsProps {
  canSeeListDistributors: boolean;
}

export function DistributorsManagementTabs({
  canSeeListDistributors,
}: DistributorsManagementTabsProps) {

  let defaultTab = "";
  if (canSeeListDistributors) defaultTab = "ListDistributors";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeListDistributors && (
          <TabsTrigger value="ListDistributors">List Distributors</TabsTrigger>
        )}
      </TabsList>

      {/* --- Tab Content --- */}
      {canSeeListDistributors && (
        <TabsContent value="ListDistributors" className="space-y-4">
          <ListDistrubutorsPage />
        </TabsContent>
      )}
    </Tabs>
  );
}