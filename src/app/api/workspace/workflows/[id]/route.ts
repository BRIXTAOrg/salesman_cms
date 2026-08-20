import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  eq,
} from "drizzle-orm";

import {
  hasPermission,
  withTenantDb,
} from "@/lib/auth";

import {
  workflowDefinitions,
} from "../../../../../../drizzle/workflowSchema";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export const PATCH =
  withTenantDb<Context>(
    async (
      request: NextRequest,
      db,
      session,
      context,
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
              "You do not have permission to update workflows.",
          },
          {
            status: 403,
          },
        );
      }

      const { id } =
        await context.params;

      const workflowId =
        Number(id);

      if (
        !Number.isInteger(
          workflowId,
        ) ||
        workflowId <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid workflow ID.",
          },
          {
            status: 400,
          },
        );
      }

      const body =
        await request
          .json()
          .catch(() => ({}));

      const update:
        Record<string, unknown> = {
          updatedAt:
            new Date(),
        };

      if (
        "isActive" in body
      ) {
        update.isActive =
          Boolean(
            body.isActive,
          );
      }

      if (
        "name" in body &&
        String(
          body.name ?? "",
        ).trim()
      ) {
        update.name =
          String(
            body.name,
          ).trim();
      }

      if (
        "description" in
        body
      ) {
        update.description =
          String(
            body.description ??
              "",
          ).trim() ||
          null;
      }

      const [updated] =
        await db
          .update(
            workflowDefinitions,
          )
          .set(update)
          .where(
            eq(
              workflowDefinitions.id,
              workflowId,
            ),
          )
          .returning();

      if (!updated) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Workflow not found.",
          },
          {
            status: 404,
          },
        );
      }

      return NextResponse.json({
        success: true,
        workflow:
          updated,
      });
    },
  );
