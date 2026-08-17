// src/app/api/dashboardPagesAPI/dealerManagement/dealer-types/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { withTenantDb } from '@/lib/auth';
import { dealers } from '../../../../../../drizzle';
import { asc } from 'drizzle-orm';

export const GET = withTenantDb(async (request, db, session) => {
  try {
    if (!session.permissions.includes('READ')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const [uniqueZones, uniqueAreas] = await Promise.all([
      db
        .selectDistinct({ zone: dealers.zone })
        .from(dealers)
        .orderBy(asc(dealers.zone)),
      db
        .selectDistinct({ area: dealers.area })
        .from(dealers)
        .orderBy(asc(dealers.area)),
    ]);

    const zones = uniqueZones
      .map((z) => z.zone)
      .filter((z): z is string => Boolean(z && z.trim() !== ''));

    const areas = uniqueAreas
      .map((a) => a.area)
      .filter((a): a is string => Boolean(a && a.trim() !== ''));

    return NextResponse.json({ zones, areas }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching dealer locations:', error);
    return NextResponse.json({ error: `Failed to fetch locations: ${error.message}` }, { status: 500 });
  }
});