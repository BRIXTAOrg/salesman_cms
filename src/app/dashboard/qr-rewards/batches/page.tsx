import {
  QrRecordsTable,
} from "@/components/qr-rewards/qr-records-table";

import {
  QrRewardsHeader,
} from "@/components/qr-rewards/qr-rewards-header";


export default function QrRecordsPage() {
  return (
    <div className="min-h-full">
      <QrRewardsHeader
        title="QR Records"
        description="Every minted voucher batch and its live available, claimed, expired and revoked record counts."
      />

      <div className="mx-auto w-full max-w-7xl p-6">
        <QrRecordsTable />
      </div>
    </div>
  );
}
