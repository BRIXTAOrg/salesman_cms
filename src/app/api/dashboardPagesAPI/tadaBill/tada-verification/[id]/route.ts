// src/app/api/dashboardPagesAPI/tadaBill/tada-verification/[id]/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { tadaBills } from '../../../../../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { withTenantDb, hasPermission } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = withTenantDb<RouteContext>(async (request, db, session, context) => {
    try {
        const { id: billId } = await context.params;
        if (!billId) return NextResponse.json({ error: 'Missing Bill ID' }, { status: 400 });

        if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { status } = body;

        if (!status || !['APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
            return NextResponse.json({ error: 'Valid status (APPROVED or REJECTED) is required' }, { status: 400 });
        }

        const updatedBill = await db
            .update(tadaBills)
            .set({
                status: status.toUpperCase(),
                updatedAt: new Date()
            })
            .where(eq(tadaBills.id, billId))
            .returning();

        revalidateTag(`tada-bills-global-${session.schemaName}`, 'hours');

        return NextResponse.json({ message: `Bill ${status}`, bill: updatedBill[0] }, { status: 200 });
    } catch (error) {
        console.error('Error modifying TA/DA:', error);
        return NextResponse.json({ error: 'Failed to modify bill', details: (error as Error).message }, { status: 500 });
    }
});