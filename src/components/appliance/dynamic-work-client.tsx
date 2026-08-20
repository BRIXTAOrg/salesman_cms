"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Loader2,
  RefreshCw,
} from "lucide-react";

import type {
  Capability,
} from "@/lib/appliance-types";

import {
  apiJson,
  formatDateTime,
} from "./client";

import {
  EmptyState,
  PageIntro,
  Panel,
  SecondaryButton,
} from "./primitives";

type Submission = {
  id: string;
  status: string;
  payload:
    Record<string, unknown>;
  submittedAt?: string | null;
  userId: number;
  employeeName?: string | null;
  employeeCode?: string | null;
};

export default function DynamicWorkClient({
  capabilityKey,
}: {
  capabilityKey: string;
}) {
  const [
    capability,
    setCapability,
  ] = useState<Capability | null>(
    null,
  );

  const [
    submissions,
    setSubmissions,
  ] = useState<Submission[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        const body =
          await apiJson<{
            capability:
              Capability;
            submissions:
              Submission[];
          }>(
            `/api/workspace/work/${encodeURIComponent(capabilityKey)}`,
          );

        setCapability(
          body.capability,
        );

        setSubmissions(
          body.submissions ??
            [],
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load responsibility.",
        );
      } finally {
        setLoading(false);
      }
    },
    [capabilityKey],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[1500px] p-6">
      <PageIntro
        eyebrow="Work"
        title={
          capability?.title ??
          "Responsibility"
        }
        description={
          capability?.description ??
          "Operational activity generated from an active responsibility."
        }
        action={
          <SecondaryButton
            type="button"
            onClick={() =>
              void load()
            }
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </SecondaryButton>
        }
      />

      <div className="mt-8">
        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <EmptyState
            title="Work surface unavailable"
            description={error}
          />
        ) : submissions.length ===
          0 ? (
          <EmptyState
            title="No submissions yet"
            description="This surface exists because the responsibility is active. Employee submissions will appear here as they are created."
          />
        ) : (
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3">
                      Employee
                    </th>
                    <th className="px-3 py-3">
                      Status
                    </th>
                    <th className="px-3 py-3">
                      Submitted
                    </th>
                    <th className="px-3 py-3">
                      Data
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {submissions.map(
                    (submission) => (
                      <tr
                        key={
                          submission.id
                        }
                        className="border-b last:border-b-0"
                      >
                        <td className="px-3 py-4 font-medium">
                          {submission.employeeName ??
                            submission.employeeCode ??
                            `Employee ${submission.userId}`}
                        </td>

                        <td className="px-3 py-4">
                          {
                            submission.status
                          }
                        </td>

                        <td className="px-3 py-4 text-muted-foreground">
                          {formatDateTime(
                            submission.submittedAt,
                          )}
                        </td>

                        <td className="max-w-[520px] px-3 py-4">
                          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs">
                            {JSON.stringify(
                              submission.payload,
                              null,
                              2,
                            )}
                          </pre>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
