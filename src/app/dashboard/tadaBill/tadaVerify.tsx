// src/app/dashboard/tadaBill/tadaVerify.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { Loader2, Check, X, ClipboardCheck, MapPin, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateRange } from "react-day-picker";

import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Schemas
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
    totalCost: z.coerce.number().nullable().optional(),
    status: z.string(),
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

export default function TadaVerifyPage() {
    const [pendingBills, setPendingBills] = useState<TadaRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters & State
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modal State
    const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
    const [billToVerify, setBillToVerify] = useState<TadaRecord | null>(null);
    const [isPatching, setIsPatching] = useState(false);

    const API_BASE = `/api/dashboardPagesAPI/tadaBill/tada-verification`;

    const fetchPendingBills = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}?_t=${Date.now()}`, { cache: 'no-store' });
            const data = await response.json();
            setPendingBills(z.array(tadaFrontendSchema).parse(data.data || []));
        } catch (e) {
            toast.error("Error loading verification queue.");
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    useEffect(() => { fetchPendingBills(); }, [fetchPendingBills]);

    const filteredBills = useMemo(() => {
        return pendingBills.filter(bill => {
            const search = debouncedSearchQuery.toLowerCase();
            const matchesSearch = !search || (bill.salesmanName || '').toLowerCase().includes(search);

            let matchesDate = true;
            if (dateRange?.from) {
                const bDate = new Date(bill.billDate);
                const fDate = new Date(dateRange.from);
                const tDate = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
                bDate.setHours(0, 0, 0, 0); fDate.setHours(0, 0, 0, 0); tDate.setHours(23, 59, 59, 999);
                matchesDate = bDate >= fDate && bDate <= tDate;
            }
            return matchesSearch && matchesDate;
        });
    }, [pendingBills, debouncedSearchQuery, dateRange]);

    const selectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedIds(new Set(filteredBills.map(p => p.id)));
        else setSelectedIds(new Set());
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // --- ACTIONS ---
    const handleBulkVerify = async () => {
        const idsToVerify = Array.from(selectedIds);
        if (idsToVerify.length === 0) return;
        setIsPatching(true);
        try {
            const res = await fetch(`${API_BASE}/bulk-verify`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToVerify }),
            });
            if (res.ok) {
                toast.success(`${idsToVerify.length} bills approved!`);
                setSelectedIds(new Set());
                fetchPendingBills();
            }
        } catch (error) { toast.error("Bulk approval failed"); } finally { setIsPatching(false); }
    };

    const handleSingleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
        setIsPatching(true);
        try {
            const res = await fetch(`${API_BASE}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: action }),
            });
            if (!res.ok) throw new Error("Action failed");
            toast.success(`Bill ${action}`);
            setIsVerifyDialogOpen(false);
            fetchPendingBills();
        } catch (e: any) { toast.error(e.message); } finally { setIsPatching(false); }
    };

    const verificationColumns: ColumnDef<TadaRecord>[] = [
        { accessorKey: 'salesmanName', header: 'Salesman' },
        { accessorKey: 'billDate', header: 'Date', cell: info => new Date(info.getValue() as string).toLocaleDateString('en-GB') },
        { accessorKey: 'totalCost', header: 'Total Claim (₹)', cell: info => <span className="font-bold">₹{(info.getValue() as number || 0).toFixed(2)}</span> },
        {
            id: 'actions', header: 'Actions',
            cell: ({ row }) => (
                <Button variant="outline" size="sm" className="h-8 text-blue-600 border-blue-200" onClick={() => { setBillToVerify(row.original); setIsVerifyDialogOpen(true); }}>
                    Review & Verify
                </Button>
            )
        },
        {
            id: 'select',
            header: () => (
                <div className="flex items-center justify-center">
                    <input type="checkbox" onChange={selectAll} checked={selectedIds.size === filteredBills.length && filteredBills.length > 0} className="h-4 w-4 rounded cursor-pointer" />
                </div>
            ),
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <input type="checkbox" checked={selectedIds.has(row.original.id)} onChange={() => toggleSelect(row.original.id)} className="h-4 w-4 rounded cursor-pointer" />
                </div>
            ),
            size: 40,
        },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
            <div className="flex-1 space-y-6 pt-2 w-full">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">TA/DA Verification Queue</h2>
                    <RefreshDataButton cachePrefix="tada-verification" onRefresh={fetchPendingBills} />
                </div>

                {selectedIds.size > 0 && (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">{selectedIds.size}</div>
                            <div><p className="text-emerald-900 font-medium">Items Selected</p></div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-emerald-800 hover:bg-emerald-100">Cancel</Button>
                            <Button onClick={handleBulkVerify} disabled={isPatching} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                                {isPatching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />} Approve Selected
                            </Button>
                        </div>
                    </div>
                )}

                <div className="w-full relative z-50">
                    <GlobalFilterBar showSearch={true} showDateRange={true} searchVal={searchQuery} dateRangeVal={dateRange} onSearchChange={setSearchQuery} onDateRangeChange={setDateRange} />
                </div>

                <div className="bg-card p-1 rounded-lg border shadow-sm relative z-0">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-64 gap-2"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-muted-foreground">Loading queue...</p></div>
                    ) : filteredBills.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12">No pending bills found.</div>
                    ) : (
                        <DataTableReusable columns={verificationColumns} data={filteredBills} />
                    )}
                </div>
            </div>

            <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
                {/* ADDED: overflow-hidden to bound the modal */}
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                    {/* ADDED: shrink-0 to prevent the header from squishing */}
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-2xl"><ClipboardCheck className="text-primary" /> Review Bill</DialogTitle>
                    </DialogHeader>

                    {/* CHANGED: Replaced ScrollArea with a native scrolling div */}
                    <div className="flex-1 overflow-y-auto pr-4 mt-4 space-y-6 pb-6">
                        <div className="flex justify-between p-4 bg-muted/30 rounded-lg">
                            <div><p className="text-xs text-muted-foreground uppercase">Salesman</p><p className="font-bold text-lg">{billToVerify?.salesmanName}</p></div>
                            <div className="text-right"><p className="text-xs text-muted-foreground uppercase">Total Claim</p><p className="font-bold text-2xl text-primary">₹{(billToVerify?.totalCost || 0).toFixed(2)}</p></div>
                        </div>

                        <div className="space-y-4">
                            {billToVerify?.items?.map(item => (
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

                    {/* ADDED: shrink-0 to pin the footer to the bottom */}
                    <DialogFooter className="gap-2 pt-4 border-t shrink-0">
                        <Button type="button" variant="destructive" disabled={isPatching} onClick={() => handleSingleAction(billToVerify!.id, 'REJECTED')}>
                            <X className="w-4 h-4 mr-2" /> Reject
                        </Button>
                        <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isPatching} onClick={() => handleSingleAction(billToVerify!.id, 'APPROVED')}>
                            <Check className="w-4 h-4 mr-2" /> Approve Bill
                        </Button>
                    </DialogFooter>

                </DialogContent>
            </Dialog>
        </div>
    );
}