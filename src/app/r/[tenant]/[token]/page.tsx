import type {
  Metadata,
} from "next";

import {
  Suspense,
} from "react";

import {
  PublicRewardClient,
} from "@/components/qr-rewards/public-reward-client";


export const metadata:
  Metadata = {
  title:
    "Claim your reward | BRIXTA",

  description:
    "Secure BRIXTA reward verification.",
};


async function RewardRoute({
  params,
}: {
  params:
    Promise<{
      tenant: string;
      token: string;
    }>;
}) {
  const {
    tenant,
    token,
  } =
    await params;

  return (
    <PublicRewardClient
      tenant={
        tenant
      }
      token={
        token
      }
    />
  );
}


function RewardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />

        <div className="mt-4 text-sm font-medium">
          Opening your reward…
        </div>
      </div>
    </main>
  );
}


export default function RewardPage({
  params,
}: {
  params:
    Promise<{
      tenant: string;
      token: string;
    }>;
}) {
  return (
    <Suspense
      fallback={
        <RewardLoading />
      }
    >
      <RewardRoute
        params={
          params
        }
      />
    </Suspense>
  );
}
