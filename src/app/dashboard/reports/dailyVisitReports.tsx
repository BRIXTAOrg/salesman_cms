// src/app/dashboard/reports/dailyVisitReports.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Loader2,
  Eye,
  MapPin,
  User,
  Calendar,
  Camera,
  LogIn,
  LogOut,
  Store,
  Building2,
  Users,
  Briefcase,
  ExternalLink
} from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { selectDailyVisitReportSchema } from '../../../../drizzle/zodSchemas';

const extendedDailyVisitReportSchema = selectDailyVisitReportSchema
  .omit({
    todayOrderQty: true,
    todayCollectionRupees: true,
    overdueAmount: true,
    latitude: true,
    longitude: true,
  })
  .extend({
    reportDate: z.string().nullable().optional(),
    checkInTime: z.string().nullable().optional(),
    checkOutTime: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    expectedActivationDate: z.string().nullable().optional(),

    salesmanName: z.string().optional().catch("Unknown"),
    area: z.string().optional().catch("N/A"),
    zone: z.string().optional().catch("N/A"),

    dealerName: z.string().nullable().optional(),
    nameOfParty: z.string().nullable().optional(),
    contactNoOfParty: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    
    customerType: z.string().nullable().optional(),
    dealerType: z.string().nullable().optional(),
    institutionType: z.string().nullable().optional(),
    influencerType: z.string().nullable().optional(),
    visitType: z.string().nullable().optional(),

    latitude: z.coerce.number().nullable().optional().catch(null),
    longitude: z.coerce.number().nullable().optional().catch(null),

    todayOrderQty: z.coerce.number().nullable().optional().catch(0),
    todayCollectionRupees: z.coerce.number().nullable().optional().catch(0),
    overdueAmount: z.coerce.number().nullable().optional().catch(0),

    brandSelling: z.array(z.string()).nullable().optional().transform(v => v || []),
    feedbacks: z.string().nullable().optional(),
    
    pjpStatus: z.string().nullable().optional(),
  });

type DailyVisitReport = z.infer<typeof extendedDailyVisitReportSchema>;

const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
  areas: string[];
  zones: string[];
}

const CUSTOMER_TYPE_OPTIONS = [
  'Dealer',
  'Institution',
  'Influencer'
];

const PJP_STATUS_OPTIONS = [
  'Completed',
  'Assigned',
  'Approved',
  'Verified',
  'Failed',
];

const formatTimeIST = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  } catch (e) {
    return 'N/A';
  }
};

const getCustomerTypeBadgeColor = (type: string | null | undefined) => {
  if (!type) return 'secondary';
  if (type === 'Dealer') return 'default'; // primary/dark
  if (type === 'Institution') return 'secondary'; // blue-ish depending on theme
  if (type === 'Influencer') return 'outline'; 
  return 'secondary';
};

const InfoField = ({
  label,
  value,
  icon: Icon,
  fullWidth = false,
}: {
  label: string;
  value: React.ReactNode;
  icon?: any;
  fullWidth?: boolean;
}) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </Label>
    <div className="text-sm font-medium p-2 bg-secondary/20 rounded-md border border-border/50 min-h-9 flex items-center">
      {value || <span className="italic text-xs text-muted-foreground">N/A</span>}
    </div>
  </div>
);

export default function DailyVisitReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<DailyVisitReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedReport, setSelectedReport] = useState<DailyVisitReport | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [pjpStatusFilter, setPjpStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, areaFilters, zoneFilters, customerTypeFilter, pjpStatusFilter, dateRange]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/dashboardPagesAPI/reports/daily-visit-reports`, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);

      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('zone', zoneFilters.join(','));

      if (customerTypeFilter !== 'all') url.searchParams.append('customerType', customerTypeFilter);
      if (pjpStatusFilter !== 'all') url.searchParams.append('pjpStatus', pjpStatusFilter);

      if (dateRange?.from) url.searchParams.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange?.to) {
        url.searchParams.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
      } else if (dateRange?.from) {
        url.searchParams.append('endDate', format(dateRange.from, 'yyyy-MM-dd'));
      }

      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const result = await response.json();
      if (!result.data) {
        throw new Error(result.error || "Failed to fetch reports from the server.");
      }

      setTotalCount(result.totalCount || 0);

      const validated = result.data.map((item: any) =>
        extendedDailyVisitReportSchema.parse(item)
      );
      setReports(validated);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearchQuery, areaFilters, zoneFilters, customerTypeFilter, pjpStatusFilter, dateRange]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    try {
      const url = new URL(LOCATION_API_ENDPOINT, window.location.origin);
      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data: LocationsResponse = await response.json();
        setAvailableAreas(data.areas || []);
        setAvailableZones(data.zones || []);
      }
    } finally { setIsLoadingLocations(false); }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const zoneOptions = useMemo(() => [...availableZones].sort().map(r => ({ label: r, value: r })), [availableZones]);
  const areaOptions = useMemo(() => [...availableAreas].sort().map(a => ({ label: a, value: a })), [availableAreas]);

  const customerTypeOptions = useMemo(() => [
    { label: 'All Types', value: 'all' },
    ...CUSTOMER_TYPE_OPTIONS.map(c => ({ label: c, value: c }))
  ], []);
  const pjpStatusOptions = useMemo(() => [
    { label: 'All Statuses', value: 'all' },
    ...PJP_STATUS_OPTIONS.map(s => ({ label: s, value: s }))
  ], []);

  const isDealerVisit = (r: DailyVisitReport) => r.customerType === 'Dealer';
  const isInstitutionVisit = (r: DailyVisitReport) => r.customerType === 'Institution';
  const isInfluencerVisit = (r: DailyVisitReport) => r.customerType === 'Influencer';

  const columns = useMemo<ColumnDef<DailyVisitReport>[]>(() => [
    {
      accessorKey: "customerType",
      header: "Customer Type",
      cell: ({ row }) => {
        const type = row.original.customerType;
        return <Badge variant={getCustomerTypeBadgeColor(type)} className="whitespace-nowrap">{type || 'Unknown'}</Badge>;
      }
    },
    {
      accessorKey: "salesmanName",
      header: "Salesman",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.original.salesmanName}</span>
        </div>
      ),
    },
    {
      accessorKey: "dealerName",
      header: "Party / Contact Name",
      cell: ({ row }) => (
        <div className="flex flex-col max-w-[180px]">
          <span className="font-semibold text-sm truncate" title={row.original.dealerName || row.original.nameOfParty || ''}>
            {row.original.dealerName || row.original.nameOfParty || '-'}
          </span>
          <span className="text-xs text-muted-foreground">{row.original.contactNoOfParty}</span>
        </div>
      ),
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => {
        const { zone, area, latitude, longitude } = row.original;

        const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
          if (!lat || !lng) return null;
          return `http://googleusercontent.com/maps.google.com/?q=${lat},${lng}`;
        };

        const mapLink = getGoogleMapsLink(latitude, longitude);

        return (
          <div className="flex flex-col min-w-[140px]">
            <span className="text-sm">{zone || '-'} / {area || '-'}</span>
            {mapLink ? (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="h-3 w-3" /> View Map
              </a>
            ) : (
              <span className="text-xs text-muted-foreground mt-1">No GPS</span>
            )}
          </div>
        );
      }
    },
    {
      id: "dateAndTime",
      header: "Date & Time",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.reportDate || '-'}</span>
        </div>
      )
    },
    {
      accessorKey: 'pjpStatus',
      header: 'PJP Status',
      cell: ({ row }) => {

        const status: any = row.original.pjpStatus || "-";
        const upperStatus = status.toUpperCase();

        if (upperStatus === 'UNPLANNED') {
          return <span className="text-muted-foreground text-xs">-</span>;
        }

        if (upperStatus === 'COMPLETED') {
          return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none tracking-wide">{status}</Badge>;
        }
        if (upperStatus === 'APPROVED' || upperStatus === 'VERIFIED') {
          return <Badge className="bg-green-100 text-green-800 border-green-200 shadow-none tracking-wide">{status}</Badge>;
        }
        if (upperStatus === 'ASSIGNED') {
          return <Badge className="bg-blue-100 text-blue-800 border-blue-200 shadow-none tracking-wide">{status}</Badge>;
        }

        return <Badge variant="secondary" className="shadow-none tracking-wide">{status}</Badge>;
      }
    },
    {
      id: "unplannedVisits",
      header: "Unplanned Visit",
      cell: ({ row }) => {
        const status = row.original.pjpStatus || "Unplanned";
        const isUnplanned = status.toUpperCase() === 'UNPLANNED';

        return isUnplanned ? (
          <Badge variant="destructive" className="shadow-none tracking-wide">Unplanned</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 px-2 shadow-sm"
          onClick={() => {
            setSelectedReport(row.original);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> View
        </Button>
      ),
    },
  ], []);

  const renderDealerDetails = (r: DailyVisitReport) => (
    <Card className="border-l-4 border-l-amber-600">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Store className="w-4 h-4" />
          Dealer Details & Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 pt-2">
        <InfoField label="Dealer Type" value={r.dealerType} />
        <InfoField label="Expected Activation" value={r.expectedActivationDate ? new Date(r.expectedActivationDate).toLocaleDateString() : 'N/A'} />
        <InfoField label="Brands Selling" value={r.brandSelling?.join(', ')} fullWidth />
        <Separator className="col-span-2 my-2" />
        <InfoField label="Today's Order Qty" value={r.todayOrderQty ? `${r.todayOrderQty}` : '0'} />
        <InfoField label="Today's Collection" value={`₹${r.todayCollectionRupees || 0}`} />
        <InfoField label="Overdue Amount" value={`₹${r.overdueAmount || 0}`} />
      </CardContent>
    </Card>
  );

  const renderInstitutionDetails = (r: DailyVisitReport) => (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Institution Information
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 pt-2">
        <InfoField label="Institution Type" value={r.institutionType} />
        <InfoField label="Brands Selling" value={r.brandSelling?.join(', ')} />
        <Separator className="col-span-2 my-2" />
        <InfoField label="Today's Order Qty" value={r.todayOrderQty ? `${r.todayOrderQty}` : '0'} />
        <InfoField label="Today's Collection" value={`₹${r.todayCollectionRupees || 0}`} />
      </CardContent>
    </Card>
  );

  const renderInfluencerDetails = (r: DailyVisitReport) => (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Users className="w-4 h-4" />
          Influencer / Professional Info
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 pt-2">
        <InfoField label="Influencer Type" value={r.influencerType} />
        <InfoField label="Brands Selling" value={r.brandSelling?.join(', ')} />
        <Separator className="col-span-2 my-2" />
        <InfoField label="Today's Order Qty" value={r.todayOrderQty ? `${r.todayOrderQty}` : '0'} />
        <InfoField label="Today's Collection" value={`₹${r.todayCollectionRupees || 0}`} />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Daily Visit Reports</h2>
            <Badge variant="outline" className="text-base px-4 py-1">
              Total Reports: {totalCount}
            </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="daily-visit-reports"
            onRefresh={fetchReports}
          />
        </div>

        <div className="w-full">
          <GlobalFilterBar
            showSearch={true}
            showRole={true} // Using Role slot for Customer Type!
            showZone={true}
            showArea={true}
            showDateRange={true}
            showStatus={true} 

            searchVal={searchQuery}
            roleVal={customerTypeFilter}
            zoneVals={zoneFilters}
            areaVals={areaFilters}
            statusVal={pjpStatusFilter}
            dateRangeVal={dateRange}

            roleOptions={customerTypeOptions}
            zoneOptions={zoneOptions}
            areaOptions={areaOptions}
            statusOptions={pjpStatusOptions}

            onSearchChange={setSearchQuery}
            onRoleChange={setCustomerTypeFilter}
            onZoneChange={setZoneFilters}
            onAreaChange={setAreaFilters}
            onStatusChange={setPjpStatusFilter}
            onDateRangeChange={setDateRange}
          />
        </div>

        <div className="bg-card p-1 rounded-lg border shadow-sm">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <DataTableReusable
              columns={columns}
              data={reports}
              enableRowDragging={false}
            />
          )}
        </div>
      </div>

      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">

            <div className={`px-6 py-4 border-b bg-muted/20 ${isDealerVisit(selectedReport) ? 'border-l-[6px] border-l-amber-600' : isInstitutionVisit(selectedReport) ? 'border-l-[6px] border-l-blue-500' : 'border-l-[6px] border-l-purple-500'}`}>
              <DialogTitle className="text-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span>Visit Details</span>
                  <Badge variant={selectedReport.pjpStatus?.toUpperCase() === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs uppercase">
                    {selectedReport.pjpStatus || 'UNPLANNED'}
                  </Badge>
                  <Badge variant={getCustomerTypeBadgeColor(selectedReport.customerType)} className="text-sm px-3 ml-2">
                    {selectedReport.customerType || 'Unknown'}
                  </Badge>
                </div>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {selectedReport.salesmanName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {selectedReport.reportDate}
                </span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location & Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    <InfoField label="Zone" value={selectedReport.zone} />
                    <InfoField label="Area" value={selectedReport.area} />
                    <InfoField label="Location Address" value={selectedReport.location} fullWidth />
                    <InfoField label="Party / Contact" value={selectedReport.dealerName || selectedReport.nameOfParty} fullWidth />
                    <InfoField label="Phone No." value={selectedReport.contactNoOfParty} fullWidth />
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Briefcase className="w-4 h-4" /> Visit Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    <InfoField label="Visit Type" value={selectedReport.visitType} fullWidth />
                    <InfoField label="Check In" value={formatTimeIST(selectedReport.checkInTime)} />
                    <InfoField label="Check Out" value={formatTimeIST(selectedReport.checkOutTime)} />
                  </CardContent>
                </Card>
              </div>

              {isDealerVisit(selectedReport) && renderDealerDetails(selectedReport)}
              {isInstitutionVisit(selectedReport) && renderInstitutionDetails(selectedReport)}
              {isInfluencerVisit(selectedReport) && renderInfluencerDetails(selectedReport)}

              <Card>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoField label="Visit Remarks / Feedback" value={selectedReport.feedbacks} fullWidth />
                </CardContent>
              </Card>

              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Photo Evidence
                </h4>

                <div className="flex flex-col gap-6">

                  {selectedReport.inTimeImageUrl ? (
                    <div className="border rounded-lg overflow-hidden shadow-sm bg-background">
                      <div className="bg-emerald-50 px-4 py-2 text-sm font-semibold border-b flex items-center gap-2 text-emerald-800">
                        <LogIn className="w-4 h-4" /> Check-In Selfie
                      </div>
                      <a href={selectedReport.inTimeImageUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img
                          src={selectedReport.inTimeImageUrl}
                          className="w-full h-auto max-h-[400px] object-contain bg-black/5"
                          alt="Check In"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <ExternalLink className="text-white w-5 h-5" />
                          <span className="text-white font-medium text-sm">View Full Image</span>
                        </div>
                      </a>
                    </div>
                  ) : (
                    <div className="border rounded-lg h-24 flex items-center justify-center bg-muted/10 text-muted-foreground text-sm italic border-dashed">
                      No Check-In Photo Available
                    </div>
                  )}

                  {selectedReport.outTimeImageUrl ? (
                    <div className="border rounded-lg overflow-hidden shadow-sm bg-background">
                      <div className="bg-orange-50 px-4 py-2 text-sm font-semibold border-b flex items-center gap-2 text-orange-800">
                        <LogOut className="w-4 h-4" /> Check-Out Selfie
                      </div>
                      <a href={selectedReport.outTimeImageUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img
                          src={selectedReport.outTimeImageUrl}
                          className="w-full h-auto max-h-[400px] object-contain bg-black/5"
                          alt="Check Out"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <ExternalLink className="text-white w-5 h-5" />
                          <span className="text-white font-medium text-sm">View Full Image</span>
                        </div>
                      </a>
                    </div>
                  ) : (
                    <div className="border rounded-lg h-24 flex items-center justify-center bg-muted/10 text-muted-foreground text-sm italic border-dashed">
                      No Check-Out Photo Available
                    </div>
                  )}

                </div>
              </div>

            </div>

            <DialogFooter className="p-4 bg-background border-t">
              <Button onClick={() => setIsViewModalOpen(false)}>
                Close Report
              </Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}