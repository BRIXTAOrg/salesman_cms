"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import type {
  GenericRecord,
  Responsibility,
} from "@/lib/appliance-types";
import { GlobalFilterBar } from "@/components/global-filter-bar";
import { useDebounce } from "@/hooks/use-debounce-search";
import {
  apiJson,
} from "./client";
import RecordOutput from "./record-output";
import {
  EmptyState,
  PageIntro,
  Pill,
  SecondaryButton,
} from "./primitives";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "string"
      ? value
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  // Quote anything with a comma, quote, or newline; double up embedded
  // quotes -- standard CSV escaping.
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: unknown[][],
) {
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function DynamicWorkClient({
  responsibilityKey,
}: {
  responsibilityKey: string;
}) {
  const [responsibility, setResponsibility] =
    useState<Responsibility | null>(null);
  const [records, setRecords] =
    useState<GenericRecord[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);
  const [exporting, setExporting] =
    useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    undefined,
  );

  const buildQuery = useCallback(
    (key: string, limit: number) => {
      const params = new URLSearchParams();
      params.set("responsibilityKey", key);
      params.set("limit", String(limit));
      if (debouncedSearchQuery) {
        params.set("search", debouncedSearchQuery);
      }
      if (dateRange?.from) {
        params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
      } else if (dateRange?.from) {
        params.set("endDate", format(dateRange.from, "yyyy-MM-dd"));
      }
      return params;
    },
    [debouncedSearchQuery, dateRange],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const responsibilityBody = await apiJson<{
        responsibilities: Responsibility[];
      }>("/api/appliance/responsibilities");

      const normalizedKey = decodeURIComponent(responsibilityKey)
        .trim()
        .toLowerCase();

      const selected = (responsibilityBody.responsibilities ?? [])
        .find((item) =>
          item.key.toLowerCase() === normalizedKey &&
          item.isActive !== false,
        );

      if (!selected) {
        throw new Error(
          "Responsibility not found or disabled.",
        );
      }

      // Filtering (search + date range) happens in Postgres via the
      // admin /records route's WHERE clause -- not fetched-then-filtered
      // in the browser, so this stays fast regardless of table size.
      const query = buildQuery(selected.key, 500);

      const recordBody = await apiJson<{
        records: GenericRecord[];
      }>(
        `/api/appliance/records?${query.toString()}`,
      );

      setResponsibility(selected);
      setRecords(recordBody.records ?? []);
    } catch (error) {
      setResponsibility(null);
      setRecords([]);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load Responsibility records.",
      );
    } finally {
      setLoading(false);
    }
  }, [responsibilityKey, buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = useCallback(async () => {
    if (!responsibility) return;
    setExporting(true);

    try {
      // The visible table is capped at 500 rows for render performance;
      // the export goes back to the server for up to the backend's max
      // (1000) using the same filters, so a filtered download always
      // reflects the full filtered set, not just what's on screen.
      const query = buildQuery(responsibility.key, 1000);
      const body = await apiJson<{ records: GenericRecord[] }>(
        `/api/appliance/records?${query.toString()}`,
      );
      const exportRecords = body.records ?? [];
      const fields = responsibility.definition.input.fields ?? [];

      const headers = [
        "Employee",
        "Employee code",
        ...fields.map((field) => field.label),
        "Status",
        "Created at",
        "Updated at",
      ];

      const rows = exportRecords.map((record) => [
        record.employeeName ?? "",
        record.employeeCode ?? "",
        ...fields.map((field) => {
          const value = record.payload[field.key];
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return value;
        }),
        record.status,
        record.createdAt ?? "",
        record.updatedAt ?? "",
      ]);

      const datePart = new Date().toISOString().slice(0, 10);
      downloadCsv(
        `${responsibility.key}-${datePart}.csv`,
        headers,
        rows,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to export records.",
      );
    } finally {
      setExporting(false);
    }
  }, [responsibility, buildQuery]);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Work"
        title={responsibility?.title ?? "Responsibility"}
        description={
          responsibility?.description ??
          "Records generated by this Responsibility. The renderer comes from the Responsibility definition."
        }
        action={
          <div className="flex items-center gap-2">
            {responsibility && (
              <Pill tone="info">
                {responsibility.definition.output.renderer.replace(/_/g, " ")}
              </Pill>
            )}
            <SecondaryButton
              type="button"
              onClick={() => void handleDownload()}
              disabled={exporting || !responsibility}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      <GlobalFilterBar
        showSearch
        showDateRange
        searchVal={searchQuery}
        dateRangeVal={dateRange}
        onSearchChange={setSearchQuery}
        onDateRangeChange={setDateRange}
      />

      {loading && !responsibility ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <EmptyState
          title="Work surface unavailable"
          description={error}
        />
      ) : responsibility ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-semibold">{records.length}</div>
              <div className="text-sm text-muted-foreground">records</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-semibold">
                {responsibility.definition.input.fields.length}
              </div>
              <div className="text-sm text-muted-foreground">input fields</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold capitalize">
                {Object.entries(responsibility.definition.crud)
                  .filter(([, enabled]) => enabled)
                  .map(([operation]) => operation)
                  .join(" · ") || "read only"}
              </div>
              <div className="text-sm text-muted-foreground">enabled operations</div>
            </div>
          </div>

          <RecordOutput
            responsibility={responsibility}
            records={records}
          />
        </>
      ) : null}
    </div>
  );
}