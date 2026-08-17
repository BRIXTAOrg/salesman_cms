// src/app/api/dashboardPagesAPI/tadaBill/tada-verification/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { users, tadaBills, tadaBillItems } from '../../../../../../drizzle/schema';
import { eq, desc, ilike, inArray } from 'drizzle-orm';
import { withTenantDb, hasPermission } from '@/lib/auth';

export const GET = withTenantDb(async (request, db, session) => {
  try {
    if (!hasPermission(session.permissions, "READ")) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 1. Fetch only pending parent envelopes
    const pendingBills = await db
      .select({
        bill: tadaBills,
        salesmanName: users.username,
        salesmanEmail: users.email,
        salesmanZone: users.zone,
        salesmanArea: users.area,
      })
      .from(tadaBills)
      .leftJoin(users, eq(tadaBills.userId, users.id))
      .where(ilike(tadaBills.status, 'PENDING'))
      .orderBy(desc(tadaBills.billDate));

    if (pendingBills.length === 0) return NextResponse.json({ data: [] }, { status: 200 });

    // 2. Fetch associated child items
    const billIds = pendingBills.map(b => b.bill.id);
    const allItems = await db.select().from(tadaBillItems).where(inArray(tadaBillItems.billId, billIds));

    // 3. Map together
    const formatted = pendingBills.map((row) => {
      const relatedItems = allItems
        .filter(item => item.billId === row.bill.id)
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
        ...row.bill,
        salesmanName: row.salesmanName || row.salesmanEmail || 'Unknown',
        zone: row.salesmanZone || '',
        area: row.salesmanArea || '',
        totalCost: row.bill.totalCost?.toString() ?? null,
        items: relatedItems,
      };
    });

    return NextResponse.json({ data: formatted }, { status: 200 });
  } catch (error) {
    console.error('Error fetching pending TA/DA:', error);
    return NextResponse.json({ error: 'Failed to fetch', details: (error as Error).message }, { status: 500 });
  }
});