import type {
  KernelEffect,
  KernelPossibility,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

import {
  BUILT_IN_SOURCE_KEYS,
} from "@/lib/responsibility-power-catalog";

export type KernelValidationIssue = {
  severity: "error" | "warning" | "good";
  code: string;
  message: string;
  target?: string;
};

export type KernelValidationOptions = {
  dataSourceKeys?: Iterable<string>;
};

function configString(
  config: Record<string, unknown>,
  key: string,
) {
  return typeof config[key] === "string"
    ? String(config[key]).trim()
    : "";
}

function effectIssue(effect: KernelEffect): KernelValidationIssue | null {
  if (effect.kind === "change_state") {
    if (!effect.targetKey || effect.value?.kind !== "literal" || !effect.value.value) {
      return {
        severity: "error",
        code: "EFFECT_STATE_UNCONFIGURED",
        message: "A Change State effect has no state dimension/new state configured.",
        target: effect.id,
      };
    }
  }

  if (["assign_actor", "notify_actor"].includes(effect.kind) && !effect.actorId) {
    return {
      severity: "error",
      code: "EFFECT_ACTOR_UNCONFIGURED",
      message: `${effect.kind === "assign_actor" ? "Assign" : "Notify"} Actor has no actor selected.`,
      target: effect.id,
    };
  }

  if (["set_context", "remove_context", "freeze_data"].includes(effect.kind) && !effect.targetKey) {
    return {
      severity: "warning",
      code: "EFFECT_TARGET_UNCONFIGURED",
      message: `${effect.kind.replace(/_/g, " ")} has no target configured.`,
      target: effect.id,
    };
  }

  return null;
}

export function validateResponsibilityKernel(
  kernel: ResponsibilityKernel,
  validationOptions: KernelValidationOptions = {},
): KernelValidationIssue[] {
  const issues: KernelValidationIssue[] = [];
  const captures = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "capture" }> => item.type === "capture",
  );
  const actions = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "action" }> => item.type === "action",
  );
  const outputs = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "output" }> => item.type === "output",
  );

  const captureIds = new Set(captures.map((item) => item.capture.id));
  const actorIds = new Set(kernel.runtimeWorld.actors.map((item) => item.id));
  const objectIds = new Set(kernel.runtimeWorld.objects.map((item) => item.id));
  const stateIds = new Set(kernel.runtimeWorld.states.map((item) => item.id));
  const actionIds = new Set(actions.map((item) => item.action.id));

  const knownDataSourceKeys =
    validationOptions.dataSourceKeys
      ? new Set([
          ...validationOptions.dataSourceKeys,
          ...BUILT_IN_SOURCE_KEYS,
        ])
      : null;

  const storageKeys =
    new Map<string, string>();

  const initialStates =
    kernel.runtimeWorld.states.filter(
      (state) => state.initial,
    );

  if (initialStates.length === 0) {
    issues.push({
      severity: "error",
      code: "NO_INITIAL_STATE",
      message: "Choose one initial process state so Run/Preview knows where the Responsibility begins.",
    });
  }

  if (initialStates.length > 1) {
    issues.push({
      severity: "error",
      code: "MULTIPLE_INITIAL_STATES",
      message: "Only one process state can be the initial state.",
    });
  }

  if (captures.length === 0 && actions.length === 0) {
    issues.push({
      severity: "warning",
      code: "NO_APP_INTERACTION",
      message: "The employee app has no capture or action yet.",
    });
  }

  for (const item of captures) {
    if (!item.capture.label.trim()) {
      issues.push({ severity: "error", code: "CAPTURE_NO_LABEL", message: "A capture block has no label.", target: item.id });
    }
    const storageKey =
      item.capture.storeAs?.trim() ?? "";

    if (!storageKey) {
      issues.push({
        severity: "error",
        code: "CAPTURE_NO_STORAGE_KEY",
        message: `${item.capture.label || "Capture"} has no storage key.`,
        target: item.id,
      });
    } else {
      const existing =
        storageKeys.get(storageKey);

      if (existing) {
        issues.push({
          severity: "error",
          code: "CAPTURE_DUPLICATE_STORAGE_KEY",
          message: `${item.capture.label} uses the same storage key as another input: “${storageKey}”.`,
          target: item.id,
        });
      } else {
        storageKeys.set(
          storageKey,
          item.id,
        );
      }
    }

    const isReference =
      [
        "person_reference",
        "entity_reference",
        "responsibility_reference",
      ].includes(
        item.capture.kind,
      );

    const sourceKey =
      item.capture.sourceKey?.trim() ||
      configString(
        item.capture.config,
        "sourceKey",
      ) ||
      configString(
        item.capture.config,
        "dataSourceKey",
      ) ||
      configString(
        item.capture.config,
        "source",
      );

    if (
      isReference &&
      !sourceKey
    ) {
      issues.push({
        severity: "error",
        code: "REFERENCE_NO_SOURCE",
        message: `${item.capture.label} needs a CRM/Data Source before this Responsibility can be published.`,
        target: item.id,
      });
    }

    /*
     * Only true record-reference inputs resolve through Data Sources.
     *
     * Native capture blocks may legitimately use values such as:
     *   camera
     *   gallery
     *   microphone
     *   gps
     *   barcode
     *
     * Those describe device capabilities, NOT CRM/Data Sources.
     */
    if (
      isReference &&
      sourceKey &&
      knownDataSourceKeys &&
      !knownDataSourceKeys.has(
        sourceKey,
      )
    ) {
      issues.push({
        severity: "error",
        code: "REFERENCE_SOURCE_MISSING",
        message: `${item.capture.label} points to Data Source “${sourceKey}”, but that source does not exist or is disabled.`,
        target: item.id,
      });
    }

    if (
      [
        "choice",
        "checklist",
      ].includes(
        item.capture.kind,
      )
    ) {
      const options =
        Array.isArray(
          item.capture.config.options,
        )
          ? item.capture.config.options.filter(
              (option) =>
                String(
                  option ?? "",
                ).trim(),
            )
          : [];

      if (
        options.length < 2
      ) {
        issues.push({
          severity: "error",
          code: "CHOICE_NO_OPTIONS",
          message: `${item.capture.label} needs at least two configured options.`,
          target: item.id,
        });
      }
    }
  }

  for (const item of actions) {
    const action = item.action;
    if (!action.actorId || !actorIds.has(action.actorId)) {
      issues.push({ severity: "error", code: "ACTION_NO_ACTOR", message: `${action.label} has no valid actor.`, target: item.id });
    }
    if (!action.objectId || !objectIds.has(action.objectId)) {
      issues.push({ severity: "error", code: "ACTION_NO_OBJECT", message: `${action.label} has no valid object.`, target: item.id });
    }
    for (const captureId of action.captureIds) {
      if (!captureIds.has(captureId)) {
        issues.push({ severity: "error", code: "ACTION_BROKEN_CAPTURE", message: `${action.label} collects a capture that no longer exists.`, target: item.id });
      }
    }
    const availableState = action.config.availableState;
    if (typeof availableState === "string" && availableState && !stateIds.has(availableState)) {
      issues.push({ severity: "error", code: "ACTION_BROKEN_STATE", message: `${action.label} references a state that no longer exists.`, target: item.id });
    }
  }

  for (const event of kernel.events) {
    if (event.kind === "action" && (!event.actionId || !actionIds.has(event.actionId))) {
      issues.push({
        severity: "error",
        code: "EVENT_NO_ACTION",
        message: `${event.label} is an action event but is not connected to an action.`,
        target: event.id,
      });
    }
  }

  const eventIds = new Set(kernel.events.map((item) => item.id));
  for (const rule of kernel.rules) {
    if (!rule.eventId || !eventIds.has(rule.eventId)) {
      issues.push({ severity: "error", code: "RULE_NO_EVENT", message: `${rule.label} is not connected to an event.`, target: rule.id });
    }
    if (rule.effects.length === 0) {
      issues.push({ severity: "warning", code: "RULE_NO_EFFECT", message: `${rule.label} does not change anything.`, target: rule.id });
    }
    for (const effect of rule.effects) {
      const issue = effectIssue(effect);
      if (issue) issues.push(issue);
      if (effect.actorId && !actorIds.has(effect.actorId)) {
        issues.push({ severity: "error", code: "EFFECT_BROKEN_ACTOR", message: "An effect references an actor that no longer exists.", target: effect.id });
      }
      if (effect.kind === "change_state" && effect.value?.kind === "literal" && typeof effect.value.value === "string" && !stateIds.has(effect.value.value)) {
        issues.push({ severity: "error", code: "EFFECT_BROKEN_STATE", message: "A Change State effect references a state that no longer exists.", target: effect.id });
      }
    }
  }

  if (outputs.length === 0) {
    issues.push({ severity: "warning", code: "NO_OUTPUT", message: "Add at least one output/view so someone can see the result." });
  }

  const appLayout = kernel.metadata.ui?.layout ?? [];
  if (appLayout.length === 0 && (captures.length || actions.length)) {
    issues.push({ severity: "warning", code: "EMPTY_APP_LAYOUT", message: "The app has blocks, but nothing is placed on the phone canvas." });
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  if (errors === 0) {
    issues.unshift({
      severity: "good",
      code: "KERNEL_CONNECTED",
      message: "No broken Kernel connections detected. Save/Publish can compile this world into the employee app contract.",
    });
  }

  return issues;
}
