"use client";

import {
  AiBuilderBrief,
} from "./ai-builder-brief";

import {
  augmentBuilderAiContext,
  type BuilderAiMode,
} from "@/lib/builder-ai-intent-context";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  BatteryCharging,
  BellRing,
  Bluetooth,
  Camera,
  Check,
  CirclePlay,
  Compass,
  FileText,
  Fingerprint,
  Gauge,
  GitBranch,
  GripVertical,
  HeartPulse,
  LocateFixed,
  MapPin,
  Mic,
  MousePointerClick,
  Navigation,
  Nfc,
  Plus,
  QrCode,
  RotateCcw,
  Route,
  ScanBarcode,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  SquarePen,
  Timer,
  Trash2,
  UserRound,
  WandSparkles,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { Department, Employee, Role } from "@/lib/appliance-types";
import type { PlatformDataSource } from "@/lib/platform-vnext-types";
import type {
  KernelAction,
  KernelActor,
  KernelCapture,
  KernelCondition,
  KernelContext,
  KernelContextSource,
  KernelEffect,
  KernelEffectKind,
  KernelOperator,
  KernelOutput,
  KernelOutputKind,
  KernelPossibility,
  KernelRule,
  KernelState,
  KernelValueRef,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";
import {
  ACTION_CATALOG,
  CAPTURE_CATALOG,
  OUTPUT_CATALOG,
  STARTER_TEMPLATES,
} from "@/lib/responsibility-kernel-catalog";
import { compileResponsibilitySemantics } from "@/lib/responsibility-semantic-compiler";

import { RESPONSIBILITY_APP_BUILDER_BLOCKS } from "@/lib/responsibility-app-builder-block-registry";

import {
  applyResponsibilityAppBuilderAIImport,
  buildResponsibilityAppBuilderAIContext,
  parseResponsibilityAppBuilderAIImport,
  responsibilityAppBuilderRegistryFingerprint,
  validateResponsibilityAppBuilderAIImport,
  type AppBuilderNativeBlockContext,
  type ResponsibilityAppBuilderAIImportResult,
} from "@/lib/responsibility-app-builder-ai-bridge";
import {
  rankIntentCandidates,
  suggestRecipeComposition,
} from "@/lib/responsibility-intent-graph";

import type {
  ResponsibilityUiBlockType,
  ResponsibilityUiTheme,
} from "@/lib/responsibility-ui-document";

import {
  VisualBlockInspector,
  VisualFunctionalPlacementSection,
  VisualPaletteSection,
  VisualPhoneCanvas,
  addVisualBlock,
  addVisualCaptureBlock,
  addVisualActionBlock,
  wireVisualFunctionality,
  deleteVisualBlock,
  reorderVisualRoots,
} from "./responsibility-visual-builder";
import { FlutterLivePreview } from "./flutter-live-preview";
import { cx } from "./client";
import {
  Field,
  inputClass,
  Panel,
  Pill,
  PrimaryButton,
  SecondaryButton,
  textareaClass,
} from "./primitives";

function randomKey(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}
function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function configString(config: Record<string, unknown>, key: string) {
  return typeof config[key] === "string" ? String(config[key]) : "";
}
function configNumber(
  config: Record<string, unknown>,
  key: string,
  fallback = 0,
) {
  return typeof config[key] === "number" ? Number(config[key]) : fallback;
}
function configBoolean(
  config: Record<string, unknown>,
  key: string,
  fallback = false,
) {
  return typeof config[key] === "boolean" ? Boolean(config[key]) : fallback;
}
function parseLiteral(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const number = Number(trimmed);
  return Number.isNaN(number) ? trimmed : number;
}
function initialState(kernel: ResponsibilityKernel) {
  return (
    kernel.runtimeWorld.states.find((state) => state.initial)?.id ??
    kernel.runtimeWorld.states[0]?.id ??
    ""
  );
}
function updatePossibility(
  kernel: ResponsibilityKernel,
  possibilityId: string,
  updater: (item: KernelPossibility) => KernelPossibility,
) {
  return {
    ...kernel,
    possibilities: kernel.possibilities.map((item) =>
      item.id === possibilityId ? updater(item) : item,
    ),
  };
}
function actionEventIds(kernel: ResponsibilityKernel, actionId: string) {
  return kernel.events
    .filter((event) => event.kind === "action" && event.actionId === actionId)
    .map((event) => event.id);
}
function rulesForAction(kernel: ResponsibilityKernel, actionId: string) {
  const eventIds = new Set(actionEventIds(kernel, actionId));
  return kernel.rules
    .filter((rule) => rule.eventId && eventIds.has(rule.eventId))
    .sort((a, b) => a.priority - b.priority);
}
function ensureActionEvent(kernel: ResponsibilityKernel, action: KernelAction) {
  const next = clone(kernel);
  let event = next.events.find(
    (item) => item.kind === "action" && item.actionId === action.id,
  );
  if (!event) {
    event = {
      id: randomKey("event"),
      label: `${action.label} happens`,
      kind: "action",
      actionId: action.id,
    };
    next.events.push(event);
  }
  return { kernel: next, eventId: event.id };
}
function ensureBaseRule(kernel: ResponsibilityKernel, action: KernelAction) {
  const eventResult = ensureActionEvent(kernel, action);
  const next = eventResult.kernel;
  let rule = next.rules.find((item) => item.eventId === eventResult.eventId);
  if (!rule) {
    rule = {
      id: randomKey("rule"),
      label: `${action.label} behavior`,
      eventId: eventResult.eventId,
      when: { mode: "all", conditions: [] },
      effects: [
        {
          id: randomKey("effect"),
          kind: "append_history",
          config: { label: action.label },
        },
      ],
      priority: 100,
      enabled: true,
    };
    next.rules.push(rule);
  }
  // The action's own config carries the intended transition
  // (availableState / resultingState -- the convention every recipe and
  // the manual builder both use), but nothing ever turned that into an
  // actual change_state effect, so records never left their initial
  // state no matter how many times an action ran. Add it once, keyed
  // off resultingState so re-applying a recipe stays idempotent instead
  // of stacking duplicate effects.
  const resultingState = action.config?.resultingState;
  if (typeof resultingState === "string" && resultingState.trim()) {
    const hasStateEffect = rule.effects.some(
      (effect) => effect.kind === "change_state",
    );
    if (!hasStateEffect) {
      rule.effects = [
        {
          id: randomKey("effect"),
          kind: "change_state",
          targetKey: "process",
          value: { kind: "literal", value: resultingState },
          config: {},
        },
        ...rule.effects,
      ];
    }
  }
  return { kernel: next, eventId: eventResult.eventId, ruleId: rule.id };
}
function addOrReplaceContext(
  kernel: ResponsibilityKernel,
  context: KernelContext,
) {
  const next = clone(kernel);
  const index = next.runtimeWorld.contexts.findIndex(
    (item) => item.id === context.id,
  );
  if (index >= 0)
    next.runtimeWorld.contexts[index] = {
      ...next.runtimeWorld.contexts[index],
      ...context,
    };
  else next.runtimeWorld.contexts.push(context);
  return next;
}
function addOrReplaceActor(kernel: ResponsibilityKernel, actor: KernelActor) {
  const next = clone(kernel);
  const index = next.runtimeWorld.actors.findIndex(
    (item) => item.id === actor.id,
  );
  if (index >= 0)
    next.runtimeWorld.actors[index] = {
      ...next.runtimeWorld.actors[index],
      ...actor,
    };
  else next.runtimeWorld.actors.push(actor);
  return next;
}
function addOrReplaceState(kernel: ResponsibilityKernel, state: KernelState) {
  const next = clone(kernel);
  const index = next.runtimeWorld.states.findIndex(
    (item) => item.id === state.id,
  );
  if (index >= 0)
    next.runtimeWorld.states[index] = {
      ...next.runtimeWorld.states[index],
      ...state,
    };
  else next.runtimeWorld.states.push(state);
  return next;
}
function ensureCapture(
  kernel: ResponsibilityKernel,
  capture: KernelCapture,
  addToLayout = true,
) {
  const next = clone(kernel);
  let possibility = next.possibilities.find(
    (item) => item.type === "capture" && item.capture.id === capture.id,
  );
  if (!possibility) {
    possibility = { id: `capture_${capture.id}`, type: "capture", capture };
    next.possibilities.push(possibility);
  } else if (possibility.type === "capture") {
    possibility.capture = {
      ...possibility.capture,
      ...capture,
      config: { ...possibility.capture.config, ...capture.config },
    };
  }
  if (addToLayout && !next.metadata.ui?.layout.includes(possibility.id)) {
    next.metadata.ui = {
      ...(next.metadata.ui ?? { layout: [] }),
      layout: [...(next.metadata.ui?.layout ?? []), possibility.id],
    };
  }
  return next;
}
function ensureAction(
  kernel: ResponsibilityKernel,
  action: KernelAction,
  addToLayout = true,
) {
  let next = clone(kernel);
  let possibility = next.possibilities.find(
    (item) => item.type === "action" && item.action.id === action.id,
  );
  if (!possibility) {
    possibility = { id: `action_${action.id}`, type: "action", action };
    next.possibilities.push(possibility);
  } else if (possibility.type === "action") {
    possibility.action = {
      ...possibility.action,
      ...action,
      config: { ...possibility.action.config, ...action.config },
    };
  }
  if (addToLayout && !next.metadata.ui?.layout.includes(possibility.id)) {
    next.metadata.ui = {
      ...(next.metadata.ui ?? { layout: [] }),
      layout: [...(next.metadata.ui?.layout ?? []), possibility.id],
    };
  }
  const actual = possibility.type === "action" ? possibility.action : action;
  return ensureBaseRule(next, actual).kernel;
}
function ensureOutput(
  kernel: ResponsibilityKernel,
  output: KernelOutput,
  addToLayout = true,
) {
  const next = clone(kernel);
  let possibility = next.possibilities.find(
    (item) => item.type === "output" && item.output.id === output.id,
  );
  if (!possibility) {
    possibility = { id: `output_${output.id}`, type: "output", output };
    next.possibilities.push(possibility);
  } else if (possibility.type === "output") {
    possibility.output = { ...possibility.output, ...output };
  }
  if (addToLayout && !next.metadata.ui?.layout.includes(possibility.id)) {
    next.metadata.ui = {
      ...(next.metadata.ui ?? { layout: [] }),
      layout: [...(next.metadata.ui?.layout ?? []), possibility.id],
    };
  }
  return next;
}
function upsertEventRule(
  kernel: ResponsibilityKernel,
  event: ResponsibilityKernel["events"][number],
  rule: KernelRule,
) {
  const next = clone(kernel);
  const ei = next.events.findIndex((item) => item.id === event.id);
  if (ei >= 0) next.events[ei] = event;
  else next.events.push(event);
  const ri = next.rules.findIndex((item) => item.id === rule.id);
  if (ri >= 0) next.rules[ri] = rule;
  else next.rules.push(rule);
  return next;
}
function captureIcon(kind: string, native?: string): LucideIcon {
  if (native === "geofence") return LocateFixed;
  if (native === "live_location") return Navigation;
  if (native === "route_tracker") return Route;
  if (native === "step_counter") return Activity;
  if (native?.startsWith("health_")) return HeartPulse;
  if (native === "battery_level") return BatteryCharging;
  if (native === "bluetooth_scan") return Bluetooth;
  if (native === "biometric_auth") return Fingerprint;
  if (native === "heading") return Compass;
  if (native === "speed") return Gauge;
  if (["photo", "video"].includes(kind)) return Camera;
  if (["gps", "route"].includes(kind)) return MapPin;
  if (kind === "person_reference") return UserRound;
  if (kind === "qr") return QrCode;
  if (kind === "barcode") return ScanBarcode;
  if (kind === "nfc") return Nfc;
  if (kind === "audio") return Mic;
  if (kind === "timer") return Timer;
  return SquarePen;
}

type NativeBlock = {
  key: string;
  label: string;
  description: string;
  kind: KernelCapture["kind"];
  icon: LucideIcon;
  keywords: string[];
  config: Record<string, unknown>;
};

const NATIVE_BLOCKS: NativeBlock[] = [
  [
    "current_location",
    "Current Location",
    "Capture the phone's GPS position when needed.",
    "gps",
    MapPin,
    ["gps", "location", "where", "position", "site"],
    {
      nativeCapability: "current_location",
      permissions: ["location_precise"],
      valueSource: "native_phone",
    },
  ],
  [
    "live_location",
    "Live Location",
    "Continuously update location during an active work session.",
    "gps",
    Navigation,
    ["live", "track", "tracking", "background", "gps", "where is employee"],
    {
      nativeCapability: "live_location",
      mode: "continuous",
      updateIntervalSeconds: 30,
      permissions: ["location_precise", "location_background", "notifications"],
      persistentDisclosure: true,
      foregroundNotificationText: "Work location tracking is active",
      valueSource: "native_phone",
    },
  ],
  [
    "route_tracker",
    "Journey / Route Tracker",
    "Record route, distance and movement while a journey is running.",
    "route",
    Route,
    [
      "journey",
      "route",
      "travel",
      "distance",
      "km",
      "salesman",
      "tada",
      "ta da",
    ],
    {
      nativeCapability: "route_tracker",
      mode: "continuous",
      updateIntervalSeconds: 30,
      minimumDistanceMeters: 25,
      permissions: ["location_precise", "location_background", "notifications"],
      persistentDisclosure: true,
      foregroundNotificationText: "Journey tracking is active",
      emits: ["movement_started", "movement_stopped", "distance_changed"],
      valueSource: "native_phone",
    },
  ],
  [
    "geofence",
    "Geofence",
    "Watch an allowed area and emit enter/exit events.",
    "gps",
    LocateFixed,
    [
      "geofence",
      "leave area",
      "factory",
      "site boundary",
      "outside",
      "zone",
      "alert manager",
    ],
    {
      nativeCapability: "geofence",
      mode: "monitor",
      areaSource: "current_site",
      radiusMeters: 250,
      permissions: ["location_precise", "location_background", "notifications"],
      persistentDisclosure: true,
      foregroundNotificationText: "Work-area monitoring is active",
      emits: ["location_entered", "location_exited"],
      valueSource: "native_phone",
    },
  ],
  [
    "speed",
    "Speed",
    "Read movement speed from the phone location stream.",
    "number",
    Gauge,
    ["speed", "kmph", "velocity", "movement"],
    {
      nativeCapability: "speed",
      unit: "km/h",
      permissions: ["location_precise"],
      valueSource: "native_phone",
    },
  ],
  [
    "heading",
    "Heading / Compass",
    "Read device heading where supported.",
    "number",
    Compass,
    ["heading", "compass", "direction", "bearing"],
    {
      nativeCapability: "heading",
      unit: "degrees",
      valueSource: "native_phone",
    },
  ],
  [
    "step_counter",
    "Step Counter",
    "Count steps during a Responsibility or work session.",
    "number",
    Activity,
    ["steps", "walking", "pedometer", "activity"],
    {
      nativeCapability: "step_counter",
      permissions: ["activity_recognition"],
      valueSource: "native_phone",
    },
  ],
  [
    "motion_activity",
    "Motion / Activity State",
    "Detect still, walking, running or vehicle states.",
    "choice",
    Activity,
    ["motion", "walking", "vehicle", "still", "activity recognition"],
    {
      nativeCapability: "activity_recognition",
      permissions: ["activity_recognition"],
      options: ["Still", "Walking", "Running", "Vehicle", "Unknown"],
      valueSource: "native_phone",
    },
  ],
  [
    "accelerometer",
    "Accelerometer",
    "Read acceleration samples for supported operational use cases.",
    "repeating_section",
    Activity,
    ["accelerometer", "shake", "movement sensor", "vibration"],
    {
      nativeCapability: "accelerometer",
      dataShape: "vector3",
      valueSource: "native_phone",
    },
  ],
  [
    "gyroscope",
    "Gyroscope",
    "Read rotation/orientation samples where supported.",
    "repeating_section",
    Compass,
    ["gyroscope", "rotation", "orientation", "sensor"],
    {
      nativeCapability: "gyroscope",
      dataShape: "vector3",
      valueSource: "native_phone",
    },
  ],
  [
    "battery",
    "Battery Level",
    "Use battery percentage and charging state in rules.",
    "number",
    BatteryCharging,
    ["battery", "charging", "low battery", "power"],
    {
      nativeCapability: "battery_level",
      unit: "%",
      automatic: true,
      valueSource: "native_phone",
    },
  ],
  [
    "connectivity",
    "Connectivity",
    "Use online/offline and network state in app behavior.",
    "choice",
    Wifi,
    ["internet", "online", "offline", "wifi", "network"],
    {
      nativeCapability: "connectivity",
      options: ["Online", "Offline"],
      valueSource: "native_phone",
    },
  ],
  [
    "bluetooth_scan",
    "Bluetooth / BLE Discovery",
    "Discover nearby permitted Bluetooth devices.",
    "repeating_section",
    Bluetooth,
    ["bluetooth", "ble", "nearby", "sensor", "device"],
    {
      nativeCapability: "bluetooth_scan",
      permissions: ["bluetooth_scan", "bluetooth_connect"],
      valueSource: "native_phone",
    },
  ],
  [
    "camera",
    "Camera Photo",
    "Take a photo from the native camera.",
    "photo",
    Camera,
    ["camera", "photo", "evidence", "proof"],
    {
      nativeCapability: "camera",
      source: "camera",
      allowGallery: false,
      permissions: ["camera"],
      valueSource: "employee",
    },
  ],
  [
    "video",
    "Video Capture",
    "Record video from the native camera.",
    "video",
    Camera,
    ["video", "record", "camera", "evidence"],
    {
      nativeCapability: "video_capture",
      permissions: ["camera", "microphone"],
      valueSource: "employee",
    },
  ],
  [
    "voice_note",
    "Voice Note",
    "Record an audio note using the phone microphone.",
    "audio",
    Mic,
    ["voice", "audio", "microphone", "note"],
    {
      nativeCapability: "voice_note",
      permissions: ["microphone"],
      valueSource: "employee",
    },
  ],
  [
    "document_scan",
    "Document Scanner",
    "Use the camera as a document capture/scanning surface.",
    "file",
    FileText,
    ["document", "scan", "invoice", "receipt", "paper", "ocr"],
    {
      nativeCapability: "document_scan",
      permissions: ["camera"],
      valueSource: "employee",
    },
  ],
  [
    "qr",
    "QR Scanner",
    "Scan a QR code and use it in lookups or rules.",
    "qr",
    QrCode,
    ["qr", "scan", "machine", "asset", "code"],
    {
      nativeCapability: "qr_scanner",
      permissions: ["camera"],
      valueSource: "employee",
    },
  ],
  [
    "barcode",
    "Barcode Scanner",
    "Scan product, package or asset barcodes.",
    "barcode",
    ScanBarcode,
    ["barcode", "scan", "product", "bag", "inventory"],
    {
      nativeCapability: "barcode_scanner",
      permissions: ["camera"],
      valueSource: "employee",
    },
  ],
  [
    "nfc",
    "NFC Tap",
    "Read a permitted NFC tag from a machine, asset or location.",
    "nfc",
    Nfc,
    ["nfc", "tap", "machine", "asset", "tag"],
    { nativeCapability: "nfc", permissions: ["nfc"], valueSource: "employee" },
  ],
  [
    "biometric",
    "Biometric Confirmation",
    "Require fingerprint/face/device confirmation before an action.",
    "boolean",
    Fingerprint,
    ["biometric", "fingerprint", "face id", "authenticate", "secure"],
    {
      nativeCapability: "biometric_auth",
      permissions: ["biometric"],
      automatic: true,
      valueSource: "native_phone",
    },
  ],
  [
    "health_steps",
    "Health Steps",
    "Read permitted step data from Health Connect / HealthKit.",
    "number",
    HeartPulse,
    ["health", "steps", "health connect", "healthkit", "fitness"],
    {
      nativeCapability: "health_steps",
      permissions: ["health_steps_read"],
      sensitivePermission: true,
      valueSource: "native_phone",
    },
  ],
  [
    "health_distance",
    "Health Walking Distance",
    "Read permitted walking distance from the device health platform.",
    "number",
    HeartPulse,
    ["health", "distance", "walking", "healthkit", "health connect"],
    {
      nativeCapability: "health_distance",
      permissions: ["health_distance_read"],
      sensitivePermission: true,
      valueSource: "native_phone",
    },
  ],
  [
    "file_picker",
    "Native File Picker",
    "Select a file using the operating-system picker.",
    "file",
    FileText,
    ["file", "picker", "upload", "document"],
    { nativeCapability: "file_picker", valueSource: "employee" },
  ],
  [
    "signature",
    "Signature",
    "Capture a signature in the mobile app.",
    "signature",
    SquarePen,
    ["signature", "sign", "proof", "delivery"],
    { nativeCapability: "signature", valueSource: "employee" },
  ],
].map(([key, label, description, kind, icon, keywords, config]) => ({
  key: String(key),
  label: String(label),
  description: String(description),
  kind: kind as KernelCapture["kind"],
  icon: icon as LucideIcon,
  keywords: keywords as string[],
  config: config as Record<string, unknown>,
}));

type Selection =
  | { kind: "app" }
  | { kind: "possibility"; id: string }
  | { kind: "context"; id: string }
  | { kind: "state"; id: string }
  | { kind: "actor"; id: string }
  | { kind: "ui"; id: string };

type RecipeResult = { kernel: ResponsibilityKernel; selection?: Selection };
type SmartRecipe = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  adds: string[];
  apply: (kernel: ResponsibilityKernel) => RecipeResult;
};

function normalizeAttendanceStates(kernel: ResponsibilityKernel) {
  let next = clone(kernel);
  for (const state of next.runtimeWorld.states) state.initial = false;
  next.runtimeWorld.states = next.runtimeWorld.states.filter(
    (state) => !["present", "late"].includes(state.id),
  );
  next = addOrReplaceState(next, {
    id: "not_punched_in",
    label: "Not punched in",
    dimension: "process",
    initial: true,
  });
  next = addOrReplaceState(next, {
    id: "punched_in",
    label: "Punched in",
    dimension: "process",
  });
  next = addOrReplaceState(next, {
    id: "completed",
    label: "Completed",
    dimension: "process",
    terminal: true,
  });
  next.metadata.ui = {
    ...(next.metadata.ui ?? { layout: [] }),
    previewStateId: "not_punched_in",
  };
  return next;
}

function attendanceEssentialsRecipe(
  kernel: ResponsibilityKernel,
): RecipeResult {
  let next = normalizeAttendanceStates(kernel);
  next = addOrReplaceContext(next, {
    id: "current_location",
    label: "Current location",
    source: "current_location",
    mutable: true,
  });
  next = addOrReplaceContext(next, {
    id: "current_device",
    label: "Current device",
    source: "current_device",
    mutable: false,
  });
  next = ensureCapture(next, {
    id: "attendance_photo",
    label: "Attendance photo",
    kind: "photo",
    required: true,
    storeAs: "attendance_photo",
    config: {
      nativeCapability: "camera",
      source: "camera",
      allowGallery: false,
      permissions: ["camera"],
      valueSource: "employee",
    },
  });
  next = ensureCapture(next, {
    id: "attendance_location",
    label: "Attendance location",
    kind: "gps",
    required: true,
    storeAs: "attendance_location",
    config: {
      nativeCapability: "current_location",
      permissions: ["location_precise"],
      automatic: true,
      valueSource: "native_phone",
    },
  });
  next = ensureCapture(next, {
    id: "attendance_time",
    label: "Attendance time",
    kind: "datetime",
    required: true,
    storeAs: "attendance_time",
    config: {
      // Auto-derived from the device clock at the moment the action
      // fires -- same pattern as the GPS capture above. Never shown as
      // a manual input; the app fills it in and submits it silently.
      nativeCapability: "device_clock",
      automatic: true,
      valueSource: "device_time",
      // Display-only hints. Storage stays UTC ISO 8601 (correct, DST-
      // proof); these just tell the rendering layer how to show it back
      // to a person.
      displayFormat: "h:mm a",
      displayTimezone: "Asia/Kolkata",
    },
  });
  next = ensureAction(next, {
    id: "punch_in",
    label: "Punch In",
    kind: "start",
    actorId: "current_employee",
    objectId: "current_record",
    captureIds: ["attendance_photo", "attendance_location", "attendance_time"],
    config: {
      availableState: "not_punched_in",
      resultingState: "punched_in",
      captureContext: ["current_employee", "current_time", "current_location"],
      successMessage: "Punched in.",
    },
  });
  next = ensureAction(next, {
    id: "punch_out",
    label: "Punch Out",
    kind: "stop",
    actorId: "current_employee",
    objectId: "current_record",
    captureIds: ["attendance_location", "attendance_time"],
    config: {
      availableState: "punched_in",
      resultingState: "completed",
      captureContext: ["current_time", "current_location"],
      successMessage: "Punched out.",
    },
  });
  next = ensureOutput(next, {
    id: "attendance_result",
    label: "Attendance Result",
    kind: "detail",
    actorIds: ["current_employee"],
    stateIds: [],
    visibleKeys: [
      "attendance_photo",
      "attendance_location",
      "attendance_time",
      "punch_in_time",
      "minutes_late",
      "late_deduction",
    ],
    config: {},
  });
  return {
    kernel: next,
    selection: { kind: "possibility", id: "action_punch_in" },
  };
}

function lateDeductionRecipe(kernel: ResponsibilityKernel): RecipeResult {
  let next = attendanceEssentialsRecipe(kernel).kernel;
  const configured: KernelContext[] = [
    {
      id: "shift_start_time",
      label: "Shift start time",
      source: "literal",
      value: "09:00",
      config: { valueType: "time", businessSetting: true },
      mutable: false,
    },
    {
      id: "late_threshold_minutes",
      label: "Late threshold minutes",
      source: "literal",
      value: 30,
      config: { valueType: "number", unit: "minutes", businessSetting: true },
      mutable: false,
    },
    {
      id: "minor_late_deduction",
      label: "Minor late deduction",
      source: "literal",
      value: 50,
      config: { valueType: "amount", currency: "INR", businessSetting: true },
      mutable: false,
    },
    {
      id: "major_late_deduction",
      label: "Major late deduction",
      source: "literal",
      value: 100,
      config: { valueType: "amount", currency: "INR", businessSetting: true },
      mutable: false,
    },
  ];
  for (const context of configured) next = addOrReplaceContext(next, context);

  const event = {
    id: "event_punch_in",
    label: "Punch In happens",
    kind: "action" as const,
    actionId: "punch_in",
  };
  const oldPunchEventIds = new Set(
    next.events
      .filter((item) => item.kind === "action" && item.actionId === "punch_in")
      .map((item) => item.id),
  );
  next.events = next.events.filter((item) => !oldPunchEventIds.has(item.id));
  next.rules = next.rules.filter(
    (rule) => !rule.eventId || !oldPunchEventIds.has(rule.eventId),
  );
  next.events.push(event);

  next.rules.push(
    {
      id: "rule_punch_in_compute_late",
      label: "Calculate lateness",
      eventId: event.id,
      priority: 10,
      enabled: true,
      when: { mode: "all", conditions: [] },
      effects: [
        {
          id: "effect_punch_in_time",
          kind: "set_context",
          targetKey: "punch_in_time",
          value: { kind: "context", key: "current_time" },
          config: {},
        },
        {
          id: "effect_minutes_late",
          kind: "set_computed",
          targetKey: "minutes_late",
          config: {
            operation: "minutes_between",
            from: { kind: "context", key: "shift_start_time" },
            to: { kind: "context", key: "current_time" },
            clampMin: 0,
          },
        },
      ],
    },
    {
      id: "rule_punch_in_on_time",
      label: "On time",
      eventId: event.id,
      priority: 20,
      enabled: true,
      when: {
        mode: "all",
        conditions: [
          {
            id: "condition_on_time",
            left: { kind: "computed", key: "minutes_late" },
            operator: "lte",
            right: { kind: "literal", value: 0 },
          },
        ],
      },
      effects: [
        {
          id: "effect_deduction_zero",
          kind: "set_computed",
          targetKey: "late_deduction",
          value: { kind: "literal", value: 0 },
          config: { currency: "INR" },
        },
        {
          id: "effect_state_present",
          kind: "set_computed",
          targetKey: "arrival_status",
          value: { kind: "literal", value: "on_time" },
          config: {},
        },
        {
          id: "effect_history_present",
          kind: "append_history",
          config: { label: "Punched in on time" },
        },
      ],
    },
    {
      id: "rule_punch_in_minor_late",
      label: "Late up to 30 minutes",
      eventId: event.id,
      priority: 30,
      enabled: true,
      when: {
        mode: "all",
        conditions: [
          {
            id: "condition_minor_late",
            left: { kind: "computed", key: "minutes_late" },
            operator: "between",
            right: { kind: "literal", value: [1, 30] },
          },
        ],
      },
      effects: [
        {
          id: "effect_minor_deduction",
          kind: "set_computed",
          targetKey: "late_deduction",
          value: { kind: "context", key: "minor_late_deduction" },
          config: { currency: "INR" },
        },
        {
          id: "effect_state_minor_late",
          kind: "set_computed",
          targetKey: "arrival_status",
          value: { kind: "literal", value: "late" },
          config: {},
        },
        {
          id: "effect_history_minor_late",
          kind: "append_history",
          config: { label: "Late arrival deduction applied" },
        },
      ],
    },
    {
      id: "rule_punch_in_major_late",
      label: "Late beyond threshold",
      eventId: event.id,
      priority: 40,
      enabled: true,
      when: {
        mode: "all",
        conditions: [
          {
            id: "condition_major_late",
            left: { kind: "computed", key: "minutes_late" },
            operator: "gt",
            right: { kind: "context", key: "late_threshold_minutes" },
          },
        ],
      },
      effects: [
        {
          id: "effect_major_deduction",
          kind: "set_computed",
          targetKey: "late_deduction",
          value: { kind: "context", key: "major_late_deduction" },
          config: { currency: "INR" },
        },
        {
          id: "effect_state_major_late",
          kind: "set_computed",
          targetKey: "arrival_status",
          value: { kind: "literal", value: "late" },
          config: {},
        },
        {
          id: "effect_history_major_late",
          kind: "append_history",
          config: { label: "Major late arrival deduction applied" },
        },
      ],
    },
  );
  return {
    kernel: next,
    selection: { kind: "possibility", id: "action_punch_in" },
  };
}

function journeyRecipe(kernel: ResponsibilityKernel): RecipeResult {
  let next = clone(kernel);
  next = addOrReplaceContext(next, {
    id: "current_location",
    label: "Current location",
    source: "current_location",
    mutable: true,
  });
  next = addOrReplaceContext(next, {
    id: "current_device",
    label: "Current device",
    source: "current_device",
    mutable: false,
  });
  next = addOrReplaceContext(next, {
    id: "journey_session",
    label: "Journey session",
    source: "session",
    mutable: true,
  });
  next = ensureCapture(next, {
    id: "journey_route",
    label: "Journey route",
    kind: "route",
    required: false,
    storeAs: "journey_route",
    config: clone(
      NATIVE_BLOCKS.find((item) => item.key === "route_tracker")!.config,
    ),
  });
  next = ensureCapture(next, {
    id: "journey_duration",
    label: "Journey duration",
    kind: "timer",
    required: false,
    storeAs: "journey_duration",
    config: { nativeCapability: "session_timer", automatic: true },
  });
  next = ensureAction(next, {
    id: "start_journey",
    label: "Start Journey",
    kind: "start",
    actorId: "current_employee",
    objectId: "current_record",
    captureIds: [],
    config: {
      startSession: true,
      startRoute: true,
      captureContext: ["current_time", "current_location", "current_device"],
      successMessage: "Journey started.",
    },
  });
  next = ensureAction(next, {
    id: "stop_journey",
    label: "Stop Journey",
    kind: "stop",
    actorId: "current_employee",
    objectId: "current_record",
    captureIds: ["journey_route", "journey_duration"],
    config: {
      stopSession: true,
      stopRoute: true,
      freezeEvidence: true,
      successMessage: "Journey completed.",
    },
  });
  next = ensureOutput(next, {
    id: "journey_summary",
    label: "Journey Summary",
    kind: "route",
    actorIds: ["current_employee"],
    stateIds: [],
    visibleKeys: ["journey_route", "journey_duration", "session.distance"],
    config: { showDistance: true, showDuration: true, showStops: true },
  });
  return {
    kernel: next,
    selection: { kind: "possibility", id: "capture_journey_route" },
  };
}

function geofenceAlertRecipe(kernel: ResponsibilityKernel): RecipeResult {
  let next = clone(kernel);
  next = addOrReplaceContext(next, {
    id: "current_location",
    label: "Current location",
    source: "current_location",
    mutable: true,
  });
  next = addOrReplaceActor(next, {
    id: "reporting_manager",
    label: "Reporting manager",
    resolver: {
      kind: "manager_of",
      value: { kind: "actor", key: "current_employee" },
    },
  });
  next = ensureCapture(next, {
    id: "work_geofence",
    label: "Work area geofence",
    kind: "gps",
    required: false,
    storeAs: "work_geofence",
    config: clone(
      NATIVE_BLOCKS.find((item) => item.key === "geofence")!.config,
    ),
  });
  next = ensureOutput(next, {
    id: "tracking_disclosure",
    label: "Tracking status",
    kind: "notification",
    actorIds: ["current_employee"],
    stateIds: [],
    visibleKeys: ["work_geofence"],
    config: {
      nativeCapability: "ongoing_notification",
      persistent: true,
      text: "Work-area monitoring is active",
      employeeVisible: true,
    },
  });
  next = upsertEventRule(
    next,
    {
      id: "event_work_geofence_exit",
      label: "Employee leaves work area",
      kind: "location_exited",
      sourceKey: "work_geofence",
    },
    {
      id: "rule_work_geofence_exit",
      label: "Tell people when employee leaves work area",
      eventId: "event_work_geofence_exit",
      priority: 100,
      enabled: true,
      when: { mode: "all", conditions: [] },
      effects: [
        {
          id: "effect_geofence_notify_employee",
          kind: "notify_actor",
          actorId: "current_employee",
          config: {
            channel: "push",
            message: "You have left your assigned work area.",
          },
        },
        {
          id: "effect_geofence_notify_manager",
          kind: "notify_actor",
          actorId: "reporting_manager",
          config: {
            channel: "push",
            message: "An assigned employee left the work area.",
          },
        },
        {
          id: "effect_geofence_status",
          kind: "set_context",
          targetKey: "geofence_status",
          value: { kind: "literal", value: "outside" },
          config: {},
        },
        {
          id: "effect_geofence_history",
          kind: "append_history",
          config: { label: "Left work area" },
        },
      ],
    },
  );
  return {
    kernel: next,
    selection: { kind: "possibility", id: "capture_work_geofence" },
  };
}

function visitProofRecipe(kernel: ResponsibilityKernel): RecipeResult {
  let next = clone(kernel);
  next = ensureCapture(next, {
    id: "visit_photo",
    label: "Visit photo",
    kind: "photo",
    required: true,
    storeAs: "visit_photo",
    config: {
      nativeCapability: "camera",
      source: "camera",
      allowGallery: false,
      permissions: ["camera"],
      valueSource: "employee",
    },
  });
  next = ensureCapture(next, {
    id: "visit_location",
    label: "Visit location",
    kind: "gps",
    required: true,
    storeAs: "visit_location",
    config: {
      nativeCapability: "current_location",
      automatic: true,
      permissions: ["location_precise"],
      valueSource: "native_phone",
    },
  });
  next = ensureAction(next, {
    id: "confirm_visit",
    label: "Confirm Visit",
    kind: "submit",
    actorId: "current_employee",
    objectId: "current_record",
    captureIds: ["visit_photo", "visit_location"],
    config: {
      captureContext: ["current_time", "current_employee"],
      successMessage: "Visit confirmed.",
    },
  });
  return {
    kernel: next,
    selection: { kind: "possibility", id: "action_confirm_visit" },
  };
}

function conditionalApprovalRecipe(kernel: ResponsibilityKernel): RecipeResult {
  let next = clone(kernel);
  next = addOrReplaceActor(next, {
    id: "reporting_manager",
    label: "Reporting manager",
    resolver: {
      kind: "manager_of",
      value: { kind: "actor", key: "current_employee" },
    },
  });
  next = addOrReplaceContext(next, {
    id: "approval_threshold",
    label: "Approval threshold",
    source: "literal",
    value: 5000,
    config: { valueType: "amount", currency: "INR", businessSetting: true },
    mutable: false,
  });
  next = ensureCapture(next, {
    id: "approval_amount",
    label: "Amount",
    kind: "amount",
    required: true,
    storeAs: "amount",
    config: {},
  });
  next = ensureAction(next, {
    id: "submit_for_approval",
    label: "Submit",
    kind: "submit",
    actorId: "current_employee",
    objectId: "current_record",
    captureIds: ["approval_amount"],
    config: { successMessage: "Submitted." },
  });
  const event = {
    id: "event_submit_for_approval",
    label: "Submit happens",
    kind: "action" as const,
    actionId: "submit_for_approval",
  };
  next = upsertEventRule(next, event, {
    id: "rule_amount_needs_approval",
    label: "Manager approval above threshold",
    eventId: event.id,
    priority: 100,
    enabled: true,
    when: {
      mode: "all",
      conditions: [
        {
          id: "condition_amount_threshold",
          left: { kind: "capture", key: "approval_amount" },
          operator: "gt",
          right: { kind: "context", key: "approval_threshold" },
        },
      ],
    },
    effects: [
      {
        id: "effect_assign_manager",
        kind: "assign_actor",
        actorId: "reporting_manager",
        config: {},
      },
      {
        id: "effect_notify_manager",
        kind: "notify_actor",
        actorId: "reporting_manager",
        config: { channel: "push", message: "Approval required." },
      },
      {
        id: "effect_approval_history",
        kind: "append_history",
        config: { label: "Sent for manager approval" },
      },
    ],
  });
  return {
    kernel: next,
    selection: { kind: "possibility", id: "action_submit_for_approval" },
  };
}

function machineScanRecipe(kernel: ResponsibilityKernel): RecipeResult {
  let next = clone(kernel);
  next = ensureCapture(next, {
    id: "machine_code",
    label: "Scan machine",
    kind: "qr",
    required: true,
    storeAs: "machine_code",
    config: { nativeCapability: "qr_scanner", permissions: ["camera"] },
  });
  next = ensureCapture(next, {
    id: "machine",
    label: "Machine",
    kind: "entity_reference",
    required: true,
    storeAs: "machine",
    config: {
      source: "entities",
      lookupFrom: "machine_code",
      searchable: true,
    },
  });
  next = ensureAction(next, {
    id: "open_machine",
    label: "Open Machine",
    kind: "trigger",
    actorId: "current_employee",
    objectId: "current_record",
    captureIds: ["machine_code", "machine"],
    config: {
      nativeAction: "open_related_responsibility",
      successMessage: "Machine resolved.",
    },
  });
  return {
    kernel: next,
    selection: { kind: "possibility", id: "capture_machine_code" },
  };
}

function lowBatteryRecipe(kernel: ResponsibilityKernel): RecipeResult {
  let next = clone(kernel);
  next = ensureCapture(next, {
    id: "device_battery",
    label: "Battery level",
    kind: "number",
    required: false,
    storeAs: "device_battery",
    config: { nativeCapability: "battery_level", unit: "%", automatic: true },
  });
  next = addOrReplaceActor(next, {
    id: "reporting_manager",
    label: "Reporting manager",
    resolver: {
      kind: "manager_of",
      value: { kind: "actor", key: "current_employee" },
    },
  });
  next = upsertEventRule(
    next,
    {
      id: "event_battery_changed",
      label: "Battery level changes",
      kind: "external",
      sourceKey: "device_battery",
    },
    {
      id: "rule_low_battery",
      label: "Low battery during work",
      eventId: "event_battery_changed",
      priority: 100,
      enabled: true,
      when: {
        mode: "all",
        conditions: [
          {
            id: "condition_battery_low",
            left: { kind: "capture", key: "device_battery" },
            operator: "lt",
            right: { kind: "literal", value: 15 },
          },
        ],
      },
      effects: [
        {
          id: "effect_battery_employee",
          kind: "notify_actor",
          actorId: "current_employee",
          config: {
            channel: "push",
            message:
              "Battery is low. Keep the phone charged while work tracking is active.",
          },
        },
        {
          id: "effect_battery_manager",
          kind: "notify_actor",
          actorId: "reporting_manager",
          config: {
            channel: "app",
            message: "Employee device battery is low.",
          },
        },
        {
          id: "effect_battery_history",
          kind: "append_history",
          config: { label: "Low battery detected" },
        },
      ],
    },
  );
  return {
    kernel: next,
    selection: { kind: "possibility", id: "capture_device_battery" },
  };
}

function biometricRecipe(kernel: ResponsibilityKernel): RecipeResult {
  let next = clone(kernel);
  next = ensureCapture(next, {
    id: "biometric_confirmation",
    label: "Confirm identity",
    kind: "boolean",
    required: true,
    storeAs: "biometric_confirmation",
    config: {
      nativeCapability: "biometric_auth",
      permissions: ["biometric"],
      automatic: true,
      valueSource: "native_phone",
    },
  });
  let action = next.possibilities.find(
    (item) =>
      item.type === "action" &&
      ["submit", "approve", "complete", "sign"].includes(item.action.kind),
  );
  if (!action || action.type !== "action") {
    next = ensureAction(next, {
      id: "secure_submit",
      label: "Submit",
      kind: "submit",
      actorId: "current_employee",
      objectId: "current_record",
      captureIds: ["biometric_confirmation"],
      config: {},
    });
    action = next.possibilities.find(
      (item) => item.type === "action" && item.action.id === "secure_submit",
    );
  } else {
    action.action.captureIds = [
      ...new Set([...action.action.captureIds, "biometric_confirmation"]),
    ];
  }
  return {
    kernel: next,
    selection: action
      ? { kind: "possibility", id: action.id }
      : { kind: "app" },
  };
}

const SMART_RECIPES: SmartRecipe[] = [
  {
    key: "attendance_essentials",
    label: "Attendance Essentials",
    description:
      "Photo + location + Punch In/Out. BRIXTA handles the lifecycle automatically.",
    icon: ShieldCheck,
    keywords: [
      "attendance",
      "punch",
      "check in",
      "check out",
      "worker",
      "mistri",
      "factory",
    ],
    adds: ["Photo", "GPS", "Punch In", "Punch Out"],
    apply: attendanceEssentialsRecipe,
  },
  {
    key: "late_deduction",
    label: "Late Arrival Deduction",
    description: "Calculate minutes late and apply ₹0 / ₹50 / ₹100 rules.",
    icon: GitBranch,
    keywords: [
      "late",
      "deduct",
      "deduction",
      "salary",
      "punch late",
      "attendance",
      "30 minutes",
      "50",
      "100",
      "shift",
    ],
    adds: ["Shift time", "Minutes late", "Deduction slabs"],
    apply: lateDeductionRecipe,
  },
  {
    key: "journey_tracker",
    label: "Journey Tracker",
    description: "Track route, distance, duration and Start/Stop journey.",
    icon: Route,
    keywords: [
      "journey",
      "salesman",
      "travel",
      "route",
      "distance",
      "km",
      "tada",
      "ta da",
      "track phone",
    ],
    adds: ["Route", "GPS", "Timer", "Start", "Stop", "Summary"],
    apply: journeyRecipe,
  },
  {
    key: "geofence_exit_alert",
    label: "Geofence Exit Alert",
    description:
      "Watch a work area and notify employee + reporting manager on exit.",
    icon: LocateFixed,
    keywords: [
      "geofence",
      "leave site",
      "leave factory",
      "outside area",
      "notify manager",
      "zone",
      "boundary",
    ],
    adds: [
      "Geofence",
      "Background location",
      "Persistent disclosure",
      "Manager alert",
    ],
    apply: geofenceAlertRecipe,
  },
  {
    key: "visit_proof",
    label: "Customer Visit Proof",
    description:
      "Require camera photo + GPS + timestamp when a visit is confirmed.",
    icon: Camera,
    keywords: [
      "visit",
      "customer",
      "proof",
      "photo",
      "gps",
      "field visit",
      "reached",
    ],
    adds: ["Photo", "GPS", "Timestamp", "Confirm Visit"],
    apply: visitProofRecipe,
  },
  {
    key: "conditional_approval",
    label: "Conditional Manager Approval",
    description: "Send high-value submissions to the reporting manager.",
    icon: ShieldCheck,
    keywords: [
      "approval",
      "manager",
      "expense",
      "amount",
      "above",
      "5000",
      "threshold",
    ],
    adds: ["Amount", "Threshold", "Reporting manager", "Approval rule"],
    apply: conditionalApprovalRecipe,
  },
  {
    key: "machine_scan",
    label: "Scan Machine / Asset",
    description: "QR scan → resolve machine → open the related work action.",
    icon: QrCode,
    keywords: [
      "machine",
      "scan",
      "qr",
      "nfc",
      "asset",
      "inspection",
      "maintenance",
    ],
    adds: ["QR scanner", "Machine lookup", "Open action"],
    apply: machineScanRecipe,
  },
  {
    key: "low_battery",
    label: "Low Battery Alert",
    description: "Use device battery in rules and notify during active work.",
    icon: BatteryCharging,
    keywords: ["battery", "low", "journey", "tracking", "notify", "15 percent"],
    adds: [
      "Battery level",
      "Threshold rule",
      "Employee alert",
      "Manager alert",
    ],
    apply: lowBatteryRecipe,
  },
  {
    key: "biometric_before_action",
    label: "Biometric Before Submit",
    description:
      "Require fingerprint/face/device confirmation before a sensitive action.",
    icon: Fingerprint,
    keywords: [
      "biometric",
      "fingerprint",
      "face id",
      "authenticate",
      "before submit",
      "secure",
    ],
    adds: ["Biometric confirmation", "Required action input"],
    apply: biometricRecipe,
  },
];

type DiscoverKind =
  | "recipe"
  | "capture"
  | "action"
  | "output"
  | "native"
  | "context";
type DiscoverGroup =
  | "Recommended"
  | "Ask"
  | "Phone & sensors"
  | "Actions"
  | "Show"
  | "Logic & data";
type DiscoverItem = {
  id: string;
  kind: DiscoverKind;
  title: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  group: DiscoverGroup;
  payload: string;
};

const INTENT_SYNONYMS: Array<[string, string[]]> = [
  [
    "track",
    ["journey", "route", "gps", "live location", "distance", "timer", "steps"],
  ],
  [
    "attendance",
    ["punch", "check in", "check out", "late", "shift", "photo", "gps"],
  ],
  ["late", ["deduction", "shift", "minutes", "attendance", "punch"]],
  ["manager", ["approval", "notify", "reporting manager", "assign"]],
  ["site", ["location", "geofence", "gps", "visit"]],
  ["machine", ["qr", "nfc", "barcode", "inspection", "asset"]],
  ["proof", ["photo", "signature", "gps", "timestamp"]],
  ["health", ["steps", "activity", "walking", "healthkit", "health connect"]],
  ["secure", ["biometric", "fingerprint", "face id", "approval"]],
  ["scan", ["qr", "barcode", "nfc", "document", "camera"]],
  ["notify", ["notification", "manager", "alert", "push"]],
];

function discoveryItems(
  nativeBlocks: NativeBlock[] = NATIVE_BLOCKS,
): DiscoverItem[] {
  const recipes = SMART_RECIPES.map<DiscoverItem>((item) => ({
    id: `recipe:${item.key}`,
    kind: "recipe",
    title: item.label,
    description: item.description,
    keywords: item.keywords,
    icon: item.icon,
    group: "Recommended",
    payload: item.key,
  }));
  const native = nativeBlocks.map<DiscoverItem>((item) => ({
    id: `native:${item.key}`,
    kind: "native",
    title: item.label,
    description: item.description,
    keywords: item.keywords,
    icon: item.icon,
    group: "Phone & sensors",
    payload: item.key,
  }));
  const captures = CAPTURE_CATALOG.map<DiscoverItem>((item) => ({
    id: `capture:${item.kind}`,
    kind: "capture",
    title: item.label,
    description:
      item.group === "Reference"
        ? "Select existing people or business data."
        : `Add a ${item.label.toLowerCase()} input.`,
    keywords: [item.kind, item.label, item.group, "field", "input"],
    icon: captureIcon(item.kind),
    group: "Ask",
    payload: item.kind,
  }));
  const actions = ACTION_CATALOG.map<DiscoverItem>((item) => ({
    id: `action:${item.kind}`,
    kind: "action",
    title: item.label,
    description: `Add a ${item.label.toLowerCase()} action button.`,
    keywords: [item.kind, item.label, "button", "do", "action"],
    icon: MousePointerClick,
    group: "Actions",
    payload: item.kind,
  }));
  const outputs = OUTPUT_CATALOG.map<DiscoverItem>((item) => ({
    id: `output:${item.kind}`,
    kind: "output",
    title: item.label,
    description: `Show results as ${item.label.toLowerCase()}.`,
    keywords: [item.kind, item.label, "show", "display", "result", "output"],
    icon: item.kind === "notification" ? BellRing : Smartphone,
    group: "Show",
    payload: item.kind,
  }));
  const contexts: DiscoverItem[] = [
    [
      "current_time",
      "Current Time",
      "Use the current date/time in logic.",
      Timer,
    ],
    [
      "current_location",
      "Current Location Context",
      "Use current GPS without asking the employee to type it.",
      MapPin,
    ],
    [
      "current_device",
      "Current Device",
      "Use the phone/device in logic.",
      Smartphone,
    ],
    [
      "current_manager",
      "Reporting Manager",
      "Resolve the current employee's reporting manager.",
      UserRound,
    ],
    [
      "literal",
      "Fixed / Configured Value",
      "Add a shift start, threshold, rate, deduction or any business value.",
      Settings2,
    ],
    [
      "company_setting",
      "Company Setting",
      "Reference a centrally managed company policy/value.",
      Settings2,
    ],
  ].map(([payload, title, description, icon]) => ({
    id: `context:${payload}`,
    kind: "context",
    title: String(title),
    description: String(description),
    keywords: [String(payload), String(title), "context", "value", "setting"],
    icon: icon as LucideIcon,
    group: "Logic & data",
    payload: String(payload),
  }));
  return [...recipes, ...native, ...captures, ...actions, ...outputs];
}

function searchScore(item: DiscoverItem, query: string) {
  if (!query.trim()) {
    if (item.kind === "recipe") return 20;
    if (
      ["route_tracker", "geofence", "camera", "qr", "biometric"].includes(
        item.payload,
      )
    )
      return 10;
    if (
      ["short_text", "number", "choice", "photo", "submit"].includes(
        item.payload,
      )
    )
      return 7;
    return 1;
  }
  const q = query.toLowerCase().trim();
  const terms = new Set(q.split(/\s+/).filter(Boolean));
  for (const [trigger, additions] of INTENT_SYNONYMS) {
    if (q.includes(trigger)) additions.forEach((term) => terms.add(term));
  }
  const haystack =
    `${item.title} ${item.description} ${item.keywords.join(" ")}`.toLowerCase();
  let score = haystack.includes(q) ? 30 : 0;
  for (const term of terms) {
    if (term.length < 2) continue;
    if (item.title.toLowerCase().includes(term)) score += 8;
    if (haystack.includes(term)) score += 3;
  }
  if (item.kind === "recipe" && score > 0) score += 5;
  return score;
}

function DiscoveryCard({
  item,
  onAdd,
}: {
  item: DiscoverItem;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.kind}:${item.payload}`,
  });
  const Icon = item.icon;
  return (
    <div
      ref={setNodeRef}
      className={cx(
        "rounded-xl border bg-background p-3 transition hover:border-primary/40 hover:bg-muted/20",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="mt-0.5 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          title="Drag to phone"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{item.title}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {item.description}
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

function possibilityTitle(item: KernelPossibility) {
  return item.type === "capture"
    ? item.capture.label
    : item.type === "action"
      ? item.action.label
      : item.output.label;
}

function possibilitySubtitle(item: KernelPossibility) {
  if (item.type === "capture") {
    const native = configString(item.capture.config, "nativeCapability");
    return native ? `Phone · ${humanize(native)}` : humanize(item.capture.kind);
  }
  if (item.type === "action") return `Action · ${humanize(item.action.kind)}`;
  return `Show · ${humanize(item.output.kind)}`;
}

function behaviorChips(_kernel: ResponsibilityKernel, item: KernelPossibility) {
  const chips: string[] = [];
  if (item.type === "capture") {
    if (item.capture.required) chips.push("Required");
    const native = configString(item.capture.config, "nativeCapability");
    if (native) chips.push(humanize(native));
  }
  if (item.type === "action") {
    if (item.action.kind === "start") chips.push("Starts work");
    else if (["stop", "complete"].includes(item.action.kind))
      chips.push("Available after start");
    else if (["approve", "reject"].includes(item.action.kind))
      chips.push("Manager decision");
    else if (["submit", "create"].includes(item.action.kind))
      chips.push("Sends record");
    if (configBoolean(item.action.config, "reviewRequired"))
      chips.push("Needs review");
    if (item.action.captureIds.length) {
      chips.push(
        `${item.action.captureIds.length} input${item.action.captureIds.length === 1 ? "" : "s"}`,
      );
    }
  }
  if (item.type === "output") chips.push(humanize(item.output.kind));
  return chips.slice(0, 3);
}

function BlockPreview({ item }: { item: KernelPossibility }) {
  if (item.type === "action") {
    return (
      <div
        className={cx(
          "mt-2 rounded-lg px-3 py-2 text-center text-sm font-semibold",
          ["reject", "delete", "cancel"].includes(item.action.kind)
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {item.action.label}
      </div>
    );
  }
  if (item.type === "output") {
    return (
      <div className="mt-2 rounded-lg border bg-muted/20 p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {humanize(item.output.kind)}
        </div>
        <div className="mt-1 text-sm font-medium">{item.output.label}</div>
      </div>
    );
  }
  const native = configString(item.capture.config, "nativeCapability");
  if (native) {
    const Icon = captureIcon(item.capture.kind, native);
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
        <Icon className="h-4 w-4" />
        <span>
          {native === "geofence"
            ? `${configNumber(item.capture.config, "radiusMeters", 250)} m work area`
            : humanize(native)}
        </span>
      </div>
    );
  }
  if (item.capture.kind === "choice") {
    return (
      <div className="mt-2 rounded-md border px-3 py-2 text-xs text-muted-foreground">
        Choose... ▾
      </div>
    );
  }
  if (item.capture.kind === "boolean") {
    return (
      <div className="mt-2 text-xs text-muted-foreground">
        ○ Yes&nbsp;&nbsp;&nbsp;○ No
      </div>
    );
  }
  if (
    [
      "photo",
      "video",
      "file",
      "signature",
      "audio",
      "qr",
      "barcode",
      "nfc",
    ].includes(item.capture.kind)
  ) {
    return (
      <div className="mt-2 rounded-md border px-3 py-2 text-center text-xs">
        Capture / select
      </div>
    );
  }
  return <div className="mt-2 h-9 rounded-md border bg-background" />;
}

function SortableBlock({
  kernel,
  item,
  selected,
  onSelect,
}: {
  kernel: ResponsibilityKernel;
  item: KernelPossibility;
  selected: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const Icon =
    item.type === "capture"
      ? captureIcon(
          item.capture.kind,
          configString(item.capture.config, "nativeCapability"),
        )
      : item.type === "action"
        ? MousePointerClick
        : Smartphone;
  const chips = behaviorChips(kernel, item);
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cx(
        "rounded-xl border bg-background p-3 transition hover:border-primary/40",
        selected && "border-primary ring-2 ring-primary/20",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="mt-1 cursor-grab text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {possibilityTitle(item)}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {possibilitySubtitle(item)}
          </div>
        </div>
      </div>
      <div className="pl-10">
        <BlockPreview item={item} />
      </div>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 pl-10">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PhoneCanvas({
  kernel,
  selection,
  onSelect,
}: {
  kernel: ResponsibilityKernel;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "phone-canvas" });
  const layout = kernel.metadata.ui?.layout ?? [];
  const items = layout
    .map((id) => kernel.possibilities.find((item) => item.id === id))
    .filter((item): item is KernelPossibility => Boolean(item));
  return (
    <div
      ref={setNodeRef}
      className={cx(
        "min-h-[650px] rounded-[42px] border-[7px] border-foreground/90 bg-background p-4 shadow-sm",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-muted-foreground/40" />
      <button
        type="button"
        className="w-full px-1 pb-3 text-left"
        onClick={() => onSelect({ kind: "app" })}
      >
        <div className="text-lg font-semibold">
          {kernel.metadata.ui?.title || "Employee app"}
        </div>
        {kernel.metadata.ui?.description && (
          <div className="mt-1 text-xs text-muted-foreground">
            {kernel.metadata.ui.description}
          </div>
        )}
      </button>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed p-7 text-center">
              <Smartphone className="h-9 w-9 text-muted-foreground" />
              <div className="mt-3 text-sm font-medium">
                Drag something here
              </div>
              <div className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                Search what you want in plain business language. Drag a
                suggested setup or feature onto the phone.
              </div>
            </div>
          ) : (
            items.map((item) => (
              <SortableBlock
                key={item.id}
                kernel={kernel}
                item={item}
                selected={
                  selection.kind === "possibility" && selection.id === item.id
                }
                onSelect={() => onSelect({ kind: "possibility", id: item.id })}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function BrainBar({
  kernel,
  selection,
  onSelect,
  onAddContext,
}: {
  kernel: ResponsibilityKernel;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onAddContext: (source: KernelContextSource) => void;
}) {
  return (
    <Panel className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" /> App brain
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Invisible people, information and state used by your visible blocks.
          </div>
        </div>
        <select
          className={`${inputClass} w-auto min-w-[180px]`}
          value=""
          onChange={(event) => {
            if (event.target.value)
              onAddContext(event.target.value as KernelContextSource);
            event.currentTarget.value = "";
          }}
        >
          <option value="">+ Add information...</option>
          <option value="current_time">Current time</option>
          <option value="current_location">Current location</option>
          <option value="current_device">Current device</option>
          <option value="current_manager">Reporting manager</option>
          <option value="literal">Fixed / configured value</option>
          <option value="company_setting">Company setting</option>
          <option value="query">Query result</option>
          <option value="history">Previous / historical data</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {kernel.runtimeWorld.contexts.map((context) => (
          <button
            key={context.id}
            type="button"
            onClick={() => onSelect({ kind: "context", id: context.id })}
            className={cx(
              "rounded-full border px-2.5 py-1 text-[11px] hover:bg-muted/40",
              selection.kind === "context" &&
                selection.id === context.id &&
                "border-primary bg-primary/5",
            )}
          >
            {context.label}
            {context.source === "literal"
              ? ` = ${String(context.value ?? "")}`
              : ""}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
        <span className="mr-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          People
        </span>
        {kernel.runtimeWorld.actors.map((actor) => (
          <button
            key={actor.id}
            type="button"
            onClick={() => onSelect({ kind: "actor", id: actor.id })}
            className={cx(
              "rounded-full border px-2.5 py-1 text-[11px] hover:bg-muted/40",
              selection.kind === "actor" &&
                selection.id === actor.id &&
                "border-primary bg-primary/5",
            )}
          >
            {actor.label}
          </button>
        ))}
        <span className="ml-2 mr-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          States
        </span>
        {kernel.runtimeWorld.states.map((state) => (
          <button
            key={state.id}
            type="button"
            onClick={() => onSelect({ kind: "state", id: state.id })}
            className={cx(
              "rounded-full border px-2.5 py-1 text-[11px] hover:bg-muted/40",
              selection.kind === "state" &&
                selection.id === state.id &&
                "border-primary bg-primary/5",
            )}
          >
            {state.label}
            {state.initial ? " · start" : ""}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function valueRefOptions(kernel: ResponsibilityKernel) {
  const refs: Array<{ value: string; label: string }> = [];
  for (const context of kernel.runtimeWorld.contexts) {
    refs.push({ value: `context:${context.id}`, label: context.label });
  }
  for (const item of kernel.possibilities) {
    if (item.type === "capture") {
      refs.push({
        value: `capture:${item.capture.id}`,
        label: item.capture.label,
      });
    }
  }
  const computed = new Set<string>();
  for (const rule of kernel.rules) {
    for (const effect of rule.effects) {
      if (effect.kind === "set_computed" && effect.targetKey)
        computed.add(effect.targetKey);
    }
  }
  for (const key of computed)
    refs.push({ value: `computed:${key}`, label: humanize(key) });
  refs.push({ value: "state:process", label: "Current state" });
  return refs;
}

function encodeRef(ref: KernelValueRef | undefined) {
  if (!ref) return "";
  if (ref.kind === "literal") return "literal";
  if ("key" in ref) return `${ref.kind}:${ref.key}`;
  return "";
}

function decodeRef(value: string): KernelValueRef {
  const [kind, ...rest] = value.split(":");
  const key = rest.join(":");
  if (kind === "context") return { kind: "context", key };
  if (kind === "capture") return { kind: "capture", key };
  if (kind === "computed") return { kind: "computed", key };
  if (kind === "state") return { kind: "state", key };
  if (kind === "actor") return { kind: "actor", key };
  if (kind === "object") return { kind: "object", key };
  if (kind === "query") return { kind: "query", key };
  if (kind === "history") return { kind: "history", key };
  return { kind: "literal", value: "" };
}

const OPERATOR_LABELS: Array<{ value: KernelOperator; label: string }> = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "between", label: "is between" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "does not exist" },
  { value: "in", label: "is in" },
];

function ConditionRow({
  kernel,
  condition,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  condition: KernelCondition;
  onChange: (condition: KernelCondition) => void;
  onDelete: () => void;
}) {
  const refs = valueRefOptions(kernel);
  const rightIsRef = Boolean(
    condition.right && condition.right.kind !== "literal",
  );
  const literal =
    condition.right?.kind === "literal" ? condition.right.value : "";
  const literalText = Array.isArray(literal)
    ? literal.join(", ")
    : String(literal ?? "");
  const needsRight = !["exists", "not_exists"].includes(condition.operator);
  return (
    <div className="space-y-2 rounded-lg border p-2">
      <select
        className={inputClass}
        value={encodeRef(condition.left)}
        onChange={(event) =>
          onChange({ ...condition, left: decodeRef(event.target.value) })
        }
      >
        {refs.map((ref) => (
          <option key={ref.value} value={ref.value}>
            {ref.label}
          </option>
        ))}
      </select>
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className={inputClass}
          value={condition.operator}
          onChange={(event) =>
            onChange({
              ...condition,
              operator: event.target.value as KernelOperator,
            })
          }
        >
          {OPERATOR_LABELS.map((operator) => (
            <option key={operator.value} value={operator.value}>
              {operator.label}
            </option>
          ))}
        </select>
        {needsRight && (
          <select
            className={inputClass}
            value={rightIsRef ? "reference" : "value"}
            onChange={(event) =>
              onChange({
                ...condition,
                right:
                  event.target.value === "reference"
                    ? decodeRef(refs[0]?.value ?? "context:current_time")
                    : { kind: "literal", value: "" },
              })
            }
          >
            <option value="value">A value</option>
            <option value="reference">Other app data</option>
          </select>
        )}
      </div>
      {needsRight &&
        (rightIsRef ? (
          <select
            className={inputClass}
            value={encodeRef(condition.right)}
            onChange={(event) =>
              onChange({ ...condition, right: decodeRef(event.target.value) })
            }
          >
            {refs.map((ref) => (
              <option key={ref.value} value={ref.value}>
                {ref.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={inputClass}
            value={literalText}
            placeholder={condition.operator === "between" ? "1, 30" : "Value"}
            onChange={(event) => {
              const value =
                condition.operator === "between"
                  ? event.target.value
                      .split(",")
                      .map((part) => parseLiteral(part))
                  : parseLiteral(event.target.value);
              onChange({ ...condition, right: { kind: "literal", value } });
            }}
          />
        ))}
      <button
        type="button"
        onClick={onDelete}
        className="text-xs text-destructive hover:underline"
      >
        Remove condition
      </button>
    </div>
  );
}

function EffectRow({
  kernel,
  effect,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  effect: KernelEffect;
  onChange: (effect: KernelEffect) => void;
  onDelete: () => void;
}) {
  const refs = valueRefOptions(kernel);
  const valueIsRef = Boolean(effect.value && effect.value.kind !== "literal");
  return (
    <div className="space-y-2 rounded-lg border p-2">
      <select
        className={inputClass}
        value={effect.kind}
        onChange={(event) =>
          onChange({
            ...effect,
            kind: event.target.value as KernelEffectKind,
            targetKey: undefined,
            actorId: undefined,
            value: undefined,
            config: {},
          })
        }
      >
        <option value="change_state">Change state</option>
        <option value="set_context">Remember / set value</option>
        <option value="set_computed">Calculate / set result</option>
        <option value="notify_actor">Notify someone</option>
        <option value="assign_actor">Assign to someone</option>
        <option value="create_record">Create record</option>
        <option value="update_record">Update record</option>
        <option value="query_data">Look up data</option>
        <option value="trigger_responsibility">
          Start another Responsibility
        </option>
        <option value="append_history">Add to history</option>
        <option value="freeze_data">Freeze evidence / data</option>
      </select>

      {effect.kind === "change_state" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={inputClass}
            value={effect.targetKey ?? "process"}
            onChange={(event) =>
              onChange({ ...effect, targetKey: event.target.value })
            }
            placeholder="State dimension"
          />
          <select
            className={inputClass}
            value={
              effect.value?.kind === "literal"
                ? String(effect.value.value ?? "")
                : ""
            }
            onChange={(event) =>
              onChange({
                ...effect,
                value: { kind: "literal", value: event.target.value },
              })
            }
          >
            <option value="">Choose state...</option>
            {kernel.runtimeWorld.states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {effect.kind === "notify_actor" && (
        <>
          <select
            className={inputClass}
            value={effect.actorId ?? ""}
            onChange={(event) =>
              onChange({ ...effect, actorId: event.target.value })
            }
          >
            <option value="">Who should know?</option>
            {kernel.runtimeWorld.actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.label}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            value={configString(effect.config, "message")}
            onChange={(event) =>
              onChange({
                ...effect,
                config: {
                  ...effect.config,
                  message: event.target.value,
                  channel: "push",
                },
              })
            }
            placeholder="Notification message"
          />
        </>
      )}

      {effect.kind === "assign_actor" && (
        <select
          className={inputClass}
          value={effect.actorId ?? ""}
          onChange={(event) =>
            onChange({ ...effect, actorId: event.target.value })
          }
        >
          <option value="">Assign to...</option>
          {kernel.runtimeWorld.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.label}
            </option>
          ))}
        </select>
      )}

      {["set_context", "set_computed"].includes(effect.kind) && (
        <>
          <input
            className={inputClass}
            value={effect.targetKey ?? ""}
            onChange={(event) =>
              onChange({
                ...effect,
                targetKey: normalizeKey(event.target.value),
              })
            }
            placeholder={
              effect.kind === "set_computed" ? "Result name" : "Remember as"
            }
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className={inputClass}
              value={valueIsRef ? "reference" : "value"}
              onChange={(event) =>
                onChange({
                  ...effect,
                  value:
                    event.target.value === "reference"
                      ? decodeRef(refs[0]?.value ?? "context:current_time")
                      : { kind: "literal", value: "" },
                })
              }
            >
              <option value="value">A value</option>
              <option value="reference">From app data</option>
            </select>
            {valueIsRef ? (
              <select
                className={inputClass}
                value={encodeRef(effect.value)}
                onChange={(event) =>
                  onChange({ ...effect, value: decodeRef(event.target.value) })
                }
              >
                {refs.map((ref) => (
                  <option key={ref.value} value={ref.value}>
                    {ref.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputClass}
                value={
                  effect.value?.kind === "literal"
                    ? String(effect.value.value ?? "")
                    : ""
                }
                onChange={(event) =>
                  onChange({
                    ...effect,
                    value: {
                      kind: "literal",
                      value: parseLiteral(event.target.value),
                    },
                  })
                }
                placeholder="Value"
              />
            )}
          </div>
        </>
      )}

      {effect.kind === "append_history" && (
        <input
          className={inputClass}
          value={configString(effect.config, "label")}
          onChange={(event) =>
            onChange({
              ...effect,
              config: { ...effect.config, label: event.target.value },
            })
          }
          placeholder="History message"
        />
      )}

      {[
        "create_record",
        "update_record",
        "query_data",
        "trigger_responsibility",
        "freeze_data",
      ].includes(effect.kind) && (
        <input
          className={inputClass}
          value={effect.targetKey ?? ""}
          onChange={(event) =>
            onChange({ ...effect, targetKey: event.target.value })
          }
          placeholder="Target / source key"
        />
      )}
      <button
        type="button"
        onClick={onDelete}
        className="text-xs text-destructive hover:underline"
      >
        Remove effect
      </button>
    </div>
  );
}

function RuleCard({
  kernel,
  rule,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  rule: KernelRule;
  onChange: (rule: KernelRule) => void;
  onDelete: () => void;
}) {
  return (
    <details className="rounded-xl border bg-muted/[0.08] p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">{rule.label}</div>
            <div className="text-[11px] text-muted-foreground">
              IF {rule.when.conditions.length || "always"} →{" "}
              {rule.effects.length} effect{rule.effects.length === 1 ? "" : "s"}
            </div>
          </div>
          <Pill>{rule.enabled ? "On" : "Off"}</Pill>
        </div>
      </summary>
      <div className="mt-4 space-y-4 border-t pt-4">
        <Field label="Rule name">
          <input
            className={inputClass}
            value={rule.label}
            onChange={(event) =>
              onChange({ ...rule, label: event.target.value })
            }
          />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold">ONLY WHEN</div>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() =>
                onChange({
                  ...rule,
                  when: {
                    ...rule.when,
                    conditions: [
                      ...rule.when.conditions,
                      {
                        id: randomKey("condition"),
                        left: {
                          kind: "context",
                          key:
                            kernel.runtimeWorld.contexts[0]?.id ??
                            "current_time",
                        },
                        operator: "eq",
                        right: { kind: "literal", value: "" },
                      },
                    ],
                  },
                })
              }
            >
              + Condition
            </button>
          </div>
          <div className="space-y-2">
            {rule.when.conditions.length === 0 && (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Always runs when this action happens.
              </div>
            )}
            {rule.when.conditions.map((condition) => (
              <ConditionRow
                key={condition.id}
                kernel={kernel}
                condition={condition}
                onChange={(nextCondition) =>
                  onChange({
                    ...rule,
                    when: {
                      ...rule.when,
                      conditions: rule.when.conditions.map((item) =>
                        item.id === condition.id ? nextCondition : item,
                      ),
                    },
                  })
                }
                onDelete={() =>
                  onChange({
                    ...rule,
                    when: {
                      ...rule.when,
                      conditions: rule.when.conditions.filter(
                        (item) => item.id !== condition.id,
                      ),
                    },
                  })
                }
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold">THEN</div>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() =>
                onChange({
                  ...rule,
                  effects: [
                    ...rule.effects,
                    {
                      id: randomKey("effect"),
                      kind: "append_history",
                      config: { label: "" },
                    },
                  ],
                })
              }
            >
              + What happens
            </button>
          </div>
          <div className="space-y-2">
            {rule.effects.map((effect) => (
              <EffectRow
                key={effect.id}
                kernel={kernel}
                effect={effect}
                onChange={(nextEffect) =>
                  onChange({
                    ...rule,
                    effects: rule.effects.map((item) =>
                      item.id === effect.id ? nextEffect : item,
                    ),
                  })
                }
                onDelete={() =>
                  onChange({
                    ...rule,
                    effects: rule.effects.filter(
                      (item) => item.id !== effect.id,
                    ),
                  })
                }
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(event) =>
                onChange({ ...rule, enabled: event.target.checked })
              }
            />
            Enabled
          </label>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-destructive hover:underline"
          >
            Delete rule
          </button>
        </div>
      </div>
    </details>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2 border-b pb-2">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide">
          {title}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {description}
        </div>
      </div>
    </div>
  );
}

function CaptureInspector({
  kernel,
  possibility,
  dataSources,
  onChange,
  onDelete,
  onApplyRecipe,
}: {
  kernel: ResponsibilityKernel;
  possibility: Extract<KernelPossibility, { type: "capture" }>;
  dataSources: PlatformDataSource[];
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
  onApplyRecipe: (key: string) => void;
}) {
  const capture = possibility.capture;
  const native = configString(capture.config, "nativeCapability");
  const permissions = Array.isArray(capture.config.permissions)
    ? capture.config.permissions.map(String)
    : [];
  const valueSource =
    configString(capture.config, "valueSource") ||
    (native ? "native_phone" : "employee");
  const options = Array.isArray(capture.config.options)
    ? capture.config.options.map(String)
    : [];

  function patch(nextCapture: KernelCapture) {
    onChange(
      updatePossibility(kernel, possibility.id, (item) =>
        item.type === "capture" ? { ...item, capture: nextCapture } : item,
      ),
    );
  }
  function patchConfig(config: Record<string, unknown>) {
    patch({ ...capture, config: { ...capture.config, ...config } });
  }

  const smarter =
    native === "current_location"
      ? ["geofence_exit_alert", "journey_tracker"]
      : native === "route_tracker"
        ? ["low_battery", "geofence_exit_alert"]
        : capture.kind === "amount"
          ? ["conditional_approval"]
          : capture.kind === "photo"
            ? ["visit_proof"]
            : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{capture.label}</div>
          <div className="text-xs text-muted-foreground">
            {possibilitySubtitle(possibility)}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <SectionTitle
          icon={SquarePen}
          title="Look"
          description="What the employee sees."
        />
        <Field label="Label">
          <input
            className={inputClass}
            value={capture.label}
            onChange={(event) =>
              patch({ ...capture, label: event.target.value })
            }
          />
        </Field>
        <Field label="Help text">
          <textarea
            className={textareaClass}
            rows={2}
            value={configString(capture.config, "helpText")}
            onChange={(event) => patchConfig({ helpText: event.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <SectionTitle
          icon={Settings2}
          title="Data"
          description="Where the value comes from and where it is saved."
        />
        <Field label="Get value from">
          <select
            className={inputClass}
            value={valueSource}
            onChange={(event) =>
              patchConfig({ valueSource: event.target.value })
            }
          >
            <option value="employee">Employee provides it</option>
            <option value="current_employee">Current employee</option>
            <option value="current_manager">Reporting manager</option>
            <option value="current_time">Current date / time</option>
            <option value="current_location">Current location</option>
            <option value="current_device">Current device</option>
            <option value="fixed">Fixed value</option>
            <option value="company_setting">Company setting</option>
            <option value="query">Existing / queried data</option>
            <option value="history">Previous / historical data</option>
            <option value="native_phone">Native phone capability</option>
          </select>
        </Field>
        {valueSource === "fixed" && (
          <Field label="Fixed value">
            <input
              className={inputClass}
              value={String(capture.config.fixedValue ?? "")}
              onChange={(event) =>
                patchConfig({ fixedValue: parseLiteral(event.target.value) })
              }
            />
          </Field>
        )}
        {valueSource === "company_setting" && (
          <Field label="Company setting key">
            <input
              className={inputClass}
              value={configString(capture.config, "settingKey")}
              onChange={(event) =>
                patchConfig({ settingKey: event.target.value })
              }
              placeholder="attendance.shift_start"
            />
          </Field>
        )}
        <Field label="Save as">
          <input
            className={inputClass}
            value={capture.storeAs ?? capture.id}
            onChange={(event) =>
              patch({ ...capture, storeAs: normalizeKey(event.target.value) })
            }
          />
        </Field>
        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={capture.required === true}
            onChange={(event) =>
              patch({ ...capture, required: event.target.checked })
            }
          />
          Required before a related action can run
        </label>

        {capture.kind === "choice" && (
          <Field label="Choices — one per line">
            <textarea
              className={textareaClass}
              rows={5}
              value={options.join("\n")}
              onChange={(event) =>
                patchConfig({
                  options: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        )}

        {[
          "person_reference",
          "entity_reference",
          "responsibility_reference",
        ].includes(capture.kind) && (
          <div className="space-y-2">
            <Field label="Get options from">
              <select
                className={inputClass}
                value={configString(capture.config, "source")}
                onChange={(event) => patchConfig({ source: event.target.value })}
              >
                <option value="">Choose a source...</option>
                {capture.kind === "person_reference" && (
                  <option value="employees">Employees</option>
                )}
                {dataSources.map((source) => (
                  <option key={source.id} value={source.key}>
                    {source.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      {native && (
        <div className="space-y-3">
          <SectionTitle
            icon={Smartphone}
            title="Phone capability"
            description="Permissions, lifecycle and native disclosure."
          />
          <div className="rounded-lg border bg-muted/15 p-3 text-xs">
            <div className="font-medium">{humanize(native)}</div>
            {permissions.length > 0 && (
              <div className="mt-1 text-muted-foreground">
                Needs: {permissions.map(humanize).join(", ")}
              </div>
            )}
          </div>

          {["live_location", "route_tracker", "geofence"].includes(native) && (
            <>
              <Field label="Update / monitoring interval">
                <select
                  className={inputClass}
                  value={String(
                    configNumber(capture.config, "updateIntervalSeconds", 30),
                  )}
                  onChange={(event) =>
                    patchConfig({
                      updateIntervalSeconds: Number(event.target.value),
                    })
                  }
                >
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="300">5 minutes</option>
                </select>
              </Field>
              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={configBoolean(
                    capture.config,
                    "persistentDisclosure",
                    true,
                  )}
                  onChange={(event) =>
                    patchConfig({ persistentDisclosure: event.target.checked })
                  }
                />
                <span>
                  <span className="font-medium">
                    Show ongoing system notification
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Continuous tracking remains visibly disclosed to the
                    employee while active.
                  </span>
                </span>
              </label>
              <Field label="Ongoing notification text">
                <input
                  className={inputClass}
                  value={configString(
                    capture.config,
                    "foregroundNotificationText",
                  )}
                  onChange={(event) =>
                    patchConfig({
                      foregroundNotificationText: event.target.value,
                    })
                  }
                />
              </Field>
            </>
          )}

          {native === "geofence" && (
            <>
              <Field label="Area comes from">
                <select
                  className={inputClass}
                  value={
                    configString(capture.config, "areaSource") || "current_site"
                  }
                  onChange={(event) =>
                    patchConfig({ areaSource: event.target.value })
                  }
                >
                  <option value="current_site">Assigned work site</option>
                  <option value="selected_entity">
                    Selected business record
                  </option>
                  <option value="fixed">Fixed point</option>
                  <option value="map">Choose / draw on map</option>
                </select>
              </Field>
              <Field label="Radius">
                <select
                  className={inputClass}
                  value={String(
                    configNumber(capture.config, "radiusMeters", 250),
                  )}
                  onChange={(event) =>
                    patchConfig({ radiusMeters: Number(event.target.value) })
                  }
                >
                  <option value="50">50 m</option>
                  <option value="100">100 m</option>
                  <option value="250">250 m</option>
                  <option value="500">500 m</option>
                  <option value="1000">1 km</option>
                </select>
              </Field>
            </>
          )}

          {configBoolean(capture.config, "sensitivePermission") && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed">
              Health/activity access must be explicitly authorized by the device
              user and limited to the configured metric.
            </div>
          )}
        </div>
      )}

      {smarter.length > 0 && (
        <div className="space-y-2">
          <SectionTitle
            icon={WandSparkles}
            title="Make this smarter"
            description="Useful behavior that fits this block."
          />
          {smarter.map((key) => {
            const recipe = SMART_RECIPES.find((item) => item.key === key)!;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onApplyRecipe(key)}
                className="w-full rounded-lg border p-3 text-left hover:bg-muted/30"
              >
                <div className="text-sm font-medium">+ {recipe.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {recipe.description}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type SimpleReviewTarget =
  | {
      kind: "default";
    }
  | {
      kind: "employee";
      userId?: number;
    }
  | {
      kind: "role";
      roleId?: number;
    }
  | {
      kind: "department";
      departmentId?: string;
    };

function reviewTargetFromAction(action: KernelAction): SimpleReviewTarget {
  const raw = action.config.reviewTarget;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const target = raw as Record<string, unknown>;

    const kind = String(target.kind ?? "");

    if (kind === "employee") {
      return {
        kind: "employee",
        userId: Number(target.userId) || undefined,
      };
    }

    if (kind === "role") {
      return {
        kind: "role",
        roleId: Number(target.roleId) || undefined,
      };
    }

    if (kind === "department") {
      return {
        kind: "department",
        departmentId:
          typeof target.departmentId === "string"
            ? target.departmentId
            : undefined,
      };
    }

    if (kind === "default") {
      return {
        kind: "default",
      };
    }
  }

  /*
   * Backward compatibility with the old reviewApprover string.
   */
  const legacy = configString(action.config, "reviewApprover");

  if (legacy.startsWith("role:")) {
    const roleId = Number(legacy.slice("role:".length));

    if (Number.isInteger(roleId) && roleId > 0) {
      return {
        kind: "role",
        roleId,
      };
    }
  }

  return {
    kind: "default",
  };
}

function AutomaticActionInspector({
  kernel,
  possibility,
  roles,
  employees,
  departments,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  possibility: Extract<KernelPossibility, { type: "action" }>;
  roles: Role[];
  employees: Employee[];
  departments: Department[];
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  const action = possibility.action;
  const captures = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "capture" }> =>
      item.type === "capture",
  );

  function patchAction(patch: Partial<KernelAction>) {
    onChange(
      updatePossibility(kernel, possibility.id, (item) =>
        item.type === "action"
          ? { ...item, action: { ...item.action, ...patch } }
          : item,
      ),
    );
  }

  const reviewRequired = configBoolean(action.config, "reviewRequired");

  const reviewTarget = reviewTargetFromAction(action);

  function patchReview(patch: Record<string, unknown>) {
    patchAction({
      config: {
        ...action.config,
        ...patch,
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{action.label}</div>
          <div className="text-xs text-muted-foreground">
            {humanize(action.kind)} action
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <SectionTitle
        icon={SquarePen}
        title="Button"
        description="What the employee sees."
      />
      <Field label="Button text">
        <input
          className={inputClass}
          value={action.label}
          onChange={(event) => patchAction({ label: event.target.value })}
        />
      </Field>

      <div>
        <div className="mb-2 text-xs font-medium">
          What should this action collect?
        </div>
        <div className="space-y-1 rounded-lg border p-2">
          {captures.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Add visible inputs to the phone first.
            </div>
          )}
          {captures.map((item) => (
            <label
              key={item.capture.id}
              className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/30"
            >
              <input
                type="checkbox"
                checked={action.captureIds.includes(item.capture.id)}
                onChange={(event) =>
                  patchAction({
                    captureIds: event.target.checked
                      ? [...new Set([...action.captureIds, item.capture.id])]
                      : action.captureIds.filter(
                          (id) => id !== item.capture.id,
                        ),
                  })
                }
              />
              {item.capture.label}
              {item.capture.required && (
                <span className="text-destructive">*</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <Field label="Success message">
        <input
          className={inputClass}
          value={configString(action.config, "successMessage")}
          onChange={(event) =>
            patchAction({
              config: { ...action.config, successMessage: event.target.value },
            })
          }
          placeholder={`${action.label} completed.`}
        />
      </Field>

      <div className="rounded-xl border p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={reviewRequired}
            onChange={(event) =>
              patchReview({
                reviewRequired: event.target.checked,

                reviewTarget: event.target.checked ? reviewTarget : null,

                // Legacy compatibility.
                reviewApprover: event.target.checked ? "reports_to" : "",
              })
            }
          />
          <div>
            <div className="text-sm font-semibold">
              Someone should verify this
            </div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Turn this on when the next step should wait for a human check.
              BRIXTA creates the approval flow automatically.
            </div>
          </div>
        </label>

        {reviewRequired && (
          <div className="mt-4 space-y-3">
            <Field label="Send decision to">
              <select
                className={inputClass}
                value={reviewTarget.kind}
                onChange={(event) => {
                  const kind = event.target.value;

                  if (kind === "employee") {
                    patchReview({
                      reviewTarget: {
                        kind: "employee",
                      },
                    });

                    return;
                  }

                  if (kind === "role") {
                    patchReview({
                      reviewTarget: {
                        kind: "role",
                      },
                    });

                    return;
                  }

                  if (kind === "department") {
                    patchReview({
                      reviewTarget: {
                        kind: "department",
                      },
                    });

                    return;
                  }

                  patchReview({
                    reviewTarget: {
                      kind: "default",
                    },

                    reviewApprover: "reports_to",
                  });
                }}
              >
                <option value="default">Default reporting manager</option>

                <option value="employee">Specific employee</option>

                <option value="role">Authority Role</option>

                <option value="department">Department</option>
              </select>
            </Field>

            {reviewTarget.kind === "employee" && (
              <Field label="Employee">
                <select
                  className={inputClass}
                  value={reviewTarget.userId ?? ""}
                  onChange={(event) =>
                    patchReview({
                      reviewTarget: {
                        kind: "employee",

                        userId: Number(event.target.value) || undefined,
                      },
                    })
                  }
                >
                  <option value="">Choose employee...</option>

                  {employees
                    .filter(
                      (employee) =>
                        employee.status !== "inactive" &&
                        employee.status !== "suspended",
                    )
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name ??
                          employee.employeeCode ??
                          `Employee ${employee.id}`}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            {reviewTarget.kind === "role" && (
              <Field label="Role">
                <select
                  className={inputClass}
                  value={reviewTarget.roleId ?? ""}
                  onChange={(event) => {
                    const roleId = Number(event.target.value) || undefined;

                    patchReview({
                      reviewTarget: {
                        kind: "role",

                        roleId,
                      },

                      reviewApprover: roleId ? `role:${roleId}` : "",
                    });
                  }}
                >
                  <option value="">Choose Role...</option>

                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {reviewTarget.kind === "department" && (
              <Field label="Department">
                <select
                  className={inputClass}
                  value={reviewTarget.departmentId ?? ""}
                  onChange={(event) =>
                    patchReview({
                      reviewTarget: {
                        kind: "department",

                        departmentId: event.target.value || undefined,
                      },
                    })
                  }
                >
                  <option value="">Choose Department...</option>

                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="rounded-lg border bg-muted/10 p-3 text-xs leading-relaxed text-muted-foreground">
              {reviewTarget.kind === "default"
                ? "No Responsibility-specific override. BRIXTA uses the submitting employee's default reporting rule from Employees."
                : reviewTarget.kind === "department"
                  ? "BRIXTA resolves the Department's current default authority when the request reaches review."
                  : "This selection overrides the employee's default reporting rule for this Responsibility action only."}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-muted/10 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Runtime logic is
          automatic
        </div>
        <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
          BRIXTA derives the current employee, record target, lifecycle, button
          visibility, timestamps, device/location context and manager
          relationship at preview/publish time.
        </div>
      </div>
    </div>
  );
}

function ActionInspector({
  kernel,
  possibility,
  onChange,
  onDelete,
  onApplyRecipe,
}: {
  kernel: ResponsibilityKernel;
  possibility: Extract<KernelPossibility, { type: "action" }>;
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
  onApplyRecipe: (key: string) => void;
}) {
  const action = possibility.action;
  const captures = kernel.possibilities.filter(
    (item): item is Extract<KernelPossibility, { type: "capture" }> =>
      item.type === "capture",
  );
  const rules = rulesForAction(kernel, action.id);

  function patchAction(patch: Partial<KernelAction>) {
    onChange(
      updatePossibility(kernel, possibility.id, (item) =>
        item.type === "action"
          ? { ...item, action: { ...item.action, ...patch } }
          : item,
      ),
    );
  }
  function patchConfig(patch: Record<string, unknown>) {
    patchAction({ config: { ...action.config, ...patch } });
  }
  function patchRule(rule: KernelRule) {
    onChange({
      ...kernel,
      rules: kernel.rules.map((item) => (item.id === rule.id ? rule : item)),
    });
  }
  function addRule() {
    const ensured = ensureActionEvent(kernel, action);
    const next = ensured.kernel;
    next.rules.push({
      id: randomKey("rule"),
      label: `When ${action.label}...`,
      eventId: ensured.eventId,
      when: { mode: "all", conditions: [] },
      effects: [],
      priority: 100 + rules.length * 10,
      enabled: true,
    });
    onChange(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{action.label}</div>
          <div className="text-xs text-muted-foreground">
            Action · {humanize(action.kind)}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <SectionTitle
          icon={SquarePen}
          title="Look"
          description="The button the employee sees."
        />
        <Field label="Button text">
          <input
            className={inputClass}
            value={action.label}
            onChange={(event) => patchAction({ label: event.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <SectionTitle
          icon={Settings2}
          title="Data"
          description="Who can use it and which information it collects."
        />
        <Field label="Who can do this?">
          <select
            className={inputClass}
            value={action.actorId ?? ""}
            onChange={(event) => patchAction({ actorId: event.target.value })}
          >
            <option value="">Choose actor...</option>
            {kernel.runtimeWorld.actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What is this acting on?">
          <select
            className={inputClass}
            value={action.objectId ?? ""}
            onChange={(event) => patchAction({ objectId: event.target.value })}
          >
            <option value="">Choose object...</option>
            {kernel.runtimeWorld.objects.map((object) => (
              <option key={object.id} value={object.id}>
                {object.label}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <div className="mb-2 text-xs font-medium">
            What should it collect?
          </div>
          <div className="space-y-1 rounded-lg border p-2">
            {captures.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No input blocks yet.
              </div>
            )}
            {captures.map((item) => (
              <label
                key={item.capture.id}
                className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  checked={action.captureIds.includes(item.capture.id)}
                  onChange={(event) =>
                    patchAction({
                      captureIds: event.target.checked
                        ? [...new Set([...action.captureIds, item.capture.id])]
                        : action.captureIds.filter(
                            (id) => id !== item.capture.id,
                          ),
                    })
                  }
                />
                {item.capture.label}
                {item.capture.required && (
                  <span className="text-destructive">*</span>
                )}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium">
            Also capture automatically
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {kernel.runtimeWorld.contexts
              .filter((context) =>
                [
                  "current_user",
                  "current_time",
                  "current_location",
                  "current_device",
                  "session",
                ].includes(context.source),
              )
              .map((context) => {
                const current = Array.isArray(action.config.captureContext)
                  ? action.config.captureContext.map(String)
                  : [];
                return (
                  <label
                    key={context.id}
                    className="flex items-center gap-2 rounded-lg border p-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={current.includes(context.id)}
                      onChange={(event) =>
                        patchConfig({
                          captureContext: event.target.checked
                            ? [...new Set([...current, context.id])]
                            : current.filter((id) => id !== context.id),
                        })
                      }
                    />
                    {context.label}
                  </label>
                );
              })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle
          icon={Zap}
          title="Behavior"
          description="The common logic stays simple."
        />
        <Field label="Available when">
          <select
            className={inputClass}
            value={configString(action.config, "availableState")}
            onChange={(event) =>
              patchConfig({ availableState: event.target.value })
            }
          >
            <option value="">Any state</option>
            {kernel.runtimeWorld.states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="After success, state becomes">
          <select
            className={inputClass}
            value={configString(action.config, "resultingState")}
            onChange={(event) =>
              patchConfig({ resultingState: event.target.value })
            }
          >
            <option value="">No automatic state change</option>
            {kernel.runtimeWorld.states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Success message">
          <input
            className={inputClass}
            value={configString(action.config, "successMessage")}
            onChange={(event) =>
              patchConfig({ successMessage: event.target.value })
            }
            placeholder={`${action.label} completed.`}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <SectionTitle
            icon={GitBranch}
            title="Logic"
            description="Complex rules remain attached to this action."
          />
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-primary"
            onClick={addRule}
          >
            + Rule
          </button>
        </div>
        <div className="rounded-lg border bg-muted/10 p-3 text-xs leading-relaxed text-muted-foreground">
          Build IF / THEN logic. Compare inputs, context, calculations or state;
          then calculate, notify, assign, change state, create/update data or
          trigger another Responsibility.
        </div>
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            kernel={kernel}
            rule={rule}
            onChange={patchRule}
            onDelete={() =>
              onChange({
                ...kernel,
                rules: kernel.rules.filter((item) => item.id !== rule.id),
              })
            }
          />
        ))}
      </div>

      <div className="space-y-2">
        <SectionTitle
          icon={WandSparkles}
          title="Make this smarter"
          description="Ready-made logic; edit every rule after adding."
        />
        {[
          "late_deduction",
          "conditional_approval",
          "biometric_before_action",
        ].map((key) => {
          const recipe = SMART_RECIPES.find((item) => item.key === key)!;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onApplyRecipe(key)}
              className="w-full rounded-lg border p-3 text-left hover:bg-muted/30"
            >
              <div className="text-sm font-medium">+ {recipe.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {recipe.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AutomaticOutputInspector({
  kernel,
  possibility,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  possibility: Extract<KernelPossibility, { type: "output" }>;
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  const output = possibility.output;
  const candidates = kernel.possibilities
    .filter(
      (item): item is Extract<KernelPossibility, { type: "capture" }> =>
        item.type === "capture",
    )
    .map((item) => ({
      key: item.capture.storeAs ?? item.capture.id,
      label: item.capture.label,
    }));

  function patch(patchOutput: Partial<KernelOutput>) {
    onChange(
      updatePossibility(kernel, possibility.id, (item) =>
        item.type === "output"
          ? { ...item, output: { ...item.output, ...patchOutput } }
          : item,
      ),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{output.label}</div>
          <div className="text-xs text-muted-foreground">
            Result shown from this Responsibility.
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Field label="Label">
        <input
          className={inputClass}
          value={output.label}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </Field>
      <Field label="Show as">
        <select
          className={inputClass}
          value={output.kind}
          onChange={(event) =>
            patch({ kind: event.target.value as KernelOutputKind })
          }
        >
          {OUTPUT_CATALOG.map((item) => (
            <option key={item.kind} value={item.kind}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <div className="mb-2 text-xs font-medium">Show these values</div>
        <div className="space-y-1 rounded-lg border p-2">
          {candidates.map((candidate) => (
            <label
              key={candidate.key}
              className="flex items-center gap-2 rounded px-1 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={output.visibleKeys.includes(candidate.key)}
                onChange={(event) =>
                  patch({
                    visibleKeys: event.target.checked
                      ? [...new Set([...output.visibleKeys, candidate.key])]
                      : output.visibleKeys.filter(
                          (key) => key !== candidate.key,
                        ),
                  })
                }
              />
              {candidate.label}
            </label>
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-muted/10 p-4 text-xs leading-relaxed text-muted-foreground">
        Who can see the result is resolved from assignment, role and
        organization relationships; it is not a phone-builder setting.
      </div>
    </div>
  );
}

function OutputInspector({
  kernel,
  possibility,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  possibility: Extract<KernelPossibility, { type: "output" }>;
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  const output = possibility.output;
  const candidates = [
    ...kernel.possibilities
      .filter(
        (item): item is Extract<KernelPossibility, { type: "capture" }> =>
          item.type === "capture",
      )
      .map((item) => ({
        key: item.capture.storeAs ?? item.capture.id,
        label: item.capture.label,
      })),
    ...kernel.runtimeWorld.contexts.map((item) => ({
      key: item.id,
      label: item.label,
    })),
  ];
  function patch(patchOutput: Partial<KernelOutput>) {
    onChange(
      updatePossibility(kernel, possibility.id, (item) =>
        item.type === "output"
          ? { ...item, output: { ...item.output, ...patchOutput } }
          : item,
      ),
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{output.label}</div>
          <div className="text-xs text-muted-foreground">
            Show · {humanize(output.kind)}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <SectionTitle
        icon={SquarePen}
        title="Look"
        description="How the result appears."
      />
      <Field label="Label">
        <input
          className={inputClass}
          value={output.label}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </Field>
      <Field label="Show as">
        <select
          className={inputClass}
          value={output.kind}
          onChange={(event) =>
            patch({ kind: event.target.value as KernelOutputKind })
          }
        >
          {OUTPUT_CATALOG.map((item) => (
            <option key={item.kind} value={item.kind}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <SectionTitle
        icon={Settings2}
        title="Data"
        description="Who sees it and what is visible."
      />
      <div className="space-y-1">
        {kernel.runtimeWorld.actors.map((actor) => (
          <label
            key={actor.id}
            className="flex items-center gap-2 rounded-lg border p-2 text-sm"
          >
            <input
              type="checkbox"
              checked={output.actorIds.includes(actor.id)}
              onChange={(event) =>
                patch({
                  actorIds: event.target.checked
                    ? [...new Set([...output.actorIds, actor.id])]
                    : output.actorIds.filter((id) => id !== actor.id),
                })
              }
            />
            {actor.label}
          </label>
        ))}
      </div>
      <div className="max-h-52 space-y-1 overflow-auto rounded-lg border p-2">
        {candidates.map((candidate) => (
          <label
            key={candidate.key}
            className="flex items-center gap-2 rounded px-1 py-1.5 text-sm"
          >
            <input
              type="checkbox"
              checked={output.visibleKeys.includes(candidate.key)}
              onChange={(event) =>
                patch({
                  visibleKeys: event.target.checked
                    ? [...new Set([...output.visibleKeys, candidate.key])]
                    : output.visibleKeys.filter((key) => key !== candidate.key),
                })
              }
            />
            {candidate.label}
          </label>
        ))}
      </div>
      {output.kind === "notification" && (
        <>
          <SectionTitle
            icon={BellRing}
            title="Native notification"
            description="Push, local, ongoing or Live Activity where supported."
          />
          <Field label="Behavior">
            <select
              className={inputClass}
              value={
                configString(output.config, "nativeCapability") ||
                "push_notification"
              }
              onChange={(event) =>
                patch({
                  config: {
                    ...output.config,
                    nativeCapability: event.target.value,
                  },
                })
              }
            >
              <option value="push_notification">Push notification</option>
              <option value="local_notification">Local notification</option>
              <option value="ongoing_notification">
                Ongoing / persistent status
              </option>
              <option value="live_activity">
                Live Activity / ongoing status
              </option>
            </select>
          </Field>
          <Field label="Text">
            <input
              className={inputClass}
              value={configString(output.config, "text")}
              onChange={(event) =>
                patch({
                  config: { ...output.config, text: event.target.value },
                })
              }
            />
          </Field>
        </>
      )}
    </div>
  );
}

const CONTEXT_SOURCE_LABELS: Array<{
  source: KernelContextSource;
  label: string;
}> = [
  { source: "current_user", label: "Current employee" },
  { source: "current_manager", label: "Reporting manager" },
  { source: "current_device", label: "Current device" },
  { source: "organization", label: "Organization / department" },
  { source: "current_time", label: "Current date / time" },
  { source: "current_location", label: "Current location" },
  { source: "record", label: "Current record" },
  { source: "relationship", label: "Relationship" },
  { source: "history", label: "Previous / historical data" },
  { source: "session", label: "Current session / route" },
  { source: "query", label: "Query result" },
  { source: "object", label: "Selected object / entity" },
  { source: "external", label: "External system" },
  { source: "literal", label: "Fixed / configured value" },
  { source: "company_setting", label: "Company setting" },
  { source: "native", label: "Native phone value" },
];

function ContextInspector({
  kernel,
  context,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  context: KernelContext;
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  function patch(patchContext: Partial<KernelContext>) {
    onChange({
      ...kernel,
      runtimeWorld: {
        ...kernel.runtimeWorld,
        contexts: kernel.runtimeWorld.contexts.map((item) =>
          item.id === context.id ? { ...item, ...patchContext } : item,
        ),
      },
    });
  }
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{context.label}</div>
          <div className="text-xs text-muted-foreground">App information</div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <SectionTitle
        icon={Settings2}
        title="Data"
        description="Available to every block and rule."
      />
      <Field label="Name">
        <input
          className={inputClass}
          value={context.label}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </Field>
      <Field label="Get value from">
        <select
          className={inputClass}
          value={context.source}
          onChange={(event) =>
            patch({
              source: event.target.value as KernelContextSource,
              value:
                event.target.value === "literal"
                  ? (context.value ?? "")
                  : undefined,
            })
          }
        >
          {CONTEXT_SOURCE_LABELS.map((item) => (
            <option key={item.source} value={item.source}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      {context.source === "literal" && (
        <>
          <Field label="Type">
            <select
              className={inputClass}
              value={configString(context.config ?? {}, "valueType") || "text"}
              onChange={(event) =>
                patch({
                  config: {
                    ...(context.config ?? {}),
                    valueType: event.target.value,
                    businessSetting: true,
                  },
                })
              }
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="amount">Amount</option>
              <option value="time">Time</option>
              <option value="date">Date</option>
              <option value="boolean">Yes / No</option>
            </select>
          </Field>
          <Field label="Value">
            <input
              className={inputClass}
              type={
                configString(context.config ?? {}, "valueType") === "time"
                  ? "time"
                  : "text"
              }
              value={String(context.value ?? "")}
              onChange={(event) =>
                patch({ value: parseLiteral(event.target.value) })
              }
              placeholder="09:00 / 30 / 50"
            />
          </Field>
        </>
      )}
      {context.source === "company_setting" && (
        <Field label="Company setting key">
          <input
            className={inputClass}
            value={context.sourceKey ?? ""}
            onChange={(event) => patch({ sourceKey: event.target.value })}
            placeholder="attendance.shift_start"
          />
        </Field>
      )}
      {[
        "query",
        "external",
        "organization",
        "relationship",
        "object",
        "record",
        "history",
        "session",
        "native",
      ].includes(context.source) && (
        <Field label="Source / query / relationship key">
          <input
            className={inputClass}
            value={context.sourceKey ?? ""}
            onChange={(event) => patch({ sourceKey: event.target.value })}
          />
        </Field>
      )}
      <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={context.mutable}
          onChange={(event) => patch({ mutable: event.target.checked })}
        />
        May change while this Responsibility runs
      </label>
    </div>
  );
}

function StateInspector({
  kernel,
  state,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  state: KernelState;
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  function patch(patchState: Partial<KernelState>) {
    const next = clone(kernel);
    if (patchState.initial === true) {
      for (const item of next.runtimeWorld.states) item.initial = false;
    }
    next.runtimeWorld.states = next.runtimeWorld.states.map((item) =>
      item.id === state.id ? { ...item, ...patchState } : item,
    );
    onChange(next);
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{state.label}</div>
          <div className="text-xs text-muted-foreground">
            State · {state.dimension}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <SectionTitle
        icon={Zap}
        title="State"
        description="Actions and rules can use it."
      />
      <Field label="Name">
        <input
          className={inputClass}
          value={state.label}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </Field>
      <Field label="Dimension">
        <input
          className={inputClass}
          value={state.dimension}
          onChange={(event) =>
            patch({ dimension: normalizeKey(event.target.value) || "process" })
          }
        />
      </Field>
      <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={state.initial === true}
          onChange={(event) => patch({ initial: event.target.checked })}
        />
        Starts here
      </label>
      <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          checked={state.terminal === true}
          onChange={(event) => patch({ terminal: event.target.checked })}
        />
        Finished / terminal state
      </label>
    </div>
  );
}

function ActorInspector({
  kernel,
  actor,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  actor: KernelActor;
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  function patch(patchActor: Partial<KernelActor>) {
    onChange({
      ...kernel,
      runtimeWorld: {
        ...kernel.runtimeWorld,
        actors: kernel.runtimeWorld.actors.map((item) =>
          item.id === actor.id ? { ...item, ...patchActor } : item,
        ),
      },
    });
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{actor.label}</div>
          <div className="text-xs text-muted-foreground">
            Person / system actor
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <SectionTitle
        icon={UserRound}
        title="Who"
        description="How BRIXTA finds this person at runtime."
      />
      <Field label="Name">
        <input
          className={inputClass}
          value={actor.label}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </Field>
      <Field label="Resolve from">
        <select
          className={inputClass}
          value={actor.resolver.kind}
          onChange={(event) => {
            const kind = event.target.value;
            if (kind === "current_user")
              patch({ resolver: { kind: "current_user" } });
            else if (kind === "system") patch({ resolver: { kind: "system" } });
            else if (kind === "record_creator")
              patch({ resolver: { kind: "record_creator" } });
            else if (kind === "manager_of")
              patch({
                resolver: {
                  kind: "manager_of",
                  value: { kind: "actor", key: "current_employee" },
                },
              });
            else if (kind === "role") patch({ resolver: { kind: "role" } });
          }}
        >
          <option value="current_user">Current employee</option>
          <option value="manager_of">Reporting manager</option>
          <option value="record_creator">Record creator</option>
          <option value="role">Role</option>
          <option value="system">System</option>
        </select>
      </Field>
    </div>
  );
}

function AutomaticAppInspector({
  kernel,
  onChange,
}: {
  kernel: ResponsibilityKernel;
  onChange: (kernel: ResponsibilityKernel) => void;
}) {
  const visualDocument = kernel.metadata.ui?.uiDocument;

  const visualTheme: ResponsibilityUiTheme = visualDocument?.theme ?? {
    scope: "inherit",
    base: "brixta_editorial_v1",
    tokens: {},
  };

  function patchVisualTheme(patch: Partial<ResponsibilityUiTheme>) {
    if (!visualDocument) {
      return;
    }

    const nextTheme: ResponsibilityUiTheme = {
      ...visualTheme,
      ...patch,

      tokens: patch.tokens
        ? {
            ...visualTheme.tokens,
            ...patch.tokens,

            colors: patch.tokens.colors
              ? {
                  ...visualTheme.tokens?.colors,
                  ...patch.tokens.colors,
                }
              : visualTheme.tokens?.colors,

            typography: patch.tokens.typography
              ? {
                  ...visualTheme.tokens?.typography,
                  ...patch.tokens.typography,
                }
              : visualTheme.tokens?.typography,
          }
        : visualTheme.tokens,
    };

    onChange({
      ...kernel,

      metadata: {
        ...kernel.metadata,

        ui: {
          ...(kernel.metadata.ui ?? {
            layout: [],
          }),

          uiDocument: {
            ...visualDocument,
            theme: nextTheme,
          },
        },
      },
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="font-semibold">App settings</div>
        <div className="text-xs text-muted-foreground">
          Name the employee app. BRIXTA generates the runtime mechanics.
        </div>
      </div>
      <Field label="App title">
        <input
          className={inputClass}
          value={kernel.metadata.ui?.title ?? ""}
          onChange={(event) =>
            onChange({
              ...kernel,
              metadata: {
                ...kernel.metadata,
                ui: {
                  ...(kernel.metadata.ui ?? { layout: [] }),
                  title: event.target.value,
                },
              },
            })
          }
        />
      </Field>
      <Field label="Description">
        <textarea
          className={textareaClass}
          rows={3}
          value={kernel.metadata.ui?.description ?? ""}
          onChange={(event) =>
            onChange({
              ...kernel,
              metadata: {
                ...kernel.metadata,
                ui: {
                  ...(kernel.metadata.ui ?? { layout: [] }),
                  description: event.target.value,
                },
              },
            })
          }
        />
      </Field>

      {visualDocument && (
        <div className="rounded-xl border p-4">
          {/* BRIXTA RESPONSIBILITY VISUAL THEME */}
          <div className="text-sm font-semibold">Visual style</div>

          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The installed BRIXTA Flutter design remains the base. Override only
            this Responsibility when needed.
          </div>

          <div className="mt-4 space-y-3">
            <Field label="Theme scope">
              <select
                className={inputClass}
                value={visualTheme.scope}
                onChange={(event) =>
                  patchVisualTheme({
                    scope: event.target.value as ResponsibilityUiTheme["scope"],
                  })
                }
              >
                <option value="inherit">Inherit BRIXTA app</option>

                <option value="responsibility">Responsibility theme</option>

                <option value="immersive">Immersive full screen</option>
              </select>
            </Field>

            {visualTheme.scope !== "inherit" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Primary">
                    <input
                      className={inputClass}
                      type="color"
                      value={visualTheme.tokens?.colors?.primary ?? "#3D7068"}
                      onChange={(event) =>
                        patchVisualTheme({
                          tokens: {
                            colors: {
                              primary: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </Field>

                  <Field label="Background">
                    <input
                      className={inputClass}
                      type="color"
                      value={
                        visualTheme.tokens?.colors?.background ?? "#F7F6F2"
                      }
                      onChange={(event) =>
                        patchVisualTheme({
                          tokens: {
                            colors: {
                              background: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </Field>

                  <Field label="Surface">
                    <input
                      className={inputClass}
                      type="color"
                      value={visualTheme.tokens?.colors?.surface ?? "#FBFAF6"}
                      onChange={(event) =>
                        patchVisualTheme({
                          tokens: {
                            colors: {
                              surface: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </Field>

                  <Field label="Foreground">
                    <input
                      className={inputClass}
                      type="color"
                      value={
                        visualTheme.tokens?.colors?.foreground ?? "#1C1C1C"
                      }
                      onChange={(event) =>
                        patchVisualTheme({
                          tokens: {
                            colors: {
                              foreground: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </Field>
                </div>

                <Field label="Typography scale">
                  <input
                    className={inputClass}
                    type="number"
                    min={0.75}
                    max={1.6}
                    step={0.05}
                    value={visualTheme.tokens?.typography?.scale ?? 1}
                    onChange={(event) =>
                      patchVisualTheme({
                        tokens: {
                          typography: {
                            scale: Math.max(
                              0.75,
                              Math.min(1.6, Number(event.target.value) || 1),
                            ),
                          },
                        },
                      })
                    }
                  />
                </Field>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border p-4">
        <div className="text-sm font-semibold">Saved work</div>
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Control whether employees can review entries they have already
          submitted.
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={kernel.metadata.ui?.employeeOwnHistoryVisible !== false}
            onChange={(event) =>
              onChange({
                ...kernel,
                metadata: {
                  ...kernel.metadata,
                  ui: {
                    ...(kernel.metadata.ui ?? { layout: [] }),
                    employeeOwnHistoryVisible: event.target.checked,
                  },
                },
              })
            }
          />
          <div>
            <div className="text-sm font-medium">
              Let employees see their own saved entries
            </div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Each employee only sees their own records. For example, a Junior
              Executive can review their own attendance, not another
              employee&apos;s.
            </div>
          </div>
        </label>
      </div>

      <div className="rounded-xl border bg-muted/10 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> App brain · automatic
        </div>
        <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
          State, employee identity, record ownership, manager relationship,
          organization, device/time/location context and action ordering are
          compiler-owned.
        </div>
      </div>
    </div>
  );
}

function AppInspector({
  kernel,
  onChange,
  onAddState,
  onAddActor,
}: {
  kernel: ResponsibilityKernel;
  onChange: (kernel: ResponsibilityKernel) => void;
  onAddState: () => void;
  onAddActor: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="font-semibold">App settings</div>
        <div className="text-xs text-muted-foreground">
          Click any phone block to configure Look, Data, Behavior and Logic.
        </div>
      </div>
      <SectionTitle
        icon={Smartphone}
        title="Look"
        description="Employee-facing app identity."
      />
      <Field label="App title">
        <input
          className={inputClass}
          value={kernel.metadata.ui?.title ?? ""}
          onChange={(event) =>
            onChange({
              ...kernel,
              metadata: {
                ...kernel.metadata,
                ui: {
                  ...(kernel.metadata.ui ?? { layout: [] }),
                  title: event.target.value,
                },
              },
            })
          }
        />
      </Field>
      <Field label="Description">
        <textarea
          className={textareaClass}
          rows={3}
          value={kernel.metadata.ui?.description ?? ""}
          onChange={(event) =>
            onChange({
              ...kernel,
              metadata: {
                ...kernel.metadata,
                ui: {
                  ...(kernel.metadata.ui ?? { layout: [] }),
                  description: event.target.value,
                },
              },
            })
          }
        />
      </Field>
      <SectionTitle
        icon={Sparkles}
        title="App brain"
        description="Add people and state without leaving the canvas."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onAddActor}
          className="rounded-lg border p-3 text-left text-sm hover:bg-muted/30"
        >
          + Person / actor
        </button>
        <button
          type="button"
          onClick={onAddState}
          className="rounded-lg border p-3 text-left text-sm hover:bg-muted/30"
        >
          + State
        </button>
      </div>
    </div>
  );
}

type Simulation = {
  actorId: string;
  stateId: string;
  currentTime: string;
  values: Record<string, unknown>;
  contexts: Record<string, unknown>;
  computed: Record<string, unknown>;
  history: string[];
};

function timeToMinutes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const hhmm = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmm) return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()))
    return parsed.getHours() * 60 + parsed.getMinutes();
  return null;
}

function initialSimulation(kernel: ResponsibilityKernel): Simulation {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const contexts: Record<string, unknown> = {};
  for (const context of kernel.runtimeWorld.contexts) {
    if (context.source === "literal") contexts[context.id] = context.value;
    if (context.source === "current_time") contexts[context.id] = currentTime;
    if (context.source === "current_user")
      contexts[context.id] = "Current employee";
    if (context.source === "current_location")
      contexts[context.id] = "Simulated GPS";
    if (context.source === "current_device")
      contexts[context.id] = "This phone";
    if (context.source === "current_manager")
      contexts[context.id] = "Reporting manager";
  }
  return {
    actorId:
      kernel.metadata.ui?.previewActorId ??
      kernel.runtimeWorld.actors[0]?.id ??
      "current_employee",
    stateId: kernel.metadata.ui?.previewStateId ?? initialState(kernel),
    currentTime,
    values: {},
    contexts,
    computed: {},
    history: [],
  };
}

function resolveRef(
  ref: KernelValueRef | undefined,
  simulation: Simulation,
): unknown {
  if (!ref) return undefined;
  if (ref.kind === "literal") return ref.value;
  if (ref.kind === "context") return simulation.contexts[ref.key];
  if (ref.kind === "capture") return simulation.values[ref.key];
  if (ref.kind === "computed") return simulation.computed[ref.key];
  if (ref.kind === "state") return simulation.stateId;
  if (ref.kind === "actor")
    return ref.key === simulation.actorId ? simulation.actorId : ref.key;
  return undefined;
}

function compareValues(
  left: unknown,
  operator: KernelOperator,
  right: unknown,
) {
  if (operator === "exists")
    return left !== undefined && left !== null && left !== "";
  if (operator === "not_exists")
    return left === undefined || left === null || left === "";
  if (operator === "contains") {
    if (Array.isArray(left)) return left.includes(right);
    return String(left ?? "")
      .toLowerCase()
      .includes(String(right ?? "").toLowerCase());
  }
  if (operator === "in") return Array.isArray(right) && right.includes(left);
  if (operator === "between") {
    if (!Array.isArray(right) || right.length < 2) return false;
    const n = Number(left);
    const lo = Number(right[0]);
    const hi = Number(right[1]);
    return (
      Number.isFinite(n) &&
      Number.isFinite(lo) &&
      Number.isFinite(hi) &&
      n >= lo &&
      n <= hi
    );
  }
  const leftNumber = typeof left === "number" ? left : Number(left);
  const rightNumber = typeof right === "number" ? right : Number(right);
  const numeric =
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    String(left ?? "").trim() !== "" &&
    String(right ?? "").trim() !== "";
  const a = numeric ? leftNumber : String(left ?? "");
  const b = numeric ? rightNumber : String(right ?? "");
  if (operator === "eq") return a === b;
  if (operator === "neq") return a !== b;
  if (operator === "gt") return a > b;
  if (operator === "gte") return a >= b;
  if (operator === "lt") return a < b;
  if (operator === "lte") return a <= b;
  return false;
}

function ruleMatches(rule: KernelRule, simulation: Simulation) {
  const results = rule.when.conditions.map((condition) =>
    compareValues(
      resolveRef(condition.left, simulation),
      condition.operator,
      resolveRef(condition.right, simulation),
    ),
  );
  return rule.when.mode === "any"
    ? results.some(Boolean)
    : results.every(Boolean);
}

function applySimulationEffect(
  effect: KernelEffect,
  simulation: Simulation,
  kernel: ResponsibilityKernel,
): Simulation {
  const next: Simulation = {
    ...simulation,
    values: { ...simulation.values },
    contexts: { ...simulation.contexts },
    computed: { ...simulation.computed },
    history: [...simulation.history],
  };
  if (effect.kind === "change_state") {
    const value = resolveRef(effect.value, next);
    if (
      typeof value === "string" &&
      kernel.runtimeWorld.states.some((state) => state.id === value)
    ) {
      next.stateId = value;
    }
    return next;
  }
  if (effect.kind === "set_context" && effect.targetKey) {
    next.contexts[effect.targetKey] = resolveRef(effect.value, next);
    return next;
  }
  if (effect.kind === "set_computed" && effect.targetKey) {
    if (effect.config.operation === "minutes_between") {
      const from = resolveRef(
        effect.config.from as KernelValueRef | undefined,
        next,
      );
      const to = resolveRef(
        effect.config.to as KernelValueRef | undefined,
        next,
      );
      const fromMinutes = timeToMinutes(from);
      const toMinutes = timeToMinutes(to);
      if (fromMinutes !== null && toMinutes !== null) {
        const raw = toMinutes - fromMinutes;
        const clampMin =
          typeof effect.config.clampMin === "number"
            ? effect.config.clampMin
            : -Infinity;
        const clampMax =
          typeof effect.config.clampMax === "number"
            ? effect.config.clampMax
            : Infinity;
        next.computed[effect.targetKey] = Math.min(
          clampMax,
          Math.max(clampMin, raw),
        );
      }
    } else {
      next.computed[effect.targetKey] = resolveRef(effect.value, next);
    }
    return next;
  }
  if (effect.kind === "append_history") {
    const label = configString(effect.config, "label") || "History updated";
    next.history.unshift(label);
    return next;
  }
  if (effect.kind === "notify_actor") {
    const actor =
      kernel.runtimeWorld.actors.find((item) => item.id === effect.actorId)
        ?.label ?? "someone";
    const message =
      configString(effect.config, "message") || `Notification sent to ${actor}`;
    next.history.unshift(`Notify ${actor}: ${message}`);
    return next;
  }
  if (effect.kind === "assign_actor") {
    const actor =
      kernel.runtimeWorld.actors.find((item) => item.id === effect.actorId)
        ?.label ?? "someone";
    next.history.unshift(`Assigned to ${actor}`);
    return next;
  }
  if (
    [
      "create_record",
      "update_record",
      "delete_record",
      "query_data",
      "freeze_data",
      "trigger_action",
      "trigger_responsibility",
    ].includes(effect.kind)
  ) {
    next.history.unshift(
      `${humanize(effect.kind)}${effect.targetKey ? ` · ${effect.targetKey}` : ""}`,
    );
  }
  return next;
}

function PlayPhone({ kernel }: { kernel: ResponsibilityKernel }) {
  const [simulation, setSimulation] = useState<Simulation>(() =>
    initialSimulation(kernel),
  );
  const layout = kernel.metadata.ui?.layout ?? [];

  useEffect(() => setSimulation(initialSimulation(kernel)), [kernel]);

  function setCurrentTime(value: string) {
    setSimulation((current) => {
      const contexts = { ...current.contexts };
      for (const context of kernel.runtimeWorld.contexts) {
        if (context.source === "current_time") contexts[context.id] = value;
      }
      return { ...current, currentTime: value, contexts };
    });
  }

  function setCapture(capture: KernelCapture, value: unknown) {
    setSimulation((current) => ({
      ...current,
      values: { ...current.values, [capture.id]: value },
    }));
  }

  function automaticValue(capture: KernelCapture) {
    const native = configString(capture.config, "nativeCapability");
    if (native.includes("location") || native === "geofence")
      return "Simulated GPS";
    if (native === "battery_level") return 82;
    if (native === "connectivity") return "Online";
    if (native === "biometric_auth") return true;
    if (native === "route_tracker") return "Simulated route";
    return `Simulated ${capture.label}`;
  }

  function execute(action: KernelAction) {
    let working: Simulation = {
      ...simulation,
      values: { ...simulation.values },
      contexts: { ...simulation.contexts },
      computed: { ...simulation.computed },
      history: [...simulation.history],
    };
    const availableState = configString(action.config, "availableState");
    if (availableState && availableState !== working.stateId) {
      working.history.unshift(
        `${action.label} is not available in this state.`,
      );
      setSimulation(working);
      return;
    }
    if (action.actorId && action.actorId !== working.actorId) {
      working.history.unshift(
        `${action.label} is not available to the selected person.`,
      );
      setSimulation(working);
      return;
    }

    const captures = action.captureIds
      .map(
        (id) =>
          kernel.possibilities.find(
            (item): item is Extract<KernelPossibility, { type: "capture" }> =>
              item.type === "capture" && item.capture.id === id,
          )?.capture,
      )
      .filter((item): item is KernelCapture => Boolean(item));

    for (const capture of captures) {
      if (
        (working.values[capture.id] === undefined ||
          working.values[capture.id] === "") &&
        configBoolean(capture.config, "automatic")
      ) {
        working.values[capture.id] = automaticValue(capture);
      }
    }
    const missing = captures
      .filter((capture) => capture.required === true)
      .filter(
        (capture) =>
          working.values[capture.id] === undefined ||
          working.values[capture.id] === null ||
          working.values[capture.id] === "",
      );
    if (missing.length) {
      working.history.unshift(
        `Before ${action.label}: complete ${missing.map((item) => item.label).join(", ")}.`,
      );
      setSimulation(working);
      return;
    }

    const contextIds = Array.isArray(action.config.captureContext)
      ? action.config.captureContext.map(String)
      : [];
    for (const contextId of contextIds) {
      const context = kernel.runtimeWorld.contexts.find(
        (item) => item.id === contextId,
      );
      if (!context) continue;
      if (context.source === "current_time")
        working.contexts[context.id] = working.currentTime;
      if (context.source === "current_location")
        working.contexts[context.id] = "Simulated GPS";
      if (context.source === "current_device")
        working.contexts[context.id] = "This phone";
      if (context.source === "current_user")
        working.contexts[context.id] = "Current employee";
    }

    const eventIds = actionEventIds(kernel, action.id);
    const rules = kernel.rules
      .filter(
        (rule) =>
          rule.enabled && rule.eventId && eventIds.includes(rule.eventId),
      )
      .sort((a, b) => a.priority - b.priority);
    if (rules.length) {
      for (const rule of rules) {
        if (!ruleMatches(rule, working)) continue;
        for (const effect of rule.effects)
          working = applySimulationEffect(effect, working, kernel);
      }
    }
    const resultingState = configString(action.config, "resultingState");
    if (resultingState) working.stateId = resultingState;
    working.history.unshift(
      `${action.label} · simulated at ${working.currentTime}`,
    );
    setSimulation(working);
  }

  function renderCapture(capture: KernelCapture) {
    const value = simulation.values[capture.id] ?? "";
    const automatic = configBoolean(capture.config, "automatic");
    const native = configString(capture.config, "nativeCapability");
    if (automatic) {
      return (
        <button
          type="button"
          onClick={() => setCapture(capture, automaticValue(capture))}
          className="flex w-full items-center justify-between rounded-lg border bg-muted/10 px-3 py-2 text-left text-xs"
        >
          <span>
            {value
              ? String(value)
              : `Auto from phone · ${humanize(native || capture.kind)}`}
          </span>
          <Pill>{value ? "Ready" : "Simulate"}</Pill>
        </button>
      );
    }
    if (capture.kind === "choice") {
      const options = Array.isArray(capture.config.options)
        ? capture.config.options.map(String)
        : ["Option 1", "Option 2"];
      return (
        <select
          className={inputClass}
          value={String(value)}
          onChange={(event) => setCapture(capture, event.target.value)}
        >
          <option value="">Choose...</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    if (capture.kind === "boolean") {
      return (
        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => setCapture(capture, event.target.checked)}
          />{" "}
          Yes
        </label>
      );
    }
    if (capture.kind === "long_text") {
      return (
        <textarea
          className={textareaClass}
          rows={3}
          value={String(value)}
          onChange={(event) => setCapture(capture, event.target.value)}
        />
      );
    }
    if (["number", "amount", "rating", "timer"].includes(capture.kind)) {
      return (
        <input
          className={inputClass}
          type="number"
          value={String(value)}
          onChange={(event) =>
            setCapture(capture, parseLiteral(event.target.value))
          }
        />
      );
    }
    if (capture.kind === "date") {
      return (
        <input
          className={inputClass}
          type="date"
          value={String(value)}
          onChange={(event) => setCapture(capture, event.target.value)}
        />
      );
    }
    if (capture.kind === "datetime") {
      return (
        <input
          className={inputClass}
          type="datetime-local"
          value={String(value)}
          onChange={(event) => setCapture(capture, event.target.value)}
        />
      );
    }
    if (
      [
        "person_reference",
        "entity_reference",
        "responsibility_reference",
      ].includes(capture.kind)
    ) {
      return (
        <select
          className={inputClass}
          value={String(value)}
          onChange={(event) => setCapture(capture, event.target.value)}
        >
          <option value="">Search/select...</option>
          <option value="demo_1">Sample record 1</option>
          <option value="demo_2">Sample record 2</option>
        </select>
      );
    }
    if (
      [
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
        "repeating_section",
      ].includes(capture.kind)
    ) {
      return (
        <button
          type="button"
          onClick={() => setCapture(capture, automaticValue(capture))}
          className="flex w-full items-center justify-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted/30"
        >
          {value ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {value ? `${capture.label} ready` : `Simulate ${capture.label}`}
        </button>
      );
    }
    return (
      <input
        className={inputClass}
        value={String(value)}
        onChange={(event) => setCapture(capture, event.target.value)}
      />
    );
  }

  const stateLabel =
    kernel.runtimeWorld.states.find((state) => state.id === simulation.stateId)
      ?.label ?? simulation.stateId;
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="Preview as">
            <select
              className={inputClass}
              value={simulation.actorId}
              onChange={(event) =>
                setSimulation((current) => ({
                  ...current,
                  actorId: event.target.value,
                }))
              }
            >
              {kernel.runtimeWorld.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Simulated time">
            <input
              className={inputClass}
              type="time"
              value={simulation.currentTime}
              onChange={(event) => setCurrentTime(event.target.value)}
            />
          </Field>
        </div>
        <div className="mx-auto max-w-[430px] rounded-[44px] border-[7px] border-foreground/90 bg-background p-5 shadow-sm">
          <div className="mx-auto mb-5 h-1.5 w-14 rounded-full bg-muted-foreground/40" />
          <div className="text-lg font-semibold">
            {kernel.metadata.ui?.title || "Employee app"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {stateLabel} · {simulation.currentTime}
          </div>
          <div className="mt-5 space-y-4">
            {layout
              .map((id) => kernel.possibilities.find((item) => item.id === id))
              .filter((item): item is KernelPossibility => Boolean(item))
              .map((item) => {
                if (item.type === "capture") {
                  return (
                    <div key={item.id}>
                      <div className="mb-1.5 text-sm font-medium">
                        {item.capture.label}
                        {item.capture.required ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </div>
                      {renderCapture(item.capture)}
                    </div>
                  );
                }
                if (item.type === "action") {
                  const requiredState = configString(
                    item.action.config,
                    "availableState",
                  );
                  const visible =
                    (!item.action.actorId ||
                      item.action.actorId === simulation.actorId) &&
                    (!requiredState || requiredState === simulation.stateId);
                  if (!visible) return null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => execute(item.action)}
                      className={cx(
                        "w-full rounded-xl px-4 py-3 text-sm font-semibold",
                        ["reject", "delete", "cancel"].includes(
                          item.action.kind,
                        )
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {item.action.label}
                    </button>
                  );
                }
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border bg-muted/10 p-3"
                  >
                    <div className="text-xs font-medium">
                      {item.output.label}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {humanize(item.output.kind)} output
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
      <Panel>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">Live simulation</div>
            <div className="text-xs text-muted-foreground">
              Change time to test late deductions and other rules.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSimulation(initialSimulation(kernel))}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">
              State
            </div>
            <div className="mt-1 text-sm font-semibold">{stateLabel}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">
              Time
            </div>
            <div className="mt-1 text-sm font-semibold">
              {simulation.currentTime}
            </div>
          </div>
        </div>
        {Object.keys(simulation.computed).length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold">Calculated values</div>
            <div className="mt-2 space-y-2">
              {Object.entries(simulation.computed).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                >
                  <span>{humanize(key)}</span>
                  <strong>{String(value)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4">
          <div className="text-xs font-semibold">Event log</div>
          <div className="mt-2 space-y-2">
            {simulation.history.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                Use the phone. Rules and effects run locally in this preview.
              </div>
            ) : (
              simulation.history.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-lg border p-2 text-xs"
                >
                  {item}
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default function ResponsibilityAppBuilder({
  responsibilityId,
  responsibilityTitle,
  kernel,
  dataSources,
  roles,
  employees,
  departments,
  onChange,
}: {
  responsibilityId: number | string;
  responsibilityTitle: string;
  kernel: ResponsibilityKernel;
  dataSources: PlatformDataSource[];
  roles: Role[];
  employees: Employee[];
  departments: Department[];
  onChange: (kernel: ResponsibilityKernel) => void;
}) {
  const [selection, setSelection] = useState<Selection>({ kind: "app" });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [play, setPlay] = useState(false);
  const [showStarters, setShowStarters] = useState(false);

  /*
   * Generate-with-AI belongs to the APP BUILDER only.
   *
   * Pixel Logic remains a separate editor / separate AI contract.
   */
  const [aiOpen, setAiOpen] = useState(false);

  // BRIXTA_AI_USER_BRIEF_V11
  const [aiUserBrief, setAiUserBrief] =
    useState("");

  const [
    aiGenerationMode,
    setAiGenerationMode,
  ] = useState<BuilderAiMode>(
    "create",
  );

  const [aiImportText, setAiImportText] = useState("");
  const [aiImportResult, setAiImportResult] =
    useState<ResponsibilityAppBuilderAIImportResult | null>(null);
  const [aiIssues, setAiIssues] = useState<string[]>([]);
  const [aiMessage, setAiMessage] = useState("");

  /*
   * Future blocks registered in
   * responsibility-app-builder-block-registry.ts
   * become normal NativeBlock entries here.
   */
  const extensionNativeBlocks = useMemo<NativeBlock[]>(
    () =>
      RESPONSIBILITY_APP_BUILDER_BLOCKS.map((block) => ({
        key: block.key,
        label: block.label,
        description: block.description,
        kind: block.kind,
        keywords: block.keywords,
        config: {
          ...block.config,

          ...(block.runtime
            ? {
                runtimeSupport: block.runtime,
              }
            : {}),

          ...(block.compliance
            ? {
                compliance: block.compliance,
              }
            : {}),

          ...(block.resources
            ? {
                resourceProfile: block.resources,
              }
            : {}),
        },

        icon: captureIcon(
          block.kind,
          typeof block.config.nativeCapability === "string"
            ? block.config.nativeCapability
            : block.key,
        ),
      })),
    [],
  );

  const allNativeBlocks = useMemo(
    () => [...NATIVE_BLOCKS, ...extensionNativeBlocks],
    [extensionNativeBlocks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const layout = kernel.metadata.ui?.layout ?? [];

  /*
   * VISUAL DOCUMENT IS AN ADDITIONAL LAYER.
   *
   * Existing builder layout/panels remain untouched so current muscle-memory
   * UX survives.
   */
  const visualBlocks = kernel.metadata.ui?.uiDocument?.blocks ?? [];

  const allDiscovery = useMemo(
    () => discoveryItems(allNativeBlocks),
    [allNativeBlocks],
  );
  const canvasSignals = useMemo(
    () =>
      kernel.possibilities
        .flatMap((item) =>
          item.type === "capture"
            ? [
                item.capture.label,
                item.capture.kind,
                configString(item.capture.config, "nativeCapability"),
              ]
            : item.type === "action"
              ? [item.action.label, item.action.kind]
              : [item.output.label, item.output.kind],
        )
        .filter(Boolean),
    [kernel],
  );
  const rankedDiscovery = useMemo(
    () => rankIntentCandidates(allDiscovery, query, canvasSignals),
    [allDiscovery, query, canvasSignals],
  );
  const results = useMemo(() => {
    const base = rankedDiscovery
      .slice(0, query.trim() ? 18 : 14)
      .map((entry) => entry.item);
    if (!query.trim()) return base;

    const composition = suggestRecipeComposition(rankedDiscovery);
    if (composition.length < 2) return base;
    const recipes = composition
      .map((key) => SMART_RECIPES.find((recipe) => recipe.key === key))
      .filter((recipe): recipe is SmartRecipe => Boolean(recipe));
    if (recipes.length < 2) return base;

    const generated: DiscoverItem = {
      id: `recipe:generated:${composition.join("+")}`,
      kind: "recipe",
      title: "Build this setup",
      description: `BRIXTA combined ${recipes.map((recipe) => recipe.label).join(" + ")} from your request.`,
      keywords: recipes.flatMap((recipe) => recipe.keywords),
      icon: WandSparkles,
      group: "Recommended",
      payload: `__compose__:${composition.join(",")}`,
    };

    return [
      generated,
      ...base.filter((item) => !composition.includes(item.payload)),
    ];
  }, [rankedDiscovery, query]);
  const playKernel = useMemo(
    () => compileResponsibilitySemantics(kernel),
    [kernel],
  );

  function setLayout(nextLayout: string[]) {
    onChange({
      ...kernel,
      metadata: {
        ...kernel.metadata,
        ui: { ...(kernel.metadata.ui ?? { layout: [] }), layout: nextLayout },
      },
    });
  }

  function aiNativeContext(): AppBuilderNativeBlockContext[] {
    return allNativeBlocks.map((block) => {
      const config = block.config ?? {};

      return {
        key: block.key,

        label: block.label,

        description: block.description,

        kind: block.kind,

        keywords: block.keywords,

        config,

        runtime:
          config.runtimeSupport &&
          typeof config.runtimeSupport === "object" &&
          !Array.isArray(config.runtimeSupport)
            ? (config.runtimeSupport as Record<string, unknown>)
            : undefined,

        compliance:
          config.compliance &&
          typeof config.compliance === "object" &&
          !Array.isArray(config.compliance)
            ? (config.compliance as Record<string, unknown>)
            : undefined,

        resources:
          config.resourceProfile &&
          typeof config.resourceProfile === "object" &&
          !Array.isArray(config.resourceProfile)
            ? (config.resourceProfile as Record<string, unknown>)
            : undefined,
      };
    });
  }

  async function copyAppBuilderAIContext() {
    try {
      const context = buildResponsibilityAppBuilderAIContext({
        responsibilityId,
        responsibilityTitle,
        kernel,
        roles,
        employees,
        departments,
        dataSources,
        nativeBlocks: aiNativeContext(),
      });

      // BRIXTA_AI_INTENT_CLIPBOARD_V11
      await navigator.clipboard.writeText(
        augmentBuilderAiContext(
          context,
          {
            kind: "app",
            mode: aiGenerationMode,
            userRequest: aiUserBrief,
            contextItems: [
            "Current Responsibility App",
            "Current UI document",
            "Existing captures",
            "Existing actions",
            "Existing outputs",
            "Existing roles",
            "Existing employees",
            "Existing departments",
            "Existing Data Sources",
            "Registered visual blocks",
            "Registered native phone capabilities",
          ],
          },
        ),
      );

      setAiMessage(
        "App Builder AI context copied. Paste it into ChatGPT, describe the phone/app you want, then paste the returned JSON here.",
      );
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? error.message
          : "Unable to copy App Builder AI context.",
      );
    }
  }

  function validateAppBuilderAI() {
    try {
      const result = parseResponsibilityAppBuilderAIImport(aiImportText);

      const issues = validateResponsibilityAppBuilderAIImport(
        kernel,
        result,
        aiNativeContext(),
      );

      if (String(result.responsibilityId) !== String(responsibilityId)) {
        issues.push(
          `AI result targets Responsibility ${String(result.responsibilityId)}, not ${String(responsibilityId)}.`,
        );
      }

      const currentFingerprint =
        responsibilityAppBuilderRegistryFingerprint(aiNativeContext());

      if (result.blockRegistryFingerprint !== currentFingerprint) {
        issues.push(
          `App Builder registry changed. AI used ${result.blockRegistryFingerprint}, current registry is ${currentFingerprint}. Copy a fresh AI Context and regenerate.`,
        );
      }

      setAiImportResult(result);

      setAiIssues(issues);

      setAiMessage(
        issues.length > 0
          ? `AI App parsed, but ${issues.length} blocking issue${issues.length === 1 ? "" : "s"} must be fixed.`
          : "AI App is valid. Review the summary, then Generate App.",
      );
    } catch (error) {
      setAiImportResult(null);

      setAiIssues([
        error instanceof Error
          ? error.message
          : "Unable to parse AI-generated App Builder JSON.",
      ]);

      setAiMessage("AI App could not be validated.");
    }
  }

  function applyAppBuilderAI() {
    if (!aiImportResult || aiIssues.length > 0) {
      return;
    }

    const next = applyResponsibilityAppBuilderAIImport(kernel, aiImportResult);

    onChange(next);

    setSelection({
      kind: "app",
    });

    setAiOpen(false);

    setAiMessage(
      "AI-generated App Builder blocks were placed on the Responsibility canvas. Review them and save the draft.",
    );
  }

  function addVisual(type: ResponsibilityUiBlockType, index?: number) {
    const result = addVisualBlock(kernel, type, index);

    onChange(result.kernel);

    setSelection({
      kind: "ui",
      id: result.id,
    });
  }

  function addCapture(kind: KernelCapture["kind"], index?: number) {
    const catalog = CAPTURE_CATALOG.find((item) => item.kind === kind);
    const captureId = randomKey(kind);
    const possibilityId = randomKey("possibility");
    const capture: KernelCapture = {
      id: captureId,
      label: catalog?.label ?? humanize(kind),
      kind,
      required: false,
      storeAs: normalizeKey(catalog?.label ?? kind),
      config: kind === "choice" ? { options: ["Option 1", "Option 2"] } : {},
    };
    const next = clone(kernel);
    next.possibilities.push({ id: possibilityId, type: "capture", capture });
    const nextLayout = [...(next.metadata.ui?.layout ?? [])];
    nextLayout.splice(index ?? nextLayout.length, 0, possibilityId);
    next.metadata.ui = {
      ...(next.metadata.ui ?? { layout: [] }),
      layout: nextLayout,
    };
    // BRIXTA_FUNCTIONAL_VISUAL_DEFAULT_UX_V11
    //
    // If this Responsibility already has a designed uiDocument,
    // "+ Dealer", "+ Photo", "+ Number", etc. means:
    //
    //     CREATE THE CAPTURE
    //             +
    //     PLACE THE REAL INPUT
    //
    // not "create hidden functionality and make the admin wire it later".
    if (next.metadata.ui?.uiDocument) {
      const visual =
        addVisualCaptureBlock(
          next,
          captureId,
        );

      onChange(
        visual.kernel,
      );

      setSelection({
        kind: "ui",
        id: visual.id,
      });

      return;
    }

    onChange(next);
    setSelection({ kind: "possibility", id: possibilityId });
  }

  function addNative(key: string, index?: number) {
    const native = allNativeBlocks.find((item) => item.key === key);
    if (!native) return;
    const captureId = randomKey(native.key);
    const possibilityId = randomKey("possibility");
    const capture: KernelCapture = {
      id: captureId,
      label: native.label,
      kind: native.kind,
      required: false,
      storeAs: normalizeKey(native.label),
      config: clone(native.config),
    };
    const next = clone(kernel);
    next.possibilities.push({ id: possibilityId, type: "capture", capture });
    const nextLayout = [...(next.metadata.ui?.layout ?? [])];
    nextLayout.splice(index ?? nextLayout.length, 0, possibilityId);
    next.metadata.ui = {
      ...(next.metadata.ui ?? { layout: [] }),
      layout: nextLayout,
    };
    if (next.metadata.ui?.uiDocument) {
      const visual =
        addVisualCaptureBlock(
          next,
          captureId,
        );

      onChange(
        visual.kernel,
      );

      setSelection({
        kind: "ui",
        id: visual.id,
      });

      return;
    }

    onChange(next);
    setSelection({ kind: "possibility", id: possibilityId });
  }

  function addAction(kind: KernelAction["kind"], index?: number) {
    const catalog = ACTION_CATALOG.find((item) => item.kind === kind);
    const actionId = randomKey(kind);
    const possibilityId = randomKey("possibility");
    const action: KernelAction = {
      id: actionId,
      label: catalog?.label ?? humanize(kind),
      kind,
      actorId: kernel.runtimeWorld.actors[0]?.id,
      objectId: kernel.runtimeWorld.objects[0]?.id,
      captureIds: [],
      config: {},
    };
    let next = clone(kernel);
    next.possibilities.push({ id: possibilityId, type: "action", action });
    const nextLayout = [...(next.metadata.ui?.layout ?? [])];
    nextLayout.splice(index ?? nextLayout.length, 0, possibilityId);
    next.metadata.ui = {
      ...(next.metadata.ui ?? { layout: [] }),
      layout: nextLayout,
    };
    next = ensureBaseRule(next, action).kernel;

    if (next.metadata.ui?.uiDocument) {
      const visual =
        addVisualActionBlock(
          next,
          actionId,
        );

      onChange(
        visual.kernel,
      );

      setSelection({
        kind: "ui",
        id: visual.id,
      });

      return;
    }

    onChange(next);
    setSelection({ kind: "possibility", id: possibilityId });
  }

  function addOutput(kind: KernelOutputKind, index?: number) {
    const catalog = OUTPUT_CATALOG.find((item) => item.kind === kind);
    const outputId = randomKey(kind);
    const possibilityId = randomKey("possibility");
    const output: KernelOutput = {
      id: outputId,
      label: catalog?.label ?? humanize(kind),
      kind,
      actorIds: kernel.runtimeWorld.actors[0]?.id
        ? [kernel.runtimeWorld.actors[0].id]
        : [],
      stateIds: [],
      visibleKeys: [],
      config: {},
    };
    const next = clone(kernel);
    next.possibilities.push({ id: possibilityId, type: "output", output });
    const nextLayout = [...(next.metadata.ui?.layout ?? [])];
    nextLayout.splice(index ?? nextLayout.length, 0, possibilityId);
    next.metadata.ui = {
      ...(next.metadata.ui ?? { layout: [] }),
      layout: nextLayout,
    };
    onChange(next);
    setSelection({ kind: "possibility", id: possibilityId });
  }

  function addContext(source: KernelContextSource) {
    const labelMap: Partial<Record<KernelContextSource, string>> = {
      current_user: "Current employee",
      current_manager: "Reporting manager",
      current_device: "Current device",
      current_time: "Current date / time",
      current_location: "Current location",
      literal: "Configured value",
      company_setting: "Company setting",
      query: "Query result",
      history: "Previous data",
      session: "Current session",
      native: "Phone value",
    };
    const label = labelMap[source] ?? humanize(source);
    const id = randomKey(normalizeKey(label) || "context");
    const context: KernelContext = {
      id,
      label,
      source,
      mutable: ["current_location", "session", "query", "native"].includes(
        source,
      ),
      ...(source === "literal"
        ? { value: "", config: { valueType: "text", businessSetting: true } }
        : {}),
    };
    onChange({
      ...kernel,
      runtimeWorld: {
        ...kernel.runtimeWorld,
        contexts: [...kernel.runtimeWorld.contexts, context],
      },
    });
    setSelection({ kind: "context", id });
  }

  function addState() {
    const id = randomKey("state");
    onChange({
      ...kernel,
      runtimeWorld: {
        ...kernel.runtimeWorld,
        states: [
          ...kernel.runtimeWorld.states,
          { id, label: "New state", dimension: "process" },
        ],
      },
    });
    setSelection({ kind: "state", id });
  }

  function addActor() {
    const id = randomKey("actor");
    onChange({
      ...kernel,
      runtimeWorld: {
        ...kernel.runtimeWorld,
        actors: [
          ...kernel.runtimeWorld.actors,
          { id, label: "New person", resolver: { kind: "current_user" } },
        ],
      },
    });
    setSelection({ kind: "actor", id });
  }

  function applyRecipe(key: string) {
    if (key.startsWith("__compose__:")) {
      const keys = key
        .slice("__compose__:".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      let next = clone(kernel);
      let nextSelection: Selection | undefined;
      for (const recipeKey of keys) {
        const recipe = SMART_RECIPES.find((item) => item.key === recipeKey);
        if (!recipe) continue;
        const result = recipe.apply(next);
        next = result.kernel;
        nextSelection = result.selection ?? nextSelection;
      }
      onChange(next);
      setSelection(nextSelection ?? { kind: "app" });
      return;
    }

    const recipe = SMART_RECIPES.find((item) => item.key === key);
    if (!recipe) return;
    const result = recipe.apply(kernel);
    onChange(result.kernel);
    setSelection(result.selection ?? { kind: "app" });
  }

  function addDiscovery(item: DiscoverItem, index?: number) {
    if (item.kind === "recipe") return applyRecipe(item.payload);
    if (item.kind === "native") return addNative(item.payload, index);
    if (item.kind === "capture")
      return addCapture(item.payload as KernelCapture["kind"], index);
    if (item.kind === "action")
      return addAction(item.payload as KernelAction["kind"], index);
    if (item.kind === "output")
      return addOutput(item.payload as KernelOutputKind, index);
    if (item.kind === "context")
      return addContext(item.payload as KernelContextSource);
  }

  function removeSelection() {
    const next = clone(kernel);
    if (selection.kind === "possibility") {
      const possibility = next.possibilities.find(
        (item) => item.id === selection.id,
      );
      if (possibility?.type === "action") {
        const eventIds = actionEventIds(next, possibility.action.id);
        next.events = next.events.filter(
          (event) => !eventIds.includes(event.id),
        );
        next.rules = next.rules.filter(
          (rule) => !rule.eventId || !eventIds.includes(rule.eventId),
        );
      }
      if (possibility?.type === "capture") {
        for (const item of next.possibilities) {
          if (item.type === "action")
            item.action.captureIds = item.action.captureIds.filter(
              (id) => id !== possibility.capture.id,
            );
        }
      }
      next.possibilities = next.possibilities.filter(
        (item) => item.id !== selection.id,
      );
      next.metadata.ui = {
        ...(next.metadata.ui ?? { layout: [] }),
        layout: (next.metadata.ui?.layout ?? []).filter(
          (id) => id !== selection.id,
        ),
      };
    } else if (selection.kind === "context") {
      next.runtimeWorld.contexts = next.runtimeWorld.contexts.filter(
        (item) => item.id !== selection.id,
      );
    } else if (selection.kind === "state") {
      next.runtimeWorld.states = next.runtimeWorld.states.filter(
        (item) => item.id !== selection.id,
      );
    } else if (selection.kind === "actor") {
      next.runtimeWorld.actors = next.runtimeWorld.actors.filter(
        (item) => item.id !== selection.id,
      );
    }
    onChange(next);
    setSelection({ kind: "app" });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveDragId(null);
    if (!overId) return;

    /*
     * BRIXTA VISUAL UI DRAG/DROP
     *
     * This runs before the existing possibility/capture/action DnD.
     */
    if (activeId.startsWith("visual-palette:")) {
      const type = activeId.slice(
        "visual-palette:".length,
      ) as ResponsibilityUiBlockType;

      const roots = kernel.metadata.ui?.uiDocument?.rootIds ?? [];

      const visualOverId = overId.startsWith("visual:")
        ? overId.slice("visual:".length)
        : null;

      const index = visualOverId
        ? Math.max(0, roots.indexOf(visualOverId))
        : roots.length;

      addVisual(type, index);

      return;
    }

    if (activeId.startsWith("visual:") && overId.startsWith("visual:")) {
      const from = activeId.slice("visual:".length);

      const to = overId.slice("visual:".length);

      onChange(reorderVisualRoots(kernel, from, to));

      setSelection({
        kind: "ui",
        id: from,
      });

      return;
    }

    if (activeId.startsWith("palette:")) {
      const parts = activeId.split(":");
      const item = [...results, ...allDiscovery].find(
        (candidate) =>
          candidate.kind === parts[1] &&
          candidate.payload === parts.slice(2).join(":"),
      );
      if (!item) return;
      if (item.kind === "recipe" || item.kind === "context") {
        addDiscovery(item);
        return;
      }
      const index =
        overId === "phone-canvas"
          ? layout.length
          : Math.max(0, layout.indexOf(overId));
      addDiscovery(item, index);
      return;
    }
    if (
      layout.includes(activeId) &&
      layout.includes(overId) &&
      activeId !== overId
    ) {
      setLayout(
        arrayMove(layout, layout.indexOf(activeId), layout.indexOf(overId)),
      );
    }
  }

  const selectedPossibility =
    selection.kind === "possibility"
      ? (kernel.possibilities.find((item) => item.id === selection.id) ?? null)
      : null;
  const selectedContext =
    selection.kind === "context"
      ? (kernel.runtimeWorld.contexts.find(
          (item) => item.id === selection.id,
        ) ?? null)
      : null;
  const selectedState =
    selection.kind === "state"
      ? (kernel.runtimeWorld.states.find((item) => item.id === selection.id) ??
        null)
      : null;
  const selectedActor =
    selection.kind === "actor"
      ? (kernel.runtimeWorld.actors.find((item) => item.id === selection.id) ??
        null)
      : null;

  const selectedVisualBlock =
    selection.kind === "ui"
      ? (kernel.metadata.ui?.uiDocument?.blocks.find(
          (item) => item.id === selection.id,
        ) ?? null)
      : null;

  if (play) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Play app</div>
            <div className="text-sm text-muted-foreground">
              Use the generated phone and simulate time, actions and rules
              before publishing.
            </div>
          </div>
          <SecondaryButton type="button" onClick={() => setPlay(false)}>
            <SquarePen className="h-4 w-4" /> Back to builder
          </SecondaryButton>
        </div>
        <PlayPhone kernel={playKernel} />
      </div>
    );
  }

  const grouped = (
    [
      "Recommended",
      "Phone & sensors",
      "Ask",
      "Actions",
      "Show",
    ] as DiscoverGroup[]
  )
    .map((group) => ({
      group,
      items: results.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* BRIXTA_AI_BRIEF_UI_V11 */}
      <AiBuilderBrief
        kind="app"
        value={aiUserBrief}
        onChange={setAiUserBrief}
        mode={aiGenerationMode}
        onModeChange={
          setAiGenerationMode
        }
        inventory={[
          `${CAPTURE_CATALOG.length} capture / input primitives`,
          `${ACTION_CATALOG.length} action primitives`,
          `${OUTPUT_CATALOG.length} output primitives`,
          `${NATIVE_BLOCKS.length + RESPONSIBILITY_APP_BUILDER_BLOCKS.length} native / extension blocks`,
          "Existing visual presentation registry",
          "Existing interactive PlayPhone simulator",
        ]}
        contextItems={[
          "Current app",
          "Roles",
          "Employees",
          "Departments",
          "Data Sources",
          "Visual blocks",
          "Phone capabilities",
        ]}
      />

      <div className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold">Responsibility Canvas</div>
              <div className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Search what you want in normal business language, drag it onto
                the phone, then click it. BRIXTA asks only what that feature
                needs.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                onClick={() => {
                  setAiOpen(true);
                  setAiImportResult(null);
                  setAiIssues([]);
                  setAiMessage("");
                }}
              >
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </PrimaryButton>

              <SecondaryButton
                type="button"
                onClick={() => setShowStarters((value) => !value)}
              >
                <WandSparkles className="h-4 w-4" /> Starters
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => setPlay(true)}>
                <CirclePlay className="h-4 w-4" /> Play app
              </PrimaryButton>
            </div>
          </div>
          {showStarters && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {STARTER_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => {
                    if (
                      kernel.possibilities.length &&
                      !window.confirm(
                        `Replace this draft with the ${template.label} starter?`,
                      )
                    )
                      return;
                    onChange(template.create());
                    setSelection({ kind: "app" });
                    setShowStarters(false);
                  }}
                  className="rounded-xl border p-3 text-left hover:bg-muted/30"
                >
                  <WandSparkles className="h-4 w-4" />
                  <div className="mt-2 text-sm font-medium">
                    {template.label}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {template.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <div className="grid min-w-0 gap-4 2xl:grid-cols-[330px_minmax(390px,560px)_minmax(340px,1fr)]">
          <Panel className="min-w-0 2xl:max-h-[calc(100vh-190px)] 2xl:overflow-y-auto">
            <div className="sticky top-0 z-10 -mx-1 bg-background px-1 pb-3">
              <div className="font-semibold">What do you want?</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Search a goal, feature, phone capability or business rule.
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`${inputClass} pl-9`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. deduct money when late"
                />
              </div>
              {!query && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    "attendance",
                    "journey",
                    "geofence",
                    "approval",
                    "scan machine",
                    "biometric",
                  ].map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setQuery(idea)}
                      className="rounded-full border px-2 py-1 text-[10px] hover:bg-muted/30"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-5">
              <VisualFunctionalPlacementSection
                kernel={kernel}
                query={query}
                onPlaceCapture={(captureId) => {
                  const result =
                    addVisualCaptureBlock(
                      kernel,
                      captureId,
                    );

                  onChange(
                    result.kernel,
                  );

                  setSelection({
                    kind: "ui",
                    id: result.id,
                  });
                }}
                onPlaceAction={(actionId) => {
                  const result =
                    addVisualActionBlock(
                      kernel,
                      actionId,
                    );

                  onChange(
                    result.kernel,
                  );

                  setSelection({
                    kind: "ui",
                    id: result.id,
                  });
                }}
                onWireAll={() => {
                  onChange(
                    wireVisualFunctionality(
                      kernel,
                    ),
                  );
                }}
              />

              <VisualPaletteSection query={query} onAdd={addVisual} />

              {grouped.map((section) => (
                <div key={section.group}>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.group}
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <DiscoveryCard
                        key={item.id}
                        item={item}
                        onAdd={() => addDiscovery(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {results.length === 0 && (
                <div className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
                  No exact match. Try describing the outcome: “warn manager when
                  worker leaves site”, “pay ₹8 per km”, or “scan an asset”.
                </div>
              )}
            </div>
          </Panel>

          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">Employee phone</div>
                <div className="text-xs text-muted-foreground">
                  Drag, reorder and click anything.
                </div>
              </div>
              <Pill>{layout.length + visualBlocks.length} blocks</Pill>
            </div>
            {visualBlocks.length > 0 ? (
              <VisualPhoneCanvas
                kernel={kernel}
                selectedId={selection.kind === "ui" ? selection.id : undefined}
                onSelect={(id) =>
                  setSelection({
                    kind: "ui",
                    id,
                  })
                }
              />
            ) : (
              <PhoneCanvas
                kernel={kernel}
                selection={selection}
                onSelect={setSelection}
              />
            )}

            {visualBlocks.length > 0 && (
              <FlutterLivePreview kernel={kernel} />
            )}

            {visualBlocks.length > 0 && (
              <Panel className="mt-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-primary" />

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      Visual app layer
                    </div>

                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      This designed layer can contain both presentation and
                      real interactive controls. Functional inputs reuse the same canonical
                      captures and actions used by the Responsibility Kernel.
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {visualBlocks.map((block) => (
                        <span
                          key={block.id}
                          className="rounded-full border bg-muted/20 px-2 py-1 text-[10px]"
                        >
                          {block.type.replace(/[._]/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            <Panel className="mt-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">
                    App brain · automatic
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    BRIXTA derives employee context, manager relationships,
                    device/time/location, lifecycle, button visibility and
                    record targeting from the blocks above.
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <Panel className="min-w-0 2xl:max-h-[calc(100vh-190px)] 2xl:overflow-y-auto">
            {selectedVisualBlock ? (
              <VisualBlockInspector
                kernel={kernel}
                block={selectedVisualBlock}
                onChange={onChange}
                onDelete={() => {
                  onChange(deleteVisualBlock(kernel, selectedVisualBlock.id));

                  setSelection({
                    kind: "app",
                  });
                }}
              />
            ) : selectedPossibility?.type === "capture" ? (
              <CaptureInspector
                kernel={kernel}
                possibility={selectedPossibility}
                dataSources={dataSources}
                onChange={onChange}
                onDelete={removeSelection}
                onApplyRecipe={applyRecipe}
              />
            ) : selectedPossibility?.type === "action" ? (
              <AutomaticActionInspector
                kernel={kernel}
                possibility={selectedPossibility}
                roles={roles}
                employees={employees}
                departments={departments}
                onChange={onChange}
                onDelete={removeSelection}
              />
            ) : selectedPossibility?.type === "output" ? (
              <AutomaticOutputInspector
                kernel={kernel}
                possibility={selectedPossibility}
                onChange={onChange}
                onDelete={removeSelection}
              />
            ) : selectedContext ? (
              <ContextInspector
                kernel={kernel}
                context={selectedContext}
                onChange={onChange}
                onDelete={removeSelection}
              />
            ) : selectedState ? (
              <StateInspector
                kernel={kernel}
                state={selectedState}
                onChange={onChange}
                onDelete={removeSelection}
              />
            ) : selectedActor ? (
              <ActorInspector
                kernel={kernel}
                actor={selectedActor}
                onChange={onChange}
                onDelete={removeSelection}
              />
            ) : (
              <AutomaticAppInspector kernel={kernel} onChange={onChange} />
            )}
          </Panel>
        </div>
      </div>
      {aiOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />

                  <h2 className="text-lg font-semibold">
                    Generate Responsibility App with AI
                  </h2>
                </div>

                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Generate the App Builder blocks only. Pixel Logic remains
                  separate and can be generated afterward from the Pixel Logic
                  section.
                </p>
              </div>

              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => setAiOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-4">
                <div className="rounded-xl border p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Step 1
                  </div>

                  <div className="mt-1 font-medium">
                    Copy the complete App Builder context
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    It contains the current Responsibility, available fields,
                    actions, outputs, native phone blocks, company roles,
                    employees, runtime rules, platform restrictions and the
                    exact accepted JSON shape.
                  </p>

                  <SecondaryButton
                    type="button"
                    className="mt-3"
                    onClick={() => void copyAppBuilderAIContext()}
                  >
                    <Sparkles className="h-4 w-4" />
                    Copy AI Context
                  </SecondaryButton>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Step 2
                  </div>

                  <div className="mt-1 font-medium">
                    Tell AI what the employee app should contain
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">Example:</p>

                  <div className="mt-2 rounded-lg bg-muted/30 p-3 text-sm">
                    Employee sees Start Journey, the phone tracks the journey,
                    then Stop Journey saves the distance. Completed journey
                    records should be visible on the dashboard.
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Separation
                  </div>

                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div>✓ App Builder AI creates UI / phone blocks.</div>
                    <div>✓ It may define basic action lifecycle states.</div>
                    <div>✕ It cannot generate Pixel nodes or wires.</div>
                    <div>
                      ✕ It cannot invent unregistered phone capabilities.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Step 3
                  </div>

                  <div className="mt-1 font-medium">Paste AI JSON</div>
                </div>

                <textarea
                  className={`${textareaClass} min-h-[420px] font-mono text-xs`}
                  value={aiImportText}
                  placeholder={`{
  "format": "brixta.app-builder",
  "formatVersion": 1,
  ...
}`}
                  onChange={(event) => {
                    setAiImportText(event.target.value);

                    setAiImportResult(null);

                    setAiIssues([]);
                  }}
                />

                <div className="flex flex-wrap gap-2">
                  <SecondaryButton type="button" onClick={validateAppBuilderAI}>
                    <ShieldCheck className="h-4 w-4" />
                    Validate AI App
                  </SecondaryButton>

                  <PrimaryButton
                    type="button"
                    disabled={!aiImportResult || aiIssues.length > 0}
                    onClick={applyAppBuilderAI}
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate App
                  </PrimaryButton>
                </div>

                {aiMessage && (
                  <div
                    className={cx(
                      "rounded-xl border p-3 text-sm",
                      aiIssues.length > 0
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-emerald-500/30 bg-emerald-500/5",
                    )}
                  >
                    {aiMessage}
                  </div>
                )}

                {aiIssues.length > 0 && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                    <div className="text-sm font-medium">
                      Blocking validation issues
                    </div>

                    <ul className="mt-2 space-y-1 text-sm">
                      {aiIssues.map((issue, index) => (
                        <li key={`${issue}-${index}`}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiImportResult && aiIssues.length === 0 && (
                  <div className="rounded-xl border p-4">
                    <div className="text-sm font-medium">AI App Preview</div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div className="rounded-lg bg-muted/30 p-2">
                        <div className="text-xs text-muted-foreground">
                          Fields
                        </div>

                        <div className="text-lg font-semibold">
                          {aiImportResult.app.captures.length}
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/30 p-2">
                        <div className="text-xs text-muted-foreground">
                          Actions
                        </div>

                        <div className="text-lg font-semibold">
                          {aiImportResult.app.actions.length}
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/30 p-2">
                        <div className="text-xs text-muted-foreground">
                          Outputs
                        </div>

                        <div className="text-lg font-semibold">
                          {aiImportResult.app.outputs.length}
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/30 p-2">
                        <div className="text-xs text-muted-foreground">
                          Phone blocks
                        </div>

                        <div className="text-lg font-semibold">
                          {aiImportResult.app.layout.length}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DragOverlay>
        {activeDragId ? (
          <div className="rounded-xl border bg-background px-3 py-2 text-sm shadow-xl">
            <GripVertical className="mr-2 inline h-4 w-4" /> Drop into app
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
