import "server-only";

import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/drizzle";
import { deviceRegistrations } from "../../../drizzle/applianceSchema";
import { deviceRuntimeAssignments } from "../../../drizzle/roleContextSchema";
import type { RuntimeManifest, RuntimeMode } from "./runtime-types";

export async function getDeviceRuntimeAssignment(
  db: AppDatabase,
  deviceRegistrationId: string,
) {
  const [row] = await db
    .select()
    .from(deviceRuntimeAssignments)
    .where(
      eq(deviceRuntimeAssignments.deviceRegistrationId, deviceRegistrationId),
    )
    .limit(1);

  return row ?? null;
}

export async function setDesiredDeviceRuntime(
  db: AppDatabase,
  args: {
    deviceRegistrationId: string;
    manifest: RuntimeManifest;
    mode: RuntimeMode;
    updatedByUserId?: number | null;
  },
) {
  const [device] = await db
    .select({ id: deviceRegistrations.id })
    .from(deviceRegistrations)
    .where(eq(deviceRegistrations.id, args.deviceRegistrationId))
    .limit(1);

  if (!device) {
    throw new Error(`Device registration ${args.deviceRegistrationId} does not exist.`);
  }

  const existing = await getDeviceRuntimeAssignment(
    db,
    args.deviceRegistrationId,
  );
  const desiredGeneration = Math.max(
    args.manifest.generation,
    (existing?.desiredGeneration ?? 0) + 1,
  );

  const manifest: RuntimeManifest = {
    ...args.manifest,
    generation: desiredGeneration,
  };

  const [saved] = await db
    .insert(deviceRuntimeAssignments)
    .values({
      deviceRegistrationId: args.deviceRegistrationId,
      desiredGeneration,
      installedGeneration: existing?.installedGeneration ?? 0,
      mode: args.mode,
      desiredManifest: manifest as unknown as Record<string, unknown>,
      updatedByUserId: args.updatedByUserId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: deviceRuntimeAssignments.deviceRegistrationId,
      set: {
        desiredGeneration,
        mode: args.mode,
        desiredManifest: manifest as unknown as Record<string, unknown>,
        updatedByUserId: args.updatedByUserId ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}

export async function acknowledgeInstalledRuntime(
  db: AppDatabase,
  args: {
    deviceRegistrationId: string;
    generation: number;
  },
) {
  const current = await getDeviceRuntimeAssignment(
    db,
    args.deviceRegistrationId,
  );
  if (!current) {
    throw new Error("No desired runtime exists for this device.");
  }

  if (args.generation > current.desiredGeneration) {
    throw new Error(
      `Device cannot acknowledge future generation ${args.generation}; desired is ${current.desiredGeneration}.`,
    );
  }

  const [updated] = await db
    .update(deviceRuntimeAssignments)
    .set({
      installedGeneration: args.generation,
      lastAcknowledgedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      eq(deviceRuntimeAssignments.deviceRegistrationId, args.deviceRegistrationId),
    )
    .returning();

  return updated;
}
