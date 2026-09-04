import {
  randomUUID,
} from "node:crypto";

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

import {
  qrRewardsSchemaStatus,
} from "@/lib/qr-rewards-db";

import {
  qrRewardCampaigns,
} from "../../../../../drizzle/qrRewardsSchema";


async function validateEntityRecords(
  db: Parameters<
    Parameters<typeof withTenantDb>[0]
  >[1],
  rawIds: unknown,
) {
  if (!Array.isArray(rawIds)) {
    return [];
  }

  const ids = [
    ...new Set(
      rawIds
        .map(
          (value) =>
            String(
              value ?? "",
            ).trim(),
        )
        .filter(Boolean),
    ),
  ];

  if (ids.length > 500) {
    throw new Error(
      "A Campaign can contain at most 500 Entity records in this version.",
    );
  }

  const validated:
    Array<{
      id: string;
      entityTypeId: number;
    }> = [];

  for (const id of ids) {
    const result =
      await db.execute(sql`
        SELECT
          er.id,

          er.entity_type_id
            AS "entityTypeId"

        FROM entity_records er

        INNER JOIN entity_types et
          ON et.id =
            er.entity_type_id

        WHERE
          er.id =
            ${id}::uuid

          AND er.status =
            'active'

          AND et.is_active =
            true

        LIMIT 1
      `);

    const row =
      result.rows[0] as
        | {
            id: string;
            entityTypeId: number;
          }
        | undefined;

    if (!row) {
      throw new Error(
        `Entity record ${id} is unavailable.`,
      );
    }

    validated.push({
      id:
        String(
          row.id,
        ),

      entityTypeId:
        Number(
          row.entityTypeId,
        ),
    });
  }

  return validated;
}


export const GET =
  withTenantDb(
    async (
      _request,
      db,
    ) => {
      const schema =
        await qrRewardsSchemaStatus(
          db,
        );

      if (!schema.ready) {
        return NextResponse.json(
          {
            success: false,
            error:
              "QR Rewards V4 is not provisioned.",
          },
          {
            status: 503,
          },
        );
      }

      const result =
        await db.execute(sql`
          SELECT
            c.id,
            c.name,
            c.description,

            c.reward_amount_minor
              AS "rewardAmountMinor",

            c.currency,

            c.starts_at
              AS "startsAt",

            c.expires_at
              AS "expiresAt",

            c.status,

            c.created_at
              AS "createdAt",

            c.updated_at
              AS "updatedAt",

            (
              SELECT
                COUNT(*)::integer

              FROM qr_reward_batch_assignments a

              WHERE
                a.campaign_id =
                  c.id
            ) AS "batchCount",

            COALESCE(
              (
                SELECT
                  jsonb_agg(
                    jsonb_build_object(
                      'id',
                        er.id,

                      'entityTypeId',
                        et.id,

                      'entityTypeKey',
                        et.key,

                      'entityTypeName',
                        et.title,

                      'label',
                        COALESCE(
                          (
                            SELECT
                              NULLIF(
                                er.data ->> f.key,
                                ''
                              )

                            FROM
                              jsonb_array_elements_text(
                                et.searchable_fields
                              ) AS f(key)

                            WHERE
                              NULLIF(
                                er.data ->> f.key,
                                ''
                              ) IS NOT NULL

                            LIMIT 1
                          ),

                          NULLIF(
                            er.data ->> 'name',
                            ''
                          ),

                          NULLIF(
                            er.data ->> 'title',
                            ''
                          ),

                          er.external_key,

                          er.id::text
                        )
                    )

                    ORDER BY
                      et.title,
                      er.id
                  )

                FROM
                  qr_reward_campaign_entities ce

                INNER JOIN
                  entity_records er
                    ON er.id =
                      ce.entity_record_id

                INNER JOIN
                  entity_types et
                    ON et.id =
                      ce.entity_type_id

                WHERE
                  ce.campaign_id =
                    c.id
              ),

              '[]'::jsonb
            ) AS "eligibleEntities"

          FROM
            qr_reward_campaigns c

          ORDER BY
            c.created_at DESC
        `);

      return NextResponse.json({
        success: true,

        campaigns:
          result.rows,
      });
    },
  );


export const POST =
  withTenantDb(
    async (
      request: NextRequest,
      db,
      session,
    ) => {
      if (
        !hasPermission(
          session.permissions,
          [
            "WRITE",
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

      const body =
        await request
          .json()
          .catch(
            () => null,
          );

      const name =
        String(
          body?.name ??
            "",
        ).trim();

      const description =
        String(
          body?.description ??
            "",
        ).trim() ||
        null;

      const rewardAmountMinor =
        Math.round(
          Number(
            body?.rewardAmountMinor,
          ),
        );

      const validityDays =
        Math.round(
          Number(
            body?.validityDays ??
              30,
          ),
        );

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Campaign name is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !Number.isFinite(
          rewardAmountMinor,
        ) ||
        rewardAmountMinor <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Reward amount must be positive.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !Number.isFinite(
          validityDays,
        ) ||
        validityDays < 1 ||
        validityDays > 3650
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Validity must be between 1 and 3650 days.",
          },
          {
            status: 400,
          },
        );
      }

      let entities:
        Array<{
          id: string;
          entityTypeId: number;
        }>;

      try {
        entities =
          await validateEntityRecords(
            db,
            body?.entityRecordIds,
          );
      } catch (cause) {
        return NextResponse.json(
          {
            success: false,
            error:
              cause instanceof Error
                ? cause.message
                : "Invalid Entity selection.",
          },
          {
            status: 400,
          },
        );
      }

      const starts =
        new Date();

      const expires =
        new Date(
          starts,
        );

      expires.setDate(
        expires.getDate() +
          validityDays,
      );

      const campaignId =
        randomUUID();

      const [campaign] =
        await db
          .insert(
            qrRewardCampaigns,
          )
          .values({
            id:
              campaignId,

            name,

            description,

            rewardAmountMinor,

            currency:
              "INR",

            startsAt:
              starts.toISOString(),

            expiresAt:
              expires.toISOString(),

            status:
              "active",

            createdByUserId:
              session.userId,
          })
          .returning();

      for (
        const entity of
        entities
      ) {
        await db.execute(sql`
          INSERT INTO
            qr_reward_campaign_entities (
              id,
              campaign_id,
              entity_type_id,
              entity_record_id,
              created_by_user_id
            )

          VALUES (
            ${randomUUID()},
            ${campaignId},
            ${entity.entityTypeId},
            ${entity.id}::uuid,
            ${session.userId}
          )

          ON CONFLICT (
            campaign_id,
            entity_record_id
          )
          DO NOTHING
        `);
      }

      return NextResponse.json(
        {
          success: true,
          campaign,
        },
        {
          status: 201,
        },
      );
    },
  );
