"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";

import Link from "next/link";
import {
  usePathname,
} from "next/navigation";

import {
  BadgeCheck,
  Blocks,
  Building2,
  CalendarCheck2,
  CalendarOff,
  ClipboardList,
  FileBarChart,
  Gauge,
  GitBranch,
  Landmark,
  LogOut,
  MapPinned,
  Network,
  Receipt,
  Route,
  Settings2,
  ShieldCheck,
  Smartphone,
  Store,
  UserRoundCog,
  Users,
  Warehouse,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import type {
  WorkspaceManifest,
} from "@/lib/workspace-types";

type Props = {
  userRole: string;
  permissions: string[];
  jobRoles?: string[];
};

const icons: Record<
  string,
  ComponentType<{
    className?: string;
  }>
> = {
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
  "file-chart": FileBarChart,
  "user-cog": UserRoundCog,
  settings: Settings2,
};

export function AppSidebar(
  _props: Props,
) {
  const pathname = usePathname();

  const [
    manifest,
    setManifest,
  ] = useState<WorkspaceManifest | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          "/api/workspace/manifest",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const body = await response.json();

        if (!cancelled) {
          setManifest(
            body.manifest ?? null,
          );
        }
      } catch {
        // The shell remains usable; the manifest endpoint
        // is the canonical source of business navigation.
      }
    }

    void load();

    const timer = window.setInterval(
      () => void load(),
      60_000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const groups = useMemo(
    () => manifest?.navigation ?? [],
    [manifest],
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-3 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-xl px-2 py-1.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {manifest?.identity
                .companyName ??
                "Field Control"}
            </div>

            <div className="truncate text-xs text-muted-foreground">
              {manifest
                ? `Field Control · ${manifest.identity.username}`
                : "Loading workspace..."}
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {groups.map((group) => (
          <SidebarGroup
            key={group.key}
            className="py-2"
          >
            <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {group.label}
            </div>

            <SidebarMenu>
              {group.items.map(
                (item) => {
                  const active =
                    item.href ===
                    "/dashboard"
                      ? pathname ===
                        "/dashboard"
                      : pathname.startsWith(
                          item.href,
                        );

                  const Icon =
                    icons[item.icon] ??
                    Blocks;

                  return (
                    <SidebarMenuItem
                      key={item.key}
                    >
                      <SidebarMenuButton
                        asChild
                        className={
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : ""
                        }
                      >
                        <Link
                          href={item.href}
                        >
                          <Icon className="h-4 w-4" />
                          <span>
                            {item.label}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                },
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        <SidebarGroup className="mt-auto py-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <form
                action="/api/auth/logout"
                method="post"
                className="w-full"
              >
                <SidebarMenuButton
                  asChild
                >
                  <button
                    type="submit"
                    className="w-full"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>
                      Logout
                    </span>
                  </button>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
