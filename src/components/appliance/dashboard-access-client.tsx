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
  KeyRound,
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
  Notice,
  PageIntro,
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
  passwordUnchanged?: boolean;
  reason?: "enabled" | "reset";
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
  // BRIXTA_UI_V2: you can't switch off your own access from here.
  const [meId, setMeId] =
    useState<number | null>(null);

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
    apiJson<{ userId?: number }>("/api/me")
      .then((me) => setMeId(typeof me.userId === "number" ? me.userId : null))
      .catch(() => setMeId(null));
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
        // First-time access: a fresh password, shown exactly once.
        setCopied(false);
        setCloseHint(false);
        setCredentials({ ...body.credentials, reason: "enabled" });
      } else if (enabled) {
        // BRIXTA_PASSWORD_SECURITY_V1: re-enabled with their existing
        // password. Stored passwords are never shown again.
        toast.success(
          `${displayName}'s dashboard access restored. Their existing password still works — use Reset password if they forgot it.`,
        );
      } else {
        // Turning access off only flips isDashboardUser; the login stays
        // intact so access can be restored later.
        toast.success(`${displayName} can no longer sign in to the dashboard.`);
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

  async function resetPassword(user: DashboardUser) {
    const displayName = user.username ?? user.email;
    if (
      !window.confirm(
        `Create a new dashboard password for ${displayName}? Their current password will stop working.`,
      )
    ) {
      return;
    }

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
            resetDashboardPassword: true,
          }),
        },
      );

      if (body.credentials?.dashboardPassword) {
        setCopied(false);
        setCloseHint(false);
        setCredentials({ ...body.credentials, reason: "reset" });
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to reset the password.",
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
            {row.original.status === "active"
              ? "Active"
              : row.original.status
                ? row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)
                : "Unknown"}
          </Pill>
        ),
      },
      {
        id: "action",
        header: "Dashboard sign-in",
        cell: ({ row }) => {
          const user = row.original;
          const isPending = pendingUserId === user.id;
          const isMe = meId !== null && user.id === meId;

          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(user.isDashboardUser)}
                disabled={isPending || (isMe && Boolean(user.isDashboardUser))}
                aria-label={`Dashboard sign-in for ${user.username ?? user.email}`}
                title={isMe ? "You can't switch off your own access" : undefined}
                onCheckedChange={(checked) =>
                  void toggleAccess(user, checked)
                }
              />
              {isMe && (
                <span className="text-[12px] font-medium text-muted-foreground">You</span>
              )}
              {user.isDashboardUser && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void resetPassword(user)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  title="Create a new password"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset password
                </button>
              )}
              {isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingUserId, meId],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        title="Dashboard access"
        description="Turn on dashboard sign-in for anyone who manages work here. Field app logins aren't affected."
        action={
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        }
      />

      {message && (
        <Notice tone="danger" onDismiss={() => setMessage(null)}>
          {message}
        </Notice>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-[14px] border border-[#E1E4E0] bg-white" />
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
            <div className="flex items-center gap-2 rounded-[12px] border border-[#CFE2DC] bg-[#F0F7F4] px-3.5 py-2.5 text-[13.5px] text-[#1F4C45]">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {credentials.reason === "reset"
                ? "New password created. The old one no longer works."
                : "Dashboard sign-in is on."}
            </div>

            <div className="space-y-3 rounded-[12px] border border-[#E1E4E0] bg-[#F7F8F6] p-4">
              <div>
                <div className="text-[12.5px] font-medium text-muted-foreground">
                  Login ID
                </div>
                <div className="mt-1 font-mono text-[14px]">
                  {credentials.dashboardEmail}
                </div>
              </div>
              <div>
                <div className="text-[12.5px] font-medium text-muted-foreground">
                  Password
                </div>
                <div className="mt-1 font-mono text-[14px]">
                  {credentials.dashboardPassword}
                </div>
              </div>
            </div>

            {closeHint && !copied && (
              <div className="text-[13px] text-[#7A4F10]">
                Copy the credentials to close this window — they will not be
                shown again.
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void copyCredentials()}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#2F6B62] px-4 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-[#275A53]"
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