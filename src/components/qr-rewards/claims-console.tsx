"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  RefreshCw,
} from "lucide-react";

import {
  GenericJsonTable,
  type GenericJsonRow,
} from "@/components/generic-json-table";


type ClaimRecord = {
  id: string;

  campaignName: string;

  batchCode: string;

  serialNumber: number;

  userId: number;

  rewardAmountMinor: number;

  entityTypeName:
    | string
    | null;

  entityName:
    | string
    | null;

  claimedAt: string;
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
    },
  ).format(
    Number(
      minor,
    ) / 100,
  );
}


export function ClaimsConsole() {
  const [
    claims,
    setClaims,
  ] =
    useState<
      ClaimRecord[]
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
              "/api/qr-rewards/claims",
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
                "Could not load Claims.",
            );
          }

          setClaims(
            body.claims ??
              [],
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load Claims.",
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


  const rows =
    useMemo<
      GenericJsonRow[]
    >(
      () =>
        claims.map(
          (
            claim,
          ) => ({
            id:
              claim.id,

            campaign:
              claim.campaignName,

            batch:
              claim.batchCode,

            qr:
              `#${claim.serialNumber}`,

            entityType:
              claim.entityTypeName ??
              "—",

            entity:
              claim.entityName ??
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
        claims,
      ],
    );


  if (
    loading
  ) {
    return (
      <div className="rounded-2xl border p-8 text-sm text-muted-foreground">
        Loading Claims ledger...
      </div>
    );
  }


  if (
    error
  ) {
    return (
      <div className="rounded-2xl border p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }


  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">
            Claims ledger
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Campaign, QR, claimant and BRIXTA Entity attribution.
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

      {rows.length ? (
        <GenericJsonTable
          title="Claims Ledger"
          data={
            rows
          }
          columns={[
            {
              key:
                "campaign",
              label:
                "Campaign",
            },

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
        <div className="rounded-2xl border p-8 text-sm text-muted-foreground">
          No successful Claims yet.
        </div>
      )}
    </div>
  );
}
