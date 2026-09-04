import {
  redirect,
} from "next/navigation";

export default function QrRewardsPage() {
  redirect(
    "/dashboard/qr-rewards/campaigns",
  );
}
