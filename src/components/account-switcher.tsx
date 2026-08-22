"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";

type Organization = {
  id: number;
  name: string;
  schemaName: string;
  isProvisioned: boolean;
  platformVersion?: number;
  registryStatus?: string;
};

export default function AccountSwitcher() {
  const [organizations, setOrganizations] =
    useState<Organization[]>([]);
  const [currentSchemaName, setCurrentSchemaName] =
    useState<string | null>(null);
  const [open, setOpen] =
    useState(false);
  const [switching, setSwitching] =
    useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          "/api/account/organizations",
          { cache: "no-store" },
        );

        if (!response.ok) return;
        const body = await response.json();

        if (!cancelled) {
          setOrganizations(
            Array.isArray(body.organizations)
              ? body.organizations
              : [],
          );
          setCurrentSchemaName(
            body.currentSchemaName ?? null,
          );
        }
      } catch {
        // Multi-company switching is additive. Header remains usable if unavailable.
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const current = useMemo(
    () =>
      organizations.find(
        (item) =>
          item.schemaName === currentSchemaName,
      ) ?? organizations[0] ?? null,
    [organizations, currentSchemaName],
  );

  if (organizations.length <= 1) {
    return current ? (
      <div className="hidden items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs lg:flex">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-40 truncate font-medium">
          {current.name}
        </span>
      </div>
    ) : null;
  }

  async function switchTo(
    organization: Organization,
  ) {
    if (
      organization.schemaName ===
      currentSchemaName
    ) {
      setOpen(false);
      return;
    }

    setSwitching(organization.id);

    try {
      const response = await fetch(
        "/api/account/switch",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            organizationId:
              organization.id,
          }),
        },
      );

      const body = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Unable to switch company.",
        );
      }

      window.location.assign(
        body.redirect ?? "/dashboard",
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to switch company.",
      );
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 max-w-56 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted/40"
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {current?.name ?? "Company"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-lg border bg-popover p-2 shadow-xl">
          <div className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Switch company
          </div>

          {organizations.map(
            (organization) => {
              const active =
                organization.schemaName ===
                currentSchemaName;

              return (
                <button
                  type="button"
                  key={organization.id}
                  disabled={
                    switching !== null ||
                    !organization.isProvisioned
                  }
                  onClick={() =>
                    void switchTo(organization)
                  }
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  {switching ===
                  organization.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : active ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  )}

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {organization.name}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {organization.schemaName}
                      {organization.platformVersion
                        ? ` · platform v${organization.platformVersion}`
                        : ""}
                    </div>
                  </div>
                </button>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
