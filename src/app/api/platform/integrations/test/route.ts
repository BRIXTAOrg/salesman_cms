import {
  NextResponse,
} from "next/server";

import {
  hasPermission,
  withTenantDb,
} from "@/lib/auth";

import {
  ensureTenantPlatformVNext,
} from "@/lib/platform-vnext-db";

import {
  executeApiIntegrationOperation,
} from "@/lib/api-integration-runtime";

import type {
  ApiIntegrationTestRequest,
} from "@/lib/api-integration-contract";


export const POST =
  withTenantDb(
    async (
      req,
      db,
      session,
    ) => {
      if (
        !hasPermission(
          session.permissions,
          [
            "WRITE",
            "UPDATE",
          ],
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Forbidden",
          },
          {
            status:
              403,
          },
        );
      }


      await ensureTenantPlatformVNext(
        db,
      );


      const body =
        await req.json() as {
          integrationId?:
            string;

          operationId?:
            string;

          request?:
            ApiIntegrationTestRequest;
        };


      if (
        !body.integrationId ||
        !body.operationId
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "integrationId and operationId are required.",
          },
          {
            status:
              400,
          },
        );
      }


      try {
        const result =
          await executeApiIntegrationOperation(
            db,
            body.integrationId,
            body.operationId,
            body.request ??
            {},
          );


        return NextResponse.json({
          success:
            true,

          result,
        });
      } catch (
        error
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              error instanceof Error
                ? error.message
                : "Integration test failed.",
          },
          {
            status:
              400,
          },
        );
      }
    },
  );
