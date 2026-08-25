import type { ResponsibilityExtensionConfig } from "@/lib/platform-vnext-types";
import {
  RESPONSIBILITY_KERNEL_METADATA_KEY,
  type ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

export type ResponsibilityKernelSanitizationReport = {
  removedEventIds: string[];
  removedRuleIds: string[];
};

/**
 * Removes impossible internal graph nodes.
 *
 * An action event is executable only when it points at an action that still
 * exists in kernel.possibilities. Orphan action events are therefore dead
 * graph nodes and their directly-owned rules can never execute.
 *
 * This intentionally DOES NOT repair legitimate non-action events such as
 * schedules, record_created, geofence, sync, timer, etc.
 */
export function sanitizeResponsibilityKernel(
  kernel: ResponsibilityKernel,
): {
  kernel: ResponsibilityKernel;
  report: ResponsibilityKernelSanitizationReport;
} {
  const validActionIds = new Set(
    kernel.possibilities
      .filter(
        (
          item,
        ): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "action" }
        > => item.type === "action",
      )
      .map((item) => item.action.id),
  );

  const orphanActionEvents = kernel.events.filter(
    (event) =>
      event.kind === "action" &&
      (!event.actionId || !validActionIds.has(event.actionId)),
  );

  if (orphanActionEvents.length === 0) {
    return {
      kernel,
      report: {
        removedEventIds: [],
        removedRuleIds: [],
      },
    };
  }

  const orphanEventIds = new Set(
    orphanActionEvents.map((event) => event.id),
  );

  const removedRuleIds = kernel.rules
    .filter(
      (rule) =>
        Boolean(rule.eventId) &&
        orphanEventIds.has(rule.eventId as string),
    )
    .map((rule) => rule.id);

  return {
    kernel: {
      ...kernel,

      events: kernel.events.filter(
        (event) => !orphanEventIds.has(event.id),
      ),

      rules: kernel.rules.filter(
        (rule) =>
          !rule.eventId ||
          !orphanEventIds.has(rule.eventId),
      ),
    },

    report: {
      removedEventIds: [...orphanEventIds],
      removedRuleIds,
    },
  };
}

/**
 * Sanitizes the Kernel stored inside Responsibility extension metadata.
 *
 * Keeping this at the extension boundary means old broken drafts repair
 * themselves when read, saved or published without weakening validation.
 */
export function sanitizeResponsibilityExtensionKernel(
  config: ResponsibilityExtensionConfig,
): {
  config: ResponsibilityExtensionConfig;
  report: ResponsibilityKernelSanitizationReport;
} {
  const metadata =
    config.metadata &&
    typeof config.metadata === "object" &&
    !Array.isArray(config.metadata)
      ? config.metadata
      : {};

  const candidate =
    metadata[RESPONSIBILITY_KERNEL_METADATA_KEY];

  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    (candidate as { kernelVersion?: unknown }).kernelVersion !== 3
  ) {
    return {
      config,
      report: {
        removedEventIds: [],
        removedRuleIds: [],
      },
    };
  }

  const sanitized = sanitizeResponsibilityKernel(
    candidate as ResponsibilityKernel,
  );

  if (
    sanitized.report.removedEventIds.length === 0 &&
    sanitized.report.removedRuleIds.length === 0
  ) {
    return {
      config,
      report: sanitized.report,
    };
  }

  return {
    config: {
      ...config,
      metadata: {
        ...metadata,
        [RESPONSIBILITY_KERNEL_METADATA_KEY]:
          sanitized.kernel,
      },
    },
    report: sanitized.report,
  };
}
