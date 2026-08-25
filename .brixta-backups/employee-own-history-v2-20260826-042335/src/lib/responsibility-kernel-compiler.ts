import type {
  ResponsibilityAppAction,
  ResponsibilityDefinition,
  ResponsibilityField,
} from "@/lib/appliance-types";
import { compileResponsibilitySemantics } from "@/lib/responsibility-semantic-compiler";
import type {
  KernelAction,
  KernelCapture,
  KernelPossibility,
  KernelRule,
  KernelOutput,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function captureType(capture: KernelCapture) {
  const map: Record<string, { inputType: string; dataType: string }> = {
    short_text: { inputType: "text", dataType: "string" },
    long_text: { inputType: "textarea", dataType: "string" },
    number: { inputType: "number", dataType: "number" },
    amount: { inputType: "currency", dataType: "number" },
    choice: { inputType: "select", dataType: "string" },
    date: { inputType: "date", dataType: "date" },
    datetime: { inputType: "datetime", dataType: "datetime" },
    boolean: { inputType: "toggle", dataType: "boolean" },
    photo: { inputType: "photo", dataType: "media" },
    video: { inputType: "file", dataType: "media" },
    audio: { inputType: "file", dataType: "media" },
    file: { inputType: "file", dataType: "media" },
    signature: { inputType: "signature", dataType: "media" },
    gps: { inputType: "location_point", dataType: "geo_point" },
    route: { inputType: "location_route", dataType: "geo_route" },
    qr: { inputType: "qr", dataType: "string" },
    barcode: { inputType: "barcode", dataType: "string" },
    nfc: { inputType: "text", dataType: "string" },
    person_reference: { inputType: "select", dataType: "reference" },
    entity_reference: { inputType: "select", dataType: "reference" },
    responsibility_reference: { inputType: "select", dataType: "reference" },
    checklist: { inputType: "multi_select", dataType: "array" },
    rating: { inputType: "number", dataType: "number" },
    timer: { inputType: "number", dataType: "duration" },
    repeating_section: { inputType: "textarea", dataType: "json" },
  };
  return map[capture.kind] ?? { inputType: "text", dataType: "string" };
}

function captureToField(capture: KernelCapture): ResponsibilityField {
  const type = captureType(capture);
  const key = normalizeKey(capture.storeAs || capture.id || capture.label);
  const config: Record<string, unknown> = {
    ...capture.config,
    kernelPossibilityId: capture.id,
    kernelCaptureKind: capture.kind,
  };

  if (capture.kind === "choice" && !Array.isArray(config.options)) {
    config.options = ["Option 1", "Option 2"];
  }

  return {
    key,
    label: capture.label,
    inputType: type.inputType,
    dataType: type.dataType,
    required: capture.required === true,
    config,
  };
}

function ruleForAction(
  kernel: ResponsibilityKernel,
  actionId: string,
): KernelRule | undefined {
  const eventIds = new Set(
    kernel.events
      .filter((event) => event.kind === "action" && event.actionId === actionId)
      .map((event) => event.id),
  );
  return kernel.rules.find(
    (rule) => rule.eventId && eventIds.has(rule.eventId),
  );
}

function resultingState(kernel: ResponsibilityKernel, action: KernelAction) {
  const configured = action.config.resultingState;
  if (typeof configured === "string" && configured) return configured;

  const rule = ruleForAction(kernel, action.id);
  const effect = rule?.effects.find((item) => item.kind === "change_state");
  if (
    effect?.value?.kind === "literal" &&
    typeof effect.value.value === "string"
  ) {
    return effect.value.value;
  }

  return normalizeKey(action.kind === "submit" ? "submitted" : action.kind);
}

function requiredState(action: KernelAction) {
  const configured = action.config.availableState;
  if (typeof configured === "string" && configured) return configured;

  const condition = action.requires?.conditions.find(
    (item) =>
      item.left.kind === "state" &&
      item.operator === "eq" &&
      item.right?.kind === "literal",
  );
  return condition?.right?.kind === "literal" &&
    typeof condition.right.value === "string"
    ? condition.right.value
    : undefined;
}

function actionToBaseAction(
  kernel: ResponsibilityKernel,
  action: KernelAction,
  captureMap: Map<string, ResponsibilityField>,
): ResponsibilityAppAction {
  const fieldKeys = action.captureIds
    .map((id) => captureMap.get(id)?.key)
    .filter((value): value is string => Boolean(value));
  const requiredFieldKeys = action.captureIds
    .map((id) => captureMap.get(id))
    .filter((field): field is ResponsibilityField => Boolean(field?.required))
    .map((field) => field.key);
  const state = requiredState(action);
  const result = resultingState(kernel, action);
  const operation: "create" | "update" = ["create", "submit", "start"].includes(
    action.kind,
  )
    ? "create"
    : "update";

  const captureLocationId = action.captureIds.find(
    (id) => captureMap.get(id)?.inputType === "location_point",
  );
  const locationField = captureLocationId
    ? captureMap.get(captureLocationId)
    : undefined;

  return {
    key: normalizeKey(action.id || action.label),
    label: action.label,
    operation,
    status: result,
    style:
      action.kind === "reject" ||
      action.kind === "cancel" ||
      action.kind === "delete"
        ? "danger"
        : action.kind === "approve" ||
            action.kind === "submit" ||
            action.kind === "start"
          ? "primary"
          : "secondary",
    fieldKeys,
    requiredFieldKeys,
    visibility: state
      ? { mode: "latest_status_is", status: state }
      : { mode: "always" },
    ...(operation === "update"
      ? {
          target: {
            strategy: state ? "latest_status" : "latest_record",
            ...(state ? { status: state } : {}),
          },
        }
      : {}),
    ...(locationField
      ? {
          capture: {
            location: {
              fieldKey: locationField.key,
              required: locationField.required,
            },
          },
        }
      : {}),
    successMessage:
      typeof action.config.successMessage === "string"
        ? action.config.successMessage
        : `${action.label} completed.`,
  };
}

/**
 * Compile the unified visual/kernel definition into the existing generic
 * mobile Responsibility contract. This is the compatibility bridge that makes
 * builder changes immediately visible to the currently-installed Flutter app.
 * Kernel v3 remains embedded in extension metadata for the richer runtime.
 */
export function compileKernelToBaseDefinition(
  kernel: ResponsibilityKernel,
): ResponsibilityDefinition {
  kernel = compileResponsibilitySemantics(kernel);
  const captures = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "capture" }> =>
      item.type === "capture",
  );
  const actions = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "action" }> =>
      item.type === "action",
  );
  const outputs = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "output" }> =>
      item.type === "output",
  );

  const captureFields = new Map<string, ResponsibilityField>();
  for (const item of captures) {
    captureFields.set(item.capture.id, captureToField(item.capture));
  }

  /*
   * THE PHONE LAYOUT IS AUTHORITATIVE.
   *
   * Before this fix we did:
   *
   *   authored layout captures
   *          +
   *   every leftover Kernel capture
   *
   * That caused controls deleted from the App Builder to reappear on the
   * employee phone because the old possibility node could still exist in the
   * internal Kernel graph.
   *
   * From here onward:
   *
   *   metadata.ui.layout = what exists on the employee app.
   *
   * Internal Kernel possibilities may survive temporarily for history,
   * validation or future tooling, but they DO NOT automatically become UI.
   */
  const layoutIds = kernel.metadata.ui?.layout;
  const layoutIsAuthoritative = Array.isArray(layoutIds);

  const publishedCaptures = layoutIsAuthoritative
    ? layoutIds
        .map((id) => captures.find((item) => item.id === id))
        .filter(
          (item): item is Extract<KernelPossibility, { type: "capture" }> =>
            Boolean(item),
        )
    : captures;

  const publishedActions = layoutIsAuthoritative
    ? layoutIds
        .map((id) => actions.find((item) => item.id === id))
        .filter(
          (item): item is Extract<KernelPossibility, { type: "action" }> =>
            Boolean(item),
        )
    : actions;

  const fields = publishedCaptures.map(
    (item) => captureFields.get(item.capture.id)!,
  );

  const appActions = publishedActions.map((item) =>
    actionToBaseAction(kernel, item.action, captureFields),
  );
  const output = outputs[0]?.output;

  return {
    schemaVersion: 2,
    input: {
      renderer: "form",
      strict: true,
      fields,
    },
    app: {
      renderer: "action_form_v1",
      actions: appActions,
      config: {
        generatedBy: "responsibility_unified_studio_v4",

        /*
         * Runtime state contract:
         *
         * A Responsibility with no records is NOT stateless.
         * Its effective state is the Kernel's configured initial state.
         *
         * Flutter uses this before the first record exists so the real
         * employee app behaves exactly like the CMS simulator.
         */
        initialState:
          kernel.runtimeWorld.states.find((state) => state.initial)?.id ??
          kernel.runtimeWorld.states[0]?.id ??
          null,
        layout: (kernel.metadata.ui?.layout ?? [])
          .map((possibilityId) => {
            const possibility = kernel.possibilities.find(
              (item) => item.id === possibilityId,
            );
            if (!possibility || possibility.type === "output") return null;
            return possibility.type === "capture"
              ? {
                  kind: "field",
                  key: normalizeKey(
                    possibility.capture.storeAs || possibility.capture.id,
                  ),
                }
              : { kind: "action", key: normalizeKey(possibility.action.id) };
          })
          .filter(Boolean),
        kernelVersion: kernel.kernelVersion,
      },
    },
    output: {
      renderer: output?.kind ?? "detail",
      config: {
        kernelOutputId: output?.id ?? null,
        actorIds: output?.actorIds ?? [],
        stateIds: output?.stateIds ?? [],
        visibleKeys: output?.visibleKeys ?? [],
      },
    },
    crud: {
      create:
        appActions.some((action) => action.operation === "create") ||
        publishedCaptures.length > 0,
      read: true,
      update: appActions.some((action) => action.operation === "update"),
      delete: publishedActions.some((item) => item.action.kind === "delete"),
    },
  };
}

/**
 * One-time compatibility import for Responsibilities created with the older
 * drag/drop form builder. Nothing is hardcoded by business name: fields,
 * actions, statuses and output are translated generically.
 */
export function hydrateKernelFromBaseDefinition(
  definition: ResponsibilityDefinition,
  title = "Employee app",
): ResponsibilityKernel {
  const kernel: ResponsibilityKernel = {
    kernelVersion: 3,
    runtimeWorld: {
      actors: [
        {
          id: "current_employee",
          label: "Current employee",
          resolver: { kind: "current_user" },
        },
        { id: "system", label: "System", resolver: { kind: "system" } },
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
        { id: "draft", label: "Draft", dimension: "process", initial: true },
      ],
    },
    possibilities: [],
    events: [],
    rules: [],
    metadata: {
      createdFrom: "legacy_builder_import",
      ui: {
        layout: [],
        title,
        previewActorId: "current_employee",
        previewStateId: "draft",
      },
    },
  };

  const fieldKeyToCaptureId = new Map<string, string>();
  for (const field of definition.input?.fields ?? []) {
    if (field.config?.hidden === true) continue;
    const reverse: Record<string, KernelCapture["kind"]> = {
      text: "short_text",
      textarea: "long_text",
      number: "number",
      currency: "amount",
      select: "choice",
      multi_select: "checklist",
      toggle: "boolean",
      checkbox: "boolean",
      date: "date",
      datetime: "datetime",
      photo: "photo",
      image: "photo",
      file: "file",
      signature: "signature",
      location_point: "gps",
      location_route: "route",
      qr: "qr",
      barcode: "barcode",
    };
    const captureId = normalizeKey(field.key || field.label);
    fieldKeyToCaptureId.set(field.key, captureId);
    const possibilityId = `capture_${captureId}`;
    kernel.possibilities.push({
      id: possibilityId,
      type: "capture",
      capture: {
        id: captureId,
        label: field.label,
        kind: reverse[field.inputType] ?? "short_text",
        required: field.required,
        storeAs: field.key,
        config: { ...(field.config ?? {}) },
      },
    });
    kernel.metadata.ui!.layout.push(possibilityId);
  }

  const configuredInitialState =
    typeof definition.app?.config?.initialState === "string"
      ? String(definition.app.config.initialState).trim()
      : "";
  const knownStates = new Set<string>(
    configuredInitialState ? [configuredInitialState] : ["draft"],
  );
  for (const action of definition.app?.actions ?? []) {
    if (action.status) knownStates.add(action.status);
    if (action.visibility?.status) knownStates.add(action.visibility.status);
    const actionId = normalizeKey(action.key || action.label);
    const possibilityId = `action_${actionId}`;
    const availableState =
      action.visibility?.mode === "latest_status_is"
        ? action.visibility.status
        : "";
    kernel.possibilities.push({
      id: possibilityId,
      type: "action",
      action: {
        id: actionId,
        label: action.label,
        kind: action.operation === "create" ? "submit" : "update",
        actorId: "current_employee",
        objectId: "current_record",
        captureIds: (action.fieldKeys ?? [])
          .map((fieldKey) => fieldKeyToCaptureId.get(fieldKey))
          .filter((value): value is string => Boolean(value)),
        config: {
          availableState: availableState ?? "",
          resultingState: action.status ?? "",
          successMessage: action.successMessage ?? "",
        },
      },
    });
    kernel.metadata.ui!.layout.push(possibilityId);
    if (action.status) {
      const eventId = `event_${actionId}`;
      kernel.events.push({
        id: eventId,
        label: `${action.label} happened`,
        kind: "action",
        actionId,
      });
      kernel.rules.push({
        id: `rule_${actionId}`,
        label: `${action.label} behavior`,
        eventId,
        when: { mode: "all", conditions: [] },
        effects: [
          {
            id: `effect_${actionId}_state`,
            kind: "change_state",
            targetKey: "process",
            value: { kind: "literal", value: action.status },
            config: {},
          },
          {
            id: `effect_${actionId}_history`,
            kind: "append_history",
            config: { label: action.label },
          },
        ],
        priority: 100,
        enabled: true,
      });
    }
  }

  kernel.runtimeWorld.states = [...knownStates].map((stateId, index) => ({
    id: stateId,
    label: stateId
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    dimension: "process",
    initial: configuredInitialState
      ? stateId === configuredInitialState
      : index === 0,
    terminal: stateId === "completed",
  }));
  if (!kernel.runtimeWorld.states.some((state) => state.initial)) {
    kernel.runtimeWorld.states[0] = {
      ...kernel.runtimeWorld.states[0],
      initial: true,
    };
  }
  kernel.metadata.ui!.previewStateId = kernel.runtimeWorld.states.find(
    (state) => state.initial,
  )?.id;

  kernel.possibilities.push({
    id: "output_primary",
    type: "output",
    output: {
      id: "primary",
      label: "Primary output",
      kind: (definition.output?.renderer as KernelOutput["kind"]) || "detail",
      actorIds: ["current_employee"],
      stateIds: [],
      visibleKeys: (definition.input?.fields ?? [])
        .filter((field) => field.config?.hidden !== true)
        .map((field) => field.key),
      config: { ...(definition.output?.config ?? {}) },
    },
  });

  return kernel;
}
