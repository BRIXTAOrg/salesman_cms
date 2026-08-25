import type { RoleCapabilityKey } from "./role-context-types";

export type BuilderCapabilityDefinition = {
  key: RoleCapabilityKey;
  label: string;
  group: "fields" | "capture" | "data" | "actions" | "workflow" | "views";
  description: string;
  /**
   * These keys describe which existing Kernel primitive the App Builder can
   * create. They are intentionally strings so this catalog does not depend on
   * React or the Kernel implementation.
   */
  kernel?: {
    type: "capture" | "action" | "output";
    kind: string;
  };
};

export const BUILDER_CAPABILITY_CATALOG: BuilderCapabilityDefinition[] = [
  { key: "form.text", label: "Text", group: "fields", description: "Short text input.", kernel: { type: "capture", kind: "text" } },
  { key: "form.long_text", label: "Long text", group: "fields", description: "Multi-line text input.", kernel: { type: "capture", kind: "long_text" } },
  { key: "form.number", label: "Number", group: "fields", description: "Numeric input.", kernel: { type: "capture", kind: "number" } },
  { key: "form.choice", label: "Choice", group: "fields", description: "Choose one of several values.", kernel: { type: "capture", kind: "choice" } },
  { key: "form.date", label: "Date", group: "fields", description: "Date input.", kernel: { type: "capture", kind: "date" } },
  { key: "form.boolean", label: "Yes / No", group: "fields", description: "Boolean input.", kernel: { type: "capture", kind: "boolean" } },

  { key: "capture.photo", label: "Photo", group: "capture", description: "Capture a photo from the device.", kernel: { type: "capture", kind: "photo" } },
  { key: "capture.file", label: "File", group: "capture", description: "Attach a file.", kernel: { type: "capture", kind: "file" } },
  { key: "capture.signature", label: "Signature", group: "capture", description: "Capture a signature.", kernel: { type: "capture", kind: "signature" } },
  { key: "capture.location", label: "Current location", group: "capture", description: "Use the device GPS.", kernel: { type: "capture", kind: "gps" } },
  { key: "capture.qr", label: "QR", group: "capture", description: "Scan a QR code.", kernel: { type: "capture", kind: "qr" } },
  { key: "capture.barcode", label: "Barcode", group: "capture", description: "Scan a barcode.", kernel: { type: "capture", kind: "barcode" } },

  { key: "data.entity_reference", label: "Existing data", group: "data", description: "Pick from an existing BRIXTA data source.", kernel: { type: "capture", kind: "entity_reference" } },
  { key: "data.assigned_dealers", label: "My dealers", group: "data", description: "Role-aware dealer selection for the current employee.", kernel: { type: "capture", kind: "entity_reference" } },

  { key: "action.submit", label: "Submit", group: "actions", description: "Submit/save this Responsibility.", kernel: { type: "action", kind: "submit" } },
  { key: "action.save_draft", label: "Save draft", group: "actions", description: "Save work without completing it.", kernel: { type: "action", kind: "save" } },

  { key: "workflow.request_approval", label: "Needs approval", group: "workflow", description: "Route work using the Role's default approval workflow." },
  { key: "workflow.review", label: "Needs review", group: "workflow", description: "Route work using the Role's default review workflow." },

  { key: "view.own_records", label: "My records", group: "views", description: "Show records created by the current employee.", kernel: { type: "output", kind: "list" } },
  { key: "view.team_records", label: "Team records", group: "views", description: "Show records visible through the Role's team policy.", kernel: { type: "output", kind: "list" } },
];

export function getBuilderCapabilityDefinition(key: RoleCapabilityKey) {
  return BUILDER_CAPABILITY_CATALOG.find((item) => item.key === key) ?? null;
}
