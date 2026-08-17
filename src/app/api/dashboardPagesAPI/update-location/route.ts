// src/app/api/dashboardPagesAPI/update-location/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { withTenantDb, hasPermission } from '@/lib/auth';
import { salesmanAttendance } from '../../../../../drizzle';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
    id: z.string(),
    address: z.string().min(5),
});

export const POST = withTenantDb(async (request, db, session) => {
    try {
        const hasRequiredPerms = hasPermission(session.permissions, ['UPDATE', 'WRITE']);
        if (!hasRequiredPerms) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const parsedBody = updateSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: parsedBody.error.format() }, { status: 400 });
        }

        const { id, address } = parsedBody.data;

        // Use the injected `db` instance which is already tenant-scoped
        const updatedResult = await db
            .update(salesmanAttendance)
            .set({
                locationName: address,
                updatedAt: new Date().toISOString()
            })
            .where(eq(salesmanAttendance.id, Number(id) || id as any))
            .returning();

        const updated = updatedResult[0];
        if (!updated) {
            return NextResponse.json({ error: 'Record not found or update failed' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (error) {
        console.error("Error updating location:", error);
        return NextResponse.json({ error: 'Update failed', details: (error as Error).message }, { status: 500 });
    }
});