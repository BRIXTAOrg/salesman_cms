"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";


type ClaimResult = {
  outcome:
    | "claimed"
    | "already_claimed"
    | "expired"
    | "revoked"
    | "unavailable"
    | "invalid"
    | "request_conflict";

  idempotent?: boolean;

  voucherId?: string;
  claimId?: string;

  batchCode?: string;

  campaignName?: string;

  serialNumber?: number;

  rewardAmountMinor?: number;
  currency?: string;

  claimedByUserId?: number;

  claimedAt?: string;
};


type ClaimHistory = {
  id: string;

  requestId: string;

  userId: number;

  claimedAt: string;

  voucherId: string;

  serialNumber: number;

  batchCode: string;

  rewardAmountMinor: number;

  currency: string;

  campaignName: string;
};


function requestId() {
  return (
    globalThis.crypto
      ?.randomUUID?.()
    ??
    `claim-${Date.now()}-${Math.random()}`
  );
}


function money(
  minor?: number,
) {
  if (
    typeof minor !==
    "number"
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      style:
        "currency",

      currency:
        "INR",
    },
  ).format(
    minor /
      100,
  );
}


export function ClaimsConsole() {
  const [
    qrPayload,
    setQrPayload,
  ] = useState(
    "",
  );

  const [
    currentRequestId,
    setCurrentRequestId,
  ] = useState(
    () =>
      requestId(),
  );

  const [
    result,
    setResult,
  ] = useState<ClaimResult | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(
    false,
  );

  const [
    error,
    setError,
  ] = useState(
    "",
  );

  const [
    claims,
    setClaims,
  ] = useState<ClaimHistory[]>(
    [],
  );


  const loadClaims =
    useCallback(
      async () => {
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
            response.ok
          ) {
            setClaims(
              body.claims ??
                [],
            );
          }
        } catch {
          // Claim tester remains usable.
        }
      },
      [],
    );


  useEffect(
    () => {
      void loadClaims();
    },
    [
      loadClaims,
    ],
  );


  function newRequest() {
    setCurrentRequestId(
      requestId(),
    );

    setResult(
      null,
    );

    setError(
      "",
    );
  }


  async function claim() {
    if (
      loading
    ) {
      return;
    }

    setLoading(
      true,
    );

    setError(
      "",
    );

    try {
      const response =
        await fetch(
          "/api/qr-rewards/claim",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                qrPayload,
                requestId:
                  currentRequestId,
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
            "Claim failed.",
        );
      }

      setResult(
        body.claim ??
          null,
      );

      await loadClaims();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Claim failed.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }


  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="grid content-start gap-4">
        <section className="rounded-2xl border bg-card">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              Atomic claim tester
            </h2>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Paste one qr_payload from a generated voucher manifest.
              This calls the same server-authoritative one-time claim engine.
            </p>
          </div>


          <div className="grid gap-5 p-5">
            <label className="grid gap-2">
              <div className="text-sm font-medium">
                QR payload
              </div>

              <textarea
                value={
                  qrPayload
                }
                onChange={
                  (
                    event,
                  ) => {
                    setQrPayload(
                      event.target.value,
                    );

                    setResult(
                      null,
                    );
                  }
                }
                rows={
                  4
                }
                placeholder="BRX:Q:1:..."
                className="w-full resize-none rounded-xl border bg-background p-3 font-mono text-xs outline-none"
              />
            </label>


            <div>
              <div className="text-sm font-medium">
                Idempotency request
              </div>

              <div className="mt-2 flex items-center gap-2 rounded-xl border bg-muted/30 p-3">
                <code className="min-w-0 flex-1 truncate text-xs">
                  {
                    currentRequestId
                  }
                </code>

                <button
                  type="button"
                  onClick={
                    () =>
                      navigator.clipboard.writeText(
                        currentRequestId,
                      )
                  }
                  className="rounded-lg p-2 hover:bg-muted"
                  title="Copy request ID"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Retrying with this SAME request ID returns the original
                successful claim. Use “New request” to test whether the
                same QR can be claimed a second time.
              </p>
            </div>


            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={
                  newRequest
                }
                className="flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium hover:bg-muted"
              >
                <RotateCcw className="h-4 w-4" />
                New request
              </button>

              <button
                type="button"
                disabled={
                  loading ||
                  !qrPayload.trim()
                }
                onClick={
                  () =>
                    void claim()
                }
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                Claim QR
              </button>
            </div>


            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </section>


        {result && (
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2">
              {result.outcome ===
              "claimed" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}

              <div className="text-lg font-semibold">
                {
                  result.outcome
                    .replace(
                      /_/g,
                      " ",
                    )
                    .toUpperCase()
                }
              </div>
            </div>


            {result.idempotent && (
              <div className="mt-3 rounded-lg bg-muted p-3 text-xs">
                Idempotent retry — this is the original successful claim,
                not a second redemption.
              </div>
            )}


            <dl className="mt-5 grid gap-3 text-sm">
              <Row
                label="Campaign"
                value={
                  result.campaignName ??
                  "—"
                }
              />

              <Row
                label="Batch"
                value={
                  result.batchCode ??
                  "—"
                }
              />

              <Row
                label="QR #"
                value={
                  result.serialNumber
                    ? String(
                        result.serialNumber,
                      )
                    : "—"
                }
              />

              <Row
                label="Reward"
                value={
                  money(
                    result.rewardAmountMinor,
                  )
                }
              />

              <Row
                label="Claimant"
                value={
                  result.claimedByUserId
                    ? `User ${result.claimedByUserId}`
                    : "—"
                }
              />
            </dl>
          </section>
        )}
      </div>


      <section className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="font-semibold">
              Successful claims
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Durable claim ledger.
            </p>
          </div>

          <button
            type="button"
            onClick={
              () =>
                void loadClaims()
            }
            className="rounded-lg border p-2 hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>


        {claims.length ===
        0 ? (
          <div className="p-8 text-sm text-muted-foreground">
            No successful claims yet.
          </div>
        ) : (
          <div className="divide-y">
            {claims.map(
              (
                claim,
              ) => (
                <div
                  key={
                    claim.id
                  }
                  className="p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">
                        {
                          claim.campaignName
                        }
                        {" · QR #"}
                        {
                          claim.serialNumber
                        }
                      </div>

                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {
                          claim.batchCode
                        }
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {
                          money(
                            Number(
                              claim.rewardAmountMinor,
                            ),
                          )
                        }
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        User {
                          claim.userId
                        }
                      </div>
                    </div>
                  </div>


                  <div className="mt-3 text-xs text-muted-foreground">
                    {new Date(
                      claim.claimedAt,
                    ).toLocaleString(
                      "en-IN",
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}


function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">
        {label}
      </dt>

      <dd className="text-right font-medium">
        {value}
      </dd>
    </div>
  );
}
