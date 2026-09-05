"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";


type Json =
  Record<
    string,
    unknown
  >;


function objectValue(
  value: unknown,
): Json {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  )
    ? value as Json
    : {};
}


async function readJson(
  response:
    Response,
) {
  const body =
    await response
      .json()
      .catch(
        () => null,
      );

  if (
    !body ||
    typeof body !==
      "object"
  ) {
    throw new Error(
      "BRIXTA returned an invalid response.",
    );
  }

  if (
    !response.ok ||
    (
      body as Json
    ).success ===
      false
  ) {
    throw new Error(
      String(
        (
          body as Json
        ).error ||
          "Reward request failed.",
      ),
    );
  }

  return body as Json;
}


function money(
  amountMinor:
    unknown,
  currency:
    unknown,
) {
  const minor =
    Number(
      amountMinor,
    );

  if (
    !Number.isFinite(
      minor,
    )
  ) {
    return "Reward";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      style:
        "currency",

      currency:
        String(
          currency ||
            "INR",
        ),

      maximumFractionDigits:
        2,
    },
  ).format(
    minor /
      100,
  );
}


function mutationId() {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


export function PublicRewardClient({
  tenant,
  token,
}: {
  tenant: string;
  token: string;
}) {
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
    reward,
    setReward,
  ] =
    useState<
      Json | null
    >(
      null,
    );

  const [
    responsibilityKey,
    setResponsibilityKey,
  ] =
    useState(
      "",
    );

  const [
    externalSession,
    setExternalSession,
  ] =
    useState(
      "",
    );

  const [
    verifyAvailable,
    setVerifyAvailable,
  ] =
    useState(
      false,
    );

  const [
    name,
    setName,
  ] =
    useState(
      "",
    );

  const [
    mobile,
    setMobile,
  ] =
    useState(
      "",
    );

  const [
    upi,
    setUpi,
  ] =
    useState(
      "",
    );

  const [
    verification,
    setVerification,
  ] =
    useState<
      | "idle"
      | "verifying"
      | "verified"
      | "unavailable"
    >(
      "idle",
    );

  const [
    verificationMessage,
    setVerificationMessage,
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

        setVerification(
          "idle",
        );

        setVerificationMessage(
          "",
        );

        try {
          const qrResponse =
            await fetch(
              `/api/rewards-public/qr-rewards/${encodeURIComponent(
                tenant,
              )}/${encodeURIComponent(
                token,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const qrEnvelope =
            await readJson(
              qrResponse,
            );

          const resolved =
            objectValue(
              qrEnvelope.reward,
            );

          setReward(
            resolved,
          );

          if (
            resolved.outcome !==
              "ready"
          ) {
            return;
          }

          const mapping =
            objectValue(
              qrEnvelope.runtime,
            );

          const key =
            String(
              mapping
                .responsibilityKey ||
                "",
            );

          if (!key) {
            throw new Error(
              "This reward is not connected to a published public Reward Responsibility.",
            );
          }

          setResponsibilityKey(
            key,
          );

          const runtimeResponse =
            await fetch(
              `/api/rewards-public/runtime/${encodeURIComponent(
                tenant,
              )}/${encodeURIComponent(
                key,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const runtimeEnvelope =
            await readJson(
              runtimeResponse,
            );

          const runtime =
            objectValue(
              runtimeEnvelope.runtime,
            );

          const session =
            objectValue(
              runtimeEnvelope.session,
            );

          const sessionToken =
            String(
              session.token ||
                "",
            );

          if (
            !sessionToken
          ) {
            throw new Error(
              "Could not create a secure public reward session.",
            );
          }

          const actions =
            Array.isArray(
              runtime.actions,
            )
              ? runtime.actions
              : [];

          const hasVerify =
            actions.some(
              (
                raw,
              ) => {
                const action =
                  objectValue(
                    raw,
                  );

                return (
                  String(
                    action.id ||
                      "",
                  ) ===
                  "verify_upi"
                );
              },
            );

          setExternalSession(
            sessionToken,
          );

          setVerifyAvailable(
            hasVerify,
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Reward could not be loaded.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        tenant,
        token,
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


  async function pollService(
    requestId:
      string,
  ) {
    for (
      let attempt = 0;
      attempt < 30;
      attempt += 1
    ) {
      const response =
        await fetch(
          `/api/rewards-public/runtime/${encodeURIComponent(
            tenant,
          )}/${encodeURIComponent(
            responsibilityKey,
          )}/service-requests/${encodeURIComponent(
            requestId,
          )}`,
          {
            cache:
              "no-store",

            headers: {
              "x-brixta-external-session":
                externalSession,
            },
          },
        );

      const envelope =
        await readJson(
          response,
        );

      const service =
        objectValue(
          envelope.service,
        );

      const outcome =
        String(
          service.outcome ||
            "",
        );

      if (
        outcome ===
          "succeeded" ||
        outcome ===
          "failed"
      ) {
        return service;
      }

      await new Promise(
        (
          resolve,
        ) =>
          window.setTimeout(
            resolve,
            500,
          ),
      );
    }

    return {
      outcome:
        "failed",

      code:
        "VERIFICATION_STATUS_TIMEOUT",

      message:
        "UPI verification could not be confirmed.",
    };
  }


  async function verifyUpi() {
    if (
      verification ===
        "verifying"
    ) {
      return;
    }

    if (
      !upi.trim()
    ) {
      setError(
        "Enter your UPI ID.",
      );

      return;
    }

    if (
      !verifyAvailable ||
      !responsibilityKey ||
      !externalSession
    ) {
      setError(
        "UPI verification is not configured for this reward yet.",
      );

      return;
    }

    setError(
      "",
    );

    setVerification(
      "verifying",
    );

    setVerificationMessage(
      "",
    );

    try {
      const response =
        await fetch(
          `/api/rewards-public/runtime/${encodeURIComponent(
            tenant,
          )}/${encodeURIComponent(
            responsibilityKey,
          )}/actions/verify_upi`,
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",

              "x-brixta-external-session":
                externalSession,
            },

            body:
              JSON.stringify({
                clientMutationId:
                  mutationId(),

                recordId:
                  null,

                payload: {
                  name:
                    name.trim() ||
                    null,

                  mobile:
                    mobile.trim() ||
                    null,

                  upi:
                    upi.trim(),
                },

                device: {
                  platform:
                    "web",

                  route:
                    window
                      .location
                      .pathname,

                  metadata: {
                    publicRewardReact:
                      true,
                  },
                },
              }),
          },
        );

      const envelope =
        await readJson(
          response,
        );

      const effects =
        Array.isArray(
          envelope.effects,
        )
          ? envelope.effects
          : [];

      const requestId =
        effects
          .map(
            (
              raw,
            ) =>
              objectValue(
                objectValue(
                  raw,
                )
                  .serviceRequest,
              )
                .id,
          )
          .map(
            String,
          )
          .find(
            Boolean,
          );

      if (
        !requestId
      ) {
        throw new Error(
          "UPI verification did not create a provider service request.",
        );
      }

      const service =
        await pollService(
          requestId,
        );

      if (
        String(
          service.outcome ||
            "",
        ) ===
          "succeeded"
      ) {
        setVerification(
          "verified",
        );

        setVerificationMessage(
          String(
            service.message ||
              "UPI verification completed.",
          ),
        );

        return;
      }

      setVerification(
        "unavailable",
      );

      setVerificationMessage(
        String(
          service.message ||
            "UPI verification is unavailable because the payment provider could not complete the request.",
        ),
      );
    } catch (cause) {
      setVerification(
        "unavailable",
      );

      setVerificationMessage(
        cause instanceof Error
          ? cause.message
          : "UPI verification is temporarily unavailable.",
      );
    }
  }


  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />

          <div className="mt-4 text-sm font-medium">
            Opening your reward…
          </div>
        </div>
      </main>
    );
  }


  if (
    error &&
    !reward
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <TriangleAlert className="mx-auto h-9 w-9" />

          <h1 className="mt-4 text-xl font-semibold">
            Reward unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {
              error
            }
          </p>

          <button
            type="button"
            onClick={
              () =>
                void load()
            }
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" />

            Try again
          </button>
        </div>
      </main>
    );
  }


  const outcome =
    String(
      reward
        ?.outcome ||
        "",
    );


  if (
    outcome !==
      "ready"
  ) {
    const title =
      outcome ===
        "already_claimed"
        ? "Reward already claimed"
        : outcome ===
            "expired"
          ? "Reward expired"
          : outcome ===
              "revoked"
            ? "Reward unavailable"
            : "Reward cannot be redeemed";

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-9 w-9" />

          <h1 className="mt-4 text-xl font-semibold">
            {
              title
            }
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            {
              reward
                ?.campaignName
                ? String(
                    reward.campaignName,
                  )
                : "BRIXTA Reward"
            }
          </p>
        </div>
      </main>
    );
  }


  const entity =
    objectValue(
      reward
        ?.entity,
    );


  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          BRIXTA REWARDS
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-7 text-center">
            <div className="text-sm font-medium text-slate-500">
              Claim your reward
            </div>

            <div className="mt-2 text-4xl font-bold tracking-tight">
              {
                money(
                  reward
                    ?.rewardAmountMinor,

                  reward
                    ?.currency,
                )
              }
            </div>

            {
              Boolean(
                reward
                  ?.campaignName,
              ) && (
                <div className="mt-3 text-sm text-slate-600">
                  {
                    String(
                      reward?.campaignName ??
                        "",
                    )
                  }
                </div>
              )
            }

            {
              Boolean(
                entity
                  .entityLabel,
              ) && (
                <div className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                  {
                    entity
                      .entityTypeName
                      ? `${String(
                          entity.entityTypeName,
                        )}: `
                      : ""
                  }

                  {
                    String(
                      entity.entityLabel,
                    )
                  }
                </div>
              )
            }
          </div>


          <div className="grid gap-4 p-6">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                Name{" "}
                <span className="font-normal text-slate-400">
                  (optional)
                </span>
              </span>

              <input
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
                autoComplete="name"
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                Mobile{" "}
                <span className="font-normal text-slate-400">
                  (optional)
                </span>
              </span>

              <input
                value={
                  mobile
                }
                onChange={
                  (
                    event,
                  ) =>
                    setMobile(
                      event.target.value,
                    )
                }
                inputMode="tel"
                autoComplete="tel"
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                UPI ID *
              </span>

              <input
                value={
                  upi
                }
                onChange={
                  (
                    event,
                  ) =>
                    setUpi(
                      event.target.value,
                    )
                }
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="name@upi"
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>


            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {
                  error
                }
              </div>
            )}


            {
              verification ===
                "unavailable" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                    <div>
                      <div className="text-sm font-semibold text-amber-950">
                        We couldn&apos;t verify this UPI ID right now.
                      </div>

                      <div className="mt-1 text-sm leading-6 text-amber-800">
                        {
                          verificationMessage
                        }
                      </div>

                      <div className="mt-2 text-sm font-semibold text-amber-950">
                        Your reward has NOT been claimed.
                      </div>
                    </div>
                  </div>
                </div>
              )
            }


            {
              verification ===
                "verified" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                    <div>
                      <div className="text-sm font-semibold text-emerald-950">
                        UPI verified
                      </div>

                      <div className="mt-1 text-sm leading-6 text-emerald-800">
                        {
                          verificationMessage
                        }
                      </div>

                      <div className="mt-2 text-xs leading-5 text-emerald-800">
                        Claiming and payout are intentionally disabled in this milestone.
                      </div>
                    </div>
                  </div>
                </div>
              )
            }


            {
              verification !==
                "verified" && (
                <button
                  type="button"
                  disabled={
                    verification ===
                      "verifying" ||
                    !verifyAvailable
                  }
                  onClick={
                    () =>
                      void verifyUpi()
                  }
                  className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {
                    verification ===
                      "verifying"
                      ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />

                          Verifying UPI…
                        </>
                      )
                      : verification ===
                          "unavailable"
                        ? (
                          <>
                            <RefreshCw className="h-4 w-4" />

                            Try again
                          </>
                        )
                        : "Verify UPI"
                  }
                </button>
              )
            }


            {
              !verifyAvailable && (
                <div className="text-center text-xs leading-5 text-slate-500">
                  Publish the public{" "}
                  <strong>
                    verify_upi
                  </strong>{" "}
                  action to activate verification.
                </div>
              )
            }
          </div>


          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4" />

              Secure reward verification by BRIXTA
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
