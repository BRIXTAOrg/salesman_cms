import {
  redirect,
} from "next/navigation";


export default function QrBatchesPage() {
  redirect(
    "/dashboard/qr-rewards/generate",
  );
}
