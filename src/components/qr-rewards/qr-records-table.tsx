"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Loader2,
  RefreshCw,
  Repeat2,
} from "lucide-react";


type CampaignRecord = {
  id: string;
  name: string;
  status: string;
  startsAt: string;
  expiresAt: string;
};


type BatchRecord = {
  id: string;

  batchCode: string;

  originCampaignId: string;
  originCampaignName: string;

  activeAssignmentId:
    | string
    | null;

  campaignId:
    | string
    | null;

  campaignName:
    | string
    | null;

  quantity: number;

  voucherCount: number;

  availableCount: number;
  claimedCount: number;
  expiredCount: number;
  revokedCount: number;

  rewardAmountMinor:
    | number
    | null;

  currency:
    | string
    | null;

  expiresAt:
    | string
    | null;

  status: string;

  createdAt: string;
};


function usageState(
  batch:
    BatchRecord,
) {
  const total =
    Number(
      batch.voucherCount ??
        batch.quantity ??
        0,
    );

  const claimed =
    Number(
      batch.claimedCount ??
        0,
    );

  const available =
    Number(
      batch.availableCount ??
        0,
    );

  const expired =
    Number(
      batch.expiredCount ??
        0,
    );

  if (
    total > 0 &&
    claimed >=
      total
  ) {
    return "Fully claimed";
  }

  if (
    claimed > 0 &&
    available > 0
  ) {
    return "Partially used";
  }

  if (
    available > 0 &&
    claimed === 0
  ) {
    return "Unused";
  }

  if (
    expired > 0
  ) {
    return "Expired / reusable";
  }

  return batch.status;
}


export function QrRecordsTable({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const [
    rows,
    setRows,
  ] =
    useState<
      BatchRecord[]
    >([]);

  const [
    campaigns,
    setCampaigns,
  ] =
    useState<
      CampaignRecord[]
    >([]);

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
    selection,
    setSelection,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    reassigning,
    setReassigning,
  ] =
    useState(
      "",
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
          const [
            batchesResponse,
            campaignsResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/qr-rewards/batches",
                {
                  cache:
                    "no-store",
                },
              ),

              fetch(
                "/api/qr-rewards/campaigns",
                {
                  cache:
                    "no-store",
                },
              ),
            ]);

          const [
            batchesBody,
            campaignsBody,
          ] =
            await Promise.all([
              batchesResponse
                .json(),

              campaignsResponse
                .json(),
            ]);

          if (
            !batchesResponse.ok
          ) {
            throw new Error(
              batchesBody?.error ||
                "Could not load QR batches.",
            );
          }

          if (
            !campaignsResponse.ok
          ) {
            throw new Error(
              campaignsBody?.error ||
                "Could not load Campaigns.",
            );
          }

          setRows(
            batchesBody
              .batches ??
              [],
          );

          setCampaigns(
            campaignsBody
              .campaigns ??
              [],
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load QR batches.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );


  useEffect(
    () => {
      void load();
    },
    [
      load,
      refreshKey,
    ],
  );


  const activeCampaigns =
    useMemo(
      () => {
        const now =
          Date.now();

        return campaigns.filter(
          (
            campaign,
          ) =>
            campaign.status ===
              "active" &&
            new Date(
              campaign.startsAt,
            ).getTime() <=
              now &&
            new Date(
              campaign.expiresAt,
            ).getTime() >
              now,
        );
      },
      [
        campaigns,
      ],
    );


  async function reassign(
    batch:
      BatchRecord,
  ) {
    const targetCampaignId =
      selection[
        batch.id
      ];

    if (
      !targetCampaignId ||
      targetCampaignId ===
        batch.campaignId
    ) {
      return;
    }

    const target =
      activeCampaigns.find(
        (
          campaign,
        ) =>
          campaign.id ===
          targetCampaignId,
      );

    if (!target) {
      return;
    }

    const reusable =
      Number(
        batch.availableCount ??
          0,
      ) +
      Number(
        batch.expiredCount ??
          0,
      );

    const confirmed =
      window.confirm(
        [
          `Reassign ${batch.batchCode}?`,
          "",
          `Current Campaign: ${batch.campaignName ?? "None"}`,
          `New Campaign: ${target.name}`,
          "",
          `${reusable.toLocaleString("en-IN")} unclaimed QRs will become active in the new Campaign.`,
          `${Number(batch.claimedCount ?? 0).toLocaleString("en-IN")} previously claimed QRs remain permanently claimed.`,
        ].join("\n"),
      );

    if (!confirmed) {
      return;
    }

    setReassigning(
      batch.id,
    );

    setError(
      "",
    );

    try {
      const response =
        await fetch(
          `/api/qr-rewards/batches/${encodeURIComponent(
            batch.id,
          )}/assignment`,
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                campaignId:
                  targetCampaignId,
              }),
          },
        );

      const body =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          body?.error ||
            "Could not reassign QR batch.",
        );
      }

      setSelection(
        (
          current,
        ) => ({
          ...current,

          [batch.id]:
            "",
        }),
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not reassign QR batch.",
      );
    } finally {
      setReassigning(
        "",
      );
    }
  }


  if (
    loading
  ) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
        Loading generated QR batches...
      </div>
    );
  }


  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-4 border-b p-5">
        <div>
          <h2 className="font-semibold">
            Generated QR batches
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Physical QR inventory can move between Campaigns. Claimed QRs never reactivate.
          </p>
        </div>

        <button
          type="button"
          onClick={
            () =>
              void load()
          }
          className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />

          Refresh
        </button>
      </div>


      {error && (
        <div className="border-b bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}


      {!rows.length ? (
        <div className="p-8 text-sm text-muted-foreground">
          No QR batches generated yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1350px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  Batch
                </th>

                <th className="px-4 py-3">
                  Current Campaign
                </th>

                <th className="px-4 py-3 text-right">
                  Total
                </th>

                <th className="px-4 py-3 text-right">
                  Available
                </th>

                <th className="px-4 py-3 text-right">
                  Claimed
                </th>

                <th className="px-4 py-3">
                  Usage
                </th>

                <th className="px-4 py-3">
                  Expires
                </th>

                <th className="px-4 py-3">
                  Reassign unused QRs
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {rows.map(
                (
                  batch,
                ) => {
                  const reusable =
                    Number(
                      batch.availableCount ??
                        0,
                    ) +
                    Number(
                      batch.expiredCount ??
                        0,
                    );

                  return (
                    <tr
                      key={
                        batch.id
                      }
                      className="align-middle hover:bg-muted/20"
                    >
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs font-semibold">
                          {
                            batch.batchCode
                          }
                        </div>

                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Origin: {
                            batch.originCampaignName
                          }
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium">
                          {
                            batch.campaignName ??
                            "No active Campaign"
                          }
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right font-medium">
                        {Number(
                          batch.voucherCount ??
                            batch.quantity ??
                            0,
                        ).toLocaleString(
                          "en-IN",
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        {
                          reusable.toLocaleString(
                            "en-IN",
                          )
                        }
                      </td>

                      <td className="px-4 py-4 text-right">
                        {Number(
                          batch.claimedCount ??
                            0,
                        ).toLocaleString(
                          "en-IN",
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                          {
                            usageState(
                              batch,
                            )
                          }
                        </span>
                      </td>

                      <td className="px-4 py-4 text-muted-foreground">
                        {
                          batch.expiresAt
                            ? new Date(
                                batch.expiresAt,
                              ).toLocaleDateString(
                                "en-IN",
                              )
                            : "Inactive"
                        }
                      </td>

                      <td className="px-4 py-4">
                        {reusable > 0 ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={
                                selection[
                                  batch.id
                                ] ??
                                ""
                              }
                              onChange={
                                (
                                  event,
                                ) =>
                                  setSelection(
                                    (
                                      current,
                                    ) => ({
                                      ...current,

                                      [batch.id]:
                                        event
                                          .target
                                          .value,
                                    }),
                                  )
                              }
                              className="h-9 min-w-52 rounded-lg border bg-background px-2 text-xs"
                            >
                              <option value="">
                                Select Campaign...
                              </option>

                              {activeCampaigns
                                .filter(
                                  (
                                    campaign,
                                  ) =>
                                    campaign.id !==
                                    batch.campaignId,
                                )
                                .map(
                                  (
                                    campaign,
                                  ) => (
                                    <option
                                      key={
                                        campaign.id
                                      }
                                      value={
                                        campaign.id
                                      }
                                    >
                                      {
                                        campaign.name
                                      }
                                    </option>
                                  ),
                                )}
                            </select>

                            <button
                              type="button"
                              disabled={
                                !selection[
                                  batch.id
                                ] ||
                                reassigning ===
                                  batch.id
                              }
                              onClick={
                                () =>
                                  void reassign(
                                    batch,
                                  )
                              }
                              className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                            >
                              {reassigning ===
                              batch.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Repeat2 className="h-4 w-4" />
                              )}

                              Reassign
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No reusable QRs
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
