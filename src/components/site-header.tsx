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

import type {
  WorkspaceManifest,
  WorkspaceNavItem,
} from "@/lib/workspace-types";
import AccountSwitcher from "@/components/account-switcher";
import {
  SidebarTrigger,
} from "@/components/ui/sidebar";

function titleForPath(
  pathname: string,
  items: WorkspaceNavItem[],
) {
  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact.label;

  const partial = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) =>
      item.href !== "/dashboard" &&
      pathname.startsWith(item.href),
    );

  if (partial) return partial.label;

  if (pathname.startsWith("/dashboard/work/")) {
    const key = decodeURIComponent(
      pathname.slice("/dashboard/work/".length),
    );
    return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return "Home";
}

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [manifest, setManifest] =
    useState<WorkspaceManifest | null>(null);
  const [query, setQuery] =
    useState("");
  const [focused, setFocused] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          "/api/workspace/manifest",
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled) {
          setManifest(body.manifest ?? null);
        }
      } catch {
        // Header remains usable even while the workspace feed is unavailable.
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const container = searchRef.current;
      const target = event.target as Node | null;

      if (!container || !target || container.contains(target)) {
        return;
      }

      setFocused(false);
      inputRef.current?.blur();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFocused(false);
      setQuery("");
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  const actions = useMemo(
    () => manifest?.navigation.flatMap((group) => group.items) ?? [],
    [manifest],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const candidates = actions.filter((item) => item.href !== pathname);

    if (!needle) {
      return candidates.slice(0, 7);
    }

    return candidates.filter((item) =>
      [
        item.label,
        item.key,
        item.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [actions, pathname, query]);

  function go(href: string) {
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <header className="brixta-site-header sticky top-0 z-30 flex shrink-0 items-center">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 text-muted-foreground" />

        <div className="hidden min-w-0 truncate text-[14px] font-semibold md:block">
          {titleForPath(pathname, actions)}
        </div>

        <div ref={searchRef} className="relative ml-auto w-full max-w-md">
          <div
            className={[
              "flex h-9 items-center gap-2 rounded-[10px] border bg-white px-3 transition-[border-color,box-shadow] duration-150",
              focused ? "border-primary shadow-[0_0_0_3px_rgba(47,107,98,0.15)]" : "border-border",
            ].join(" ")}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) go(results[0].href);
              }}
              placeholder="Jump to a page or responsibility"
              aria-label="Search pages"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden items-center gap-0.5 rounded-md border bg-[#F6F7F5] px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:flex">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>

          {focused && (
            <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-[12px] border bg-popover shadow-[0_12px_32px_rgba(29,35,33,0.12)]">
              {results.length === 0 ? (
                <div className="px-4 py-4 text-[13.5px] text-muted-foreground">
                  Nothing matches “{query}”.
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto p-1.5">
                  {results.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => go(item.href)}
                      className="flex w-full items-start gap-3 rounded-[8px] px-3 py-2 text-left hover:bg-[#F1F3F0]"
                    >
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium">{item.label}</div>
                        {item.description && (
                          <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <AccountSwitcher />
      </div>
    </header>
  );
}
