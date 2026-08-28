// BRIXTA_PIXEL_LOGIC_AI_BRIDGE_V1
import { getPixelLogicNodeSpec } from "@/lib/pixel-logic-registry";
import type { PixelLogicProgram } from "@/lib/pixel-logic-types";
import type { PixelLogicValidationIssue } from "@/lib/pixel-logic-validation";
import type { ResponsibilityKernel } from "@/lib/responsibility-kernel-types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// BRIXTA_PIXEL_REALITY_VALIDATION_V2
function objectValue(value: unknown): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export function validatePixelLogicAgainstResponsibility(
  program: PixelLogicProgram,
  kernel: ResponsibilityKernel | null,
): PixelLogicValidationIssue[] {
  const issues: PixelLogicValidationIssue[] = [];

  const variableKeys = new Set(program.variables.map((item) => item.key));
  const seenVariables = new Set<string>();
  for (const variable of program.variables) {
    if (seenVariables.has(variable.key)) {
      issues.push({
        severity: "error",
        message: `Duplicate Pixel Logic variable key: ${variable.key}`,
      });
    }
    seenVariables.add(variable.key);
  }

  if (!kernel) {
    const usesResponsibilityBindings = program.nodes.some(
      (node) =>
        node.type === "event.responsibility.action" ||
        node.type === "value.ref" ||
        node.type === "effect.change_state" ||
        node.type === "effect.notify_actor" ||
        node.type === "effect.trigger_action" ||
        node.type === "effect.set_context",
    );
    if (usesResponsibilityBindings) {
      issues.push({
        severity: "warning",
        message:
          "This Responsibility has no Kernel metadata, so action/capture/context/state bindings cannot be fully verified.",
      });
    }
    return issues;
  }

  const actions = new Set(
    kernel.possibilities
      .filter(
        (item): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "action" }
        > => item.type === "action",
      )
      .map((item) => item.action.id),
  );
  const captures = new Set(
    kernel.possibilities
      .filter(
        (item): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "capture" }
        > => item.type === "capture",
      )
      .map((item) => item.capture.id),
  );
  const contexts = new Map(
    kernel.runtimeWorld.contexts.map((item) => [item.id, item] as const),
  );
  const states = new Set(kernel.runtimeWorld.states.map((item) => item.id));
  const actors = new Set(kernel.runtimeWorld.actors.map((item) => item.id));
  const objects = new Set(kernel.runtimeWorld.objects.map((item) => item.id));

  /*
   * Pixel Reality V2 may declare business concepts that do not exist in the
   * currently-published Kernel yet.
   *
   * The graph MUST be allowed to reference those declarations during the
   * pre-import human review.
   */
  const programMetadata =
    objectValue(
      program.metadata,
    );

  const declared =
    objectValue(
      programMetadata.pixelRealityDeclared,
    );

  for (const id of stringArray(declared.actionIds)) {
    actions.add(id);
  }

  for (const id of stringArray(declared.captureIds)) {
    captures.add(id);
  }

  for (const id of stringArray(declared.contextIds)) {
    if (!contexts.has(id)) {
      contexts.set(
        id,
        {
          id,
          label: id,
          source: "literal",
          mutable: true,
          config: {
            declaredBy:
              "pixel_reality_v2",
          },
        },
      );
    }
  }

  for (const id of stringArray(declared.stateIds)) {
    states.add(id);
  }

  for (const id of stringArray(declared.actorIds)) {
    actors.add(id);
  }

  for (const id of stringArray(declared.objectIds)) {
    objects.add(id);
  }

  for (const node of program.nodes) {
    const spec = getPixelLogicNodeSpec(node.type);

    for (const field of spec?.configFields ?? []) {
      if (field.kind !== "select") continue;
      const raw = text(node.config[field.key]);
      if (!raw) continue;
      const allowed = new Set((field.options ?? []).map((item) => item.value));
      if (allowed.size > 0 && !allowed.has(raw)) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: config \"${field.key}\" has unsupported value \"${raw}\".`,
        });
      }
    }

    if (node.type === "event.responsibility.action") {
      const actionId = text(node.config.actionId);
      if (!actionId) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: actionId is required.`,
        });
      } else if (!actions.has(actionId)) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: unknown Responsibility action \"${actionId}\".`,
        });
      }
    }

    if (node.type === "value.ref") {
      const scope = text(node.config.scope) || "context";
      const key = text(node.config.key);
      const knownScopes = new Set([
        "context",
        "capture",
        "actor",
        "state",
        "history",
        "computed",
        "query",
        "object",
        "variable",
      ]);
      if (!knownScopes.has(scope)) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: unknown value.ref scope \"${scope}\".`,
        });
        continue;
      }

      if (["context", "capture", "actor", "state", "object", "variable"].includes(scope) && !key) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: value.ref key is required for scope \"${scope}\".`,
        });
        continue;
      }

      const known =
        scope === "context"
          ? contexts.has(key)
          : scope === "capture"
            ? captures.has(key)
            : scope === "actor"
              ? actors.has(key)
              : scope === "state"
                ? states.has(key)
                : scope === "object"
                  ? objects.has(key)
                  : scope === "variable"
                    ? variableKeys.has(key)
                    : true;
      if (!known) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: unknown ${scope} key \"${key}\" for this Responsibility.`,
        });
      }
    }

    if (node.type === "effect.trigger_action") {
      const actionId = text(node.config.actionId);
      if (!actionId || !actions.has(actionId)) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: trigger actionId must reference an existing Responsibility action.`,
        });
      }
    }

    if (node.type === "effect.change_state") {
      const state = text(node.config.state);
      if (!state || !states.has(state)) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: state must reference an existing Responsibility state.`,
        });
      }
    }

    if (node.type === "effect.notify_actor") {
      const actorId = text(node.config.actorId);
      if (actorId && !actors.has(actorId)) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: unknown actor \"${actorId}\".`,
        });
      }
    }

    if (node.type === "effect.set_context") {
      const targetKey = text(node.config.targetKey);
      const context = contexts.get(targetKey);
      if (!targetKey || !context) {
        issues.push({
          severity: "error",
          nodeId: node.id,
          message: `${node.label ?? node.type}: targetKey must reference an existing Responsibility context.`,
        });
      } else if (!context.mutable) {
        issues.push({
          severity: "warning",
          nodeId: node.id,
          message: `${node.label ?? node.type}: context \"${targetKey}\" is marked immutable.`,
        });
      }
    }
  }

  return issues;
}
