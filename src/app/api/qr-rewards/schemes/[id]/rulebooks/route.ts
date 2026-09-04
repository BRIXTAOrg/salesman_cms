import {
  createHash,
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


function object(
  value: unknown,
) {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  )
    ? value as
        Record<
          string,
          unknown
        >
    : {};
}


function canonical(
  value: unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      canonical,
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as
          Record<
            string,
            unknown
          >,
      )
        .sort(
          ([a], [b]) =>
            a.localeCompare(
              b,
            ),
        )
        .map(
          (
            [key, nested],
          ) => [
            key,
            canonical(
              nested,
            ),
          ],
        ),
    );
  }

  return value;
}


function hashRules(
  value:
    Record<
      string,
      unknown
    >,
) {
  return createHash(
    "sha256",
  )
    .update(
      JSON.stringify(
        canonical(
          value,
        ),
      ),
    )
    .digest(
      "hex",
    );
}


export const POST =
  withTenantDb(
    async (
      request:
        NextRequest,
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
        id: schemeId,
      } =
        await context.params;

      await db.execute(sql`
        SELECT
          pg_advisory_xact_lock(
            hashtextextended(
              ${`brixta:qr-scheme:${schemeId}`},
              0
            )
          )
      `);

      const exists =
        await db.execute(sql`
          SELECT
            id

          FROM
            qr_reward_schemes

          WHERE
            id =
              ${schemeId}::uuid

          LIMIT 1
        `);

      if (
        !exists.rows[0]
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Scheme not found.",
          },
          {
            status: 404,
          },
        );
      }

      const body =
        await request
          .json()
          .catch(
            () => null,
          );

      const rewardPolicy =
        object(
          body?.rewardPolicy,
        );

      const claimLimitPolicy =
        object(
          body?.claimLimitPolicy,
        );

      const fraudPolicy =
        object(
          body?.fraudPolicy,
        );

      const validityPolicy =
        object(
          body?.validityPolicy,
        );

      if (
        !rewardPolicy.type
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "rewardPolicy.type is required.",
          },
          {
            status: 400,
          },
        );
      }

      const versionResult =
        await db.execute(sql`
          SELECT
            COALESCE(
              MAX(
                version
              ),
              0
            )::integer + 1
              AS version

          FROM
            qr_reward_rulebooks

          WHERE
            scheme_id =
              ${schemeId}::uuid
        `);

      const version =
        Number(
          (
            versionResult
              .rows[0] as
              | {
                  version?: unknown;
                }
              | undefined
          )?.version ??
            1,
        );

      const payload = {
        rewardPolicy,
        claimLimitPolicy,
        fraudPolicy,
        validityPolicy,
      };

      const rulesHash =
        hashRules(
          payload,
        );

      const rulebookId =
        randomUUID();

      await db.execute(sql`
        INSERT INTO
          qr_reward_rulebooks (
            id,
            scheme_id,
            version,
            status,

            reward_policy,
            claim_limit_policy,
            fraud_policy,
            validity_policy,

            rules_hash,
            created_by_user_id
          )

        VALUES (
          ${rulebookId},
          ${schemeId}::uuid,
          ${version},
          'published',

          ${JSON.stringify(
            rewardPolicy,
          )}::jsonb,

          ${JSON.stringify(
            claimLimitPolicy,
          )}::jsonb,

          ${JSON.stringify(
            fraudPolicy,
          )}::jsonb,

          ${JSON.stringify(
            validityPolicy,
          )}::jsonb,

          ${rulesHash},

          ${session.userId}
        )
      `);

      return NextResponse.json(
        {
          success: true,

          rulebook: {
            id:
              rulebookId,

            schemeId,

            version,

            rulesHash,
          },
        },
        {
          status: 201,
        },
      );
    },
  );
