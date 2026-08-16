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

  const searchRef =
    useRef<HTMLDivElement>(null);
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
        setFocused(true);
        inputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setFocused(false);
        inputRef.current?.blur();
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

  /*
   * Expected search-popover behavior:
   * clicking/tapping anywhere outside the search
   * control closes the results immediately.
   *
   * pointerdown covers mouse, touch and pen input.
   */
  useEffect(() => {
    function onPointerDown(
      event: PointerEvent,
    ) {
      const container =
        searchRef.current;
      const target =
        event.target as Node | null;

      if (
        !container ||
        !target ||
        container.contains(target)
      ) {
        return;
      }

      setFocused(false);
      inputRef.current?.blur();
    }

    document.addEventListener(
      "pointerdown",
      onPointerDown,
    );

    return () =>
      document.removeEventListener(
        "pointerdown",
        onPointerDown,
      );
  }, []);

  /*
   * A navigation should never leave the old
   * command/search state hanging over the next page.
   */
  useEffect(() => {
    setFocused(false);
    setQuery("");
  }, [pathname]);

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
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center border-b bg-background">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />

        <Separator
          orientation="vertical"
          className="h-5"
        />

        <div className="hidden min-w-36 text-sm font-medium md:block">
          {titleForPath(pathname)}
        </div>

        <div
          ref={searchRef}
          className="relative ml-auto w-full max-w-xl"
        >
          <div
            className={[
              "flex h-10 items-center gap-2 rounded-md border bg-background px-3",
              "transition-colors duration-150 ease-out",
              focused
                ? "border-primary ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                : "border-border",
            ].join(" ")}
          >
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
                  event.preventDefault();
                  go(
                    results[0].href,
                  );
                }
              }}
              placeholder="Search employees, actions, reports..."
              className="min-w-0 flex-1 bg-transparent text-sm leading-6 outline-none placeholder:text-muted-foreground"
            />

            <div className="hidden items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
              <Command className="h-3 w-3" />
              K
            </div>
          </div>

          {focused && (
            <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-md border bg-popover">
              {results.length ===
              0 ? (
                <div className="p-4 text-sm leading-6 text-muted-foreground">
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
                          /*
                           * Keep the input from losing focus
                           * before we process the result click.
                           */
                          event.preventDefault();
                          go(
                            item.href,
                          );
                        }}
                        className={[
                          "flex w-full items-center justify-between px-4 py-3 text-left text-sm",
                          "transition-colors duration-150 ease-out",
                          "hover:bg-muted focus:bg-muted focus:outline-none",
                        ].join(" ")}
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