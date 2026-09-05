"use client";

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
  searchableFields?: string[];
  isActive: boolean;
};


type EntityRecord = {
  id: string;
  entityTypeId: number;
  externalKey?: string | null;
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
  externalKey?: string | null;
  label: string;
};


type Campaign = {
  id: string;
  name: string;
  description?: string | null;
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
  record:
    EntityRecord,
  type?:
    EntityType,
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
      "distributor_name",
      "retailer_name",
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
    selectedEntityRecordId,
    setSelectedEntityRecordId,
  ] =
    useState(
      "",
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );

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
    searching,
    setSearching,
  ] =
    useState(
      false,
    );

  const [
    creating,
    setCreating,
  ] =
    useState(
      false,
    );

  const [
    bindingCampaignId,
    setBindingCampaignId,
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

        setError(
          "",
        );

        try {
          const [
            campaignResponse,
            entityResponse,
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
            campaignBody,
            entityBody,
          ] =
            await Promise.all([
              campaignResponse.json(),
              entityResponse.json(),
            ]);

          if (
            !campaignResponse.ok
          ) {
            throw new Error(
              campaignBody?.error ||
                "Could not load Campaigns.",
            );
          }

          if (
            !entityResponse.ok
          ) {
            throw new Error(
              entityBody?.error ||
                "Could not load Entity Types.",
            );
          }

          setCampaigns(
            campaignBody
              .campaigns ??
              [],
          );

          const types =
            (
              entityBody
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


  /*
   * Server-side Entity search.
   */
  useEffect(
    () => {
      if (
        !selectedTypeId
      ) {
        setRecords(
          [],
        );

        setSelectedEntityRecordId(
          "",
        );

        return;
      }

      let active =
        true;

      const timer =
        window.setTimeout(
          async () => {
            setSearching(
              true,
            );

            try {
              const response =
                await fetch(
                  `/api/platform/entity-records?entityTypeId=${encodeURIComponent(
                    selectedTypeId,
                  )}&limit=100&q=${encodeURIComponent(
                    search,
                  )}`,
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
                !response.ok
              ) {
                throw new Error(
                  body?.error ||
                    "Could not search Entities.",
                );
              }

              const rows =
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
                );

              setRecords(
                rows,
              );

              setSelectedEntityRecordId(
                (
                  current,
                ) =>
                  rows.some(
                    (
                      row:
                        EntityRecord,
                    ) =>
                      row.id ===
                      current,
                  )
                    ? current
                    : rows[0]
                        ?.id ??
                      "",
              );
            } catch (cause) {
              if (
                active
              ) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Entity search failed.",
                );
              }
            } finally {
              if (
                active
              ) {
                setSearching(
                  false,
                );
              }
            }
          },
          250,
        );

      return () => {
        active =
          false;

        window.clearTimeout(
          timer,
        );
      };
    },
    [
      selectedTypeId,
      search,
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

    if (
      !selectedEntityRecordId
    ) {
      setError(
        "Choose exactly one Entity for this Campaign.",
      );

      return;
    }

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

                entityRecordId:
                  selectedEntityRecordId,
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

      setName(
        "",
      );

      setDescription(
        "",
      );

      setReward(
        100,
      );

      setValidityDays(
        30,
      );

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


  async function normalizeCampaign(
    campaign:
      Campaign,
  ) {
    if (
      !selectedEntityRecordId ||
      Number(
        campaign.batchCount ??
          0,
      ) >
        0
    ) {
      return;
    }

    const selected =
      records.find(
        (
          record,
        ) =>
          record.id ===
          selectedEntityRecordId,
      );

    const label =
      selected
        ? recordLabel(
            selected,
            selectedType,
          )
        : selectedEntityRecordId;

    if (
      !window.confirm(
        [
          `Campaign: ${campaign.name}`,
          "",
          `Entity Type: ${selectedType?.title ?? "Entity"}`,
          `Entity: ${label}`,
          "",
          "This Campaign will belong to this ONE Entity.",
        ].join(
          "\n",
        ),
      )
    ) {
      return;
    }

    setBindingCampaignId(
      campaign.id,
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
              "PATCH",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                campaignId:
                  campaign.id,

                entityRecordId:
                  selectedEntityRecordId,
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
            "Could not normalize Campaign Entity.",
        );
      }

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not normalize Campaign Entity.",
      );
    } finally {
      setBindingCampaignId(
        "",
      );
    }
  }


  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Create Campaign
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            One Entity can own many Campaigns. Every Campaign belongs to exactly one Entity.
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
                      event.target.value,
                    )
                }
                placeholder="September Mason Reward"
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
                          event.target.value,
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
                  event.target.value,
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
                        event.target.value,
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
                Campaign Entity
              </div>

              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Generic BRIXTA Entity: Dealer, Distributor, Retailer, Warehouse, Project, or another imported Entity Type.
              </p>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium">
                  Entity Type
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
                        event.target.value,
                      );

                      setSelectedEntityRecordId(
                        "",
                      );

                      setSearch(
                        "",
                      );
                    }
                  }
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="">
                    Choose Entity Type
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

              <label className="grid gap-2">
                <span className="text-sm font-medium">
                  Search Entity
                </span>

                <input
                  value={
                    search
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setSearch(
                        event.target.value,
                      )
                  }
                  placeholder="Name / code / imported value"
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium">
                  Exact Entity
                </span>

                <select
                  required
                  disabled={
                    searching
                  }
                  value={
                    selectedEntityRecordId
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setSelectedEntityRecordId(
                        event.target.value,
                      )
                  }
                  className="h-11 rounded-xl border bg-background px-3 text-sm disabled:opacity-60"
                >
                  <option value="">
                    {
                      searching
                        ? "Searching..."
                        : "Choose exactly one Entity"
                    }
                  </option>

                  {records.map(
                    (
                      record,
                    ) => (
                      <option
                        key={
                          record.id
                        }
                        value={
                          record.id
                        }
                      >
                        {
                          recordLabel(
                            record,
                            selectedType,
                          )
                        }

                        {
                          record.externalKey
                            ? ` · ${record.externalKey}`
                            : ""
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </section>


          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}


          <button
            type="submit"
            disabled={
              creating ||
              !selectedEntityRecordId
            }
            className="h-11 rounded-xl bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {
              creating
                ? "Creating..."
                : "Create Campaign"
            }
          </button>
        </form>
      </section>


      <section className="rounded-2xl border bg-card">
        <div className="border-b p-5">
          <h2 className="font-semibold">
            Campaigns
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            The Campaign Entity automatically becomes the Entity of every QR in its Batch.
          </p>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">
            Loading Campaigns...
          </div>
        ) : (
          <div className="divide-y">
            {campaigns.map(
              (
                campaign,
              ) => {
                const entityCount =
                  campaign
                    .eligibleEntities
                    ?.length ??
                  0;

                const entity =
                  entityCount ===
                  1
                    ? campaign
                        .eligibleEntities[0]
                    : null;

                const hasBatchHistory =
                  Number(
                    campaign.batchCount ??
                      0,
                  ) >
                  0;

                return (
                  <div
                    key={
                      campaign.id
                    }
                    className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">
                          {
                            campaign.name
                          }
                        </div>

                        <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {
                            campaign.status
                          }
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-muted-foreground">
                        {
                          money(
                            campaign.rewardAmountMinor,
                          )
                        }
                        {" · expires "}
                        {
                          new Date(
                            campaign.expiresAt,
                          ).toLocaleString(
                            "en-IN",
                          )
                        }
                      </div>

                      <div className="mt-3 rounded-xl border bg-muted/10 p-3">
                        {entity ? (
                          <>
                            <div className="text-xs uppercase text-muted-foreground">
                              {
                                entity.entityTypeName
                              }
                            </div>

                            <div className="mt-1 text-sm font-semibold">
                              {
                                entity.label
                              }
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-destructive">
                              {
                                entityCount ===
                                0
                                  ? "No Entity assigned"
                                  : `Legacy Campaign has ${entityCount} Entities`
                              }
                            </div>

                            <div className="mt-1 text-xs text-muted-foreground">
                              {
                                hasBatchHistory
                                  ? "Existing QR history is preserved and cannot be rewritten."
                                  : "Choose one Entity above, then normalize this Campaign."
                              }
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {
                          Number(
                            campaign.batchCount ??
                              0,
                          )
                        } batch history
                      </span>

                      {!hasBatchHistory && (
                        <button
                          type="button"
                          disabled={
                            !selectedEntityRecordId ||
                            bindingCampaignId ===
                              campaign.id
                          }
                          onClick={
                            () =>
                              void normalizeCampaign(
                                campaign,
                              )
                          }
                          className="h-9 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
                        >
                          {
                            bindingCampaignId ===
                              campaign.id
                              ? "Saving..."
                              : entity
                                ? "Replace Entity"
                                : "Normalize Entity"
                          }
                        </button>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </section>
    </div>
  );
}
