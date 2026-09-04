import {
  QrBatchBuilder,
} from "@/components/qr-rewards/qr-batch-builder";

import {
  QrRewardsHeader,
} from "@/components/qr-rewards/qr-rewards-header";

export default function GenerateQrBatchPage() {
  return (
    <div className="min-h-full">
      <QrRewardsHeader
        title="Generate & Print"
        description="Define a mass batch of unique single-use QR rewards. This initial screen validates the CMS workflow before the secure Voucher Engine is connected."
      />

      <div className="mx-auto w-full max-w-7xl p-6">
        <QrBatchBuilder />
      </div>
    </div>
  );
}
