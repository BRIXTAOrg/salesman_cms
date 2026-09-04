import {
  getPlatformCapability,
} from "@/lib/platform-capability-registry";

export const QR_REWARDS_EDITION_KEY =
  "qr-voucher-rewards" as const;

export const QR_REWARDS_REQUIRED_CAPABILITIES = [
  "qr.scan",
  "voucher.batch.generate",
  "voucher.claim",
  "payout.sandbox",
  "payout.request",
  "integration.rest.execute",
  "integration.webhook.receive",
] as const;

export const QR_REWARDS_EDITION = {
  key: QR_REWARDS_EDITION_KEY,

  label: "BRIXTA QR Rewards",

  description:
    "Specialized BRIXTA CMS for unique bearer QR rewards, one-time claiming, printing and payouts.",

  features: [
    "campaigns",
    "voucher_batches",
    "mass_qr_generation",
    "claims",
    "sandbox",
    "payouts",
    "integrations",
  ],

  requiredCapabilities:
    QR_REWARDS_REQUIRED_CAPABILITIES,
} as const;


export function isQrRewardsEdition() {
  return (
    process.env.NEXT_PUBLIC_BRIXTA_EDITION ===
    QR_REWARDS_EDITION_KEY
  );
}


export function qrRewardsEditionReadiness() {
  return QR_REWARDS_REQUIRED_CAPABILITIES.map((key) => {
    const capability = getPlatformCapability(key);

    const runtime = capability?.runtime ?? {
      cms: "not_installed" as const,
      android: "not_installed" as const,
      ios: "not_installed" as const,
      backend: "not_installed" as const,
    };

    const mobileRequired = key === "qr.scan";

    return {
      key,
      label: capability?.label ?? key,
      runtime,

      ready:
        runtime.cms === "supported" &&
        runtime.backend === "supported" &&
        (
          !mobileRequired ||
          runtime.android === "supported" ||
          runtime.ios === "supported"
        ),
    };
  });
}


export function qrRewardsEditionIsReady() {
  return qrRewardsEditionReadiness()
    .every((capability) => capability.ready);
}
