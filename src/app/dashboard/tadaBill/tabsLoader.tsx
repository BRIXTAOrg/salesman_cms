// src/app/dashboard/tadaBill/tabsLoader.tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TadaListPage from './tadaList';
import TadaVerifyPage from './tadaVerify';

interface TadaBillTabsProps {
  canSeeTadaList: boolean;
  canSeeTadaVerify: boolean;
}

export function TadaBillTabs({ canSeeTadaList, canSeeTadaVerify }: TadaBillTabsProps) {
  const defaultTab = canSeeTadaList ? 'TadaList' : 'TadaVerify';

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        {canSeeTadaList && <TabsTrigger value="TadaList">All TA/DA Bills</TabsTrigger>}
        {canSeeTadaVerify && <TabsTrigger value="TadaVerify">TA/DA Verify</TabsTrigger>}
      </TabsList>

      {canSeeTadaList && (
        <TabsContent value="TadaList" className="space-y-4">
          <TadaListPage />
        </TabsContent>
      )}

      {canSeeTadaVerify && (
        <TabsContent value="TadaVerify" className="space-y-4">
          <TadaVerifyPage />
        </TabsContent>
      )}
    </Tabs>
  );
}