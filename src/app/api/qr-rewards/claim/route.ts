import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  withTenantDb,
} from "@/lib/auth";

import {
  claimQrReward,
} from "@/lib/qr-rewards-claim";

import {
  qrRewardsSchemaStatus,
} from "@/lib/qr-rewards-db";


export const POST =
  withTenantDb(
    async (
      request: NextRequest,
      db,
      session,
    ) => {
      const schema =
        await qrRewardsSchemaStatus(
          db,
        );

      if (!schema.ready) {
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
          .catch(
            () => null,
          );


      const qrPayload =
        String(
          body?.qrPayload ?? "",
        );


      const requestId =
        String(
          body?.requestId ?? "",
        );


      const claim =
        await claimQrReward(
          db,
          {
            qrPayload,
            requestId,
            userId:
              session.userId,
          },
        );


      if (
        claim.outcome ===
        "request_conflict"
      ) {
        return NextResponse.json(
          {
            success: false,
            claim,
            error:
              "That request ID was already used for another claim attempt.",
          },
          {
            status: 409,
          },
        );
      }


      /*
       * Business outcomes are deliberately returned as normal responses.
       *
       * "already_claimed" and "expired" are valid authoritative answers,
       * not server crashes.
       */
      return NextResponse.json({
        success: true,
        claim,
      });
    },
  );
