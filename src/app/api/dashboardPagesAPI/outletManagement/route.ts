// src/app/api/dashboardPagesAPI/outletManagement/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { outlets, distributors } from '../../../../../drizzle/schema';
import { eq, and, or, ilike, desc, count, SQL } from 'drizzle-orm';
import { verifySession, hasPermission } from '@/lib/auth';

async function getCachedOutlets(
    page: number,
    pageSize: number,
    search: string | null,
    zone: string | null,
    district: string | null,
    area: string | null
) {
    'use cache';
    cacheLife('days');
    cacheTag('outlets-global');

    const filterKey = `${search}-${zone}-${district}-${area}`;
    cacheTag(`outlets-${page}-${filterKey}`);

    const filters: SQL[] = [];

    if (search) {
        filters.push(
            or(
                ilike(outlets.name, `%${search}%`),
                ilike(outlets.concernedPersonName, `%${search}%`),
                ilike(outlets.concernedPersonPhoneNum, `%${search}%`),
                ilike(outlets.gstNumber, `%${search}%`)
            )!
        );
    }

    if (zone) filters.push(eq(outlets.zone, zone));
    if (district) filters.push(eq(outlets.district, district));
    if (area) filters.push(eq(outlets.area, area));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // Fetch outlets joined with their respective distributor details
    const rawOutlets = await db
        .select({
            outlet: outlets,
            distributor: {
                id: distributors.id,
                name: distributors.name,
                concernedPersonName: distributors.concernedPersonName,
                phone: distributors.concernedPersonPhoneNum,
            }
        })
        .from(outlets)
        .leftJoin(distributors, eq(outlets.distributorId, distributors.id))
        .where(whereClause)
        .orderBy(desc(outlets.createdAt))
        .limit(pageSize)
        .offset(page * pageSize);

    const totalCountResult = await db
        .select({ count: count(outlets.id) })
        .from(outlets)
        .where(whereClause);

    const totalCount = Number(totalCountResult[0]?.count ?? 0);

    return { data: rawOutlets, totalCount };
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

        const result = await getCachedOutlets(
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
        console.error('Error fetching outlets (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch outlets', details: (error as Error).message }, { status: 500 });
    }
}