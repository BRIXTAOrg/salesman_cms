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

      <SidebarInset className="min-h-svh bg-muted/15">
        <SiteHeader />
        <main className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
