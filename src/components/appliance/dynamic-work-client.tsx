"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
  dashboardColumnsFor,
  dashboardSurfacesFor,
  resolveSurfaceColumnValue,
} from "@/lib/responsibility-surface-projection";

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
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    typeof value === "string"
      ? value
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

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
    headers
      .map(csvCell)
      .join(","),
    ...rows.map(
      (row) =>
        row
          .map(csvCell)
          .join(","),
    ),
  ];

  const blob =
    new Blob(
      [lines.join("\n")],
      {
        type:
          "text/csv;charset=utf-8;",
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const link =
    document.createElement(
      "a",
    );

  link.href = url;
  link.download =
    filename;

  document.body.appendChild(
    link,
  );

  link.click();

  document.body.removeChild(
    link,
  );

  URL.revokeObjectURL(
    url,
  );
}

export default function DynamicWorkClient({
  responsibilityKey,
}: {
  responsibilityKey: string;
}) {
  const [
    responsibility,
    setResponsibility,
  ] =
    useState<Responsibility | null>(
      null,
    );

  const [
    records,
    setRecords,
  ] =
    useState<GenericRecord[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState("");

  const debouncedSearchQuery =
    useDebounce(
      searchQuery,
      400,
    );

  const [
    dateRange,
    setDateRange,
  ] =
    useState<
      DateRange | undefined
    >(undefined);

  const buildQuery =
    useCallback(
      (
        key: string,
        limit: number,
      ) => {
        const params =
          new URLSearchParams();

        params.set(
          "responsibilityKey",
          key,
        );

        params.set(
          "limit",
          String(limit),
        );

        if (
          debouncedSearchQuery
        ) {
          params.set(
            "search",
            debouncedSearchQuery,
          );
        }

        if (
          dateRange?.from
        ) {
          params.set(
            "startDate",
            format(
              dateRange.from,
              "yyyy-MM-dd",
            ),
          );
        }

        if (
          dateRange?.to
        ) {
          params.set(
            "endDate",
            format(
              dateRange.to,
              "yyyy-MM-dd",
            ),
          );
        } else if (
          dateRange?.from
        ) {
          params.set(
            "endDate",
            format(
              dateRange.from,
              "yyyy-MM-dd",
            ),
          );
        }

        return params;
      },
      [
        debouncedSearchQuery,
        dateRange,
      ],
    );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        try {
          const responsibilityBody =
            await apiJson<{
              responsibilities:
                Responsibility[];
            }>(
              "/api/appliance/responsibilities",
            );

          const normalizedKey =
            decodeURIComponent(
              responsibilityKey,
            )
              .trim()
              .toLowerCase();

          const selected =
            (
              responsibilityBody
                .responsibilities ??
              []
            ).find(
              (item) =>
                item.key
                  .toLowerCase() ===
                  normalizedKey &&
                item.isActive !==
                  false,
            );

          if (!selected) {
            throw new Error(
              "Responsibility not found or disabled.",
            );
          }

          const query =
            buildQuery(
              selected.key,
              500,
            );

          const recordBody =
            await apiJson<{
              records:
                GenericRecord[];
            }>(
              `/api/appliance/records?${query.toString()}`,
            );

          setResponsibility(
            selected,
          );

          setRecords(
            recordBody.records ??
              [],
          );
        } catch (error) {
          setResponsibility(
            null,
          );

          setRecords([]);

          setError(
            error instanceof Error
              ? error.message
              : "Unable to load Responsibility records.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        responsibilityKey,
        buildQuery,
      ],
    );

  useEffect(
    () => {
      void load();
    },
    [load],
  );

  const dashboardSurfaces =
    useMemo(
      () =>
        responsibility
          ? dashboardSurfacesFor(
              responsibility,
            )
          : [],
      [responsibility],
    );

  const handleDownload =
    useCallback(
      async () => {
        if (
          !responsibility
        ) {
          return;
        }

        setExporting(true);

        try {
          const query =
            buildQuery(
              responsibility.key,
              1000,
            );

          const body =
            await apiJson<{
              records:
                GenericRecord[];
            }>(
              `/api/appliance/records?${query.toString()}`,
            );

          const exportRecords =
            body.records ?? [];

          /*
           * BRIXTA_SHARED_INTERFACE_IR_V1
           *
           * CSV uses the SAME dashboard projection contract as
           * the visible dashboard. Computed values do not need to
           * pretend to be input fields.
           */
          const columns =
            dashboardColumnsFor(
              responsibility,
            );

          const headers = [
            "Employee",
            "Employee code",

            ...columns.map(
              (column) =>
                column.label,
            ),

            "Status",
            "Created at",
            "Updated at",
          ];

          const rows =
            exportRecords.map(
              (record) => [
                record.employeeName ??
                  "",

                record.employeeCode ??
                  "",

                ...columns.map(
                  (column) =>
                    resolveSurfaceColumnValue(
                      record,
                      column,
                    ),
                ),

                record.status,
                record.createdAt ??
                  "",
                record.updatedAt ??
                  "",
              ],
            );

          const datePart =
            new Date()
              .toISOString()
              .slice(
                0,
                10,
              );

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
          setExporting(
            false,
          );
        }
      },
      [
        responsibility,
        buildQuery,
      ],
    );

  const rendererLabel =
    dashboardSurfaces.length
      ? dashboardSurfaces
          .map(
            (surface) =>
              surface.renderer,
          )
          .join(" · ")
      : responsibility
          ?.definition.output
          .renderer ??
        "records";

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Work"
        title={
          responsibility?.title ??
          "Responsibility"
        }
        description={
          responsibility?.description ??
          "Records generated by this Responsibility. Inputs and outputs are projected from the published Responsibility interface."
        }
        action={
          <div className="flex items-center gap-2">
            {responsibility && (
              <Pill tone="info">
                {rendererLabel.replace(
                  /_/g,
                  " ",
                )}
              </Pill>
            )}

            <SecondaryButton
              type="button"
              onClick={() =>
                void handleDownload()
              }
              disabled={
                exporting ||
                !responsibility
              }
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
              onClick={() =>
                void load()
              }
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
        searchVal={
          searchQuery
        }
        dateRangeVal={
          dateRange
        }
        onSearchChange={
          setSearchQuery
        }
        onDateRangeChange={
          setDateRange
        }
      />

      {loading &&
      !responsibility ? (
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
              <div className="text-2xl font-semibold">
                {records.length}
              </div>
              <div className="text-sm text-muted-foreground">
                records
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-semibold">
                {
                  responsibility
                    .definition.input
                    .fields.length
                }
              </div>
              <div className="text-sm text-muted-foreground">
                collected inputs
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-semibold">
                {
                  dashboardSurfaces.length ||
                  1
                }
              </div>
              <div className="text-sm text-muted-foreground">
                dashboard outputs
              </div>
            </div>
          </div>

          {dashboardSurfaces.length ? (
            <div className="space-y-6">
              {dashboardSurfaces.map(
                (surface) => (
                  <section
                    key={
                      surface.id
                    }
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {
                            surface.label
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Published Responsibility output
                        </div>
                      </div>

                      <Pill>
                        {
                          surface.renderer
                        }
                      </Pill>
                    </div>

                    <RecordOutput
                      responsibility={
                        responsibility
                      }
                      records={
                        records
                      }
                      surface={
                        surface
                      }
                    />
                  </section>
                ),
              )}
            </div>
          ) : (
            <RecordOutput
              responsibility={
                responsibility
              }
              records={
                records
              }
            />
          )}
        </>
      ) : null}
    </div>
  );
}
