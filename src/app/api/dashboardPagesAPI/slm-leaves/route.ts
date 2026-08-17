// src/app/api/dashboardPagesAPI/slm-leaves/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { refreshCompanyCache } from '@/app/actions/cache';
import { withTenantSchema } from '@/lib/drizzle';
import { users, salesmanLeaveApplications } from '../../../../../drizzle/schema';
import { eq, and, or, ilike, gte, lte, desc, getTableColumns, count, SQL } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm';
import { z } from 'zod';
import { withTenantDb, verifySession, hasPermission } from '@/lib/auth';

const frontendLeaveSchema = z.object({
  id: z.string(),
  userId: z.number(),
  salesmanName: z.string(),
  approverName: z.string(),
  area: z.string(),
  zone: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  appRole: z.string().nullable().optional(),
}).passthrough();

const approvers = aliasedTable(users, 'approvers');

async function getCachedLeaves(
  schemaName: string,
  page: number,
  pageSize: number,
  search: string | null,
  area: string | null,
  zone: string | null,
  startDateParam: string | null,
  endDateParam: string | null,
  createdStartDate: string | null,
  createdEndDate: string | null
) {
  'use cache';
  cacheLife('hours');
  cacheTag(`salesman-leaves-global-${schemaName}`);
  
  const filterKey = `${search}-${area}-${zone}-${startDateParam}-${endDateParam}`;
  cacheTag(`salesman-leaves-${schemaName}-${page}-${filterKey}`);

  return withTenantSchema(schemaName, async (db) => {
    const filters: SQL[] = [];

    if (search) {
      const searchCondition = or(
        ilike(users.username, `%${search}%`),
        ilike(salesmanLeaveApplications.reason, `%${search}%`),
        ilike(salesmanLeaveApplications.leaveType, `%${search}%`)
      );
      if (searchCondition) filters.push(searchCondition);
    }

    if (area && area !== 'all') filters.push(eq(users.area, area));
    if (zone && zone !== 'all') filters.push(eq(users.zone, zone));

    if (startDateParam) {
      const start = new Date(startDateParam);
      const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
      end.setHours(23, 59, 59, 999);

      filters.push(lte(salesmanLeaveApplications.startDate, end.toISOString()));
      filters.push(gte(salesmanLeaveApplications.endDate, start.toISOString()));
    }

    if (createdStartDate) {
      const start = new Date(createdStartDate);
      const end = createdEndDate ? new Date(createdEndDate) : new Date(createdStartDate);
      end.setHours(23, 59, 59, 999);

      filters.push(gte(salesmanLeaveApplications.createdAt, start.toISOString()));
      filters.push(lte(salesmanLeaveApplications.createdAt, end.toISOString()));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const results = await db
      .select({
        ...getTableColumns(salesmanLeaveApplications),
        userUsername: users.username,
        userEmail: users.email,
        userArea: users.area,
        userZone: users.zone,
        approverUsername: approvers.username,
        approverEmail: approvers.email,
      })
      .from(salesmanLeaveApplications)
      .leftJoin(users, eq(salesmanLeaveApplications.userId, users.id))
      .leftJoin(approvers, eq(users.reportsToId, approvers.id))
      .where(whereClause)
      .orderBy(desc(salesmanLeaveApplications.createdAt))
      .limit(pageSize)
      .offset(page * pageSize);

    const totalCountResult = await db
      .select({ count: count() })
      .from(salesmanLeaveApplications)
      .leftJoin(users, eq(salesmanLeaveApplications.userId, users.id))
      .where(whereClause);

    const totalCount = Number(totalCountResult[0].count);

    const formattedApplications = results.map((row) => {
      const salesmanName = row.userUsername || row.userEmail || 'N/A';
      const approverName = row.approverUsername || row.approverEmail || 'Not Assigned';

      return {
        ...row,
        salesmanName,
        approverName,
        startDate: row.startDate ? new Date(row.startDate).toISOString().split('T')[0] : '',
        endDate: row.endDate ? new Date(row.endDate).toISOString().split('T')[0] : '',
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        area: row.userArea ?? '',
        zone: row.userZone ?? '',
      };
    });

    return { data: formattedApplications, totalCount };
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
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

    const search = searchParams.get('search');
    const area = searchParams.get('area');
    const zone = searchParams.get('zone');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const createdStartDate = searchParams.get('createdStartDate');
    const createdEndDate = searchParams.get('createdEndDate');

    const result = await getCachedLeaves(
      session.schemaName,
      page,
      pageSize,
      search,
      area,
      zone,
      startDateParam,
      endDateParam,
      createdStartDate,
      createdEndDate
    );

    const validatedData = z.array(frontendLeaveSchema).safeParse(result.data);

    if (!validatedData.success) {
      console.error("Leaves GET Validation Error:", validatedData.error.format());
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
    console.error('Error fetching leaves:', error);
    return NextResponse.json({ message: 'Failed to fetch leave applications', error: (error as Error).message }, { status: 500 });
  }
}

// PATTERN 1: Mutation mapped with `withTenantDb`
export const PATCH = withTenantDb(async (req, db, session) => {
  try {
    if (!hasPermission(session.permissions, ['UPDATE', 'WRITE'])) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.id || !body.status) {
      return NextResponse.json({ message: 'Invalid request body, id and status required.' }, { status: 400 });
    }

    const { id, status, adminRemarks } = body;

    const existingApp = await db
      .select({ id: salesmanLeaveApplications.id })
      .from(salesmanLeaveApplications)
      .where(eq(salesmanLeaveApplications.id, id))
      .limit(1);

    if (!existingApp[0]) {
      return NextResponse.json({ message: 'Leave application not found' }, { status: 404 });
    }

    const updatedResult = await db
      .update(salesmanLeaveApplications)
      .set({
        status: status as string,
        adminRemarks: adminRemarks ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(salesmanLeaveApplications.id, id))
      .returning();

    const app = updatedResult[0];

    // Invalidate Cache globally per tenant
    await refreshCompanyCache(`salesman-leaves-global-${session.schemaName}`);

    return NextResponse.json({
      id: app.id,
      status: app.status,
      adminRemarks: app.adminRemarks,
      updatedAt: app.updatedAt,
    });
  } catch (error: any) {
    console.error('Error updating leave:', error);
    return NextResponse.json({ message: 'Failed to update leave application', error: error.message }, { status: 500 });
  }
});