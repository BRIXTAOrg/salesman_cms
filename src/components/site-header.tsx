
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  Command,
  Search,
} from "lucide-react";

import {
  Separator,
} from "@/components/ui/separator";
import {
  SidebarTrigger,
} from "@/components/ui/sidebar";

const actions = [
  {
    label: "Control Center",
    keywords:
      "home attention today dashboard",
    href: "/dashboard",
  },
  {
    label: "Employees",
    keywords:
      "people staff workforce add employee",
    href: "/dashboard/workforce/employees",
  },
  {
    label: "Organization",
    keywords:
      "department designation manager hierarchy",
    href: "/dashboard/workforce/organization",
  },
  {
    label: "Attendance",
    keywords: "check in present absent",
    href: "/dashboard/slmAttendance",
  },
  {
    label: "Live Location",
    keywords: "gps map tracking",
    href: "/dashboard/slmGeotracking",
  },
  {
    label: "Responsibilities",
    keywords:
      "capability mobile workspace form checklist",
    href: "/dashboard/workspace/responsibilities",
  },
  {
    label: "Assignments",
    keywords:
      "work items tasks journey work",
    href: "/dashboard/workspace/assignments",
  },
  {
    label: "Approvals",
    keywords:
      "approve reject waiting",
    href: "/dashboard/workspace/approvals",
  },
  {
    label: "Devices",
    keywords:
      "phone mobile sync revoke",
    href: "/dashboard/workforce/devices",
  },
  {
    label: "TA / DA",
    keywords: "expense travel claim",
    href: "/dashboard/tadaBill",
  },
  {
    label: "Reports",
    keywords: "analytics operational",
    href: "/dashboard/reports",
  },
  {
    label: "Dashboard Access",
    keywords:
      "admins users permissions access",
    href: "/dashboard/usersAndTeam",
  },
  {
    label: "Setup",
    keywords:
      "configuration health settings",
    href: "/dashboard/administration/setup",
  },
];

function titleForPath(pathname: string) {
  const exact =
    actions.find(
      (item) =>
        item.href === pathname,
    );

  if (exact) return exact.label;

  const partial = [...actions]
    .sort(
      (a, b) =>
        b.href.length -
        a.href.length,
    )
    .find((item) =>
      pathname.startsWith(
        item.href,
      ),
    );

  return partial?.label ??
    "Field Control";
}

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [query, setQuery] =
    useState("");
  const [focused, setFocused] =
    useState(false);

  useEffect(() => {
    function onKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        (event.metaKey ||
          event.ctrlKey) &&
        event.key.toLowerCase() ===
          "k"
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown,
      );
  }, []);

  const results = useMemo(() => {
    const needle =
      query.trim().toLowerCase();

    if (!needle) {
      return actions.slice(0, 6);
    }

    return actions.filter(
      (item) =>
        item.label
          .toLowerCase()
          .includes(needle) ||
        item.keywords.includes(needle),
    );
  }, [query]);

  function go(href: string) {
    setQuery("");
    setFocused(false);
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center border-b bg-background/95 backdrop-blur">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="h-5"
        />

        <div className="hidden min-w-36 text-sm font-medium md:block">
          {titleForPath(pathname)}
        </div>

        <div className="relative ml-auto w-full max-w-xl">
          <div className="flex h-10 items-center gap-2 rounded-xl border bg-muted/30 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              onFocus={() =>
                setFocused(true)
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  results[0]
                ) {
                  go(
                    results[0].href,
                  );
                }

                if (
                  event.key ===
                  "Escape"
                ) {
                  setFocused(false);
                  inputRef.current?.blur();
                }
              }}
              placeholder="Search employees, actions, reports..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="hidden items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
              <Command className="h-3 w-3" />
              K
            </div>
          </div>

          {focused && (
            <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-xl border bg-popover shadow-xl">
              {results.length ===
              0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No matching action.
                </div>
              ) : (
                results
                  .slice(0, 8)
                  .map(
                    (item) => (
                      <button
                        type="button"
                        key={
                          item.href
                        }
                        onMouseDown={(
                          event,
                        ) => {
                          event.preventDefault();
                          go(
                            item.href,
                          );
                        }}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted"
                      >
                        <span>
                          {
                            item.label
                          }
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Open
                        </span>
                      </button>
                    ),
                  )
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
