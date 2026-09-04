import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  sql,
} from "drizzle-orm";

import {
  hasPermission,
  withTenantDb,
} from "@/lib/auth";


function nominalReward(
  policy: unknown,
) {
  const value =
    (
      policy &&
      typeof policy ===
        "object" &&
      !Array.isArray(
        policy,
      )
    )
      ? policy as
          Record<
            string,
            unknown
          >
      : {};

  if (
    value.type ===
      "fixed"
  ) {
    return Math.round(
      Number(
        value.amountMinor ??
          0,
      ),
    );
  }

  if (
    value.type ===
      "formula"
  ) {
    return Math.round(
      Number(
        value.baseAmountMinor ??
          0,
      ),
    );
  }

  return 0;
}


export const POST =
  withTenantDb(
    async (
      request:
        NextRequest,
      db,
      session,
      context: {
        params:
          Promise<{
            id: string;
          }>;
      },
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
              "Permission denied.",
          },
          {
            status: 403,
          },
        );
      }

      const {
        id: campaignId,
      } =
        await context.params;

      const body =
        await request
          .json()
          .catch(
            () => null,
          );

      const rulebookId =
        String(
          body?.rulebookId ??
            "",
        ).trim();

      if (!rulebookId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "rulebookId is required.",
          },
          {
            status: 400,
          },
        );
      }

      const result =
        await db.execute(sql`
          SELECT
            rb.id,

            rb.scheme_id
              AS "schemeId",

            rb.version,

            rb.reward_policy
              AS "rewardPolicy"

          FROM
            qr_reward_rulebooks rb

          INNER JOIN
            qr_reward_schemes s
              ON s.id =
                rb.scheme_id

          WHERE
            rb.id =
              ${rulebookId}::uuid

            AND
            rb.status =
              'published'

            AND
            s.status =
              'active'

          LIMIT 1
        `);

      const rulebook =
        result.rows[0] as
          | {
              id: string;
              schemeId: string;
              version: number;
              rewardPolicy: unknown;
            }
          | undefined;

      if (!rulebook) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Published Rulebook not found.",
          },
          {
            status: 404,
          },
        );
      }

      const previewReward =
        nominalReward(
          rulebook.rewardPolicy,
        );

      if (
        previewReward <=
        0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Rulebook has no valid nominal reward.",
          },
          {
            status: 400,
          },
        );
      }

      await db.execute(sql`
        UPDATE
          qr_reward_campaigns

        SET
          scheme_id =
            ${rulebook.schemeId}::uuid,

          current_rulebook_id =
            ${rulebook.id}::uuid,

          reward_amount_minor =
            ${previewReward},

          updated_at =
            now()

        WHERE
          id =
            ${campaignId}::uuid
      `);

      return NextResponse.json({
        success: true,

        campaignId,

        schemeId:
          rulebook.schemeId,

        rulebookId:
          rulebook.id,

        rulebookVersion:
          Number(
            rulebook.version,
          ),
      });
    },
  );
