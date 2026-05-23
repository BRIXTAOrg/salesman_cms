// src/app/dashboard/institutionManagement/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ListInstitutionsPage from '@/app/dashboard/institutionManagement/listInstitutions';

interface InstitutionManagementTabsProps {
  canSeeListInstitutions: boolean;
}

export function InstitutionManagementTabs({
  canSeeListInstitutions,
}: InstitutionManagementTabsProps) {

  let defaultTab = "";
  if (canSeeListInstitutions) defaultTab = "ListInstitutions";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeListInstitutions && (
          <TabsTrigger value="ListInstitutions">List Institutions</TabsTrigger>
        )}
      </TabsList>

      {/* --- Tab Content --- */}
      {canSeeListInstitutions && (
        <TabsContent value="ListInstitutions" className="space-y-4">
          <ListInstitutionsPage />
        </TabsContent>
      )}
    </Tabs>
  );
}