// src/app/api/dashboardPagesAPI/institutionManagement/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { institutions } from '../../../../../drizzle/schema';
import { eq, and, or, ilike, desc, count, SQL } from 'drizzle-orm';
import { verifySession, hasPermission } from '@/lib/auth';

async function getCachedInstitutions(
    page: number,
    pageSize: number,
    search: string | null,
    zone: string | null,
    district: string | null,
    area: string | null
) {
    'use cache';
    cacheLife('days');
    cacheTag('institutions-global');

    // Unique cache tag based on active filters and pagination
    const filterKey = `${search}-${zone}-${district}-${area}`;
    cacheTag(`institutions-${page}-${filterKey}`);

    const filters: SQL[] = [];

    if (search) {
        filters.push(
            or(
                ilike(institutions.institutionName, `%${search}%`),
                ilike(institutions.contactPersonName, `%${search}%`),
                ilike(institutions.contactPersonNumber, `%${search}%`),
                ilike(institutions.email, `%${search}%`),
                ilike(institutions.gstNo, `%${search}%`)
            )!
        );
    }

    if (zone) filters.push(eq(institutions.zone, zone));
    if (district) filters.push(eq(institutions.district, district));
    if (area) filters.push(eq(institutions.area, area));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const rawInstitutions = await db
        .select()
        .from(institutions)
        .where(whereClause)
        .orderBy(desc(institutions.createdAt))
        .limit(pageSize)
        .offset(page * pageSize);

    const totalCountResult = await db
        .select({ count: count(institutions.id) })
        .from(institutions)
        .where(whereClause);

    const totalCount = Number(totalCountResult[0]?.count ?? 0);

    return { data: rawInstitutions, totalCount };
}

export async function GET(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (!hasPermission(session.permissions, 'READ')) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get('page') ?? 0);
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

        const search = searchParams.get('search');
        const zone = searchParams.get('zone');
        const district = searchParams.get('district');
        const area = searchParams.get('area');

        // Fetch using the cached function
        const result = await getCachedInstitutions(
            page,
            pageSize,
            search,
            zone,
            district,
            area
        );

        return NextResponse.json({
            data: result.data,
            totalCount: result.totalCount,
            page,
            pageSize
        }, { status: 200 });
    } catch (error) {
        console.error('Error fetching institutions (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch institutions', details: (error as Error).message }, { status: 500 });
    }
}