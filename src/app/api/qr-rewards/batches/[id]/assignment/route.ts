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


export const POST =
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
        id: batchId,
      } =
        await context.params;

      const body =
        await request
          .json()
          .catch(
            () => null,
          );

      const campaignId =
        String(
          body?.campaignId ??
            "",
        ).trim();

      if (!campaignId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "campaignId is required.",
          },
          {
            status: 400,
          },
        );
      }

      await db.execute(sql`
        SELECT
          pg_advisory_xact_lock(
            hashtextextended(
              ${`brixta:qr-batch-assignment:${batchId}`},
              0
            )
          )
      `);

      const campaignResult =
        await db.execute(sql`
          SELECT
            id,
            name,

            reward_amount_minor
              AS "rewardAmountMinor",

            currency,

            starts_at
              AS "startsAt",

            expires_at
              AS "expiresAt",

            status

          FROM
            qr_reward_campaigns

          WHERE
            id =
              ${campaignId}::uuid

          LIMIT 1
        `);

      const campaign =
        campaignResult.rows[0] as
          | {
              id: string;
              name: string;
              rewardAmountMinor: number;
              currency: string;
              startsAt: string;
              expiresAt: string;
              status: string;
            }
          | undefined;

      if (!campaign) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Target Campaign not found.",
          },
          {
            status: 404,
          },
        );
      }

      const now =
        Date.now();

      if (
        campaign.status !==
          "active" ||
        new Date(
          campaign.startsAt,
        ).getTime() >
          now ||
        new Date(
          campaign.expiresAt,
        ).getTime() <=
          now
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Target Campaign is not active.",
          },
          {
            status: 409,
          },
        );
      }

      const entitiesResult =
        await db.execute(sql`
          SELECT
            er.id,

            et.id
              AS "entityTypeId",

            et.title
              AS "entityTypeName",

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
            ) AS label

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
              ${campaignId}::uuid
        `);

      const eligible =
        entitiesResult.rows as Array<{
          id: string;
          entityTypeId: number;
          entityTypeName: string;
          label: string;
        }>;

      const attributionMode =
        String(
          body?.attributionMode ??
            (
              eligible.length
                ? "claimant_selects"
                : "none"
            ),
        );

      if (
        ![
          "none",
          "fixed_entity",
          "claimant_selects",
        ].includes(
          attributionMode,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid attribution mode.",
          },
          {
            status: 400,
          },
        );
      }

      let fixedEntity:
        | typeof eligible[number]
        | undefined;

      if (
        attributionMode ===
          "fixed_entity"
      ) {
        const entityRecordId =
          String(
            body?.entityRecordId ??
              "",
          );

        fixedEntity =
          eligible.find(
            (item) =>
              String(
                item.id,
              ) ===
              entityRecordId,
          );

        if (!fixedEntity) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Fixed Entity must belong to the target Campaign.",
            },
            {
              status: 400,
            },
          );
        }
      }

      if (
        attributionMode ===
          "claimant_selects" &&
        eligible.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Target Campaign has no selectable Entities.",
          },
          {
            status: 400,
          },
        );
      }

      const reusableResult =
        await db.execute(sql`
          SELECT
            COUNT(*)::integer
              AS count

          FROM
            qr_reward_vouchers

          WHERE
            batch_id =
              ${batchId}::uuid

            AND
            claimed_at
              IS NULL

            AND
            status IN (
              'available',
              'expired'
            )
        `);

      const reusableCount =
        Number(
          (
            reusableResult
              .rows[0] as
              | {
                  count?: unknown;
                }
              | undefined
          )?.count ??
            0,
        );

      if (
        reusableCount <=
          0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This batch has no reusable QR codes.",
          },
          {
            status: 409,
          },
        );
      }

      await db.execute(sql`
        UPDATE
          qr_reward_batch_assignments

        SET
          status =
            'ended',

          deactivated_at =
            now()

        WHERE
          batch_id =
            ${batchId}::uuid

          AND
          status =
            'active'
      `);

      const assignmentId =
        randomUUID();

      await db.execute(sql`
        INSERT INTO
          qr_reward_batch_assignments (
            id,
            batch_id,
            campaign_id,

            attribution_mode,

            entity_type_id,
            entity_record_id,
            entity_label_snapshot,

            reward_amount_minor,
            currency,
            expires_at,

            status,
            activated_at,
            created_by_user_id
          )

        VALUES (
          ${assignmentId},
          ${batchId}::uuid,
          ${campaignId}::uuid,

          ${attributionMode},

          ${
            fixedEntity
              ?.entityTypeId ??
            null
          },

          ${
            fixedEntity
              ?.id ??
            null
          }::uuid,

          ${
            fixedEntity
              ?.label ??
            null
          },

          ${Number(
            campaign.rewardAmountMinor,
          )},

          ${campaign.currency},

          ${campaign.expiresAt},

          'active',

          now(),

          ${session.userId}
        )
      `);

      await db.execute(sql`
        UPDATE
          qr_reward_vouchers

        SET
          status =
            'available',

          expires_at =
            ${campaign.expiresAt}

        WHERE
          batch_id =
            ${batchId}::uuid

          AND
          claimed_at
            IS NULL

          AND
          status IN (
            'available',
            'expired'
          )
      `);

      return NextResponse.json({
        success: true,

        assignment: {
          id:
            assignmentId,

          batchId,

          campaignId,

          campaignName:
            campaign.name,

          attributionMode,

          entity:
            fixedEntity ??
            null,

          reusableQrCount:
            reusableCount,
        },
      });
    },
  );
