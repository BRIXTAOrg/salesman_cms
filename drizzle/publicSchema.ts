import {
  pgTable,
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Global tenant registry.
 *
 * This table intentionally lives in PostgreSQL's public schema. Tenant
 * resolution happens here before a request can be scoped to a company
 * schema.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    schemaName: text("schema_name").notNull(),
    phoneNumber: varchar("phone_number", { length: 50 }),
    email: varchar("email", { length: 255 }),
    officeAddress: text("office_address"),
    adminName: varchar("admin_name", { length: 255 }),
    adminEmail: varchar("admin_email", { length: 255 }),
    adminPasswordHash: text("admin_password_hash"),
    isProvisioned: boolean("is_provisioned").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: false }).default(
      sql`now()`,
    ),
  },
  (table) => [
    uniqueIndex("organizations_schema_name_key").on(table.schemaName),
  ],
);

/**
 * Plan-independent feature entitlements.
 *
 * IMPORTANT:
 * The application should ask "is feature X enabled?" instead of checking
 * plan names such as Basic/Pro/Enterprise. Pricing tiers can later map to
 * these feature keys without changing product authorization logic.
 */
export const organizationEntitlements = pgTable(
  "organization_entitlements",
  {
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    featureKey: varchar("feature_key", { length: 160 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    limitValue: integer("limit_value"),

    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    source: varchar("source", { length: 40 })
      .notNull()
      .default("system"),

    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.featureKey],
    }),
    index("idx_org_entitlements_feature").on(table.featureKey),
    index("idx_org_entitlements_org_enabled").on(
      table.organizationId,
      table.enabled,
    ),
  ],
);
