import {
  CheckCircle2,
  CircleDashed,
  QrCode,
  ShieldCheck,
} from "lucide-react";

import {
  QrRewardsHeader,
} from "@/components/qr-rewards/qr-rewards-header";

import {
  qrRewardsEditionReadiness,
} from "@/lib/qr-rewards-edition";

export default function QrRewardsPage() {
  const readiness = qrRewardsEditionReadiness();

  const ready = readiness.filter(
    (item) => item.ready,
  ).length;

  return (
    <div className="min-h-full">
      <QrRewardsHeader
        title="QR Rewards Control Center"
        description="Generate unique bearer QR rewards, control their lifetime, monitor one-time claims and connect payout providers."
      />

      <div className="mx-auto grid w-full max-w-7xl gap-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric
            label="Capabilities ready"
            value={`${ready}/${readiness.length}`}
            hint="Runtime-certified capabilities"
          />

          <Metric
            label="Voucher model"
            value="Single-use"
            hint="First valid claimant wins"
          />

          <Metric
            label="Ownership"
            value="Bearer"
            hint="No user attached before redemption"
          />
        </div>

        <section className="rounded-2xl border bg-card">
          <div className="border-b p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-semibold">
                Edition readiness
              </h2>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              BRIXTA reports capabilities as ready only after the
              required runtime implementation exists.
            </p>
          </div>

          <div className="divide-y">
            {readiness.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <div className="font-medium">
                    {item.label}
                  </div>

                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {item.key}
                  </div>
                </div>

                <div
                  className={
                    item.ready
                      ? "flex items-center gap-2 text-sm font-medium"
                      : "flex items-center gap-2 text-sm text-muted-foreground"
                  }
                >
                  {item.ready ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <CircleDashed className="h-4 w-4" />
                  )}

                  {item.ready ? "Ready" : "Not installed"}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <QrCode className="h-6 w-6" />
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                Core redemption invariant
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Every generated QR begins with no owner. The first
                authenticated user who successfully redeems it becomes
                its only claimant. That same user may redeem another
                different unused QR, but this QR can never produce a
                second successful claim.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-sm text-muted-foreground">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold">
        {value}
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        {hint}
      </div>
    </div>
  );
}
