import type {
  PixelLogicExecutionPlacement,
} from "@/lib/pixel-logic-types";

export type PixelLogicExecutionPolicy = {
  allowed: PixelLogicExecutionPlacement[];
  recommended: PixelLogicExecutionPlacement;
  reason: string;
};

export const CLIENT_SAFE_PIXEL_EFFECTS = new Set([
  "effect.ui_animate",
  "effect.ui_show",
  "effect.ui_hide",
  "effect.ui_play",
  "effect.haptic",
  "effect.device_sound",
  "effect.device_ring",
  "effect.device_notification",
]);

const AUTO_DEVICE_EFFECTS = new Set([
  "effect.ui_animate",
  "effect.ui_show",
  "effect.ui_hide",
  "effect.ui_play",
  "effect.haptic",
  "effect.device_sound",
]);

export function pixelLogicExecutionPolicy(
  type: string,
): PixelLogicExecutionPolicy {
  if (
    CLIENT_SAFE_PIXEL_EFFECTS.has(
      type,
    )
  ) {
    const fastByDefault =
      AUTO_DEVICE_EFFECTS.has(
        type,
      );

    return {
      allowed: [
        "auto",
        "device",
        "server",
      ],

      recommended:
        fastByDefault
          ? "device"
          : "server",

      reason:
        fastByDefault
          ? "Safe presentation/device feedback may run immediately in Flutter; the backend still re-evaluates the published graph."
          : "This is client-safe feedback, but displaying it before server acceptance could mislead the employee. Server is the safer default.",
    };
  }

  if (
    type.startsWith(
      "effect.",
    ) ||
    type.startsWith(
      "integration.",
    ) ||
    type ===
      "event.schedule"
  ) {
    return {
      allowed: [
        "auto",
        "server",
      ],

      recommended:
        "server",

      reason:
        "This node can affect business state, persistence, authority, integrations, scheduling or audit and cannot be device-only.",
    };
  }

  return {
    allowed: [
      "auto",
      "device",
      "server",
    ],

    recommended:
      "auto",

    reason:
      "Pure event/value/calculation/control logic can participate in local evaluation for responsiveness, while the backend re-evaluates it for business truth.",
  };
}

export function pixelLogicExecutionAIContext() {
  return {
    field: {
      execution: {
        placement:
          "auto | device | server",

        rationale:
          "Short reason for the chosen host.",
      },
    },

    hardRules: [
      "Authorization, money, uniqueness, approvals, persistence, assignments, record mutation, integrations, scheduling and audit truth must never be device-only.",

      "Device execution is an optimization/presentation layer, never business authority.",

      "The backend always re-evaluates the published graph during authoritative action execution.",

      "Use server placement for feedback that would falsely imply success before the server accepts the action.",
    ],

    clientSafeEffects: [
      ...CLIENT_SAFE_PIXEL_EFFECTS,
    ],
  };
}
