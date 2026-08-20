import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  desc,
  eq,
} from "drizzle-orm";

import {
  withTenantDb,
} from "@/lib/auth";

import {
  mobileCapabilities,
  users,
} from "../../../../../../drizzle/schema";

import {
  dynamicSubmissions,
} from "../../../../../../drizzle/applianceSchema";

type Context = {
  params: Promise<{
    key: string;
  }>;
};

export const GET =
  withTenantDb<Context>(
    async (
      _request: NextRequest,
      db,
      _session,
      context,
    ) => {
      const { key } =
        await context.params;

      const normalizedKey =
        String(key)
          .trim()
          .toLowerCase();

      const [capability] =
        await db
          .select()
          .from(
            mobileCapabilities,
          )
          .where(
            and(
              eq(
                mobileCapabilities.key,
                normalizedKey,
              ),
              eq(
                mobileCapabilities.isActive,
                true,
              ),
            ),
          )
          .limit(1);

      if (!capability) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Responsibility not found or disabled.",
          },
          {
            status: 404,
          },
        );
      }

      const submissions =
        await db
          .select({
            id:
              dynamicSubmissions.id,
            status:
              dynamicSubmissions.status,
            payload:
              dynamicSubmissions.payload,
            submittedAt:
              dynamicSubmissions.submittedAt,
            userId:
              dynamicSubmissions.userId,
            employeeName:
              users.displayName,
            employeeCode:
              users.salesmanLoginId,
          })
          .from(
            dynamicSubmissions,
          )
          .leftJoin(
            users,
            eq(
              dynamicSubmissions.userId,
              users.id,
            ),
          )
          .where(
            eq(
              dynamicSubmissions.capabilityId,
              capability.id,
            ),
          )
          .orderBy(
            desc(
              dynamicSubmissions.submittedAt,
            ),
          )
          .limit(200);

      return NextResponse.json({
        success: true,
        capability,
        submissions,
      });
    },
  );
