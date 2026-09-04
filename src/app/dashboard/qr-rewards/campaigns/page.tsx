import {
  CampaignRecords,
} from "@/components/qr-rewards/campaign-records";

import {
  QrRewardsHeader,
} from "@/components/qr-rewards/qr-rewards-header";


export default function CampaignsPage() {
  return (
    <div className="min-h-full">
      <QrRewardsHeader
        title="Reward Campaigns"
        description="Persisted reward programmes that define the commercial contract inherited by generated QR voucher batches."
      />

      <div className="mx-auto w-full max-w-7xl p-6">
        <CampaignRecords />
      </div>
    </div>
  );
}
