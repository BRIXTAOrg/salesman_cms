// src/app/api/custom-report-generator/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withTenantDb } from '@/lib/auth';
import { users } from '../../../../drizzle';
import { eq } from 'drizzle-orm';
import { transformerMap } from '@/lib/reports-transformer';
import { exportTablesToCSVZip, generateAndStreamXlsxMulti } from '@/lib/download-utils';
import { verifySession } from '@/lib/auth';

interface TableColumn {
    table: string;
    column: string;
}

interface FilterRule {
    id: string;
    column: string;
    operator: 'contains' | 'equals' | 'gt' | 'lt';
    value: string;
}

type ReportTableId = keyof typeof transformerMap;

// --- Auth Check ---
// async function getAuthClaims() {
//     const session = await verifySession();
//     if (!session || !session.userId) {
//         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     const result = await db
//         .select({ role: users.role })
//         .from(users)
//         .where(eq(users.id, session.userId))
//         .limit(1);

//     const currentUser = result[0];

//     if (!currentUser) {
//         return new NextResponse('User not found', { status: 404 });
//     }
//     return { session, currentUser };
// }

// Helper to safely parse dates, especially the en-IN DD/MM/YYYY format from the transformer
function parseDateSafely(val: any): Date {
    if (!val) return new Date(NaN);
    if (val instanceof Date) return val;

    const valStr = String(val).trim();
    if (!valStr) return new Date(NaN);

    // 1. FORCED DD/MM/YYYY CHECK FIRST. 
    // This stops JS from misinterpreting "02/04/2026" (April 2) as Feb 4.
    const slashMatch = valStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
        const day = slashMatch[1].padStart(2, '0');
        const month = slashMatch[2].padStart(2, '0');
        const year = slashMatch[3];
        // Lock to Midnight UTC to avoid local timezone shifts
        return new Date(`${year}-${month}-${day}T00:00:00`);
    }

    // 2. Fallback for formatDateTimeIST (e.g., "27 Mar 2026, 10:30 AM")
    const d = new Date(valStr);
    if (!isNaN(d.getTime())) return d;

    return new Date(NaN);
}

// --- Filtering Logic ---
function applyFilters(rows: any[], filters: FilterRule[]): any[] {
    if (!filters || filters.length === 0) return rows;

    return rows.filter(row => {
        // A row must satisfy ALL applicable filters (AND logic)
        return filters.every(filter => {
            if (!(filter.column in row)) {
                return true; // Ignore if column doesn't exist
            }

            const rawValue = row[filter.column];
            const cellValueStr = String(rawValue ?? '').trim().toLowerCase();
            const filterValueStr = String(filter.value ?? '').trim().toLowerCase();

            if (!filterValueStr) return true;

            // Determine if this is a Date column based on the key name (matching UI logic)
            const isDateColumn = filter.column.toLowerCase().includes('date') || filter.column.toLowerCase().includes('at');

            // --- 3. Handle Date Ranges ---
            // GUARDED: Only split by commas if we are actually dealing with a Date column!
            if (isDateColumn && filterValueStr.includes(',')) {
                const [startStr, endStr] = filterValueStr.split(',');

                const cellDate = parseDateSafely(rawValue);
                if (isNaN(cellDate.getTime())) return false;

                // Start at 00:00:00
                const startDate = new Date(`${startStr}T00:00:00`);

                // End at 23:59:59. If no end date (single day pick), make the end date the same day.
                const endDate = endStr
                    ? new Date(`${endStr}T23:59:59.999`)
                    : new Date(`${startStr}T23:59:59.999`);

                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    return cellDate >= startDate && cellDate <= endDate;
                }
                return false;
            }

            // --- 4. Standard Operators (Strings & Numbers) ---
            switch (filter.operator) {
                case 'contains':
                    return cellValueStr.includes(filterValueStr);

                case 'equals':
                    return cellValueStr === filterValueStr;

                case 'gt': {
                    if (isDateColumn) {
                        const cellDate = parseDateSafely(rawValue);
                        const filterDate = new Date(filterValueStr);
                        if (!isNaN(cellDate.getTime()) && !isNaN(filterDate.getTime())) {
                            return cellDate > filterDate;
                        }
                    }

                    const numCell = parseFloat(cellValueStr);
                    const numFilter = parseFloat(filterValueStr);
                    if (!isNaN(numCell) && !isNaN(numFilter)) {
                        return numCell > numFilter;
                    }

                    return cellValueStr > filterValueStr;
                }

                case 'lt': {
                    if (isDateColumn) {
                        const cellDate = parseDateSafely(rawValue);
                        const filterDate = new Date(filterValueStr);
                        if (!isNaN(cellDate.getTime()) && !isNaN(filterDate.getTime())) {
                            return cellDate < filterDate;
                        }
                    }

                    const numCell = parseFloat(cellValueStr);
                    const numFilter = parseFloat(filterValueStr);
                    if (!isNaN(numCell) && !isNaN(numFilter)) {
                        return numCell < numFilter;
                    }

                    return cellValueStr < filterValueStr;
                }

                default:
                    return true;
            }
        });
    });
}

/**
 * Helper to structure data for generateAndStreamXlsxMulti.
 */
function buildSheetsPayload(
    groupedColumns: Record<string, string[]>,
    dataPerTable: Record<string, any[]>
): Record<string, { headers: string[]; rows: any[] }> {
    const sheets: Record<string, { headers: string[]; rows: any[] }> = {};

    for (const [tableId, columns] of Object.entries(groupedColumns)) {
        const rows = dataPerTable[tableId] ?? [];

        sheets[tableId] = {
            headers: columns,
            rows: rows.map(row => {
                const obj: Record<string, any> = {};
                for (const c of columns) obj[c] = (row as any)[c] ?? null;
                return obj;
            }),
        };
    }
    return sheets;
}

// POST HANDLER 
export const POST = withTenantDb(async (req, db, session) => {
    // 1. Auth Check -- role lookup now runs on the tenant-scoped db
    // withTenantDb already opened, instead of a separate getAuthClaims()
    // call against the unscoped singleton.
    const result = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

    const currentUser = result[0];

    if (!currentUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    try {
        // 2. Parse Payload
        const { columns, format, limit, filters } = await req.json() as {
            columns: TableColumn[];
            format: 'xlsx' | 'csv' | 'json';
            limit?: number;
            filters?: FilterRule[];
        };

        if (!columns || columns.length === 0) {
            return NextResponse.json({ error: 'No columns selected' }, { status: 400 });
        }

        // 3. Group columns by table ID 
        const grouped = columns.reduce((acc, col) => {
            acc[col.table] = acc[col.table] || [];
            if (!acc[col.table].includes(col.column)) {
                acc[col.table].push(col.column);
            }
            return acc;
        }, {} as Record<string, string[]>);

        const tableIds = Object.keys(grouped);

        // --- 4. Handle PREVIEW Request (format: 'json') ---
        if (format === 'json' && tableIds.length > 0) {
            const previewTableId = tableIds[0];

            if (!(previewTableId in transformerMap)) {
                return NextResponse.json({ error: `Fetcher not found for table: ${previewTableId}` }, { status: 400 });
            }
            const fetcher = transformerMap[previewTableId as ReportTableId];

            // Fetch full data using the transformer -- db is the
            // tenant-scoped connection every transformer function now
            // requires as its first argument.
            let rows = await (fetcher as any)(db);

            // ADDED: Apply filters to preview data server-side (optional but good for consistency)
            // Note: In your current UI, you filter preview client-side, but this ensures API correctness.
            rows = applyFilters(rows, filters || []);

            // Select only requested columns and limit the rows for preview
            const previewCols = grouped[previewTableId];
            const previewData = (rows as any[])
                .slice(0, limit || 10)
                .map(r => {
                    const obj: Record<string, any> = { id: (r as any).id };
                    for (const c of previewCols) {
                        obj[c] = (r as any)[c] ?? null;
                    }
                    return obj;
                });

            return NextResponse.json({ data: previewData });
        }

        // --- 5. Handle DOWNLOAD Request (format: 'xlsx' or 'csv') ---

        const dataPerTable: Record<string, any[]> = {};
        for (const table of tableIds) {
            if (table in transformerMap) {
                const fn = transformerMap[table as ReportTableId];
                // A. Fetch Raw Data
                const rawRows = await (fn as any)(db);
                // B. Apply Filters
                dataPerTable[table] = applyFilters(rawRows, filters || []);
            }
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).replace(/ /g, '-'); // Result: "10-Feb-2026"

        const filenameBase = `report_${dateStr}`;

        if (format === 'csv') {
            const dataByTable = tableIds.map((table) => {
                const cols = grouped[table];
                const rows = (dataPerTable[table] ?? []).map(r => {
                    const obj: Record<string, any> = {};
                    for (const c of cols) obj[c] = (r as any)[c] ?? null;
                    return obj;
                });
                return { table, columns: cols, rows };
            });

            const zipBlob = await exportTablesToCSVZip(dataByTable);
            const buffer = Buffer.from(await zipBlob.arrayBuffer());

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/zip",
                },
            });
        }

        if (format === 'xlsx') {
            const sheets = buildSheetsPayload(grouped, dataPerTable);
            return generateAndStreamXlsxMulti(sheets, `${filenameBase}.xlsx`);
        }

        return NextResponse.json({ error: 'Invalid format specified' }, { status: 400 });

    } catch (e) {
        console.error('Custom report route error:', e);
        return NextResponse.json({ error: 'Failed to process report request. Check data format in transformers.' }, { status: 500 });
    }
});