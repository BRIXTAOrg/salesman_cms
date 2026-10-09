// BRIXTA_OPERATION_PERMISSIONS_V1
// The authoritative grants are tenant roles.grantedPerms, refreshed from DB
// on each CMS route call. Explicit OPS_GRANULAR opts the role into fine-grained
// gates; legacy grants remain unchanged until that opt-in. ALL_ACCESS bypasses.
export const OPS_GRANULAR = "OPS_GRANULAR";
export const OPERATION_PERMISSION_CATALOG = [
  { key: "OPS_FIELD_VIEW", label: "View CRM field records", description: "Read site lists, details and field employee directory." },
  { key: "OPS_FIELD_ASSIGN", label: "Assign Field records", description: "Assign and unassign site verification work." },
  { key: "OPS_EXPERIENCE_VIEW", label: "View App Experiences", description: "Inspect published and draft App Experiences." },
  { key: "OPS_EXPERIENCE_EDIT", label: "Edit App Experience drafts", description: "Edit, restore or discard a draft." },
  { key: "OPS_EXPERIENCE_PUBLISH", label: "Publish App Experiences", description: "Publish an App Experience and Pixel Logic rules." },
  { key: "OPS_WORK_CREATE", label: "Start linked Responsibilities", description: "Create work items from existing CRM records." },
  { key: "OPS_WORK_HANDOVER", label: "Handover active Responsibilities", description: "Transfer existing active work to another employee." },
  { key: "OPS_RESPONSIBILITY_EDIT", label: "Edit Responsibility records", description: "Correct existing Responsibility capture data." },
] as const;

export type OperationKey = (typeof OPERATION_PERMISSION_CATALOG)[number]["key"];

const OPERATION_LEGACY: Record<OperationKey, readonly string[]> = {
  OPS_FIELD_VIEW: ["READ", "WRITE", "UPDATE"],
  OPS_FIELD_ASSIGN: ["WRITE", "UPDATE"],
  OPS_EXPERIENCE_VIEW: ["READ", "WRITE", "UPDATE"],
  OPS_EXPERIENCE_EDIT: ["WRITE", "UPDATE"],
  OPS_EXPERIENCE_PUBLISH: ["WRITE", "UPDATE"],
  OPS_WORK_CREATE: ["WRITE", "UPDATE"],
  OPS_WORK_HANDOVER: ["WRITE", "UPDATE"],
  OPS_RESPONSIBILITY_EDIT: ["WRITE", "UPDATE"],
};

export function canOperation(perms: readonly string[], key: OperationKey): boolean {
  if (perms.includes("ALL_ACCESS")) return true;
  const legacy = OPERATION_LEGACY[key];
  if (!legacy.some((token) => perms.includes(token))) return false;
  // When any assigned role opts the account in, require the named token.
  // Roles are additive. A deliberately constrained account must not also
  // have an unrestricted legacy editor role unless that is intended.
  return !perms.includes(OPS_GRANULAR) || perms.includes(key);
}
