"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";

import type {
  RoleCapabilityKey,
  RoleContextDefinition,
} from "@/lib/roles/role-context-types";
import { BASE_ROLE_CAPABILITIES } from "@/lib/roles/role-context-types";
import { BUILDER_CAPABILITY_CATALOG } from "@/lib/roles/builder-capability-catalog";

import { apiJson, cx } from "./client";
import {
  EmptyState,
  Field,
  inputClass,
  Panel,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

type RoleRow = {
  id: number;
  orgRole?: string | null;
  jobRole?: string | null;
  grantedPerms?: string[];
  permDescription?: string | null;
  label: string;
};

type Tab = "basics" | "capabilities";

export default function RolesVNextClient() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [context, setContext] = useState<RoleContextDefinition | null>(null);
  const [tab, setTab] = useState<Tab>("basics");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => roles.find((item) => item.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await apiJson<{ roles: RoleRow[] }>("/api/platform/roles");
      const next = body.roles ?? [];
      setRoles(next);
      setSelectedRoleId((current) =>
        current && next.some((item) => item.id === current)
          ? current
          : next[0]?.id ?? null,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContext = useCallback(async (roleId: number) => {
    setContextLoading(true);
    try {
      const body = await apiJson<{ definition: RoleContextDefinition }>(
        `/api/platform/roles/${roleId}/context`,
      );
      setContext(body.definition);
    } catch (error) {
      setContext(null);
      setMessage(
        error instanceof Error ? error.message : "Unable to load Role Context.",
      );
    } finally {
      setContextLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedRoleId) void loadContext(selectedRoleId);
  }, [selectedRoleId, loadContext]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const body = await apiJson<{ role: RoleRow }>("/api/platform/roles", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          grantedPerms: ["READ"],
        }),
      });
      setName("");
      setDescription("");
      await load();
      if (body.role?.id) setSelectedRoleId(body.role.id);
      setMessage("Role created. Now define how this Role works.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create Role.");
    } finally {
      setSaving(false);
    }
  }

  async function saveContext() {
    if (!selectedRoleId || !context) return;
    setSaving(true);
    try {
      const body = await apiJson<{ definition: RoleContextDefinition; message?: string }>(
        `/api/platform/roles/${selectedRoleId}/context`,
        {
          method: "PUT",
          body: JSON.stringify({ definition: context }),
        },
      );
      setContext(body.definition);
      setMessage(body.message ?? "Role Context saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save Role Context.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rename(role: RoleRow) {
    const next = window.prompt("Role name", role.label)?.trim();
    if (!next || next === role.label) return;

    setSaving(true);
    try {
      await apiJson(`/api/platform/roles/${role.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: next }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to rename Role.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: RoleRow) {
    if (!window.confirm(`Delete role "${role.label}"?`)) return;

    setSaving(true);
    try {
      await apiJson(`/api/platform/roles/${role.id}`, { method: "DELETE" });
      setContext(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete Role.");
    } finally {
      setSaving(false);
    }
  }



  function toggleCapability(key: RoleCapabilityKey) {
    if (!context) return;
    const has = context.capabilities.includes(key);
    setContext({
      ...context,
      capabilities: has
        ? context.capabilities.filter((item) => item !== key)
        : [...context.capabilities, key],
    });
  }



  return (
    <div className="min-w-0 space-y-4">
      {message && (
        <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Roles
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Reusable capability profiles. Reporting hierarchy lives on Employees.
                </div>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cx(
                    "w-full rounded-lg border p-3 text-left transition hover:bg-muted/30",
                    selectedRoleId === role.id &&
                      "border-primary bg-primary/[0.05] ring-1 ring-primary/20",
                  )}
                >
                  <div className="font-medium">{role.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Role ID {role.id}
                  </div>
                </button>
              ))}
              {!loading && roles.length === 0 && (
                <EmptyState
                  title="No Roles"
                  description="Create the first Role below."
                />
              )}
            </div>
          </Panel>

          <Panel>
            <form onSubmit={create} className="space-y-3">
              <Field label="New Role">
                <input
                  className={inputClass}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Junior Executive"
                  required
                />
              </Field>
              <Field label="Description">
                <input
                  className={inputClass}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <PrimaryButton type="submit" disabled={saving}>
                <Plus className="h-4 w-4" />
                Add Role
              </PrimaryButton>
            </form>
          </Panel>
        </div>

        <div className="min-w-0">
          {!selectedRole ? (
            <EmptyState
              title="Choose a Role"
              description="Select a Role to define its reusable builder capabilities."
            />
          ) : contextLoading || !context ? (
            <div className="flex h-64 items-center justify-center rounded-lg border">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <Panel>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xl font-semibold">
                      {selectedRole.label}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Employee hierarchy and reporting are configured on Employees.
                      Responsibilities consume that organization context at runtime.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <SecondaryButton
                      type="button"
                      onClick={() => void rename(selectedRole)}
                    >
                      Rename
                    </SecondaryButton>
                    <button
                      type="button"
                      onClick={() => void remove(selectedRole)}
                      className="rounded-md border p-2 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <PrimaryButton
                      type="button"
                      disabled={saving}
                      onClick={() => void saveContext()}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Role
                    </PrimaryButton>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(
                    [
                      ["basics", "Basics", ShieldCheck],
                      ["capabilities", "App Builder", Wrench],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={cx(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                        tab === key &&
                          "border-primary bg-primary/[0.05] text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </Panel>

              {tab === "basics" && (
                <Panel>
                  <div className="font-semibold">Role contract</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Role ID {context.roleId}. The Role name remains normal tenant
                    data; the sections beside this one define reusable behavior.
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Capabilities</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {context.capabilities.length}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Legacy routes</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {context.workflows.filter((item) => item.enabled).length}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Visibility rules</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {context.visibility.filter((item) => item.enabled).length}
                      </div>
                    </div>
                  </div>
                </Panel>
              )}

              {tab === "capabilities" && (
                <Panel>
                  <div className="font-semibold">What can be built for this Role?</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    These become the role-aware App Builder palette. They are the
                    user-facing replacement for a separate “Possibilities” editor.
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {BUILDER_CAPABILITY_CATALOG.map((capability) => {
                      const checked = context.capabilities.includes(capability.key);
                      return (
                        <button
                          key={capability.key}
                          type="button"
                          onClick={() => toggleCapability(capability.key)}
                          className={cx(
                            "rounded-lg border p-3 text-left transition hover:bg-muted/30",
                            checked &&
                              "border-primary bg-primary/[0.04] ring-1 ring-primary/20",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium">{capability.label}</div>
                            {checked && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {capability.description}
                          </div>
                          <div className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {capability.group}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        setContext({
                          ...context,
                          capabilities: [...BASE_ROLE_CAPABILITIES],
                        })
                      }
                    >
                      Reset to basic field role
                    </SecondaryButton>
                  </div>
                </Panel>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
