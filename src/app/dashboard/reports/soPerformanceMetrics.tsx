// src/app/dashboard/reports/soPerformanceMetrics.tsx
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { DateRange } from "react-day-picker";
import { format, startOfMonth } from "date-fns";

import {
    Loader2, Eye, MapPin, User, Activity, Store,
} from 'lucide-react';

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// --- Validation Schema ---
const metricNode = z.object({
    aop: z.number(),
    mtd: z.number(),
    pct: z.number(),
});

const soPerformanceMetricSchema = z.object({
    id: z.union([z.string(), z.number()]),
    userId: z.number().nullable().optional(),
    salesmanName: z.string().catch("Unknown"),
    zone: z.string().nullable().optional().catch(""),
    area: z.string().nullable().optional().catch(""),
    totalVisits: z.coerce.number().catch(0),
    metrics: z.object({
        dealerVisits: metricNode,
        institutionVisits: metricNode,
        influencerVisits: metricNode,
    }),
});

type SoPerformanceMetric = z.infer<typeof soPerformanceMetricSchema>;

// --- API Endpoints ---
const API_ENDPOINT = `/api/dashboardPagesAPI/reports/so-performance-metrics`;
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

interface LocationsResponse {
    areas: string[];
    zones: string[];
}

// --- Helpers ---
const MetricProgressCard = ({ title, data, colorClass = "bg-primary" }: { title: string, data: { aop: number, mtd: number, pct: number }, colorClass?: string }) => (
    <Card className="shadow-sm border">
        <CardContent className="p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-muted-foreground">{title}</span>
                <Badge variant={data.pct >= 100 ? "default" : "secondary"}>{data.pct}%</Badge>
            </div>
            <div className="flex justify-between items-end">
                <span className="text-2xl font-bold">{data.mtd}</span>
                <span className="text-xs text-muted-foreground mb-1">Target: {data.aop}</span>
            </div>
            {/* Custom Progress Bar */}
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mt-1">
                <div
                    className={`h-full ${colorClass} transition-all duration-500`}
                    style={{ width: `${Math.min(data.pct, 100)}%` }}
                />
            </div>
        </CardContent>
    </Card>
);

export default function SoPerformanceMetricsPage() {
    const router = useRouter();
    const [metrics, setMetrics] = useState<SoPerformanceMetric[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedMetric, setSelectedMetric] = useState<SoPerformanceMetric | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    // --- Standardized Filter State ---
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: new Date() });
    const [areaFilters, setAreaFilters] = useState<string[]>([]);
    const [zoneFilters, setZoneFilters] = useState<string[]>([]);

    // --- Backend Filter Options ---
    const [availableAreas, setAvailableAreas] = useState<string[]>([]);
    const [availableZones, setAvailableZones] = useState<string[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState(true);

    const [page, setPage] = useState(0);
    const [pageSize] = useState(100);
    const [totalCount, setTotalCount] = useState(0);

    // Reset page on filter change
    useEffect(() => {
        setPage(0);
    }, [debouncedSearchQuery, areaFilters, zoneFilters, dateRange]);

    const fetchMetrics = useCallback(async () => {
        setIsLoading(true);
        try {
            const url = new URL(API_ENDPOINT, window.location.origin);
            url.searchParams.append('page', page.toString());
            url.searchParams.append('pageSize', pageSize.toString());

            if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);

            if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
            if (zoneFilters.length > 0) url.searchParams.append('zone', zoneFilters.join(','));

            if (dateRange?.from) url.searchParams.append('startDate', format(dateRange.from, "yyyy-MM-dd"));
            if (dateRange?.to) {
                url.searchParams.append('endDate', format(dateRange.to, "yyyy-MM-dd"));
            } else if (dateRange?.from) {
                url.searchParams.append('endDate', format(dateRange.from, "yyyy-MM-dd"));
            }

            url.searchParams.append('_t', Date.now().toString());

            const response = await fetch(url.toString(), {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });

            const result = await response.json();
            const rawData: SoPerformanceMetric[] = result.data || [];
            setTotalCount(result.totalCount || 0);

            const validatedData = rawData.map((item, index) => {
                try {
                    const itemWithId = { ...item, id: item.userId ? String(item.userId) : `row-fallback-${index}` };
                    return soPerformanceMetricSchema.parse(itemWithId);
                } catch (e) {
                    console.error('Validation Data Issue:', e);
                    return null;
                }
            }).filter(Boolean) as SoPerformanceMetric[];
            setMetrics(validatedData);
        } catch (error: any) {
            toast.error(`Failed to load: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [router, page, pageSize, debouncedSearchQuery, areaFilters, zoneFilters, dateRange]);

    const fetchLocations = useCallback(async () => {
        setIsLoadingLocations(true);
        try {
            const url = new URL(LOCATION_API_ENDPOINT, window.location.origin);
            url.searchParams.append('_t', Date.now().toString());
            const response = await fetch(url.toString(), { cache: 'no-store' });
            if (response.ok) {
                const data: LocationsResponse = await response.json();
                setAvailableAreas(data.areas || []);
                setAvailableZones(data.zones || []);
            }
        } finally { setIsLoadingLocations(false); }
    }, []);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
    useEffect(() => { fetchLocations(); }, [fetchLocations]);

    const zoneOptions = useMemo(() => availableZones.sort().map(r => ({ label: r, value: r })), [availableZones]);
    const areaOptions = useMemo(() => availableAreas.sort().map(a => ({ label: a, value: a })), [availableAreas]);

    // --- Table Columns ---
    const columns = useMemo<ColumnDef<SoPerformanceMetric>[]>(() => [
        {
            accessorKey: "salesmanName",
            header: "SO Name",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{row.original.salesmanName}</span>
                </div>
            )
        },
        {
            accessorKey: "zone",
            header: "Zone",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium">{row.original.zone || 'N/A'}</span>
                    <span className="text-xs text-muted-foreground">{row.original.area || 'N/A'}</span>
                </div>
            )
        },
        {
            accessorKey: "totalVisits",
            header: "Total Visits",
            cell: ({ row }) => (
                <Badge variant="default" className="text-sm px-2.5 py-0.5">
                    {row.original.totalVisits}
                </Badge>
            )
        },
        {
            id: "dealerVisits",
            header: "Dealer Visits",
            cell: ({ row }) => (
                <span className="font-medium text-amber-700">{row.original.metrics.dealerVisits.mtd}</span>
            )
        },
        {
            id: "institutionVisits",
            header: "Institution Visits",
            cell: ({ row }) => (
                <span className="font-medium text-blue-700">{row.original.metrics.institutionVisits.mtd}</span>
            )
        },
        {
            id: "influencerVisits",
            header: "Influencer Visits",
            cell: ({ row }) => (
                <span className="font-medium text-purple-700">{row.original.metrics.influencerVisits.mtd}</span>
            )
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 h-8 px-2 shadow-sm"
                    onClick={() => {
                        setSelectedMetric(row.original);
                        setIsViewModalOpen(true);
                    }}
                >
                    <Eye className="h-3.5 w-3.5 mr-1" /> View Breakdown
                </Button>
            ),
        },
    ], []);

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
            <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-bold tracking-tight">SO Performance Metrics</h2>
                        <Badge variant="outline" className="text-base px-4 py-1">
                            Active Personnel: {totalCount}
                        </Badge>
                    </div>
                    <RefreshDataButton cachePrefix="so-performance-metrics" onRefresh={fetchMetrics} />
                </div>

                <div className="w-full">
                    <GlobalFilterBar
                        showSearch={true}
                        showZone={true}
                        showArea={true}
                        showDateRange={true}
                        showRole={false}
                        showStatus={false}
                        searchVal={searchQuery}
                        dateRangeVal={dateRange}
                        zoneVals={zoneFilters}
                        areaVals={areaFilters}
                        zoneOptions={zoneOptions}
                        areaOptions={areaOptions}
                        onSearchChange={setSearchQuery}
                        onDateRangeChange={setDateRange}
                        onZoneChange={setZoneFilters}
                        onAreaChange={setAreaFilters}
                    />
                </div>

                <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <DataTableReusable columns={columns} data={metrics} enableRowDragging={false} />
                    )}
                </div>
            </div>

            {/* View Details Modal */}
            {selectedMetric && (
                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="sm:max-w-[700px] p-0 gap-0 bg-background">
                        <div className="px-6 py-4 border-b bg-muted/20 border-l-[6px] border-l-primary">
                            <DialogTitle className="text-xl flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-primary" />
                                    SO Breakdown
                                </span>
                                <Badge variant="default" className="text-sm px-3">
                                    {selectedMetric.totalVisits} Total DVRs
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1 font-medium text-foreground"><User className="w-3.5 h-3.5" /> {selectedMetric.salesmanName}</span>
                                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selectedMetric.zone} / {selectedMetric.area}</span>
                            </DialogDescription>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div>
                                <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2"><Store className="w-4 h-4"/> Visit Categories Split</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    <MetricProgressCard title="Dealer Visits" data={selectedMetric.metrics.dealerVisits} colorClass="bg-amber-500" />
                                    <MetricProgressCard title="Institution Visits" data={selectedMetric.metrics.institutionVisits} colorClass="bg-blue-500" />
                                    <MetricProgressCard title="Influencer Visits" data={selectedMetric.metrics.influencerVisits} colorClass="bg-purple-500" />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-4 bg-background border-t">
                            <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}