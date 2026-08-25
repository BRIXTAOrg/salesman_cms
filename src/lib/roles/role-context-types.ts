/**
 * The public vocabulary for role-aware Responsibilities.
 *
 * This file intentionally contains types + constants only:
 * - no database access
 * - no React
 * - no HTTP
 * - no knowledge of a specific tenant
 *
 * A RoleContextDefinition describes what a Role means.
 * A ResolvedRoleContext describes what that Role means for one actual user.
 */

export const ROLE_CONTEXT_SCHEMA_VERSION = 1 as const;

export type RoleId = number;
export type UserId = number;

export type RoleRelationshipKind =
  | "reports_to"
  | "belongs_to_team"
  | "manages"
  | "works_with"
  | "territory_owner";

export type WorkflowPurpose =
  | "approval"
  | "review"
  | "escalation"
  | "handoff";

export type RoleTargetResolver =
  | { kind: "reporting_manager" }
  | { kind: "self" }
  | { kind: "organization_admin" }
  | { kind: "role"; roleId: RoleId };

export type RoleCapabilityKey =
  | "form.text"
  | "form.long_text"
  | "form.number"
  | "form.choice"
  | "form.date"
  | "form.boolean"
  | "capture.photo"
  | "capture.file"
  | "capture.signature"
  | "capture.location"
  | "capture.qr"
  | "capture.barcode"
  | "data.entity_reference"
  | "data.assigned_dealers"
  | "action.submit"
  | "action.save_draft"
  | "workflow.request_approval"
  | "workflow.review"
  | "view.own_records"
  | "view.team_records"
  | "team.members"
  | "team.assign"
  | (string & {});

export type VisibilityScope =
  | "own"
  | "manager_chain"
  | "team"
  | "subordinates"
  | "assigned"
  | "organization";

export type RoleRelationship = {
  id: string;
  kind: RoleRelationshipKind;
  targetRoleId?: RoleId;
  targetKey?: string;
  label?: string;
  enabled: boolean;
};

export type RoleWorkflowRule = {
  id: string;
  purpose: WorkflowPurpose;
  target: RoleTargetResolver;
  enabled: boolean;
};

export type RoleVisibilityRule = {
  id: string;
  resource: string;
  scope: VisibilityScope;
  enabled: boolean;
};

export type RoleContextDefinition = {
  schemaVersion: typeof ROLE_CONTEXT_SCHEMA_VERSION;
  roleId: RoleId;
  label: string;
  relationships: RoleRelationship[];
  workflows: RoleWorkflowRule[];
  capabilities: RoleCapabilityKey[];
  visibility: RoleVisibilityRule[];
  metadata: Record<string, unknown>;
};

export type ResolvedRoleReference = {
  id: RoleId;
  label: string;
};

export type ResolvedUserReference = {
  id: UserId;
  label: string;
  department?: string | null;
  designation?: string | null;
  area?: string | null;
  zone?: string | null;
};

export type ResolvedRoleContext = {
  user: ResolvedUserReference;
  roles: ResolvedRoleReference[];
  activeRole: ResolvedRoleReference;
  definition: RoleContextDefinition;

  manager?: ResolvedUserReference | null;
  managerRoleIds: RoleId[];

  /**
   * These values come from the actual user record. They are deliberately
   * runtime values rather than hard-coded into a Responsibility.
   */
  runtime: {
    department?: string | null;
    designation?: string | null;
    area?: string | null;
    zone?: string | null;
  };

  capabilities: RoleCapabilityKey[];
  visibility: RoleVisibilityRule[];
};

export type WorkflowResolution =
  | {
      status: "resolved";
      purpose: WorkflowPurpose;
      resolver: RoleTargetResolver;
      userId: UserId;
      reason: string;
    }
  | {
      status: "not_required";
      purpose: WorkflowPurpose;
      reason: string;
    }
  | {
      status: "unresolved";
      purpose: WorkflowPurpose;
      resolver?: RoleTargetResolver;
      reason: string;
    };

export const BASE_ROLE_CAPABILITIES: RoleCapabilityKey[] = [
  "form.text",
  "form.long_text",
  "form.number",
  "form.choice",
  "form.date",
  "form.boolean",
  "capture.photo",
  "capture.file",
  "capture.location",
  "data.entity_reference",
  "action.submit",
  "action.save_draft",
  "view.own_records",
];
