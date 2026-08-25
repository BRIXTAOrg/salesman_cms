import type {
  KernelEffect,
  KernelPossibility,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

export type KernelValidationIssue = {
  severity: "error" | "warning" | "good";
  code: string;
  message: string;
  target?: string;
};

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

export function validateResponsibilityKernel(kernel: ResponsibilityKernel): KernelValidationIssue[] {
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

  if (!kernel.runtimeWorld.states.some((state) => state.initial)) {
    issues.push({
      severity: "error",
      code: "NO_INITIAL_STATE",
      message: "Choose one initial process state so Run/Preview knows where the Responsibility begins.",
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
    if (!item.capture.storeAs?.trim()) {
      issues.push({ severity: "error", code: "CAPTURE_NO_STORAGE_KEY", message: `${item.capture.label || "Capture"} has no storage key.`, target: item.id });
    }
    if (
      ["person_reference", "entity_reference", "responsibility_reference"].includes(item.capture.kind) &&
      typeof item.capture.config.source !== "string"
    ) {
      issues.push({
        severity: "warning",
        code: "REFERENCE_NO_SOURCE",
        message: `${item.capture.label} is a reference but no source is selected yet.`,
        target: item.id,
      });
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
