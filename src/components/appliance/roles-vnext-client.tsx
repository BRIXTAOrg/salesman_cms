"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { apiJson } from "./client";
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

export default function RolesVNextClient() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await apiJson<{ roles: RoleRow[] }>("/api/platform/roles");
      setRoles(body.roles ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load Roles.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await apiJson("/api/platform/roles", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          grantedPerms: ["READ"],
        }),
      });
      setName("");
      setDescription("");
      setMessage("Role created.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create Role.",
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
      setMessage(
        error instanceof Error ? error.message : "Unable to rename Role.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: RoleRow) {
    if (!window.confirm(`Delete role "${role.label}"?`)) return;

    setSaving(true);
    try {
      await apiJson(`/api/platform/roles/${role.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete Role.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <Panel className="py-3">
          <div className="text-sm">{message}</div>
        </Panel>
      )}

      <Panel>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5" />
              Roles
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Roles are tenant data. Workflows and Responsibility access rules bind to stable Role IDs.
            </p>
          </div>
          <SecondaryButton type="button" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        </div>
      </Panel>

      <Panel>
        <form onSubmit={create} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="New role">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Senior Executive"
              required
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </Field>
          <div className="flex items-end">
            <PrimaryButton type="submit" disabled={saving}>
              <Plus className="h-4 w-4" />
              Add Role
            </PrimaryButton>
          </div>
        </form>
      </Panel>

      {loading ? (
        <div className="flex h-44 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : roles.length === 0 ? (
        <EmptyState
          title="No Roles"
          description="Create the first organization Role."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <Panel key={role.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{role.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Stable Role ID: {role.id}
                  </div>
                  {role.permDescription && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {role.permDescription}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(role)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <SecondaryButton
                type="button"
                className="mt-4 h-8"
                onClick={() => void rename(role)}
              >
                Rename
              </SecondaryButton>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
