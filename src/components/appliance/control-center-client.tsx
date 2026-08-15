
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Settings2,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";

import type {
  AdminHome,
} from "@/lib/appliance-types";
import {
  apiJson,
  cx,
} from "./client";
import {
  EmptyState,
  PageIntro,
  Panel,
  Pill,
  SecondaryButton,
  Stat,
} from "./primitives";

const actionRoutes: Record<
  string,
  string
> = {
  employees:
    "/dashboard/workforce/employees",
  attendance:
    "/dashboard/slmAttendance",
  live_location:
    "/dashboard/slmGeotracking",
  approvals:
    "/dashboard/workspace/approvals",
  responsibilities:
    "/dashboard/workspace/responsibilities",
  assignments:
    "/dashboard/workspace/assignments",
  leave:
    "/dashboard/slmLeaves",
  ta_da:
    "/dashboard/tadaBill",
  journey_plans:
    "/dashboard/permanentJourneyPlan",
  reports:
    "/dashboard/reports",
  devices:
    "/dashboard/workforce/devices",
};

function greeting() {
  const hour =
    new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function ControlCenterClient() {
  const [home, setHome] =
    useState<AdminHome | null>(
      null,
    );
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(
      null,
    );

  const load = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        const body =
          await apiJson<{
            success: boolean;
            home: AdminHome;
          }>(
            "/api/appliance/home",
          );

        setHome(body.home);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load Control Center.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();

    const timer =
      window.setInterval(
        () => void load(),
        60_000,
      );

    return () =>
      window.clearInterval(timer);
  }, [load]);

  const quickActions = useMemo(
    () => [
      {
        label: "Employees",
        description:
          "Add or manage people",
        href: "/dashboard/workforce/employees",
        icon: UserPlus,
      },
      {
        label: "Assign Work",
        description:
          "Give someone a task",
        href: "/dashboard/workspace/assignments",
        icon: ClipboardList,
      },
      {
        label: "Responsibilities",
        description:
          "Control what appears in the app",
        href: "/dashboard/workspace/responsibilities",
        icon: BadgeCheck,
      },
      {
        label: "Live Location",
        description:
          "See the field team",
        href: "/dashboard/slmGeotracking",
        icon: Smartphone,
      },
    ],
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Control Center"
        title={greeting()}
        description="What needs attention, what is happening today, and the actions you use most."
        action={
          <SecondaryButton
            type="button"
            onClick={() =>
              void load()
            }
            disabled={loading}
          >
            <RefreshCw
              className={cx(
                "h-4 w-4",
                loading &&
                  "animate-spin",
              )}
            />
            Refresh
          </SecondaryButton>
        }
      />

      {error && (
        <Panel className="border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <div className="font-medium">
                Control Center could not connect
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {error}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {!home && loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl border bg-muted/40"
              />
            ),
          )}
        </div>
      ) : home ? (
        <>
          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">
                  Needs your attention
                </div>
                <div className="text-sm text-muted-foreground">
                  Problems first. Action beside the problem.
                </div>
              </div>
              <Pill
                tone={
                  home.needsAttention
                    .length
                    ? "warning"
                    : "good"
                }
              >
                {home.needsAttention
                  .length
                  ? `${home.needsAttention.length} open`
                  : "All clear"}
              </Pill>
            </div>

            {home.needsAttention
              .length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-500/5 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-medium">
                    Nothing urgent right now
                  </div>
                  <div className="text-sm text-muted-foreground">
                    The control plane has no open attention items.
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {home.needsAttention.map(
                  (item) => {
                    const href =
                      actionRoutes[
                        item.actionKey ??
                          ""
                      ] ??
                      "/dashboard";

                    return (
                      <Link
                        href={href}
                        key={
                          item.key
                        }
                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div
                          className={cx(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            item.severity ===
                              "warning"
                              ? "bg-amber-500"
                              : item.severity ===
                                  "danger"
                                ? "bg-red-500"
                                : "bg-blue-500",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            {
                              item.title
                            }
                          </div>
                          {item.body && (
                            <div className="truncate text-sm text-muted-foreground">
                              {
                                item.body
                              }
                            </div>
                          )}
                        </div>
                        <span className="hidden text-sm font-medium sm:block">
                          Open
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    );
                  },
                )}
              </div>
            )}
          </Panel>

          <div>
            <div className="mb-3 text-sm font-semibold">
              Today
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat
                value={
                  home.today
                    .activeEmployees
                }
                label="Active employees"
              />
              <Stat
                value={
                  home.today.present
                }
                label="Present"
              />
              <Stat
                value={
                  home.today
                    .notCheckedIn
                }
                label="Not checked in"
              />
              <Stat
                value={
                  home.today.onLeave
                }
                label="On leave"
              />
              <Stat
                value={
                  home.today
                    .pendingApprovals
                }
                label="Approvals waiting"
              />
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold">
              Quick actions
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map(
                (item) => {
                  const Icon =
                    item.icon;

                  return (
                    <Link
                      href={
                        item.href
                      }
                      key={
                        item.href
                      }
                      className="group rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-3 font-medium">
                        {
                          item.label
                        }
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {
                          item.description
                        }
                      </div>
                    </Link>
                  );
                },
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <div className="mb-4">
                <div className="text-lg font-semibold">
                  Your frequent
                </div>
                <div className="text-sm text-muted-foreground">
                  Stable navigation stays stable; frequently used actions rise here.
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {home.frequentActions.map(
                  (item) => (
                    <Link
                      href={
                        actionRoutes[
                          item.key
                        ] ??
                        item.href ??
                        "/dashboard"
                      }
                      key={
                        item.key
                      }
                      className="flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-muted/50"
                    >
                      <span className="font-medium">
                        {
                          item.label
                        }
                      </span>
                      <div className="flex items-center gap-2">
                        {item.pinned && (
                          <Pill tone="info">
                            Pinned
                          </Pill>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ),
                )}
              </div>
            </Panel>

            <Panel>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    Setup health
                  </div>
                  <div className="text-sm text-muted-foreground">
                    The system tells you when something important is incomplete.
                  </div>
                </div>
                <Pill
                  tone={
                    home.setupHealth
                      .ready
                      ? "good"
                      : "warning"
                  }
                >
                  {home.setupHealth
                    .ready
                    ? "Ready"
                    : "Needs setup"}
                </Pill>
              </div>

              <div className="space-y-2">
                {home.setupHealth.checks.map(
                  (check) => (
                    <div
                      key={
                        check.key
                      }
                      className="flex items-start gap-3 rounded-xl bg-muted/35 px-3 py-3"
                    >
                      {check.status ===
                      "good" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
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

              <Link
                href="/dashboard/administration/setup"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium"
              >
                <Settings2 className="h-4 w-4" />
                Open setup
              </Link>
            </Panel>
          </div>
        </>
      ) : (
        <EmptyState
          title="Control Center unavailable"
          description="Start the sales app backend and make sure the CMS server can reach it."
        />
      )}
    </div>
  );
}
