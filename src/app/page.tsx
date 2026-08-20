import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import SignedOutHomePage from "@/app/home/signedOutHomePage";
import { verifySession } from "@/lib/auth";

export default function LandingPage() {
  return (
    <Suspense fallback={<p className="mt-4 text-muted-foreground">Loading...</p>}>
      <AuthBoundary />
    </Suspense>
  );
}

async function AuthBoundary() {
  await connection();
  const session = await verifySession();

  if (session?.userId) {
    redirect("/dashboard");
  }

  return <SignedOutHomePage />;
}
