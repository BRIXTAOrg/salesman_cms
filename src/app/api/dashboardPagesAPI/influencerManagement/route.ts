// src/app/api/dashboardPagesAPI/influencerManagement/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { withTenantSchema } from '@/lib/drizzle';
import { influencers } from '../../../../../drizzle/schema';
import { eq, and, or, ilike, desc, count, SQL } from 'drizzle-orm';
import { verifySession, hasPermission } from '@/lib/auth';

async function getCachedInfluencers(
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
    cacheTag(`influencers-global-${schemaName}`);
    
    // Unique cache tag based on active filters and pagination
    const filterKey = `${search}-${zone}-${district}-${area}`;
    cacheTag(`influencers-${schemaName}-${page}-${filterKey}`);

    return withTenantSchema(schemaName, async (db) => {
        const filters: SQL[] = [];

        if (search) {
            filters.push(
                or(
                    ilike(influencers.contactPersonName, `%${search}%`),
                    ilike(influencers.contactPersonNumber, `%${search}%`),
                    ilike(influencers.email, `%${search}%`)
                )!
            );
        }

        if (zone) filters.push(eq(influencers.zone, zone));
        if (district) filters.push(eq(influencers.district, district));
        if (area) filters.push(eq(influencers.area, area));

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

        const rawInfluencers = await db
            .select()
            .from(influencers)
            .where(whereClause)
            .orderBy(desc(influencers.createdAt))
            .limit(pageSize)
            .offset(page * pageSize);

        const totalCountResult = await db
            .select({ count: count(influencers.id) })
            .from(influencers)
            .where(whereClause);

        const totalCount = Number(totalCountResult[0]?.count ?? 0);

        return { data: rawInfluencers, totalCount };
    });
}

export async function GET(request: NextRequest) {
    const session = await verifySession();
    try {
        if (!session || !session.userId || !session.schemaName) {
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
        const result = await getCachedInfluencers(
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
        console.error('Error fetching influencers (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch influencers', details: (error as Error).message }, { status: 500 });
    }
}