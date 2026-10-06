import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  desc,
  eq,
  inArray,
} from "drizzle-orm";

import {
  withTenantDb,
} from "@/lib/auth";

import {
  ensureTenantPlatformVNext,
} from "@/lib/platform-vnext-db";

import {
  dataSources,
  entityRecords,
  entityTypes,
  recordLinks,
} from "../../../../../../drizzle/platformVNextSchema";

import {
  dynamicSubmissions,
  workItems,
} from "../../../../../../drizzle/applianceSchema";

import {
  mobileCapabilities,
  users,
} from "../../../../../../drizzle/schema";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

function objectValue(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/*
 * BRIXTA_CRM_FIELD_TRACE_V1
 *
 * Canonical Entity Record
 *      ↓ record_links
 * Responsibility Record
 *      ↓
 * Employee + Work Item + Status + Captures
 *
 * Nothing is copied back into the CRM record.
 * The UI reads the linked live state.
 */
export const GET =
  withTenantDb<Context>(
    async (
      _request: NextRequest,
      db,
      _session,
      context,
    ) => {
      await ensureTenantPlatformVNext(
        db,
      );

      const {
        id,
      } =
        await context.params;

      const [
        record,
      ] =
        await db
          .select()
          .from(
            entityRecords,
          )
          .where(
            eq(
              entityRecords.id,
              id,
            ),
          )
          .limit(1);

      if (
        !record
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Business record not found.",
          },
          {
            status: 404,
          },
        );
      }

      const [
        entityType,
      ] =
        await db
          .select()
          .from(
            entityTypes,
          )
          .where(
            eq(
              entityTypes.id,
              record.entityTypeId,
            ),
          )
          .limit(1);

      const [
        source,
      ] =
        entityType
          ? await db
              .select()
              .from(
                dataSources,
              )
              .where(
                eq(
                  dataSources.sourceRef,
                  entityType.key,
                ),
              )
              .limit(1)
          : [];

      /*
       * Prefer source-key-specific links when a Data Source exists.
       * Old links are still discoverable by record ID.
       */
      const links =
        await db
          .select()
          .from(
            recordLinks,
          )
          .where(
            eq(
              recordLinks.fromRecordId,
              id,
            ),
          )
          .orderBy(
            desc(
              recordLinks.createdAt,
            ),
          );

      const linkedRecordIds =
        [
          ...new Set(
            links
              .filter(
                (link) =>
                  link.relationKey ===
                    "responsibility_record" &&
                  (
                    !source ||
                    link.fromSourceKey ===
                      source.key
                  ),
              )
              .map(
                (link) =>
                  link.targetRecordId,
              )
              .filter(Boolean),
          ),
        ];

      const activity =
        linkedRecordIds.length
          ? await db
              .select({
                id:
                  dynamicSubmissions.id,

                status:
                  dynamicSubmissions.status,

                payload:
                  dynamicSubmissions.payload,

                createdAt:
                  dynamicSubmissions.createdAt,

                updatedAt:
                  dynamicSubmissions.updatedAt,

                submittedAt:
                  dynamicSubmissions.submittedAt,

                responsibilityId:
                  mobileCapabilities.id,

                responsibilityKey:
                  mobileCapabilities.key,

                responsibilityTitle:
                  mobileCapabilities.title,

                employeeId:
                  users.id,

                employeeName:
                  users.displayName,

                employeeCode:
                  users.salesmanLoginId,

                workItemId:
                  workItems.id,

                workStatus:
                  workItems.status,

                workPriority:
                  workItems.priority,

                workTitle:
                  workItems.title,

                dueAt:
                  workItems.dueAt,

                startedAt:
                  workItems.startedAt,

                completedAt:
                  workItems.completedAt,
              })
              .from(
                dynamicSubmissions,
              )
              .innerJoin(
                mobileCapabilities,
                eq(
                  dynamicSubmissions.capabilityId,
                  mobileCapabilities.id,
                ),
              )
              .leftJoin(
                users,
                eq(
                  dynamicSubmissions.userId,
                  users.id,
                ),
              )
              .leftJoin(
                workItems,
                eq(
                  dynamicSubmissions.workItemId,
                  workItems.id,
                ),
              )
              .where(
                inArray(
                  dynamicSubmissions.id,
                  linkedRecordIds,
                ),
              )
              .orderBy(
                desc(
                  dynamicSubmissions.updatedAt,
                ),
              )
          : [];

      return NextResponse.json({
        success: true,

        record,

        entityType,

        source:
          source ?? null,

        links,

        activity:
          activity.map(
            (item) => {
              const payload =
                objectValue(
                  item.payload,
                );

              const visibleValues =
                Object.fromEntries(
                  Object.entries(
                    payload,
                  ).filter(
                    ([key]) =>
                      !key.startsWith(
                        "__",
                      ),
                  ),
                );

              return {
                ...item,

                values:
                  visibleValues,

                sourceContext:
                  objectValue(
                    payload.__source,
                  ),

                assignmentContext:
                  objectValue(
                    payload.__assignment,
                  ),
              };
            },
          ),
      });
    },
  );
