// src/app/api/dashboardPagesAPI/slm-attendance/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { withTenantSchema } from '@/lib/drizzle';
import { users, salesmanAttendance } from '../../../../../drizzle/schema';
import { eq, and, or, ilike, gte, lte, desc, getTableColumns, count, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { verifySession, hasPermission } from '@/lib/auth';

const frontendAttendanceSchema = z.object({
  id: z.string(),
  userId: z.number(),
  salesmanName: z.string(),
  date: z.string(),
  location: z.string().nullable().optional(),
  inTime: z.string().nullable(),
  outTime: z.string().nullable(),
  inTimeLatitude: z.number().nullable(),
  inTimeLongitude: z.number().nullable(),
  outTimeLatitude: z.number().nullable(),
  outTimeLongitude: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  area: z.string(),
  zone: z.string(),
}).passthrough();

async function getCachedAttendance(
  schemaName: string,
  page: number,
  pageSize: number,
  search: string | null,
  jobTitle: string | null,
  companyRole: string | null,
  area: string | null,
  zone: string | null,
  startDateParam: string | null,
  endDateParam: string | null
) {
  'use cache';
  cacheLife('hours');
  cacheTag(`salesman-attendance-global-${schemaName}`);
  
  const filterKey = `${search}-${jobTitle}-${companyRole}-${area}-${zone}-${startDateParam}-${endDateParam}`;
  cacheTag(`salesman-attendance-${schemaName}-${page}-${filterKey}`);

  return withTenantSchema(schemaName, async (db) => {
    const filters: SQL[] = [];

    if (search) {
      const searchCondition = or(
        ilike(users.username, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(salesmanAttendance.locationName, `%${search}%`)
      );
      if (searchCondition) filters.push(searchCondition);
    }

    if (jobTitle && jobTitle !== 'all') filters.push(eq(users.role, jobTitle));
    if (companyRole && companyRole !== 'all') filters.push(eq(salesmanAttendance.role, companyRole));
    if (area && area !== 'all') filters.push(eq(users.area, area));
    if (zone && zone !== 'all') filters.push(eq(users.zone, zone));

    if (startDateParam) {
      const start = new Date(startDateParam);
      const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
      end.setHours(23, 59, 59, 999);

      filters.push(gte(salesmanAttendance.attendanceDate, start.toISOString()));
      filters.push(lte(salesmanAttendance.attendanceDate, end.toISOString()));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const attendanceRecords = await db
      .select({
        ...getTableColumns(salesmanAttendance),
        userUsername: users.username,
        userEmail: users.email,
        userArea: users.area,
        userZone: users.zone,
      })
      .from(salesmanAttendance)
      .leftJoin(users, eq(salesmanAttendance.userId, users.id))
      .where(whereClause)
      .orderBy(desc(salesmanAttendance.attendanceDate), desc(salesmanAttendance.createdAt))
      .limit(pageSize)
      .offset(page * pageSize);

    const totalCountResult = await db
      .select({ count: count() })
      .from(salesmanAttendance)
      .leftJoin(users, eq(salesmanAttendance.userId, users.id))
      .where(whereClause);

    const totalCount = Number(totalCountResult[0].count);

    const formattedData = attendanceRecords.map((row) => {
      const salesmanName = row.userUsername || row.userEmail || 'N/A';
      const toNum = (val: any) => (val ? Number(val) : null);

      return {
        ...row,
        salesmanName: salesmanName,
        date: row.attendanceDate ? new Date(row.attendanceDate).toISOString().split('T')[0] : '',
        location: row.locationName,
        inTime: row.inTimeTimestamp ? new Date(row.inTimeTimestamp).toISOString() : null,
        outTime: row.outTimeTimestamp ? new Date(row.outTimeTimestamp).toISOString() : null,
        inTimeLatitude: toNum(row.inTimeLatitude) ?? 0,
        inTimeLongitude: toNum(row.inTimeLongitude) ?? 0,
        outTimeLatitude: toNum(row.outTimeLatitude),
        outTimeLongitude: toNum(row.outTimeLongitude),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        area: row.userArea ?? '',
        zone: row.userZone ?? '',
      };
    });

    return { data: formattedData, totalCount };
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

    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    const search = searchParams.get('search');
    const jobTitle = searchParams.get('jobTitle');
    const companyRole = searchParams.get('companyRole');
    const area = searchParams.get('area');
    const zone = searchParams.get('zone');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const result = await getCachedAttendance(
      session.schemaName,
      page,
      pageSize,
      search,
      jobTitle,
      companyRole,
      area,
      zone,
      startDateParam,
      endDateParam
    );

    const validatedData = z.array(frontendAttendanceSchema).safeParse(result.data);

    if (!validatedData.success) {
      console.error("Attendance Validation Error:", validatedData.error.format());
      return NextResponse.json({
        data: result.data,
        totalCount: result.totalCount,
        page,
        pageSize
      }, { status: 200 });
    }

    return NextResponse.json({
      data: validatedData.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching salesman attendance:', error);
    return NextResponse.json({
      message: 'Failed to fetch salesman attendance reports',
      error: (error as Error).message
    }, { status: 500 });
  }
}