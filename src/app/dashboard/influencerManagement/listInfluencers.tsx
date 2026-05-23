// src/app/dashboard/influencerManagement/listInfluencers.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, MapPin, ExternalLink } from 'lucide-react'; 

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// Reusable Components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search';
import { useDealerLocations } from '@/components/reusable-dealer-locations';

// 1. PERFECTLY ALIGNED SCHEMA
const influencerFrontendSchema = z.object({
  id: z.number(),
  contactPersonName: z.string().nullable().optional(),
  contactPersonNumber: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  zone: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pinCode: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  isVerified: z.boolean().nullable().optional(),
});

type InfluencerRecord = z.infer<typeof influencerFrontendSchema>;

const INFLUENCER_LOCATIONS_API = `/api/dashboardPagesAPI/influencerManagement`;

export default function ListInfluencersPage() {
  const [influencers, setInfluencers] = useState<InfluencerRecord[]>([]);
  const [loadingInfluencers, setLoadingInfluencers] = useState(true);
  const [errorInfluencers, setErrorInfluencers] = useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [influencerToDeleteId, setInfluencerToDeleteId] = useState<number | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);

  // --- Backend Filter Options ---
  // Reusing the dealer locations hook to fetch company-wide zones/areas
  const { locations, loading: locationsLoading, error: locationsError } = useDealerLocations();

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, zoneFilters, areaFilters]);

  const fetchInfluencers = useCallback(async () => {
    setLoadingInfluencers(true);
    setErrorInfluencers(null);
    try {
      const url = new URL(INFLUENCER_LOCATIONS_API, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('zone', zoneFilters.join(','));

      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to fetch');

      const rawData = result.data || result; 
      setTotalCount(result.totalCount || 0);

      const validatedInfluencers = z.array(influencerFrontendSchema).parse(rawData);
      setInfluencers(validatedInfluencers);
    } catch (e: any) {
      console.error('Failed to fetch influencers:', e);
      const msg = e instanceof z.ZodError
        ? 'Data validation failed. Schema mismatch with backend.'
        : (e.message || 'An unknown error occurred.');
      toast.error(`Failed to load influencers: ${msg}`);
      setErrorInfluencers(msg);
    } finally {
      setLoadingInfluencers(false);
    }
  }, [page, pageSize, debouncedSearchQuery, zoneFilters, areaFilters]);

  useEffect(() => {
    fetchInfluencers();
  }, [fetchInfluencers]);

  const zoneOptions = useMemo(() => (locations.zones || []).filter(Boolean).sort().map(r => ({ label: r, value: r })), [locations.zones]);
  const areaOptions = useMemo(() => (locations.areas || []).filter(Boolean).sort().map(a => ({ label: a, value: a })), [locations.areas]);

  const handleDelete = async () => {
    if (!influencerToDeleteId) return;
    try {
      const response = await fetch(`${INFLUENCER_LOCATIONS_API}?id=${influencerToDeleteId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to delete influencer.');
      }
      toast.success('Influencer deleted successfully!');
      setIsDeleteDialogOpen(false);
      setInfluencerToDeleteId(null);
      fetchInfluencers();
    } catch (e: any) {
      console.error('Error deleting influencer:', e);
      toast.error(e.message || 'An unexpected error occurred.');
    }
  };

  const getGoogleMapsLink = (lat?: number | null, lng?: number | null) => {
    if (!lat || !lng) return null;
    return `http://googleusercontent.com/maps.google.com/?q=${lat},${lng}`;
  };

  const influencerColumns: ColumnDef<InfluencerRecord>[] = [
    { accessorKey: 'contactPersonName', header: 'Contact Person', cell: info => <span className="font-semibold text-[15px]">{info.getValue() as string || '-'}</span> },
    { accessorKey: 'contactPersonNumber', header: 'Phone No.', cell: info => info.getValue() || '-' },
    { accessorKey: 'email', header: 'Email', cell: info => info.getValue() || '-' },
    {
      header: 'Location',
      accessorKey: 'address', 
      cell: ({ row }) => {
        const { zone, area, latitude, longitude } = row.original;
        const mapLink = getGoogleMapsLink(latitude, longitude);

        return (
          <div className="flex flex-col min-w-[180px] text-xs space-y-1">
            <div className="flex items-center gap-1 font-semibold text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{zone || '-'} / {area || '-'}</span>
            </div>
            {mapLink ? (
              <a 
                href={mapLink} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-1 text-blue-600 hover:underline w-fit"
              >
                <ExternalLink className="h-3 w-3" /> View on Map
              </a>
            ) : (
               <span className="text-gray-400 italic text-[10px]">No GPS Coords</span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'isVerified',
      header: 'Status',
      cell: ({ row }) => {
        return row.original.isVerified 
          ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shadow-none">Verified</Badge>
          : <Badge variant="secondary" className="shadow-none">Pending</Badge>;
      }
    },
    { accessorKey: 'createdAt', header: 'Added On', cell: info => new Date(info.getValue() as string).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
  ];

  if (loadingInfluencers && influencers.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading influencer data...</p>
      </div>
    );
  }
  
  if (errorInfluencers || locationsError) {
    return <div className="text-center text-red-500 min-h-screen pt-10">Error: {errorInfluencers || locationsError}</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-[100vw] overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Manage Influencers</h1>
          <Badge variant="outline" className="text-base px-4 py-1">
            Total Influencers: {totalCount}
          </Badge>
        </div>
        <RefreshDataButton 
          cachePrefix="influencers" 
          onRefresh={fetchInfluencers} 
        />
      </div>

      <div className="w-full mb-6 relative z-50">
        <GlobalFilterBar 
          showSearch={true}
          showRole={false}
          showZone={true}
          showArea={true}
          showDateRange={false}
          showStatus={false}

          searchVal={searchQuery}
          zoneVals={zoneFilters}
          areaVals={areaFilters}

          zoneOptions={zoneOptions}
          areaOptions={areaOptions}

          onSearchChange={setSearchQuery}
          onZoneChange={setZoneFilters}
          onAreaChange={setAreaFilters}
        />
      </div>

      {influencers.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 bg-muted/20 rounded-lg">No influencers found matching the selected filters.</div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden p-1 relative z-0">
          <DataTableReusable
            columns={influencerColumns}
            data={influencers}
            enableRowDragging={false}
            onRowOrderChange={() => { }}
          />
        </div>
      )}
    </div>
  );
}