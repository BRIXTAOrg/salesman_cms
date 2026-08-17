// src/app/api/dashboardPagesAPI/reports/so-performance-metrics/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { withTenantSchema } from '@/lib/drizzle';
import { users, dailyVisitReports } from '../../../../../../drizzle/schema';
import { desc, and, or, ilike, SQL, sql, gte, lte, eq } from 'drizzle-orm';
import { z } from 'zod';
import { SO_AOP_TARGETS } from '@/lib/Reusable-constants';
import { verifySession, hasPermission } from '@/lib/auth';

const metricNode = z.object({
    aop: z.number(),
    mtd: z.number(),
    pct: z.number(),
});

const soPerformanceMetricSchema = z.object({
    userId: z.number().nullable(),
    salesmanName: z.string(),
    zone: z.string().nullable(),
    area: z.string().nullable(),
    totalVisits: z.number(),
    metrics: z.object({
        dealerVisits: metricNode,
        institutionVisits: metricNode,
        influencerVisits: metricNode,
    })
});

async function getCachedSoPerformanceMetrics(
    schemaName: string,
    page: number,
    pageSize: number,
    search: string | null,
    area: string | null,
    zone: string | null,
    startDate: string | null,
    endDate: string | null
) {
    'use cache';
    cacheLife('hours');
    cacheTag(`so-performance-metrics-global-${schemaName}`);
    
    const filterKey = `${search}-${area}-${zone}-${startDate}-${endDate}`;
    cacheTag(`so-performance-metrics-${schemaName}-${page}-${filterKey}`);

    return withTenantSchema(schemaName, async (db) => {
        const filters: SQL[] = [];

        if (search) {
            const searchCondition = or(
                ilike(users.username, `%${search}%`),
                ilike(users.area, `%${search}%`),
                ilike(users.zone, `%${search}%`)
            );
            if (searchCondition) filters.push(searchCondition);
        }

        if (area) filters.push(eq(users.area, area));
        if (zone) filters.push(eq(users.zone, zone));

        if (startDate) {
            filters.push(gte(dailyVisitReports.reportDate, startDate));
        }

        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            filters.push(lte(dailyVisitReports.reportDate, endOfDay.toISOString()));
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

        const rawResults = await db
            .select({
                userId: users.id,
                salesmanName: sql<string>`COALESCE(NULLIF(TRIM(${users.username}), ''), ${users.email})`,
                zone: users.zone,
                area: users.area,
                totalVisits: sql<number>`CAST(COUNT(${dailyVisitReports.id}) AS INTEGER)`,
                
                // Splits Based on customerType
                dealerVisits: sql<number>`CAST(SUM(CASE WHEN ${dailyVisitReports.customerType} ILIKE 'Dealer%' THEN 1 ELSE 0 END) AS INTEGER)`,
                institutionVisits: sql<number>`CAST(SUM(CASE WHEN ${dailyVisitReports.customerType} ILIKE 'Institution%' THEN 1 ELSE 0 END) AS INTEGER)`,
                influencerVisits: sql<number>`CAST(SUM(CASE WHEN ${dailyVisitReports.customerType} ILIKE 'Influencer%' THEN 1 ELSE 0 END) AS INTEGER)`,
            })
            .from(dailyVisitReports)
            .leftJoin(users, eq(dailyVisitReports.userId, users.id))
            .where(whereClause)
            .groupBy(users.id, users.username, users.email, users.zone, users.area)
            .orderBy(desc(sql`COUNT(${dailyVisitReports.id})`))
            .limit(pageSize)
            .offset(page * pageSize);

        const totalCountQuery = await db
            .select({ userId: users.id })
            .from(dailyVisitReports)
            .leftJoin(users, eq(dailyVisitReports.userId, users.id))
            .where(whereClause)
            .groupBy(users.id);

        const totalCount = totalCountQuery.length;

        const calcPct = (mtd: number, aop: number) => aop > 0 ? Math.round((mtd / aop) * 100) : 0;

        const results = rawResults.map((r) => {
            const dealerAOP = (SO_AOP_TARGETS as any)?.dealerVisits || 0;
            const institutionAOP = (SO_AOP_TARGETS as any)?.institutionVisits || 0;
            const influencerAOP = (SO_AOP_TARGETS as any)?.influencerVisits || 0;

            return {
                userId: r.userId,
                salesmanName: r.salesmanName,
                zone: r.zone,
                area: r.area,
                totalVisits: r.totalVisits,
                metrics: {
                    dealerVisits: { aop: dealerAOP, mtd: r.dealerVisits || 0, pct: calcPct(r.dealerVisits || 0, dealerAOP) },
                    institutionVisits: { aop: institutionAOP, mtd: r.institutionVisits || 0, pct: calcPct(r.institutionVisits || 0, institutionAOP) },
                    influencerVisits: { aop: influencerAOP, mtd: r.influencerVisits || 0, pct: calcPct(r.influencerVisits || 0, influencerAOP) },
                }
            };
        });

        return { data: results, totalCount };
    });
}

export async function GET(request: NextRequest) {
    if (typeof connection === 'function') await connection();

    try {
        const session = await verifySession();
        if (!session || !session.userId || !session.schemaName) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (!hasPermission(session.permissions, "READ")) {
            return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get('page') ?? 0);
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 100), 500);

        const search = searchParams.get('search');
        const area = searchParams.get('area');
        const zone = searchParams.get('zone');
        
        let startDate = searchParams.get('startDate');
        let endDate = searchParams.get('endDate');

        if (!startDate || !endDate) {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date();
            lastDay.setHours(23, 59, 59, 999);
            startDate = startDate || firstDay.toISOString();
            endDate = endDate || lastDay.toISOString();
        }

        const result = await getCachedSoPerformanceMetrics(
            session.schemaName,
            page, 
            pageSize, 
            search, area, zone, startDate, endDate
        );

        const validated = z.array(soPerformanceMetricSchema).safeParse(result.data);

        return NextResponse.json({
            data: validated.success ? validated.data : result.data,
            totalCount: result.totalCount,
            page,
            pageSize,
        });
    } catch (error) {
        return NextResponse.json(
            { message: 'Failed to fetch SO performance metrics', error: (error as Error).message },
            { status: 500 }
        );
    }
}