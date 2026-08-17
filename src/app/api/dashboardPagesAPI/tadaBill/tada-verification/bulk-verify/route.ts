// src/app/api/dashboardPagesAPI/tadaBill/tada-verification/bulk-verify/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { tadaBills } from '../../../../../../../drizzle/schema';
import { inArray } from 'drizzle-orm';
import { withTenantDb, hasPermission } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

export const PATCH = withTenantDb(async (request, db, session) => {
    try {
        if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Invalid IDs provided.' }, { status: 400 });
        }

        await db
            .update(tadaBills)
            .set({
                status: 'APPROVED',
                updatedAt: new Date()
            })
            .where(inArray(tadaBills.id, ids));

        revalidateTag(`tada-bills-global-${session.schemaName}`, 'hours');
        
        return NextResponse.json({ message: `${ids.length} bills approved successfully`, count: ids.length }, { status: 200 });
    } catch (error) {
        console.error('Error in Bulk TA/DA Verification:', error);
        return NextResponse.json({ error: 'Bulk update failed', details: (error as Error).message }, { status: 500 });
    }
});