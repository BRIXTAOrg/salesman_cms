import {
  QrBatchBuilder,
} from "@/components/qr-rewards/qr-batch-builder";

import {
  QrRecordsTable,
} from "@/components/qr-rewards/qr-records-table";

import {
  QrRewardsHeader,
} from "@/components/qr-rewards/qr-rewards-header";


export default function GenerateQrBatchPage() {
  return (
    <div className="min-h-full">
      <QrRewardsHeader
        title="Generate Batch"
        description="Select a Campaign, mint unique single-use QR rewards, print the batch and manage every generated batch from one place."
      />

      <div className="mx-auto grid w-full max-w-7xl gap-8 p-6">
        <QrBatchBuilder />

        <QrRecordsTable />
      </div>
    </div>
  );
}
