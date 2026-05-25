// src/app/dashboard/permanentJourneyPlan/pjpList.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Eye, MapPin, User, Calendar as CalendarIcon, ClipboardList, Loader2, Route, Store, Building2, Users
} from 'lucide-react';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Reusable Components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search'; 

const pjpSchema = z.object({
  id: z.string(),
  planDate: z.string().or(z.date()),
  areaToBeVisited: z.string(),
  route: z.string().nullable().optional(),
  additionalVisitRemarks: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.string(),
  verificationStatus: z.string(),
  salesmanName: z.string(),
  createdByName: z.string(),
  targetPartyName: z.string().nullable().optional(),
  
  noOfDealerVisits: z.coerce.number().catch(0),
  noOfInstitutionVisits: z.coerce.number().catch(0),
  noOfInfluencerVisits: z.coerce.number().catch(0),
});

type PjpType = z.infer<typeof pjpSchema>;

const API_ENDPOINT = `/api/dashboardPagesAPI/permanent-journey-plan`;

export default function PjpList() {
  const [data, setData] = useState<PjpType[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(100);

  // Search/Filters State
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [salesmanId, setSalesmanId] = useState('all');
  const [area, setArea] = useState('all');
  const [status, setStatus] = useState('all');
  const [verificationStatus, setVerificationStatus] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Filters options from server
  const [salesmanOptions, setSalesmanOptions] = useState<{ label: string, value: string }[]>([]);
  const [areaOptions, setAreaOptions] = useState<{ label: string, value: string }[]>([]);

  // Detailed view dialog state
  const [selectedPjp, setSelectedPjp] = useState<PjpType | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, salesmanId, area, status, verificationStatus, dateRange]);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`${API_ENDPOINT}?action=fetch_filters`);
      const json = await res.json();
      if (res.ok) {
        setSalesmanOptions([{ label: 'All Salesmen', value: 'all' }, ...json.salesmen]);
        setAreaOptions([{ label: 'All Areas', value: 'all' }, ...json.areas]);
      }
    } catch (err) {
      console.error('Error fetching filters options', err);
    }
  }, []);

  const fetchPjps = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(API_ENDPOINT, window.location.origin);
      url.searchParams.append('page', String(page));
      url.searchParams.append('pageSize', String(pageSize));

      if (debouncedSearch) url.searchParams.append('search', debouncedSearch);
      if (salesmanId !== 'all') url.searchParams.append('salesmanId', salesmanId);
      if (area !== 'all') url.searchParams.append('area', area);
      if (status !== 'all') url.searchParams.append('status', status);
      if (verificationStatus !== 'all') url.searchParams.append('verificationStatus', verificationStatus);

      if (dateRange?.from) url.searchParams.append('startDate', format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) url.searchParams.append('endDate', format(dateRange.to, "yyyy-MM-dd"));

      const res = await fetch(url.toString());
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Failed to fetch data');

      const parsedData = z.array(pjpSchema).parse(json.data);
      setData(parsedData);
      setTotalCount(json.totalCount || 0);
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, salesmanId, area, status, verificationStatus, dateRange]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchPjps();
  }, [fetchPjps]);

  const columns = useMemo<ColumnDef<PjpType>[]>(() => [
    {
      accessorKey: 'planDate',
      header: 'Plan Date',
      cell: ({ row }) => <span className="font-medium text-sm">{String(row.original.planDate)}</span>
    },
    {
      accessorKey: 'salesmanName',
      header: 'Salesman',
    },
    {
      accessorKey: 'areaToBeVisited',
      header: 'Area / Route To Be Visited',
      cell: ({ row }) => (
        <div className="flex flex-col space-y-0.5">
          <span className="font-semibold text-sm text-slate-800">{row.original.areaToBeVisited}</span>
          {row.original.route && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Route className="w-3 h-3" /> {row.original.route}
            </span>
          )}
        </div>
      )
    },
    {
      id: 'targetsCount',
      header: 'Planned Targets',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">Dlr: {row.original.noOfDealerVisits}</Badge>
          <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">Inst: {row.original.noOfInstitutionVisits}</Badge>
          <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200">Inf: {row.original.noOfInfluencerVisits}</Badge>
        </div>
      )
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const val = row.original.status.toUpperCase();
        if (val === 'COMPLETED') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none">Completed</Badge>;
        if (val === 'UNPLANNED') return <Badge variant="destructive" className="shadow-none">Unplanned</Badge>;
        return <Badge variant="secondary" className="shadow-none">{row.original.status}</Badge>;
      }
    },
    {
      accessorKey: 'verificationStatus',
      header: 'Admin Verification',
      cell: ({ row }) => {
        const val = row.original.verificationStatus.toUpperCase();
        if (val === 'APPROVED' || val === 'VERIFIED') return <Badge className="bg-green-100 text-green-800 border-green-200 shadow-none">Approved</Badge>;
        if (val === 'REJECTED' || val === 'FAILED') return <Badge variant="destructive" className="shadow-none">Rejected</Badge>;
        return <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-200 shadow-none">Pending</Badge>;
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 shadow-none"
          onClick={() => {
            setSelectedPjp(row.original);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="w-3.5 h-3.5 mr-1" /> View Details
        </Button>
      )
    }
  ], []);

  const statusOptions = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Unplanned', value: 'Unplanned' },
  ];

  const verifyOptions = [
    { label: 'All Verifications', value: 'all' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ];

  return (
    <div className="space-y-6 w-full max-w-[100vw] overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Permanent Journey Plans (PJP)</h1>
          <Badge variant="outline" className="text-sm px-3 py-0.5 rounded-full">
            Total Logs: {totalCount}
          </Badge>
        </div>
        <RefreshDataButton cachePrefix="pjp-global" onRefresh={fetchPjps} />
      </div>

      <GlobalFilterBar
        showSearch={true}
        showRole={true} 
        showZone={true} 
        showStatus={true} 
        showDateRange={true}
        showArea={true} 

        searchVal={search}
        roleVal={salesmanId}
        zoneVals={area === 'all' ? [] : [area]}
        statusVal={status}
        dateRangeVal={dateRange}
        areaVals={verificationStatus === 'all' ? [] : [verificationStatus]}

        roleOptions={salesmanOptions}
        zoneOptions={areaOptions}
        statusOptions={statusOptions}
        areaOptions={verifyOptions} 

        onSearchChange={setSearch}
        onRoleChange={setSalesmanId}
        onZoneChange={(vals) => setArea(vals[0] || 'all')}
        onStatusChange={setStatus}
        onDateRangeChange={setDateRange}
        onAreaChange={(vals) => setVerificationStatus(vals[0] || 'all')}
      />

      <div className="bg-card rounded-lg border shadow-sm p-1">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <DataTableReusable columns={columns} data={data} enableRowDragging={false} />
        )}
      </div>

      {/* View PJP Log Metrics Details Dialog Modal */}
      {selectedPjp && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col space-y-2 border-b pb-4">
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>Journey Plan Allocation</span>
                <Badge variant={selectedPjp.status.toUpperCase() === 'COMPLETED' ? 'default' : 'secondary'}>
                  {selectedPjp.status}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground flex items-center gap-4">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {selectedPjp.salesmanName}</span>
                <span className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5" /> {String(selectedPjp.planDate)}</span>
              </DialogDescription>
            </div>

            <div className="space-y-5 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Planned Area</Label>
                  <p className="text-sm font-medium bg-muted p-2.5 rounded-md flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    {selectedPjp.areaToBeVisited}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Target Route Info</Label>
                  <p className="text-sm font-medium bg-muted p-2.5 rounded-md flex items-center gap-1.5">
                    <Route className="w-4 h-4 text-slate-500" />
                    {selectedPjp.route || 'No Specific Route Configured'}
                  </p>
                </div>
              </div>

              {/* Visit Target Matrix Dashboard Section */}
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground font-bold">Allocated Visit Metrics</Label>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="border border-amber-100 bg-amber-50/40 shadow-none">
                    <CardContent className="p-3 flex flex-col items-center justify-center">
                      <Store className="w-5 h-5 text-amber-600 mb-1" />
                      <span className="text-2xl font-bold text-amber-900">{selectedPjp.noOfDealerVisits}</span>
                      <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wider mt-0.5">Dealers</span>
                    </CardContent>
                  </Card>
                  
                  <Card className="border border-blue-100 bg-blue-50/40 shadow-none">
                    <CardContent className="p-3 flex flex-col items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600 mb-1" />
                      <span className="text-2xl font-bold text-blue-900">{selectedPjp.noOfInstitutionVisits}</span>
                      <span className="text-[10px] text-blue-700 uppercase font-bold tracking-wider mt-0.5">Institutions</span>
                    </CardContent>
                  </Card>

                  <Card className="border border-purple-100 bg-purple-50/40 shadow-none">
                    <CardContent className="p-3 flex flex-col items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600 mb-1" />
                      <span className="text-2xl font-bold text-purple-900">{selectedPjp.noOfInfluencerVisits}</span>
                      <span className="text-[10px] text-purple-700 uppercase font-bold tracking-wider mt-0.5">Influencers</span>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {selectedPjp.description && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground font-bold">Plan Description / Objectives</Label>
                  <div className="p-3 bg-muted rounded-md text-sm text-slate-700 font-medium">
                    {selectedPjp.description}
                  </div>
                </div>
              )}

              {selectedPjp.additionalVisitRemarks && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase font-bold text-emerald-700">Verification Remarks (Admin)</Label>
                  <div className="p-3 bg-emerald-50 rounded-md text-sm border border-emerald-100 text-emerald-900 font-medium">
                    {selectedPjp.additionalVisitRemarks}
                  </div>
                </div>
              )}

              <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between border">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Created By</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedPjp.createdByName}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Verification Status</p>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 font-bold uppercase tracking-wide">
                    {selectedPjp.verificationStatus}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 bg-muted/20 border-t mt-4">
              <Button onClick={() => setIsViewModalOpen(false)}>Close View</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}