// src/app/dashboard/outletManagement/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ListOutletsPage from '@/app/dashboard/outletManagement/listOutlets';

interface OutletsManagementTabsProps {
  canSeeListOutlets: boolean;
}

export function OutletsManagementTabs({
  canSeeListOutlets,
}: OutletsManagementTabsProps) {

  let defaultTab = "";
  if (canSeeListOutlets) defaultTab = "ListOutlets";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeListOutlets && (
          <TabsTrigger value="ListOutlets">List Outlets</TabsTrigger>
        )}
      </TabsList>

      {/* --- Tab Content --- */}
      {canSeeListOutlets && (
        <TabsContent value="ListOutlets" className="space-y-4">
          <ListOutletsPage />
        </TabsContent>
      )}
    </Tabs>
  );
}