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

import { useCompanySwitch } from "@/components/company-switch-dialog";

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
  // BRIXTA_COMPANY_SWITCH_PROOF_V1
  const {
    switchTo: requestCompanySwitch,
    switchingId: switching,
    dialog: passwordDialog,
  } = useCompanySwitch({
    onSwitched: (redirect) => window.location.assign(redirect),
  });

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
      <div className="hidden h-9 items-center gap-2 rounded-[10px] border bg-white px-3 text-[13px] lg:flex">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-40 truncate font-medium">
          {current.name}
        </span>
      </div>
    ) : null;
  }

  function switchTo(
    organization: Organization,
  ) {
    if (
      organization.schemaName ===
      currentSchemaName
    ) {
      setOpen(false);
      return;
    }

    void requestCompanySwitch({
      id: organization.id,
      name: organization.name,
    });
  }

  return (
    <div className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 max-w-56 items-center gap-2 rounded-[10px] border bg-white px-3 text-[13px] hover:bg-[#F6F7F5]"
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {current?.name ?? "Company"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-[12px] border bg-popover p-1.5 shadow-[0_12px_32px_rgba(29,35,33,0.12)]">
          <div className="px-2.5 pb-1.5 pt-1 text-[12px] font-medium text-muted-foreground">
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
                    switchTo(organization)
                  }
                  className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left hover:bg-[#F1F3F0] disabled:opacity-50"
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
                    <div className="truncate text-[12px] text-muted-foreground">
                      Company code {organization.schemaName}
                    </div>
                  </div>
                </button>
              );
            },
          )}
        </div>
      )}

      {passwordDialog}
    </div>
  );
}
