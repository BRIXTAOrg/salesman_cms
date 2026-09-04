"use client";

import {
  useEffect,
  useState,
} from "react";


type VoucherRecord = {
  id: string;

  serialNumber: number;

  status: string;

  expiresAt: string;

  claimedByUserId:
    | number
    | null;

  claimedAt:
    | string
    | null;

  batchId: string;
  batchCode: string;

  rewardAmountMinor: number;
  currency: string;

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


export function VoucherRecordsTable({
  batchId,
}: {
  batchId: string;
}) {
  const [
    rows,
    setRows,
  ] = useState<VoucherRecord[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  );

  const [
    error,
    setError,
  ] = useState(
    "",
  );


  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        try {
          const response =
            await fetch(
              `/api/qr-rewards/vouchers?batchId=${encodeURIComponent(
                batchId,
              )}&limit=1000`,
              {
                cache:
                  "no-store",
              },
            );

          const body =
            await response.json();

          if (!response.ok) {
            throw new Error(
              body?.error ||
                "Could not load QR records.",
            );
          }

          if (!cancelled) {
            setRows(
              body.vouchers ??
                [],
            );
          }
        } catch (cause) {
          if (!cancelled) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load QR records.",
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(
              false,
            );
          }
        }
      }

      void load();

      return () => {
        cancelled =
          true;
      };
    },
    [
      batchId,
    ],
  );


  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
        Loading individual QR records...
      </div>
    );
  }


  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }


  if (!rows.length) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
        No voucher records were found.
      </div>
    );
  }


  const first =
    rows[0];


  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Batch
        </div>

        <div className="mt-1 text-xl font-semibold">
          {
            first.batchCode
          }
        </div>

        <div className="mt-2 text-sm text-muted-foreground">
          {
            first.campaignName
          }
          {" · "}
          {
            money(
              first.rewardAmountMinor,
            )
          }
          {" per QR"}
        </div>
      </section>


      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-[80px_1fr_130px_160px_160px] gap-4 border-b bg-muted/30 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div>
            #
          </div>

          <div>
            Voucher ID
          </div>

          <div>
            Status
          </div>

          <div>
            Claimant
          </div>

          <div>
            Claimed
          </div>
        </div>


        <div className="divide-y">
          {rows.map(
            (
              voucher,
            ) => (
              <div
                key={
                  voucher.id
                }
                className="grid grid-cols-[80px_1fr_130px_160px_160px] gap-4 px-5 py-3 text-sm"
              >
                <div className="font-medium">
                  {
                    voucher.serialNumber
                  }
                </div>

                <div className="truncate font-mono text-xs text-muted-foreground">
                  {
                    voucher.id
                  }
                </div>

                <div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {
                      voucher.status
                    }
                  </span>
                </div>

                <div className="text-muted-foreground">
                  {
                    voucher.claimedByUserId
                      ? `User ${voucher.claimedByUserId}`
                      : "—"
                  }
                </div>

                <div className="text-xs text-muted-foreground">
                  {
                    voucher.claimedAt
                      ? new Date(
                          voucher.claimedAt,
                        ).toLocaleString(
                          "en-IN",
                        )
                      : "—"
                  }
                </div>
              </div>
            ),
          )}
        </div>
      </div>


      {rows.length ===
        1000 && (
        <div className="text-xs text-muted-foreground">
          Showing first 1,000 records in this batch.
        </div>
      )}
    </div>
  );
}
