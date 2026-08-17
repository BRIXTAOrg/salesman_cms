// src/app/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/[id]/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { permanentJourneyPlans, dealers } from '../../../../../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { withTenantDb, hasPermission } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

async function verifyPJP(db: any, pjpId: string) {
    if (!pjpId) {
        throw new Error("PJP ID is required.");
    }
    const results = await db
        .select()
        .from(permanentJourneyPlans)
        .where(eq(permanentJourneyPlans.id, pjpId))
        .limit(1);

    const pjpToUpdate = results[0];
    if (!pjpToUpdate) {
        return { error: 'PJP not found', status: 404 };
    }
    return { pjpToUpdate };
}

export const PUT = withTenantDb<RouteContext>(async (request, db, session, context) => {
    try {
        const { id: pjpId } = await context.params;
        if (!pjpId) return NextResponse.json({ error: 'Missing PJP ID' }, { status: 400 });

        if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const verificationResult = await verifyPJP(db, pjpId);
        if (verificationResult.error) return NextResponse.json({ error: verificationResult.error }, { status: verificationResult.status });

        const body = await request.json();
        const { verificationStatus, additionalVisitRemarks } = body;

        if (!verificationStatus) {
            return NextResponse.json({ error: 'Verification status is required' }, { status: 400 });
        }

        const updatedPJPResult = await db
            .update(permanentJourneyPlans)
            .set({
                verificationStatus: verificationStatus,
                additionalVisitRemarks: additionalVisitRemarks || null,
                status: verificationStatus,
            })
            .where(eq(permanentJourneyPlans.id, pjpId))
            .returning();

        return NextResponse.json({
            message: `PJP status updated to ${verificationStatus}`,
            pjp: updatedPJPResult[0]
        }, { status: 200 });

    } catch (error) {
        console.error('Error (PUT):', error);
        return NextResponse.json({ error: 'Failed to update PJP status', details: (error as Error).message }, { status: 500 });
    }
});

export const PATCH = withTenantDb<RouteContext>(async (request, db, session, context) => {
    try {
        const { id: pjpId } = await context.params;
        if (!pjpId) return NextResponse.json({ error: 'Missing PJP ID' }, { status: 400 });

        if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const verify = await verifyPJP(db, pjpId);
        if (verify.error) return NextResponse.json({ error: verify.error }, { status: verify.status });

        const body = await request.json();

        // Validate Dealer existence if modifying dealerId
        if (body.dealerId) {
            const dealerExists = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.id, body.dealerId)).limit(1);
            if (!dealerExists[0]) return NextResponse.json({ error: 'Invalid dealerId' }, { status: 400 });
        }

        await db
            .update(permanentJourneyPlans)
            .set({
                ...body,
                planDate: body.planDate ? new Date(body.planDate).toISOString() : undefined,
                verificationStatus: 'VERIFIED',
                status: 'VERIFIED',
            })
            .where(eq(permanentJourneyPlans.id, pjpId))
            .returning();

        const finalPjp = await db
            .select({
                pjp: permanentJourneyPlans,
                dealerName: dealers.dealerPartyName,
            })
            .from(permanentJourneyPlans)
            .leftJoin(dealers, eq(permanentJourneyPlans.dealerId, dealers.id))
            .where(eq(permanentJourneyPlans.id, pjpId))
            .limit(1);

        return NextResponse.json({
            message: `PJP modified and VERIFIED successfully`,
            pjp: {
                ...finalPjp[0].pjp,
                dealerName: finalPjp[0].dealerName ?? null,
            }
        }, { status: 200 });

    } catch (error) {
        console.error('Error (PATCH):', error);
        return NextResponse.json({ error: 'Failed to modify PJP', details: (error as Error).message }, { status: 500 });
    }
});