import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import {
  organizationEntitlements,
  organizations,
} from "../../drizzle/publicSchema";

export const ENTITLEMENT_KEYS = {
  ATTENDANCE_USE: "attendance.use",
  LEAVE_USE: "leave.use",
  JOURNEY_PLAN_USE: "journey_plan.use",
  VISIT_REPORT_USE: "visit_report.use",

  RESPONSIBILITY_CREATE: "responsibility.create",
  WORKFLOW_CUSTOMIZE: "workflow.customize",
} as const;

export type EntitlementKey =
  (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS];

export type EntitlementFlags = Record<string, boolean>;

const SCHEMA_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

function isCurrentlyEffective(
  row: {
    enabled: boolean;
    startsAt: Date | null;
    expiresAt: Date | null;
  },
  now: Date,
) {
  if (!row.enabled) return false;
  if (row.startsAt && row.startsAt > now) return false;
  if (row.expiresAt && row.expiresAt <= now) return false;
  return true;
}

export async function getTenantEntitlements(
  schemaName: string,
): Promise<EntitlementFlags> {
  const normalizedSchema = String(schemaName ?? "")
    .trim()
    .toLowerCase();

  if (!SCHEMA_NAME_PATTERN.test(normalizedSchema)) {
    return {};
  }

  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.schemaName, normalizedSchema))
    .limit(1);

  if (!organization) {
    return {};
  }

  const rows = await db
    .select({
      featureKey: organizationEntitlements.featureKey,
      enabled: organizationEntitlements.enabled,
      startsAt: organizationEntitlements.startsAt,
      expiresAt: organizationEntitlements.expiresAt,
    })
    .from(organizationEntitlements)
    .where(
      eq(
        organizationEntitlements.organizationId,
        organization.id,
      ),
    );

  const now = new Date();

  return Object.fromEntries(
    rows.map((row) => [
      row.featureKey,
      isCurrentlyEffective(row, now),
    ]),
  );
}

export async function hasTenantEntitlement(
  schemaName: string,
  featureKey: string,
): Promise<boolean> {
  const entitlements = await getTenantEntitlements(schemaName);
  return entitlements[featureKey] === true;
}
