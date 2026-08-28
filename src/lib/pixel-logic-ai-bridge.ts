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

export const PIXEL_LOGIC_AI_FORMAT = "brixta.pixel-logic" as const;
export const PIXEL_LOGIC_AI_FORMAT_VERSION = 2 as const;

export type PixelLogicAIEmployee = {
  id: number;
  name?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  designation?: string | null;
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

function captureValueType(kind: KernelCaptureKind): PixelLogicValueType {
  if (
    kind === "number" ||
    kind === "amount" ||
    kind === "rating" ||
    kind === "timer"
  ) return "number";

  if (kind === "date") return "date";
  if (kind === "datetime") return "datetime";
  if (kind === "boolean") return "boolean";
  if (kind === "gps") return "location";

  if (
    kind === "route" ||
    kind === "checklist" ||
    kind === "repeating_section"
  ) return "array";

  if (
    kind === "person_reference" ||
    kind === "entity_reference" ||
    kind === "responsibility_reference"
  ) return "reference";

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
      valueType:
        port.valueType ??
        (port.kind === "flow" ? "void" : "any"),
      required: port.required === true,
      many: port.many === true,
    })),
    outputs: spec.outputs.map((port) => ({
      key: port.key,
      kind: port.kind,
      valueType:
        port.valueType ??
        (port.kind === "flow" ? "void" : "any"),
    })),
    config: (spec.configFields ?? []).map((field) => ({
      key: field.key,
      kind: field.kind,
      options:
        field.options?.map((option) => option.value) ??
        undefined,
    })),
  };
}

function stableRegistrySource(specs: PixelLogicNodeSpec[]) {
  return JSON.stringify(
    specs
      .map(compactRegistrySpec)
      .sort((a, b) => a.type.localeCompare(b.type)),
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
  const registryFingerprint =
    pixelLogicRegistryFingerprint(specs);

  const actions =
    kernel?.possibilities
      .filter(
        (item): item is Extract<
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
        (item): item is Extract<
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
        (item): item is Extract<
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
      })),
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

A Responsibility is an operational reality. You MAY define the participants, relationships, states, captures, actions, outputs, visibility intent and app/dashboard surfaces required by the business requirement. You ALSO build the deterministic Pixel Logic graph that executes the behavior.

STRICT SECURITY BOUNDARY
You have broad authority INSIDE this Responsibility only.
You may NOT alter authentication, tenant isolation, platform secrets, database infrastructure, source code, arbitrary routes, system permissions or execute arbitrary JavaScript/Python/SQL.

STRICT RULES
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
12. Every node ID and edge ID must be unique.
13. Flow connects only Flow; Data connects only Data.
14. For control.if, connect a boolean to condition and use true/false flow outputs.
15. If the business requirement needs a runtime engine capability unavailable in packet.registry/realityVocabulary, put it in unsupportedCapabilities. Do not fake it.
16. Preserve existing currentProgram behavior unless explicitly asked to replace/remove it.
17. Copy registryFingerprint and responsibility id/title exactly.
18. program.version MUST be 1.
19. program.metadata.generatedBy MUST be external-ai.
20. The human intent is authoritative. Do not unnecessarily involve admins/managers who do not need to participate.

AUTHORITATIVE PACKET
${JSON.stringify(packet, null, 2)}

BUSINESS REQUIREMENT
Describe the workflow after this line.`;
}

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
  );
  return fenced ? fenced[1].trim() : trimmed;
}

function parseJsonObject(
  text: string,
): Record<string, unknown> {
  const cleaned = stripCodeFence(text);

  try {
    return asObject(JSON.parse(cleaned));
  } catch (firstError) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return asObject(
          JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)),
        );
      } catch {
        // fall through
      }
    }

    throw new Error(
      firstError instanceof Error
        ? `AI response is not valid JSON: ${firstError.message}`
        : "AI response is not valid JSON.",
    );
  }
}

export function parsePixelLogicAIImport(
  text: string,
  fallbackName = "AI Pixel Logic",
): PixelLogicAIImportResult {
  if (!text.trim()) {
    throw new Error(
      "Paste the AI-generated Pixel Reality JSON first.",
    );
  }

  const value = parseJsonObject(text);

  if (value.format !== PIXEL_LOGIC_AI_FORMAT) {
    throw new Error(
      `Expected format "${PIXEL_LOGIC_AI_FORMAT}".`,
    );
  }

  const formatVersion = Number(value.formatVersion);

  if (formatVersion !== 1 && formatVersion !== 2) {
    throw new Error(
      `Unsupported Pixel Logic AI formatVersion: ${String(
        value.formatVersion ?? "missing",
      )}.`,
    );
  }

  const responsibility = asObject(value.responsibility);
  const rawProgram = value.program;

  if (
    !rawProgram ||
    typeof rawProgram !== "object" ||
    Array.isArray(rawProgram)
  ) {
    throw new Error(
      "AI envelope is missing a valid program object.",
    );
  }

  const program = normalizePixelLogicProgram(
    rawProgram,
    fallbackName,
  );

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
    generatedBy:
      program.metadata.generatedBy ?? "external-ai",
    pixelRealityDeclared: {
      actorIds:
        reality.actors.map((item) => item.id),
      contextIds:
        reality.contexts.map((item) => item.id),
      objectIds:
        reality.objects.map((item) => item.id),
      stateIds:
        reality.states.map((item) => item.id),
      captureIds:
        reality.captures.map((item) => item.id),
      actionIds:
        reality.actions.map((item) => item.id),
      outputIds:
        reality.outputs.map((item) => item.id),
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
    unsupportedCapabilities:
      asStringArray(value.unsupportedCapabilities),
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
    ) return 2;

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
