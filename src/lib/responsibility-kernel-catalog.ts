import type {
  KernelActionKind,
  KernelCaptureKind,
  KernelContextSource,
  KernelEffectKind,
  KernelOutputKind,
  ResponsibilityKernel,
} from "@/lib/responsibility-kernel-types";

function key(prefix: string, suffix: string) {
  return `${prefix}_${suffix}`;
}

export const CAPTURE_CATALOG: Array<{
  kind: KernelCaptureKind;
  label: string;
  group: "Ask" | "Reference" | "Evidence" | "Device" | "Structure";
}> = [
  { kind: "short_text", label: "Text", group: "Ask" },
  { kind: "long_text", label: "Long answer", group: "Ask" },
  { kind: "number", label: "Number", group: "Ask" },
  { kind: "amount", label: "Amount", group: "Ask" },
  { kind: "choice", label: "Choice", group: "Ask" },
  { kind: "date", label: "Date", group: "Ask" },
  { kind: "datetime", label: "Date & time", group: "Ask" },
  { kind: "boolean", label: "Yes / No", group: "Ask" },
  { kind: "person_reference", label: "Person / employee", group: "Reference" },
  { kind: "entity_reference", label: "Business record", group: "Reference" },
  { kind: "responsibility_reference", label: "Previous Responsibility record", group: "Reference" },
  { kind: "photo", label: "Photo", group: "Evidence" },
  { kind: "video", label: "Video", group: "Evidence" },
  { kind: "audio", label: "Voice / audio", group: "Evidence" },
  { kind: "file", label: "File", group: "Evidence" },
  { kind: "signature", label: "Signature", group: "Evidence" },
  { kind: "gps", label: "GPS location", group: "Device" },
  { kind: "route", label: "Route / movement", group: "Device" },
  { kind: "qr", label: "QR scan", group: "Device" },
  { kind: "barcode", label: "Barcode scan", group: "Device" },
  { kind: "nfc", label: "NFC tap", group: "Device" },
  { kind: "checklist", label: "Checklist", group: "Structure" },
  { kind: "rating", label: "Rating / scale", group: "Structure" },
  { kind: "timer", label: "Timer / duration", group: "Device" },
  { kind: "repeating_section", label: "Repeating section", group: "Structure" },
];

export const CONTEXT_CATALOG: Array<{ source: KernelContextSource; label: string }> = [
  { source: "current_user", label: "Current employee" },
  { source: "current_manager", label: "Current manager" },
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
];

export const ACTION_CATALOG: Array<{ kind: KernelActionKind; label: string }> = [
  ["submit", "Submit / send"],
  ["create", "Create"],
  ["update", "Update"],
  ["start", "Start"],
  ["stop", "Stop"],
  ["pause", "Pause"],
  ["resume", "Resume"],
  ["approve", "Approve"],
  ["reject", "Reject"],
  ["return", "Return"],
  ["assign", "Assign"],
  ["reassign", "Reassign"],
  ["delegate", "Delegate"],
  ["comment", "Comment"],
  ["acknowledge", "Acknowledge"],
  ["sign", "Sign"],
  ["notify", "Notify"],
  ["trigger", "Trigger"],
  ["complete", "Complete"],
  ["cancel", "Cancel"],
  ["delete", "Delete"],
  ["read", "Read"],
].map(([kind, label]) => ({ kind: kind as KernelActionKind, label }));

export const OUTPUT_CATALOG: Array<{ kind: KernelOutputKind; label: string }> = [
  ["detail", "Detail"],
  ["card", "Card"],
  ["list", "List"],
  ["table", "Table"],
  ["timeline", "Timeline"],
  ["calendar", "Calendar"],
  ["gallery", "Gallery"],
  ["map", "Map"],
  ["route", "Route"],
  ["metric", "Metric"],
  ["chart", "Chart"],
  ["document", "Document"],
  ["receipt", "Receipt"],
  ["dashboard", "Dashboard"],
  ["notification", "Notification"],
].map(([kind, label]) => ({ kind: kind as KernelOutputKind, label }));

export const EFFECT_CATALOG: Array<{ kind: KernelEffectKind; label: string }> = [
  ["change_state", "Change state"],
  ["set_context", "Set / update context"],
  ["remove_context", "Remove context"],
  ["create_record", "Create record"],
  ["update_record", "Update record"],
  ["delete_record", "Delete record"],
  ["assign_actor", "Assign actor"],
  ["notify_actor", "Notify actor"],
  ["query_data", "Query data"],
  ["set_computed", "Set computed value"],
  ["freeze_data", "Freeze evidence / data"],
  ["trigger_action", "Trigger action"],
  ["trigger_responsibility", "Trigger another Responsibility"],
  ["append_history", "Append history"],
].map(([kind, label]) => ({ kind: kind as KernelEffectKind, label }));

export function blankResponsibilityKernel(): ResponsibilityKernel {
  return {
    kernelVersion: 3,
    runtimeWorld: {
      actors: [
        { id: "current_employee", label: "Current employee", resolver: { kind: "current_user" } },
        { id: "system", label: "System", resolver: { kind: "system" } },
      ],
      objects: [
        {
          id: "current_record",
          label: "This Responsibility record",
          kind: "current_record",
          description: "The record created/updated by this Responsibility.",
        },
      ],
      contexts: [
        { id: "current_employee", label: "Current employee", source: "current_user", mutable: false },
        { id: "current_time", label: "Current date / time", source: "current_time", mutable: false },
      ],
      states: [
        { id: "draft", label: "Draft", dimension: "process", initial: true },
        { id: "completed", label: "Completed", dimension: "process", terminal: true },
      ],
    },
    possibilities: [],
    events: [],
    rules: [],
    metadata: { ui: { layout: [], previewActorId: "current_employee", previewStateId: "draft" } },
  };
}

function addActionRule(
  kernel: ResponsibilityKernel,
  actionId: string,
  eventId: string,
  ruleId: string,
  nextState: string,
  effects: Array<{ kind: KernelEffectKind; actorId?: string; targetKey?: string; label?: string }> = [],
) {
  kernel.events.push({ id: eventId, label: `${actionId} happened`, kind: "action", actionId });
  kernel.rules.push({
    id: ruleId,
    label: `${actionId} behavior`,
    eventId,
    when: { mode: "all", conditions: [] },
    priority: 100,
    enabled: true,
    effects: [
      {
        id: `${ruleId}_state`,
        kind: "change_state",
        targetKey: "process",
        value: { kind: "literal", value: nextState },
        config: {},
      },
      ...effects.map((effect, index) => ({
        id: `${ruleId}_effect_${index + 1}`,
        kind: effect.kind,
        actorId: effect.actorId,
        targetKey: effect.targetKey,
        config: effect.label ? { label: effect.label } : {},
      })),
      {
        id: `${ruleId}_history`,
        kind: "append_history",
        config: { label: actionId.replace(/_/g, " ") },
      },
    ],
  });
}

export function leaveKernelTemplate(): ResponsibilityKernel {
  const k = blankResponsibilityKernel();
  k.metadata = {
    createdFrom: "leave_request",
    ui: { layout: [], title: "Leave Request", previewActorId: "current_employee", previewStateId: "draft" },
  };
  k.runtimeWorld.objects[0] = { id: "current_record", label: "Leave request", kind: "current_record" };
  k.runtimeWorld.actors.push({
    id: "reporting_manager",
    label: "Reporting manager",
    resolver: { kind: "manager_of", value: { kind: "actor", key: "current_employee" } },
  });
  k.runtimeWorld.actors.push({
    id: "replacement_employee",
    label: "Selected replacement employee",
    resolver: { kind: "selected_reference", referenceKey: "replacement_employee" },
  });
  k.runtimeWorld.contexts.push({ id: "reporting_manager", label: "Reporting manager", source: "current_manager", mutable: false });
  k.runtimeWorld.states = [
    { id: "draft", label: "Draft", dimension: "process", initial: true },
    { id: "pending_manager", label: "Pending manager", dimension: "process" },
    { id: "approved", label: "Approved", dimension: "process", terminal: true },
    { id: "rejected", label: "Rejected", dimension: "process", terminal: true },
    { id: "returned", label: "Returned", dimension: "process" },
  ];

  const captures = [
    { id: "leave_type", label: "Leave type", kind: "choice" as const, config: { options: ["Casual", "Sick", "Earned", "Other"] } },
    { id: "from_date", label: "From date", kind: "date" as const, config: {} },
    { id: "to_date", label: "To date", kind: "date" as const, config: {} },
    { id: "reason", label: "Reason", kind: "long_text" as const, config: {} },
    {
      id: "replacement_employee",
      label: "Who will handle your work?",
      kind: "person_reference" as const,
      config: {
        source: "employees",
        searchable: true,
        filters: [
          { field: "status", operator: "eq", value: "active" },
          { field: "id", operator: "neq", valueFrom: "current_employee.id" },
        ],
      },
    },
  ];

  for (const capture of captures) {
    const possibilityId = key("capture", capture.id);
    k.possibilities.push({
      id: possibilityId,
      type: "capture",
      capture: { ...capture, required: true, storeAs: capture.id },
    });
    k.metadata.ui!.layout.push(possibilityId);
  }

  const submit = {
    id: "apply_leave",
    label: "Apply leave",
    kind: "submit" as const,
    actorId: "current_employee",
    objectId: "current_record",
    captureIds: captures.map((item) => item.id),
    config: { availableState: "draft", resultingState: "pending_manager", successMessage: "Leave request sent." },
  };
  const approve = {
    id: "approve_leave",
    label: "Approve",
    kind: "approve" as const,
    actorId: "reporting_manager",
    objectId: "current_record",
    captureIds: [],
    config: { availableState: "pending_manager", resultingState: "approved" },
  };
  const reject = {
    id: "reject_leave",
    label: "Reject",
    kind: "reject" as const,
    actorId: "reporting_manager",
    objectId: "current_record",
    captureIds: [],
    config: { availableState: "pending_manager", resultingState: "rejected" },
  };

  for (const action of [submit, approve, reject]) {
    const possibilityId = key("action", action.id);
    k.possibilities.push({ id: possibilityId, type: "action", action });
    k.metadata.ui!.layout.push(possibilityId);
  }

  k.possibilities.push({
    id: "output_leave_timeline",
    type: "output",
    output: {
      id: "leave_timeline",
      label: "Leave status",
      kind: "timeline",
      actorIds: ["current_employee", "reporting_manager"],
      stateIds: [],
      visibleKeys: captures.map((item) => item.id),
      config: {},
    },
  });

  addActionRule(k, "apply_leave", "event_apply_leave", "rule_apply_leave", "pending_manager", [
    { kind: "assign_actor", actorId: "reporting_manager" },
    { kind: "notify_actor", actorId: "reporting_manager" },
  ]);
  addActionRule(k, "approve_leave", "event_approve_leave", "rule_approve_leave", "approved", [
    { kind: "notify_actor", actorId: "current_employee" },
  ]);
  addActionRule(k, "reject_leave", "event_reject_leave", "rule_reject_leave", "rejected", [
    { kind: "notify_actor", actorId: "current_employee" },
  ]);
  return k;
}

export function attendanceKernelTemplate(): ResponsibilityKernel {
  const k = blankResponsibilityKernel();
  k.metadata = {
    createdFrom: "daily_attendance",
    ui: { layout: [], title: "Daily Attendance", previewActorId: "current_employee", previewStateId: "not_checked_in" },
  };
  k.runtimeWorld.objects[0] = { id: "current_record", label: "Today's attendance", kind: "current_record" };
  k.runtimeWorld.states = [
    { id: "not_checked_in", label: "Not checked in", dimension: "process", initial: true },
    { id: "checked_in", label: "Checked in", dimension: "process" },
    { id: "completed", label: "Completed", dimension: "process", terminal: true },
  ];
  k.runtimeWorld.contexts.push(
    { id: "device", label: "Current device", source: "current_device", mutable: false },
    { id: "location", label: "Current location", source: "current_location", mutable: true, frozenAfterState: "completed" },
    { id: "session", label: "Work session / route", source: "session", mutable: true, frozenAfterState: "completed" },
  );

  const checkinPhoto = {
    id: "check_in_photo",
    label: "Check-in photo",
    kind: "photo" as const,
    required: true,
    storeAs: "check_in_photo",
    config: {},
  };
  const checkoutPhoto = {
    id: "check_out_photo",
    label: "Check-out photo",
    kind: "photo" as const,
    required: true,
    storeAs: "check_out_photo",
    config: {},
  };
  k.possibilities.push(
    { id: "capture_check_in_photo", type: "capture", capture: checkinPhoto },
    {
      id: "action_check_in",
      type: "action",
      action: {
        id: "check_in",
        label: "Check in",
        kind: "start",
        actorId: "current_employee",
        objectId: "current_record",
        captureIds: ["check_in_photo"],
        config: {
          availableState: "not_checked_in",
          resultingState: "checked_in",
          captureContext: ["current_employee", "current_time", "device", "location"],
          startSession: true,
          startRoute: true,
          offlineAllowed: true,
        },
      },
    },
    { id: "capture_check_out_photo", type: "capture", capture: checkoutPhoto },
    {
      id: "action_check_out",
      type: "action",
      action: {
        id: "check_out",
        label: "Check out",
        kind: "stop",
        actorId: "current_employee",
        objectId: "current_record",
        captureIds: ["check_out_photo"],
        config: {
          availableState: "checked_in",
          resultingState: "completed",
          captureContext: ["current_time", "device", "location"],
          stopSession: true,
          stopRoute: true,
          freezeEvidence: true,
          offlineAllowed: true,
        },
      },
    },
  );
  k.metadata.ui!.layout.push("capture_check_in_photo", "action_check_in", "capture_check_out_photo", "action_check_out");
  k.possibilities.push({
    id: "output_attendance",
    type: "output",
    output: {
      id: "attendance_status",
      label: "Today's attendance",
      kind: "timeline",
      actorIds: ["current_employee"],
      stateIds: [],
      visibleKeys: ["check_in_photo", "check_out_photo", "session.duration", "session.distance", "session.route"],
      config: {},
    },
  });
  addActionRule(k, "check_in", "event_check_in", "rule_check_in", "checked_in");
  addActionRule(k, "check_out", "event_check_out", "rule_check_out", "completed", [
    { kind: "freeze_data", targetKey: "session", label: "session" },
  ]);
  return k;
}

function simpleFormTemplate(
  title: string,
  createdFrom: string,
  fields: Array<{ id: string; label: string; kind: KernelCaptureKind }>,
): ResponsibilityKernel {
  const k = blankResponsibilityKernel();
  k.metadata = { createdFrom, ui: { layout: [], title, previewActorId: "current_employee", previewStateId: "draft" } };
  k.runtimeWorld.objects[0] = { id: "current_record", label: title, kind: "current_record" };
  for (const field of fields) {
    const possibilityId = `capture_${field.id}`;
    k.possibilities.push({
      id: possibilityId,
      type: "capture",
      capture: { ...field, required: false, storeAs: field.id, config: {} },
    });
    k.metadata.ui!.layout.push(possibilityId);
  }
  k.possibilities.push({
    id: "action_submit",
    type: "action",
    action: {
      id: "submit",
      label: "Submit",
      kind: "submit",
      actorId: "current_employee",
      objectId: "current_record",
      captureIds: fields.map((field) => field.id),
      config: { availableState: "draft", resultingState: "completed" },
    },
  });
  k.metadata.ui!.layout.push("action_submit");
  k.possibilities.push({
    id: "output_detail",
    type: "output",
    output: {
      id: "detail",
      label: `${title} result`,
      kind: "detail",
      actorIds: ["current_employee"],
      stateIds: [],
      visibleKeys: fields.map((field) => field.id),
      config: {},
    },
  });
  addActionRule(k, "submit", "event_submit", "rule_submit", "completed");
  return k;
}

export const STARTER_TEMPLATES: Array<{
  key: string;
  label: string;
  description: string;
  create: () => ResponsibilityKernel;
}> = [
  { key: "blank", label: "Blank", description: "Start with an empty operational canvas.", create: blankResponsibilityKernel },
  { key: "attendance", label: "Attendance", description: "Photo + check-in/out + state/session starter.", create: attendanceKernelTemplate },
  { key: "leave", label: "Request / approval", description: "Form + person reference + manager decision starter.", create: leaveKernelTemplate },
  {
    key: "expense",
    label: "Expense",
    description: "Amounts + receipt + submit starter.",
    create: () => simpleFormTemplate("Expense Claim", "expense", [
      { id: "amount", label: "Amount", kind: "amount" },
      { id: "purpose", label: "Purpose", kind: "long_text" },
      { id: "receipt", label: "Receipt", kind: "photo" },
    ]),
  },
  {
    key: "inspection",
    label: "Inspection",
    description: "Business object + checklist + evidence.",
    create: () => simpleFormTemplate("Inspection", "inspection", [
      { id: "subject", label: "What are you inspecting?", kind: "entity_reference" },
      { id: "checklist", label: "Checklist", kind: "checklist" },
      { id: "evidence", label: "Evidence photo", kind: "photo" },
    ]),
  },
  {
    key: "field_visit",
    label: "Field visit",
    description: "Business record + GPS + photo + notes.",
    create: () => simpleFormTemplate("Field Visit", "field_visit", [
      { id: "subject", label: "Who / what are you visiting?", kind: "entity_reference" },
      { id: "location", label: "Visit location", kind: "gps" },
      { id: "photo", label: "Visit photo", kind: "photo" },
      { id: "notes", label: "Visit notes", kind: "long_text" },
    ]),
  },
  {
    key: "journey",
    label: "Journey / tracking",
    description: "Route + timer + evidence starter.",
    create: () => simpleFormTemplate("Journey", "journey", [
      { id: "route", label: "Route", kind: "route" },
      { id: "duration", label: "Duration", kind: "timer" },
      { id: "evidence", label: "Evidence", kind: "photo" },
    ]),
  },
];
