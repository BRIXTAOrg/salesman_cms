
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Users,
} from "lucide-react";

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

const orgRoles = [
  "Admin",
  "Manager",
  "Assistant-Manager",
  "junior-executive",
  "executive",
  "senior-executive",
  "area-manager",
  "senior-area-manager",
  "deputy-manager",
  "regional-manager",
  "senior-regional-manager",
  "assistant-general-manager",
  "deputy-general-manager",
  "general-manager",
  "senior-general-manager",
  "president",
  "vice-president",
  "director",
  "chief-managing-director",
];

const jobRoles = [
  "Admin",
  "Manager",
  "Assistant-Manager",
  "Sales-Marketing",
  "Finance",
  "Accounts",
  "Reports-MIS",
  "Logistics",
  "Human-Resources",
  "Factory-Operations",
];

export default function DashboardAccessClient() {
  const [users, setUsers] =
    useState<DashboardUser[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [showCreate, setShowCreate] =
    useState(false);
  const [saving, setSaving] =
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

    try {
      const body =
        await apiJson<{
          users: DashboardUser[];
        }>(
          "/api/dashboardPagesAPI/users-and-team/users",
        );

      setUsers(body.users ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard users.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dashboardUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.isDashboardUser,
      ),
    [users],
  );

  const availablePeople = useMemo(
    () =>
      users.filter(
        (user) =>
          !user.isDashboardUser,
      ),
    [users],
  );

  async function createAdmin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setCredentials(null);

    const data = new FormData(
      event.currentTarget,
    );

    try {
      const body =
        await apiJson<{
          credentials?: {
            dashboardEmail?: string;
            dashboardPassword?: string;
          };
        }>(
          "/api/dashboardPagesAPI/users-and-team/users",
          {
            method: "POST",
            body: JSON.stringify({
              email: String(
                data.get("email") ??
                  "",
              ).trim(),
              username: String(
                data.get(
                  "username",
                ) ?? "",
              ).trim(),
              phoneNumber:
                String(
                  data.get(
                    "phoneNumber",
                  ) ?? "",
                ).trim() || null,
              orgRole: String(
                data.get("orgRole") ??
                  "Admin",
              ),
              jobRole: [
                String(
                  data.get(
                    "jobRole",
                  ) ?? "Admin",
                ),
              ],
              zone:
                String(
                  data.get("zone") ??
                    "",
                ).trim() || null,
              area:
                String(
                  data.get("area") ??
                    "",
                ).trim() || null,
              isDashboardUser: true,
              isSalesAppUser: false,
            }),
          },
        );

      setCredentials(
        body.credentials ?? null,
      );
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
      const body =
        await apiJson<{
          credentials?: {
            dashboardEmail?: string;
            dashboardPassword?: string;
          };
        }>(
          `/api/dashboardPagesAPI/users-and-team/users/${user.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              isDashboardUser:
                enabled,
            }),
          },
        );

      setCredentials(
        body.credentials ?? null,
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to change access.",
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
        description="One admin can run everything. Add more people only when the organization needs to divide responsibility."
        action={
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              onClick={() =>
                void load()
              }
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={() =>
                setShowCreate(true)
              }
            >
              <Plus className="h-4 w-4" />
              Add dashboard user
            </PrimaryButton>
          </div>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      {credentials &&
        (credentials.dashboardEmail ||
          credentials.dashboardPassword) && (
          <Panel className="border-emerald-500/30 bg-emerald-500/5">
            <div className="flex gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <div className="font-medium">
                  Login credentials
                </div>
                <div className="mt-2 text-sm">
                  <div>
                    Email:{" "}
                    <strong>
                      {credentials.dashboardEmail ??
                        "—"}
                    </strong>
                  </div>
                  <div>
                    Password:{" "}
                    <strong>
                      {credentials.dashboardPassword ??
                        "unchanged"}
                    </strong>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Copy these now and share them securely.
                </div>
              </div>
            </div>
          </Panel>
        )}

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5" />
              Active dashboard users
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              These people can sign in to the control dashboard according to their existing role permissions.
            </div>
          </div>
          <Pill tone="info">
            {dashboardUsers.length} active
          </Pill>
        </div>

        {loading ? (
          <div className="flex h-52 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : dashboardUsers.length ===
          0 ? (
          <EmptyState
            title="No dashboard users found"
            description="Add the first administrator."
          />
        ) : (
          <div className="divide-y">
            {dashboardUsers.map(
              (user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Users className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {user.username ??
                        user.email}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {user.email}
                      {" · "}
                      {user.orgRole ??
                        "Unassigned"}
                      {user.jobRole?.length
                        ? ` · ${user.jobRole.join(
                            ", ",
                          )}`
                        : ""}
                    </div>
                  </div>

                  <Pill
                    tone={
                      user.status ===
                      "active"
                        ? "good"
                        : "neutral"
                    }
                  >
                    {user.status ??
                      "active"}
                  </Pill>

                  <SecondaryButton
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void toggleAccess(
                        user,
                        false,
                      )
                    }
                  >
                    <ShieldOff className="h-4 w-4" />
                    Remove access
                  </SecondaryButton>
                </div>
              ),
            )}
          </div>
        )}
      </Panel>

      {availablePeople.length > 0 && (
        <Panel>
          <div className="mb-3 font-semibold">
            Existing people without dashboard access
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {availablePeople
              .slice(0, 12)
              .map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {user.username ??
                        user.email}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                  <SecondaryButton
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void toggleAccess(
                        user,
                        true,
                      )
                    }
                    className="h-9"
                  >
                    Give access
                  </SecondaryButton>
                </div>
              ))}
          </div>
        </Panel>
      )}

      <Modal
        open={showCreate}
        title="Add dashboard user"
        description="Start simple. You can add specialists later; a single admin can still run the system."
        onClose={() =>
          setShowCreate(false)
        }
        wide
      >
        <form
          onSubmit={createAdmin}
          className="space-y-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <input
                name="username"
                required
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                required
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                name="phoneNumber"
                className={inputClass}
              />
            </Field>
            <Field label="Organization role">
              <select
                name="orgRole"
                defaultValue="Admin"
                className={inputClass}
              >
                {orgRoles.map(
                  (role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {role}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Work area">
              <select
                name="jobRole"
                defaultValue="Admin"
                className={inputClass}
              >
                {jobRoles.map(
                  (role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {role}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Area">
              <input
                name="area"
                className={inputClass}
              />
            </Field>
            <Field label="Zone">
              <input
                name="zone"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <SecondaryButton
              type="button"
              onClick={() =>
                setShowCreate(false)
              }
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              disabled={saving}
            >
              Add dashboard user
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
