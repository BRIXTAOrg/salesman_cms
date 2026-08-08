// src/components/app-sidebar.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';

interface Props {
  userRole: string; 
  permissions: string[]; 
  jobRoles?: string[]; 
}

interface MenuItem {
  title: string;
  url?: string;
  requiredPerm?: string | string[] | 'public' | 'logout';
  requiredJobRole?: string[]; 
  items?: MenuItem[];
  newTab?: boolean;
}

// Define menu items with the new nested structure
const menuItems: MenuItem[] = [
  {
    title: "Home",
    url: "/home",
    requiredPerm: 'public',
    items: [
      {
        title: "Custom Report Generator",
        url: "/home/customReportGenerator",
      },
    ],
  },
  {
    title: "Business Dashboard",
    url: "/dashboard",
    requiredPerm: 'public',
    items: [
      {
        title: "Users & Team",
        url: "/dashboard/usersAndTeam",
        requiredJobRole: ['Admin']
      },
      // {
      //   title: "Dealers",
      //   url: "/dashboard/dealerManagement",
      //   requiredPerm: ['READ', 'WRITE', 'UPDATE']
      // },
      {
        title: "Distributors",
        url: "/dashboard/distributorManagement",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Outlets",
        url: "/dashboard/outletManagement",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Institution",
        url: "/dashboard/institutionManagement",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Influencers",
        url: "/dashboard/influencerManagement",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Reports",
        url: "/dashboard/reports",
      },
      {
        title: "PJPs", 
        url: "/dashboard/permanentJourneyPlan",
      },
      {
        title: "TA/DA", 
        url: "/dashboard/tadaBill",
      },
      {
        title: "Salesman Geotracking",
        url: "/dashboard/slmGeotracking",
      },
      {
        title: "Salesman Leaves",
        url: "/dashboard/slmLeaves",
      },
      {
        title: "Salesman Attendance",
        url: "/dashboard/slmAttendance",
      },
    ],
  },
  {
    title: "Account",
    url: "/account",
    requiredPerm: 'public',
    items: [
      {
        title: "Logout",
        url: "/api/auth/logout",
        requiredPerm: 'logout'
      },
    ],
  },
]

export function AppSidebar({ userRole, permissions = [], jobRoles = [] }: Props) {

  const [userName, setUserName] = useState<string>("Loading...");
  const [companyName, setCompanyName] = useState<string>("Loading...");

  // Fetch data directly on mount
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const response = await fetch('/api/me', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          // Since it's single tenant, you can hardcode the fallback to your actual brand name
          setCompanyName(data.companyName || "Kamdhenu"); 
          
          // --- THIS IS THE FIX ---
          // Use data.username directly instead of combining firstName/lastName
          setUserName(data.username || "User Name");
        } else {
          setCompanyName("Session Expired");
          setUserName("");
        }
      } catch (error) {
        console.error("Failed to fetch sidebar info:", error);
        setCompanyName("Error");
        setUserName("");
      }
    };

    fetchSidebarData();
  }, []);

  // Filter based on the 'permissions' array from the DB
  const filterItems = useCallback((items: MenuItem[]): MenuItem[] => {
    if (!permissions) return [];

    const isAdmin = permissions.includes('ALL_ACCESS');

    return items.reduce((acc, item) => {
      const { requiredPerm, requiredJobRole } = item;

      // 1. JOB ROLE CHECK
      if (requiredJobRole && requiredJobRole.length > 0) {
        // If user doesn't have ANY of the required job roles AND isn't an Admin, hide it
        const hasRequiredRole = requiredJobRole.some(role => jobRoles.includes(role));
        if (!hasRequiredRole && !isAdmin) {
          return acc;
        }
      }

      // 2. PERMISSIONS CHECK
      if (!requiredPerm || requiredPerm === 'public' || requiredPerm === 'logout') {
        acc.push(item.items ? { ...item, items: filterItems(item.items) } : item);
        return acc;
      }

      // Handle Multiple Permissions (Check if user has ALL)
      const requiredArray = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
      const hasAllAccess = requiredArray.some(p => permissions.includes(p) || isAdmin);

      if (hasAllAccess) {
        if (item.items) {
          acc.push({ ...item, items: filterItems(item.items) });
        } else {
          acc.push(item);
        }
      }

      return acc;
    }, [] as MenuItem[]);
  }, [permissions, jobRoles]); // Re-run if permissions change

  const accessibleMenuItems = useMemo(() => filterItems(menuItems), [filterItems]);

  return (
    <Sidebar className="hidden md:flex w-64 shrink-0 border-r">
      <SidebarContent>
        <SidebarHeader>
          <div className="flex items-center space-x-2">
            <Image
              src="/logo.webp"
              alt={companyName}
              width={32}
              height={32}
              className="rounded-lg object-cover"
            />
            <div>
              <div className="text-sm font-bold">{companyName}</div>
              <div className="text-xs text-gray-500">{userName}</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarGroup>
          <SidebarMenu>
            {accessibleMenuItems.map((item: MenuItem) => {
              if (item.items && item.items.length > 0) { 
                return (
                  <SidebarMenuItem key={item.title}>
                    {item.url ? (
                      <SidebarMenuButton asChild>
                        <a
                          href={item.url}
                          className="py-6.5 my-2 flex items-center gap-2"
                          target={item.newTab ? "_blank" : undefined}
                          rel={item.newTab ? "noopener noreferrer" : undefined}
                        >
                          {item.title}
                          {item.newTab && <ExternalLink className="w-3 h-3 text-white!" />}
                        </a>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton>{item.title}</SidebarMenuButton>
                    )}
                    <SidebarMenuSub>
                      {item.items.map((subItem: MenuItem) => {
                        if (subItem.items) {
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              {subItem.url ? (
                                <SidebarMenuSubButton asChild>
                                  <a
                                    href={subItem.url}
                                    className="py-4 my-1 flex items-center gap-2"
                                    target={subItem.newTab ? "_blank" : undefined}
                                    rel={subItem.newTab ? "noopener noreferrer" : undefined}
                                  >
                                    {subItem.title}
                                    {subItem.newTab && <ExternalLink className="w-3 h-3 text-white!" />}
                                  </a>
                                </SidebarMenuSubButton>
                              ) : (
                                <SidebarMenuSubButton>{subItem.title}</SidebarMenuSubButton>
                              )}
                              <SidebarMenuSub>
                                {subItem.items.map((subSubItem: MenuItem) => (
                                  <SidebarMenuSubItem key={subSubItem.title}>
                                    <SidebarMenuSubButton asChild>
                                      <a
                                        href={subSubItem.url}
                                        className="py-6.5 my-2 flex items-center gap-2"
                                        target={subSubItem.newTab ? "_blank" : undefined}
                                        rel={subSubItem.newTab ? "noopener noreferrer" : undefined}
                                      >
                                        {subSubItem.title}
                                        {subItem.newTab && <ExternalLink className="w-3 h-3 text-white!" />}
                                      </a>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </SidebarMenuSubItem>
                          );
                        } else {
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              {subItem.title === "Logout" ? (
                                <form action="/api/auth/logout" method="post" className="w-full">
                                  <SidebarMenuSubButton asChild>
                                    <button
                                      type="submit"
                                      className="w-full h-full justify-start items-center px-4 py-3 my-1 rounded-md bg-red-600/65 text-white"
                                    >
                                      {subItem.title}
                                    </button>
                                  </SidebarMenuSubButton>
                                </form>
                              ) : (
                                <SidebarMenuSubButton asChild>
                                  <a
                                    href={subItem.url}
                                    className="py-4 my-1 flex items-center gap-2"
                                    target={subItem.newTab ? "_blank" : undefined}
                                    rel={subItem.newTab ? "noopener noreferrer" : undefined}
                                  >
                                    {subItem.title}
                                    {subItem.newTab && <ExternalLink className="w-3 h-3 text-white!" />}
                                  </a>
                                </SidebarMenuSubButton>
                              )}
                            </SidebarMenuSubItem>
                          );
                        }
                      })}
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                );
              } else if (item.url) { 
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a
                        href={item.url}
                        className="py-3 my-1"
                        target={item.newTab ? "_blank" : undefined}
                        rel={item.newTab ? "noopener noreferrer" : undefined}
                      >
                        {item.title}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }
              return null; 
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}