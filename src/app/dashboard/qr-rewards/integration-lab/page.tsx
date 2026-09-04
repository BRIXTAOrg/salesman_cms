import {
  CircleDashed,
} from "lucide-react";

import {
  QrRewardsHeader,
} from "@/components/qr-rewards/qr-rewards-header";

const capabilities = [
  {
    title: "BRIXTA Payout Sandbox",
    body:
      "Fake success, failure, timeout, processing and reversal events before real API credentials exist.",
  },
  {
    title: "REST Integration Runtime",
    body:
      "Declarative POST / GET operations with server-managed secrets and response mapping.",
  },
  {
    title: "Webhook Runtime",
    body:
      "Verified external events mapped into BRIXTA payout lifecycle states.",
  },
  {
    title: "Cashfree",
    body:
      "Will become a live payout provider after the generic payout/runtime layer is installed.",
  },
];

export default function IntegrationLabPage() {
  return (
    <div className="min-h-full">
      <QrRewardsHeader
        title="Integration Lab"
        description="Build and test the complete reward workflow before connecting production payout credentials."
      />

      <div className="mx-auto grid w-full max-w-7xl gap-4 p-6 md:grid-cols-2">
        {capabilities.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border bg-card p-5"
          >
            <div className="flex items-center gap-2">
              <CircleDashed className="h-4 w-4 text-muted-foreground" />

              <div className="font-semibold">
                {item.title}
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {item.body}
            </p>

            <div className="mt-4 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Not installed
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
