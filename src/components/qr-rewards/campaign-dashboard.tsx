"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  GenericJsonTable,
  type GenericJsonRow,
} from "@/components/generic-json-table";


type DashboardResponse = {
  campaign: {
    id: string;
    name: string;

    description?:
      string | null;

    rewardAmountMinor: number;

    currency: string;

    startsAt: string;
    expiresAt: string;

    status: string;

    eligibleEntities:
      Array<{
        id: string;

        entityTypeId: number;

        entityTypeName: string;

        label: string;
      }>;
  };

  metrics: {
    availableQrs: number;
    claims: number;

    claimedValueMinor:
      number | string;

    currentLiabilityMinor:
      number | string;

    batchCount: number;
  };

  claimsOverTime:
    Array<{
      date: string;
      claims: number;
      rewardMinor:
        number | string;
    }>;

  entityBreakdown:
    Array<{
      entityType: string;
      entity: string;
      claims: number;
      rewardMinor:
        number | string;
    }>;

  batches:
    Array<{
      assignmentId: string;
      batchId: string;
      batchCode: string;

      assignmentStatus: string;

      attributionMode: string;

      entityLabel:
        string | null;

      rewardAmountMinor: number;

      expiresAt: string;

      activatedAt: string;

      deactivatedAt:
        string | null;

      totalQrs: number;
      availableQrs: number;
      claims: number;
    }>;

  claims:
    Array<{
      id: string;

      batchCode: string;

      serialNumber: number;

      userId: number;

      rewardAmountMinor: number;

      entityType:
        string | null;

      entity:
        string | null;

      claimedAt: string;
    }>;
};


function money(
  minor:
    number | string,
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style:
        "currency",

      currency:
        "INR",

      maximumFractionDigits:
        0,
    },
  ).format(
    Number(
      minor,
    ) / 100,
  );
}


export function CampaignDashboard({
  campaignId,
}: {
  campaignId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<
      DashboardResponse | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const [
    editing,
    setEditing,
  ] =
    useState(
      false,
    );

  const [
    editName,
    setEditName,
  ] =
    useState(
      "",
    );

  const [
    editDescription,
    setEditDescription,
  ] =
    useState(
      "",
    );

  const [
    editReward,
    setEditReward,
  ] =
    useState(
      0,
    );

  const [
    editStatus,
    setEditStatus,
  ] =
    useState(
      "active",
    );


  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        setError(
          "",
        );

        try {
          const response =
            await fetch(
              `/api/qr-rewards/campaigns/${encodeURIComponent(
                campaignId,
              )}/dashboard`,
              {
                cache:
                  "no-store",
              },
            );

          const body =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              body?.error ||
                "Could not load Campaign.",
            );
          }

          setData(
            body,
          );

          setEditName(
            body.campaign.name,
          );

          setEditDescription(
            body.campaign
              .description ??
              "",
          );

          setEditReward(
            Number(
              body.campaign
                .rewardAmountMinor,
            ) / 100,
          );

          setEditStatus(
            body.campaign.status,
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Load failed.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        campaignId,
      ],
    );


  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );


  async function saveEdit() {
    setError(
      "",
    );

    const response =
      await fetch(
        `/api/qr-rewards/campaigns/${encodeURIComponent(
          campaignId,
        )}`,
        {
          method:
            "PATCH",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              name:
                editName,

              description:
                editDescription,

              rewardAmountMinor:
                Math.round(
                  editReward *
                    100,
                ),

              status:
                editStatus,
            }),
        },
      );

    const body =
      await response.json();

    if (
      !response.ok
    ) {
      setError(
        body?.error ||
          "Could not update Campaign.",
      );
      return;
    }

    setEditing(
      false,
    );

    await load();
  }


  const claimRows =
    useMemo<
      GenericJsonRow[]
    >(
      () =>
        (
          data?.claims ??
          []
        ).map(
          (
            claim,
          ) => ({
            id:
              claim.id,

            batch:
              claim.batchCode,

            qr:
              `#${claim.serialNumber}`,

            entityType:
              claim.entityType ??
              "—",

            entity:
              claim.entity ??
              "—",

            claimant:
              `User ${claim.userId}`,

            reward:
              money(
                claim.rewardAmountMinor,
              ),

            claimedAt:
              new Date(
                claim.claimedAt,
              ).toLocaleString(
                "en-IN",
              ),
          }),
        ),
      [
        data,
      ],
    );


  if (
    loading
  ) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Loading Campaign dashboard...
      </div>
    );
  }


  if (
    !data
  ) {
    return (
      <div className="p-8 text-sm text-destructive">
        {
          error ||
          "Campaign could not be loaded."
        }
      </div>
    );
  }


  const statusData = [
    {
      name:
        "Available",
      value:
        Number(
          data.metrics
            .availableQrs ??
            0,
        ),
    },

    {
      name:
        "Claimed",
      value:
        Number(
          data.metrics
            .claims ??
            0,
        ),
    },
  ];


  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/qr-rewards/campaigns"
            className="text-xs text-muted-foreground underline"
          >
            ← Campaigns
          </Link>

          <h1 className="mt-2 text-3xl font-semibold">
            {
              data.campaign
                .name
            }
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {
              data.campaign
                .description ||
              "No description"
            }
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border px-3 py-1">
              {
                data.campaign
                  .status
              }
            </span>

            <span className="rounded-full border px-3 py-1">
              {money(
                data.campaign
                  .rewardAmountMinor,
              )}{" "}
              / QR
            </span>

            <span className="rounded-full border px-3 py-1">
              {
                data.campaign
                  .eligibleEntities
                  .length
              }{" "}
              eligible Entities
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={
            () =>
              setEditing(
                (
                  current,
                ) =>
                  !current,
              )
          }
          className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted"
        >
          {
            editing
              ? "Close editor"
              : "Edit Campaign"
          }
        </button>
      </div>


      {editing && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">
            Edit Campaign
          </h2>

          <p className="mt-1 text-xs text-muted-foreground">
            Reward changes apply to future batch assignments. Historical Claims retain their snapshots.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input
              value={
                editName
              }
              onChange={
                (
                  event,
                ) =>
                  setEditName(
                    event
                      .target
                      .value,
                  )
              }
              className="h-10 rounded-xl border bg-background px-3"
            />

            <div className="flex h-10 rounded-xl border">
              <span className="flex items-center px-3">
                ₹
              </span>

              <input
                type="number"
                min={1}
                value={
                  editReward
                }
                onChange={
                  (
                    event,
                  ) =>
                    setEditReward(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                }
                className="min-w-0 flex-1 bg-transparent pr-3"
              />
            </div>

            <textarea
              value={
                editDescription
              }
              onChange={
                (
                  event,
                ) =>
                  setEditDescription(
                    event
                      .target
                      .value,
                  )
              }
              className="min-h-20 rounded-xl border bg-background p-3 md:col-span-2"
            />

            <select
              value={
                editStatus
              }
              onChange={
                (
                  event,
                ) =>
                  setEditStatus(
                    event
                      .target
                      .value,
                  )
              }
              className="h-10 rounded-xl border bg-background px-3"
            >
              <option value="active">
                Active
              </option>

              <option value="paused">
                Paused
              </option>

              <option value="revoked">
                Revoked
              </option>
            </select>

            <button
              type="button"
              onClick={
                () =>
                  void saveEdit()
              }
              className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
            >
              Save Campaign
            </button>
          </div>
        </section>
      )}


      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}


      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Available QRs"
          value={
            Number(
              data.metrics
                .availableQrs ??
                0,
            ).toLocaleString(
              "en-IN",
            )
          }
        />

        <Metric
          label="Claims"
          value={
            Number(
              data.metrics
                .claims ??
                0,
            ).toLocaleString(
              "en-IN",
            )
          }
        />

        <Metric
          label="Claimed value"
          value={
            money(
              data.metrics
                .claimedValueMinor ??
                0,
            )
          }
        />

        <Metric
          label="Current liability"
          value={
            money(
              data.metrics
                .currentLiabilityMinor ??
                0,
            )
          }
        />

        <Metric
          label="Batches"
          value={
            Number(
              data.metrics
                .batchCount ??
                0,
            ).toLocaleString(
              "en-IN",
            )
          }
        />
      </div>


      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">
            QR status
          </h2>

          <div className="mt-4 h-72">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={
                    statusData
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={105}
                  fill="currentColor"
                  opacity={0.75}
                />

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>


        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">
            Claims over time
          </h2>

          <div className="mt-4 h-72">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={
                  data.claimsOverTime
                }
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  opacity={0.2}
                />

                <XAxis
                  dataKey="date"
                />

                <YAxis />

                <Tooltip />

                <Area
                  type="monotone"
                  dataKey="claims"
                  stroke="currentColor"
                  fill="currentColor"
                  fillOpacity={0.12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>


      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">
          Claims by Entity
        </h2>

        <p className="mt-1 text-xs text-muted-foreground">
          Dealer, Store, Dark Store, Mason or any other BRIXTA Entity type.
        </p>

        <div className="mt-4 h-72">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={
                data.entityBreakdown
              }
            >
              <CartesianGrid
                strokeDasharray="3 3"
                opacity={0.2}
              />

              <XAxis
                dataKey="entity"
              />

              <YAxis />

              <Tooltip />

              <Bar
                dataKey="claims"
                fill="currentColor"
                opacity={0.75}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>


      <section className="rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            QR Batch assignments
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  Batch
                </th>

                <th className="px-4 py-3">
                  Attribution
                </th>

                <th className="px-4 py-3">
                  Entity
                </th>

                <th className="px-4 py-3">
                  Total
                </th>

                <th className="px-4 py-3">
                  Available
                </th>

                <th className="px-4 py-3">
                  Claims
                </th>

                <th className="px-4 py-3">
                  Assignment
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {data.batches.map(
                (
                  batch,
                ) => (
                  <tr
                    key={
                      batch.assignmentId
                    }
                  >
                    <td className="px-4 py-4 font-mono text-xs font-semibold">
                      {
                        batch.batchCode
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        batch.attributionMode
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        batch.entityLabel ||
                        (
                          batch.attributionMode ===
                            "claimant_selects"
                            ? "Claimant selects"
                            : "—"
                        )
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        batch.totalQrs
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        batch.availableQrs
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        batch.claims
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        batch.assignmentStatus
                      }
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>


      <section>
        <h2 className="mb-3 font-semibold">
          Claims ledger
        </h2>

        {claimRows.length ? (
          <GenericJsonTable
            title="Campaign Claims"
            data={
              claimRows
            }
            columns={[
              {
                key:
                  "batch",
                label:
                  "Batch",
              },

              {
                key:
                  "qr",
                label:
                  "QR",
              },

              {
                key:
                  "entityType",
                label:
                  "Entity Type",
              },

              {
                key:
                  "entity",
                label:
                  "Entity",
              },

              {
                key:
                  "claimant",
                label:
                  "Claimant",
              },

              {
                key:
                  "reward",
                label:
                  "Reward",
              },

              {
                key:
                  "claimedAt",
                label:
                  "Claimed At",
              },
            ]}
          />
        ) : (
          <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
            No Claims yet.
          </div>
        )}
      </section>
    </div>
  );
}


function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold">
        {value}
      </div>
    </div>
  );
}
