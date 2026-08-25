import type { RuntimeCapabilityDefinition } from "./runtime-types";

/**
 * Core capabilities are structurally protected from CMS shutdown.
 * Login belongs here: it is not merely "usually enabled"; CMS is not allowed
 * to turn it off.
 */
export const RUNTIME_CAPABILITY_REGISTRY: RuntimeCapabilityDefinition[] = [
  {
    key: "core.login",
    ownership: "core",
    cmsControllable: false,
    storesBusinessData: false,
    description: "Authentication/session bootstrap. Never CMS-controllable.",
  },

  {
    key: "native.attendance",
    ownership: "native",
    cmsControllable: true,
    storesBusinessData: true,
    replacementSlot: "attendance",
    description: "Legacy/native Attendance bundled in the Flutter APK.",
  },
  {
    key: "native.leave",
    ownership: "native",
    cmsControllable: true,
    storesBusinessData: true,
    replacementSlot: "leave",
    description: "Legacy/native Leave bundled in the Flutter APK.",
  },
  {
    key: "native.expense",
    ownership: "native",
    cmsControllable: true,
    storesBusinessData: true,
    replacementSlot: "expense",
    description: "Legacy/native Expense bundled in the Flutter APK.",
  },
  {
    key: "native.dealer_visit",
    ownership: "native",
    cmsControllable: true,
    storesBusinessData: true,
    replacementSlot: "dealer_visit",
    description: "Legacy/native Dealer Visit bundled in the Flutter APK.",
  },

  {
    key: "dynamic.responsibility_renderer",
    ownership: "dynamic",
    cmsControllable: true,
    storesBusinessData: true,
    description: "Generic Flutter renderer for CMS-published Responsibilities.",
  },
];

export function getRuntimeCapability(key: string) {
  return RUNTIME_CAPABILITY_REGISTRY.find((item) => item.key === key) ?? null;
}

export function isCmsControllableCapability(key: string) {
  return getRuntimeCapability(key)?.cmsControllable === true;
}

export function assertCmsCanControlCapability(key: string) {
  const capability = getRuntimeCapability(key);
  if (!capability) {
    throw new Error(`Unknown runtime capability: ${key}`);
  }
  if (!capability.cmsControllable) {
    throw new Error(
      `${key} is a protected core capability and cannot be disabled or replaced by CMS.`,
    );
  }
  return capability;
}
