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


function ruleHash(
  payload:
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
          payload,
        ),
      ),
    )
    .digest(
      "hex",
    );
}


export const GET =
  withTenantDb(
    async (
      _request,
      db,
    ) => {
      const result =
        await db.execute(sql`
          SELECT
            s.id,
            s.name,
            s.description,
            s.status,

            rb.id
              AS "rulebookId",

            rb.version
              AS "rulebookVersion",

            rb.reward_policy
              AS "rewardPolicy",

            rb.claim_limit_policy
              AS "claimLimitPolicy",

            rb.fraud_policy
              AS "fraudPolicy",

            rb.validity_policy
              AS "validityPolicy",

            rb.rules_hash
              AS "rulesHash"

          FROM
            qr_reward_schemes s

          LEFT JOIN LATERAL (
            SELECT
              *

            FROM
              qr_reward_rulebooks candidate

            WHERE
              candidate.scheme_id =
                s.id

            ORDER BY
              candidate.version DESC

            LIMIT 1
          ) rb
            ON true

          ORDER BY
            s.created_at DESC
        `);

      return NextResponse.json({
        success: true,
        schemes:
          result.rows,
      });
    },
  );


export const POST =
  withTenantDb(
    async (
      request:
        NextRequest,
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

      const name =
        String(
          body?.name ??
            "",
        ).trim();

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Scheme name is required.",
          },
          {
            status: 400,
          },
        );
      }

      const rewardPolicy =
        object(
          body?.rewardPolicy,
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

      const schemeId =
        randomUUID();

      const rulebookId =
        randomUUID();

      const rules = {
        rewardPolicy,
        claimLimitPolicy,
        fraudPolicy,
        validityPolicy,
      };

      const hash =
        ruleHash(
          rules,
        );

      await db.execute(sql`
        INSERT INTO
          qr_reward_schemes (
            id,
            name,
            description,
            status,
            created_by_user_id
          )

        VALUES (
          ${schemeId},
          ${name},
          ${
            body?.description
              ? String(
                  body.description,
                )
              : null
          },
          'active',
          ${session.userId}
        )
      `);

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
          ${schemeId},
          1,
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

          ${hash},

          ${session.userId}
        )
      `);

      return NextResponse.json(
        {
          success: true,

          scheme: {
            id:
              schemeId,

            name,

            rulebookId,

            rulebookVersion:
              1,

            rulesHash:
              hash,
          },
        },
        {
          status: 201,
        },
      );
    },
  );
