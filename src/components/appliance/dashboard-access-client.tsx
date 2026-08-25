"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { toast } from "sonner";

import { DataTableReusable } from "@/components/data-table-reusable";
import { Switch } from "@/components/ui/switch";
import {
  apiJson,
} from "./client";
import {
  Modal,
  PageIntro,
  Panel,
  Pill,
  SecondaryButton,
} from "./primitives";

type DashboardUser = {
  id: number;
  email: string;
  username?: string | null;
  phoneNumber?: string | null;
  zone?: string | null;
  area?: string | null;
  status?: string | null;
  isDashboardUser?: boolean;
  isSalesAppUser?: boolean;
  orgRole?: string | null;
  jobRole?: string[];
};

type Credentials = {
  dashboardEmail?: string;
  dashboardPassword?: string;
};

export default function DashboardAccessClient() {
  const [users, setUsers] =
    useState<DashboardUser[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [pendingUserId, setPendingUserId] =
    useState<number | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  const [credentials, setCredentials] =
    useState<Credentials | null>(null);
  const [copied, setCopied] =
    useState(false);
  const [closeHint, setCloseHint] =
    useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const userBody = await apiJson<{ users: DashboardUser[] }>(
        "/api/dashboardPagesAPI/users-and-team/users",
      );

      setUsers(userBody.users ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard access.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleAccess(
    user: DashboardUser,
    enabled: boolean,
  ) {
    setPendingUserId(user.id);
    setMessage(null);

    try {
      const body = await apiJson<{
        credentials?: Credentials;
      }>(
        `/api/dashboardPagesAPI/users-and-team/users/${user.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            isDashboardUser: enabled,
          }),
        },
      );

      const displayName = user.username ?? user.email;

      if (
        enabled &&
        body.credentials?.dashboardEmail &&
        body.credentials?.dashboardPassword
      ) {
        // Covers both first-time upgrades (freshly generated) and
        // re-enabling someone who already had a login (existing creds
        // handed back unchanged) -- either way there's something to
        // show and copy.
        setCopied(false);
        setCloseHint(false);
        setCredentials(body.credentials);
      } else if (!enabled) {
        // Turning access off never touches dashboardLoginId /
        // dashboardHashedPassword on the backend -- only the
        // isDashboardUser flag flips. Login credentials stay intact so
        // access can be restored later without regenerating anything.
        toast.success(`${displayName}'s dashboard access removed.`);
      }

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to change dashboard access.",
      );
    } finally {
      setPendingUserId(null);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;

    const text = `Login ID: ${credentials.dashboardEmail}\nPassword: ${credentials.dashboardPassword}`;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions).
      // The credentials remain visible on screen either way.
    }

    setCopied(true);
    // Give a beat to see the "Copied" confirmation before the modal
    // dismisses itself.
    window.setTimeout(() => {
      setCredentials(null);
    }, 600);
  }

  const columns = useMemo<ColumnDef<DashboardUser>[]>(
    () => [
      {
        accessorKey: "username",
        header: "Name",
        cell: ({ row }) => (
          <div className="font-medium">
            {row.original.username ?? row.original.email}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.email}
          </span>
        ),
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => {
          const label = [
            row.original.orgRole,
            ...(row.original.jobRole ?? []),
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <span className="text-muted-foreground">
              {label || "Role not configured"}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Pill tone={row.original.status === "active" ? "good" : "neutral"}>
            {row.original.status ?? "unknown"}
          </Pill>
        ),
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => {
          const user = row.original;
          const isPending = pendingUserId === user.id;

          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(user.isDashboardUser)}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  void toggleAccess(user, checked)
                }
              />
              {isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingUserId],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Administration"
        title="Dashboard Access"
        description="Dashboard authority is separate from Responsibilities. Toggle access on for anyone who needs to log into this dashboard."
        action={
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
      ) : (
        <DataTableReusable
          columns={columns}
          data={users}
        />
      )}

      <Modal
        open={Boolean(credentials)}
        title="Dashboard credentials"
        description="Copy these now and share through a secure channel."
        onClose={() => setCloseHint(true)}
        wide={false}
      >
        {credentials && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Dashboard access enabled.
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Login ID
                </div>
                <div className="mt-1 font-mono text-[14px]">
                  {credentials.dashboardEmail}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Password
                </div>
                <div className="mt-1 font-mono text-[14px]">
                  {credentials.dashboardPassword}
                </div>
              </div>
            </div>

            {closeHint && !copied && (
              <div className="text-[13px] text-amber-600 dark:text-amber-400">
                Copy the credentials to close this window — they will not be
                shown again.
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void copyCredentials()}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground transition-[transform,background-color] duration-150 ease-out hover:-translate-y-px active:translate-y-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy credentials
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}