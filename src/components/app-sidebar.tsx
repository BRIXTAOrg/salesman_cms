
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
  BarChart3,
  Blocks,
  Building2,
  CalendarCheck2,
  CalendarOff,
  ClipboardList,
  FileBarChart,
  Gauge,
  KeyRound,
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

type Props = {
  userRole: string;
  permissions: string[];
  jobRoles?: string[];
};

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{
    className?: string;
  }>;
  manageOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "Control",
    items: [
      {
        label: "Control Center",
        href: "/dashboard",
        icon: Gauge,
      },
    ],
  },
  {
    label: "Workforce",
    items: [
      {
        label: "Employees",
        href: "/dashboard/workforce/employees",
        icon: Users,
      },
      {
        label: "Organization",
        href: "/dashboard/workforce/organization",
        icon: Network,
      },
      {
        label: "Attendance",
        href: "/dashboard/slmAttendance",
        icon: CalendarCheck2,
      },
      {
        label: "Live Location",
        href: "/dashboard/slmGeotracking",
        icon: MapPinned,
      },
      {
        label: "Leave",
        href: "/dashboard/slmLeaves",
        icon: CalendarOff,
      },
      {
        label: "Devices",
        href: "/dashboard/workforce/devices",
        icon: Smartphone,
        manageOnly: true,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        label: "Responsibilities",
        href: "/dashboard/workspace/responsibilities",
        icon: Blocks,
        manageOnly: true,
      },
      {
        label: "Assignments",
        href: "/dashboard/workspace/assignments",
        icon: ClipboardList,
        manageOnly: true,
      },
      {
        label: "Approvals",
        href: "/dashboard/workspace/approvals",
        icon: BadgeCheck,
        manageOnly: true,
      },
    ],
  },
  {
    label: "Field Operations",
    items: [
      {
        label: "Journey Plans",
        href: "/dashboard/permanentJourneyPlan",
        icon: Route,
      },
      {
        label: "Dealers",
        href: "/dashboard/dealerManagement",
        icon: Store,
      },
      {
        label: "Distributors",
        href: "/dashboard/distributorManagement",
        icon: Warehouse,
      },
      {
        label: "Outlets",
        href: "/dashboard/outletManagement",
        icon: Store,
      },
      {
        label: "Institutions",
        href: "/dashboard/institutionManagement",
        icon: Landmark,
      },
      {
        label: "Influencers",
        href: "/dashboard/influencerManagement",
        icon: Building2,
      },
    ],
  },
  {
    label: "Money & Reports",
    items: [
      {
        label: "TA / DA",
        href: "/dashboard/tadaBill",
        icon: Receipt,
      },
      {
        label: "Operational Reports",
        href: "/dashboard/reports",
        icon: BarChart3,
      },
      {
        label: "Custom Reports",
        href: "/home/customReportGenerator",
        icon: FileBarChart,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Dashboard Access",
        href: "/dashboard/usersAndTeam",
        icon: UserRoundCog,
        manageOnly: true,
      },
      {
        label: "Setup",
        href: "/dashboard/administration/setup",
        icon: Settings2,
        manageOnly: true,
      },
    ],
  },
];

export function AppSidebar({
  permissions = [],
}: Props) {
  const pathname = usePathname();
  const [userName, setUserName] =
    useState("User");
  const [companyName, setCompanyName] =
    useState("Kamdhenu");

  const canManage =
    permissions.includes("ALL_ACCESS") ||
    permissions.includes("WRITE") ||
    permissions.includes("UPDATE");

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      try {
        const response = await fetch(
          "/api/me",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) return;

        const data = await response.json();

        if (!cancelled) {
          setCompanyName(
            data.companyName ||
              "Kamdhenu",
          );
          setUserName(
            data.username || "User",
          );
        }
      } catch {
        // Identity is decorative; navigation still works.
      }
    }

    void loadIdentity();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              !item.manageOnly ||
              canManage,
          ),
        }))
        .filter(
          (group) =>
            group.items.length > 0,
        ),
    [canManage],
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
              {companyName}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              Field Control · {userName}
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {visibleGroups.map(
          (group) => (
            <SidebarGroup
              key={group.label}
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
                      item.icon;

                    return (
                      <SidebarMenuItem
                        key={item.href}
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
                            href={
                              item.href
                            }
                          >
                            <Icon className="h-4 w-4" />
                            <span>
                              {
                                item.label
                              }
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  },
                )}
              </SidebarMenu>
            </SidebarGroup>
          ),
        )}

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
                    <span>Logout</span>
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
