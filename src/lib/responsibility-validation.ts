import type {
  PlatformDataSource,
  ResponsibilityExtensionConfig,
  ResponsibilityValidationIssue,
} from "@/lib/platform-vnext-types";
import {
  BUILT_IN_SOURCE_KEYS,
  SUPPORTED_OUTPUT_RENDERERS,
  SUPPORTED_SMART_BLOCKS,
} from "@/lib/responsibility-power-catalog";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function baseFieldKeys(baseDefinition: Record<string, unknown>) {
  const input = asObject(baseDefinition.input);
  return new Set(
    asArray(input.fields)
      .map((item) => asObject(item).key)
      .filter((key): key is string => typeof key === "string" && key.length > 0),
  );
}

function baseActionKeys(baseDefinition: Record<string, unknown>) {
  const app = asObject(baseDefinition.app);
  return new Set(
    asArray(app.actions)
      .map((item) => asObject(item).key)
      .filter((key): key is string => typeof key === "string" && key.length > 0),
  );
}

function push(
  issues: ResponsibilityValidationIssue[],
  code: string,
  severity: "error" | "warning",
  path: string,
  message: string,
) {
  issues.push({ code, severity, path, message });
}

export function validateResponsibilityDefinition(args: {
  baseDefinition: Record<string, unknown>;
  extension: ResponsibilityExtensionConfig;
  roles: Array<{ id: number }>;
  dataSources: Array<Pick<PlatformDataSource, "key" | "allowedFields">>;
}) {
  const issues: ResponsibilityValidationIssue[] = [];
  const fieldKeys = baseFieldKeys(args.baseDefinition);
  const actionKeys = baseActionKeys(args.baseDefinition);
  const queryKeys = new Set(args.extension.queries.map((item) => item.key));
  const computedKeys = new Set(args.extension.computedFields.map((item) => item.key));
  const roleIds = new Set(args.roles.map((role) => role.id));
  const sourceKeys = new Set([
    ...args.dataSources.map((source) => source.key),
    ...BUILT_IN_SOURCE_KEYS,
  ]);

  for (const block of args.extension.smartBlocks) {
    if (!SUPPORTED_SMART_BLOCKS.has(block.kind)) {
      push(
        issues,
        "UNSUPPORTED_SMART_BLOCK",
        "error",
        `smartBlocks.${block.key}`,
        `The smart block “${block.kind}” is not supported by manifest v2.`,
      );
    }

    if (
      (block.kind === "entity_reference" ||
        block.kind === "responsibility_reference") &&
      (!block.sourceKey || !sourceKeys.has(block.sourceKey))
    ) {
      push(
        issues,
        "SMART_BLOCK_SOURCE_REQUIRED",
        "error",
        `smartBlocks.${block.key}.sourceKey`,
        `${block.label} needs a valid Data Source.`,
      );
    }
  }

  for (const reference of args.extension.references) {
    if (!reference.sourceKey || !sourceKeys.has(reference.sourceKey)) {
      push(
        issues,
        "REFERENCE_SOURCE_MISSING",
        "error",
        `references.${reference.key}.sourceKey`,
        `${reference.label} needs a valid Data Source.`,
      );
    }

    for (const [index, filter] of (reference.filter ?? []).entries()) {
      if (!filter.sourceField.trim()) {
        push(
          issues,
          "REFERENCE_FILTER_FIELD_MISSING",
          "error",
          `references.${reference.key}.filter.${index}`,
          `${reference.label} has a filter with no source field.`,
        );
      }
    }
  }

  for (const query of args.extension.queries) {
    if (!query.sourceKey || !sourceKeys.has(query.sourceKey)) {
      push(
        issues,
        "QUERY_SOURCE_MISSING",
        "error",
        `queries.${query.key}.sourceKey`,
        `${query.label} needs a valid Data Source.`,
      );
    }

    if (query.mode === "many" && (!query.limit || query.limit < 1)) {
      push(
        issues,
        "QUERY_LIMIT_REQUIRED",
        "error",
        `queries.${query.key}.limit`,
        `${query.label} needs a positive result limit.`,
      );
    }

    for (const [index, filter] of (query.filter ?? []).entries()) {
      if (!filter.sourceField.trim()) {
        push(
          issues,
          "QUERY_FILTER_FIELD_MISSING",
          "error",
          `queries.${query.key}.filter.${index}`,
          `${query.label} has a filter with no source field.`,
        );
      }
    }
  }

  for (const policy of args.extension.memoryPolicies) {
    if (!fieldKeys.has(policy.fieldKey)) {
      push(
        issues,
        "MEMORY_FIELD_MISSING",
        "error",
        `memoryPolicies.${policy.fieldKey}`,
        `Memory policy references missing field “${policy.fieldKey}”.`,
      );
    }
    if (policy.mode === "ttl" && (!policy.ttlSeconds || policy.ttlSeconds <= 0)) {
      push(
        issues,
        "MEMORY_TTL_INVALID",
        "error",
        `memoryPolicies.${policy.fieldKey}.ttlSeconds`,
        `TTL for ${policy.fieldKey} must be greater than zero.`,
      );
    }
    if (
      policy.mode === "every_n_uses" &&
      (!policy.everyNUses || policy.everyNUses <= 0)
    ) {
      push(
        issues,
        "MEMORY_USE_COUNT_INVALID",
        "error",
        `memoryPolicies.${policy.fieldKey}.everyNUses`,
        `Every-N-uses policy for ${policy.fieldKey} needs a positive count.`,
      );
    }
  }

  for (const behavior of args.extension.fieldBehaviors) {
    if (!fieldKeys.has(behavior.fieldKey)) {
      push(
        issues,
        "FIELD_BEHAVIOR_FIELD_MISSING",
        "error",
        `fieldBehaviors.${behavior.fieldKey}`,
        `Field behavior references missing field “${behavior.fieldKey}”.`,
      );
    }
  }

  for (const rule of args.extension.rules) {
    if (
      rule.phase === "before_action" &&
      rule.actionKey &&
      !actionKeys.has(rule.actionKey)
    ) {
      push(
        issues,
        "RULE_ACTION_MISSING",
        "error",
        `rules.${rule.key}.actionKey`,
        `${rule.label} points to an action that no longer exists.`,
      );
    }

    if (
      ["require_field", "show_field", "hide_field"].includes(rule.effect) &&
      (!rule.targetFieldKey || !fieldKeys.has(rule.targetFieldKey))
    ) {
      push(
        issues,
        "RULE_TARGET_FIELD_MISSING",
        "error",
        `rules.${rule.key}.targetFieldKey`,
        `${rule.label} needs a valid target field.`,
      );
    }

    const left = rule.condition.left;
    if (left.kind === "field" && !fieldKeys.has(left.fieldKey)) {
      push(
        issues,
        "RULE_FIELD_MISSING",
        "error",
        `rules.${rule.key}.condition.left`,
        `${rule.label} references missing field “${left.fieldKey}”.`,
      );
    }
    if (left.kind === "query" && !queryKeys.has(left.queryKey)) {
      push(
        issues,
        "RULE_QUERY_MISSING",
        "error",
        `rules.${rule.key}.condition.left`,
        `${rule.label} references missing query “${left.queryKey}”.`,
      );
    }
    if (left.kind === "computed" && !computedKeys.has(left.computedKey)) {
      push(
        issues,
        "RULE_COMPUTED_MISSING",
        "error",
        `rules.${rule.key}.condition.left`,
        `${rule.label} references missing computed value “${left.computedKey}”.`,
      );
    }
  }

  if (args.extension.session.enabled) {
    if (args.extension.session.sampleEverySeconds <= 0) {
      push(
        issues,
        "SESSION_INTERVAL_INVALID",
        "error",
        "session.sampleEverySeconds",
        "Route sampling interval must be greater than zero seconds.",
      );
    }
    if (args.extension.session.sampleEveryMeters < 0) {
      push(
        issues,
        "SESSION_DISTANCE_INVALID",
        "error",
        "session.sampleEveryMeters",
        "Route sampling distance cannot be negative.",
      );
    }
    if (args.extension.session.minimumAccuracyMeters <= 0) {
      push(
        issues,
        "SESSION_ACCURACY_INVALID",
        "error",
        "session.minimumAccuracyMeters",
        "Minimum accepted GPS accuracy must be greater than zero.",
      );
    }
  }

  const flowKeys = new Set<string>();
  if (args.extension.flow.enabled) {
    if (args.extension.flow.steps.length === 0) {
      push(
        issues,
        "FLOW_EMPTY",
        "error",
        "flow.steps",
        "Enabled workflow needs at least one step.",
      );
    }

    for (const [index, step] of args.extension.flow.steps.entries()) {
      if (!step.key || flowKeys.has(step.key)) {
        push(
          issues,
          "FLOW_STEP_KEY_INVALID",
          "error",
          `flow.steps.${index}.key`,
          "Workflow step keys must be unique and non-empty.",
        );
      }
      flowKeys.add(step.key);

      if (step.actor.kind === "role") {
        if (!step.actor.roleId || !roleIds.has(step.actor.roleId)) {
          push(
            issues,
            "FLOW_ROLE_MISSING",
            "error",
            `flow.steps.${index}.actor.roleId`,
            `${step.label} needs an existing Role.`,
          );
        }
      }
      if (step.actor.kind === "specific_user" && !step.actor.userId) {
        push(
          issues,
          "FLOW_USER_MISSING",
          "error",
          `flow.steps.${index}.actor.userId`,
          `${step.label} needs a specific user.`,
        );
      }
    }
  }

  const accessRoleFields = [
    "useRoleIds",
    "readRoleIds",
    "createRoleIds",
    "updateRoleIds",
    "deleteRoleIds",
    "reviewRoleIds",
    "viewOutputRoleIds",
  ] as const;

  for (const field of accessRoleFields) {
    for (const roleId of args.extension.access[field]) {
      if (!roleIds.has(roleId)) {
        push(
          issues,
          "ACCESS_ROLE_MISSING",
          "error",
          `access.${field}`,
          `Access policy references deleted Role #${roleId}.`,
        );
      }
    }
  }

  if (!SUPPORTED_OUTPUT_RENDERERS.has(args.extension.outputDesign.renderer)) {
    push(
      issues,
      "OUTPUT_RENDERER_UNSUPPORTED",
      "error",
      "outputDesign.renderer",
      `Output renderer “${args.extension.outputDesign.renderer}” is not supported.`,
    );
  }

  const availableOutputKeys = new Set([
    ...fieldKeys,
    ...computedKeys,
    ...args.extension.references.map((item) => item.key),
    ...args.extension.evidenceBundles.map((item) => item.key),
  ]);
  for (const fieldKey of args.extension.outputDesign.visibleFieldKeys) {
    if (!availableOutputKeys.has(fieldKey)) {
      push(
        issues,
        "OUTPUT_FIELD_MISSING",
        "warning",
        "outputDesign.visibleFieldKeys",
        `Output references “${fieldKey}”, which is not currently produced by this Responsibility.`,
      );
    }
  }

  if (
    args.extension.offline.enabled &&
    args.extension.references.some(
      (reference) => reference.required && reference.offline?.enabled === false,
    )
  ) {
    push(
      issues,
      "OFFLINE_REQUIRED_REFERENCE",
      "warning",
      "offline",
      "Offline mode is enabled, but at least one required reference is not cached offline.",
    );
  }

  if (
    args.extension.access.useRoleIds.length === 0 &&
    args.extension.access.createRoleIds.length === 0
  ) {
    push(
      issues,
      "ACCESS_OPEN_BY_ASSIGNMENT",
      "warning",
      "access",
      "No role restriction is configured; assignment rules/backend policy will decide who can use this Responsibility.",
    );
  }

  return issues;
}

export function hasPublishBlockingIssues(issues: ResponsibilityValidationIssue[]) {
  return issues.some((issue) => issue.severity === "error");
}
