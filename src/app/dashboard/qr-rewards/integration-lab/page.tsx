import Link from "next/link";

import ApiIntegrationLab from "@/components/appliance/api-integration-lab";


export default function IntegrationLabCompatibilityPage() {
  return (
    <div className="w-full min-w-0 max-w-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1700px] space-y-5">
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-lg font-semibold">
            Integration Lab moved into Logic
          </div>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            API integrations are platform capabilities and no longer belong to
            QR Rewards navigation.
          </p>

          <Link
            href="/dashboard/workspace/responsibilities"
            className="mt-4 inline-flex rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Open Responsibilities → LOGIC
          </Link>
        </div>

        <ApiIntegrationLab />
      </div>
    </div>
  );
}
