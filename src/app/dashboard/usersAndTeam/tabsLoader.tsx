// src/app/dashboard/usersAndTeam/tabsLoader.tsx
"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

import { TeamOverview } from "./teamOverview";
import UsersManagement from "./userManagement";
import MobileWorkspace from "./mobileWorkspace";

interface TabsProps {
  adminUser: any;
  canSeeUsers: boolean;
  canSeeTeamView: boolean;
  canManageMobileWorkspace: boolean;
}

export function UsersAndTeamTabs({
  adminUser,
  canSeeUsers,
  canSeeTeamView,
  canManageMobileWorkspace,
}: TabsProps) {
  const [
    isMounted,
    setIsMounted,
  ] = useState(false);

  useEffect(
    () => setIsMounted(true),
    [],
  );

  if (!isMounted) {
    return (
      <Loader2 className="mx-auto mt-10 h-8 w-8 animate-spin" />
    );
  }

  const defaultTab = canSeeUsers
    ? "users"
    : canSeeTeamView
      ? "team"
      : "mobile-workspace";

  return (
    <Tabs
      defaultValue={defaultTab}
      className="space-y-4"
    >
      <TabsList>
        {canSeeUsers && (
          <TabsTrigger value="users">
            Users
          </TabsTrigger>
        )}

        {canSeeTeamView && (
          <TabsTrigger value="team">
            Team Overview
          </TabsTrigger>
        )}

        {canManageMobileWorkspace && (
          <TabsTrigger value="mobile-workspace">
            Mobile Workspace
          </TabsTrigger>
        )}
      </TabsList>

      {canSeeUsers && (
        <TabsContent value="users">
          <UsersManagement
            adminUser={adminUser}
          />
        </TabsContent>
      )}

      {canSeeTeamView && (
        <TabsContent value="team">
          <TeamOverview
            currentUserRole={
              adminUser.orgRole
            }
          />
        </TabsContent>
      )}

      {canManageMobileWorkspace && (
        <TabsContent value="mobile-workspace">
          <MobileWorkspace />
        </TabsContent>
      )}
    </Tabs>
  );
}
