import {
  CampaignDashboard,
} from "@/components/qr-rewards/campaign-dashboard";


export default async function CampaignDashboardPage({
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
    <div className="mx-auto w-full max-w-7xl p-6">
      <CampaignDashboard
        campaignId={
          id
        }
      />
    </div>
  );
}
