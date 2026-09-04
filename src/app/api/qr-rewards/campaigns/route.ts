import {
  randomUUID,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  desc,
} from "drizzle-orm";

import {
  hasPermission,
  withTenantDb,
} from "@/lib/auth";

import {
  qrRewardsSchemaStatus,
} from "@/lib/qr-rewards-db";

import {
  qrRewardCampaigns,
} from "../../../../../drizzle/qrRewardsSchema";


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

      const campaigns =
        await db
          .select()
          .from(
            qrRewardCampaigns,
          )
          .orderBy(
            desc(
              qrRewardCampaigns.createdAt,
            ),
          );

      return NextResponse.json({
        success: true,
        campaigns,
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

      const name =
        String(
          body?.name ?? "",
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

      if (!name) {
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

      const expiry =
        new Date(starts);

      expiry.setDate(
        expiry.getDate() +
          validityDays,
      );

      const [campaign] =
        await db
          .insert(
            qrRewardCampaigns,
          )
          .values({
            id: randomUUID(),

            name,

            description:
              body?.description
                ? String(
                    body.description,
                  )
                : null,

            rewardAmountMinor,

            currency: "INR",

            startsAt:
              starts.toISOString(),

            expiresAt:
              expiry.toISOString(),

            status: "active",

            createdByUserId:
              session.userId,
          })
          .returning();

      return NextResponse.json(
        {
          success: true,
          campaign,
        },
        {
          status: 201,
        },
      );
    },
  );
