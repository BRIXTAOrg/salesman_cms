// src/app/home/customReportGenerator/customTableHeaders.ts

import {
    LucideIcon, User, ClipboardCheck, BandageIcon, CalendarCheck, 
    MapPin, Building2, ListChecks, Store, Users2, Receipt
} from 'lucide-react';

export interface TableColumn {
    table: string;
    column: string;
}

export interface TableMeta {
    id: string;
    title: string;
    icon: LucideIcon;
    columns: string[];
    requiredPerm?: string | string[]; // Permissions check
    requiredJobRole?: string[];       // Job Role check
}

export const tablesMetadata: TableMeta[] = [
    {
        id: 'users',
        title: 'Users',
        icon: User,
        columns: [
            'id', 'username', 'email', 'phoneNumber', 'orgRole', 'jobRoles', 
            'zone', 'area', 'reportsToManagerName', 'status', 
            'isDashboardUser', 'isSalesAppUser', 'createdAt'
        ],
        requiredPerm: ['Admin'],
        requiredJobRole: ['Admin']
    },
    {
        id: 'dealers',
        title: 'Dealers',
        icon: Building2,
        columns: [
            'id', 'dealerPartyName', 'contactPersonName', 'contactPersonNumber', 
            'email', 'gstNo', 'panNo', 'zone', 'district', 'area', 'state', 'pinCode', 
            'createdAt', 'updatedAt'
        ],
    },
    {
        id: 'institutions',
        title: 'Institutions',
        icon: Building2, 
        columns: [
            'id', 'institutionName', 'contactPersonName', 'contactPersonNumber', 
            'email', 'gstNo', 'panNo', 'zone', 'district', 'area', 'state', 
            'pinCode', 'address', 'latitude', 'longitude', 'isVerified', 
            'createdAt', 'updatedAt'
        ]
    },
    {
        id: 'influencers',
        title: 'Influencers',
        icon: Users2, 
        columns: [
            'id', 'contactPersonName', 'contactPersonNumber', 'email', 
            'zone', 'district', 'area', 'state', 'pinCode', 'address', 
            'latitude', 'longitude', 'isVerified', 'createdAt', 'updatedAt'
        ]
    },
    {
        id: 'dailyVisitReports',
        title: 'Daily Visit Reports',
        icon: CalendarCheck,
        columns: [
            'id', 'reportDate', 'salesmanName', 'salesmanEmail', 'zone', 'area', 
            'customerType', 'dealerType', 'institutionType', 'influencerType', 'visitType', 
            'dealerName', 'nameOfParty', 'contactNoOfParty', 
            'expectedActivationDate', 'location', 'latitude', 'longitude', 'brandSelling', 
            'todayOrderQty', 'todayCollectionRupees', 'currentDealerOutstandingAmt', 
            'overdueAmount', 'feedbacks', 'checkInDate', 'checkInTime', 'checkOutDate', 
            'checkOutTime', 'timeSpentinLoc', 'inTimeImageUrl', 'outTimeImageUrl'
        ],
    },
    {
        id: 'soPerformanceMetrics',
        title: 'SO Metrics (Current Month|1st -> today)',
        icon: Store,
        requiredJobRole: ['Sales-Marketing', 'Reports-MIS'], 
        columns: [
            'userId', 'salesmanName', 'zone', 'area',
            'totalVisits', 'dealerVisits', 'institutionVisits', 'influencerVisits'
        ]
    },
    {
        id: 'permanentJourneyPlans',
        title: 'Permanent Journey Plans',
        icon: ListChecks,
        columns: [
            'id', 'planDate', 'assignedSalesmanName', 'assignedSalesmanEmail', 
            'creatorName', 'creatorEmail', 'areaToBeVisited', 
            'visitDealerName', 'visitInstitutionName', 'visitInfluencerName',
            'route', 'description', 'status', 'verificationStatus', 
            'additionalVisitRemarks', 'diversionReason', 'createdAt', 'updatedAt'
        ]
    },
    {
        id: 'salesmanAttendance',
        title: 'Salesman Attendance',
        icon: ClipboardCheck,
        columns: [
            'id', 'salesmanName', 'salesmanEmail', 'attendanceDate', 'locationName',
            'inTimeDate', 'outTimeDate', 'inTimeTime', 'outTimeTime', 
            'inTimeLatitude', 'inTimeLongitude', 'outTimeLatitude', 'outTimeLongitude',
            'inTimeImageCaptured', 'outTimeImageCaptured'
        ],
    },
    {
        id: 'salesmanLeaveApplications',
        title: 'Leave Applications',
        icon: BandageIcon,
        columns: [
            'id', 'createdAt', 'salesmanName', 'approverName', 'leaveType',
            'startDate', 'endDate', 'reason', 'status', 'adminRemarks', 'updatedAt'
        ],
    },
    {
        id: 'tadaBills', 
        title: 'TA/DA', 
        icon: Receipt,
        columns: [
            'itemId', 'billId', 'salesmanName', 'salesmanEmail', 'zone', 'area', 
            'billDate', 'status', 'fromLocation', 'toLocation', 'distanceTravelled', 'billTotalCost', 'billRemarks', 
            'transportFare', 'lodgingFare', 'foodingFare', 'localConveyance', 'outOfPocketPaid', 'totalBillsAdded', 'itemRemarks', 'createdAt', 'updatedAt'
        ],
    },
    // {
    //     id: 'geoTracking',
    //     title: 'Salesman GeoTracking',
    //     icon: MapPin,
    //     columns: [
    //         'id', 'journeyId', 'salesmanName', 'salesmanEmail',
    //         'latitude', 'longitude', 'recordedAt', 'accuracy', 'speed', 'heading', 
    //         'altitude', 'locationType', 'activityType', 'appState', 'batteryLevel', 
    //         'isCharging', 'networkStatus', 'ipAddress', 'siteName', 'checkInTime', 
    //         'checkOutTime', 'totalDistanceTravelled', 'isActive', 'destLat', 'destLng'
    //     ],
    // },
];

export type ReportFormat = 'csv' | 'xlsx';