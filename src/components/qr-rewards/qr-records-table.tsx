"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useState,
} from "react";


type BatchRecord = {
  id: string;
  batchCode: string;
  campaignName: string;
  quantity: number;
  voucherCount: number;
  availableCount: number;
  claimedCount: number;
  expiredCount: number;
  revokedCount: number;
  rewardAmountMinor: number;
  currency: string;
  expiresAt: string;
  status: string;
  createdAt: string;
};


function money(
  minor: number,
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
    },
  ).format(
    Number(
      minor,
    ) / 100,
  );
}


export function QrRecordsTable() {
  const [
    records,
    setRecords,
  ] = useState<BatchRecord[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              "/api/qr-rewards/batches",
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

          setRecords(
            body.batches ?? [],
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load QR records.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
        Loading QR records...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <div className="font-medium">
          QR Records are not provisioned
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {error}
        </p>

        <div className="mt-3 rounded-lg bg-muted p-3 font-mono text-xs">
          npm run qr-rewards:provision
        </div>
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No QR batches minted yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {records.map(
        (record) => (
          <section
            key={record.id}
            className="rounded-2xl border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {
                    record.campaignName
                  }
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {
                    record.batchCode
                  }
                </div>

                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {
                    record.id
                  }
                </div>
              </div>

              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {
                  record.status
                }
              </span>
            </div>

            <div className="mt-5 flex justify-end">
              <Link
                href={`/dashboard/qr-rewards/batches/${record.id}`}
                className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                View individual QR records
              </Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat
                label="Reward"
                value={money(
                  record.rewardAmountMinor,
                )}
              />

              <Stat
                label="Minted"
                value={String(
                  record.voucherCount,
                )}
              />

              <Stat
                label="Available"
                value={String(
                  record.availableCount,
                )}
              />

              <Stat
                label="Claimed"
                value={String(
                  record.claimedCount,
                )}
              />

              <Stat
                label="Expired"
                value={String(
                  record.expiredCount,
                )}
              />

              <Stat
                label="Expires"
                value={new Date(
                  record.expiresAt,
                ).toLocaleDateString(
                  "en-IN",
                )}
              />
            </div>
          </section>
        ),
      )}
    </div>
  );
}


function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}
