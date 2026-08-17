// src/app/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/bulk-verify/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { permanentJourneyPlans } from '../../../../../../../drizzle/schema'; 
import { inArray } from 'drizzle-orm';
import { withTenantDb, hasPermission } from '@/lib/auth';

export const PATCH = withTenantDb(async (request, db, session) => {
  try {
    if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid IDs provided. Array of IDs is required.' }, { status: 400 });
    }

    const validPJPs = await db
      .select({ id: permanentJourneyPlans.id })
      .from(permanentJourneyPlans)
      .where(inArray(permanentJourneyPlans.id, ids));

    const validIds = validPJPs.map(p => p.id);

    if (validIds.length === 0) {
      return NextResponse.json({ message: 'No valid PJPs found to verify.' }, { status: 200 });
    }

    // Perform Bulk Update
    await db
      .update(permanentJourneyPlans)
      .set({
        verificationStatus: 'VERIFIED',
        status: 'VERIFIED',
      })
      .where(inArray(permanentJourneyPlans.id, validIds));

    return NextResponse.json({
      message: `${validIds.length} PJPs verified successfully`,
      count: validIds.length
    }, { status: 200 });

  } catch (error) {
    console.error('Error in Bulk PJP Verification:', error);
    return NextResponse.json({ 
       error: 'Bulk update failed', 
       details: (error as Error).message 
     }, { status: 500 });
  }
});