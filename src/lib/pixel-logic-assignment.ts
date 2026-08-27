// BRIXTA_PIXEL_LOGIC_KERNEL_V1
import "server-only";

import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/drizzle";
import { platformMeta } from "../../drizzle/platformVNextSchema";

const ASSIGNMENT_PREFIX = "pixel_logic_assignments_employee_";

function assignmentKey(employeeId: number) {
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new Error("Invalid employee id.");
  }
  return `${ASSIGNMENT_PREFIX}${employeeId}`;
}

function normalizeIds(value: unknown) {
  const raw =
    Array.isArray(value)
      ? value
      : value &&
          typeof value === "object" &&
          Array.isArray((value as { responsibilityIds?: unknown }).responsibilityIds)
        ? (value as { responsibilityIds: unknown[] }).responsibilityIds
        : [];

  return [
    ...new Set(
      raw
        .map(Number)
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  ].sort((a, b) => a - b);
}

export async function getPixelLogicAssignmentIds(
  db: AppDatabase,
  employeeId: number,
) {
  const [row] = await db
    .select({ value: platformMeta.value })
    .from(platformMeta)
    .where(eq(platformMeta.key, assignmentKey(employeeId)))
    .limit(1);

  return normalizeIds(row?.value);
}

export async function setPixelLogicAssignmentIds(
  db: AppDatabase,
  employeeId: number,
  responsibilityIds: number[],
) {
  const ids = normalizeIds(responsibilityIds);
  const key = assignmentKey(employeeId);
  const value = {
    responsibilityIds: ids,
    updatedAt: new Date().toISOString(),
  };

  await db
    .insert(platformMeta)
    .values({
      key,
      value,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformMeta.key,
      set: {
        value,
        updatedAt: new Date(),
      },
    });

  return ids;
}

export async function isPixelLogicAssigned(
  db: AppDatabase,
  employeeId: number,
  responsibilityId: number,
) {
  const ids = await getPixelLogicAssignmentIds(db, employeeId);
  return ids.includes(responsibilityId);
}
