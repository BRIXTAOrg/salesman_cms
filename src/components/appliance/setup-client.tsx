
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import type {
  SetupHealth,
  WorkspaceSetting,
} from "@/lib/appliance-types";
import {
  apiJson,
} from "./client";
import {
  EmptyState,
  PageIntro,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
} from "./primitives";

function valueFor(
  settings: WorkspaceSetting[],
  key: string,
) {
  return settings.find(
    (setting) =>
      setting.key === key,
  )?.value;
}

export default function SetupClient() {
  const [health, setHealth] =
    useState<SetupHealth | null>(
      null,
    );
  const [settings, setSettings] =
    useState<WorkspaceSetting[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [
        healthBody,
        settingsBody,
      ] = await Promise.all([
        apiJson<{
          health: SetupHealth;
        }>("/api/appliance/setup-health"),
        apiJson<{
          settings: WorkspaceSetting[];
        }>("/api/appliance/settings"),
      ]);

      setHealth(healthBody.health);
      setSettings(
        settingsBody.settings ?? [],
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load setup.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const adaptiveHome =
    valueFor(
      settings,
      "adaptive_home",
    ) !== false;

  const devicePolicy =
    (valueFor(
      settings,
      "device_policy",
    ) as
      | {
          oneActiveDevice?: boolean;
        }
      | undefined) ?? {};

  const offlinePolicy =
    (valueFor(
      settings,
      "offline_policy",
    ) as
      | {
          allowCachedLogin?: boolean;
        }
      | undefined) ?? {};

  async function saveSetting(
    key: string,
    value: unknown,
  ) {
    setSaving(true);

    try {
      await apiJson(
        `/api/appliance/settings/${encodeURIComponent(
          key,
        )}`,
        {
          method: "PUT",
          body: JSON.stringify({
            value,
          }),
        },
      );

      setMessage("Setting saved.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save setting.",
      );
    } finally {
      setSaving(false);
    }
  }

  const warningCount = useMemo(
    () =>
      health?.checks.filter(
        (check) =>
          check.status ===
          "warning",
      ).length ?? 0,
    [health],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Administration"
        title="Setup"
        description="The appliance should tell you what is missing instead of making you hunt through configuration screens."
        action={
          <SecondaryButton
            type="button"
            onClick={() =>
              void load()
            }
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        }
      />

      {message && (
        <Panel className="py-3">
          <div className="text-sm">
            {message}
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border bg-muted/30" />
      ) : !health ? (
        <EmptyState
          title="Setup health unavailable"
          description="Check the backend connection and database migration."
        />
      ) : (
        <>
          <Panel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <ShieldCheck className="h-5 w-5" />
                  Setup health
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Basic use should work even with one admin, one employee and no formal hierarchy.
                </div>
              </div>
              <Pill
                tone={
                  health.ready
                    ? "good"
                    : "warning"
                }
              >
                {health.ready
                  ? "Ready"
                  : `${warningCount} item${
                      warningCount === 1
                        ? ""
                        : "s"
                    } need attention`}
              </Pill>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {health.checks.map(
                (check) => (
                  <div
                    key={
                      check.key
                    }
                    className="flex items-start gap-3 rounded-xl border p-4"
                  >
                    {check.status ===
                    "good" ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                    )}
                    <div className="text-sm">
                      {
                        check.label
                      }
                    </div>
                  </div>
                ),
              )}
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Settings2 className="h-5 w-5" />
                Experience
              </div>

              <div className="space-y-3">
                <SettingRow
                  title="Adaptive home"
                  description="Frequently used actions rise into the Frequent section. Stable navigation never moves."
                  enabled={adaptiveHome}
                  disabled={saving}
                  onToggle={() =>
                    void saveSetting(
                      "adaptive_home",
                      !adaptiveHome,
                    )
                  }
                />

                <SettingRow
                  title="One active phone per employee"
                  description="Useful when device control matters. Leave it off for a more forgiving rollout."
                  enabled={Boolean(
                    devicePolicy.oneActiveDevice,
                  )}
                  disabled={saving}
                  onToggle={() =>
                    void saveSetting(
                      "device_policy",
                      {
                        ...devicePolicy,
                        oneActiveDevice:
                          !devicePolicy.oneActiveDevice,
                      },
                    )
                  }
                />

                <SettingRow
                  title="Allow cached offline login"
                  description="Keeps the field app usable when connectivity disappears after a successful login."
                  enabled={
                    offlinePolicy.allowCachedLogin !==
                    false
                  }
                  disabled={saving}
                  onToggle={() =>
                    void saveSetting(
                      "offline_policy",
                      {
                        ...offlinePolicy,
                        allowCachedLogin:
                          offlinePolicy.allowCachedLogin ===
                          false,
                      },
                    )
                  }
                />
              </div>
            </Panel>

            <Panel>
              <div className="mb-4 text-lg font-semibold">
                Admin fallback
              </div>

              <div className="rounded-xl border bg-muted/25 p-4">
                <div className="font-medium">
                  No specialist admin required
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Approval ownership resolves from primary owner to backup, then default admin, then an active dashboard admin. A small company can operate with one admin without dead ends.
                </div>
              </div>

              <div className="mt-4 text-sm text-muted-foreground">
                Add more dashboard users from <strong>Dashboard Access</strong>. Advanced ownership rules can be introduced later without changing employee workflows.
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function SettingRow({
  title,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div>
        <div className="font-medium">
          {title}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {description}
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={
          enabled
            ? "relative h-7 w-12 shrink-0 rounded-full bg-foreground transition"
            : "relative h-7 w-12 shrink-0 rounded-full bg-muted-foreground/25 transition"
        }
        aria-pressed={enabled}
      >
        <span
          className={
            enabled
              ? "absolute left-6 top-1 h-5 w-5 rounded-full bg-background transition"
              : "absolute left-1 top-1 h-5 w-5 rounded-full bg-background shadow transition"
          }
        />
      </button>
    </div>
  );
}
