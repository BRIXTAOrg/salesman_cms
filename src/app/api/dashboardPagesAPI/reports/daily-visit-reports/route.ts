// src/app/api/dashboardPagesAPI/reports/daily-visit-reports/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { withTenantSchema } from '@/lib/drizzle';
import { users, dailyVisitReports, dealers } from '../../../../../../drizzle/schema';
import { eq, desc, and, or, ilike, getTableColumns, count, SQL, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { verifySession, hasPermission } from '@/lib/auth';

const frontendDVRSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  area: z.string(),
  zone: z.string(),
  dealerName: z.string().nullable().optional(),

  customerType: z.string().nullable().optional(),
  dealerType: z.string().nullable().optional(),
  institutionType: z.string().nullable().optional(),
  ifluencerType: z.string().nullable().optional(),
  visitType: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  brandSelling: z.array(z.string()).nullable().optional(),

  nameOfParty: z.string().nullable().optional(),
  contactNoOfParty: z.string().nullable().optional(),
  expectedActivationDate: z.string().nullable().optional(),

  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  todayOrderQty: z.coerce.number().nullable().optional(),
  todayCollectionRupees: z.coerce.number().nullable().optional(),
  overdueAmount: z.coerce.number().nullable().optional(),

  reportDate: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

async function getCachedDailyVisitReports(
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
  cacheTag(`daily-visit-reports-global-${schemaName}`);
  const filterKey = `${search}-${area}-${zone}-${startDate}-${endDate}`;
  cacheTag(`daily-visit-reports-${schemaName}-${page}-${filterKey}`);

  const filters: SQL[] = [];

  return withTenantSchema(schemaName, async (db) => {
    const filters: SQL[] = [];
    if (search) {
      const searchCondition = or(
        ilike(users.username, `%${search}%`),
        ilike(dealers.dealerPartyName, `%${search}%`),
        ilike(dailyVisitReports.nameOfParty, `%${search}%`),
        ilike(dailyVisitReports.location, `%${search}%`)
      );
      if (searchCondition) filters.push(searchCondition);
    }

    if (area) filters.push(eq(users.area, area));
    if (zone) filters.push(eq(users.zone, zone));

    if (startDate) filters.push(gte(dailyVisitReports.reportDate, startDate));
    if (endDate) filters.push(lte(dailyVisitReports.reportDate, endDate));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const results = await db
      .select({
        ...getTableColumns(dailyVisitReports),
        userUsername: users.username,
        userEmail: users.email,
        userArea: users.area,
        userZone: users.zone,
        dealerNameStr: dealers.dealerPartyName,
      })
      .from(dailyVisitReports)
      .leftJoin(users, eq(dailyVisitReports.userId, users.id))
      .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
      .where(whereClause)
      .orderBy(desc(dailyVisitReports.reportDate))
      .limit(pageSize)
      .offset(page * pageSize);

    const totalCountResult = await db
      .select({ count: count() })
      .from(dailyVisitReports)
      .leftJoin(users, eq(dailyVisitReports.userId, users.id))
      .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
      .where(whereClause);

    const totalCount = Number(totalCountResult[0].count);

    const formatted = results.map((row) => {
      const salesmanName = row.userUsername || row.userEmail || 'Unknown';

      return {
        ...row,
        id: String(row.id),
        salesmanName: salesmanName,
        area: row.userArea || '',
        zone: row.userZone || '',
        reportDate: row.reportDate ? new Date(row.reportDate).toISOString().split('T')[0] : '',
        dealerName: row.dealerNameStr ?? null,

        customerType: row.customerType ?? null,
        dealerType: row.dealerType ?? null,
        institutionType: row.institutionType ?? null,
        influencerType: row.influencerType ?? null,
        visitType: row.visitType ?? null,
        location: row.location ?? null,
        brandSelling: row.brandSelling ?? null,

        nameOfParty: row.nameOfParty ?? null,
        contactNoOfParty: row.contactNoOfParty ?? null,
        expectedActivationDate: row.expectedActivationDate ? new Date(row.expectedActivationDate).toISOString().split('T')[0] : null,

        latitude: row.latitude?.toString() ?? null,
        longitude: row.longitude?.toString() ?? null,
        todayOrderQty: row.todayOrderQty?.toString() ?? null,
        todayCollectionRupees: row.todayCollectionRupees?.toString() ?? null,
        overdueAmount: row.overdueAmount?.toString() ?? null,

        checkInTime: row.checkInTime ? new Date(row.checkInTime).toISOString() : '',
        checkOutTime: row.checkOutTime ? new Date(row.checkOutTime).toISOString() : null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      };
    });

    return { data: formatted, totalCount };
  });
}

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session.permissions, "READ")) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

    const search = searchParams.get('search');
    const area = searchParams.get('area');
    const zone = searchParams.get('zone');

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const result = await getCachedDailyVisitReports(
      session.schemaName,
      page,
      pageSize,
      search,
      area,
      zone,
      startDate,
      endDate
    );

    const validatedReports = z.array(frontendDVRSchema).safeParse(result.data);

    if (!validatedReports.success) {
      console.error('DVR Validation Error:', validatedReports.error.format());
      return NextResponse.json({
        data: result.data,
        totalCount: result.totalCount,
        page,
        pageSize
      }, { status: 200 });
    }

    return NextResponse.json({
      data: validatedReports.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching daily visit reports:', error);
    return NextResponse.json({
      error: 'Failed to fetch daily visit reports',
      details: (error as Error).message
    }, { status: 500 });
  }
}