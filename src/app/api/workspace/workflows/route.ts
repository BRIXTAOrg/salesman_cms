import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  asc,
  eq,
} from "drizzle-orm";

import {
  hasPermission,
  withTenantDb,
} from "@/lib/auth";

import {
  mobileCapabilities,
  roles,
} from "../../../../../drizzle/schema";

import {
  actionDefinitions,
  approvalPolicies,
  approvalPolicyActors,
  workflowDefinitions,
  workflowStepDependencies,
  workflowSteps,
  workflowVersions,
} from "../../../../../drizzle/workflowSchema";

function normalizeKey(input: unknown) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function objectValue(value: unknown) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function ensureAction(
  db: any,
  actionRef: string,
) {
  const [kind, rawId] =
    actionRef.split(":");

  const id = Number(rawId);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      "Invalid workflow action.",
    );
  }

  if (kind === "action") {
    const [action] = await db
      .select()
      .from(actionDefinitions)
      .where(
        eq(
          actionDefinitions.id,
          id,
        ),
      )
      .limit(1);

    if (!action) {
      throw new Error(
        "Workflow action was not found.",
      );
    }

    return action;
  }

  if (kind !== "capability") {
    throw new Error(
      "Unsupported action reference.",
    );
  }

  const [capability] = await db
    .select()
    .from(mobileCapabilities)
    .where(
      and(
        eq(
          mobileCapabilities.id,
          id,
        ),
        eq(
          mobileCapabilities.isActive,
          true,
        ),
      ),
    )
    .limit(1);

  if (!capability) {
    throw new Error(
      "Responsibility was not found.",
    );
  }

  const actionKey =
    `capability.${capability.key}.submit`;

  const [created] = await db
    .insert(actionDefinitions)
    .values({
      key: actionKey,
      title:
        `Submit ${capability.title}`,
      permissionKey:
        `capability.${capability.key}.use`,
      entitlementKey: null,
      handlerKey:
        "capability.submit",
      capabilityId:
        capability.id,
      isActive: true,
      config: {
        origin:
          "responsibility",
        capabilityKey:
          capability.key,
      },
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const [existing] = await db
    .select()
    .from(actionDefinitions)
    .where(
      eq(
        actionDefinitions.key,
        actionKey,
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(
      "Unable to resolve responsibility action.",
    );
  }

  return existing;
}

export const GET = withTenantDb(
  async (
    _request: NextRequest,
    db,
  ) => {
    const [
      workflows,
      versions,
      steps,
      actions,
      capabilities,
      roleRows,
    ] = await Promise.all([
      db
        .select()
        .from(workflowDefinitions)
        .orderBy(
          asc(
            workflowDefinitions.name,
          ),
        ),

      db
        .select()
        .from(workflowVersions)
        .orderBy(
          asc(
            workflowVersions.workflowId,
          ),
          asc(
            workflowVersions.version,
          ),
        ),

      db
        .select({
          id: workflowSteps.id,
          workflowVersionId:
            workflowSteps.workflowVersionId,
          stepKey:
            workflowSteps.stepKey,
          title:
            workflowSteps.title,
          stepType:
            workflowSteps.stepType,
          sortOrder:
            workflowSteps.sortOrder,
          actionDefinitionId:
            workflowSteps.actionDefinitionId,
          actionKey:
            actionDefinitions.key,
          actionTitle:
            actionDefinitions.title,
          approvalPolicyId:
            workflowSteps.approvalPolicyId,
        })
        .from(workflowSteps)
        .leftJoin(
          actionDefinitions,
          eq(
            workflowSteps.actionDefinitionId,
            actionDefinitions.id,
          ),
        )
        .orderBy(
          asc(
            workflowSteps.workflowVersionId,
          ),
          asc(
            workflowSteps.sortOrder,
          ),
        ),

      db
        .select()
        .from(actionDefinitions)
        .where(
          eq(
            actionDefinitions.isActive,
            true,
          ),
        )
        .orderBy(
          asc(actionDefinitions.title),
        ),

      db
        .select()
        .from(mobileCapabilities)
        .where(
          eq(
            mobileCapabilities.isActive,
            true,
          ),
        )
        .orderBy(
          asc(
            mobileCapabilities.title,
          ),
        ),

      db
        .select({
          id: roles.id,
          orgRole: roles.orgRole,
          jobRole: roles.jobRole,
        })
        .from(roles)
        .orderBy(
          asc(roles.orgRole),
          asc(roles.jobRole),
        ),
    ]);

    return NextResponse.json({
      success: true,

      workflows: workflows.map(
        (workflow) => ({
          ...workflow,

          versions:
            versions.filter(
              (version) =>
                version.workflowId ===
                workflow.id,
            ),

          steps: steps.filter(
            (step) =>
              versions.some(
                (version) =>
                  version.workflowId ===
                    workflow.id &&
                  version.id ===
                    step.workflowVersionId,
              ),
          ),
        }),
      ),

      actions: [
        ...actions.map(
          (action) => ({
            value:
              `action:${action.id}`,
            key: action.key,
            title: action.title,
            kind: "action",
          }),
        ),

        ...capabilities.map(
          (capability) => ({
            value:
              `capability:${capability.id}`,
            key:
              `capability.${capability.key}.submit`,
            title:
              capability.title,
            kind:
              "responsibility",
          }),
        ),
      ],

      roles: roleRows.map(
        (role) => ({
          id: role.id,
          label:
            role.jobRole &&
            role.orgRole
              ? `${role.orgRole} · ${role.jobRole}`
              : role.orgRole ??
                role.jobRole ??
                `Role ${role.id}`,
        }),
      ),
    });
  },
);

export const POST = withTenantDb(
  async (
    request: NextRequest,
    db,
    session,
  ) => {
    if (
      !hasPermission(
        session.permissions,
        [
          "WRITE",
          "UPDATE",
          "ALL_ACCESS",
        ],
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have permission to create workflows.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      objectValue(
        await request
          .json()
          .catch(() => ({})),
      );

    const name =
      String(
        body.name ?? "",
      ).trim();

    const description =
      String(
        body.description ?? "",
      ).trim() || null;

    const key =
      normalizeKey(
        body.key || name,
      );

    const rawSteps =
      Array.isArray(body.steps)
        ? body.steps
        : [];

    if (
      !name ||
      !key ||
      rawSteps.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Workflow name and at least one step are required.",
        },
        {
          status: 400,
        },
      );
    }

    const [existing] = await db
      .select({
        id:
          workflowDefinitions.id,
      })
      .from(workflowDefinitions)
      .where(
        eq(
          workflowDefinitions.key,
          key,
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A workflow with this key already exists.",
        },
        {
          status: 409,
        },
      );
    }

    const [workflow] = await db
      .insert(
        workflowDefinitions,
      )
      .values({
        key,
        name,
        description,
        isActive: true,
        createdByUserId:
          session.userId,
      })
      .returning();

    const [version] = await db
      .insert(
        workflowVersions,
      )
      .values({
        workflowId:
          workflow.id,
        version: 1,
        status: "published",
        createdByUserId:
          session.userId,
        publishedAt:
          new Date(),
      })
      .returning();

    let previous:
      | {
          id: number;
          type: string;
        }
      | null = null;

    for (
      let index = 0;
      index < rawSteps.length;
      index += 1
    ) {
      const raw =
        objectValue(
          rawSteps[index],
        );

      const title =
        String(
          raw.title ??
            `Step ${index + 1}`,
        ).trim();

      const stepType =
        raw.stepType ===
        "approval"
          ? "approval"
          : "action";

      const actionRef =
        String(
          raw.actionRef ?? "",
        ).trim();

      if (!actionRef) {
        throw new Error(
          `${title} needs an action.`,
        );
      }

      const action =
        await ensureAction(
          db,
          actionRef,
        );

      let approvalPolicyId:
        number | null = null;

      if (
        stepType === "approval"
      ) {
        const roleIds =
          Array.isArray(
            raw.approverRoleIds,
          )
            ? raw.approverRoleIds
                .map(Number)
                .filter(
                  (id) =>
                    Number.isInteger(
                      id,
                    ) &&
                    id > 0,
                )
            : [];

        if (
          roleIds.length === 0
        ) {
          throw new Error(
            `${title} needs at least one approver role.`,
          );
        }

        const policyKey =
          `${key}_step_${index + 1}_${normalizeKey(title)}_approval`;

        const [policy] =
          await db
            .insert(
              approvalPolicies,
            )
            .values({
              key:
                policyKey,
              name:
                `${name} — ${title}`,
              mode: "any",
              minimumApprovals:
                1,
              enabled: true,
              config: {
                origin:
                  "workflow_builder",
              },
              createdByUserId:
                session.userId,
            })
            .returning();

        approvalPolicyId =
          policy.id;

        await db
          .insert(
            approvalPolicyActors,
          )
          .values(
            roleIds.map(
              (roleId) => ({
                policyId:
                  policy.id,
                subjectType:
                  "role",
                roleId,
                sequence: 0,
                enabled: true,
                scopeConfig: {},
              }),
            ),
          );
      }

      const stepKey =
        `step_${index + 1}_${normalizeKey(raw.key || title) || "work"}`;

      const [step] =
        await db
          .insert(
            workflowSteps,
          )
          .values({
            workflowVersionId:
              version.id,
            stepKey,
            title,
            stepType,
            actionDefinitionId:
              action.id,
            approvalPolicyId,
            sortOrder:
              (index + 1) *
              10,
            config: {
              origin:
                "workflow_builder",
            },
          })
          .returning();

      if (previous) {
        await db
          .insert(
            workflowStepDependencies,
          )
          .values({
            stepId:
              step.id,
            dependsOnStepId:
              previous.id,
            requiredStatus:
              previous.type ===
              "approval"
                ? "approved"
                : "completed",
          });
      }

      previous = {
        id: step.id,
        type: stepType,
      };
    }

    return NextResponse.json(
      {
        success: true,
        workflow,
        version,
      },
      {
        status: 201,
      },
    );
  },
);
