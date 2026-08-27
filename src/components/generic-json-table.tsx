// src/components/generic-json-table.tsx
"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, ExternalLink } from "lucide-react";

import { DataTableReusable } from "@/components/data-table-reusable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type GenericJsonRow = Record<string, unknown> & {
  id: string | number;
};

export type GenericJsonColumn = {
  key: string;
  label?: string;
};

interface GenericJsonTableProps {
  data: GenericJsonRow[];
  title?: string;
  /**
   * Explicit column list + human labels. When omitted, columns are
   * auto-derived from the first row's own keys -- for genuinely
   * schema-less JSON. Passing this in (e.g. from a Responsibility's
   * field definitions) gives real labels instead of raw JSON keys.
   */
  columns?: GenericJsonColumn[];
  /** Keys to exclude entirely (e.g. internal ids). */
  hiddenKeys?: string[];
}

function formatHeader(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^https?:\/\//i.test(value)) return false;
  return (
    /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(value) ||
    value.includes("/storage/") ||
    value.includes("/photos/")
  );
}

function mediaUrlFromValue(value: unknown): string | null {
  if (isImageUrl(value)) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const url = (value as Record<string, unknown>).url;
    if (isImageUrl(url)) return url as string;
  }
  return null;
}

function pointFromValue(value: unknown): [number, number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const point = value as Record<string, unknown>;
  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(point.lng ?? point.longitude);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return [lat, lng];
  }
  return null;
}

function displayScalar(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (
      value.every((item) =>
        ["string", "number", "boolean"].includes(typeof item),
      )
    ) {
      return value.map(String).join(", ");
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  const point = pointFromValue(value);
  if (point) return `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`;
  return JSON.stringify(value);
}

function FieldPreview({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const media = mediaUrlFromValue(value);

  return (
    <div className="flex flex-col space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {media ? (
        <a
          href={media}
          target="_blank"
          rel="noreferrer"
          className="group relative block overflow-hidden rounded-md border border-border/50 bg-black/5"
        >
          <img
            src={media}
            alt={label}
            className="h-auto max-h-[360px] w-full object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink className="h-4 w-4 text-white" />
            <span className="text-xs font-medium text-white">
              View full image
            </span>
          </div>
        </a>
      ) : (
        <div className="flex min-h-9 items-center wrap-break-word rounded-md border border-border/50 bg-secondary/20 p-2 text-sm font-medium">
          {displayScalar(value)}
        </div>
      )}
    </div>
  );
}

export function GenericJsonTable({
  data,
  title,
  columns,
  hiddenKeys = ["id"],
}: GenericJsonTableProps) {
  const [selected, setSelected] = useState<GenericJsonRow | null>(null);

  const resolvedColumns = useMemo<Required<GenericJsonColumn>[]>(() => {
    const source =
      columns && columns.length
        ? columns
        : data.length
          ? Object.keys(data[0])
              .filter((key) => !hiddenKeys.includes(key))
              .map((key) => ({ key }))
          : [];

    return source.map((col:any) => ({
      key: col.key,
      label: col.label ?? formatHeader(col.key),
    }));
  }, [columns, data, hiddenKeys]);

  const tableColumns = useMemo<ColumnDef<GenericJsonRow>[]>(() => {
    const cols: ColumnDef<GenericJsonRow>[] = resolvedColumns.map((col) => ({
      id: col.key,
      header: col.label,
      cell: ({ row }) => {
        const value = row.original[col.key];
        const media = mediaUrlFromValue(value);
        if (media) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media}
              alt={col.label}
              className="h-10 w-10 rounded-md border border-border object-cover"
            />
          );
        }
        return (
          <span className="whitespace-nowrap">{displayScalar(value)}</span>
        );
      },
    }));

    cols.push({
      id: "__actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-blue-200 px-2 text-blue-600 shadow-sm hover:border-blue-300 hover:bg-blue-50"
          onClick={() => setSelected(row.original)}
        >
          <Eye className="mr-1 h-3.5 w-3.5" /> View
        </Button>
      ),
    });

    return cols;
  }, [resolvedColumns]);

  if (!data.length) return null;

  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-sm">
        <DataTableReusable columns={tableColumns} data={data} />
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
          <DialogTitle>Record details</DialogTitle>
          <DialogDescription>
            Full detail for this record, including any captured photos.
          </DialogDescription>

          {selected && (
            <>
              <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                {resolvedColumns.map((col) => (
                  <FieldPreview
                    key={col.key}
                    label={col.label}
                    value={selected[col.key]}
                  />
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => setSelected(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}