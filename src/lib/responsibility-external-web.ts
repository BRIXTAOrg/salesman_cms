import type {
  ResponsibilityExternalWebDelivery,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";


export const DEFAULT_EXTERNAL_WEB_DELIVERY:
  ResponsibilityExternalWebDelivery = {
    enabled: false,

    runtime:
      "flutter_web",

    access:
      "public",

    tenantKey:
      "",

    routePattern:
      "/x/{tenant}/{responsibility}",

    allowedCapabilities:
      [],

    description:
      "",
  };


export const QR_REWARD_EXTERNAL_CAPABILITIES = [
  "qrReward.resolve",
  "qrReward.preflight",
  "entity.listEligible",
  "upi.validate",
  "voucher.claimPublic",
  "payout.request",
  "payout.getStatus",
] as const;


/*
 * These are employee/native-runtime capabilities that must
 * NOT silently be treated as supported by the anonymous
 * Flutter-Web runtime.
 */
const UNSUPPORTED_EXTERNAL_NATIVE =
  new Set([
    "live_location",
    "route_tracker",
    "geofence",
    "step_counter",
    "activity_recognition",
    "accelerometer",
    "gyroscope",
    "bluetooth_scan",
    "nfc",
    "biometric_auth",
    "health_steps",
    "health_distance",
  ]);


/*
 * These MAY be implemented by the browser host, but their
 * semantics differ from installed mobile/native behavior.
 */
const LIMITED_EXTERNAL_NATIVE =
  new Set([
    "current_location",
    "camera",
    "video_capture",
    "voice_note",
    "document_scan",
    "file_picker",
    "qr_scanner",
    "barcode_scanner",
    "device_clock",
    "connectivity",
  ]);


export type ExternalWebCompatibilityIssue = {
  severity:
    | "error"
    | "warning";

  code: string;

  message: string;
};


export function externalWebDelivery(
  kernel: ResponsibilityKernel,
): ResponsibilityExternalWebDelivery {
  return {
    ...DEFAULT_EXTERNAL_WEB_DELIVERY,

    ...(
      kernel.metadata
        .deliveryTargets
        ?.externalWeb ??
      {}
    ),

    allowedCapabilities: [
      ...(
        kernel.metadata
          .deliveryTargets
          ?.externalWeb
          ?.allowedCapabilities ??
        []
      ),
    ],
  };
}


export function externalWebCompatibility(
  kernel: ResponsibilityKernel,
): ExternalWebCompatibilityIssue[] {
  const config =
    externalWebDelivery(
      kernel,
    );

  const issues:
    ExternalWebCompatibilityIssue[] = [];


  if (
    config.enabled &&
    !config.tenantKey.trim()
  ) {
    issues.push({
      severity:
        "error",

      code:
        "external_web.tenant_missing",

      message:
        "External Link is enabled but no tenant routing key is configured.",
    });
  }


  if (
    config.enabled &&
    !config.routePattern
      .trim()
      .startsWith("/")
  ) {
    issues.push({
      severity:
        "error",

      code:
        "external_web.route_invalid",

      message:
        "External route pattern must begin with '/'.",
    });
  }


  if (
    config.access ===
      "public"
  ) {
    const employeeContexts =
      kernel.runtimeWorld
        .contexts
        .filter(
          (context) =>
            [
              "current_user",
              "current_manager",
            ].includes(
              context.source,
            ),
        );

    for (
      const context of
      employeeContexts
    ) {
      issues.push({
        severity:
          "warning",

        code:
          "external_web.employee_context",

        message:
          `"${context.label}" depends on an authenticated employee and will not exist for an anonymous public visitor.`,
      });
    }


    const employeeActors =
      kernel.runtimeWorld
        .actors
        .filter(
          (actor) =>
            actor.resolver
              .kind ===
            "current_user",
        );

    for (
      const actor of
      employeeActors
    ) {
      issues.push({
        severity:
          "warning",

        code:
          "external_web.employee_actor",

        message:
          `"${actor.label}" resolves from the BRIXTA employee session. Public External Link flows should not depend on it.`,
      });
    }
  }


  for (
    const possibility of
    kernel.possibilities
  ) {
    if (
      possibility.type !==
      "capture"
    ) {
      continue;
    }

    const native =
      typeof possibility
        .capture
        .config
        .nativeCapability ===
        "string"
        ? possibility
            .capture
            .config
            .nativeCapability
        : "";

    if (!native) {
      continue;
    }


    if (
      UNSUPPORTED_EXTERNAL_NATIVE
        .has(
          native,
        )
    ) {
      issues.push({
        severity:
          "error",

        code:
          "external_web.native_unsupported",

        message:
          `"${possibility.capture.label}" requires native capability "${native}", which is not supported by the public Flutter-Web runtime.`,
      });

      continue;
    }


    if (
      LIMITED_EXTERNAL_NATIVE
        .has(
          native,
        )
    ) {
      issues.push({
        severity:
          "warning",

        code:
          "external_web.native_limited",

        message:
          `"${possibility.capture.label}" uses "${native}". Browser support requires the External Runtime adapter and may require a user gesture/permission.`,
      });
    }
  }


  return issues;
}


export function externalWebUrlPreview(
  origin: string,
  kernel: ResponsibilityKernel,
  responsibilitySlug: string,
) {
  const config =
    externalWebDelivery(
      kernel,
    );

  const base =
    origin.replace(
      /\/+$/,
      "",
    );

  const path =
    (
      config.routePattern ||
      "/x/{tenant}/{responsibility}"
    )
      .replaceAll(
        "{tenant}",
        config.tenantKey ||
          "<tenant>",
      )
      .replaceAll(
        "{responsibility}",
        responsibilitySlug ||
          "<responsibility>",
      )
      .replaceAll(
        "{token}",
        "<token>",
      );

  return `${base}${path}`;
}
