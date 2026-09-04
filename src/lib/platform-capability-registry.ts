export type PlatformRuntimeStatus =
  | "supported"
  | "experimental"
  | "not_installed";

export type PlatformCapabilityKind =
  | "native"
  | "service"
  | "integration"
  | "administration";

export type PlatformCapabilityRuntime = {
  cms: PlatformRuntimeStatus;
  android: PlatformRuntimeStatus;
  ios: PlatformRuntimeStatus;
  backend: PlatformRuntimeStatus;
};

export type PlatformCapabilityDefinition = {
  key: string;
  label: string;
  description: string;
  kind: PlatformCapabilityKind;

  runtime: PlatformCapabilityRuntime;

  nativeCapability?: string;
  privileged?: boolean;
  permissions?: string[];
  notes?: string[];
};

const CAPABILITIES =
  new Map<string, PlatformCapabilityDefinition>();

export function registerPlatformCapability(
  capability: PlatformCapabilityDefinition,
) {
  const key = capability.key.trim();

  if (!key) {
    throw new Error("Platform capability key is required.");
  }

  if (CAPABILITIES.has(key)) {
    throw new Error(`Duplicate platform capability: ${key}`);
  }

  CAPABILITIES.set(key, {
    ...capability,
    key,
  });

  return capability;
}

export function getPlatformCapability(key: string) {
  return CAPABILITIES.get(key);
}

export function listPlatformCapabilities() {
  return [...CAPABILITIES.values()].sort(
    (a, b) => a.key.localeCompare(b.key),
  );
}

export function platformCapabilityIsSupported(
  key: string,
  runtime: keyof PlatformCapabilityRuntime,
) {
  return getPlatformCapability(key)?.runtime[runtime] === "supported";
}


/*
 * ==========================================================
 * QR REWARDS EDITION CAPABILITY TRUTH
 * ==========================================================
 *
 * Do not mark a capability supported until the real runtime
 * implementation exists.
 */

registerPlatformCapability({
  key: "qr.scan",
  label: "QR Scanner",
  description:
    "Capture a QR payload from the BRIXTA mobile application.",
  kind: "native",
  nativeCapability: "qr_scanner",
  permissions: ["camera"],

  runtime: {
    cms: "supported",
    android: "not_installed",
    ios: "not_installed",
    backend: "supported",
  },

  notes: [
    "CMS and Kernel already understand QR capture.",
    "Mobile remains not_installed until its scanner adapter is implemented.",
  ],
});


registerPlatformCapability({
  key: "voucher.batch.generate",
  label: "Generate Voucher Batch",
  description:
    "Generate cryptographically unique bearer reward vouchers.",
  kind: "service",
  privileged: true,

  runtime: {
    cms: "supported",
    android: "not_installed",
    ios: "not_installed",
    backend: "not_installed",
  },
});


registerPlatformCapability({
  key: "voucher.claim",
  label: "Claim Voucher",
  description:
    "Atomically assign an unused voucher to its first valid claimant.",
  kind: "service",
  privileged: true,

  runtime: {
    cms: "supported",
    android: "not_installed",
    ios: "not_installed",
    backend: "not_installed",
  },

  notes: [
    "One voucher may have only one successful claim.",
    "Single-use must be enforced server-side.",
    "Claiming must be safe under concurrent scans.",
  ],
});


registerPlatformCapability({
  key: "payout.sandbox",
  label: "BRIXTA Payout Sandbox",
  description:
    "Simulate payouts without moving real money.",
  kind: "service",
  privileged: true,

  runtime: {
    cms: "not_installed",
    android: "not_installed",
    ios: "not_installed",
    backend: "not_installed",
  },
});


registerPlatformCapability({
  key: "payout.request",
  label: "Request Payout",
  description:
    "Create an idempotent payout intent using a configured provider.",
  kind: "service",
  privileged: true,

  runtime: {
    cms: "not_installed",
    android: "not_installed",
    ios: "not_installed",
    backend: "not_installed",
  },
});


registerPlatformCapability({
  key: "integration.rest.execute",
  label: "REST Integration Runtime",
  description:
    "Execute registered declarative REST operations using server secrets.",
  kind: "integration",
  privileged: true,

  runtime: {
    cms: "not_installed",
    android: "not_installed",
    ios: "not_installed",
    backend: "not_installed",
  },
});


registerPlatformCapability({
  key: "integration.webhook.receive",
  label: "Webhook Runtime",
  description:
    "Receive and authenticate registered external webhook events.",
  kind: "integration",
  privileged: true,

  runtime: {
    cms: "not_installed",
    android: "not_installed",
    ios: "not_installed",
    backend: "not_installed",
  },
});
