// BRIXTA_PIXEL_REALITY_V2
import type {
  KernelActorResolver,
  KernelEffect,
  KernelPossibility,
  KernelValueRef,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import type {
  PixelRealityActor,
  PixelRealityActorResolver,
  PixelRealityProposal,
} from "@/lib/pixel-reality-types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function baseKernel(): ResponsibilityKernel {
  return {
    kernelVersion: 3,
    runtimeWorld: {
      actors: [
        {
          id: "current_employee",
          label: "Current employee",
          resolver: { kind: "current_user" },
        },
        {
          id: "system",
          label: "System",
          resolver: { kind: "system" },
        },
      ],
      objects: [
        {
          id: "current_record",
          label: "This Responsibility record",
          kind: "current_record",
        },
      ],
      contexts: [
        {
          id: "current_employee",
          label: "Current employee",
          source: "current_user",
          mutable: false,
        },
        {
          id: "current_time",
          label: "Current date / time",
          source: "current_time",
          mutable: false,
        },
      ],
      states: [
        {
          id: "draft",
          label: "Draft",
          dimension: "process",
          initial: true,
        },
      ],
    },
    possibilities: [],
    events: [],
    rules: [],
    metadata: {
      createdFrom: "pixel_reality_v2",
      ui: {
        layout: [],
        previewActorId: "current_employee",
        previewStateId: "draft",
      },
    },
  };
}

function actorResolver(
  resolver: PixelRealityActorResolver,
): KernelActorResolver {
  switch (resolver.kind) {
    case "manager_of":
      return {
        kind: "manager_of",
        value: {
          kind: "actor",
          key: resolver.actorId || "current_employee",
        },
      };
    case "relationship":
      return {
        kind: "relationship",
        source: {
          kind: "actor",
          key: resolver.sourceActorId || "current_employee",
        },
        relation: resolver.relation,
      };
    case "role":
      return {
        kind: "role",
        roleId: resolver.roleId,
      };
    case "specific_user":
      return {
        kind: "specific_user",
        userId: resolver.userId,
      };
    case "selected_reference":
      return {
        kind: "selected_reference",
        referenceKey: resolver.referenceKey,
      };
    case "query_result":
      return {
        kind: "query_result",
        queryKey: resolver.queryKey,
        path: resolver.path,
      };
    case "record_creator":
      return { kind: "record_creator" };
    case "system":
      return { kind: "system" };
    case "current_user":
    default:
      return { kind: "current_user" };
  }
}

function upsertById<T extends { id: string }>(
  items: T[],
  next: T,
) {
  const index = items.findIndex((item) => item.id === next.id);
  if (index >= 0) {
    items[index] = {
      ...items[index],
      ...next,
    };
  } else {
    items.push(next);
  }
}

function actorHasSurface(
  actors: PixelRealityActor[],
  actorId: string | undefined,
  surface: "app" | "dashboard",
) {
  if (!actorId) return true;
  const actor = actors.find((item) => item.id === actorId);
  if (!actor) return true;
  return actor.surfaces.includes(surface);
}

function possibilityId(
  type: "capture" | "action" | "output",
  id: string,
) {
  return `reality_${type}_${id}`;
}

function conditionForState(
  state: string | undefined,
) {
  if (!state) return undefined;

  return {
    mode: "all" as const,
    conditions: [
      {
        id: `reality_condition_state_${state}`,
        left: {
          kind: "state" as const,
          key: "process",
        },
        operator: "eq" as const,
        right: {
          kind: "literal" as const,
          value: state,
        },
      },
    ],
  };
}

function stateEffect(
  actionId: string,
  state: string,
): KernelEffect {
  return {
    id: `reality_effect_${actionId}_state`,
    kind: "change_state",
    targetKey: "process",
    value: {
      kind: "literal",
      value: state,
    },
    config: {
      origin: "pixel_reality_v2",
    },
  };
}

export function applyPixelRealityToKernel(
  kernel: ResponsibilityKernel | null,
  proposal: PixelRealityProposal,
): ResponsibilityKernel {
  const next = clone(kernel ?? baseKernel());

  next.kernelVersion = 3;
  next.metadata = {
    ...(next.metadata ?? {}),
    ui: {
      ...(next.metadata?.ui ?? { layout: [] }),
      layout: [...(next.metadata?.ui?.layout ?? [])],
    },
    tags: [
      ...new Set([
        ...(next.metadata?.tags ?? []),
        "pixel-reality-v2",
      ]),
    ],
  };

  for (const actor of proposal.actors) {
    upsertById(next.runtimeWorld.actors, {
      id: actor.id,
      label: actor.label,
      resolver: actorResolver(actor.resolver),
      description: actor.description,
    });
  }

  for (const object of proposal.objects) {
    upsertById(next.runtimeWorld.objects, {
      id: object.id,
      label: object.label,
      kind: object.kind,
      sourceKey: object.sourceKey,
      description: object.description,
    });
  }

  for (const context of proposal.contexts) {
    upsertById(next.runtimeWorld.contexts, {
      id: context.id,
      label: context.label,
      source: context.source,
      sourceKey: context.sourceKey,
      path: context.path,
      value: context.value,
      mutable: context.mutable === true,
      config: {
        ...(context.config ?? {}),
        origin: "pixel_reality_v2",
      },
    });
  }

  if (proposal.states.some((state) => state.initial)) {
    for (const state of next.runtimeWorld.states) {
      if (
        proposal.states.some(
          (candidate) =>
            candidate.dimension === state.dimension &&
            candidate.initial,
        )
      ) {
        state.initial = false;
      }
    }
  }

  for (const state of proposal.states) {
    upsertById(next.runtimeWorld.states, {
      id: state.id,
      label: state.label,
      dimension: state.dimension ?? "process",
      initial: state.initial,
      terminal: state.terminal,
      description: state.description,
    });
  }

  const layout = new Set(next.metadata.ui?.layout ?? []);

  for (const capture of proposal.captures) {
    const id = possibilityId("capture", capture.id);

    const existingCapture =
      next.possibilities.find(
        (item) =>
          item.type === "capture" &&
          item.capture.id === capture.id,
      );

    const existingStoreAs =
      existingCapture?.type ===
        "capture"
        ? existingCapture.capture.storeAs
        : undefined;

    const possibility: KernelPossibility = {
      id,
      type: "capture",
      capture: {
        id: capture.id,
        label: capture.label,
        kind: capture.kind,
        required: capture.required,
        storeAs:
          capture.storeAs ??
          existingStoreAs ??
          capture.id,
        config: {
          ...(capture.config ?? {}),
          origin: "pixel_reality_v2",
        },
      },
    };

    const index = next.possibilities.findIndex(
      (item) =>
        item.type === "capture" &&
        item.capture.id === capture.id,
    );

    if (index >= 0) {
      next.possibilities[index] = possibility;
    } else {
      next.possibilities.push(possibility);
    }
  }

  for (const action of proposal.actions) {
    const id = possibilityId("action", action.id);

    const config = {
      ...(action.config ?? {}),
      ...(action.availableState
        ? { availableState: action.availableState }
        : {}),
      ...(action.resultingState
        ? { resultingState: action.resultingState }
        : {}),
      generatedBy: "pixel_reality_v2",
    };

    const possibility: KernelPossibility = {
      id,
      type: "action",
      action: {
        id: action.id,
        label: action.label,
        kind: action.kind,
        actorId: action.actorId,
        objectId: action.objectId ?? "current_record",
        captureIds: action.captureIds ?? [],
        requires: conditionForState(action.availableState),
        config,
      },
    };

    const index = next.possibilities.findIndex(
      (item) =>
        item.type === "action" &&
        item.action.id === action.id,
    );

    if (index >= 0) {
      next.possibilities[index] = possibility;
    } else {
      next.possibilities.push(possibility);
    }

    const eventId = `reality_event_${action.id}`;
    upsertById(next.events, {
      id: eventId,
      label: `${action.label} happens`,
      kind: "action",
      actionId: action.id,
    });

    const effects: KernelEffect[] = [];

    if (action.resultingState) {
      effects.push(
        stateEffect(action.id, action.resultingState),
      );
    }

    effects.push({
      id: `reality_effect_${action.id}_history`,
      kind: "append_history",
      config: {
        label: action.label,
        origin: "pixel_reality_v2",
      },
    });

    upsertById(next.rules, {
      id: `reality_rule_${action.id}`,
      label: `${action.label} behavior`,
      eventId,
      when: {
        mode: "all",
        conditions: [],
      },
      effects,
      priority: 100,
      enabled: true,
    });

    if (
      actorHasSurface(
        proposal.actors,
        action.actorId,
        "app",
      )
    ) {
      for (const captureId of action.captureIds ?? []) {
        const capturePossibility = next.possibilities.find(
          (item) =>
            item.type === "capture" &&
            item.capture.id === captureId,
        );
        if (capturePossibility) {
          layout.add(capturePossibility.id);
        }
      }
      layout.add(id);
    }
  }

  for (const output of proposal.outputs) {
    const id = possibilityId("output", output.id);

    const actorSurfaces = new Set(
      proposal.actors
        .filter((actor) => output.actorIds.includes(actor.id))
        .flatMap((actor) => actor.surfaces),
    );

    for (const surface of output.surfaces ?? []) {
      actorSurfaces.add(surface);
    }

    const possibility: KernelPossibility = {
      id,
      type: "output",
      output: {
        id: output.id,
        label: output.label,
        kind: output.kind,
        actorIds: output.actorIds,
        stateIds: output.stateIds ?? [],
        visibleKeys: output.visibleKeys ?? [],
        config: {
          ...(output.config ?? {}),
          surfaceKinds: [...actorSurfaces],
          origin: "pixel_reality_v2",
        },
      },
    };

    const index = next.possibilities.findIndex(
      (item) =>
        item.type === "output" &&
        item.output.id === output.id,
    );

    if (index >= 0) {
      next.possibilities[index] = possibility;
    } else {
      next.possibilities.push(possibility);
    }
  }

  next.metadata.ui = {
    ...(next.metadata.ui ?? { layout: [] }),
    layout: [...layout],
  };

  return next;
}
