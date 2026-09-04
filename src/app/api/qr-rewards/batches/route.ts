import {
  createHash,
  randomBytes,
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
  qrRewardsSchemaStatus,
} from "@/lib/qr-rewards-db";

import {
  qrRewardBatchAssignments,
  qrRewardBatches,
  qrRewardCampaigns,
  qrRewardVouchers,
} from "../../../../../drizzle/qrRewardsSchema";


type PrintableVoucher = {
  voucherId: string;
  serialNumber: number;
  qrPayload: string;
};


function sha256(
  value: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}


function batchCode() {
  return [
    "BRX",

    Date.now()
      .toString(36)
      .toUpperCase(),

    randomBytes(3)
      .toString("hex")
      .toUpperCase(),
  ].join("-");
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
              "QR Rewards V3 is not provisioned for this tenant.",
          },
          {
            status: 503,
          },
        );
      }

      const result =
        await db.execute(sql`
          SELECT
            b.id,

            b.batch_code
              AS "batchCode",

            b.quantity,

            b.status,

            b.created_at
              AS "createdAt",

            /*
             * Original Campaign is immutable historical origin.
             */
            b.campaign_id
              AS "originCampaignId",

            origin_c.name
              AS "originCampaignName",

            /*
             * Current Campaign comes from ACTIVE assignment.
             */
            a.id
              AS "activeAssignmentId",

            a.campaign_id
              AS "campaignId",

            current_c.name
              AS "campaignName",

            a.reward_amount_minor
              AS "rewardAmountMinor",

            a.currency,

            a.expires_at
              AS "expiresAt",

            COUNT(v.id)::integer
              AS "voucherCount",

            COUNT(v.id)
              FILTER (
                WHERE
                  v.status =
                    'available'
              )::integer
              AS "availableCount",

            COUNT(v.id)
              FILTER (
                WHERE
                  v.status =
                    'claimed'
              )::integer
              AS "claimedCount",

            COUNT(v.id)
              FILTER (
                WHERE
                  v.status =
                    'expired'
              )::integer
              AS "expiredCount",

            COUNT(v.id)
              FILTER (
                WHERE
                  v.status =
                    'revoked'
              )::integer
              AS "revokedCount"

          FROM qr_reward_batches b

          INNER JOIN qr_reward_campaigns origin_c
            ON origin_c.id =
              b.campaign_id

          LEFT JOIN qr_reward_batch_assignments a
            ON
              a.batch_id =
                b.id
              AND
              a.status =
                'active'

          LEFT JOIN qr_reward_campaigns current_c
            ON current_c.id =
              a.campaign_id

          LEFT JOIN qr_reward_vouchers v
            ON v.batch_id =
              b.id

          GROUP BY
            b.id,
            origin_c.id,
            origin_c.name,
            a.id,
            a.campaign_id,
            a.reward_amount_minor,
            a.currency,
            a.expires_at,
            current_c.id,
            current_c.name

          ORDER BY
            b.created_at DESC
        `);

      return NextResponse.json({
        success: true,

        batches:
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

      const schema =
        await qrRewardsSchemaStatus(
          db,
        );

      if (!schema.ready) {
        return NextResponse.json(
          {
            success: false,
            error:
              "QR Rewards V3 is not provisioned for this tenant.",
          },
          {
            status: 503,
          },
        );
      }

      const body =
        await request
          .json()
          .catch(
            () => null,
          );

      const quantity =
        Math.round(
          Number(
            body?.quantity,
          ),
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
              "Select a Campaign before generating a QR batch.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !Number.isFinite(
          quantity,
        ) ||
        quantity < 1 ||
        quantity > 10000
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Quantity must be between 1 and 10,000.",
          },
          {
            status: 400,
          },
        );
      }

      const [campaign] =
        await db
          .select()
          .from(
            qrRewardCampaigns,
          )
          .where(
            eq(
              qrRewardCampaigns.id,
              campaignId,
            ),
          )
          .limit(1);

      if (!campaign) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Campaign was not found.",
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
              "Campaign is not currently active.",
          },
          {
            status: 409,
          },
        );
      }

      const batchId =
        randomUUID();

      const assignmentId =
        randomUUID();

      const code =
        batchCode();

      const [batch] =
        await db
          .insert(
            qrRewardBatches,
          )
          .values({
            id:
              batchId,

            /*
             * ORIGINAL Campaign.
             * Never mutate this during reassignment.
             */
            campaignId:
              campaign.id,

            batchCode:
              code,

            quantity,

            rewardAmountMinor:
              campaign.rewardAmountMinor,

            currency:
              campaign.currency,

            expiresAt:
              campaign.expiresAt,

            status:
              "ready",

            createdByUserId:
              session.userId,
          })
          .returning();


      await db
        .insert(
          qrRewardBatchAssignments,
        )
        .values({
          id:
            assignmentId,

          batchId,

          campaignId:
            campaign.id,

          rewardAmountMinor:
            campaign.rewardAmountMinor,

          currency:
            campaign.currency,

          expiresAt:
            campaign.expiresAt,

          status:
            "active",

          createdByUserId:
            session.userId,
        });


      const printable:
        PrintableVoucher[] =
        [];

      const dbRows:
        Array<
          typeof qrRewardVouchers.$inferInsert
        > = [];


      for (
        let index = 0;
        index < quantity;
        index += 1
      ) {
        const voucherId =
          randomUUID();

        const secret =
          randomBytes(32)
            .toString(
              "base64url",
            );

        /*
         * Physical QR contains no Campaign/reward.
         *
         * This is precisely what makes unused printed QRs
         * reusable under a later Campaign assignment.
         */
        const payload =
          `BRX:Q:1:${secret}`;

        dbRows.push({
          id:
            voucherId,

          batchId,

          serialNumber:
            index + 1,

          tokenHash:
            sha256(
              payload,
            ),

          status:
            "available",

          /*
           * Kept synchronized with CURRENT assignment.
           */
          expiresAt:
            campaign.expiresAt,
        });

        printable.push({
          voucherId,

          serialNumber:
            index + 1,

          qrPayload:
            payload,
        });
      }


      const CHUNK_SIZE =
        500;

      for (
        let offset = 0;
        offset <
        dbRows.length;
        offset +=
        CHUNK_SIZE
      ) {
        await db
          .insert(
            qrRewardVouchers,
          )
          .values(
            dbRows.slice(
              offset,
              offset +
                CHUNK_SIZE,
            ),
          );
      }


      return NextResponse.json(
        {
          success: true,

          campaign,

          assignment: {
            id:
              assignmentId,

            campaignId:
              campaign.id,

            status:
              "active",
          },

          batch,

          printRecords:
            printable,

          warning:
            "printRecords contain bearer voucher secrets. Treat them as sensitive.",
        },
        {
          status: 201,
        },
      );
    },
  );
