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
      const status =
        await qrRewardsSchemaStatus(
          db,
        );

      if (!status.ready) {
        return NextResponse.json(
          {
            success: false,
            notProvisioned: true,
            error:
              "QR Rewards records are not provisioned for this tenant.",
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
            cl.request_id AS "requestId",
            cl.user_id AS "userId",
            cl.claimed_at AS "claimedAt",

            v.id AS "voucherId",
            v.serial_number AS "serialNumber",

            b.id AS "batchId",
            b.batch_code AS "batchCode",
            b.reward_amount_minor AS "rewardAmountMinor",
            b.currency,

            c.id AS "campaignId",
            c.name AS "campaignName"

          FROM qr_reward_claims cl

          INNER JOIN qr_reward_vouchers v
            ON v.id = cl.voucher_id

          INNER JOIN qr_reward_batches b
            ON b.id = v.batch_id

          INNER JOIN qr_reward_campaigns c
            ON c.id = b.campaign_id

          ORDER BY
            cl.claimed_at DESC

          LIMIT 1000
        `);

      return NextResponse.json({
        success: true,
        claims: result.rows,
      });
    },
  );
