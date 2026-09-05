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

      /*
       * TRACEABLE_REASSIGNMENT_V8
       */
      await db.execute(sql`
        SELECT
          pg_advisory_xact_lock(
            hashtextextended(
              ${`brixta:qr-batch-assignment:${batchId}`},
              0
            )
          )
      `);

      const batchResult =
        await db.execute(sql`
          SELECT
            id,

            batch_code
              AS "batchCode",

            status

          FROM
            qr_reward_batches

          WHERE
            id =
              ${batchId}::uuid

          LIMIT 1
        `);

      const batch =
        batchResult.rows[0] as
          | {
              id: string;
              batchCode: string;
              status: string;
            }
          | undefined;

      if (!batch) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Batch not found.",
          },
          {
            status: 404,
          },
        );
      }

      if (
        batch.status ===
          "revoked"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A revoked Batch cannot be reassigned.",
          },
          {
            status: 409,
          },
        );
      }

      const activeResult =
        await db.execute(sql`
          SELECT
            campaign_id
              AS "campaignId"

          FROM
            qr_reward_batch_assignments

          WHERE
            batch_id =
              ${batchId}::uuid

            AND
            status =
              'active'

          LIMIT 1
        `);

      const activeCampaignId =
        String(
          (
            activeResult.rows[0] as
              | {
                  campaignId?:
                    unknown;
                }
              | undefined
          )
            ?.campaignId ??
            "",
        );

      if (
        activeCampaignId ===
          campaignId
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This Batch is already assigned to that Campaign.",
          },
          {
            status: 409,
          },
        );
      }

      const campaignResult =
        await db.execute(sql`
          SELECT
            c.id,
            c.name,

            c.reward_amount_minor
              AS "rewardAmountMinor",

            c.currency,

            c.starts_at
              AS "startsAt",

            c.expires_at
              AS "expiresAt",

            c.status

          FROM
            qr_reward_campaigns c

          WHERE
            c.id =
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

      const entityResult =
        await db.execute(sql`
          SELECT
            er.id,

            er.entity_type_id
              AS "entityTypeId",

            et.title
              AS "entityTypeName",

            er.external_key
              AS "externalKey",

            COALESCE(
              er.data -> '__brixta_trace',
              '{}'::jsonb
            )
              AS "sourceTrace",

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
              AS label

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

      if (
        entityResult
          .rows.length !==
        1
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Target Campaign must belong to exactly one active Entity.",
          },
          {
            status: 409,
          },
        );
      }

      const entity =
        entityResult.rows[0] as {
          id: string;
          entityTypeId: number;
          entityTypeName: string;
          externalKey: string | null;
          sourceTrace: unknown;
          label: string;
        };

      const conflictResult =
        await db.execute(sql`
          SELECT
            batch_id
              AS "batchId"

          FROM
            qr_reward_batch_assignments

          WHERE
            campaign_id =
              ${campaignId}::uuid

            AND
            batch_id <>
              ${batchId}::uuid

          LIMIT 1
        `);

      if (
        conflictResult
          .rows.length >
        0
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Target Campaign already belongs to another physical QR Batch.",
          },
          {
            status: 409,
          },
        );
      }

      const policyResult =
        await db.execute(sql`
          SELECT
            c.scheme_id
              AS "schemeId",

            rb.id
              AS "rulebookId",

            rb.version
              AS "rulebookVersion",

            rb.rules_hash
              AS "rulesHash"

          FROM
            qr_reward_campaigns c

          INNER JOIN
            qr_reward_rulebooks rb
              ON rb.id =
                c.current_rulebook_id

              AND
              rb.scheme_id =
                c.scheme_id

          WHERE
            c.id =
              ${campaignId}::uuid

            AND
            rb.status =
              'published'

          LIMIT 1
        `);

      const policy =
        policyResult.rows[0] as
          | {
              schemeId: string;
              rulebookId: string;
              rulebookVersion: number;
              rulesHash: string;
            }
          | undefined;

      if (!policy) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Target Campaign does not have a published Rulebook.",
          },
          {
            status: 409,
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
            reusableResult.rows[0] as
              | {
                  count?:
                    unknown;
                }
              | undefined
          )
            ?.count ??
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
              "This Batch has no reusable QR codes.",
          },
          {
            status: 409,
          },
        );
      }

      /*
       * End old Campaign assignment.
       */
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

      /*
       * End old Entity custody ONLY for reusable QRs.
       * Claimed QR lineage is never changed.
       */
      await db.execute(sql`
        UPDATE
          qr_reward_voucher_entity_bindings

        SET
          status =
            'ended',

          ended_at =
            now()

        WHERE
          status =
            'active'

          AND
          voucher_id IN (
            SELECT
              v.id

            FROM
              qr_reward_vouchers v

            WHERE
              v.batch_id =
                ${batchId}::uuid

              AND
              v.claimed_at
                IS NULL

              AND
              v.status IN (
                'available',
                'expired'
              )
          )
      `);

      const assignmentId =
        randomUUID();

      await db.execute(sql`
        INSERT INTO
          qr_reward_batch_assignments (
            id,
            batch_id,
            campaign_id,

            scheme_id,
            rulebook_id,
            rulebook_version,
            rules_hash,

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
          ${assignmentId}::uuid,
          ${batchId}::uuid,
          ${campaignId}::uuid,

          ${policy.schemeId}::uuid,
          ${policy.rulebookId}::uuid,
          ${Number(
            policy.rulebookVersion,
          )},
          ${policy.rulesHash},

          'voucher_bound_entity',

          ${Number(
            entity.entityTypeId,
          )},

          ${entity.id}::uuid,

          ${entity.label},

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

      /*
       * Append new custody rows.
       */
      await db.execute(sql`
        INSERT INTO
          qr_reward_voucher_entity_bindings (
            id,
            voucher_id,
            assignment_id,

            entity_type_id,
            entity_record_id,

            entity_type_label_snapshot,
            entity_external_key_snapshot,
            entity_label_snapshot,
            source_trace_snapshot,

            status,
            bound_at,
            created_by_user_id,
            created_at
          )

        SELECT
          md5(
            v.id::text ||
            ':' ||
            ${assignmentId}
          )::uuid,

          v.id,

          ${assignmentId}::uuid,

          ${Number(
            entity.entityTypeId,
          )},

          ${entity.id}::uuid,

          ${entity.entityTypeName},

          ${entity.externalKey},

          ${entity.label},

          ${JSON.stringify(
            entity.sourceTrace ??
              {},
          )}::jsonb,

          'active',

          now(),

          ${session.userId},

          now()

        FROM
          qr_reward_vouchers v

        WHERE
          v.batch_id =
            ${batchId}::uuid

          AND
          v.claimed_at
            IS NULL

          AND
          v.status IN (
            'available',
            'expired'
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

      await db.execute(sql`
        INSERT INTO
          qr_reward_batch_audit_events (
            id,
            batch_id,
            batch_code_snapshot,
            event_type,
            actor_user_id,
            details,
            created_at
          )

        VALUES (
          ${randomUUID()}::uuid,

          ${batchId}::uuid,

          ${batch.batchCode},

          'reassigned',

          ${session.userId},

          jsonb_build_object(
            'fromCampaignId',
              ${activeCampaignId || null},

            'toCampaignId',
              ${campaignId},

            'toCampaignName',
              ${campaign.name},

            'entityTypeId',
              ${Number(
                entity.entityTypeId,
              )},

            'entityRecordId',
              ${entity.id},

            'entityLabel',
              ${entity.label},

            'reusableQrCount',
              ${reusableCount}
          ),

          now()
        )
      `);

      return NextResponse.json({
        success:
          true,

        assignment: {
          id:
            assignmentId,

          batchId,

          campaignId,

          campaignName:
            campaign.name,

          attributionMode:
            "voucher_bound_entity",

          entity: {
            id:
              entity.id,

            entityTypeId:
              entity.entityTypeId,

            entityTypeName:
              entity.entityTypeName,

            label:
              entity.label,
          },

          reusableQrCount:
            reusableCount,
        },
      });
    },
  );
