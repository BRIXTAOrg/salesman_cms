// BRIXTA_PIXEL_LOGIC_KERNEL_V1
import type {
  PixelLogicNodeSpec,
} from "@/lib/pixel-logic-types";

/**
 * Runtime-extensible node registry.
 *
 * Core BRIXTA nodes are registered below. Future packages can call
 * `registerPixelLogicNode(...)` to add entirely new capabilities without
 * changing Pixel Logic's graph schema or UI.
 */
const REGISTRY = new Map<string, PixelLogicNodeSpec>();

export function registerPixelLogicNode(spec: PixelLogicNodeSpec) {
  if (!spec.type.trim()) throw new Error("Pixel Logic node type is required.");
  REGISTRY.set(spec.type, spec);
  return spec;
}

export function getPixelLogicNodeSpec(type: string) {
  return REGISTRY.get(type);
}

export function listPixelLogicNodeSpecs() {
  return [...REGISTRY.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.label.localeCompare(b.label),
  );
}

const flowIn = {
  key: "flow",
  label: "Flow",
  kind: "flow" as const,
  required: true,
};

const flowOut = {
  key: "flow",
  label: "Next",
  kind: "flow" as const,
};

const valueOut = {
  key: "value",
  label: "Value",
  kind: "data" as const,
  valueType: "any" as const,
};

const binaryNumberInputs = [
  {
    key: "a",
    label: "A",
    kind: "data" as const,
    valueType: "number" as const,
    required: true,
  },
  {
    key: "b",
    label: "B",
    kind: "data" as const,
    valueType: "number" as const,
    required: true,
  },
];

const specs: PixelLogicNodeSpec[] = [
  {
    type: "event.any",
    label: "Any event",
    description: "Start whenever the host sends any event into this program.",
    category: "Events",
    kind: "event",
    inputs: [],
    outputs: [
      flowOut,
      {
        key: "event",
        label: "Event",
        kind: "data",
        valueType: "object",
      },
    ],
  },
  {
    type: "event.responsibility.action",
    label: "Responsibility action",
    description: "Start when a specific Responsibility action happens.",
    category: "Events",
    kind: "event",
    inputs: [],
    outputs: [
      flowOut,
      {
        key: "event",
        label: "Event",
        kind: "data",
        valueType: "object",
      },
    ],
    configFields: [
      {
        key: "actionId",
        label: "Action ID",
        kind: "text",
        placeholder: "check_in",
      },
    ],
  },
  {
    type: "event.record.created",
    label: "Record created",
    description: "Start after a record is created.",
    category: "Events",
    kind: "event",
    inputs: [],
    outputs: [flowOut, { ...valueOut, key: "record", label: "Record" }],
  },
  {
    type: "event.record.updated",
    label: "Record updated",
    description: "Start after a record changes.",
    category: "Events",
    kind: "event",
    inputs: [],
    outputs: [flowOut, { ...valueOut, key: "record", label: "Record" }],
  },
  {
    type: "event.schedule",
    label: "Schedule reached",
    description: "Start when a scheduled event is emitted by the host.",
    category: "Events",
    kind: "event",
    inputs: [],
    outputs: [flowOut, { ...valueOut, key: "event", label: "Event" }],
  },

  {
    type: "value.literal",
    label: "Literal value",
    description: "A number, string, boolean, object, or array.",
    category: "Values",
    kind: "value",
    inputs: [],
    outputs: [valueOut],
    configFields: [
      {
        key: "value",
        label: "Value",
        kind: "text",
        placeholder: "100",
      },
    ],
  },
  {
    type: "value.ref",
    label: "Runtime value",
    description:
      "Read context, capture, actor, state, history, computed, query, or object data.",
    category: "Values",
    kind: "value",
    inputs: [],
    outputs: [valueOut],
    configFields: [
      {
        key: "scope",
        label: "Scope",
        kind: "select",
        options: [
          { value: "context", label: "Context" },
          { value: "capture", label: "Capture" },
          { value: "actor", label: "Actor" },
          { value: "state", label: "State" },
          { value: "history", label: "History" },
          { value: "computed", label: "Computed" },
          { value: "query", label: "Query" },
          { value: "object", label: "Object" },
          { value: "variable", label: "Variable" },
        ],
      },
      { key: "key", label: "Key", kind: "text", placeholder: "current_time" },
      { key: "path", label: "Nested path", kind: "text", placeholder: "profile.hourlyRate" },
    ],
  },

  {
    type: "math.add",
    label: "Add",
    description: "A + B",
    category: "Math",
    kind: "operation",
    inputs: binaryNumberInputs,
    outputs: [{ ...valueOut, valueType: "number" }],
  },
  {
    type: "math.subtract",
    label: "Subtract",
    description: "A - B",
    category: "Math",
    kind: "operation",
    inputs: binaryNumberInputs,
    outputs: [{ ...valueOut, valueType: "number" }],
  },
  {
    type: "math.multiply",
    label: "Multiply",
    description: "A × B",
    category: "Math",
    kind: "operation",
    inputs: binaryNumberInputs,
    outputs: [{ ...valueOut, valueType: "number" }],
  },
  {
    type: "math.divide",
    label: "Divide",
    description: "A ÷ B",
    category: "Math",
    kind: "operation",
    inputs: binaryNumberInputs,
    outputs: [{ ...valueOut, valueType: "number" }],
  },
  {
    type: "math.min",
    label: "Minimum",
    description: "The smaller of A and B.",
    category: "Math",
    kind: "operation",
    inputs: binaryNumberInputs,
    outputs: [{ ...valueOut, valueType: "number" }],
  },
  {
    type: "math.max",
    label: "Maximum",
    description: "The larger of A and B.",
    category: "Math",
    kind: "operation",
    inputs: binaryNumberInputs,
    outputs: [{ ...valueOut, valueType: "number" }],
  },
  {
    type: "math.round",
    label: "Round",
    description: "Round a numeric value.",
    category: "Math",
    kind: "operation",
    inputs: [
      {
        key: "value",
        label: "Value",
        kind: "data",
        valueType: "number",
        required: true,
      },
    ],
    outputs: [{ ...valueOut, valueType: "number" }],
  },

  {
    type: "logic.compare",
    label: "Compare",
    description: "Compare two values using a configurable operator.",
    category: "Logic",
    kind: "operation",
    inputs: [
      { key: "left", label: "Left", kind: "data", valueType: "any", required: true },
      { key: "right", label: "Right", kind: "data", valueType: "any" },
    ],
    outputs: [{ ...valueOut, valueType: "boolean" }],
    configFields: [
      {
        key: "operator",
        label: "Operator",
        kind: "select",
        options: [
          { value: "eq", label: "=" },
          { value: "neq", label: "≠" },
          { value: "gt", label: ">" },
          { value: "gte", label: "≥" },
          { value: "lt", label: "<" },
          { value: "lte", label: "≤" },
          { value: "contains", label: "contains" },
          { value: "exists", label: "exists" },
          { value: "not_exists", label: "does not exist" },
        ],
      },
    ],
  },
  {
    type: "logic.and",
    label: "AND",
    description: "True when A and B are both true.",
    category: "Logic",
    kind: "operation",
    inputs: [
      { key: "a", label: "A", kind: "data", valueType: "boolean", required: true },
      { key: "b", label: "B", kind: "data", valueType: "boolean", required: true },
    ],
    outputs: [{ ...valueOut, valueType: "boolean" }],
  },
  {
    type: "logic.or",
    label: "OR",
    description: "True when either A or B is true.",
    category: "Logic",
    kind: "operation",
    inputs: [
      { key: "a", label: "A", kind: "data", valueType: "boolean", required: true },
      { key: "b", label: "B", kind: "data", valueType: "boolean", required: true },
    ],
    outputs: [{ ...valueOut, valueType: "boolean" }],
  },
  {
    type: "logic.not",
    label: "NOT",
    description: "Invert a boolean value.",
    category: "Logic",
    kind: "operation",
    inputs: [
      { key: "value", label: "Value", kind: "data", valueType: "boolean", required: true },
    ],
    outputs: [{ ...valueOut, valueType: "boolean" }],
  },
  {
    type: "control.if",
    label: "If / Else",
    description: "Route execution down the True or False branch.",
    category: "Control",
    kind: "control",
    inputs: [
      flowIn,
      { key: "condition", label: "Condition", kind: "data", valueType: "boolean", required: true },
    ],
    outputs: [
      { key: "true", label: "True", kind: "flow" },
      { key: "false", label: "False", kind: "flow" },
    ],
  },

  {
    type: "time.difference_minutes",
    label: "Difference in minutes",
    description: "Minutes between two dates/times.",
    category: "Time",
    kind: "operation",
    inputs: [
      { key: "start", label: "Start", kind: "data", valueType: "datetime", required: true },
      { key: "end", label: "End", kind: "data", valueType: "datetime", required: true },
    ],
    outputs: [{ ...valueOut, valueType: "number" }],
  },
  {
    type: "time.add_minutes",
    label: "Add minutes",
    description: "Add minutes to a date/time.",
    category: "Time",
    kind: "operation",
    inputs: [
      { key: "time", label: "Time", kind: "data", valueType: "datetime", required: true },
      { key: "minutes", label: "Minutes", kind: "data", valueType: "number", required: true },
    ],
    outputs: [{ ...valueOut, valueType: "datetime" }],
  },

  {
    type: "data.coalesce",
    label: "Fallback value",
    description: "Use A unless it is empty/null; otherwise use B.",
    category: "Data",
    kind: "operation",
    inputs: [
      { key: "a", label: "Primary", kind: "data", valueType: "any" },
      { key: "b", label: "Fallback", kind: "data", valueType: "any" },
    ],
    outputs: [valueOut],
  },

  {
    type: "effect.set_computed",
    label: "Set computed value",
    description: "Emit an instruction to set a computed field/value.",
    category: "Effects",
    kind: "effect",
    inputs: [
      flowIn,
      { key: "value", label: "Value", kind: "data", valueType: "any", required: true },
    ],
    outputs: [flowOut],
    configFields: [
      { key: "targetKey", label: "Target key", kind: "text", placeholder: "salary_deduction" },
    ],
  },
  {
    type: "effect.set_context",
    label: "Set context",
    description: "Emit an instruction to set runtime context.",
    category: "Effects",
    kind: "effect",
    inputs: [
      flowIn,
      { key: "value", label: "Value", kind: "data", valueType: "any", required: true },
    ],
    outputs: [flowOut],
    configFields: [
      { key: "targetKey", label: "Context key", kind: "text", placeholder: "late_minutes" },
    ],
  },
  {
    type: "effect.change_state",
    label: "Change state",
    description: "Emit a Responsibility state transition.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      { key: "state", label: "State ID", kind: "text", placeholder: "completed" },
    ],
  },
  {
    type: "effect.notify_actor",
    label: "Notify actor",
    description: "Emit a notification effect.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      { key: "actorId", label: "Actor ID", kind: "text", placeholder: "reporting_manager" },
      { key: "message", label: "Message", kind: "text", placeholder: "Needs attention" },
    ],
  },
  {
    type: "effect.trigger_action",
    label: "Trigger action",
    description: "Emit an instruction to trigger another action.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      { key: "actionId", label: "Action ID", kind: "text", placeholder: "approve" },
    ],
  },
  {
    type: "effect.trigger_responsibility",
    label: "Trigger Responsibility",
    description: "Emit an instruction to start another Responsibility.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      { key: "responsibilityKey", label: "Responsibility key", kind: "text" },
    ],
  },
  // BRIXTA_PIXEL_REALITY_V2_EFFECTS
  {
    type: "effect.assign_actor",
    label: "Assign actor",
    description: "Resolve a Responsibility actor and create work for them.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      {
        key: "actorId",
        label: "Actor ID",
        kind: "text",
        placeholder: "reporting_manager",
      },
      {
        key: "title",
        label: "Work title",
        kind: "text",
        placeholder: "Approval required",
      },
      {
        key: "description",
        label: "Description",
        kind: "text",
      },
    ],
  },
  {
    type: "effect.create_record",
    label: "Create record",
    description: "Create/start another Responsibility record through the host runtime.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      {
        key: "responsibilityKey",
        label: "Responsibility key",
        kind: "text",
      },
      {
        key: "actorId",
        label: "Target actor ID",
        kind: "text",
      },
    ],
  },
  {
    type: "effect.update_record",
    label: "Update record",
    description: "Apply a structured value/patch to the current Responsibility record.",
    category: "Effects",
    kind: "effect",
    inputs: [
      flowIn,
      {
        key: "value",
        label: "Patch",
        kind: "data",
        valueType: "object",
      },
    ],
    outputs: [flowOut],
  },
  {
    type: "effect.delete_record",
    label: "Delete record",
    description: "Mark the current Responsibility record deleted through the Kernel host.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
  },
  {
    type: "effect.query_data",
    label: "Query data",
    description: "Query a registered BRIXTA data source.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      {
        key: "sourceKey",
        label: "Data source key",
        kind: "text",
      },
      {
        key: "targetKey",
        label: "Result key",
        kind: "text",
      },
    ],
  },
  {
    type: "effect.remove_context",
    label: "Remove context",
    description: "Remove a mutable value from Responsibility runtime context.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      {
        key: "targetKey",
        label: "Context key",
        kind: "text",
      },
    ],
  },
  {
    type: "effect.freeze_data",
    label: "Freeze data",
    description: "Freeze selected Responsibility data after a lifecycle point.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      {
        key: "targetKey",
        label: "Key",
        kind: "text",
      },
    ],
  },

  {
    type: "effect.append_history",
    label: "Append history",
    description: "Emit an auditable history entry.",
    category: "Effects",
    kind: "effect",
    inputs: [flowIn],
    outputs: [flowOut],
    configFields: [
      { key: "label", label: "History label", kind: "text" },
    ],
  },
];

for (const spec of specs) registerPixelLogicNode(spec);
