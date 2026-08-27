// BRIXTA_PIXEL_LOGIC_AI_BRIDGE_V1
import { listPixelLogicNodeSpecs } from "@/lib/pixel-logic-registry";
import {
  normalizePixelLogicProgram,
  type PixelLogicNodeSpec,
  type PixelLogicProgram,
  type PixelLogicValueType,
} from "@/lib/pixel-logic-types";
import type {
  KernelCaptureKind,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

export const PIXEL_LOGIC_AI_FORMAT = "brixta.pixel-logic" as const;
export const PIXEL_LOGIC_AI_FORMAT_VERSION = 1 as const;

export type PixelLogicAIImportEnvelope = {
  format: typeof PIXEL_LOGIC_AI_FORMAT;
  formatVersion: typeof PIXEL_LOGIC_AI_FORMAT_VERSION;
  registryFingerprint?: string;
  responsibility?: {
    id?: number | string;
    title?: string;
  };
  program: PixelLogicProgram;
  unsupportedCapabilities: string[];
  notes: string[];
};

export type PixelLogicAIImportResult = {
  program: PixelLogicProgram;
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
  if (kind === "number" || kind === "amount" || kind === "rating" || kind === "timer") {
    return "number";
  }
  if (kind === "date") return "date";
  if (kind === "datetime") return "datetime";
  if (kind === "boolean") return "boolean";
  if (kind === "gps") return "location";
  if (kind === "route" || kind === "checklist" || kind === "repeating_section") {
    return "array";
  }
  if (
    kind === "person_reference" ||
    kind === "entity_reference" ||
    kind === "responsibility_reference"
  ) {
    return "reference";
  }
  return "string";
}

function contextValueType(config: Record<string, unknown>): PixelLogicValueType {
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
  return `pl1-${fnv1a(stableRegistrySource(specs))}`;
}

export function buildPixelLogicAIContext({
  responsibilityId,
  responsibilityTitle,
  kernel,
  currentProgram,
}: BuildPixelLogicAIContextInput) {
  const specs = listPixelLogicNodeSpecs();
  const registryFingerprint = pixelLogicRegistryFingerprint(specs);

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
        captureIds: item.action.captureIds,
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
    })) ?? [];

  const objects =
    kernel?.runtimeWorld.objects.map((object) => ({
      id: object.id,
      label: object.label,
      kind: object.kind,
    })) ?? [];

  const packet = {
    language: PIXEL_LOGIC_AI_FORMAT,
    formatVersion: PIXEL_LOGIC_AI_FORMAT_VERSION,
    registryFingerprint,
    responsibility: {
      id: responsibilityId,
      title: responsibilityTitle,
      actions,
      captures,
      contexts,
      states,
      actors,
      objects,
    },
    registry: specs.map(compactRegistrySpec),
    bindingRules: {
      "event.responsibility.action.config.actionId": "MUST be one of responsibility.actions[].id",
      "value.ref.config.scope=capture/config.key": "MUST be one of responsibility.captures[].id",
      "value.ref.config.scope=context/config.key": "MUST be one of responsibility.contexts[].id",
      "value.ref.config.scope=state/config.key": "MUST be one of responsibility.states[].id",
      "value.ref.config.scope=actor/config.key": "MUST be one of responsibility.actors[].id",
      "value.ref.config.scope=object/config.key": "MUST be one of responsibility.objects[].id",
      "value.ref.config.scope=variable/config.key": "MUST be declared in program.variables[].key",
      "effect.trigger_action.config.actionId": "MUST be one of responsibility.actions[].id",
      "effect.change_state.config.state": "MUST be one of responsibility.states[].id",
      "effect.notify_actor.config.actorId": "MUST be one of responsibility.actors[].id when supplied",
      "effect.set_context.config.targetKey": "MUST be one of responsibility.contexts[].id and should be mutable",
    },
    currentProgram,
    outputContract: {
      format: PIXEL_LOGIC_AI_FORMAT,
      formatVersion: PIXEL_LOGIC_AI_FORMAT_VERSION,
      registryFingerprint,
      responsibility: {
        id: responsibilityId,
        title: responsibilityTitle,
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

  return `BRIXTA PIXEL LOGIC AUTHORING CONTRACT\n\nYou are compiling a user's business requirement into BRIXTA Pixel Logic. Pixel Logic is the ONLY framework you may use.\n\nSTRICT RULES\n1. Return ONLY one JSON object. No Markdown fences, prose, JavaScript, Python, SQL, BPMN, n8n, Zapier, formulas-as-strings, pseudocode, or alternate workflow format.\n2. Use ONLY node types present in packet.registry. Never invent a node type.\n3. Use ONLY actions, captures, contexts, states, actors and objects present in packet.responsibility. Never invent business IDs or keys.\n4. Obey every node's declared input/output ports. Flow connects only Flow. Data connects only Data. Specific data types must match unless one side is 'any'.\n5. Every required input must be connected. Do not hide calculations inside strings. Build calculations with actual Pixel Logic nodes.\n6. Every node ID and edge ID must be unique. Every edge must reference real nodes and real ports.\n7. For control.if, connect a boolean to condition and use its true/false FLOW outputs.\n8. If the requested behavior requires an unavailable capability, DO NOT simulate it and DO NOT invent it. Add a short requirement to unsupportedCapabilities.\n9. If unsupportedCapabilities is non-empty, still return any safely representable portion, but make no claim that the full workflow is complete.\n10. Preserve existing currentProgram behavior unless the user explicitly asks to replace/remove it. If currentProgram is empty, create the required graph from scratch.\n11. Copy packet.registryFingerprint into registryFingerprint exactly.\n12. Copy packet.responsibility.id/title into responsibility exactly.\n13. program.version MUST be 1.\n14. Set program.metadata.generatedBy to 'external-ai'.\n\nOUTPUT SHAPE\n{\n  \"format\": \"brixta.pixel-logic\",\n  \"formatVersion\": 1,\n  \"registryFingerprint\": \"<copy from packet>\",\n  \"responsibility\": { \"id\": \"<copy>\", \"title\": \"<copy>\" },\n  \"program\": {\n    \"version\": 1,\n    \"enabled\": true,\n    \"name\": \"...\",\n    \"nodes\": [],\n    \"edges\": [],\n    \"variables\": [],\n    \"metadata\": { \"generatedBy\": \"external-ai\" }\n  },\n  \"unsupportedCapabilities\": [],\n  \"notes\": []\n}\n\nAUTHORITATIVE PACKET\n${JSON.stringify(packet, null, 2)}\n\nBUSINESS REQUIREMENT\nDescribe the workflow after this line. If no business requirement has been supplied yet, ask the user for it instead of generating a graph.`;
}

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = stripCodeFence(text);
  try {
    return asObject(JSON.parse(cleaned));
  } catch (firstError) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return asObject(JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)));
      } catch {
        // Fall through to the clearer error below.
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
  if (!text.trim()) throw new Error("Paste the AI-generated Pixel Logic JSON first.");
  const value = parseJsonObject(text);

  if (value.format !== PIXEL_LOGIC_AI_FORMAT) {
    throw new Error(
      `Expected format \"${PIXEL_LOGIC_AI_FORMAT}\". The AI returned a different framework or malformed envelope.`,
    );
  }
  if (Number(value.formatVersion) !== PIXEL_LOGIC_AI_FORMAT_VERSION) {
    throw new Error(
      `Unsupported Pixel Logic AI formatVersion: ${String(value.formatVersion ?? "missing")}.`,
    );
  }

  const responsibility = asObject(value.responsibility);
  const rawProgram = value.program;
  if (!rawProgram || typeof rawProgram !== "object" || Array.isArray(rawProgram)) {
    throw new Error("AI envelope is missing a valid program object.");
  }

  const program = normalizePixelLogicProgram(rawProgram, fallbackName);
  program.metadata = {
    ...program.metadata,
    generatedBy: program.metadata.generatedBy ?? "external-ai",
  };

  return {
    program,
    registryFingerprint:
      typeof value.registryFingerprint === "string"
        ? value.registryFingerprint
        : undefined,
    responsibilityId:
      typeof responsibility.id === "string" || typeof responsibility.id === "number"
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
    if (type.startsWith("math.") || type.startsWith("time.") || type.startsWith("data.") || type.startsWith("logic.")) {
      return 2;
    }
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
