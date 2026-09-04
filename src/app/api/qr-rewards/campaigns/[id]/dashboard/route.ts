import {
  NextResponse,
} from "next/server";

import {
  sql,
} from "drizzle-orm";

import {
  withTenantDb,
} from "@/lib/auth";


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

      const campaignResult =
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
              ${id}::uuid

          LIMIT 1
        `);

      const campaign =
        campaignResult.rows[0];

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


      const metricsResult =
        await db.execute(sql`
          SELECT
            (
              SELECT
                COUNT(*)::integer

              FROM
                qr_reward_vouchers v

              INNER JOIN
                qr_reward_batch_assignments a
                  ON
                    a.batch_id =
                      v.batch_id

                    AND
                    a.status =
                      'active'

              WHERE
                a.campaign_id =
                  ${id}::uuid

                AND
                v.status =
                  'available'
            ) AS "availableQrs",

            (
              SELECT
                COUNT(*)::integer

              FROM
                qr_reward_claims cl

              WHERE
                cl.campaign_id_snapshot =
                  ${id}::uuid
            ) AS "claims",

            (
              SELECT
                COALESCE(
                  SUM(
                    cl.reward_amount_minor_snapshot
                  ),
                  0
                )::bigint

              FROM
                qr_reward_claims cl

              WHERE
                cl.campaign_id_snapshot =
                  ${id}::uuid
            ) AS "claimedValueMinor",

            (
              SELECT
                COALESCE(
                  SUM(
                    a.reward_amount_minor
                  ),
                  0
                )::bigint

              FROM
                qr_reward_vouchers v

              INNER JOIN
                qr_reward_batch_assignments a
                  ON
                    a.batch_id =
                      v.batch_id

                    AND
                    a.status =
                      'active'

              WHERE
                a.campaign_id =
                  ${id}::uuid

                AND
                v.status =
                  'available'
            ) AS "currentLiabilityMinor",

            (
              SELECT
                COUNT(
                  DISTINCT a.batch_id
                )::integer

              FROM
                qr_reward_batch_assignments a

              WHERE
                a.campaign_id =
                  ${id}::uuid
            ) AS "batchCount"
        `);


      const dailyResult =
        await db.execute(sql`
          SELECT
            DATE(
              cl.claimed_at
            )::text AS date,

            COUNT(*)::integer
              AS claims,

            COALESCE(
              SUM(
                cl.reward_amount_minor_snapshot
              ),
              0
            )::bigint
              AS "rewardMinor"

          FROM
            qr_reward_claims cl

          WHERE
            cl.campaign_id_snapshot =
              ${id}::uuid

          GROUP BY
            DATE(
              cl.claimed_at
            )

          ORDER BY
            DATE(
              cl.claimed_at
            )
        `);


      const entityResult =
        await db.execute(sql`
          SELECT
            COALESCE(
              cl.entity_type_label_snapshot,
              'Unattributed'
            ) AS "entityType",

            COALESCE(
              cl.entity_label_snapshot,
              'Unattributed'
            ) AS entity,

            COUNT(*)::integer
              AS claims,

            COALESCE(
              SUM(
                cl.reward_amount_minor_snapshot
              ),
              0
            )::bigint
              AS "rewardMinor"

          FROM
            qr_reward_claims cl

          WHERE
            cl.campaign_id_snapshot =
              ${id}::uuid

          GROUP BY
            cl.entity_type_label_snapshot,
            cl.entity_label_snapshot

          ORDER BY
            COUNT(*) DESC
        `);


      const batchesResult =
        await db.execute(sql`
          SELECT
            a.id
              AS "assignmentId",

            b.id
              AS "batchId",

            b.batch_code
              AS "batchCode",

            a.status
              AS "assignmentStatus",

            a.attribution_mode
              AS "attributionMode",

            a.entity_label_snapshot
              AS "entityLabel",

            a.reward_amount_minor
              AS "rewardAmountMinor",

            a.expires_at
              AS "expiresAt",

            a.activated_at
              AS "activatedAt",

            a.deactivated_at
              AS "deactivatedAt",

            (
              SELECT
                COUNT(*)::integer

              FROM
                qr_reward_vouchers v

              WHERE
                v.batch_id =
                  b.id
            ) AS "totalQrs",

            (
              SELECT
                COUNT(*)::integer

              FROM
                qr_reward_vouchers v

              WHERE
                v.batch_id =
                  b.id

                AND
                v.status =
                  'available'
            ) AS "availableQrs",

            (
              SELECT
                COUNT(*)::integer

              FROM
                qr_reward_claims cl

              WHERE
                cl.assignment_id =
                  a.id
            ) AS "claims"

          FROM
            qr_reward_batch_assignments a

          INNER JOIN
            qr_reward_batches b
              ON b.id =
                a.batch_id

          WHERE
            a.campaign_id =
              ${id}::uuid

          ORDER BY
            a.activated_at DESC
        `);


      const claimsResult =
        await db.execute(sql`
          SELECT
            cl.id,

            b.batch_code
              AS "batchCode",

            v.serial_number
              AS "serialNumber",

            cl.user_id
              AS "userId",

            cl.reward_amount_minor_snapshot
              AS "rewardAmountMinor",

            cl.entity_type_label_snapshot
              AS "entityType",

            cl.entity_label_snapshot
              AS entity,

            cl.claimed_at
              AS "claimedAt"

          FROM
            qr_reward_claims cl

          INNER JOIN
            qr_reward_vouchers v
              ON v.id =
                cl.voucher_id

          INNER JOIN
            qr_reward_batches b
              ON b.id =
                v.batch_id

          WHERE
            cl.campaign_id_snapshot =
              ${id}::uuid

          ORDER BY
            cl.claimed_at DESC

          LIMIT 1000
        `);


      const metrics =
        metricsResult.rows[0] ??
        {};

      return NextResponse.json({
        success: true,

        campaign,

        metrics,

        claimsOverTime:
          dailyResult.rows,

        entityBreakdown:
          entityResult.rows,

        batches:
          batchesResult.rows,

        claims:
          claimsResult.rows,
      });
    },
  );
