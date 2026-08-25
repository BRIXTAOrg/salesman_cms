import {
  BASE_ROLE_CAPABILITIES,
  ROLE_CONTEXT_SCHEMA_VERSION,
  type RoleCapabilityKey,
  type RoleContextDefinition,
  type RoleRelationship,
  type RoleTargetResolver,
  type RoleVisibilityRule,
  type RoleWorkflowRule,
  type VisibilityScope,
  type WorkflowPurpose,
} from "./role-context-types";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function positiveInteger(value: unknown): number | undefined {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : undefined;
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function enabled(value: unknown): boolean {
  return value !== false;
}

function normalizeTarget(value: unknown): RoleTargetResolver {
  const target = object(value);
  const kind = string(target.kind);

  if (kind === "self") return { kind: "self" };
  if (kind === "organization_admin") return { kind: "organization_admin" };
  if (kind === "role") {
    const roleId = positiveInteger(target.roleId);
    return roleId ? { kind: "role", roleId } : { kind: "reporting_manager" };
  }
  return { kind: "reporting_manager" };
}

function normalizeRelationship(value: unknown, index: number): RoleRelationship | null {
  const item = object(value);
  const kind = string(item.kind);
  if (!["reports_to", "belongs_to_team", "manages", "works_with", "territory_owner"].includes(kind)) {
    return null;
  }

  return {
    id: string(item.id, `relationship_${index + 1}`),
    kind: kind as RoleRelationship["kind"],
    targetRoleId: positiveInteger(item.targetRoleId),
    targetKey: string(item.targetKey) || undefined,
    label: string(item.label) || undefined,
    enabled: enabled(item.enabled),
  };
}

function normalizeWorkflow(value: unknown, index: number): RoleWorkflowRule | null {
  const item = object(value);
  const purpose = string(item.purpose);
  if (!["approval", "review", "escalation", "handoff"].includes(purpose)) return null;

  return {
    id: string(item.id, `workflow_${purpose}_${index + 1}`),
    purpose: purpose as WorkflowPurpose,
    target: normalizeTarget(item.target),
    enabled: enabled(item.enabled),
  };
}

function normalizeVisibility(value: unknown, index: number): RoleVisibilityRule | null {
  const item = object(value);
  const scope = string(item.scope);
  if (!["own", "manager_chain", "team", "subordinates", "assigned", "organization"].includes(scope)) {
    return null;
  }

  return {
    id: string(item.id, `visibility_${index + 1}`),
    resource: string(item.resource, "*"),
    scope: scope as VisibilityScope,
    enabled: enabled(item.enabled),
  };
}

export function createDefaultRoleContext(
  roleId: number,
  label: string,
): RoleContextDefinition {
  return {
    schemaVersion: ROLE_CONTEXT_SCHEMA_VERSION,
    roleId,
    label,
    relationships: [],
    workflows: [],
    capabilities: [...BASE_ROLE_CAPABILITIES],
    visibility: [
      {
        id: "visibility_own_records",
        resource: "*",
        scope: "own",
        enabled: true,
      },
    ],
    metadata: {},
  };
}

export function normalizeRoleContextDefinition(args: {
  roleId: number;
  label: string;
  value: unknown;
}): RoleContextDefinition {
  const source = object(args.value);
  const capabilities = array(source.capabilities)
    .map((item) => string(item))
    .filter(Boolean) as RoleCapabilityKey[];

  return {
    schemaVersion: ROLE_CONTEXT_SCHEMA_VERSION,
    roleId: args.roleId,
    label: string(source.label, args.label) || args.label,
    relationships: array(source.relationships)
      .map(normalizeRelationship)
      .filter((item): item is RoleRelationship => Boolean(item)),
    workflows: array(source.workflows)
      .map(normalizeWorkflow)
      .filter((item): item is RoleWorkflowRule => Boolean(item)),
    capabilities: capabilities.length ? [...new Set(capabilities)] : [...BASE_ROLE_CAPABILITIES],
    visibility: array(source.visibility)
      .map(normalizeVisibility)
      .filter((item): item is RoleVisibilityRule => Boolean(item)),
    metadata: object(source.metadata),
  };
}
