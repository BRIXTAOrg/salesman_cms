"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Globe2,
  Link2,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import type {
  ResponsibilityExternalWebAccess,
  ResponsibilityExternalWebDelivery,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

import {
  DEFAULT_EXTERNAL_WEB_DELIVERY,
  QR_REWARD_EXTERNAL_CAPABILITIES,
  externalWebCompatibility,
  externalWebDelivery,
  externalWebUrlPreview,
} from "@/lib/responsibility-external-web";

import {
  Field,
  inputClass,
  Panel,
  SecondaryButton,
  textareaClass,
} from "./primitives";


function slugify(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}


export default function ResponsibilityExternalLinkBuilder({
  responsibilityId,
  responsibilityTitle,
  kernel,
  onChange,
}: {
  responsibilityId: number;
  responsibilityTitle: string;
  kernel: ResponsibilityKernel;
  onChange:
    (
      kernel:
        ResponsibilityKernel,
    ) => void;
}) {
  const [
    copied,
    setCopied,
  ] =
    useState(
      false,
    );


  const config =
    externalWebDelivery(
      kernel,
    );


  const issues =
    useMemo(
      () =>
        externalWebCompatibility(
          kernel,
        ),
      [
        kernel,
      ],
    );


  const errorCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        "error",
    ).length;


  const warningCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        "warning",
    ).length;


  const externalOrigin =
    (
      process.env
        .NEXT_PUBLIC_BRIXTA_EXTERNAL_ORIGIN ||
      "https://rewards.brixta.com"
    );


  const urlPreview =
    externalWebUrlPreview(
      externalOrigin,
      kernel,
      slugify(
        responsibilityTitle,
      ) ||
        `responsibility-${responsibilityId}`,
    );


  function patch(
    values:
      Partial<
        ResponsibilityExternalWebDelivery
      >,
  ) {
    onChange({
      ...kernel,

      metadata: {
        ...kernel.metadata,

        deliveryTargets: {
          ...(
            kernel.metadata
              .deliveryTargets ??
            {}
          ),

          brixtaApp: {
            enabled:
              kernel.metadata
                .deliveryTargets
                ?.brixtaApp
                ?.enabled ??
              true,
          },

          externalWeb: {
            ...DEFAULT_EXTERNAL_WEB_DELIVERY,
            ...config,
            ...values,

            allowedCapabilities:
              values
                .allowedCapabilities ??
              config
                .allowedCapabilities,
          },
        },
      },
    });
  }


  function applyQrRewardPreset() {
    patch({
      enabled:
        true,

      runtime:
        "flutter_web",

      access:
        "public",

      routePattern:
        "/r/{tenant}/{token}",

      allowedCapabilities:
        [
          ...QR_REWARD_EXTERNAL_CAPABILITIES,
        ],

      description:
        "Public QR reward redemption opened from any phone camera or QR scanner. No BRIXTA installation required.",
    });
  }


  async function copyUrl() {
    try {
      await navigator
        .clipboard
        .writeText(
          urlPreview,
        );

      setCopied(
        true,
      );

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1200,
      );
    } catch {
      setCopied(
        false,
      );
    }
  }


  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe2 className="h-5 w-5" />

              <h2 className="text-lg font-semibold">
                External Link Builder
              </h2>
            </div>

            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Publish the same Responsibility UI and Pixel Logic through the lightweight BRIXTA Flutter-Web runtime instead of requiring the employee app.
            </p>
          </div>

          <SecondaryButton
            type="button"
            onClick={
              applyQrRewardPreset
            }
          >
            <WandSparkles className="h-4 w-4" />
            QR Reward preset
          </SecondaryButton>
        </div>


        <div className="mt-5 rounded-xl border bg-muted/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                External Web delivery
              </div>

              <div className="mt-0.5 text-xs text-muted-foreground">
                Same uiDocument. Same Responsibility. Different host.
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  config.enabled
                }
                onChange={
                  (
                    event,
                  ) =>
                    patch({
                      enabled:
                        event
                          .target
                          .checked,
                    })
                }
              />

              Enabled
            </label>
          </div>
        </div>


        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Field label="Access">
            <select
              className={
                inputClass
              }
              value={
                config.access
              }
              onChange={
                (
                  event,
                ) =>
                  patch({
                    access:
                      event
                        .target
                        .value as
                        ResponsibilityExternalWebAccess,
                  })
              }
            >
              <option value="public">
                Public — no BRIXTA login
              </option>

              <option value="optional_auth">
                Optional authentication
              </option>

              <option value="required_auth">
                BRIXTA authentication required
              </option>
            </select>
          </Field>


          <Field label="Runtime">
            <input
              className={
                inputClass
              }
              value="Flutter Web · BrixtaStacUi"
              disabled
            />
          </Field>


          <Field label="Tenant routing key">
            <input
              className={
                inputClass
              }
              value={
                config.tenantKey
              }
              onChange={
                (
                  event,
                ) =>
                  patch({
                    tenantKey:
                      event
                        .target
                        .value
                        .trim()
                        .toLowerCase()
                        .replace(
                          /[^a-z0-9_]/g,
                          "",
                        ),
                  })
              }
              placeholder="eurofoampillows"
            />
          </Field>


          <Field label="Route pattern">
            <input
              className={
                inputClass
              }
              value={
                config.routePattern
              }
              onChange={
                (
                  event,
                ) =>
                  patch({
                    routePattern:
                      event
                        .target
                        .value,
                  })
              }
              placeholder="/x/{tenant}/{responsibility}"
            />
          </Field>
        </div>


        <div className="mt-4">
          <Field label="Public service capabilities">
            <textarea
              className={
                textareaClass
              }
              rows={7}
              value={
                config
                  .allowedCapabilities
                  .join(
                    "\n",
                  )
              }
              onChange={
                (
                  event,
                ) =>
                  patch({
                    allowedCapabilities:
                      event
                        .target
                        .value
                        .split(
                          "\n",
                        )
                        .map(
                          (
                            value,
                          ) =>
                            value.trim(),
                        )
                        .filter(
                          Boolean,
                        ),
                  })
              }
              placeholder={
                [
                  "qrReward.resolve",
                  "voucher.claimPublic",
                  "payout.request",
                ].join(
                  "\n",
                )
              }
            />
          </Field>

          <p className="mt-1 text-[11px] text-muted-foreground">
            This is an authoring/deployment allow-list request. The browser never gains authority merely because a capability is written here; the backend public-service registry remains authoritative.
          </p>
        </div>


        <div className="mt-4">
          <Field label="Description">
            <textarea
              className={
                textareaClass
              }
              rows={3}
              value={
                config.description ??
                ""
              }
              onChange={
                (
                  event,
                ) =>
                  patch({
                    description:
                      event
                        .target
                        .value,
                  })
              }
              placeholder="What should an anonymous visitor be able to do?"
            />
          </Field>
        </div>
      </Panel>


      <Panel>
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />

          <div className="font-semibold">
            External URL
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 whitespace-normal break-all rounded-lg border bg-muted/20 px-3 py-2 text-xs">
            {urlPreview}
          </code>

          <SecondaryButton
            type="button"
            onClick={
              () =>
                void copyUrl()
            }
          >
            {
              copied
                ? (
                    <CheckCircle2 className="h-4 w-4" />
                  )
                : (
                    <Copy className="h-4 w-4" />
                  )
            }

            {
              copied
                ? "Copied"
                : "Copy"
            }
          </SecondaryButton>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          URL preview only until the External Runtime deployment endpoint is installed. For QR routes, {"{token}"} is supplied by the physical QR.
        </p>
      </Panel>


      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />

              <div className="font-semibold">
                External Web compatibility
              </div>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Public web deliberately exposes fewer capabilities than the installed employee runtime.
            </p>
          </div>

          <div className="flex gap-2 text-xs">
            <span className="rounded-full border px-2 py-1">
              {errorCount} blocking
            </span>

            <span className="rounded-full border px-2 py-1">
              {warningCount} warnings
            </span>
          </div>
        </div>


        {!issues.length ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />

            No known External Web incompatibilities.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {issues.map(
              (
                issue,
                index,
              ) => (
                <div
                  key={`${issue.code}-${index}`}
                  className="flex items-start gap-2 rounded-lg border p-3"
                >
                  <AlertTriangle
                    className={
                      issue.severity ===
                      "error"
                        ? "mt-0.5 h-4 w-4 shrink-0 text-destructive"
                        : "mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                    }
                  />

                  <div>
                    <div className="text-sm">
                      {
                        issue.message
                      }
                    </div>

                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {
                        issue.code
                      }
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </Panel>


      <Panel>
        <div className="text-sm font-semibold">
          Runtime contract
        </div>

        <pre className="mt-3 overflow-auto rounded-lg border bg-muted/20 p-3 text-[11px] leading-relaxed">
{JSON.stringify(
  {
    responsibilityId,
    deliveryTarget:
      "external_web",
    ...config,

    rendering: {
      engine:
        "brixta_stac_v1",
      source:
        "same Responsibility uiDocument",
      host:
        "lightweight Flutter-Web runtime",
    },

    security: {
      browserAuthority:
        false,
      serviceAllowList:
        config.allowedCapabilities,
    },
  },
  null,
  2,
)}
        </pre>
      </Panel>
    </div>
  );
}
