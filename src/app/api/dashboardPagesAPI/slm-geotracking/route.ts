// src/app/api/dashboardPagesAPI/slm-geotracking/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { withTenantSchema } from '@/lib/drizzle';
import { users, journeyOps } from '../../../../../drizzle/schema';
import { eq, and, or, gte, lte, desc, sql, getTableColumns, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { verifySession, hasPermission } from '@/lib/auth';

const frontendTrackingSchema = z.object({
  id: z.string(),
  salesmanName: z.string(),
  employeeId: z.string().nullable().optional(),
  area: z.string(),
  zone: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  totalDistanceTravelled: z.number(),
  recordedAt: z.string(),
  accuracy: z.number().nullable(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  altitude: z.number().nullable(),
  locationType: z.string().nullable(),
  activityType: z.string().nullable(),
  appState: z.string().nullable(),
  batteryLevel: z.number().nullable(),
  isCharging: z.boolean(),
  networkStatus: z.string().nullable(),
  ipAddress: z.string().nullable(),
  siteName: z.string().nullable(),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  isActive: z.boolean(),
  destLat: z.number().nullable(),
  destLng: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

async function getCachedTracking(
  schemaName: string,
  startDateParam: string | null, 
  endDateParam: string | null
) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`slm-geotracking-global-${schemaName}`);
  
  const filterKey = `${startDateParam}-${endDateParam}`;
  cacheTag(`slm-geotracking-${schemaName}-${filterKey}`);

  return withTenantSchema(schemaName, async (db) => {
    const filters: SQL[] = [];

    // JSONB Filter for status: 'COMPLETED'
    filters.push(
      or(
        sql`${journeyOps.payload} @> '{"status": "COMPLETED"}'::jsonb`,
        eq(journeyOps.type, 'STOP')
      )!
    );

    if (startDateParam) {
      const start = new Date(startDateParam);
      const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
      end.setHours(23, 59, 59, 999);

      filters.push(gte(journeyOps.createdAt, start.toISOString()));
      filters.push(lte(journeyOps.createdAt, end.toISOString()));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const results = await db
      .select({
        ...getTableColumns(journeyOps),
        userUsername: users.username,
        userEmail: users.email,
        userArea: users.area,
        userZone: users.zone,
        userSalesmanLoginId: users.salesmanLoginId,
      })
      .from(journeyOps)
      .leftJoin(users, eq(journeyOps.userId, users.id))
      .where(whereClause)
      .orderBy(desc(journeyOps.createdAt))
      .limit(startDateParam ? 2000 : 500); 

    return results.map((row) => {
      const payload = (row.payload && typeof row.payload === 'object') ? row.payload as any : {};

      return {
        ...row,
        id: String(row.opId), 
        salesmanName: row.userUsername || row.userEmail || 'Unknown',
        employeeId: row.userSalesmanLoginId ?? null,
        area: row.userArea ?? '',
        zone: row.userZone ?? '',
        latitude: Number(payload.latitude) || 0,
        longitude: Number(payload.longitude) || 0,
        totalDistanceTravelled: Number(payload.totalDistance) || 0,
        recordedAt: payload.endedAt || (row.createdAt ? new Date(row.createdAt).toISOString() : ''),
        accuracy: Number(payload.accuracy) || null,
        speed: Number(payload.speed) || null,
        heading: Number(payload.heading) || null,
        altitude: Number(payload.altitude) || null,
        locationType: payload.locationType || row.type,
        activityType: payload.activityType || null,
        appState: payload.appState || null,
        batteryLevel: Number(payload.batteryLevel) || null,
        isCharging: Boolean(payload.isCharging),
        networkStatus: payload.networkStatus || null,
        ipAddress: payload.ipAddress || null,
        siteName: payload.siteName || null,
        checkInTime: payload.checkInTime || null,
        checkOutTime: payload.checkOutTime || null,
        isActive: Boolean(payload.isActive),
        destLat: Number(payload.destLat) || null,
        destLng: Number(payload.destLng) || null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
        updatedAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
      };
    });
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
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const formattedReports = await getCachedTracking(
      session.schemaName,
      startDateParam, 
      endDateParam
    );

    const validatedData = z.array(frontendTrackingSchema).safeParse(formattedReports);

    if (!validatedData.success) {
      console.error("Tracking Geo Validation Error:", validatedData.error.format());
      const safeDataFallback = JSON.parse(
        JSON.stringify(formattedReports, (_, v) => typeof v === "bigint" ? Number(v) : v)
      );
      return NextResponse.json(safeDataFallback, { status: 200 });
    }

    const safeData = JSON.parse(
      JSON.stringify(validatedData.data, (_, v) =>
        typeof v === "bigint" ? Number(v) : v
      )
    );

    return NextResponse.json(safeData, { status: 200 });

  } catch (error) {
    console.error('Error fetching tracking data:', error);
    return NextResponse.json({ error: 'Failed to fetch tracking data', details: (error as Error).message }, { status: 500 });
  }
}