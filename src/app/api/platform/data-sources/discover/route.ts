import { NextResponse } from "next/server";
import { asc, sql } from "drizzle-orm";

import { withTenantDb } from "@/lib/auth";
import { mobileCapabilities } from "../../../../../../drizzle/schema";
import { entityTypes } from "../../../../../../drizzle/platformVNextSchema";

const SYSTEM_TABLES = new Set([
  "users",
  "roles",
  "user_roles",
  "mobile_capabilities",
  "user_mobile_capabilities",
  "dynamic_submissions",
  "responsibility_rules",
  "action_definitions",
  "workflow_definitions",
  "workflow_versions",
  "workflow_steps",
  "workflow_step_dependencies",
  "workflow_instances",
  "workflow_step_instances",
  "approval_policies",
  "approval_policy_actors",
  "data_sources",
  "responsibility_extensions",
  "responsibility_versions",
  "compiled_responsibility_manifests",
  "record_links",
  "entity_field_memory",
  "platform_audit_events",
  "platform_meta",
  "entity_types",
  "entity_records",
  "responsibility_records",
]);

export const GET = withTenantDb(async (_request, db) => {
  const tableResult = await db.execute(sql`
    SELECT
      table_name,
      json_agg(
        json_build_object(
          'name', column_name,
          'dataType', data_type,
          'nullable', is_nullable = 'YES'
        )
        ORDER BY ordinal_position
      ) AS columns
    FROM information_schema.columns
    WHERE table_schema = current_schema()
    GROUP BY table_name
    ORDER BY table_name
  `);

  const tables = (tableResult.rows as Array<{
    table_name: string;
    columns: Array<{
      name: string;
      dataType: string;
      nullable: boolean;
    }>;
  }>)
    .filter((row) => !SYSTEM_TABLES.has(row.table_name))
    .map((row) => ({
      kind: "table" as const,
      sourceRef: row.table_name,
      title: row.table_name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (value) => value.toUpperCase()),
      columns: row.columns ?? [],
    }));

  const responsibilities = await db
    .select({
      id: mobileCapabilities.id,
      key: mobileCapabilities.key,
      title: mobileCapabilities.title,
    })
    .from(mobileCapabilities)
    .where(sql`${mobileCapabilities.isActive} = true`)
    .orderBy(asc(mobileCapabilities.title));

  const entities = await db
    .select({
      id: entityTypes.id,
      key: entityTypes.key,
      title: entityTypes.title,
      fieldDefinitions: entityTypes.fieldDefinitions,
    })
    .from(entityTypes)
    .where(sql`${entityTypes.isActive} = true`)
    .orderBy(asc(entityTypes.title));

  return NextResponse.json({
    success: true,
    discovered: [
      ...entities.map((item) => ({
        kind: "entity_store" as const,
        sourceRef: item.key,
        title: item.title,
        entityTypeId: item.id,
        columns: (item.fieldDefinitions ?? []).map((field) => ({
          name: field.key,
          dataType: field.dataType,
          nullable: field.required !== true,
        })),
      })),
      ...tables,
      ...responsibilities.map((item) => ({
        kind: "responsibility_records" as const,
        sourceRef: item.key,
        title: `${item.title} records`,
        responsibilityId: item.id,
        columns: [],
      })),
    ],
  });
});
