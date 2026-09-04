import {
  NextResponse,
} from "next/server";

import {
  sql,
} from "drizzle-orm";

import {
  withTenantDb,
} from "@/lib/auth";

import {
  qrRewardsSchemaStatus,
} from "@/lib/qr-rewards-db";


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
            cl.id,

            cl.request_id
              AS "requestId",

            cl.user_id
              AS "userId",

            cl.claimed_at
              AS "claimedAt",

            cl.assignment_id
              AS "assignmentId",

            v.id
              AS "voucherId",

            v.serial_number
              AS "serialNumber",

            b.id
              AS "batchId",

            b.batch_code
              AS "batchCode",

            COALESCE(
              cl.reward_amount_minor_snapshot,
              b.reward_amount_minor
            ) AS "rewardAmountMinor",

            COALESCE(
              cl.currency_snapshot,
              b.currency
            ) AS currency,

            COALESCE(
              cl.campaign_id_snapshot,
              b.campaign_id
            ) AS "campaignId",

            c.name
              AS "campaignName",

            cl.entity_type_id_snapshot
              AS "entityTypeId",

            cl.entity_type_label_snapshot
              AS "entityTypeName",

            cl.entity_record_id_snapshot
              AS "entityRecordId",

            cl.entity_label_snapshot
              AS "entityName"

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

          LEFT JOIN
            qr_reward_campaigns c
              ON c.id =
                COALESCE(
                  cl.campaign_id_snapshot,
                  b.campaign_id
                )

          ORDER BY
            cl.claimed_at DESC

          LIMIT 1000
        `);

      return NextResponse.json({
        success: true,

        claims:
          result.rows,
      });
    },
  );
