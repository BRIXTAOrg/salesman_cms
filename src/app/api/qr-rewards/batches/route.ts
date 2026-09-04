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


function createBatchCode() {
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


async function campaignEntities(
  db: Parameters<
    Parameters<typeof withTenantDb>[0]
  >[1],
  campaignId: string,
) {
  const result =
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

        AND
        er.status =
          'active'

        AND
        et.is_active =
          true
    `);

  return result.rows as Array<{
    id: string;
    entityTypeId: number;
    entityTypeName: string;
    label: string;
  }>;
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
            b.id,

            b.batch_code
              AS "batchCode",

            b.quantity,

            b.status,

            b.created_at
              AS "createdAt",

            b.campaign_id
              AS "originCampaignId",

            origin_c.name
              AS "originCampaignName",

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

            a.attribution_mode
              AS "attributionMode",

            a.entity_type_id
              AS "entityTypeId",

            et.title
              AS "entityTypeName",

            a.entity_record_id
              AS "entityRecordId",

            a.entity_label_snapshot
              AS "entityLabel",

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

          FROM
            qr_reward_batches b

          INNER JOIN
            qr_reward_campaigns origin_c
              ON origin_c.id =
                b.campaign_id

          LEFT JOIN
            qr_reward_batch_assignments a
              ON
                a.batch_id =
                  b.id

                AND
                a.status =
                  'active'

          LEFT JOIN
            qr_reward_campaigns current_c
              ON current_c.id =
                a.campaign_id

          LEFT JOIN
            entity_types et
              ON et.id =
                a.entity_type_id

          LEFT JOIN
            qr_reward_vouchers v
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
            a.attribution_mode,
            a.entity_type_id,
            et.title,
            a.entity_record_id,
            a.entity_label_snapshot,
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

      if (
        !campaignId ||
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
              "Campaign and a quantity from 1 to 10,000 are required.",
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
              "Campaign not found.",
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
              "Campaign is not active.",
          },
          {
            status: 409,
          },
        );
      }

      const eligible =
        await campaignEntities(
          db,
          campaignId,
        );

      let attributionMode =
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
        attributionMode =
          "none";
      }

      let fixedEntity:
        | {
            id: string;
            entityTypeId: number;
            entityTypeName: string;
            label: string;
          }
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
            (entity) =>
              String(
                entity.id,
              ) ===
              entityRecordId,
          );

        if (!fixedEntity) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Fixed Entity must be one of the Campaign's eligible Entities.",
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
              "This Campaign has no eligible Entities for claimant selection.",
          },
          {
            status: 400,
          },
        );
      }

      const batchId =
        randomUUID();

      const assignmentId =
        randomUUID();

      const code =
        createBatchCode();

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

          attributionMode,

          entityTypeId:
            fixedEntity
              ?.entityTypeId ??
            null,

          entityRecordId:
            fixedEntity
              ?.id ??
            null,

          entityLabelSnapshot:
            fixedEntity
              ?.label ??
            null,

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

        const secret =
          randomBytes(32)
            .toString(
              "base64url",
            );

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

      for (
        let offset = 0;
        offset <
          dbRows.length;
        offset += 500
      ) {
        await db
          .insert(
            qrRewardVouchers,
          )
          .values(
            dbRows.slice(
              offset,
              offset + 500,
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

            attributionMode,

            entity:
              fixedEntity ??
              null,
          },

          batch,

          printRecords:
            printable,
        },
        {
          status: 201,
        },
      );
    },
  );
