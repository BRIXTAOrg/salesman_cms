import type {
  KernelCaptureKind,
} from "@/lib/responsibility-kernel-types";

/**
 * BRIXTA APP BUILDER EXTENSION REGISTRY V1
 *
 * This registry is for NEW / SPECIAL phone-facing UI capability blocks.
 *
 * Existing primitive blocks such as Text, Number, Photo, GPS, Route,
 * Action, Output, etc. remain sourced from the Kernel catalogs.
 *
 * Upcoming capabilities should be registered here rather than hard-coded
 * into responsibility-app-builder.tsx.
 */
export type ResponsibilityAppBuilderRegisteredBlock = {
  /**
   * Stable machine identifier.
   *
   * NEVER rename this after Responsibilities begin using it.
   */
  key: string;

  /**
   * Friendly label shown in the App Builder palette.
   */
  label: string;

  description: string;

  /**
   * Underlying stable Kernel capture primitive.
   *
   * Rich native behavior belongs in config.nativeCapability.
   */
  kind: KernelCaptureKind;

  /**
   * Search phrases used by the App Builder and AI context.
   */
  keywords: string[];

  /**
   * Runtime / phone configuration.
   *
   * Example:
   *
   * {
   *   nativeCapability: "temperature_sensor",
   *   valueSource: "native_phone"
   * }
   */
  config: Record<string, unknown>;

  /**
   * Stable BRIXTA Platform Capability identifier.
   *
   * Example:
   *
   *   platformCapability: "qr.scan"
   *
   * App Builder metadata describes the block.
   * Platform Capability Registry describes whether
   * the actual runtime implementation exists.
   */
  platformCapability?: string;

  /**
   * Documentation for AI + Impact Review.
   *
   * These fields do not magically implement native code.
   * They describe the contract of an installed adapter.
   */
  runtime?: {
    android?: "supported" | "experimental" | "not_installed";
    ios?: "supported" | "experimental" | "not_installed";
    backend?: "supported" | "experimental" | "not_installed";
  };

  compliance?: {
    permissions?: string[];
    persistentDisclosure?: boolean;
    foregroundNotificationRequired?: boolean;
    userVisibleStartRequired?: boolean;
    notes?: string[];
  };

  resources?: {
    profile?: "efficient" | "balanced" | "high_accuracy";
    minimumIntervalSeconds?: number;
    recommendedIntervalSeconds?: number;
    maxInMemoryItems?: number;
    notes?: string[];
  };
};

export function defineResponsibilityAppBuilderBlock(
  block: ResponsibilityAppBuilderRegisteredBlock,
): ResponsibilityAppBuilderRegisteredBlock {
  return block;
}

/**
 * ---------------------------------------------------------------------
 * ADD FUTURE APP-BUILDER BLOCKS HERE.
 * ---------------------------------------------------------------------
 *
 * Example:
 *
 * defineResponsibilityAppBuilderBlock({
 *   key: "temperature_sensor",
 *   label: "Temperature Sensor",
 *   description: "Read temperature from an installed phone/device adapter.",
 *   kind: "number",
 *   keywords: ["temperature", "sensor", "heat", "cold"],
 *   config: {
 *     nativeCapability: "temperature_sensor",
 *     valueSource: "native_phone",
 *     unit: "celsius",
 *   },
 *   runtime: {
 *     android: "supported",
 *     ios: "not_installed",
 *     backend: "supported",
 *   },
 *   compliance: {
 *     permissions: [],
 *     persistentDisclosure: false,
 *     foregroundNotificationRequired: false,
 *     userVisibleStartRequired: false,
 *   },
 *   resources: {
 *     profile: "efficient",
 *     recommendedIntervalSeconds: 30,
 *     maxInMemoryItems: 100,
 *   },
 * }),
 *
 * IMPORTANT:
 *
 * Registering a block here exposes it to CMS + AI.
 * If it needs native Android/iOS functionality, the corresponding mobile
 * runtime adapter must also actually exist before marking it supported.
 */
export const RESPONSIBILITY_APP_BUILDER_BLOCKS:
  ResponsibilityAppBuilderRegisteredBlock[] = [
];
