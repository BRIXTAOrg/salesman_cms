"use client";

/*
 * BRIXTA_CLEAN_UI_V1 — the left navigation.
 *
 * One list of plain groups (Overview, People, Field work, App builder…)
 * straight from the workspace manifest. Individual responsibilities are
 * reachable from "All responsibilities" and the search box, so the sidebar
 * stays short.
 */

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Blocks,
  Building2,
  CalendarCheck2,
  CalendarOff,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  Landmark,
  List,
  LogOut,
  MapPinned,
  Network,
  QrCode,
  Receipt,
  Route,
  Settings2,
  Smartphone,
  Store,
  UserRoundCog,
  Users,
  Warehouse,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { WorkspaceManifest } from "@/lib/workspace-types";

type Props = {
  userRole: string;
  permissions: string[];
  jobRoles?: string[];
};

const icons: Record<string, ComponentType<{ className?: string }>> = {
  gauge: Gauge,
  users: Users,
  network: Network,
  "calendar-check": CalendarCheck2,
  "calendar-off": CalendarOff,
  "map-pin": MapPinned,
  smartphone: Smartphone,
  blocks: Blocks,
  "clipboard-list": ClipboardList,
  "badge-check": BadgeCheck,
  "git-branch": GitBranch,
  route: Route,
  warehouse: Warehouse,
  store: Store,
  landmark: Landmark,
  building: Building2,
  receipt: Receipt,
  "qr-code": QrCode,
  "file-chart": FileSpreadsheet,
  "user-cog": UserRoundCog,
  settings: Settings2,
  list: List,
};

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "B";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

export function AppSidebar({ userRole }: Props) {
  const pathname = usePathname();
  const [manifest, setManifest] = useState<WorkspaceManifest | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/workspace/manifest", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled) setManifest(body.manifest ?? null);
      } catch {
        // The shell stays usable; navigation fills in on the next try.
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const groups = useMemo(
    () =>
      (manifest?.navigation ?? [])
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.key.startsWith("responsibility:") && !item.key.startsWith("archived:"),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [manifest],
  );

  // The longest matching link wins, so /dashboard doesn't light up everywhere.
  const activeHref = useMemo(() => {
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));
    return (
      hrefs
        .filter((href) => (href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`)))
        .sort((a, b) => b.length - a.length)[0] ?? null
    );
  }, [groups, pathname]);

  const companyName = manifest?.identity.companyName ?? "BRIXTA";
  const userName = manifest?.identity.username ?? "";

  return (
    <Sidebar className="brixta-sidebar">
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-3 rounded-[10px] px-1.5 py-1.5 hover:bg-[#F1F3F0]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground">
            {initials(companyName)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-5">{companyName}</div>
            <div className="truncate text-[12px] leading-4 text-muted-foreground">
              {manifest ? userName || "Signed in" : "Loading…"}
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {!manifest && (
          <div className="space-y-2 px-2 py-3" aria-hidden>
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-8 animate-pulse rounded-lg bg-[#F1F3F0]" />
            ))}
          </div>
        )}

        {groups.map((group) => (
          <SidebarGroup key={group.key}>
            {group.items.length > 1 || group.label !== "Overview" ? (
              <div className="px-2.5 pb-1 pt-2 text-[12px] font-medium text-muted-foreground">{group.label}</div>
            ) : null}
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = icons[item.icon] ?? Blocks;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={item.href === activeHref} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <div className="flex items-center gap-2 px-1.5 py-1">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{userName || "You"}</div>
            {userRole && <div className="truncate text-[12px] text-muted-foreground">{userRole}</div>}
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              title="Sign out"
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[#FDF1EF] hover:text-[#B42318]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
