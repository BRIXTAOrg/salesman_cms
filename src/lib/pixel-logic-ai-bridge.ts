// BRIXTA_PIXEL_REALITY_V2
import { listPixelLogicNodeSpecs } from "@/lib/pixel-logic-registry";
import {
  normalizePixelLogicProgram,
  type PixelLogicNodeSpec,
  type PixelLogicProgram,
  type PixelLogicValueType,
} from "@/lib/pixel-logic-types";
import {
  blankPixelReality,
  normalizePixelReality,
  type PixelRealityProposal,
} from "@/lib/pixel-reality-types";
import type {
  KernelCaptureKind,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

import {
  BRIXTA_PRESENTATION_RUNTIME_CAPABILITIES,
  buildPixelPresentationContext,
} from "@/lib/responsibility-presentation-runtime";
import { pixelLogicExecutionAIContext } from "@/lib/pixel-logic-execution-policy";

export const PIXEL_LOGIC_AI_FORMAT = "brixta.pixel-logic" as const;
export const PIXEL_LOGIC_AI_FORMAT_VERSION = 2 as const;

export type PixelLogicAIEmployee = {
  id: number;
  name?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  designation?: string | null;
  role?: string | null;
  area?: string | null;
  zone?: string | null;
  reportsToId?: number | null;
  reportingManagerName?: string | null;
  reportingStatus?: string | null;
  reportingPolicy?: Record<string, unknown> | null;
};

export type PixelLogicAIRole = {
  id: number;
  label: string;
  orgRole?: string | null;
  jobRole?: string | null;
};

export type PixelLogicAIImportResult = {
  program: PixelLogicProgram;
  reality: PixelRealityProposal;
  registryFingerprint?: string;
  responsibilityId?: number | string;
  responsibilityTitle?: string;
  unsupportedCapabilities: string[];
  notes: string[];
};

type BuildPixelLogicAIContextInput = {
  responsibilityId: number | string;
  responsibilityTitle: string;
  kernel: ResponsibilityKernel | null;
  currentProgram: PixelLogicProgram;
  roles?: PixelLogicAIRole[];
  employees?: PixelLogicAIEmployee[];
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/*
 * BRIXTA_CONTEXT_AI_STRICT_IMPORT_V1
 *
 * AI IMPORT IS A COMPILER BOUNDARY.
 *
 * Stored/legacy definitions may be normalized tolerantly elsewhere.
 * Fresh AI output is different: malformed structure must fail closed
 * BEFORE normalization can silently discard information.
 */
function requireRawObject(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function requireRawArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be a JSON array.`);
  }

  return value;
}

function requireRawString(value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} must be a non-empty JSON string.`);
  }

  return value.trim();
}

function validateRawStringArray(value: unknown, path: string) {
  const values = requireRawArray(value, path);

  values.forEach((item, index) => {
    if (typeof item !== "string") {
      throw new Error(
        `${path}[${index}] must be a string. Objects are NOT accepted here.`,
      );
    }
  });
}

function validateUniqueRawIds(values: unknown[], path: string) {
  const seen = new Set<string>();

  values.forEach((raw, index) => {
    const value = requireRawObject(raw, `${path}[${index}]`);

    const id = requireRawString(value.id, `${path}[${index}].id`);

    if (seen.has(id)) {
      throw new Error(`Duplicate ID "${id}" in ${path}.`);
    }

    seen.add(id);
  });
}

function validateRawPixelLogicAIEnvelope(value: Record<string, unknown>) {
  /*
   * TOP LEVEL
   */
  requireRawString(value.registryFingerprint, "registryFingerprint");

  const responsibility = requireRawObject(
    value.responsibility,
    "responsibility",
  );

  if (
    typeof responsibility.id !== "string" &&
    typeof responsibility.id !== "number"
  ) {
    throw new Error("responsibility.id must be a string or number.");
  }

  requireRawString(responsibility.title, "responsibility.title");

  /*
   * UNSUPPORTED CAPABILITIES
   *
   * CURRENT CONTRACT IS string[].
   *
   * This explicitly rejects:
   *
   * [
   *   {
   *     "capability": "...",
   *     "reason": "..."
   *   }
   * ]
   *
   * because the current parser/runtime contract does not use that shape.
   */
  validateRawStringArray(
    value.unsupportedCapabilities,
    "unsupportedCapabilities",
  );

  validateRawStringArray(value.notes, "notes");

  /*
   * PIXEL REALITY
   */
  const reality = requireRawObject(value.reality, "reality");

  if (Number(reality.version) !== 1) {
    throw new Error("reality.version must be exactly 1.");
  }

  const actors = requireRawArray(reality.actors, "reality.actors");

  const contexts = requireRawArray(reality.contexts, "reality.contexts");

  const objects = requireRawArray(reality.objects, "reality.objects");

  const states = requireRawArray(reality.states, "reality.states");

  const captures = requireRawArray(reality.captures, "reality.captures");

  const actions = requireRawArray(reality.actions, "reality.actions");

  const outputs = requireRawArray(reality.outputs, "reality.outputs");

  if (
    reality.interface !==
    undefined
  ) {
    const interfaceValue =
      requireRawObject(
        reality.interface,
        "reality.interface",
      );

    if (
      interfaceValue.appUiDocument !==
      undefined
    ) {
      requireRawObject(
        interfaceValue.appUiDocument,
        "reality.interface.appUiDocument",
      );
    }
  }

  validateRawStringArray(reality.warnings, "reality.warnings");

  validateRawStringArray(reality.notes, "reality.notes");

  validateUniqueRawIds(actors, "reality.actors");

  validateUniqueRawIds(contexts, "reality.contexts");

  validateUniqueRawIds(objects, "reality.objects");

  validateUniqueRawIds(states, "reality.states");

  validateUniqueRawIds(captures, "reality.captures");

  validateUniqueRawIds(actions, "reality.actions");

  validateUniqueRawIds(outputs, "reality.outputs");

  actors.forEach((raw, index) => {
    const actor = requireRawObject(raw, `reality.actors[${index}]`);

    requireRawString(actor.id, `reality.actors[${index}].id`);

    requireRawString(actor.label, `reality.actors[${index}].label`);

    const resolver = requireRawObject(
      actor.resolver,
      `reality.actors[${index}].resolver`,
    );

    requireRawString(resolver.kind, `reality.actors[${index}].resolver.kind`);

    validateRawStringArray(actor.surfaces, `reality.actors[${index}].surfaces`);

    if (
      actor.recordScope !== undefined &&
      actor.recordScope !== "own" &&
      actor.recordScope !== "related" &&
      actor.recordScope !== "organization"
    ) {
      throw new Error(
        `reality.actors[${index}].recordScope must be "own", "related", or "organization".`,
      );
    }
  });

  contexts.forEach((raw, index) => {
    const item = requireRawObject(raw, `reality.contexts[${index}]`);

    requireRawString(item.id, `reality.contexts[${index}].id`);

    requireRawString(item.label, `reality.contexts[${index}].label`);

    requireRawString(item.source, `reality.contexts[${index}].source`);
  });

  objects.forEach((raw, index) => {
    const item = requireRawObject(raw, `reality.objects[${index}]`);

    requireRawString(item.id, `reality.objects[${index}].id`);

    requireRawString(item.label, `reality.objects[${index}].label`);

    requireRawString(item.kind, `reality.objects[${index}].kind`);
  });

  states.forEach((raw, index) => {
    const item = requireRawObject(raw, `reality.states[${index}]`);

    requireRawString(item.id, `reality.states[${index}].id`);

    requireRawString(item.label, `reality.states[${index}].label`);
  });

  captures.forEach((raw, index) => {
    const item = requireRawObject(raw, `reality.captures[${index}]`);

    requireRawString(item.id, `reality.captures[${index}].id`);

    requireRawString(item.label, `reality.captures[${index}].label`);

    requireRawString(item.kind, `reality.captures[${index}].kind`);

    if (item.config !== undefined) {
      requireRawObject(item.config, `reality.captures[${index}].config`);
    }
  });

  actions.forEach((raw, index) => {
    const item = requireRawObject(raw, `reality.actions[${index}]`);

    requireRawString(item.id, `reality.actions[${index}].id`);

    requireRawString(item.label, `reality.actions[${index}].label`);

    requireRawString(item.kind, `reality.actions[${index}].kind`);

    if (item.captureIds !== undefined) {
      validateRawStringArray(
        item.captureIds,
        `reality.actions[${index}].captureIds`,
      );
    }

    if (item.config !== undefined) {
      requireRawObject(item.config, `reality.actions[${index}].config`);
    }
  });

  outputs.forEach((raw, index) => {
    const item = requireRawObject(raw, `reality.outputs[${index}]`);

    requireRawString(item.id, `reality.outputs[${index}].id`);

    requireRawString(item.label, `reality.outputs[${index}].label`);

    requireRawString(item.kind, `reality.outputs[${index}].kind`);

    validateRawStringArray(item.actorIds, `reality.outputs[${index}].actorIds`);

    if (item.stateIds !== undefined) {
      validateRawStringArray(
        item.stateIds,
        `reality.outputs[${index}].stateIds`,
      );
    }

    if (item.visibleKeys !== undefined) {
      validateRawStringArray(
        item.visibleKeys,
        `reality.outputs[${index}].visibleKeys`,
      );
    }

    if (item.surfaces !== undefined) {
      validateRawStringArray(
        item.surfaces,
        `reality.outputs[${index}].surfaces`,
      );
    }
  });

  /*
   * PIXEL PROGRAM
   */
  const program = requireRawObject(value.program, "program");

  if (Number(program.version) !== 1) {
    throw new Error("program.version must be exactly 1.");
  }

  if (typeof program.enabled !== "boolean") {
    throw new Error("program.enabled must be a JSON boolean.");
  }

  requireRawString(program.name, "program.name");

  const metadata = requireRawObject(program.metadata, "program.metadata");

  if (metadata.generatedBy !== "external-ai") {
    throw new Error(
      'program.metadata.generatedBy must be exactly "external-ai".',
    );
  }

  const nodes = requireRawArray(program.nodes, "program.nodes");

  const nodeIds = new Set<string>();

  nodes.forEach((raw, index) => {
    const node = requireRawObject(raw, `program.nodes[${index}]`);

    const id = requireRawString(node.id, `program.nodes[${index}].id`);

    if (nodeIds.has(id)) {
      throw new Error(`Duplicate Pixel node ID "${id}".`);
    }

    nodeIds.add(id);

    requireRawString(node.type, `program.nodes[${index}].type`);

    const position = requireRawObject(
      node.position,
      `program.nodes[${index}].position`,
    );

    if (
      !Number.isFinite(Number(position.x)) ||
      !Number.isFinite(Number(position.y))
    ) {
      throw new Error(
        `program.nodes[${index}].position requires numeric x and y.`,
      );
    }

    requireRawObject(node.config, `program.nodes[${index}].config`);

    if (
      node.execution !==
      undefined
    ) {
      const execution =
        requireRawObject(
          node.execution,
          `program.nodes[${index}].execution`,
        );

      const placement =
        requireRawString(
          execution.placement,
          `program.nodes[${index}].execution.placement`,
        );

      if (
        placement !== "auto" &&
        placement !== "device" &&
        placement !== "server"
      ) {
        throw new Error(
          `program.nodes[${index}].execution.placement must be "auto", "device", or "server".`,
        );
      }
    }
  });

  /*
   * EDGE FORMAT IS DELIBERATELY STRICT.
   *
   * ACCEPTED:
   *
   * {
   *   "id": "...",
   *   "kind": "flow",
   *   "fromNodeId": "...",
   *   "fromPort": "flow",
   *   "toNodeId": "...",
   *   "toPort": "flow"
   * }
   *
   * REJECTED:
   *
   * {
   *   "from": {"nodeId": "..."},
   *   "to": {"nodeId": "..."}
   * }
   */
  const edges = requireRawArray(program.edges, "program.edges");

  const edgeIds = new Set<string>();

  edges.forEach((raw, index) => {
    const edge = requireRawObject(raw, `program.edges[${index}]`);

    if ("from" in edge || "to" in edge) {
      throw new Error(
        `program.edges[${index}] uses unsupported nested from/to syntax. Use flat fromNodeId/fromPort/toNodeId/toPort fields.`,
      );
    }

    const id = requireRawString(edge.id, `program.edges[${index}].id`);

    if (edgeIds.has(id)) {
      throw new Error(`Duplicate Pixel edge ID "${id}".`);
    }

    edgeIds.add(id);

    const kind = requireRawString(edge.kind, `program.edges[${index}].kind`);

    if (kind !== "flow" && kind !== "data") {
      throw new Error(`program.edges[${index}].kind must be "flow" or "data".`);
    }

    const fromNodeId = requireRawString(
      edge.fromNodeId,
      `program.edges[${index}].fromNodeId`,
    );

    requireRawString(edge.fromPort, `program.edges[${index}].fromPort`);

    const toNodeId = requireRawString(
      edge.toNodeId,
      `program.edges[${index}].toNodeId`,
    );

    requireRawString(edge.toPort, `program.edges[${index}].toPort`);

    if (!nodeIds.has(fromNodeId)) {
      throw new Error(
        `program.edges[${index}] references unknown fromNodeId "${fromNodeId}".`,
      );
    }

    if (!nodeIds.has(toNodeId)) {
      throw new Error(
        `program.edges[${index}] references unknown toNodeId "${toNodeId}".`,
      );
    }
  });

  const variables = requireRawArray(program.variables, "program.variables");

  variables.forEach((raw, index) => {
    const variable = requireRawObject(raw, `program.variables[${index}]`);

    requireRawString(variable.key, `program.variables[${index}].key`);

    requireRawString(variable.label, `program.variables[${index}].label`);

    requireRawString(
      variable.valueType,
      `program.variables[${index}].valueType`,
    );
  });
}

function captureValueType(kind: KernelCaptureKind): PixelLogicValueType {
  if (
    kind === "number" ||
    kind === "amount" ||
    kind === "rating" ||
    kind === "timer"
  )
    return "number";

  if (kind === "date") return "date";
  if (kind === "datetime") return "datetime";
  if (kind === "boolean") return "boolean";
  if (kind === "gps") return "location";

  if (kind === "route" || kind === "checklist" || kind === "repeating_section")
    return "array";

  if (
    kind === "person_reference" ||
    kind === "entity_reference" ||
    kind === "responsibility_reference"
  )
    return "reference";

  return "string";
}

function contextValueType(
  config: Record<string, unknown>,
): PixelLogicValueType {
  const raw = config.valueType;
  const allowed = new Set<PixelLogicValueType>([
    "any",
    "number",
    "string",
    "boolean",
    "date",
    "datetime",
    "duration",
    "money",
    "location",
    "object",
    "array",
    "record",
    "reference",
    "void",
  ]);

  return typeof raw === "string" && allowed.has(raw as PixelLogicValueType)
    ? (raw as PixelLogicValueType)
    : "any";
}

function compactRegistrySpec(spec: PixelLogicNodeSpec) {
  return {
    type: spec.type,
    label: spec.label,
    purpose: spec.description,
    kind: spec.kind,
    inputs: spec.inputs.map((port) => ({
      key: port.key,
      kind: port.kind,
      valueType: port.valueType ?? (port.kind === "flow" ? "void" : "any"),
      required: port.required === true,
      many: port.many === true,
    })),
    outputs: spec.outputs.map((port) => ({
      key: port.key,
      kind: port.kind,
      valueType: port.valueType ?? (port.kind === "flow" ? "void" : "any"),
    })),
    config: (spec.configFields ?? []).map((field) => ({
      key: field.key,
      kind: field.kind,
      options: field.options?.map((option) => option.value) ?? undefined,
    })),
  };
}

function stableRegistrySource(specs: PixelLogicNodeSpec[]) {
  return JSON.stringify(
    specs.map(compactRegistrySpec).sort((a, b) => a.type.localeCompare(b.type)),
  );
}

function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function pixelLogicRegistryFingerprint(
  specs = listPixelLogicNodeSpecs(),
) {
  return `pl2-${fnv1a(stableRegistrySource(specs))}`;
}

export function buildPixelLogicAIContext({
  responsibilityId,
  responsibilityTitle,
  kernel,
  currentProgram,
  roles = [],
  employees = [],
}: BuildPixelLogicAIContextInput) {
  const specs = listPixelLogicNodeSpecs();
  const registryFingerprint = pixelLogicRegistryFingerprint(specs);

  const actions =
    kernel?.possibilities
      .filter(
        (
          item,
        ): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "action" }
        > => item.type === "action",
      )
      .map((item) => ({
        id: item.action.id,
        label: item.action.label,
        kind: item.action.kind,
        actorId: item.action.actorId,
        captureIds: item.action.captureIds,
        config: item.action.config,
      })) ?? [];

  const captures =
    kernel?.possibilities
      .filter(
        (
          item,
        ): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "capture" }
        > => item.type === "capture",
      )
      .map((item) => ({
        id: item.capture.id,
        label: item.capture.label,
        kind: item.capture.kind,
        valueType: captureValueType(item.capture.kind),
        required: item.capture.required === true,
        storeAs: item.capture.storeAs,
        config: item.capture.config,
      })) ?? [];

  const contexts =
    kernel?.runtimeWorld.contexts.map((context) => ({
      id: context.id,
      label: context.label,
      source: context.source,
      valueType: contextValueType(context.config ?? {}),
      mutable: context.mutable,
    })) ?? [];

  const states =
    kernel?.runtimeWorld.states.map((state) => ({
      id: state.id,
      label: state.label,
      dimension: state.dimension,
      initial: state.initial === true,
      terminal: state.terminal === true,
    })) ?? [];

  const actors =
    kernel?.runtimeWorld.actors.map((actor) => ({
      id: actor.id,
      label: actor.label,
      resolver: actor.resolver,
    })) ?? [];

  const objects =
    kernel?.runtimeWorld.objects.map((object) => ({
      id: object.id,
      label: object.label,
      kind: object.kind,
    })) ?? [];

  const outputs =
    kernel?.possibilities
      .filter(
        (
          item,
        ): item is Extract<
          ResponsibilityKernel["possibilities"][number],
          { type: "output" }
        > => item.type === "output",
      )
      .map((item) => item.output) ?? [];

  const packet = {
    language: PIXEL_LOGIC_AI_FORMAT,
    formatVersion: PIXEL_LOGIC_AI_FORMAT_VERSION,
    registryFingerprint,

    responsibility: {
      id: responsibilityId,
      title: responsibilityTitle,
      existing: {
        actions,
        captures,
        contexts,
        states,
        actors,
        objects,
        outputs,
      },
    },

    deliveryTarget:
      kernel?.metadata.deliveryTargets ??
      {
        brixtaApp: {
          enabled: true,
        },
      },

    externalWebExecutionRules: [
      "External Link uses the same Responsibility IR and same Pixel Logic program; it is not a parallel workflow.",
      "For public External Link access, assume there may be no BRIXTA employee session.",
      "URL parameters belong to external request/runtime context.",
      "Browser/device effects are never financial authority.",
      "Public service calls must remain inside the External Link capability allow-list.",
      "Reward amount, eligibility, fraud decisions, atomic voucher claim and payout amount are server-authoritative.",
      "Do not manufacture payout amounts in Pixel Logic or client state.",
      "Do not execute unsupported employee-only native capabilities on external_web.",
      "When a capability is unavailable for external_web, report it instead of silently substituting behavior.",
    ],

    presentationContext: buildPixelPresentationContext(kernel),

    interfaceAuthoring: {
      rule:
        "Reality + Interface + Program are one Responsibility IR. Logic AI may author interface changes when required by the human behavior.",

      app: {
        writePath:
          "reality.interface.appUiDocument",

        mode:
          "complete_document_replace",

        preserveRule:
          "If no App UI change is required, return reality.interface as {}. If an App UI change IS required, return the COMPLETE desired uiDocument and preserve unrelated useful blocks/stable IDs.",

        bindingScopes: [
          "capture",
          "computed",
          "context",
          "state",
          "record",
          "actor",
          "literal",
        ],

        visualBlocks:
          BRIXTA_PRESENTATION_RUNTIME_CAPABILITIES.visualBlocks,
      },

      dashboard: {
        writePath:
          "reality.outputs[]",

        rule:
          "Dashboard presentation is authored through outputs. Computed values never need fake captures.",

        columnConfigPath:
          "reality.outputs[].config.columns",

        columnShape: {
          key:
            "stable presentation key",

          label:
            "human label",

          binding: {
            scope:
              "capture | computed | context | state | record | actor | query | literal",

            key:
              "binding key when applicable",

            path:
              "optional nested path",

            value:
              "literal value only for literal scope",
          },

          format: {
            kind:
              "text | number | currency | percent | date | datetime | boolean",

            currency:
              "optional ISO currency, e.g. INR",

            timezone:
              "optional IANA timezone",

            decimals:
              "optional integer",
          },
        },

        visibleKeysFallback:
          "visibleKeys remains supported as a compact fallback when custom columns are unnecessary.",

        specializedBindings: {
          metricBinding:
            "output.config.metricBinding",

          pointBinding:
            "output.config.pointBinding",

          routeBinding:
            "output.config.routeBinding",

          labelBinding:
            "output.config.labelBinding",
        },
      },
    },

    executionPlacement:
      pixelLogicExecutionAIContext(),

    organization: {
      availableRoles: roles.map((role) => ({
        id: role.id,
        label: role.label,
        orgRole: role.orgRole ?? null,
        jobRole: role.jobRole ?? null,
      })),
      availableEmployees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name ?? null,
        employeeCode: employee.employeeCode ?? null,
        department: employee.department ?? null,
        designation: employee.designation ?? null,
        role: employee.role ?? null,
        area: employee.area ?? null,
        zone: employee.zone ?? null,
        reportsToId: employee.reportsToId ?? null,
        reportingManagerName: employee.reportingManagerName ?? null,
        reportingStatus: employee.reportingStatus ?? null,
        reportingPolicy: employee.reportingPolicy ?? null,
      })),

      hierarchyRules: [
        "Employee reportingPolicy/reportsToId is the organization hierarchy source of truth.",
        "Use manager_of / relationship for relational actors such as reporting manager.",
        "Do not invent a parallel Workflow or manager-routing configuration.",
        "New approval/review behavior should use Kernel actors, states, actions and Pixel Logic.",
      ],
    },

    realityVocabulary: {
      actorResolvers: [
        "current_user",
        "record_creator",
        "specific_user",
        "role",
        "manager_of",
        "selected_reference",
        "query_result",
        "relationship",
        "system",
      ],
      surfaces: ["app", "dashboard"],
      recordScopes: ["own", "related", "organization"],
      actionKinds: [
        "create",
        "read",
        "update",
        "delete",
        "submit",
        "start",
        "stop",
        "pause",
        "resume",
        "approve",
        "reject",
        "return",
        "assign",
        "reassign",
        "delegate",
        "comment",
        "acknowledge",
        "sign",
        "notify",
        "trigger",
        "complete",
        "cancel",
      ],
      outputKinds: [
        "detail",
        "card",
        "list",
        "table",
        "timeline",
        "calendar",
        "gallery",
        "map",
        "route",
        "metric",
        "chart",
        "document",
        "receipt",
        "dashboard",
        "notification",
      ],
      captureKinds: [
        "short_text",
        "long_text",
        "number",
        "amount",
        "choice",
        "date",
        "datetime",
        "boolean",
        "photo",
        "video",
        "audio",
        "file",
        "signature",
        "gps",
        "route",
        "qr",
        "barcode",
        "nfc",
        "person_reference",
        "entity_reference",
        "responsibility_reference",
        "checklist",
        "rating",
        "timer",
        "repeating_section",
      ],
    },

    runtimeCapabilities: {
      /*
       * These are executable contracts currently installed in the BRIXTA
       * runtime family used by this CMS.
       *
       * AI must distinguish these from mere Pixel node names.
       */
      instanceModes: ["continuing", "repeatable"],

      // BRIXTA_COMPOSITE_SUBMISSION_GUARD_AI_V1
      logicEditing: {
        modifyExisting: true,

        strategy:
          "Treat existing Kernel + currentProgram as source code. Make the smallest semantic change, preserve unrelated IDs/behavior, then return the complete accepted BRIXTA envelope.",

        actionUpdateRule:
          "When modifying an existing action, use the SAME action ID and preserve all required fields not explicitly changed by the human.",

        prePersistenceRule:
          "Rules that must PREVENT a write belong in action.config.submissionGuards, because ordinary Pixel effects execute as behavior and are not a substitute for a pre-write invariant.",
      },

      submissionGuards: {
        expression: {
          supported: true,

          phases: [
            "availability",
            "submission",
            "both",
          ],

          placements: [
            "auto",
            "server",
          ],

          authoritativeHost:
            "server",

          description:
            "Generic safe JSON-expression pre-action policy. phase=both affects visible availability and is rechecked before persistence.",

          ops: [
            "literal",
            "server_now",
            "ref",
            "coalesce",

            "and",
            "or",
            "not",
            "if",

            "eq",
            "neq",
            "gt",
            "gte",
            "lt",
            "lte",
            "between",
            "contains",
            "exists",

            "add",
            "subtract",
            "multiply",
            "divide",
            "mod",
            "min",
            "max",
            "round",
            "abs",

            "time.local_minutes",
            "time.local_date",
            "time.day_of_week",
            "time.difference_minutes",
            "time.add_minutes",
          ],

          refScopes: [
            "server",
            "context",
            "capture",
            "actor",
            "state",
            "query",
            "computed",
            "object",
            "history",
          ],

          example: {
            human:
              "Punch In opens at 09:00 Asia/Kolkata.",

            guard: {
              kind:
                "expression",

              phase:
                "both",

              placement:
                "server",

              message:
                "Punch In opens at 09:00.",

              expression: {
                op:
                  "gte",

                left: {
                  op:
                    "time.local_minutes",

                  timezone:
                    "Asia/Kolkata",

                  value: {
                    op:
                      "server_now",
                  },
                },

                right: {
                  op:
                    "literal",

                  value:
                    540,
                },
              },
            },
          },
        },

        date_range_no_overlap: {
          supported: true,
          scope: ["current_employee"],
          description:
            "Rejects an action when the submitted date range overlaps another matching record.",
        },

        calendar_day_unique: {
          supported: true,

          scope: [
            "current_employee",
          ],

          timezone:
            "IANA timezone such as Asia/Kolkata",

          daySource: [
            "capture",
            "server_time",
          ],

          field:
            "Capture/store key used for the calendar day when daySource=capture.",

          matchFields:
            "Optional string[] of capture/store keys. When supplied, a conflict exists only when ALL listed fields match an existing record for the same employee/day.",

          ignoreCurrentRecord: true,

          conflictStatuses:
            "Optional string[] limiting which existing record statuses count as conflicts.",

          message:
            "Optional human-readable rejection message.",

          description:
            "Server-enforced pre-write uniqueness by employee + local calendar day, optionally further scoped by matching business capture values such as Dealer, Site, Customer or Shift.",

          examples: [
            {
              human:
                "One attendance submission per employee per day.",

              guard: {
                kind:
                  "calendar_day_unique",

                scope:
                  "current_employee",

                daySource:
                  "server_time",

                timezone:
                  "Asia/Kolkata",

                matchFields: [],
              },
            },

            {
              human:
                "Allow unlimited leads, but the same salesman cannot add the same dealer twice on the same day.",

              guard: {
                kind:
                  "calendar_day_unique",

                scope:
                  "current_employee",

                daySource:
                  "server_time",

                timezone:
                  "Asia/Kolkata",

                matchFields: [
                  "dealer",
                ],
              },
            },
          ],
        },
      },

      actionExecution: {
        triggerActionEffect: {
          recursiveExecution: false,

          behavior:
            "effect.trigger_action currently emits a deterministic trigger instruction. It does NOT recursively execute the target action inside the same Kernel call.",

          guidance:
            "When an action can perform the final state transition/persistence itself, prefer that instead of inventing a second automatic submit action.",
        },
      },

      scheduling: {
        recurringScheduleHost: false,

        timezoneAwareCron: false,

        important:
          "event.schedule is only an event matcher. It does NOT itself create a timer, cron job, recurrence, or midnight trigger. Never claim recurring timed execution unless recurringScheduleHost is explicitly true.",
      },

      edgeEncoding: {
        accepted: {
          id: "edge_example",
          kind: "flow",
          fromNodeId: "source_node",
          fromPort: "flow",
          toNodeId: "target_node",
          toPort: "flow",
        },

        rejected: "Nested from/to objects are NOT part of PixelLogicEdge.",
      },
    },

    /*
     * SYNTAX REFERENCE ONLY.
     *
     * The AI must NOT blindly copy the business meaning or example_* IDs.
     * It exists to demonstrate the exact JSON SHAPE accepted by BRIXTA.
     */
    acceptedJsonExample: {
      format: PIXEL_LOGIC_AI_FORMAT,

      formatVersion: PIXEL_LOGIC_AI_FORMAT_VERSION,

      registryFingerprint,

      responsibility: {
        id: responsibilityId,

        title: responsibilityTitle,
      },

      reality: {
        version: 1,

        actors: [
          {
            id: "current_employee",

            label: "Current employee",

            resolver: {
              kind: "current_user",
            },

            surfaces: ["app"],

            recordScope: "own",
          },
        ],

        contexts: [],

        objects: [
          {
            id: "current_record",

            label: "Current record",

            kind: "current_record",
          },
        ],

        states: [
          {
            id: "ready",

            label: "Ready",

            dimension: "process",

            initial: true,

            terminal: false,
          },

          {
            id: "done",

            label: "Done",

            dimension: "process",

            initial: false,

            terminal: true,
          },
        ],

        captures: [
          {
            id: "occurred_at",

            label: "Occurred at",

            kind: "datetime",

            required: true,

            storeAs: "occurred_at",

            config: {},
          },
        ],

        actions: [
          {
            id: "example_submit",

            label: "Submit",

            kind: "submit",

            actorId: "current_employee",

            objectId: "current_record",

            captureIds: ["occurred_at"],

            availableState: "ready",

            resultingState: "done",

            config: {
              instanceMode: "repeatable",

              submissionGuards: [
                {
                  kind: "calendar_day_unique",

                  scope: "current_employee",

                  timezone: "Asia/Kolkata",

                  daySource: "server_time",

                  matchFields: [],

                  ignoreCurrentRecord: true,

                  conflictStatuses: ["done"],

                  message: "You have already completed this action for today.",
                },
              ],
            },
          },
        ],

        outputs: [
          {
            id: "example_history",

            label: "History",

            kind: "timeline",

            actorIds: ["current_employee"],

            stateIds: ["done"],

            visibleKeys: ["occurred_at"],

            surfaces: ["app"],

            config: {},
          },
        ],

        interface: {},

        warnings: [],

        notes: [],
      },

      program: {
        version: 1,

        enabled: true,

        name: `${responsibilityTitle} Logic`,

        nodes: [
          {
            id: "event_example_submit",

            type: "event.responsibility.action",

            label: "When submitted",

            position: {
              x: 80,
              y: 80,
            },

            config: {
              actionId: "example_submit",
            },
          },

          {
            id: "history_example_submit",

            type: "effect.append_history",

            label: "Record submission",

            position: {
              x: 560,
              y: 80,
            },

            config: {
              label: "Submission completed.",
            },
          },
        ],

        edges: [
          {
            id: "flow_example_submit_history",

            kind: "flow",

            fromNodeId: "event_example_submit",

            fromPort: "flow",

            toNodeId: "history_example_submit",

            toPort: "flow",
          },
        ],

        variables: [],

        metadata: {
          generatedBy: "external-ai",
        },
      },

      unsupportedCapabilities: [],

      notes: [
        "SYNTAX REFERENCE ONLY. Replace example_* business IDs and behavior with the actual business requirement.",
      ],
    },

    registry: specs.map(compactRegistrySpec),
    currentProgram,

    outputContract: {
      format: PIXEL_LOGIC_AI_FORMAT,
      formatVersion: PIXEL_LOGIC_AI_FORMAT_VERSION,
      registryFingerprint,

      responsibility: {
        id: responsibilityId,
        title: responsibilityTitle,
      },

      reality: {
        version: 1,
        actors: [],
        contexts: [],
        objects: [],
        states: [],
        captures: [],
        actions: [],
        outputs: [],
        interface: {},
        warnings: [],
        notes: [],
      },

      program: {
        version: 1,
        enabled: true,
        name: `${responsibilityTitle} Logic`,
        nodes: "PixelLogicNode[]",
        edges: "PixelLogicEdge[]",
        variables: "PixelLogicVariable[]",
        metadata: {
          generatedBy: "external-ai",
        },
      },

      unsupportedCapabilities: [],
      notes: [],
    },
  };

  return `BRIXTA PIXEL REALITY + PIXEL LOGIC AUTHORING CONTRACT

You are compiling a human business requirement into one BRIXTA Responsibility.

A Responsibility is one operational IR: REALITY + INTERFACE + PROGRAM. You MAY define participants, relationships, states, captures, actions and outputs; you MAY also author the employee App UI and dashboard output presentation when the requested behavior requires it; and you build the deterministic Pixel Logic graph that executes the behavior.

STRICT SECURITY BOUNDARY
You have broad authority INSIDE this Responsibility only.
You may NOT alter authentication, tenant isolation, platform secrets, database infrastructure, source code, arbitrary routes, system permissions or execute arbitrary JavaScript/Python/SQL.

STRICT RULES

OUTPUT FORMAT — NON-NEGOTIABLE
- Return EXACTLY ONE RFC 8259 JSON object.
- The response must be directly consumable by JSON.parse(response).
- Use 2-space indentation.
- Use double quotes for all JSON object keys and string values.
- NO Markdown code fences.
- NO prose before the opening {.
- NO prose after the closing }.
- NO comments.
- NO trailing commas.
- NO undefined.
- NO NaN or Infinity.
- NO JavaScript expressions.
- Output the COMPLETE envelope, never a partial patch or fragment.
- Before answering, internally verify every { [ ] } is balanced and the result is valid JSON. Do not print that verification.

STRUCTURE — NON-NEGOTIABLE
- Follow packet.acceptedJsonExample for JSON SHAPE only.
- Do NOT blindly copy its example_* business IDs or behavior.
- program.edges MUST use exactly:
  id, kind, fromNodeId, fromPort, toNodeId, toPort.
- NEVER use nested edge objects such as:
  "from": {"nodeId": "..."} or "to": {"nodeId": "..."}.
- unsupportedCapabilities MUST be an array of STRINGS only.
- reality.warnings, reality.notes and top-level notes MUST be string arrays.
- Every referenced node, actor, action, state, capture and output must either already exist in packet.responsibility.existing or be declared in reality.
- Every required property shown by the contract must be present even when its value is [] or {}.

SHARED INTERFACE AUTHORING — NON-NEGOTIABLE
- App Builder and Pixel Logic are two editors over ONE published Responsibility IR.
- packet.presentationContext contains the current published/draft App UI and installed visual capabilities.
- If the human behavior requires a NEW or CHANGED input/output presentation, Pixel Logic MAY author reality.interface.appUiDocument.
- reality.interface.appUiDocument is a COMPLETE desired UI document, not a partial patch. Preserve unrelated useful blocks and stable IDs.
- If no App UI change is needed, return reality.interface as {} so the current UI is preserved.
- New employee-entered/device-captured values require real reality.captures plus interaction.capture blocks bound to those captures.
- Calculated/read-only values use display.* blocks bound to computed/context/state/record values. NEVER create fake captures merely to display calculated output.
- Dashboard presentation belongs in reality.outputs[].config and reality.outputs[].visibleKeys/surfaces.
- Use output.config.columns bindings when the dashboard needs explicit column order, labels, computed values or formatting.
- At RUNTIME the published UI structure is immutable. Pixel effects change state/data/computed values and the UI reacts declaratively.
- effect.ui_animate, effect.ui_show, effect.ui_hide and effect.ui_play are transient runtime effects and may target only blocks present in the final published appUiDocument/current UI.
- Use only installed visual block types and animation presets from packet.presentationContext.runtime.
- Accessibility/reduced-motion runtime policy always wins over authored animation.

RUNTIME CAPABILITIES — NON-NEGOTIABLE
- packet.runtimeCapabilities is authoritative.
- A Pixel node existing in packet.registry does NOT prove the host can originate that event.
- In particular, event.schedule does NOT create cron/recurrence/timers by itself.
- Never model "every day at midnight" using event.schedule while packet.runtimeCapabilities.scheduling.recurringScheduleHost is false.
- For "once per employee per local calendar day", use calendar_day_unique when appropriate instead of inventing a midnight reset.
- BRIXTA_COMPOSITE_SUBMISSION_GUARD_AI_V1
- For "same employee + same Dealer/Customer/Site/etc. + same day", use calendar_day_unique with matchFields containing the existing capture/store key.
- For a normal business-day rule based on when the server receives the submission, prefer daySource="server_time".
- Use daySource="capture" only when the business meaning explicitly depends on a submitted date/datetime field.
- matchFields is an AND key: every listed capture must match before the record is considered a duplicate.
- Never implement a pre-write duplicate restriction as event → query → post-save effect; use the installed submission guard.
- For arbitrary PRE-ACTION business rules, use the generic expression submission guard instead of inventing a business-specific guard kind.
- Use phase="both" when a rule should affect visible action availability AND be rechecked before persistence.
- Expression guards are server-authoritative. placement may be "auto" or "server", never "device".
- For local shift/time calculations in Pixel Logic, use time.local_minutes with an explicit IANA timezone instead of inventing a fake shift-start datetime context.
- If a required capability is listed as supported, USE it and do not report it as unsupported.
- If a genuinely required runtime capability is absent, put a concise plain STRING in unsupportedCapabilities and do not fake the behavior.

1. Return ONLY one JSON object. No Markdown fences or prose.
2. Use ONLY Pixel node types present in packet.registry.
3. You MAY declare new business actors, states, captures, actions, contexts, objects and outputs in reality.
4. You MUST NOT invent organization role IDs. role resolvers may use only packet.organization.availableRoles[].id.
4b. You MUST NOT invent specific user IDs. specific_user resolvers may use only packet.organization.availableEmployees[].id.
5. If a person is relational (for example applicant's reporting manager), prefer manager_of / relationship rather than hardcoding a specific user or global role.
6. Every important participant must have surfaces. Use app, dashboard, or both.
7. recordScope describes the participant's intended data scope:
   - own = their own records
   - related = records where the relationship resolves to them
   - organization = all records for this Responsibility
8. AI surface choices are PROPOSALS. A human will review and may change them before import/publish.
9. A graph reference may target either an existing business ID or an ID declared in reality.
10. Every required Pixel node input must be connected.
11. Never hide calculations inside strings. Use real graph nodes.
11a. If a calculated/server-generated value must be visible, persist it with an authoritative effect such as effect.set_computed and project it through App display bindings and/or dashboard output bindings.
11b. If logic introduces a new required human/device input, declare the capture AND place it in appUiDocument with interaction.capture when the App surface needs that input.
11c. If logic introduces a new output, declare/update reality.outputs and author its dashboard config/columns when presentation matters.
11d. Money, authoritative timestamps, deductions, uniqueness and persisted consequences remain SERVER authoritative even when their presentation is authored for App/Dashboard.
12. Every node ID and edge ID must be unique.
13. Flow connects only Flow; Data connects only Data.
14. For control.if, connect a boolean to condition and use true/false flow outputs.
15. If the business requirement needs a runtime engine capability unavailable in packet.registry/realityVocabulary, put it in unsupportedCapabilities. Do not fake it.
16. Preserve existing currentProgram behavior unless explicitly asked to replace/remove it.
16a. In MODIFY mode, the current graph is source code: retain unchanged nodes and edges with the SAME IDs.
16b. In MODIFY mode, do not recreate unrelated actors/captures/actions/states/outputs just to make the JSON look different.
16c. When an existing action must change, reuse its existing ID and preserve all required fields not targeted by the request.
16d. If the human says "allow this again and again", do not impose an accidental daily uniqueness guard.
16e. If the human says "same X cannot be submitted twice today", identify X from existing captures and use calendar_day_unique.matchFields.
17. Copy registryFingerprint and responsibility id/title exactly.
18. program.version MUST be 1.
19. program.metadata.generatedBy MUST be external-ai.
20. The human intent is authoritative. Do not unnecessarily involve admins/managers who do not need to participate.

AUTHORITATIVE PACKET
${JSON.stringify(packet, null, 2)}

BUSINESS REQUIREMENT
Describe the workflow after this line.`;
}

function parseJsonObject(text: string): Record<string, unknown> {
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

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI response root must be one JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function parsePixelLogicAIImport(
  text: string,
  fallbackName = "AI Pixel Logic",
): PixelLogicAIImportResult {
  if (!text.trim()) {
    throw new Error("Paste the AI-generated Pixel Reality JSON first.");
  }

  const value = parseJsonObject(text);

  if (value.format !== PIXEL_LOGIC_AI_FORMAT) {
    throw new Error(`Expected format "${PIXEL_LOGIC_AI_FORMAT}".`);
  }

  const formatVersion = Number(value.formatVersion);

  if (formatVersion !== 1 && formatVersion !== 2) {
    throw new Error(
      `Unsupported Pixel Logic AI formatVersion: ${String(
        value.formatVersion ?? "missing",
      )}.`,
    );
  }

  /*
   * Validate the RAW v2 envelope before tolerant normalizers can remove or
   * coerce malformed AI declarations.
   */
  if (formatVersion >= 2) {
    validateRawPixelLogicAIEnvelope(value);
  }

  const responsibility = asObject(value.responsibility);
  const rawProgram = value.program;

  if (
    !rawProgram ||
    typeof rawProgram !== "object" ||
    Array.isArray(rawProgram)
  ) {
    throw new Error("AI envelope is missing a valid program object.");
  }

  const program = normalizePixelLogicProgram(rawProgram, fallbackName);

  const reality =
    formatVersion >= 2
      ? normalizePixelReality(value.reality)
      : blankPixelReality();

  /*
   * BRIXTA_PIXEL_REALITY_DECLARATION_BRIDGE
   *
   * Validation may happen before the human imports Reality into the actual
   * Responsibility Kernel. Carry the proposed business IDs with the program
   * so every validator can validate against:
   *
   * EXISTING KERNEL + PROPOSED REALITY
   *
   * This is validation metadata only. It does NOT publish or mutate the
   * Responsibility.
   */
  program.metadata = {
    ...program.metadata,
    generatedBy: program.metadata.generatedBy ?? "external-ai",
    pixelRealityDeclared: {
      actorIds: reality.actors.map((item) => item.id),
      contextIds: reality.contexts.map((item) => item.id),
      objectIds: reality.objects.map((item) => item.id),
      stateIds: reality.states.map((item) => item.id),
      captureIds: reality.captures.map((item) => item.id),
      actionIds: reality.actions.map((item) => item.id),
      outputIds: reality.outputs.map((item) => item.id),
    },
  };

  return {
    program,
    reality,
    registryFingerprint:
      typeof value.registryFingerprint === "string"
        ? value.registryFingerprint
        : undefined,
    responsibilityId:
      typeof responsibility.id === "string" ||
      typeof responsibility.id === "number"
        ? responsibility.id
        : undefined,
    responsibilityTitle:
      typeof responsibility.title === "string"
        ? responsibility.title
        : undefined,
    unsupportedCapabilities: asStringArray(value.unsupportedCapabilities),
    notes: asStringArray(value.notes),
  };
}

export function autoLayoutPixelLogicProgram(
  program: PixelLogicProgram,
): PixelLogicProgram {
  const laneCounts = new Map<number, number>();

  const laneFor = (type: string) => {
    if (type.startsWith("event.")) return 0;
    if (type.startsWith("value.")) return 1;

    if (
      type.startsWith("math.") ||
      type.startsWith("time.") ||
      type.startsWith("data.") ||
      type.startsWith("logic.")
    )
      return 2;

    if (type.startsWith("control.")) return 3;
    if (type.startsWith("effect.")) return 4;

    return 2;
  };

  return {
    ...program,
    nodes: program.nodes.map((node) => {
      const lane = laneFor(node.type);
      const row = laneCounts.get(lane) ?? 0;
      laneCounts.set(lane, row + 1);

      return {
        ...node,
        position: {
          x: 80 + lane * 260,
          y: 80 + row * 150,
        },
      };
    }),
  };
}
