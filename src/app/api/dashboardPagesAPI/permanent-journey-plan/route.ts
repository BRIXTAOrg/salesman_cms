// src/app/api/dashboardPagesAPI/permanent-journey-plan/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { users, permanentJourneyPlans, dealers, institutions, influencers } from '../../../../../drizzle/schema';
import { eq, and, or, ilike, desc, asc, aliasedTable, getTableColumns, count, gte, lte, SQL } from 'drizzle-orm';
import { withTenantDb, hasPermission } from '@/lib/auth';

const getISTDate = (date: string | Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

export const GET = withTenantDb(async (request, db, session) => {
    try {
        if (!hasPermission(session.permissions, "READ")) {
            return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        // --- Action: Fetch Distinct Filters ---
        if (action === 'fetch_filters') {
            const distinctSalesmen = await db
                .selectDistinct({ id: users.id, username: users.username, email: users.email })
                .from(permanentJourneyPlans)
                .innerJoin(users, eq(permanentJourneyPlans.userId, users.id))
                .orderBy(asc(users.username));

            const rawAreas = await db
                .selectDistinct({ area: permanentJourneyPlans.areaToBeVisited })
                .from(permanentJourneyPlans)
                .orderBy(asc(permanentJourneyPlans.areaToBeVisited));
            const distinctAreas = rawAreas.map(a => a.area).filter(Boolean);

            return NextResponse.json({
                salesmen: distinctSalesmen.map(s => ({
                    label: s.username || s.email,
                    value: String(s.id)
                })),
                areas: distinctAreas.map(a => ({ label: a, value: a }))
            });
        }

        // --- Action: Standard Server-Side Filtered Data Grid Fetch ---
        const page = Number(searchParams.get('page') ?? 0);
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 100), 500);

        const search = searchParams.get('search');
        const salesmanId = searchParams.get('salesmanId');
        const area = searchParams.get('area');
        const status = searchParams.get('status');
        const verificationStatus = searchParams.get('verificationStatus');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const filters: SQL[] = [];

        if (search) {
            filters.push(
                or(
                    ilike(permanentJourneyPlans.areaToBeVisited, `%${search}%`),
                    ilike(permanentJourneyPlans.route, `%${search}%`),
                    ilike(permanentJourneyPlans.description, `%${search}%`)
                )!
            );
        }

        if (salesmanId && salesmanId !== 'all') {
            filters.push(eq(permanentJourneyPlans.userId, Number(salesmanId)));
        }
        if (area && area !== 'all') {
            filters.push(eq(permanentJourneyPlans.areaToBeVisited, area));
        }
        if (status && status !== 'all') {
            filters.push(eq(permanentJourneyPlans.status, status));
        }
        if (verificationStatus && verificationStatus !== 'all') {
            filters.push(eq(permanentJourneyPlans.verificationStatus, verificationStatus));
        }
        if (startDate) {
            filters.push(gte(permanentJourneyPlans.planDate, startDate));
        }
        if (endDate) {
            filters.push(lte(permanentJourneyPlans.planDate, endDate));
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined;
        const createdByUsers = aliasedTable(users, 'createdBy');

        const rawResults = await db
            .select({
                ...getTableColumns(permanentJourneyPlans),
                salesmanName: users.username,
                salesmanEmail: users.email,
                createdByName: createdByUsers.username,
                createdByEmail: createdByUsers.email,
                dealerName: dealers.dealerPartyName,
                institutionName: institutions.institutionName,
                influencerName: influencers.contactPersonName,
            })
            .from(permanentJourneyPlans)
            .leftJoin(users, eq(permanentJourneyPlans.userId, users.id))
            .leftJoin(createdByUsers, eq(permanentJourneyPlans.createdById, createdByUsers.id))
            .leftJoin(dealers, eq(permanentJourneyPlans.dealerId, dealers.id))
            .leftJoin(institutions, eq(permanentJourneyPlans.institutionId, institutions.id))
            .leftJoin(influencers, eq(permanentJourneyPlans.influencerId, influencers.id))
            .where(whereClause)
            .orderBy(desc(permanentJourneyPlans.planDate))
            .limit(pageSize)
            .offset(page * pageSize);

        const totalCountResult = await db
            .select({ count: count() })
            .from(permanentJourneyPlans)
            .where(whereClause);

        const totalCount = Number(totalCountResult[0]?.count ?? 0);

        const formatted = rawResults.map((r) => ({
            ...r,
            planDate: r.planDate ? getISTDate(r.planDate) : '',
            createdAt: r.createdAt ? getISTDate(r.createdAt) : '',
            updatedAt: r.updatedAt ? getISTDate(r.updatedAt) : '',
            salesmanName: r.salesmanName || r.salesmanEmail || 'Unknown',
            createdByName: r.createdByName || r.createdByEmail || 'System',
            targetPartyName: r.dealerName || r.institutionName || r.influencerName || null,
            noOfDealerVisits: r.noOfDealerVisits ?? 0,
            noOfInstitutionVisits: r.noOfInstitutionVisits ?? 0,
            noOfInfluencerVisits: r.noOfInfluencerVisits ?? 0,
        }));

        return NextResponse.json({
            data: formatted,
            totalCount,
            page,
            pageSize
        }, { status: 200 });

    } catch (error) {
        console.error('Error fetching permanent journey plans:', error);
        return NextResponse.json({ error: 'Failed to fetch', details: (error as Error).message }, { status: 500 });
    }
});

export const DELETE = withTenantDb(async (request, db, session) => {
    try {
        if (!hasPermission(session.permissions, "DELETE")) {
            return NextResponse.json({ error: 'Forbidden: DELETE access required' }, { status: 403 });
        }

        const url = new URL(request.url);
        const pjpId = url.searchParams.get('id');

        if (!pjpId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const pjpToDeleteResult = await db
            .select({ id: permanentJourneyPlans.id })
            .from(permanentJourneyPlans)
            .where(eq(permanentJourneyPlans.id, pjpId))
            .limit(1);

        if (!pjpToDeleteResult[0]) {
            return NextResponse.json({ error: 'PJP Not Found' }, { status: 404 });
        }

        await db.delete(permanentJourneyPlans).where(eq(permanentJourneyPlans.id, pjpId));

        return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting PJP:', error);
        return NextResponse.json({ error: 'Failed to delete', details: (error as Error).message }, { status: 500 });
    }
});