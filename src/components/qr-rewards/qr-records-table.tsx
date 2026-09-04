"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Loader2,
  RefreshCw,
  Repeat2,
} from "lucide-react";


type EligibleEntity = {
  id: string;
  entityTypeName: string;
  label: string;
};


type Campaign = {
  id: string;
  name: string;

  status: string;

  startsAt: string;
  expiresAt: string;

  eligibleEntities:
    EligibleEntity[];
};


type Batch = {
  id: string;

  batchCode: string;

  originCampaignName: string;

  campaignId:
    | string
    | null;

  campaignName:
    | string
    | null;

  attributionMode:
    | string
    | null;

  entityTypeName:
    | string
    | null;

  entityRecordId:
    | string
    | null;

  entityLabel:
    | string
    | null;

  voucherCount: number;

  availableCount: number;
  claimedCount: number;
  expiredCount: number;

  expiresAt:
    | string
    | null;
};


type Draft = {
  campaignId: string;

  attributionMode:
    | "none"
    | "fixed_entity"
    | "claimant_selects";

  entityRecordId: string;
};


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
      Batch[]
    >([]);

  const [
    campaigns,
    setCampaigns,
  ] =
    useState<
      Campaign[]
    >([]);

  const [
    drafts,
    setDrafts,
  ] =
    useState<
      Record<
        string,
        Draft
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      "",
    );

  const [
    error,
    setError,
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

        try {
          const [
            batchResponse,
            campaignResponse,
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
            batchBody,
            campaignBody,
          ] =
            await Promise.all([
              batchResponse
                .json(),

              campaignResponse
                .json(),
            ]);

          if (
            !batchResponse.ok ||
            !campaignResponse.ok
          ) {
            throw new Error(
              batchBody?.error ||
                campaignBody?.error ||
                "Could not load batches.",
            );
          }

          setRows(
            batchBody
              .batches ??
              [],
          );

          setCampaigns(
            campaignBody
              .campaigns ??
              [],
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


  function draftFor(
    batch: Batch,
  ) {
    return (
      drafts[
        batch.id
      ] ?? {
        campaignId:
          "",

        attributionMode:
          "claimant_selects",

        entityRecordId:
          "",
      }
    );
  }


  function updateDraft(
    batchId: string,
    patch:
      Partial<Draft>,
  ) {
    setDrafts(
      (
        current,
      ) => ({
        ...current,

        [batchId]: {
          campaignId:
            current[
              batchId
            ]?.campaignId ??
            "",

          attributionMode:
            current[
              batchId
            ]?.attributionMode ??
            "claimant_selects",

          entityRecordId:
            current[
              batchId
            ]?.entityRecordId ??
            "",

          ...patch,
        },
      }),
    );
  }


  async function reassign(
    batch: Batch,
  ) {
    const draft =
      draftFor(
        batch,
      );

    if (
      !draft.campaignId
    ) {
      return;
    }

    const target =
      campaigns.find(
        (
          campaign,
        ) =>
          campaign.id ===
          draft.campaignId,
      );

    if (!target) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          `Reassign ${batch.batchCode}?`,
          "",
          `New Campaign: ${target.name}`,
          "",
          `${Number(batch.claimedCount ?? 0).toLocaleString("en-IN")} claimed QRs stay permanently claimed.`,
          `${(
            Number(batch.availableCount ?? 0) +
            Number(batch.expiredCount ?? 0)
          ).toLocaleString("en-IN")} unclaimed QRs may become active under the new assignment.`,
        ].join("\n"),
      );

    if (!confirmed) {
      return;
    }

    setBusy(
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
                  draft.campaignId,

                attributionMode:
                  draft.attributionMode,

                entityRecordId:
                  draft.attributionMode ===
                    "fixed_entity"
                    ? draft.entityRecordId
                    : null,
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
            "Reassignment failed.",
        );
      }

      setDrafts(
        (
          current,
        ) => {
          const next = {
            ...current,
          };

          delete next[
            batch.id
          ];

          return next;
        },
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Reassignment failed.",
      );
    } finally {
      setBusy(
        "",
      );
    }
  }


  if (
    loading
  ) {
    return (
      <div className="rounded-2xl border p-8 text-sm text-muted-foreground">
        Loading generated QR batches...
      </div>
    );
  }


  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between border-b p-5">
        <div>
          <h2 className="font-semibold">
            Generated QR batches
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Reusable physical QR inventory with Campaign and Entity attribution.
          </p>
        </div>

        <button
          type="button"
          onClick={
            () =>
              void load()
          }
          className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
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


      <div className="overflow-x-auto">
        <table className="w-full min-w-[1450px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">
                Batch
              </th>

              <th className="px-4 py-3">
                Campaign
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
                Claimed
              </th>

              <th className="px-4 py-3">
                Reassign
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {rows.map(
              (
                batch,
              ) => {
                const draft =
                  draftFor(
                    batch,
                  );

                const target =
                  campaigns.find(
                    (
                      campaign,
                    ) =>
                      campaign.id ===
                      draft.campaignId,
                  );

                return (
                  <tr
                    key={
                      batch.id
                    }
                  >
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs font-semibold">
                        {
                          batch.batchCode
                        }
                      </div>

                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Origin: {
                          batch.originCampaignName
                        }
                      </div>
                    </td>

                    <td className="px-4 py-4 font-medium">
                      {
                        batch.campaignName ??
                        "Inactive"
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        batch.attributionMode ??
                        "none"
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
                        batch.voucherCount
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        Number(
                          batch.availableCount ??
                            0,
                        ) +
                        Number(
                          batch.expiredCount ??
                            0,
                        )
                      }
                    </td>

                    <td className="px-4 py-4">
                      {
                        batch.claimedCount
                      }
                    </td>

                    <td className="px-4 py-4">
                      <div className="grid min-w-[430px] grid-cols-[1fr_1fr_auto] gap-2">
                        <select
                          value={
                            draft.campaignId
                          }
                          onChange={
                            (
                              event,
                            ) => {
                              const campaignId =
                                event
                                  .target
                                  .value;

                              const campaign =
                                campaigns.find(
                                  (
                                    item,
                                  ) =>
                                    item.id ===
                                    campaignId,
                                );

                              updateDraft(
                                batch.id,
                                {
                                  campaignId,

                                  attributionMode:
                                    campaign
                                      ?.eligibleEntities
                                      ?.length
                                      ? "claimant_selects"
                                      : "none",

                                  entityRecordId:
                                    campaign
                                      ?.eligibleEntities?.[0]
                                      ?.id ??
                                    "",
                                },
                              );
                            }
                          }
                          className="h-9 rounded-lg border bg-background px-2 text-xs"
                        >
                          <option value="">
                            Campaign...
                          </option>

                          {campaigns
                            .filter(
                              (
                                campaign,
                              ) =>
                                campaign.status ===
                                  "active" &&
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

                        <div className="grid gap-1">
                          <select
                            value={
                              draft.attributionMode
                            }
                            disabled={
                              !draft.campaignId
                            }
                            onChange={
                              (
                                event,
                              ) =>
                                updateDraft(
                                  batch.id,
                                  {
                                    attributionMode:
                                      event
                                        .target
                                        .value as
                                        Draft["attributionMode"],
                                  },
                                )
                            }
                            className="h-9 rounded-lg border bg-background px-2 text-xs"
                          >
                            <option value="none">
                              No Entity
                            </option>

                            {!!target
                              ?.eligibleEntities
                              ?.length && (
                              <>
                                <option value="claimant_selects">
                                  Claimant selects
                                </option>

                                <option value="fixed_entity">
                                  Fixed Entity
                                </option>
                              </>
                            )}
                          </select>

                          {draft.attributionMode ===
                            "fixed_entity" && (
                            <select
                              value={
                                draft.entityRecordId
                              }
                              onChange={
                                (
                                  event,
                                ) =>
                                  updateDraft(
                                    batch.id,
                                    {
                                      entityRecordId:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                              }
                              className="h-9 rounded-lg border bg-background px-2 text-xs"
                            >
                              {(target
                                ?.eligibleEntities ??
                                []
                              ).map(
                                (
                                  entity,
                                ) => (
                                  <option
                                    key={
                                      entity.id
                                    }
                                    value={
                                      entity.id
                                    }
                                  >
                                    {
                                      entity.label
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={
                            !draft.campaignId ||
                            busy ===
                              batch.id
                          }
                          onClick={
                            () =>
                              void reassign(
                                batch,
                              )
                          }
                          className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
                        >
                          {busy ===
                          batch.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Repeat2 className="h-4 w-4" />
                          )}

                          Move
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
