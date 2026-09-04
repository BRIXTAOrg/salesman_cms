import {
  ClaimsConsole,
} from "@/components/qr-rewards/claims-console";

import {
  QrRewardsHeader,
} from "@/components/qr-rewards/qr-rewards-header";


export default function ClaimsPage() {
  return (
    <div className="min-h-full">
      <QrRewardsHeader
        title="Claims"
        description="Ledger of successful single-use QR reward claims."
      />

      <div className="mx-auto w-full max-w-7xl p-6">
        <ClaimsConsole />
      </div>
    </div>
  );
}
