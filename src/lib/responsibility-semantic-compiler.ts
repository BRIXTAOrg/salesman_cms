import type {
  KernelAction,
  KernelState,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function textOf(kernel: ResponsibilityKernel, action?: KernelAction) {
  return [
    kernel.metadata.ui?.title ?? "",
    kernel.metadata.ui?.description ?? "",
    kernel.metadata.description ?? "",
    ...(kernel.metadata.tags ?? []),
    action?.id ?? "",
    action?.label ?? "",
    action?.kind ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function visiblePossibilities(kernel: ResponsibilityKernel) {
  const layout = kernel.metadata.ui?.layout;
  if (!Array.isArray(layout)) return kernel.possibilities;

  const byId = new Map(kernel.possibilities.map((item) => [item.id, item]));
  return layout
    .map((id) => byId.get(id))
    .filter(
      (item): item is ResponsibilityKernel["possibilities"][number] =>
        Boolean(item),
    );
}

function ensureActor(
  kernel: ResponsibilityKernel,
  actor: ResponsibilityKernel["runtimeWorld"]["actors"][number],
) {
  const index = kernel.runtimeWorld.actors.findIndex((item) => item.id === actor.id);
  if (index >= 0) {
    kernel.runtimeWorld.actors[index] = {
      ...kernel.runtimeWorld.actors[index],
      ...actor,
    };
  } else {
    kernel.runtimeWorld.actors.push(actor);
  }
}

function ensureObject(
  kernel: ResponsibilityKernel,
  object: ResponsibilityKernel["runtimeWorld"]["objects"][number],
) {
  const index = kernel.runtimeWorld.objects.findIndex((item) => item.id === object.id);
  if (index >= 0) {
    kernel.runtimeWorld.objects[index] = {
      ...kernel.runtimeWorld.objects[index],
      ...object,
    };
  } else {
    kernel.runtimeWorld.objects.push(object);
  }
}

function ensureContext(
  kernel: ResponsibilityKernel,
  context: ResponsibilityKernel["runtimeWorld"]["contexts"][number],
) {
  const index = kernel.runtimeWorld.contexts.findIndex((item) => item.id === context.id);
  if (index >= 0) {
    kernel.runtimeWorld.contexts[index] = {
      ...kernel.runtimeWorld.contexts[index],
      ...context,
    };
  } else {
    kernel.runtimeWorld.contexts.push(context);
  }
}

function ensureState(kernel: ResponsibilityKernel, state: KernelState) {
  const index = kernel.runtimeWorld.states.findIndex((item) => item.id === state.id);
  if (index >= 0) {
    kernel.runtimeWorld.states[index] = {
      ...kernel.runtimeWorld.states[index],
      ...state,
    };
  } else {
    kernel.runtimeWorld.states.push(state);
  }
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function mergeStrings(value: unknown, additions: string[]) {
  return [...new Set([...stringList(value), ...additions])];
}

function hasNativePhoneCapture(kernel: ResponsibilityKernel) {
  return kernel.possibilities.some(
    (item) =>
      item.type === "capture" &&
      typeof item.capture.config.nativeCapability === "string" &&
      item.capture.config.nativeCapability.length > 0,
  );
}

function hasLocationCapture(kernel: ResponsibilityKernel) {
  return kernel.possibilities.some((item) => {
    if (item.type !== "capture") return false;
    const native = String(item.capture.config.nativeCapability ?? "");
    return (
      ["gps", "route"].includes(item.capture.kind) ||
      [
        "current_location",
        "live_location",
        "route_tracker",
        "geofence",
      ].includes(native)
    );
  });
}

function hasManagerIntent(kernel: ResponsibilityKernel) {
  return (
    kernel.possibilities.some(
      (item) =>
        item.type === "action" &&
        (["approve", "reject", "delegate"].includes(item.action.kind) ||
          /approval|manager/i.test(item.action.label)),
    ) ||
    kernel.rules.some((rule) =>
      rule.effects.some(
        (effect) =>
          effect.actorId === "reporting_manager" ||
          effect.actorId === "current_manager",
      ),
    )
  );
}

function ensureBaseRuntimeContext(kernel: ResponsibilityKernel) {
  ensureActor(kernel, {
    id: "current_employee",
    label: "Current employee",
    resolver: { kind: "current_user" },
  });
  ensureActor(kernel, {
    id: "system",
    label: "System",
    resolver: { kind: "system" },
  });
  ensureObject(kernel, {
    id: "current_record",
    label: "This Responsibility record",
    kind: "current_record",
  });
  ensureContext(kernel, {
    id: "current_employee",
    label: "Current employee",
    source: "current_user",
    mutable: false,
  });
  ensureContext(kernel, {
    id: "current_time",
    label: "Current date / time",
    source: "current_time",
    mutable: false,
  });
  ensureContext(kernel, {
    id: "organization",
    label: "Organization",
    source: "organization",
    mutable: false,
  });

  if (hasNativePhoneCapture(kernel)) {
    ensureContext(kernel, {
      id: "current_device",
      label: "Current device",
      source: "current_device",
      mutable: false,
    });
  }

  if (hasLocationCapture(kernel)) {
    ensureContext(kernel, {
      id: "current_location",
      label: "Current location",
      source: "current_location",
      mutable: true,
    });
  }

  if (hasManagerIntent(kernel)) {
    ensureActor(kernel, {
      id: "reporting_manager",
      label: "Reporting manager",
      resolver: {
        kind: "manager_of",
        value: { kind: "actor", key: "current_employee" },
      },
    });
    ensureContext(kernel, {
      id: "reporting_manager",
      label: "Reporting manager",
      source: "current_manager",
      mutable: false,
    });
  }
}

function inferUnassignedInputs(kernel: ResponsibilityKernel) {
  const visible = visiblePossibilities(kernel);
  let pendingCaptureIds: string[] = [];

  for (const item of visible) {
    if (item.type === "capture") {
      pendingCaptureIds.push(item.capture.id);
      continue;
    }
    if (item.type !== "action") continue;

    const action = item.action;
    if (
      action.captureIds.length === 0 &&
      pendingCaptureIds.length > 0 &&
      !["approve", "reject", "notify", "read", "delete"].includes(action.kind)
    ) {
      action.captureIds = [...pendingCaptureIds];
    }

    if (["create", "submit", "start", "complete", "stop"].includes(action.kind)) {
      pendingCaptureIds = [];
    }
  }
}

function lifecycleProfile(kernel: ResponsibilityKernel, start: KernelAction) {
  const text = textOf(kernel, start);

  if (/attendance|punch|check[ -]?in|check[ -]?out/.test(text)) {
    return {
      kind: "attendance" as const,
      initial: "not_punched_in",
      initialLabel: "Not punched in",
      active: "punched_in",
      activeLabel: "Punched in",
      complete: "completed",
      completeLabel: "Completed",
    };
  }

  if (/journey|travel|route|trip/.test(text)) {
    return {
      kind: "journey" as const,
      initial: "not_started",
      initialLabel: "Not started",
      active: "in_progress",
      activeLabel: "In progress",
      complete: "completed",
      completeLabel: "Completed",
    };
  }

  return {
    kind: "generic" as const,
    initial: "ready",
    initialLabel: "Ready",
    active: "active",
    activeLabel: "Active",
    complete: "completed",
    completeLabel: "Completed",
  };
}

function normalizeAttendanceOutcomeRules(
  kernel: ResponsibilityKernel,
  startActionId: string,
) {
  const eventIds = new Set(
    kernel.events
      .filter((event) => event.kind === "action" && event.actionId === startActionId)
      .map((event) => event.id),
  );

  const arrivalValues = new Set(["present", "late", "on_time"]);

  kernel.rules = kernel.rules.map((rule) => {
    if (!rule.eventId || !eventIds.has(rule.eventId)) return rule;

    return {
      ...rule,
      effects: rule.effects.map((effect) => {
        if (
          effect.kind !== "change_state" ||
          effect.value?.kind !== "literal" ||
          !arrivalValues.has(String(effect.value.value ?? ""))
        ) {
          return effect;
        }

        const original = String(effect.value.value ?? "");
        return {
          ...effect,
          kind: "set_computed" as const,
          targetKey: "arrival_status",
          value: {
            kind: "literal" as const,
            value: original === "present" ? "on_time" : original,
          },
          config: {
            ...effect.config,
            generatedBy: "brixta_semantic_compiler_v2",
            convertedFromState: original,
          },
        };
      }),
    };
  });
}

function inferSingleSessionLifecycle(kernel: ResponsibilityKernel) {
  const actions = visiblePossibilities(kernel)
    .filter(
      (item): item is Extract<ResponsibilityKernel["possibilities"][number], { type: "action" }> =>
        item.type === "action",
    )
    .map((item) => item.action);

  const starts = actions.filter((action) => action.kind === "start");
  const ends = actions.filter((action) => ["stop", "complete"].includes(action.kind));

  // V2 inference is deliberately conservative: one obvious begin/end pair.
  if (starts.length !== 1 || ends.length !== 1) return;

  const start = starts[0];
  const end = ends[0];
  const profile = lifecycleProfile(kernel, start);

  for (const state of kernel.runtimeWorld.states) state.initial = false;

  if (profile.kind === "attendance") {
    kernel.runtimeWorld.states = kernel.runtimeWorld.states.filter(
      (state) => !["present", "late"].includes(state.id),
    );
  }

  ensureState(kernel, {
    id: profile.initial,
    label: profile.initialLabel,
    dimension: "process",
    initial: true,
  });
  ensureState(kernel, {
    id: profile.active,
    label: profile.activeLabel,
    dimension: "process",
  });
  ensureState(kernel, {
    id: profile.complete,
    label: profile.completeLabel,
    dimension: "process",
    terminal: true,
  });

  start.actorId = "current_employee";
  start.objectId = "current_record";
  start.config = {
    ...start.config,
    availableState: profile.initial,
    resultingState: profile.active,
    semanticLifecycle: "begin",
    generatedBy: "brixta_semantic_compiler_v2",
  };

  end.actorId = "current_employee";
  end.objectId = "current_record";
  end.config = {
    ...end.config,
    availableState: profile.active,
    resultingState: profile.complete,
    semanticLifecycle: "end",
    generatedBy: "brixta_semantic_compiler_v2",
  };

  kernel.metadata.ui = {
    ...(kernel.metadata.ui ?? { layout: [] }),
    previewStateId: profile.initial,
    previewActorId: "current_employee",
  };

  if (profile.kind === "attendance") {
    normalizeAttendanceOutcomeRules(kernel, start.id);
  }
}

function inferActionRuntimeDefaults(kernel: ResponsibilityKernel) {
  const location = hasLocationCapture(kernel);
  const device = hasNativePhoneCapture(kernel);
  const manager = hasManagerIntent(kernel);

  for (const item of kernel.possibilities) {
    if (item.type !== "action") continue;
    const action = item.action;

    action.objectId = action.objectId || "current_record";
    action.actorId = ["approve", "reject", "delegate"].includes(action.kind) && manager
      ? "reporting_manager"
      : "current_employee";

    const automatic = ["current_employee", "current_time"];
    if (location) automatic.push("current_location");
    if (device) automatic.push("current_device");

    action.config = {
      ...action.config,
      captureContext: mergeStrings(action.config.captureContext, automatic),
    };
  }
}

function inferSimpleApprovalLifecycle(kernel: ResponsibilityKernel) {
  const actions = visiblePossibilities(kernel)
    .filter(
      (item): item is Extract<ResponsibilityKernel["possibilities"][number], { type: "action" }> =>
        item.type === "action",
    )
    .map((item) => item.action);

  if (actions.some((action) => action.kind === "start")) return;

  const submit = actions.find((action) => ["submit", "create"].includes(action.kind));
  const approve = actions.find((action) => action.kind === "approve");
  const reject = actions.find((action) => action.kind === "reject");

  if (!submit || (!approve && !reject)) return;

  ensureActor(kernel, {
    id: "reporting_manager",
    label: "Reporting manager",
    resolver: {
      kind: "manager_of",
      value: { kind: "actor", key: "current_employee" },
    },
  });
  ensureContext(kernel, {
    id: "reporting_manager",
    label: "Reporting manager",
    source: "current_manager",
    mutable: false,
  });

  for (const state of kernel.runtimeWorld.states) state.initial = false;
  ensureState(kernel, {
    id: "ready",
    label: "Ready",
    dimension: "process",
    initial: true,
  });
  ensureState(kernel, {
    id: "pending_approval",
    label: "Awaiting approval",
    dimension: "process",
  });
  ensureState(kernel, {
    id: "approved",
    label: "Approved",
    dimension: "process",
    terminal: true,
  });
  ensureState(kernel, {
    id: "rejected",
    label: "Rejected",
    dimension: "process",
    terminal: true,
  });

  submit.actorId = "current_employee";
  submit.config = {
    ...submit.config,
    availableState: "ready",
    resultingState: "pending_approval",
    generatedBy: "brixta_semantic_compiler_v2",
  };

  if (approve) {
    approve.actorId = "reporting_manager";
    approve.config = {
      ...approve.config,
      availableState: "pending_approval",
      resultingState: "approved",
      generatedBy: "brixta_semantic_compiler_v2",
    };
  }
  if (reject) {
    reject.actorId = "reporting_manager";
    reject.config = {
      ...reject.config,
      availableState: "pending_approval",
      resultingState: "rejected",
      generatedBy: "brixta_semantic_compiler_v2",
    };
  }

  kernel.metadata.ui = {
    ...(kernel.metadata.ui ?? { layout: [] }),
    previewStateId: "ready",
    previewActorId: "current_employee",
  };
}

/**
 * Pure deterministic compiler pass. It never mutates the caller's Kernel and
 * it never talks to an LLM/API. The customer authors visible intent; this pass
 * derives runtime mechanics at preview/publish boundaries.
 */
export function compileResponsibilitySemantics(
  source: ResponsibilityKernel,
): ResponsibilityKernel {
  const kernel = clone(source);

  ensureBaseRuntimeContext(kernel);
  inferUnassignedInputs(kernel);
  inferActionRuntimeDefaults(kernel);
  inferSingleSessionLifecycle(kernel);
  inferSimpleApprovalLifecycle(kernel);

  for (const item of kernel.possibilities) {
    if (item.type === "output" && item.output.actorIds.length === 0) {
      item.output.actorIds = ["current_employee"];
    }
  }

  return kernel;
}
