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
import {
  Separator,
} from "@/components/ui/separator";
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

  return "Control Center";
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
    setFocused(false);
    setQuery("");
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
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center border-b bg-background">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-5" />

        <div className="hidden min-w-36 text-sm font-medium capitalize md:block">
          {titleForPath(pathname, actions)}
        </div>

        <div ref={searchRef} className="relative ml-auto w-full max-w-xl">
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
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Search this workspace..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="hidden items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:flex">
              <Command className="h-3 w-3" />K
            </div>
          </div>

          {focused && (
            <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-lg border bg-popover shadow-xl">
              {results.length === 0 ? (
                <div className="px-4 py-5 text-sm text-muted-foreground">
                  No available workspace destination matches this search.
                </div>
              ) : (
                <div className="p-2">
                  {results.map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => go(item.href)}
                      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted"
                    >
                      <Search className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{item.label}</div>
                        {item.description && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
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
      </div>
    </header>
  );
}
