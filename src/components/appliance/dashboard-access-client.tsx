"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

import type {
  Role,
} from "@/lib/appliance-types";
import {
  apiJson,
} from "./client";
import {
  EmptyState,
  Field,
  inputClass,
  Modal,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
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

export default function DashboardAccessClient() {
  const [users, setUsers] =
    useState<DashboardUser[]>([]);
  const [roles, setRoles] =
    useState<Role[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [showCreate, setShowCreate] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [credentials, setCredentials] =
    useState<{
      dashboardEmail?: string;
      dashboardPassword?: string;
    } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [userBody, roleBody] = await Promise.all([
        apiJson<{ users: DashboardUser[] }>(
          "/api/dashboardPagesAPI/users-and-team/users",
        ),
        apiJson<{ roles: Role[] }>(
          "/api/appliance/roles",
        ),
      ]);

      setUsers(userBody.users ?? []);
      setRoles(roleBody.roles ?? []);
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

  const dashboardUsers = useMemo(
    () => users.filter((user) => user.isDashboardUser),
    [users],
  );

  const availablePeople = useMemo(
    () => users.filter((user) => !user.isDashboardUser),
    [users],
  );

  async function createAdmin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setCredentials(null);

    const data = new FormData(event.currentTarget);
    const roleId = Number(data.get("roleId"));
    const selectedRole = roles.find((role) => role.id === roleId);

    if (!selectedRole) {
      setSaving(false);
      setMessage("Choose an authority Role.");
      return;
    }

    try {
      const body = await apiJson<{
        credentials?: {
          dashboardEmail?: string;
          dashboardPassword?: string;
        };
      }>(
        "/api/dashboardPagesAPI/users-and-team/users",
        {
          method: "POST",
          body: JSON.stringify({
            email: String(data.get("email") ?? "").trim(),
            username: String(data.get("username") ?? "").trim(),
            phoneNumber: String(data.get("phoneNumber") ?? "").trim() || null,
            orgRole: selectedRole.orgRole ?? null,
            jobRole: selectedRole.jobRole ? [selectedRole.jobRole] : [],
            zone: String(data.get("zone") ?? "").trim() || null,
            area: String(data.get("area") ?? "").trim() || null,
            isDashboardUser: true,
            isSalesAppUser: false,
          }),
        },
      );

      setCredentials(body.credentials ?? null);
      setShowCreate(false);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to add dashboard user.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccess(
    user: DashboardUser,
    enabled: boolean,
  ) {
    setSaving(true);
    setCredentials(null);

    try {
      const body = await apiJson<{
        credentials?: {
          dashboardEmail?: string;
          dashboardPassword?: string;
        };
      }>(
        `/api/dashboardPagesAPI/users-and-team/users/${user.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            isDashboardUser: enabled,
          }),
        },
      );

      setCredentials(body.credentials ?? null);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to change dashboard access.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Administration"
        title="Dashboard Access"
        description="Dashboard authority is separate from Responsibilities. Roles are loaded from the tenant Role registry instead of a sales-specific list."
        action={
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() => setShowCreate(true)}
              disabled={roles.length === 0}
            >
              <Plus className="h-4 w-4" />
              Add dashboard user
            </PrimaryButton>
          </div>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      {credentials && (
        <Panel className="border-amber-500/30 bg-amber-500/5">
          <div className="font-semibold">Temporary credentials</div>
          <div className="mt-2 text-sm">
            Email: <strong>{credentials.dashboardEmail ?? "—"}</strong>
          </div>
          {credentials.dashboardPassword && (
            <div className="mt-1 text-sm">
              Password: <strong>{credentials.dashboardPassword}</strong>
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            Store and share credentials through an appropriate secure channel.
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
      ) : dashboardUsers.length === 0 ? (
        <EmptyState
          title="No additional dashboard users"
          description="The original administrator can operate the control plane alone."
        />
      ) : (
        <div className="space-y-3">
          {dashboardUsers.map((user) => (
            <Panel key={user.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{user.username ?? user.email}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {user.email} · {[user.orgRole, ...(user.jobRole ?? [])].filter(Boolean).join(" · ") || "Role not configured"}
                  </div>
                </div>
                <Pill tone={user.status === "active" ? "good" : "neutral"}>
                  {user.status ?? "unknown"}
                </Pill>
                <SecondaryButton
                  type="button"
                  disabled={saving}
                  onClick={() => void toggleAccess(user, false)}
                >
                  <ShieldOff className="h-4 w-4" />
                  Remove access
                </SecondaryButton>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {availablePeople.length > 0 && (
        <Panel>
          <div className="font-semibold">Existing people without dashboard access</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {availablePeople.slice(0, 20).map((user) => (
              <Pill key={user.id}>{user.username ?? user.email}</Pill>
            ))}
          </div>
        </Panel>
      )}

      <Modal
        open={showCreate}
        title="Add dashboard user"
        description="Choose a live tenant Role. Responsibilities remain a separate assignment concern."
        onClose={() => setShowCreate(false)}
        wide
      >
        <form onSubmit={createAdmin} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <input name="username" required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required className={inputClass} />
            </Field>
            <Field label="Authority Role">
              <select name="roleId" required className={inputClass} defaultValue="">
                <option value="">Choose Role...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input name="phoneNumber" className={inputClass} />
            </Field>
            <Field label="Area">
              <input name="area" className={inputClass} />
            </Field>
            <Field label="Zone">
              <input name="zone" className={inputClass} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create access
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
