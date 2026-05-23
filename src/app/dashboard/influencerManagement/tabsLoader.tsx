// src/app/dashboard/influencerManagement/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ListInfluencersPage from '@/app/dashboard/influencerManagement/listInfluencers';

interface InfluencerManagementTabsProps {
  canSeeListInfluencers: boolean;
}

export function InfluencerManagementTabs({
  canSeeListInfluencers,
}: InfluencerManagementTabsProps) {

  let defaultTab = "";
  if (canSeeListInfluencers) defaultTab = "ListInfluencers";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeListInfluencers && (
          <TabsTrigger value="ListInfluencers">List Influencers</TabsTrigger>
        )}
      </TabsList>

      {/* --- Tab Content --- */}
      {canSeeListInfluencers && (
        <TabsContent value="ListInfluencers" className="space-y-4">
          <ListInfluencersPage />
        </TabsContent>
      )}
    </Tabs>
  );
}