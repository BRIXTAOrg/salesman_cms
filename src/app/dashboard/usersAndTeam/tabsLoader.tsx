"use client";

// Backward-compatible export for older imports.
// The old tab composition referenced files that no longer exist on this branch.
// Dashboard Access is now a first-class appliance screen.
import DashboardAccessClient from "@/components/appliance/dashboard-access-client";

type LegacyTabsProps = {
  adminUser?: unknown;
  canSeeUsers?: boolean;
  canSeeTeamView?: boolean;
  canManageMobileWorkspace?: boolean;
};

export function UsersAndTeamTabs(
  _props: LegacyTabsProps,
) {
  return <DashboardAccessClient />;
}
