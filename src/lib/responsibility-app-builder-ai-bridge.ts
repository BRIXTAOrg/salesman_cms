import {
  ACTION_CATALOG,
  CAPTURE_CATALOG,
  OUTPUT_CATALOG,
} from "@/lib/responsibility-kernel-catalog";

import type {
  KernelAction,
  KernelActor,
  KernelCapture,
  KernelContext,
  KernelObject,
  KernelOutput,
  KernelPossibility,
  KernelRule,
  KernelState,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

import { validateResponsibilityKernel } from "@/lib/responsibility-kernel-validation";

import {
  RESPONSIBILITY_UI_BLOCK_REGISTRY,
  parseResponsibilityUiDocument,
  type ResponsibilityUiDocument,
} from "@/lib/responsibility-ui-document";

import { BRIXTA_PRESENTATION_RUNTIME_CAPABILITIES } from "@/lib/responsibility-presentation-runtime";

export const RESPONSIBILITY_APP_BUILDER_AI_FORMAT =
  "brixta.app-builder" as const;

export const RESPONSIBILITY_APP_BUILDER_AI_FORMAT_VERSION = 1 as const;

export type AppBuilderNativeBlockContext = {
  key: string;
  label: string;
  description: string;
  kind: string;
  keywords: string[];
  config: Record<string, unknown>;
  runtime?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
  resources?: Record<string, unknown>;
};

export type ResponsibilityAppBuilderAIImportResult = {
  format: typeof RESPONSIBILITY_APP_BUILDER_AI_FORMAT;
  formatVersion: typeof RESPONSIBILITY_APP_BUILDER_AI_FORMAT_VERSION;

  blockRegistryFingerprint: string;

  responsibilityId?: string | number;
  responsibilityTitle?: string;

  app: {
    title: string;
    description: string;
    employeeOwnHistoryVisible: boolean;

    actors: KernelActor[];
    objects: KernelObject[];
    contexts: KernelContext[];
    states: KernelState[];

    captures: KernelCapture[];
    actions: KernelAction[];
    outputs: KernelOutput[];

    layout: Array<{
      type: "capture" | "action" | "output";
      id: string;
    }>;

    /**
     * Real visual app document.
     *
     * Captures remain canonical DATA COLLECTION primitives.
     *
     * interaction.capture is the visual placement of an existing capture.
     * It does NOT create another capture system.
     */
    uiDocument: ResponsibilityUiDocument;
  };

  unsupportedCapabilities: string[];
  notes: string[];
};

type BuildContextInput = {
  responsibilityId: string | number;
  responsibilityTitle: string;

  kernel: ResponsibilityKernel;

  roles: unknown[];
  employees: unknown[];
  departments: unknown[];
  dataSources: unknown[];

  nativeBlocks: AppBuilderNativeBlockContext[];
};

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be a JSON array.`);
  }

  return value;
}

function stringValue(value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown, path: string) {
  return arrayValue(value, path).map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${path}[${index}] must be a string.`);
    }

    return item;
  });
}

function uniqueIds(values: unknown[], path: string) {
  const seen = new Set<string>();

  values.forEach((raw, index) => {
    const item = objectValue(raw, `${path}[${index}]`);

    const id = stringValue(item.id, `${path}[${index}].id`);

    if (seen.has(id)) {
      throw new Error(`Duplicate ID "${id}" in ${path}.`);
    }

    seen.add(id);
  });
}

function parseStrictJsonObject(text: string) {
  let cleaned = text.trim();

  const fenced = cleaned.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
  );

  if (fenced) {
    cleaned = fenced[1].trim();
  }

  if (!cleaned.startsWith("{") || !cleaned.endsWith("}")) {
    throw new Error(
      "AI response must resolve to exactly one JSON object. Remove prose before/after the JSON.",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `AI response is not valid JSON: ${error.message}`
        : "AI response is not valid JSON.",
    );
  }

  return objectValue(parsed, "root");
}

function stableRegistryValue(nativeBlocks: AppBuilderNativeBlockContext[]) {
  return JSON.stringify({
    captures: CAPTURE_CATALOG.map((item) => ({
      kind: item.kind,
      label: item.label,
    })),

    actions: ACTION_CATALOG.map((item) => ({
      kind: item.kind,
      label: item.label,
    })),

    outputs: OUTPUT_CATALOG.map((item) => ({
      kind: item.kind,
      label: item.label,
    })),

    visualUiBlocks: RESPONSIBILITY_UI_BLOCK_REGISTRY,

    presentationRuntime: BRIXTA_PRESENTATION_RUNTIME_CAPABILITIES,

    deviceStudio: {
      fastPreview:
        "Shared Flutter/Stac renderer receives the current unpublished uiDocument live.",

      actualAndroid:
        "When Device Studio is configured, the CMS embeds the hosted Android salesapp APK.",

      editingTruth:
        "Always mutate the structured BRIXTA definition; preview pixels are never source code.",
    },

    nativeExtensionPolicy: {
      normalAuthoring:
        "Return declarative BRIXTA JSON using registered capabilities. Never output arbitrary Dart/Kotlin/XML/ADB commands for direct execution.",

      unavailableCapability:
        "Report unavailable native requirements instead of pretending support exists.",

      extensionPipeline:
        "New native code belongs to an isolated Platform Extension build/test/sign/device-validation pipeline before it becomes a registered palette capability.",
    },

    nativeBlocks: nativeBlocks
      .map((item) => ({
        key: item.key,
        label: item.label,
        kind: item.kind,
        config: item.config,
        runtime: item.runtime ?? null,
        compliance: item.compliance ?? null,
        resources: item.resources ?? null,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });
}

/**
 * Tiny deterministic FNV-like fingerprint.
 *
 * This is not security cryptography.
 * It detects AI context / builder-registry drift.
 */
export function responsibilityAppBuilderRegistryFingerprint(
  nativeBlocks: AppBuilderNativeBlockContext[],
) {
  const source = stableRegistryValue(nativeBlocks);

  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);

    hash = Math.imul(hash, 16777619);
  }

  return `ab1-${(hash >>> 0).toString(16)}`;
}

export function buildResponsibilityAppBuilderAIContext(
  input: BuildContextInput,
) {
  const fingerprint = responsibilityAppBuilderRegistryFingerprint(
    input.nativeBlocks,
  );

  const example = {
    format: RESPONSIBILITY_APP_BUILDER_AI_FORMAT,

    formatVersion: RESPONSIBILITY_APP_BUILDER_AI_FORMAT_VERSION,

    blockRegistryFingerprint: fingerprint,

    responsibility: {
      id: input.responsibilityId,

      title: input.responsibilityTitle,
    },

    app: {
      title: input.responsibilityTitle,

      description: "Example App Builder structure.",

      employeeOwnHistoryVisible: true,

      actors: [
        {
          id: "current_employee",

          label: "Current employee",

          resolver: {
            kind: "current_user",
          },
        },

        {
          id: "system",

          label: "System",

          resolver: {
            kind: "system",
          },
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

        {
          id: "completed",

          label: "Completed",

          dimension: "process",

          terminal: true,
        },
      ],

      captures: [
        {
          id: "note",

          label: "Note",

          kind: "short_text",

          required: true,

          storeAs: "note",

          config: {},
        },
      ],

      actions: [
        {
          id: "submit",

          label: "Submit",

          kind: "submit",

          actorId: "current_employee",

          objectId: "current_record",

          captureIds: ["note"],

          config: {
            availableState: "draft",

            resultingState: "completed",

            successMessage: "Recorded.",
          },
        },
      ],

      outputs: [
        {
          id: "result",

          label: "Result",

          kind: "detail",

          actorIds: ["current_employee"],

          stateIds: ["completed"],

          visibleKeys: ["note"],

          config: {
            surfaceKinds: ["app"],
          },
        },
      ],

      uiDocument: {
        version: 1,

        engine: "brixta_stac_v1",

        theme: {
          scope: "inherit",

          base: "brixta_editorial_v1",
        },

        rootIds: [
          "example_heading",
          "example_note_input",
          "example_action_button",
        ],

        blocks: [
          {
            id: "example_heading",

            type: "display.text",

            config: {
              text: "Example app",
              size: "hero",
              alignment: "center",
            },
          },

          {
            id: "example_note_input",

            type: "interaction.capture",

            binding: {
              scope: "capture",

              key: "note",
            },

            config: {
              label: "Note",

              captureKind: "short_text",

              variant: "field",
            },
          },

          {
            id: "example_action_button",

            type: "interaction.action_button",

            actionId: "submit",

            config: {
              label: "Submit",
              style: "primary",
              size: "large",
            },
          },
        ],
      },

      layout: [
        {
          type: "capture",

          id: "note",
        },

        {
          type: "action",

          id: "submit",
        },

        {
          type: "output",

          id: "result",
        },
      ],
    },

    unsupportedCapabilities: [],

    notes: [],
  };

  const packet = {
    contract: "BRIXTA RESPONSIBILITY APP BUILDER AI CONTRACT V1",

    responsibility: {
      id: input.responsibilityId,

      title: input.responsibilityTitle,
    },

    currentApp: {
      kernel: input.kernel,
    },

    organization: {
      roles: input.roles,

      employees: input.employees,

      departments: input.departments,

      dataSources: input.dataSources,
    },

    availableBlocks: {
      captures: CAPTURE_CATALOG,

      actions: ACTION_CATALOG,

      outputs: OUTPUT_CATALOG,

      visualUiBlocks: RESPONSIBILITY_UI_BLOCK_REGISTRY,

      phoneAndNativeBlocks: input.nativeBlocks,
    },

    presentationRuntime: BRIXTA_PRESENTATION_RUNTIME_CAPABILITIES,

    platformRules: {
      general: [
        "Use only capabilities explicitly present in availableBlocks.",
        "Never invent a native phone capability.",
        "Never claim that declaring a block automatically installs native Android or iOS code.",
        "If runtime metadata says not_installed, do not use that block.",
        "Required phone permissions must remain user-controlled.",
        "The app must not silently bypass an OS permission denial.",
      ],

      android: [
        "Long-running location tracking must remain user-visible.",
        "Do not suppress a required foreground-service tracking notification.",
        "Do not invent hidden always-on background tracking.",
        "Use the permissions and disclosure configuration supplied by the registered block.",
      ],

      ios: [
        "Do not assume an Android capability automatically exists on iOS.",
        "Only use an iOS native block when its registered runtime metadata says it is supported.",
        "Background behavior remains subject to iOS authorization and lifecycle rules.",
      ],

      resources: [
        "Do not request millisecond polling.",
        "Do not create unbounded in-memory sample arrays.",
        "Use registered resource presets and intervals instead of inventing aggressive values.",
        "Prefer event-driven or batched persistence for long-running sensor/location workloads.",
        "Do not create arbitrary background loops.",
      ],
    },

    visualFirstRules: [
      "BRIXTA VISUAL-FIRST RULES",
      "The Flutter host application's current BRIXTA theme is the base design system.",
      "Use theme.scope=inherit when the Responsibility should look native to the existing BRIXTA app.",
      "Use theme.scope=responsibility only when the user explicitly wants this Responsibility to have its own scoped visual identity.",
      "Use theme.scope=immersive only for experiences that genuinely need to own the full Responsibility screen.",
      "Do not invent theme tokens outside presentationRuntime.designSystem.supportedThemeTokens.",
      "System accessibility and reduced-motion preferences outrank authored animation.",
      "A capture is DATA COLLECTION. It is not a generic read-only display widget.",
      "BRIXTA_AI_VISUAL_INPUT_RULE_V11",
      "When the employee must ENTER, SELECT, PICK or CAPTURE a value inside a visual app, create interaction.capture bound to that EXISTING capture.",
      "Do NOT use display.value for editable Dealer selection, Business Record selection, Photo, File, Signature, GPS, Quantity, Choice, Notes or other employee input.",
      "display.value remains read-only presentation.",
      "For entity_reference and other business references, reuse an existing Data Source by setting capture.config.source to the Data Source key.",
      "Preserve the requested visual composition around interaction.capture blocks. Never fall back to a generic enterprise form merely because the app contains captures.",
      "NEVER create a number capture merely to display a counter, score, KPI or calculated value.",
      "NEVER create a short_text capture merely to display a banner, heading, success message or animation text.",
      "Use app.uiDocument display.* blocks for read-only presentation.",
      "Use interaction.action_button for a real button.",
      "Use overlay.fullscreen for a full-screen state-driven visual experience.",
      "Use animation on UI blocks rather than inventing form fields for animation state.",
      "Bind counters and calculated displays to computed values whenever the value is produced by Pixel Logic.",
      "captureIds on an action contain ONLY values that must actually be collected from the employee/device for that action.",
      "A button that only triggers behavior normally has captureIds: [].",
      "For a visual-only app it is valid for app.captures to be [].",
      "The compatibility app.layout still lists business actions/captures needed by runtime publishing. The visual arrangement belongs in app.uiDocument.rootIds and blocks.",
      "Do not turn a non-form application into a form merely because capture primitives exist.",
    ],

    separationRules: [
      "THIS IS APP BUILDER AI, NOT PIXEL LOGIC.",
      "Generate phone/UI blocks, actors, contexts, states, captures, actions, outputs and layout only.",
      "DO NOT output Pixel Logic nodes.",
      "DO NOT output Pixel Logic edges.",
      "DO NOT output event.* nodes.",
      "DO NOT output effect.* nodes.",
      "DO NOT output a program object.",
      "DO NOT output events, rules or effects.",
      "DO NOT create or depend on a separate Workflow definition for new behavior.",
      "Use the existing employee reporting hierarchy for manager relationships.",
      "Represent approval/review routing with Kernel actors, states and actions; advanced conditions/effects belong in Pixel Logic.",
      "Advanced behavior wiring belongs to the separate Pixel Logic builder.",
      "Basic action availableState/resultingState configuration is allowed because the normal App Builder already supports action lifecycle configuration.",
    ],

    preservationRules: [
      "Preserve existing useful App Builder blocks unless the user's requirement explicitly removes or replaces them.",
      "When modifying an existing Responsibility, return the COMPLETE desired App Builder definition, not a partial patch.",
      "Reuse stable existing IDs whenever the existing block represents the same business concept.",
    ],

    outputContract: [
      "Return EXACTLY ONE valid RFC 8259 JSON object.",
      "Use 2-space indentation.",
      "Use double quotes for keys and string values.",
      "No Markdown fences.",
      "No prose before or after JSON.",
      "No comments.",
      "No trailing commas.",
      "No undefined, NaN or Infinity.",
      "Return the COMPLETE App Builder envelope.",
      "Copy blockRegistryFingerprint exactly.",
      "unsupportedCapabilities must be string[].",
    ],

    acceptedJsonExample: example,

    visualOnlyExample: {
      purpose:
        "REFERENCE FOR APPS THAT ARE NOT FORMS. This example intentionally has zero captures.",

      app: {
        captures: [],

        actions: [
          {
            id: "increment",

            label: "CLICK ME",

            kind: "submit",

            actorId: "current_employee",

            objectId: "current_record",

            captureIds: [],

            config: {
              availableState: "draft",

              resultingState: "draft",

              successMessage: "Clicked.",
            },
          },
        ],

        layout: [
          {
            type: "action",

            id: "increment",
          },
        ],

        uiDocument: {
          version: 1,

          engine: "brixta_stac_v1",

          rootIds: ["counter", "button", "celebration"],

          blocks: [
            {
              id: "counter",

              type: "display.counter",

              binding: {
                scope: "computed",

                key: "click_count",
              },

              animation: {
                preset: "scale",

                durationMs: 180,
              },

              config: {
                size: "hero",

                alignment: "center",
              },
            },

            {
              id: "button",

              type: "interaction.action_button",

              actionId: "increment",

              config: {
                label: "CLICK ME",

                style: "primary",

                size: "large",
              },
            },

            {
              id: "celebration",

              type: "overlay.fullscreen",

              visibility: {
                binding: {
                  scope: "state",

                  key: "process",
                },

                operator: "eq",

                value: "completed",
              },

              animation: {
                preset: "fade_scale",

                durationMs: 500,
              },

              config: {
                text: "MEOW!",
              },
            },
          ],
        },
      },
    },

    rejectedExamples: [
      {
        reason: "Pixel Logic is not allowed in an App Builder response.",

        invalid: {
          program: {
            nodes: [],
            edges: [],
          },
        },
      },

      {
        reason:
          "A capability not present in availableBlocks may not be invented.",

        invalid: {
          nativeCapability: "magic_background_tracker",
        },
      },

      {
        reason: "Do not return partial block patches.",

        invalid: {
          add: "one field",
        },
      },
    ],
  };

  return [
    JSON.stringify(packet, null, 2),

    "",
    "USER INSTRUCTIONS",
    "-----------------",
    "Use the packet above as the authoritative BRIXTA App Builder contract.",
    "Then follow the user's natural-language requirement.",
    "Return ONLY the final JSON object described by acceptedJsonExample.",
  ].join("\n");
}

export function parseResponsibilityAppBuilderAIImport(
  text: string,
): ResponsibilityAppBuilderAIImportResult {
  const root = parseStrictJsonObject(text);

  if (
    root.program !== undefined ||
    root.events !== undefined ||
    root.rules !== undefined ||
    root.effects !== undefined
  ) {
    throw new Error(
      "App Builder AI may not contain Pixel Logic program/events/rules/effects.",
    );
  }

  if (root.format !== RESPONSIBILITY_APP_BUILDER_AI_FORMAT) {
    throw new Error(
      `format must be "${RESPONSIBILITY_APP_BUILDER_AI_FORMAT}".`,
    );
  }

  if (
    Number(root.formatVersion) !== RESPONSIBILITY_APP_BUILDER_AI_FORMAT_VERSION
  ) {
    throw new Error(
      `formatVersion must be ${RESPONSIBILITY_APP_BUILDER_AI_FORMAT_VERSION}.`,
    );
  }

  const fingerprint = stringValue(
    root.blockRegistryFingerprint,
    "blockRegistryFingerprint",
  );

  const responsibility = objectValue(root.responsibility, "responsibility");

  if (
    typeof responsibility.id !== "string" &&
    typeof responsibility.id !== "number"
  ) {
    throw new Error("responsibility.id must be a string or number.");
  }

  const responsibilityTitle = stringValue(
    responsibility.title,
    "responsibility.title",
  );

  const app = objectValue(root.app, "app");

  for (const forbidden of [
    "program",
    "events",
    "rules",
    "effects",
    "pixelLogic",
  ]) {
    if (app[forbidden] !== undefined) {
      throw new Error(
        `app.${forbidden} is forbidden. Logic belongs in Pixel Logic.`,
      );
    }
  }

  const actorsRaw = arrayValue(app.actors, "app.actors");

  const objectsRaw = arrayValue(app.objects, "app.objects");

  const contextsRaw = arrayValue(app.contexts, "app.contexts");

  const statesRaw = arrayValue(app.states, "app.states");

  const capturesRaw = arrayValue(app.captures, "app.captures");

  const actionsRaw = arrayValue(app.actions, "app.actions");

  const outputsRaw = arrayValue(app.outputs, "app.outputs");

  const layoutRaw = arrayValue(app.layout, "app.layout");

  for (const [values, path] of [
    [actorsRaw, "app.actors"],
    [objectsRaw, "app.objects"],
    [contextsRaw, "app.contexts"],
    [statesRaw, "app.states"],
    [capturesRaw, "app.captures"],
    [actionsRaw, "app.actions"],
    [outputsRaw, "app.outputs"],
  ] as const) {
    uniqueIds(values, path);
  }

  const captureKinds = new Set(CAPTURE_CATALOG.map((item) => item.kind));

  const actionKinds = new Set(ACTION_CATALOG.map((item) => item.kind));

  const outputKinds = new Set(OUTPUT_CATALOG.map((item) => item.kind));

  const actors = actorsRaw.map((raw, index) => {
    const item = objectValue(raw, `app.actors[${index}]`);

    stringValue(item.id, `app.actors[${index}].id`);

    stringValue(item.label, `app.actors[${index}].label`);

    objectValue(item.resolver, `app.actors[${index}].resolver`);

    return item as unknown as KernelActor;
  });

  const objects = objectsRaw.map((raw, index) => {
    const item = objectValue(raw, `app.objects[${index}]`);

    stringValue(item.id, `app.objects[${index}].id`);

    stringValue(item.label, `app.objects[${index}].label`);

    stringValue(item.kind, `app.objects[${index}].kind`);

    return item as unknown as KernelObject;
  });

  const contexts = contextsRaw.map((raw, index) => {
    const item = objectValue(raw, `app.contexts[${index}]`);

    stringValue(item.id, `app.contexts[${index}].id`);

    stringValue(item.label, `app.contexts[${index}].label`);

    stringValue(item.source, `app.contexts[${index}].source`);

    if (typeof item.mutable !== "boolean") {
      throw new Error(`app.contexts[${index}].mutable must be a boolean.`);
    }

    return item as unknown as KernelContext;
  });

  const states = statesRaw.map((raw, index) => {
    const item = objectValue(raw, `app.states[${index}]`);

    stringValue(item.id, `app.states[${index}].id`);

    stringValue(item.label, `app.states[${index}].label`);

    stringValue(item.dimension, `app.states[${index}].dimension`);

    return item as unknown as KernelState;
  });

  const captures = capturesRaw.map((raw, index) => {
    const item = objectValue(raw, `app.captures[${index}]`);

    stringValue(item.id, `app.captures[${index}].id`);

    stringValue(item.label, `app.captures[${index}].label`);

    const kind = stringValue(item.kind, `app.captures[${index}].kind`);

    if (!captureKinds.has(kind as never)) {
      throw new Error(
        `Unsupported capture kind "${kind}" at app.captures[${index}].`,
      );
    }

    objectValue(item.config, `app.captures[${index}].config`);

    return item as unknown as KernelCapture;
  });

  const actions = actionsRaw.map((raw, index) => {
    const item = objectValue(raw, `app.actions[${index}]`);

    stringValue(item.id, `app.actions[${index}].id`);

    stringValue(item.label, `app.actions[${index}].label`);

    const kind = stringValue(item.kind, `app.actions[${index}].kind`);

    if (!actionKinds.has(kind as never)) {
      throw new Error(
        `Unsupported action kind "${kind}" at app.actions[${index}].`,
      );
    }

    stringArray(item.captureIds, `app.actions[${index}].captureIds`);

    objectValue(item.config, `app.actions[${index}].config`);

    return item as unknown as KernelAction;
  });

  const outputs = outputsRaw.map((raw, index) => {
    const item = objectValue(raw, `app.outputs[${index}]`);

    stringValue(item.id, `app.outputs[${index}].id`);

    stringValue(item.label, `app.outputs[${index}].label`);

    const kind = stringValue(item.kind, `app.outputs[${index}].kind`);

    if (!outputKinds.has(kind as never)) {
      throw new Error(
        `Unsupported output kind "${kind}" at app.outputs[${index}].`,
      );
    }

    stringArray(item.actorIds, `app.outputs[${index}].actorIds`);

    stringArray(item.stateIds, `app.outputs[${index}].stateIds`);

    stringArray(item.visibleKeys, `app.outputs[${index}].visibleKeys`);

    objectValue(item.config, `app.outputs[${index}].config`);

    return item as unknown as KernelOutput;
  });

  const declared = new Set([
    ...captures.map((item) => `capture:${item.id}`),

    ...actions.map((item) => `action:${item.id}`),

    ...outputs.map((item) => `output:${item.id}`),
  ]);

  const layout = layoutRaw.map((raw, index) => {
    const item = objectValue(raw, `app.layout[${index}]`);

    const type = stringValue(item.type, `app.layout[${index}].type`);

    if (type !== "capture" && type !== "action" && type !== "output") {
      throw new Error(
        `app.layout[${index}].type must be capture, action or output.`,
      );
    }

    const id = stringValue(item.id, `app.layout[${index}].id`);

    if (!declared.has(`${type}:${id}`)) {
      throw new Error(
        `app.layout[${index}] references undeclared ${type} "${id}".`,
      );
    }

    return {
      type: type as "capture" | "action" | "output",
      id,
    };
  });

  const uiDocument = parseResponsibilityUiDocument(app.uiDocument);

  // BRIXTA_AI_VISUAL_FUNCTION_REFERENCE_VALIDATION_V11
  //
  // Prevent AI from producing beautiful-but-dead controls.
  const captureBindingKeys =
    new Set<string>();

  for (const capture of captures) {
    captureBindingKeys.add(
      capture.id,
    );

    if (
      typeof capture.storeAs ===
        "string" &&
      capture.storeAs.trim()
    ) {
      captureBindingKeys.add(
        capture.storeAs,
      );
    }
  }

  const declaredActionIds =
    new Set(
      actions.map(
        (action) =>
          action.id,
      ),
    );

  for (const block of uiDocument.blocks) {
    if (
      block.type ===
      "interaction.capture"
    ) {
      if (
        block.binding?.scope !==
          "capture" ||
        !block.binding.key
      ) {
        throw new Error(
          `UI input "${block.id}" must bind to an existing capture.`,
        );
      }

      if (
        !captureBindingKeys.has(
          block.binding.key,
        )
      ) {
        throw new Error(
          `UI input "${block.id}" references unknown capture "${block.binding.key}".`,
        );
      }
    }

    if (
      block.type ===
      "interaction.action_button"
    ) {
      if (
        !block.actionId ||
        !declaredActionIds.has(
          block.actionId,
        )
      ) {
        throw new Error(
          `UI action button "${block.id}" must reference an existing app action.`,
        );
      }
    }
  }

  return {
    format: RESPONSIBILITY_APP_BUILDER_AI_FORMAT,

    formatVersion: RESPONSIBILITY_APP_BUILDER_AI_FORMAT_VERSION,

    blockRegistryFingerprint: fingerprint,

    responsibilityId: responsibility.id,

    responsibilityTitle,

    app: {
      title: optionalString(app.title) || responsibilityTitle,

      description: optionalString(app.description),

      employeeOwnHistoryVisible: app.employeeOwnHistoryVisible === true,

      actors,

      objects,

      contexts,

      states,

      captures,

      actions,

      outputs,

      layout,
      uiDocument,
    },

    unsupportedCapabilities: stringArray(
      root.unsupportedCapabilities,
      "unsupportedCapabilities",
    ),

    notes: stringArray(root.notes, "notes"),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function possibilityKey(type: "capture" | "action" | "output", id: string) {
  return `${type}_${id}`;
}

export function applyResponsibilityAppBuilderAIImport(
  current: ResponsibilityKernel,
  result: ResponsibilityAppBuilderAIImportResult,
): ResponsibilityKernel {
  const next = clone(current);

  next.runtimeWorld = {
    actors: clone(result.app.actors),

    objects: clone(result.app.objects),

    contexts: clone(result.app.contexts),

    states: clone(result.app.states),
  };

  const currentIds = new Map<string, string>();

  for (const possibility of current.possibilities) {
    if (possibility.type === "capture") {
      currentIds.set(`capture:${possibility.capture.id}`, possibility.id);
    }

    if (possibility.type === "action") {
      currentIds.set(`action:${possibility.action.id}`, possibility.id);
    }

    if (possibility.type === "output") {
      currentIds.set(`output:${possibility.output.id}`, possibility.id);
    }
  }

  const possibilities: KernelPossibility[] = [
    ...result.app.captures.map((capture) => ({
      id:
        currentIds.get(`capture:${capture.id}`) ??
        possibilityKey("capture", capture.id),

      type: "capture" as const,

      capture: clone(capture),
    })),

    ...result.app.actions.map((action) => ({
      id:
        currentIds.get(`action:${action.id}`) ??
        possibilityKey("action", action.id),

      type: "action" as const,

      action: clone(action),
    })),

    ...result.app.outputs.map((output) => ({
      id:
        currentIds.get(`output:${output.id}`) ??
        possibilityKey("output", output.id),

      type: "output" as const,

      output: clone(output),
    })),
  ];

  next.possibilities = possibilities;

  const possibilityBySemanticId = new Map<string, string>();

  for (const possibility of possibilities) {
    if (possibility.type === "capture") {
      possibilityBySemanticId.set(
        `capture:${possibility.capture.id}`,
        possibility.id,
      );
    }

    if (possibility.type === "action") {
      possibilityBySemanticId.set(
        `action:${possibility.action.id}`,
        possibility.id,
      );
    }

    if (possibility.type === "output") {
      possibilityBySemanticId.set(
        `output:${possibility.output.id}`,
        possibility.id,
      );
    }
  }

  next.metadata = {
    ...next.metadata,

    ui: {
      ...(next.metadata.ui ?? {
        layout: [],
      }),

      title: result.app.title,

      description: result.app.description,

      employeeOwnHistoryVisible: result.app.employeeOwnHistoryVisible,

      uiDocument: clone(result.app.uiDocument),

      layout: result.app.layout
        .map((item) => possibilityBySemanticId.get(`${item.type}:${item.id}`))
        .filter((id): id is string => Boolean(id)),
    },
  };

  /*
   * APP BUILDER / PIXEL LOGIC SEPARATION
   *
   * Existing advanced events/rules survive untouched.
   *
   * The normal manual App Builder already creates a tiny base lifecycle rule
   * for a newly-created action so a simple App Builder action can function
   * even before advanced Pixel Logic is authored.
   *
   * We mirror that behavior here, but only when the action has no action
   * event/rule yet.
   */
  for (const action of result.app.actions) {
    let event = next.events.find(
      (item) => item.kind === "action" && item.actionId === action.id,
    );

    if (!event) {
      event = {
        id: `app_event_${action.id}`,

        label: `${action.label} happens`,

        kind: "action",

        actionId: action.id,
      };

      next.events.push(event);
    }

    const hasRule = next.rules.some((rule) => rule.eventId === event?.id);

    if (hasRule) {
      continue;
    }

    const effects: KernelRule["effects"] = [];

    const resultingState =
      typeof action.config.resultingState === "string"
        ? action.config.resultingState.trim()
        : "";

    if (resultingState) {
      effects.push({
        id: `app_effect_${action.id}_state`,

        kind: "change_state",

        targetKey: "process",

        value: {
          kind: "literal",

          value: resultingState,
        },

        config: {},
      });
    }

    effects.push({
      id: `app_effect_${action.id}_history`,

      kind: "append_history",

      config: {
        label: action.label,
      },
    });

    next.rules.push({
      id: `app_rule_${action.id}`,

      label: `${action.label} behavior`,

      eventId: event.id,

      when: {
        mode: "all",

        conditions: [],
      },

      effects,

      priority: 100,

      enabled: true,
    });
  }

  return next;
}

export function validateResponsibilityAppBuilderAIImport(
  current: ResponsibilityKernel,
  result: ResponsibilityAppBuilderAIImportResult,
  nativeBlocks: AppBuilderNativeBlockContext[],
) {
  const issues: string[] = [];

  if (result.unsupportedCapabilities.length > 0) {
    issues.push(
      `Unsupported capabilities: ${result.unsupportedCapabilities.join(", ")}`,
    );
  }

  const availableNative = new Set<string>();

  for (const block of nativeBlocks) {
    availableNative.add(block.key);

    const capability = block.config.nativeCapability;

    if (typeof capability === "string") {
      availableNative.add(capability);
    }
  }

  for (const capture of result.app.captures) {
    const capability = capture.config.nativeCapability;

    if (
      typeof capability === "string" &&
      capability.trim() &&
      !availableNative.has(capability)
    ) {
      issues.push(
        `Capture "${capture.id}" requests unregistered native capability "${capability}".`,
      );
    }
  }

  const declaredActionIds = new Set(
    result.app.actions.map((action) => action.id),
  );

  for (const block of result.app.uiDocument.blocks) {
    if (block.actionId && !declaredActionIds.has(block.actionId)) {
      issues.push(
        `UI block "${block.id}" references unknown action "${block.actionId}".`,
      );
    }
  }

  const next = applyResponsibilityAppBuilderAIImport(current, result);

  const kernelIssues = validateResponsibilityKernel(next);

  for (const issue of kernelIssues) {
    if (issue.severity === "error") {
      issues.push(issue.message);
    }
  }

  return issues;
}
