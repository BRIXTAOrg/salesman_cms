// src/app/dashboard/tadaBill/tadaList.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, Eye, MapPin, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';
import { useDealerLocations } from '@/components/reusable-dealer-locations';
import { DateRange } from 'react-day-picker';

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
});

const tadaFrontendSchema = z.object({
    id: z.string(),
    salesmanName: z.string(),
    area: z.string().nullable().optional(),
    zone: z.string().nullable().optional(),
    billDate: z.string(),
    fromDate: z.string(),
    toDate: z.string(),
    totalCost: z.coerce.number().nullable().optional(),
    status: z.string(),
    remarks: z.string().nullable().optional(),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
    items: z.array(tadaBillItemSchema),
});

type TadaRecord = z.infer<typeof tadaFrontendSchema>;

// --- INLINE IMAGE CAROUSEL ---
const ImageViewer = ({ urls }: { urls: string[] }) => {
    const [idx, setIdx] = useState(0);
    if (!urls || urls.length === 0) return null;
    return (
        <div className="space-y-2 mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Camera className="h-3 w-3" /> {urls.length} Receipt{urls.length > 1 ? 's' : ''} Attached
            </p>
            <div className="relative flex flex-col items-center bg-black/5 rounded-lg border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[idx]} alt={`Receipt ${idx + 1}`} className="w-full max-h-96 object-contain rounded-md" />
                {urls.length > 1 && (
                    <>
                        <Button variant="secondary" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button variant="secondary" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg" onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))} disabled={idx === urls.length - 1}>
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </>
                )}
            </div>
            {urls.length > 1 && <p className="text-center text-xs text-muted-foreground font-medium">Image {idx + 1} of {urls.length}</p>}
        </div>
    );
};

export default function TadaListPage() {
    const [bills, setBills] = useState<TadaRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedBill, setSelectedBill] = useState<TadaRecord | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const [page, setPage] = useState(0);
    const [pageSize] = useState(500);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [zoneFilters, setZoneFilters] = useState<string[]>([]);
    const [areaFilters, setAreaFilters] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [statusTab, setStatusTab] = useState('All');

    const { locations } = useDealerLocations();

    useEffect(() => { setPage(0); }, [debouncedSearchQuery, zoneFilters, areaFilters, dateRange]);

    const fetchBills = useCallback(async () => {
        setLoading(true);
        try {
            const url = new URL('/api/dashboardPagesAPI/tadaBill', window.location.origin);
            url.searchParams.append('page', page.toString());
            url.searchParams.append('pageSize', pageSize.toString());
            if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
            if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
            if (zoneFilters.length > 0) url.searchParams.append('zone', zoneFilters.join(','));
            if (dateRange?.from) url.searchParams.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
            if (dateRange?.to) url.searchParams.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));

            const response = await fetch(url.toString(), { cache: 'no-store' });
            const result = await response.json();

            let validatedData = z.array(tadaFrontendSchema).parse(result.data || []);
            if (statusTab !== 'All') {
                validatedData = validatedData.filter(b => b.status.toUpperCase() === statusTab.toUpperCase());
            }

            setBills(validatedData);
            setTotalCount(result.totalCount || 0);
        } catch (e: any) {
            toast.error('Failed to load TA/DA bills');
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, debouncedSearchQuery, zoneFilters, areaFilters, dateRange, statusTab]);

    useEffect(() => { fetchBills(); }, [fetchBills]);

    const billColumns: ColumnDef<TadaRecord>[] = [
        { accessorKey: 'salesmanName', header: 'Employee', cell: ({ row }) => (<div className="flex flex-col"><span className="font-semibold">{row.original.salesmanName}</span><span className="text-xs text-muted-foreground">{row.original.zone || '-'} / {row.original.area || '-'}</span></div>) },
        { accessorKey: 'billDate', header: 'Bill Submit Date', cell: info => new Date(info.getValue() as string).toLocaleDateString('en-GB') },
        { accessorKey: 'fromDate', header: 'TA/DA From Date', cell: info => new Date(info.getValue() as string).toLocaleDateString('en-GB') },
        { accessorKey: 'toDate', header: 'TA/DA To Date', cell: info => new Date(info.getValue() as string).toLocaleDateString('en-GB') },
        { accessorKey: 'totalCost', header: 'Total Claim (₹)', cell: info => <span className="font-bold text-lg">₹{(info.getValue() as number || 0).toFixed(2)}</span> },
        {
            accessorKey: 'status', header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status.toUpperCase();
                if (status === 'APPROVED') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Approved</Badge>;
                if (status === 'REJECTED') return <Badge variant="destructive">Rejected</Badge>;
                return <Badge variant="secondary">Pending</Badge>;
            }
        },
        {
            id: 'actions', header: 'Actions',
            cell: ({ row }) => (
                <Button variant="outline" size="sm" onClick={() => { setSelectedBill(row.original); setIsDetailsOpen(true); }}>
                    <Eye className="h-4 w-4 mr-2" /> View Details
                </Button>
            )
        }
    ];

    return (
        <div className="container mx-auto p-4 max-w-[100vw] overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">Manage TA/DA Bills</h1>
                <RefreshDataButton cachePrefix="tada-bills" onRefresh={fetchBills} />
            </div>

            <GlobalFilterBar
                showSearch={true} showZone={true} showArea={true} showDateRange={true}
                searchVal={searchQuery} zoneVals={zoneFilters} areaVals={areaFilters} dateRangeVal={dateRange}
                zoneOptions={(locations.zones || []).map(r => ({ label: r, value: r }))}
                areaOptions={(locations.areas || []).map(a => ({ label: a, value: a }))}
                onSearchChange={setSearchQuery} onZoneChange={setZoneFilters} onAreaChange={setAreaFilters} onDateRangeChange={setDateRange}
            />

            <div className="bg-card rounded-lg border shadow-sm p-1">
                <DataTableReusable columns={billColumns} data={bills} enableRowDragging={false} />
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                {/* ADDED: overflow-hidden to bound the modal */}
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                    {/* ADDED: shrink-0 to prevent the header from squishing */}
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="text-2xl">Bill Details</DialogTitle>
                        <DialogDescription>Submitted by <span className="font-semibold text-primary">{selectedBill?.salesmanName}</span></DialogDescription>
                    </DialogHeader>

                    {/* CHANGED: Replaced ScrollArea with a native scrolling div */}
                    <div className="flex-1 overflow-y-auto pr-4 mt-2 space-y-6 pb-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg">
                            <div><p className="text-xs text-muted-foreground uppercase">Total Claim</p><p className="font-bold text-xl text-primary">₹{(selectedBill?.totalCost || 0).toFixed(2)}</p></div>
                            <div><p className="text-xs text-muted-foreground uppercase">Status</p><p className="font-bold text-lg">{selectedBill?.status}</p></div>
                        </div>

                        <div className="space-y-4">
                            {selectedBill?.items?.map(item => (
                                <div key={item.id} className="border rounded-lg p-6 shadow-sm bg-card">
                                    <div className="flex justify-between border-b pb-4 mb-4">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-5 w-5 text-blue-500" />
                                            <h4 className="font-bold text-lg">{item.fromLocation || 'Origin'} → {item.toLocation || 'Destination'}</h4>
                                        </div>
                                        <p className="text-sm font-semibold bg-muted px-3 py-1 rounded-full">{item.distanceTravelled || 0} KM</p>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm mb-4">
                                        {item.transportFare! > 0 && <div><span className="text-muted-foreground block text-xs">Transport</span> <span className="font-bold">₹{item.transportFare}</span></div>}
                                        {item.lodgingFare! > 0 && <div><span className="text-muted-foreground block text-xs">Lodging</span> <span className="font-bold">₹{item.lodgingFare}</span></div>}
                                        {item.foodingFare! > 0 && <div><span className="text-muted-foreground block text-xs">Fooding</span> <span className="font-bold">₹{item.foodingFare}</span></div>}
                                        {item.localConveyance! > 0 && <div><span className="text-muted-foreground block text-xs">Local Conv.</span> <span className="font-bold">₹{item.localConveyance}</span></div>}
                                        {item.outOfPocketPaid! > 0 && <div><span className="text-muted-foreground block text-xs">Out of Pocket</span> <span className="font-bold">₹{item.outOfPocketPaid}</span></div>}
                                    </div>
                                    <ImageViewer urls={item.billPhotoUrls || []} />
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}