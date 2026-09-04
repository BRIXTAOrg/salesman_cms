import {
  randomUUID,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  eq,
  sql,
} from "drizzle-orm";

import {
  hasPermission,
  withTenantDb,
} from "@/lib/auth";

import {
  qrRewardCampaigns,
} from "../../../../../../drizzle/qrRewardsSchema";


async function campaignDetail(
  db: Parameters<
    Parameters<typeof withTenantDb>[0]
  >[1],
  campaignId: string,
) {
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

        COALESCE(
          (
            SELECT
              jsonb_agg(
                jsonb_build_object(
                  'id',
                    er.id,

                  'entityTypeId',
                    et.id,

                  'entityTypeName',
                    et.title,

                  'entityTypeKey',
                    et.key,

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

      WHERE
        c.id =
          ${campaignId}::uuid

      LIMIT 1
    `);

  return result.rows[0] ??
    null;
}


export const GET =
  withTenantDb(
    async (
      _request,
      db,
      _session,
      context: {
        params:
          Promise<{
            id: string;
          }>;
      },
    ) => {
      const {
        id,
      } =
        await context.params;

      const campaign =
        await campaignDetail(
          db,
          id,
        );

      if (!campaign) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Campaign not found.",
          },
          {
            status: 404,
          },
        );
      }

      return NextResponse.json({
        success: true,
        campaign,
      });
    },
  );


export const PATCH =
  withTenantDb(
    async (
      request: NextRequest,
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
        id,
      } =
        await context.params;

      const body =
        await request
          .json()
          .catch(
            () => null,
          );

      const existingResult =
        await db.execute(sql`
          SELECT
            id,
            name,
            description,

            reward_amount_minor
              AS "rewardAmountMinor",

            expires_at
              AS "expiresAt",

            status

          FROM
            qr_reward_campaigns

          WHERE
            id =
              ${id}::uuid

          LIMIT 1
        `);

      const existing =
        existingResult.rows[0] as
          | {
              id: string;
              name: string;
              description:
                | string
                | null;
              rewardAmountMinor: number;
              expiresAt: string;
              status: string;
            }
          | undefined;

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Campaign not found.",
          },
          {
            status: 404,
          },
        );
      }

      const name =
        body?.name !==
          undefined
          ? String(
              body.name,
            ).trim()
          : existing.name;

      const description =
        body?.description !==
          undefined
          ? (
              String(
                body.description ??
                  "",
              ).trim() ||
              null
            )
          : existing.description;

      const rewardAmountMinor =
        body?.rewardAmountMinor !==
          undefined
          ? Math.round(
              Number(
                body.rewardAmountMinor,
              ),
            )
          : Number(
              existing.rewardAmountMinor,
            );

      const status =
        body?.status !==
          undefined
          ? String(
              body.status,
            )
          : existing.status;

      const expiresAt =
        body?.expiresAt !==
          undefined
          ? new Date(
              String(
                body.expiresAt,
              ),
            ).toISOString()
          : new Date(
              existing.expiresAt,
            ).toISOString();

      if (
        !name ||
        !Number.isFinite(
          rewardAmountMinor,
        ) ||
        rewardAmountMinor <= 0 ||
        ![
          "active",
          "paused",
          "revoked",
        ].includes(
          status,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Campaign update is invalid.",
          },
          {
            status: 400,
          },
        );
      }

      await db
        .update(
          qrRewardCampaigns,
        )
        .set({
          name,
          description,
          rewardAmountMinor,
          expiresAt,
          status,
          updatedAt:
            new Date()
              .toISOString(),
        })
        .where(
          eq(
            qrRewardCampaigns.id,
            id,
          ),
        );

      if (
        Array.isArray(
          body?.entityRecordIds,
        )
      ) {
        const uniqueIds = [
          ...new Set(
            body.entityRecordIds
              .map(
                (value: unknown) =>
                  String(
                    value ??
                      "",
                  ).trim(),
              )
              .filter(Boolean),
          ),
        ];

        const validated:
          Array<{
            id: string;
            entityTypeId: number;
          }> = [];

        for (
          const entityId of
          uniqueIds
        ) {
          const result =
            await db.execute(sql`
              SELECT
                er.id,

                er.entity_type_id
                  AS "entityTypeId"

              FROM
                entity_records er

              INNER JOIN
                entity_types et
                  ON et.id =
                    er.entity_type_id

              WHERE
                er.id =
                  ${entityId}::uuid

                AND
                er.status =
                  'active'

                AND
                et.is_active =
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
            return NextResponse.json(
              {
                success: false,
                error:
                  `Entity ${entityId} is unavailable.`,
              },
              {
                status: 400,
              },
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

        await db.execute(sql`
          DELETE FROM
            qr_reward_campaign_entities

          WHERE
            campaign_id =
              ${id}::uuid
        `);

        for (
          const entity of
          validated
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
              ${id}::uuid,
              ${entity.entityTypeId},
              ${entity.id}::uuid,
              ${session.userId}
            )
          `);
        }
      }

      return NextResponse.json({
        success: true,

        campaign:
          await campaignDetail(
            db,
            id,
          ),
      });
    },
  );
