import {
  foreignKey,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { deviceRegistrations } from "./applianceSchema";
import { roles, users } from "./schema";

/**
 * One profile per stable Role ID.
 *
 * Role Context is configuration. Actual reporting relationships still live on
 * users.reports_to_id; workflows resolve those actual relationships at runtime.
 */
export const roleContextProfiles = pgTable(
  "role_context_profiles",
  {
    roleId: integer("role_id").primaryKey(),
    schemaVersion: integer("schema_version").notNull().default(1),
    definition: jsonb("definition")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedByUserId: integer("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: "role_context_profiles_role_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "role_context_profiles_updated_by_user_id_fkey",
    }).onDelete("set null"),
  ],
);

/**
 * Desired-state control plane for one registered device.
 *
 * Business records are NOT stored here. Wiping/replacing this runtime therefore
 * cannot delete dynamic_submissions, attendance history, photos, approvals, etc.
 */
export const deviceRuntimeAssignments = pgTable(
  "device_runtime_assignments",
  {
    deviceRegistrationId: uuid("device_registration_id").primaryKey(),
    desiredGeneration: integer("desired_generation").notNull().default(0),
    installedGeneration: integer("installed_generation").notNull().default(0),
    mode: varchar("mode", { length: 30 }).notNull().default("published"),
    desiredManifest: jsonb("desired_manifest")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedByUserId: integer("updated_by_user_id"),
    lastAcknowledgedAt: timestamp("last_acknowledged_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.deviceRegistrationId],
      foreignColumns: [deviceRegistrations.id],
      name: "device_runtime_assignments_device_registration_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "device_runtime_assignments_updated_by_user_id_fkey",
    }).onDelete("set null"),
  ],
);
