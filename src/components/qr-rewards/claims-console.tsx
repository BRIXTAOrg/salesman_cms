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

  requestId: string;

  userId: number;

  claimedAt: string;

  voucherId: string;

  serialNumber: number;

  batchId: string;
  batchCode: string;

  rewardAmountMinor: number;

  currency: string;

  campaignId: string;
  campaignName: string;
};


function money(
  amountMinor: number,
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
      amountMinor,
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
    >(
      [],
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
                "Could not load Claims ledger.",
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
              : "Could not load Claims ledger.",
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

            requestId:
              claim.requestId,
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
      <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
        Loading Claims ledger...
      </div>
    );
  }


  if (
    error
  ) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }


  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">
            Claims ledger
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Every successful one-time QR redemption.
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


      {rows.length ? (
        <GenericJsonTable
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
          No successful claims yet.
        </div>
      )}
    </div>
  );
}
