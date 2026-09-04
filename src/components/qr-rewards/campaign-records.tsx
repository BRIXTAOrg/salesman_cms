"use client";

import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";


type EntityType = {
  id: number;
  key: string;
  title: string;

  searchableFields?:
    string[];

  isActive: boolean;
};


type EntityRecord = {
  id: string;

  entityTypeId: number;

  externalKey?:
    string | null;

  status: string;

  data:
    Record<
      string,
      unknown
    >;
};


type EligibleEntity = {
  id: string;

  entityTypeId: number;

  entityTypeName: string;

  label: string;
};


type Campaign = {
  id: string;

  name: string;

  description?:
    string | null;

  rewardAmountMinor: number;

  expiresAt: string;

  status: string;

  batchCount: number;

  eligibleEntities:
    EligibleEntity[];
};


function money(
  minor: number,
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


function recordLabel(
  record: EntityRecord,
  type:
    EntityType | undefined,
) {
  for (
    const key of
    type
      ?.searchableFields ??
    []
  ) {
    const value =
      record.data[
        key
      ];

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  for (
    const key of [
      "name",
      "title",
      "dealer_name",
      "store_name",
      "company_name",
    ]
  ) {
    const value =
      record.data[
        key
      ];

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return (
    record.externalKey ||
    record.id
  );
}


export function CampaignRecords() {
  const [
    campaigns,
    setCampaigns,
  ] =
    useState<
      Campaign[]
    >([]);

  const [
    entityTypes,
    setEntityTypes,
  ] =
    useState<
      EntityType[]
    >([]);

  const [
    records,
    setRecords,
  ] =
    useState<
      EntityRecord[]
    >([]);

  const [
    selectedTypeId,
    setSelectedTypeId,
  ] =
    useState(
      "",
    );

  const [
    selectedRecordIds,
    setSelectedRecordIds,
  ] =
    useState<
      string[]
    >([]);

  const [
    name,
    setName,
  ] =
    useState(
      "",
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      "",
    );

  const [
    reward,
    setReward,
  ] =
    useState(
      100,
    );

  const [
    validityDays,
    setValidityDays,
  ] =
    useState(
      30,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    creating,
    setCreating,
  ] =
    useState(
      false,
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

        setError(
          "",
        );

        try {
          const [
            campaignsResponse,
            entityTypesResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/qr-rewards/campaigns",
                {
                  cache:
                    "no-store",
                },
              ),

              fetch(
                "/api/platform/entities",
                {
                  cache:
                    "no-store",
                },
              ),
            ]);

          const [
            campaignsBody,
            entityTypesBody,
          ] =
            await Promise.all([
              campaignsResponse
                .json(),

              entityTypesResponse
                .json(),
            ]);

          if (
            !campaignsResponse.ok
          ) {
            throw new Error(
              campaignsBody?.error ||
                "Could not load Campaigns.",
            );
          }

          if (
            !entityTypesResponse.ok
          ) {
            throw new Error(
              entityTypesBody?.error ||
                "Could not load Entities.",
            );
          }

          setCampaigns(
            campaignsBody
              .campaigns ??
              [],
          );

          const types =
            (
              entityTypesBody
                .entityTypes ??
              []
            ).filter(
              (
                item:
                  EntityType,
              ) =>
                item.isActive !==
                false,
            );

          setEntityTypes(
            types,
          );

          setSelectedTypeId(
            (
              current,
            ) =>
              current ||
              (
                types[0]?.id
                  ? String(
                      types[0].id,
                    )
                  : ""
              ),
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
    ],
  );


  useEffect(
    () => {
      if (
        !selectedTypeId
      ) {
        setRecords([]);
        return;
      }

      let active =
        true;

      async function loadRecords() {
        const response =
          await fetch(
            `/api/platform/entity-records?entityTypeId=${encodeURIComponent(
              selectedTypeId,
            )}&limit=100`,
            {
              cache:
                "no-store",
            },
          );

        const body =
          await response.json();

        if (!active) {
          return;
        }

        if (
          response.ok
        ) {
          setRecords(
            (
              body.records ??
              []
            ).filter(
              (
                item:
                  EntityRecord,
              ) =>
                item.status ===
                "active",
            ),
          );
        }
      }

      void loadRecords();

      return () => {
        active =
          false;
      };
    },
    [
      selectedTypeId,
    ],
  );


  const selectedType =
    useMemo(
      () =>
        entityTypes.find(
          (
            item,
          ) =>
            String(
              item.id,
            ) ===
            selectedTypeId,
        ),
      [
        entityTypes,
        selectedTypeId,
      ],
    );


  async function createCampaign(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setCreating(
      true,
    );

    setError(
      "",
    );

    try {
      const response =
        await fetch(
          "/api/qr-rewards/campaigns",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                name,

                description,

                rewardAmountMinor:
                  Math.round(
                    reward *
                      100,
                  ),

                validityDays,

                entityRecordIds:
                  selectedRecordIds,
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
            "Could not create Campaign.",
        );
      }

      setName("");
      setDescription("");
      setReward(100);
      setValidityDays(30);
      setSelectedRecordIds([]);

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create Campaign.",
      );
    } finally {
      setCreating(
        false,
      );
    }
  }


  function toggleRecord(
    id: string,
  ) {
    setSelectedRecordIds(
      (
        current,
      ) =>
        current.includes(
          id,
        )
          ? current.filter(
              (
                value,
              ) =>
                value !==
                id,
            )
          : [
              ...current,
              id,
            ],
    );
  }


  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Create Campaign
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Build a reward programme and directly attach reusable BRIXTA Entity records.
          </p>
        </div>

        <form
          onSubmit={
            createCampaign
          }
          className="grid gap-5 p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">
                Campaign name
              </span>

              <input
                required
                value={
                  name
                }
                onChange={
                  (
                    event,
                  ) =>
                    setName(
                      event
                        .target
                        .value,
                    )
                }
                placeholder="Mason Rewards September"
                className="h-10 rounded-xl border bg-background px-3 text-sm"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">
                Reward per QR
              </span>

              <div className="flex h-10 rounded-xl border">
                <span className="flex items-center px-3 text-muted-foreground">
                  ₹
                </span>

                <input
                  required
                  type="number"
                  min={1}
                  value={
                    reward
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setReward(
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
            </label>
          </div>

          <textarea
            value={
              description
            }
            onChange={
              (
                event,
              ) =>
                setDescription(
                  event
                    .target
                    .value,
                )
            }
            placeholder="Campaign description"
            className="min-h-20 rounded-xl border bg-background p-3 text-sm"
          />

          <label className="grid gap-2">
            <span className="text-sm font-medium">
              Campaign validity
            </span>

            <div className="flex h-10 rounded-xl border">
              <input
                required
                type="number"
                min={1}
                max={3650}
                value={
                  validityDays
                }
                onChange={
                  (
                    event,
                  ) =>
                    setValidityDays(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                }
                className="min-w-0 flex-1 bg-transparent px-3"
              />

              <span className="flex items-center pr-3 text-sm text-muted-foreground">
                days
              </span>
            </div>
          </label>


          <section className="rounded-xl border bg-muted/10">
            <div className="border-b p-4">
              <div className="font-medium">
                Eligible business Entities
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                These are the same reusable Entities uploaded elsewhere in BRIXTA.
              </p>
            </div>

            <div className="grid gap-4 p-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium">
                  Entity type
                </span>

                <select
                  value={
                    selectedTypeId
                  }
                  onChange={
                    (
                      event,
                    ) => {
                      setSelectedTypeId(
                        event
                          .target
                          .value,
                      );

                      setSelectedRecordIds(
                        [],
                      );
                    }
                  }
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="">
                    No Entity attribution
                  </option>

                  {entityTypes.map(
                    (
                      type,
                    ) => (
                      <option
                        key={
                          type.id
                        }
                        value={
                          type.id
                        }
                      >
                        {
                          type.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              {selectedTypeId && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Eligible {
                        selectedType
                          ?.title ??
                        "Entities"
                      }
                    </span>

                    {!!records.length && (
                      <button
                        type="button"
                        onClick={
                          () =>
                            setSelectedRecordIds(
                              records.map(
                                (
                                  record,
                                ) =>
                                  record.id,
                              ),
                            )
                        }
                        className="text-xs underline"
                      >
                        Select all
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-auto rounded-xl border bg-background">
                    {!records.length ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        No active Entity records found for this type.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {records.map(
                          (
                            record,
                          ) => (
                            <label
                              key={
                                record.id
                              }
                              className="flex cursor-pointer items-center gap-3 px-4 py-3"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  selectedRecordIds.includes(
                                    record.id,
                                  )
                                }
                                onChange={
                                  () =>
                                    toggleRecord(
                                      record.id,
                                    )
                                }
                              />

                              <span className="text-sm">
                                {recordLabel(
                                  record,
                                  selectedType,
                                )}
                              </span>
                            </label>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>


          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              creating
            }
            className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
          >
            {
              creating
                ? "Creating..."
                : "Create Campaign"
            }
          </button>
        </form>
      </section>


      <section>
        <div className="mb-3">
          <h2 className="font-semibold">
            Existing Campaigns
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Open a Campaign for its live QR, Entity and claim analytics.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
            Loading Campaigns...
          </div>
        ) : !campaigns.length ? (
          <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
            No Campaigns yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">
                    Campaign
                  </th>

                  <th className="px-4 py-3">
                    Entities
                  </th>

                  <th className="px-4 py-3">
                    Reward
                  </th>

                  <th className="px-4 py-3">
                    Batches
                  </th>

                  <th className="px-4 py-3">
                    Expiry
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-4 py-3">
                    Dashboard
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {campaigns.map(
                  (
                    campaign,
                  ) => {
                    const typeNames = [
                      ...new Set(
                        (
                          campaign
                            .eligibleEntities ??
                          []
                        ).map(
                          (
                            entity,
                          ) =>
                            entity
                              .entityTypeName,
                        ),
                      ),
                    ];

                    return (
                      <tr
                        key={
                          campaign.id
                        }
                      >
                        <td className="px-4 py-4">
                          <div className="font-medium">
                            {
                              campaign.name
                            }
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground">
                            {
                              campaign.description ||
                              "—"
                            }
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-medium">
                            {
                              campaign
                                .eligibleEntities
                                ?.length ??
                              0
                            }
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {
                              typeNames.join(
                                ", ",
                              ) ||
                              "No attribution"
                            }
                          </div>
                        </td>

                        <td className="px-4 py-4 font-medium">
                          {money(
                            campaign.rewardAmountMinor,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {
                            campaign.batchCount
                          }
                        </td>

                        <td className="px-4 py-4">
                          {new Date(
                            campaign.expiresAt,
                          ).toLocaleDateString(
                            "en-IN",
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {
                            campaign.status
                          }
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/dashboard/qr-rewards/campaigns/${campaign.id}`}
                            className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium hover:bg-muted"
                          >
                            Open
                          </Link>
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
    </div>
  );
}
