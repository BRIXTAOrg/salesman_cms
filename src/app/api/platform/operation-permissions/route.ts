import { NextResponse } from "next/server";
import { withTenantDb } from "@/lib/auth";
import { canOperation, OPERATION_PERMISSION_CATALOG, OPS_GRANULAR } from "@/lib/operations-permissions";

export const GET = withTenantDb(async (_request, _db, session) => {
  const operations = Object.fromEntries(
    OPERATION_PERMISSION_CATALOG.map(({ key }) => [key, canOperation(session.permissions, key)]),
  );
  return NextResponse.json({ success: true, granular: session.permissions.includes(OPS_GRANULAR), operations });
});
