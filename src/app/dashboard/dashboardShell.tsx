"use client";

import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

interface User {
  id: number;
  email: string;
  username: string | null;
  role?: string;
}

interface DashboardShellProps {
  user: User;
  children: ReactNode;
  role?: string;
  permissions?: string[];
  jobRoles?: string[];
}

export default function DashboardShell({
  children,
  role,
  permissions = [],
  jobRoles = [],
}: DashboardShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar
        userRole={role || ""}
        permissions={permissions}
        jobRoles={jobRoles}
      />

      <SidebarInset className="min-h-svh w-full min-w-0 max-w-full overflow-x-clip bg-muted/15">
        <SiteHeader />
        <main className="flex w-full min-w-0 max-w-full flex-1 flex-col overflow-x-clip">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
