// src/app/api/dashboardPagesAPI/tadaBill/tada-verification/[id]/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/drizzle';
import { tadaBills } from '../../../../../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifySession, hasPermission } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: billId } = await params;
        if (!billId) return NextResponse.json({ error: 'Missing Bill ID' }, { status: 400 });

        const session = await verifySession();
        if (!session || !session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        revalidateTag('tada-bills-global', 'hours');

        return NextResponse.json({ message: `Bill ${status}`, bill: updatedBill[0] }, { status: 200 });
    } catch (error) {
        console.error('Error modifying TA/DA:', error);
        return NextResponse.json({ error: 'Failed to modify bill', details: (error as Error).message }, { status: 500 });
    }
}