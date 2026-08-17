// src/app/api/dashboardPagesAPI/tadaBill/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { withTenantSchema } from '@/lib/drizzle';
import { users, tadaBills, tadaBillItems } from '../../../../../drizzle/schema';
import { eq, desc, and, or, ilike, getTableColumns, count, SQL, gte, lte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { verifySession, hasPermission } from '@/lib/auth';

// 1. Zod Schema for Line Items
const tadaBillItemSchema = z.object({
  id: z.string(),
  billId: z.string(),
  fromLocation: z.string().nullable().optional(),
  toLocation: z.string().nullable().optional(),
  distanceTravelled: z.coerce.number().nullable().optional(),
  transportFare: z.coerce.number().nullable().optional(),
  lodgingFare: z.coerce.number().nullable().optional(),
  foodingFare: z.coerce.number().nullable().optional(),
  localConveyance: z.coerce.number().nullable().optional(),
  outOfPocketPaid: z.coerce.number().nullable().optional(),
  totalBillsAdded: z.coerce.number().nullable().optional(),
  billPhotoUrls: z.array(z.string()).nullable().optional(),
  remarks: z.string().nullable().optional(),
}).passthrough();

// 2. Zod Schema for the Main Bill Envelope
const frontendTadaBillSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  area: z.string(),
  zone: z.string(),
  billDate: z.string(),
  fromDate: z.string(),
  toDate: z.string(),
  totalCost: z.coerce.number().nullable().optional(),
  status: z.string(),
  remarks: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(tadaBillItemSchema),
}).passthrough();

async function getCachedTadaBills(
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
  cacheTag(`tada-bills-global-${schemaName}`);
  
  const filterKey = `${search}-${area}-${zone}-${startDate}-${endDate}`;
  cacheTag(`tada-bills-${schemaName}-${page}-${filterKey}`);

  return withTenantSchema(schemaName, async (db) => {
    const filters: SQL[] = [];

    // Filter based on salesman name or remarks
    if (search) {
      const searchCondition = or(
        ilike(users.username, `%${search}%`),
        ilike(tadaBills.remarks, `%${search}%`)
      );
      if (searchCondition) filters.push(searchCondition);
    }

    // Geographic filtering
    if (area) filters.push(eq(users.area, area));
    if (zone) filters.push(eq(users.zone, zone));

    // Date filtering
    if (startDate) filters.push(gte(tadaBills.billDate, startDate));
    if (endDate) filters.push(lte(tadaBills.billDate, endDate));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // STEP A: Fetch the parent envelope (Paginated correctly)
    const billsResult = await db
      .select({
        ...getTableColumns(tadaBills),
        userUsername: users.username,
        userEmail: users.email,
        userArea: users.area,
        userZone: users.zone,
      })
      .from(tadaBills)
      .leftJoin(users, eq(tadaBills.userId, users.id))
      .where(whereClause)
      .orderBy(desc(tadaBills.billDate))
      .limit(pageSize)
      .offset(page * pageSize);

    // STEP B: Fetch the total count for pagination
    const totalCountResult = await db
      .select({ count: count() })
      .from(tadaBills)
      .leftJoin(users, eq(tadaBills.userId, users.id))
      .where(whereClause);

    const totalCount = Number(totalCountResult[0].count);

    // STEP C: Fetch the nested line items for ONLY the retrieved bills
    const billIds = billsResult.map(b => b.id);
    let allItems: any[] = [];
    if (billIds.length > 0) {
      allItems = await db
        .select()
        .from(tadaBillItems)
        .where(inArray(tadaBillItems.billId, billIds));
    }

    // STEP D: Map and nest the items into the parent bills
    const formatted = billsResult.map((row) => {
      const salesmanName = row.userUsername || row.userEmail || 'Unknown';

      // Filter items belonging to this specific bill
      const relatedItems = allItems
        .filter(item => item.billId === row.id)
        .map(item => ({
          ...item,
          distanceTravelled: item.distanceTravelled?.toString() ?? null,
          transportFare: item.transportFare?.toString() ?? null,
          lodgingFare: item.lodgingFare?.toString() ?? null,
          foodingFare: item.foodingFare?.toString() ?? null,
          localConveyance: item.localConveyance?.toString() ?? null,
          outOfPocketPaid: item.outOfPocketPaid?.toString() ?? null,
          totalBillsAdded: item.totalBillsAdded ?? 0,
          billPhotoUrls: item.billPhotoUrls ?? [],
        }));

      return {
        ...row,
        id: String(row.id),
        salesmanName: salesmanName,
        area: row.userArea || '',
        zone: row.userZone || '',
        billDate: row.billDate ? new Date(row.billDate).toISOString().split('T')[0] : '',
        fromDate: row.fromDate ? new Date(row.billDate).toISOString().split('T')[0] : '',
        toDate: row.toDate ? new Date(row.billDate).toISOString().split('T')[0] : '',
        totalCost: row.totalCost?.toString() ?? null,
        status: row.status ?? 'PENDING',
        remarks: row.remarks ?? null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        items: relatedItems,
      };
    });

    return { data: formatted, totalCount };
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const result = await getCachedTadaBills(
      session.schemaName,
      page,
      pageSize,
      search,
      area,
      zone,
      startDate,
      endDate
    );

    const validatedReports = z.array(frontendTadaBillSchema).safeParse(result.data);

    if (!validatedReports.success) {
      console.error('TA/DA Bill Validation Error:', validatedReports.error.format());
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
    console.error('Error fetching TA/DA Bills:', error);
    return NextResponse.json({
      error: 'Failed to fetch TA/DA Bills',
      details: (error as Error).message
    }, { status: 500 });
  }
}