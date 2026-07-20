// src/lib/reports-transformer.ts
import { db } from '@/lib/drizzle';
import {
  users, roles, userRoles, dealers, influencers, institutions, dailyVisitReports,
  permanentJourneyPlans, salesmanAttendance, salesmanLeaveApplications, journeyOps,
  tadaBillItems, tadaBills
} from '../../drizzle/schema';
import { eq, desc, and, getTableColumns, aliasedTable, sql, SQL, lte, gte } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

// --- HELPERS ---

export const formatUserName = (user: { username?: string | null, email?: string | null } | null): string => {
  if (!user) return '';
  const name = user.username?.trim();
  return name || user.email || '';
};

export const formatDateIST = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  return d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/ /g, '-');
};

export const formatDateTimeIST = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).replace(/,/g, '').toUpperCase();
};

export const formatJustDate = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  return d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/\//g, '-');
};

export const formatJustTime = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).toUpperCase();
};

const toNum = (v: any): number | null => (v == null ? null : Number(v));

// --- TRANSFORMERS ---

type RawUserRow = InferSelectModel<typeof users> & {
  managerUsername: string | null;
  managerEmail: string | null;
  orgRole: string | null;
  jobRole: string | null;
};

export async function getFlattenedUsers() {
  const reportsToUsers = aliasedTable(users, 'reportsTo');

  const rawUsers = (await db
    .select({
      ...getTableColumns(users),
      managerUsername: reportsToUsers.username,
      managerEmail: reportsToUsers.email,
      orgRole: roles.orgRole,
      jobRole: roles.jobRole,
    })
    .from(users)
    .leftJoin(reportsToUsers, eq(users.reportsToId, reportsToUsers.id))
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .orderBy(desc(users.createdAt))) as RawUserRow[];

  const usersMap = new Map<number, any>();

  for (const row of rawUsers) {
    if (!usersMap.has(row.id)) {
      usersMap.set(row.id, {
        ...row,
        orgRole: row.orgRole || 'Unassigned',
        jobRoles: new Set<string>(),
      });
    }

    const u = usersMap.get(row.id);
    if (row.jobRole) { u.jobRoles.add(row.jobRole); }
    if (row.orgRole && u.orgRole === 'Unassigned') { u.orgRole = row.orgRole; }
  }

  return Array.from(usersMap.values()).map((u) => {
    return {
      id: u.id,
      email: u.email,
      username: u.username || '',
      orgRole: u.orgRole,
      jobRoles: Array.from(u.jobRoles).join(', '),
      phoneNumber: u.phoneNumber ?? null,
      status: u.status,
      zone: u.zone ?? null,
      area: u.area ?? null,
      reportsToManagerName: formatUserName({
        username: u.managerUsername,
        email: u.managerEmail
      }) || null,
      isDashboardUser: u.isDashboardUser ? 'Yes' : 'No',
      isSalesAppUser: u.isSalesAppUser ? 'Yes' : 'No',
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
    };
  });
}

export async function getFlattenedDealers() {
  const rawDealers = await db
    .select()
    .from(dealers)
    .orderBy(desc(dealers.createdAt));

  return rawDealers.map((d) => ({
    id: d.id,
    dealerPartyName: d.dealerPartyName,
    contactPersonName: d.contactPersonName ?? null,
    contactPersonNumber: d.contactPersonNumber ?? null,
    email: d.email ?? null,
    gstNo: d.gstNo ?? null,
    panNo: d.panNo ?? null,
    zone: d.zone ?? null,
    district: d.district ?? null,
    area: d.area ?? null,
    state: d.state ?? null,
    pinCode: d.pinCode ?? null,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : '',
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : '',
  }));
}

export async function getFlattenedInstitutions() {
  const raw = await db
    .select()
    .from(institutions)
    .orderBy(desc(institutions.createdAt));

  return raw.map((r) => {
    return {
      id: r.id,
      institutionName: r.institutionName,
      contactPersonName: r.contactPersonName ?? '',
      contactPersonNumber: r.contactPersonNumber ?? '',
      email: r.email ?? '',
      gstNo: r.gstNo ?? '',
      panNo: r.panNo ?? '',
      
      zone: r.zone ?? '',
      district: r.district ?? '',
      area: r.area ?? '',
      state: r.state ?? '',
      pinCode: r.pinCode ?? '',
      address: r.address ?? '',
      
      latitude: toNum(r.latitude) || 0,
      longitude: toNum(r.longitude) || 0,
      
      isVerified: r.isVerified ? 'Yes' : 'No',
      createdAt: formatDateTimeIST(r.createdAt),
      updatedAt: formatDateTimeIST(r.updatedAt),
    };
  });
}

export async function getFlattenedInfluencers() {
  const raw = await db
    .select()
    .from(influencers)
    .orderBy(desc(influencers.createdAt));

  return raw.map((r) => {
    return {
      id: r.id,
      contactPersonName: r.contactPersonName ?? '',
      contactPersonNumber: r.contactPersonNumber ?? '',
      email: r.email ?? '',
      
      zone: r.zone ?? '',
      district: r.district ?? '',
      area: r.area ?? '',
      state: r.state ?? '',
      pinCode: r.pinCode ?? '',
      address: r.address ?? '',
      
      latitude: toNum(r.latitude) || 0,
      longitude: toNum(r.longitude) || 0,
      
      isVerified: r.isVerified ? 'Yes' : 'No',
      createdAt: formatDateTimeIST(r.createdAt),
      updatedAt: formatDateTimeIST(r.updatedAt),
    };
  });
}

export async function getFlattenedDailyVisitReports() {
  const raw = await db
    .select({
      ...getTableColumns(dailyVisitReports),
      userUsername: users.username,
      userEmail: users.email,
      userArea: users.area,
      userZone: users.zone,
      dealerName: dealers.dealerPartyName,
    })
    .from(dailyVisitReports)
    .leftJoin(users, eq(dailyVisitReports.userId, users.id))
    .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
    .orderBy(desc(dailyVisitReports.reportDate));

  return raw.map((r) => {
    return {
      id: r.id,
      reportDate: r.reportDate ? formatDateIST(r.reportDate) : '',
      
      customerType: r.customerType ?? null,
      dealerType: r.dealerType ?? null,
      institutionType: r.institutionType ?? null,
      influencerType: r.influencerType ?? null, 
      visitType: r.visitType ?? null,

      nameOfParty: r.nameOfParty ?? null,
      contactNoOfParty: r.contactNoOfParty ?? null,
      expectedActivationDate: r.expectedActivationDate ? formatDateIST(r.expectedActivationDate) : null,
      dealerName: r.dealerName ?? null,

      location: r.location ?? null,
      area: r.userArea ?? '',
      zone: r.userZone ?? '',
      latitude: toNum(r.latitude) || 0,
      longitude: toNum(r.longitude) || 0,

      brandSelling: (r.brandSelling || []).join(', '),

      todayOrderQty: toNum(r.todayOrderQty) || 0,
      todayCollectionRupees: toNum(r.todayCollectionRupees) || 0,
      overdueAmount: toNum(r.overdueAmount),
      currentDealerOutstandingAmt: toNum(r.currentDealerOutstandingAmt),
      feedbacks: r.feedbacks ?? null,

      checkInDate: formatJustDate(r.checkInTime),
      checkInTime: formatJustTime(r.checkInTime),
      checkOutDate: formatJustDate(r.checkOutTime),
      checkOutTime: formatJustTime(r.checkOutTime),
      timeSpentinLoc: r.timeSpentinLoc ?? null,
      inTimeImageUrl: r.inTimeImageUrl ?? null,
      outTimeImageUrl: r.outTimeImageUrl ?? null,

      createdAt: formatDateTimeIST(r.createdAt),
      updatedAt: formatDateTimeIST(r.updatedAt),
      salesmanName: formatUserName({ username: r.userUsername, email: r.userEmail }),
      salesmanEmail: r.userEmail || '',
    }
  });
}

export async function getFlattenedSoPerformanceMetrics(
  startDate?: Date,
  endDate?: Date
) {
  let startStr: string;
  let endStr: string;

  if (!startDate || !endDate) {
    const now = new Date();
    startStr = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    endStr = now.toLocaleDateString('en-CA');
  } else {
    startStr = startDate.toLocaleDateString('en-CA');
    endStr = endDate.toLocaleDateString('en-CA');
  }

  const endOfDay = new Date(endStr);
  endOfDay.setHours(23, 59, 59, 999);

  const filters: (SQL | undefined)[] = [
    and(
      sql`${dailyVisitReports.reportDate} >= ${startStr}`,
      sql`${dailyVisitReports.reportDate} <= ${endOfDay.toISOString()}`
    )
  ];

  const rawData = await db
    .select({
      userId: users.id,
      salesmanName: sql<string>`COALESCE(NULLIF(TRIM(${users.username}), ''), ${users.email})`,
      zone: users.zone,
      area: users.area,
      totalVisits: sql<number>`CAST(COUNT(${dailyVisitReports.id}) AS INTEGER)`,
      dealerVisits: sql<number>`CAST(SUM(CASE WHEN ${dailyVisitReports.customerType} ILIKE 'Dealer%' THEN 1 ELSE 0 END) AS INTEGER)`,
      institutionVisits: sql<number>`CAST(SUM(CASE WHEN ${dailyVisitReports.customerType} ILIKE 'Institution%' THEN 1 ELSE 0 END) AS INTEGER)`,
      influencerVisits: sql<number>`CAST(SUM(CASE WHEN ${dailyVisitReports.customerType} ILIKE 'Influencer%' THEN 1 ELSE 0 END) AS INTEGER)`,
    })
    .from(dailyVisitReports)
    .leftJoin(users, eq(dailyVisitReports.userId, users.id))
    .where(and(...filters.filter(Boolean)))
    .groupBy(users.id, users.username, users.email, users.zone, users.area)
    .orderBy(desc(sql`COUNT(${dailyVisitReports.id})`));

  return rawData.map((r) => {
    return {
      userId: r.userId ?? null,
      salesmanName: r.salesmanName || 'Unknown',
      zone: r.zone || '',
      area: r.area || '',
      totalVisits: r.totalVisits || 0,
      dealerVisits: r.dealerVisits || 0,
      institutionVisits: r.institutionVisits || 0,
      influencerVisits: r.influencerVisits || 0,
    };
  });
}

export async function getFlattenedPermanentJourneyPlans() {
  const createdByUsers = aliasedTable(users, 'createdBy');

  const rawReports = await db
    .select({
      ...getTableColumns(permanentJourneyPlans),
      salesmanUsername: users.username,
      salesmanEmail: users.email,
      creatorUsername: createdByUsers.username,
      creatorEmail: createdByUsers.email,
      dealerName: dealers.dealerPartyName,
      institutionName: institutions.institutionName, 
      influencerName: influencers.contactPersonName, 
    })
    .from(permanentJourneyPlans)
    .leftJoin(users, eq(permanentJourneyPlans.userId, users.id))
    .leftJoin(createdByUsers, eq(permanentJourneyPlans.createdById, createdByUsers.id))
    .leftJoin(dealers, eq(permanentJourneyPlans.dealerId, dealers.id))
    .leftJoin(institutions, eq(permanentJourneyPlans.institutionId, institutions.id)) // NEW
    .leftJoin(influencers, eq(permanentJourneyPlans.influencerId, influencers.id)) // NEW
    .orderBy(desc(permanentJourneyPlans.planDate));

  if (rawReports.length === 0) return [];

  return rawReports.map((r) => {
    return {
      id: r.id,
      areaToBeVisited: r.areaToBeVisited,
      route: r.route ?? null,
      description: r.description ?? null,
      status: r.status,
      verificationStatus: r.verificationStatus || 'PENDING',
      additionalVisitRemarks: r.additionalVisitRemarks ?? null,
      diversionReason: r.diversionReason ?? null,

      planDate: formatDateIST(r.planDate) || '',
      createdAt: formatDateTimeIST(r.createdAt),
      updatedAt: formatDateTimeIST(r.updatedAt),

      userId: String(r.userId),
      dealerId: r.dealerId,
      institutionId: r.institutionId,
      influencerId: r.influencerId,
      
      visitDealerName: r.dealerName ?? null,
      visitInstitutionName: r.institutionName ?? null,
      visitInfluencerName: r.influencerName ?? null,

      assignedSalesmanName: formatUserName({ username: r.salesmanUsername, email: r.salesmanEmail }),
      assignedSalesmanEmail: r.salesmanEmail || '',
      creatorName: formatUserName({ username: r.creatorUsername, email: r.creatorEmail }),
      creatorEmail: r.creatorEmail || '',
    };
  });
}

export async function getFlattenedSalesmanAttendance() {
  const rawReports = await db
    .select({
      ...getTableColumns(salesmanAttendance),
      userUsername: users.username,
      userEmail: users.email,
    })
    .from(salesmanAttendance)
    .leftJoin(users, eq(salesmanAttendance.userId, users.id))
    .orderBy(desc(salesmanAttendance.attendanceDate));

  return rawReports.map((r) => ({
    id: r.id,
    locationName: r.locationName,
    inTimeImageCaptured: r.inTimeImageCaptured,
    outTimeImageCaptured: r.outTimeImageCaptured,
    inTimeImageUrl: r.inTimeImageUrl ?? null,
    outTimeImageUrl: r.outTimeImageUrl ?? null,

    attendanceDate: formatDateIST(r.attendanceDate) || '',
    inTimeDate: formatJustDate(r.inTimeTimestamp) || '-',
    outTimeDate: r.outTimeTimestamp ? formatJustDate(r.outTimeTimestamp) : null,
    inTimeTime: formatJustTime(r.inTimeTimestamp) || '-',
    outTimeTime: r.outTimeTimestamp ? formatJustTime(r.outTimeTimestamp) : null,
    createdAt: formatDateTimeIST(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),

    inTimeLatitude: toNum(r.inTimeLatitude) || 0,
    inTimeLongitude: toNum(r.inTimeLongitude) || 0,
    outTimeLatitude: toNum(r.outTimeLatitude),
    outTimeLongitude: toNum(r.outTimeLongitude),

    salesmanName: formatUserName({ username: r.userUsername, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
  }));
}

export const formatToShortTextDate = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};

export async function getFlattenedSalesmanLeaveApplication(
  startDate?: Date,
  endDate?: Date
) {
  const approvers = aliasedTable(users, 'approvers');
  const filters: SQL[] = [];

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    filters.push(
      and(
        lte(salesmanLeaveApplications.startDate, end.toISOString()),
        gte(salesmanLeaveApplications.endDate, start.toISOString())
      )!
    );
  }

  const rawReports = await db
    .select({
      ...getTableColumns(salesmanLeaveApplications),
      userUsername: users.username,
      userEmail: users.email,
      approverUsername: approvers.username,
      approverEmail: approvers.email,
    })
    .from(salesmanLeaveApplications)
    .leftJoin(users, eq(salesmanLeaveApplications.userId, users.id))
    .leftJoin(approvers, eq(users.reportsToId, approvers.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(salesmanLeaveApplications.startDate));

  return rawReports.map((r) => ({
    id: r.id,
    leaveType: r.leaveType,
    reason: r.reason,
    status: r.status,
    adminRemarks: r.adminRemarks ?? null,
    startDate: formatJustDate(r.startDate) || '',
    endDate: formatJustDate(r.endDate) || '',
    createdAt: formatToShortTextDate(r.createdAt),
    updatedAt: formatDateTimeIST(r.updatedAt),
    salesmanName: formatUserName({ username: r.userUsername, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
    approverName: formatUserName({ username: r.approverUsername, email: r.approverEmail }) || 'Not Assigned',
  }));
}

export async function getFlattenedGeoTracking() {
  const rawReports = await db
    .select({
      opId: journeyOps.opId,
      journeyId: journeyOps.journeyId,
      createdAt: journeyOps.createdAt,
      payload: journeyOps.payload,
      userUsername: users.username,
      userEmail: users.email,
    })
    .from(journeyOps)
    .leftJoin(users, eq(journeyOps.userId, users.id))
    .orderBy(desc(journeyOps.createdAt));

  return rawReports.map((op) => {
    const p = (op.payload && typeof op.payload === 'object') ? op.payload as any : {};

    return {
      id: op.opId,
      journeyId: op.journeyId,
      salesmanName: formatUserName({ username: op.userUsername, email: op.userEmail }),
      salesmanEmail: op.userEmail || '',

      latitude: Number(p.latitude) || 0,
      longitude: Number(p.longitude) || 0,
      recordedAt: p.endedAt || formatDateTimeIST(op.createdAt),
      accuracy: p.accuracy ? Number(p.accuracy) : null,
      speed: p.speed ? Number(p.speed) : null,
      heading: p.heading ? Number(p.heading) : null,
      altitude: p.altitude ? Number(p.altitude) : null,
      locationType: p.locationType || null,
      activityType: p.activityType || null,
      appState: p.appState || null,
      batteryLevel: p.batteryLevel ? Number(p.batteryLevel) : null,
      isCharging: Boolean(p.isCharging),
      networkStatus: p.networkStatus || null,
      ipAddress: p.ipAddress || null,
      siteName: p.siteName || null,
      checkInTime: formatDateTimeIST(p.checkInTime),
      checkOutTime: p.checkOutTime ? formatDateTimeIST(p.checkOutTime) : null,
      totalDistanceTravelled: p.totalDistance !== undefined ? Number(p.totalDistance) : null,
      isActive: Boolean(p.isActive),
      destLat: p.destLat ? Number(p.destLat) : null,
      destLng: p.destLng ? Number(p.destLng) : null,
      createdAt: op.createdAt ? new Date(op.createdAt).toISOString() : '',
      updatedAt: op.createdAt ? new Date(op.createdAt).toISOString() : '',
    };
  });
}

export async function getFlattenedTadaBills() {
  const raw = await db
    .select({
      ...getTableColumns(tadaBillItems),
      billDate: tadaBills.billDate,
      fromDate: tadaBills.fromDate,
      toDate: tadaBills.toDate,
      billStatus: tadaBills.status,
      billTotalCost: tadaBills.totalCost,
      billRemarks: tadaBills.remarks,
      userUsername: users.username,
      userEmail: users.email,
      userZone: users.zone,
      userArea: users.area,
      billCreatedAt: tadaBills.createdAt,
      billUpdatedAt: tadaBills.updatedAt,
    })
    .from(tadaBillItems)
    .leftJoin(tadaBills, eq(tadaBillItems.billId, tadaBills.id))
    .leftJoin(users, eq(tadaBills.userId, users.id))
    .orderBy(desc(tadaBills.billDate));

  return raw.map((r) => ({
    itemId: r.id, 
    billId: r.billId,
    salesmanName: formatUserName({ username: r.userUsername, email: r.userEmail }),
    salesmanEmail: r.userEmail || '',
    zone: r.userZone ?? '',
    area: r.userArea ?? '',

    billSubmitDate: r.billDate ? formatJustDate(r.billDate) : '',
    tadaFromDate: r.fromDate ? formatJustDate(r.fromDate) : '',
    tadaToDate: r.toDate ? formatJustDate(r.toDate) : '',
    status: r.billStatus ?? 'PENDING',
    billTotalCost: toNum(r.billTotalCost) || 0,
    billRemarks: r.billRemarks ?? '',

    fromLocation: r.fromLocation ?? '',
    toLocation: r.toLocation ?? '',
    distanceTravelled: toNum(r.distanceTravelled) || 0,

    transportFare: toNum(r.transportFare) || 0,
    lodgingFare: toNum(r.lodgingFare) || 0,
    foodingFare: toNum(r.foodingFare) || 0,
    localConveyance: toNum(r.localConveyance) || 0,
    outOfPocketPaid: toNum(r.outOfPocketPaid) || 0,
    
    totalBillsAdded: r.totalBillsAdded ?? 0,
    itemRemarks: r.remarks ?? '',

    createdAt: formatDateTimeIST(r.billCreatedAt),
    updatedAt: formatDateTimeIST(r.billUpdatedAt),
  }));
}

export const transformerMap = {
  // Core Report Models
  users: getFlattenedUsers,
  dealers: getFlattenedDealers,
  institutions: getFlattenedInstitutions,
  influencers: getFlattenedInfluencers,
  dailyVisitReports: getFlattenedDailyVisitReports,
  soPerformanceMetrics: getFlattenedSoPerformanceMetrics,

  // Planning & Task Models
  permanentJourneyPlans: getFlattenedPermanentJourneyPlans,

  salesmanAttendance: getFlattenedSalesmanAttendance,
  salesmanLeaveApplications: getFlattenedSalesmanLeaveApplication,
  geoTracking: getFlattenedGeoTracking,

  tadaBills: getFlattenedTadaBills,
};