import type { ResponsibilityUiDocument } from "@/lib/responsibility-ui-document";

/**
 * BRIXTA Responsibility Kernel v3/v5 UI contract.
 *
 * One Responsibility = one operational unit.
 * The visual builder and runtime kernel share the SAME IDs.
 *
 * WORLD -> POSSIBILITIES -> EVENT -> RULES -> EFFECTS
 *      -> NEW WORLD -> RECALCULATE POSSIBILITIES -> repeat.
 */

export type KernelId = string;

export type KernelValueRef =
  | { kind: "literal"; value: unknown }
  | { kind: "context"; key: string; path?: string }
  | { kind: "state"; key: string }
  | { kind: "object"; key: string; path?: string }
  | { kind: "actor"; key: string; path?: string }
  | { kind: "capture"; key: string; path?: string }
  | { kind: "query"; key: string; path?: string }
  | { kind: "history"; key: string; path?: string }
  | { kind: "computed"; key: string; path?: string };

export type KernelOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "not_exists"
  | "contains"
  | "in"
  | "between";

export type KernelCondition = {
  id: KernelId;
  left: KernelValueRef;
  operator: KernelOperator;
  right?: KernelValueRef;
};

export type KernelConditionGroup = {
  mode: "all" | "any";
  conditions: KernelCondition[];
};

export type KernelActorResolver =
  | { kind: "current_user" }
  | { kind: "record_creator" }
  | { kind: "specific_user"; userId?: number }
  | { kind: "role"; roleId?: number }
  | { kind: "manager_of"; value: KernelValueRef }
  | { kind: "selected_reference"; referenceKey: string }
  | { kind: "query_result"; queryKey: string; path?: string }
  | { kind: "relationship"; source: KernelValueRef; relation: string }
  | { kind: "system" };

export type KernelActor = {
  id: KernelId;
  label: string;
  resolver: KernelActorResolver;
  description?: string;
};

export type KernelObjectKind =
  | "current_record"
  | "entity"
  | "responsibility_record"
  | "employee"
  | "device"
  | "session"
  | "external";

export type KernelObject = {
  id: KernelId;
  label: string;
  kind: KernelObjectKind;
  sourceKey?: string;
  description?: string;
};

/**
 * Context can be live runtime information, a configured literal, a centrally
 * managed organization setting, or a value resolved from another source.
 * `literal` and `company_setting` are deliberately first-class so business
 * policy does not need to be hard-coded into source code.
 */
export type KernelContextSource =
  | "current_user"
  | "current_manager"
  | "current_device"
  | "organization"
  | "current_time"
  | "current_location"
  | "record"
  | "relationship"
  | "history"
  | "session"
  | "query"
  | "object"
  | "external"
  | "literal"
  | "company_setting"
  | "native";

export type KernelContext = {
  id: KernelId;
  label: string;
  source: KernelContextSource;
  sourceKey?: string;
  path?: string;
  /** Used when source === "literal". */
  value?: unknown;
  /** UI/runtime hints such as valueType, unit, nativeCapability, permissions. */
  config?: Record<string, unknown>;
  mutable: boolean;
  frozenAfterState?: string;
};

export type KernelState = {
  id: KernelId;
  label: string;
  dimension: string;
  initial?: boolean;
  terminal?: boolean;
  description?: string;
};

export type KernelCaptureKind =
  | "short_text"
  | "long_text"
  | "number"
  | "amount"
  | "choice"
  | "date"
  | "datetime"
  | "boolean"
  | "photo"
  | "video"
  | "audio"
  | "file"
  | "signature"
  | "gps"
  | "route"
  | "qr"
  | "barcode"
  | "nfc"
  | "person_reference"
  | "entity_reference"
  | "responsibility_reference"
  | "checklist"
  | "rating"
  | "timer"
  | "repeating_section";

export type KernelCapture = {
  id: KernelId;
  label: string;
  kind: KernelCaptureKind;
  required?: boolean;
  sourceKey?: string;
  storeAs?: string;
  /**
   * Native-capability blocks intentionally use the existing generic capture
   * kinds and describe richer phone behavior in config. This keeps the
   * compatibility compiler stable while Kernel metadata remains expressive.
   */
  config: Record<string, unknown>;
};

export type KernelActionKind =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "submit"
  | "start"
  | "stop"
  | "pause"
  | "resume"
  | "approve"
  | "reject"
  | "return"
  | "assign"
  | "reassign"
  | "delegate"
  | "comment"
  | "acknowledge"
  | "sign"
  | "notify"
  | "trigger"
  | "complete"
  | "cancel";

export type KernelAction = {
  id: KernelId;
  label: string;
  kind: KernelActionKind;
  actorId?: string;
  objectId?: string;
  requires?: KernelConditionGroup;
  captureIds: string[];
  config: Record<string, unknown>;
};

export type KernelOutputKind =
  | "detail"
  | "card"
  | "list"
  | "table"
  | "timeline"
  | "calendar"
  | "gallery"
  | "map"
  | "route"
  | "metric"
  | "chart"
  | "document"
  | "receipt"
  | "dashboard"
  | "notification";

export type KernelOutput = {
  id: KernelId;
  label: string;
  kind: KernelOutputKind;
  actorIds: string[];
  stateIds: string[];
  visibleKeys: string[];
  config: Record<string, unknown>;
};

export type KernelPossibility =
  | {
      id: KernelId;
      type: "capture";
      capture: KernelCapture;
      when?: KernelConditionGroup;
    }
  | {
      id: KernelId;
      type: "action";
      action: KernelAction;
      when?: KernelConditionGroup;
    }
  | {
      id: KernelId;
      type: "output";
      output: KernelOutput;
      when?: KernelConditionGroup;
    };

export type KernelEventKind =
  | "action"
  | "record_created"
  | "record_updated"
  | "state_changed"
  | "time_reached"
  | "timer_expired"
  | "location_entered"
  | "location_exited"
  | "responsibility_completed"
  | "device_online"
  | "device_offline"
  | "sync_completed"
  | "schedule"
  | "external";

export type KernelEvent = {
  id: KernelId;
  label: string;
  kind: KernelEventKind;
  actionId?: string;
  sourceKey?: string;
};

export type KernelEffectKind =
  | "change_state"
  | "set_context"
  | "remove_context"
  | "create_record"
  | "update_record"
  | "delete_record"
  | "assign_actor"
  | "notify_actor"
  | "query_data"
  | "set_computed"
  | "freeze_data"
  | "trigger_action"
  | "trigger_responsibility"
  | "append_history"
  | "ui_animate"
  | "ui_show"
  | "ui_hide"
  | "ui_play"
  | "haptic"
  | "device_sound"
  | "device_ring"
  | "device_notification";

export type KernelEffect = {
  id: KernelId;
  kind: KernelEffectKind;
  targetKey?: string;
  value?: KernelValueRef;
  actorId?: string;
  config: Record<string, unknown>;
};

export type KernelRule = {
  id: KernelId;
  label: string;
  eventId?: string;
  when: KernelConditionGroup;
  effects: KernelEffect[];
  priority: number;
  enabled: boolean;
};

export type KernelUiDefinition = {
  /** Ordered compatibility possibility IDs shown on the employee phone surface. */
  layout: string[];

  /**
   * BRIXTA_VISUAL_UI_DOCUMENT_V1
   *
   * A true visual application document.
   *
   * This is deliberately separate from captures/actions and from Pixel Logic.
   * Old Responsibilities can omit it and continue through action_form_v1.
   */
  uiDocument?: ResponsibilityUiDocument;
  /** Optional friendly app title/description independent of internal keys. */
  title?: string;
  description?: string;
  /** Preview defaults only; runtime never trusts these for authorization. */
  /**
   * Whether employees can see their own previously saved entries.
   * Separate from CRUD read because the runtime still needs the latest own
   * record internally for lifecycle/state decisions.
   */
  employeeOwnHistoryVisible?: boolean;
  previewActorId?: string;
  previewStateId?: string;
  /** Builder-only hints. Runtime may ignore these safely. */
  canvas?: {
    zoom?: number;
    density?: "comfortable" | "compact";
    showBehaviorChips?: boolean;
  };
};


/*
 * BRIXTA_RESPONSIBILITY_DELIVERY_TARGETS_V1
 *
 * One Responsibility definition may be delivered through multiple hosts.
 *
 * brixta_app:
 *   authenticated employee Flutter runtime.
 *
 * external_web:
 *   lightweight Flutter-Web host using the SAME uiDocument and Pixel Logic,
 *   but with a public/optional-auth capability boundary.
 */
export type ResponsibilityExternalWebAccess =
  | "public"
  | "optional_auth"
  | "required_auth";

export type ResponsibilityExternalWebDelivery = {
  enabled: boolean;

  runtime:
    "flutter_web";

  access:
    ResponsibilityExternalWebAccess;

  /*
   * Stable tenant/schema routing key.
   *
   * Example:
   *   eurofoampillows
   */
  tenantKey: string;

  /*
   * Examples:
   *
   * /x/{tenant}/dealer-onboarding
   *
   * /r/{tenant}/{token}
   */
  routePattern: string;

  /*
   * Server-side services the External Runtime is expected
   * to call. This is authoring metadata only.
   *
   * Runtime authorization still comes from the backend's
   * public service registry.
   */
  allowedCapabilities: string[];

  /*
   * Builder hint only.
   *
   * Actual deployment/publish state remains authoritative
   * in the deployment/runtime layer.
   */
  description?: string;
};

export type ResponsibilityDeliveryTargets = {
  brixtaApp?: {
    enabled: boolean;
  };

  externalWeb?: ResponsibilityExternalWebDelivery;
};


export type ResponsibilityKernel = {
  kernelVersion: 3;
  runtimeWorld: {
    actors: KernelActor[];
    objects: KernelObject[];
    contexts: KernelContext[];
    states: KernelState[];
  };
  possibilities: KernelPossibility[];
  events: KernelEvent[];
  rules: KernelRule[];
  metadata: {
    description?: string;
    createdFrom?: string;
    tags?: string[];
    ui?: KernelUiDefinition;

    /*
     * Delivery is metadata around the SAME Responsibility.
     * It does not create another app definition.
     */
    deliveryTargets?: ResponsibilityDeliveryTargets;
  };
};

export const RESPONSIBILITY_KERNEL_METADATA_KEY = "responsibilityKernel";
