import {
  QrRewardsHeader,
} from "@/components/qr-rewards/qr-rewards-header";

import {
  VoucherRecordsTable,
} from "@/components/qr-rewards/voucher-records-table";


export default async function VoucherBatchPage({
  params,
}: {
  params:
    Promise<{
      id: string;
    }>;
}) {
  const {
    id,
  } =
    await params;


  return (
    <div className="min-h-full">
      <QrRewardsHeader
        title="Individual QR Records"
        description="Server-side voucher records for this batch. Bearer QR secrets and token hashes are deliberately not exposed here."
      />

      <div className="mx-auto w-full max-w-7xl p-6">
        <VoucherRecordsTable
          batchId={
            id
          }
        />
      </div>
    </div>
  );
}
