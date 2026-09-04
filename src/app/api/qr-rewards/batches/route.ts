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
            b.id,
            b.batch_code AS "batchCode",
            b.quantity,
            b.reward_amount_minor AS "rewardAmountMinor",
            b.currency,
            b.expires_at AS "expiresAt",
            b.status,
            b.created_at AS "createdAt",

            c.id AS "campaignId",
            c.name AS "campaignName",

            COUNT(v.id)::integer
              AS "voucherCount",

            COUNT(v.id)
              FILTER (
                WHERE
                  v.status = 'available'
              )::integer
              AS "availableCount",

            COUNT(v.id)
              FILTER (
                WHERE
                  v.status = 'claimed'
              )::integer
              AS "claimedCount",

            COUNT(v.id)
              FILTER (
                WHERE
                  v.status = 'expired'
              )::integer
              AS "expiredCount",

            COUNT(v.id)
              FILTER (
                WHERE
                  v.status = 'revoked'
              )::integer
              AS "revokedCount"

          FROM qr_reward_batches b

          INNER JOIN qr_reward_campaigns c
            ON c.id = b.campaign_id

          LEFT JOIN qr_reward_vouchers v
            ON v.batch_id = b.id

          GROUP BY
            b.id,
            c.id,
            c.name

          ORDER BY
            b.created_at DESC
        `);

      return NextResponse.json({
        success: true,
        batches: result.rows,
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

      const body =
        await request
          .json()
          .catch(() => null);

      const quantity =
        Math.round(
          Number(
            body?.quantity,
          ),
        );

      if (
        !Number.isFinite(
          quantity,
        ) ||
        quantity < 1 ||
        quantity > 10_000
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Quantity must be between 1 and 10,000 vouchers per batch.",
          },
          {
            status: 400,
          },
        );
      }

      let campaign:
        typeof qrRewardCampaigns.$inferSelect
        | undefined;

      const suppliedCampaignId =
        String(
          body?.campaignId ?? "",
        ).trim();

      if (suppliedCampaignId) {
        [campaign] =
          await db
            .select()
            .from(
              qrRewardCampaigns,
            )
            .where(
              eq(
                qrRewardCampaigns.id,
                suppliedCampaignId,
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
      } else {
        const campaignName =
          String(
            body?.campaignName ?? "",
          ).trim();

        const rewardAmountMinor =
          Math.round(
            Number(
              body?.rewardAmountMinor,
            ),
          );

        const validityDays =
          Math.round(
            Number(
              body?.validityDays ?? 30,
            ),
          );

        if (!campaignName) {
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

        const starts =
          new Date();

        const expires =
          new Date(starts);

        expires.setDate(
          expires.getDate() +
            validityDays,
        );

        [campaign] =
          await db
            .insert(
              qrRewardCampaigns,
            )
            .values({
              id: randomUUID(),

              name:
                campaignName,

              rewardAmountMinor,

              currency: "INR",

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
      }

      if (!campaign) {
        throw new Error(
          "Campaign resolution failed.",
        );
      }

      if (
        campaign.status !==
        "active"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only active campaigns may mint vouchers.",
          },
          {
            status: 409,
          },
        );
      }

      const expiresAt =
        campaign.expiresAt;

      if (
        new Date(
          expiresAt,
        ).getTime() <=
        Date.now()
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Campaign has already expired.",
          },
          {
            status: 409,
          },
        );
      }

      const batchId =
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

            campaignId:
              campaign.id,

            batchCode:
              code,

            quantity,

            rewardAmountMinor:
              campaign.rewardAmountMinor,

            currency:
              campaign.currency,

            expiresAt,

            status:
              "ready",

            createdByUserId:
              session.userId,
          })
          .returning();

      const printable:
        PrintableVoucher[] = [];

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

        /*
         * 256 bits of random bearer entropy.
         */
        const secret =
          randomBytes(32)
            .toString(
              "base64url",
            );

        /*
         * Nothing financial is encoded in the QR.
         *
         * Reward, expiry and campaign all remain
         * server-authoritative.
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

          expiresAt:
            batch.expiresAt,
        });

        printable.push({
          voucherId,

          serialNumber:
            index + 1,

          qrPayload:
            payload,
        });
      }

      /*
       * Chunk large inserts to avoid one giant SQL statement.
       *
       * withTenantDb already wraps this entire request in one
       * tenant-scoped transaction, so a failure rolls back the
       * campaign, batch and every voucher.
       */
      const CHUNK_SIZE =
        500;

      for (
        let offset = 0;
        offset < dbRows.length;
        offset += CHUNK_SIZE
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

          batch,

          /*
           * BEARER SECRETS.
           *
           * Returned at mint time for print/export.
           * They are deliberately NOT stored plaintext.
           */
          printRecords:
            printable,

          warning:
            "printRecords contain bearer voucher secrets. Treat the generated file as sensitive.",
        },
        {
          status: 201,
        },
      );
    },
  );
