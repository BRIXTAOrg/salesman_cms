"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Archive, Loader2, RefreshCw } from "lucide-react";

import type { GenericRecord, Responsibility } from "@/lib/appliance-types";

import { apiJson } from "./client";

import RecordOutput from "./record-output";

import { EmptyState, PageIntro, Pill, SecondaryButton } from "./primitives";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default function ArchivedResponsibilityClient({
  responsibilityKey,
}: {
  responsibilityKey: string;
}) {
  const [responsibility, setResponsibility] = useState<Responsibility | null>(
    null,
  );

  const [records, setRecords] = useState<GenericRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const archiveBody = await apiJson<{
        responsibilities: Responsibility[];
      }>("/api/appliance/archived-responsibilities");

      const normalizedKey = decodeURIComponent(responsibilityKey)
        .trim()
        .toLowerCase();

      const selected = (archiveBody.responsibilities ?? []).find(
        (item) => item.key.toLowerCase() === normalizedKey,
      );

      if (!selected) {
        throw new Error("Archived Responsibility not found.");
      }

      /*
       * IMPORTANT:
       *
       * /records queries dynamic_submissions by capability ID and does
       * not require the Responsibility to be active.
       *
       * status=all means historical records are shown even if a record
       * itself was later marked deleted.
       */
      const recordBody = await apiJson<{
        records: GenericRecord[];
      }>(
        `/api/appliance/records?responsibilityKey=${encodeURIComponent(
          selected.key,
        )}&status=all&limit=1000`,
      );

      setResponsibility(selected);

      setRecords(recordBody.records ?? []);
    } catch (error) {
      setResponsibility(null);

      setRecords([]);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load archived Responsibility.",
      );
    } finally {
      setLoading(false);
    }
  }, [responsibilityKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const employeeCount = useMemo(
    () => new Set(records.map((record) => record.userId)).size,
    [records],
  );

  const deletedAt = responsibility
    ? objectValue(responsibility.config).__brixtaDeletedAt
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 md:p-6">
      <PageIntro
        eyebrow="Archived Responsibility"
        title={responsibility?.title ?? "Archived Responsibility"}
        description={
          responsibility
            ? (responsibility.description ??
              "Historical Responsibility data. This Responsibility is no longer delivered to employee apps.")
            : "Historical Responsibility data."
        }
        action={
          <div className="flex items-center gap-2">
            <Pill tone="warning">
              <Archive className="h-3.5 w-3.5" />
              Archived
            </Pill>

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

      {deletedAt ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-sm">
          Archived on{" "}
          <span className="font-medium">
            {new Date(String(deletedAt)).toLocaleString()}
          </span>
          . Employee runtime assignments were removed, but submitted records
          remain preserved.
        </div>
      ) : null}

      {loading && !responsibility ? (
        <div className="flex h-64 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <EmptyState title="Archived data unavailable" description={error} />
      ) : responsibility ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-semibold">{records.length}</div>
              <div className="text-sm text-muted-foreground">
                historical records
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-semibold">{employeeCount}</div>
              <div className="text-sm text-muted-foreground">
                employees represented
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-semibold">Read-only history</div>
              <div className="text-sm text-muted-foreground">
                Stored in dynamic_submissions
              </div>
            </div>
          </div>

          {records.length ? (
            <RecordOutput responsibility={responsibility} records={records} />
          ) : (
            <EmptyState
              title="No historical submissions"
              description="This Responsibility was archived without any submitted records."
            />
          )}
        </>
      ) : null}
    </div>
  );
}
