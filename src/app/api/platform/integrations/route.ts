import {
  NextRequest,
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
  deleteApiIntegration,
  listApiIntegrations,
  saveApiIntegration,
} from "@/lib/api-integration-store";

import {
  validateApiIntegration,
  type ApiIntegrationDefinition,
} from "@/lib/api-integration-contract";


export const GET =
  withTenantDb(
    async (
      _req,
      db,
    ) => {
      await ensureTenantPlatformVNext(
        db,
      );

      return NextResponse.json({
        success:
          true,

        integrations:
          await listApiIntegrations(
            db,
          ),
      });
    },
  );


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
          integration?:
            ApiIntegrationDefinition;

          secrets?:
            Record<string, string>;

          publish?:
            boolean;
        };


      if (
        !body.integration
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "integration is required.",
          },
          {
            status:
              400,
          },
        );
      }


      const integration:
        ApiIntegrationDefinition = {
        ...body.integration,

        status:
          body.publish
            ? "published"
            : body.integration
                .status ===
              "published"
              ? "published"
              : "draft",

        publishedAt:
          body.publish
            ? new Date()
                .toISOString()
            : body.integration
                .publishedAt ??
              null,
      };


      const issues =
        validateApiIntegration(
          integration,
        );


      if (
        issues.length
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              issues.join(
                "\n",
              ),
          },
          {
            status:
              400,
          },
        );
      }


      const saved =
        await saveApiIntegration(
          db,
          integration,
          body.secrets ??
          {},
        );


      if (
        body.publish
      ) {
        const missing =
          saved.auth
            .credentialFields
            .filter(
              (
                field,
              ) =>
                field.required !==
                  false &&
                !saved
                  .credentialStatus[
                  field.key
                ],
            );

        if (
          missing.length
        ) {
          /*
           * Save remains valid as draft-like configuration,
           * but publication is rejected until credentials exist.
           */
          await saveApiIntegration(
            db,
            {
              ...integration,
              status:
                "draft",
              publishedAt:
                null,
            },
            {},
          );

          return NextResponse.json(
            {
              success:
                false,

              error:
                `Missing required credentials: ${missing.map((field) => field.label).join(", ")}`,
            },
            {
              status:
                400,
            },
          );
        }
      }


      return NextResponse.json({
        success:
          true,

        integration:
          saved,
      });
    },
  );


export const DELETE =
  withTenantDb(
    async (
      req:
        NextRequest,
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


      const id =
        new URL(
          req.url,
        ).searchParams.get(
          "id",
        );


      if (
        !id
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "id is required.",
          },
          {
            status:
              400,
          },
        );
      }


      const deleted =
        await deleteApiIntegration(
          db,
          id,
        );


      return NextResponse.json({
        success:
          true,

        deleted,
      });
    },
  );
