// src/app/api/dashboardPagesAPI/dealerManagement/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { withTenantSchema } from '@/lib/drizzle';
import { dealers } from '../../../../../drizzle/schema';
import { eq, and, or, ilike, desc, count, SQL } from 'drizzle-orm';
import { verifySession, hasPermission } from '@/lib/auth';

async function getCachedDealers(
    schemaName: string,
    page: number,
    pageSize: number,
    search: string | null,
    zone: string | null,
    district: string | null,
    area: string | null
) {
    'use cache';
    cacheLife('days');
    cacheTag(`dealers-global-${schemaName}`);

    const filterKey = `${search}-${zone}-${district}-${area}`;
    cacheTag(`dealers-${schemaName}-${page}-${filterKey}`);

    return withTenantSchema(schemaName, async (db) => {
        const filters: SQL[] = [];

        if (search) {
            filters.push(
                or(
                    ilike(dealers.dealerPartyName, `%${search}%`),
                    ilike(dealers.contactPersonName, `%${search}%`),
                    ilike(dealers.contactPersonNumber, `%${search}%`),
                    ilike(dealers.email, `%${search}%`),
                    ilike(dealers.gstNo, `%${search}%`)
                )!
            );
        }

        if (zone) filters.push(eq(dealers.zone, zone));
        if (district) filters.push(eq(dealers.district, district));
        if (area) filters.push(eq(dealers.area, area));

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

        const rawDealers = await db
            .select()
            .from(dealers)
            .where(whereClause)
            .orderBy(desc(dealers.createdAt))
            .limit(pageSize)
            .offset(page * pageSize);

        const totalCountResult = await db
            .select({ count: count(dealers.id) })
            .from(dealers)
            .where(whereClause);

        const totalCount = Number(totalCountResult[0]?.count ?? 0);

        return { data: rawDealers, totalCount };
    });
}

export async function GET(request: NextRequest) {
    const session = await verifySession();
    try {
        if (!session?.userId || !session.schemaName) {
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

        const result = await getCachedDealers(
            session.schemaName,
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
        console.error('Error fetching dealers (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch dealers', details: (error as Error).message }, { status: 500 });
    }
}