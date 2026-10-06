"use client";

/*
 * BRIXTA_RESPONSIBILITY_RECORDS_ADMIN_V1
 *
 * One generic admin record surface for every Responsibility.
 *
 * This is deliberately INSIDE Responsibilities rather than another sidebar
 * destination.
 *
 * Read:
 *   dynamic_submissions
 *     -> /api/appliance/records
 *     -> GenericJsonTable
 *
 * Write:
 *   Admin edits capture payload keys only.
 *   Kernel/system metadata (__state, __source, __assignment, etc.) stays
 *   protected by the backend.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";

import {
  SearchSelect,
} from "@/components/search-select";

import {
  GenericJsonTable,
  type GenericJsonColumn,
  type GenericJsonRow,
} from "@/components/generic-json-table";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

import type {
  GenericRecord,
  Responsibility,
  ResponsibilityField,
} from "@/lib/appliance-types";

import {
  apiJson,
  formatDateTime,
} from "./client";

import {
  EmptyState,
} from "./primitives";


function editorText(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "object"
  ) {
    return JSON.stringify(
      value,
      null,
      2,
    );
  }

  return String(
    value,
  );
}


function booleanField(
  field: ResponsibilityField,
) {
  return (
    field.dataType ===
      "boolean" ||
    field.inputType ===
      "toggle" ||
    field.inputType ===
      "checkbox"
  );
}


function numericField(
  field: ResponsibilityField,
) {
  return (
    [
      "number",
      "integer",
      "float",
      "currency",
      "amount",
    ].includes(
      field.dataType,
    ) ||
    [
      "number",
      "currency",
    ].includes(
      field.inputType,
    )
  );
}


function optionsFor(
  field: ResponsibilityField,
) {
  const options =
    field.config?.options;

  if (
    !Array.isArray(
      options,
    )
  ) {
    return [];
  }

  return options
    .map(
      (item) => {
        if (
          typeof item ===
            "string" ||
          typeof item ===
            "number"
        ) {
          return String(
            item,
          );
        }

        if (
          item &&
          typeof item ===
            "object" &&
          !Array.isArray(
            item,
          )
        ) {
          const object =
            item as Record<
              string,
              unknown
            >;

          return String(
            object.value ??
            object.label ??
            "",
          );
        }

        return "";
      },
    )
    .filter(Boolean);
}


function parseEditedValue(
  field: ResponsibilityField,
  raw: string,
  original: unknown,
): unknown {
  if (
    booleanField(
      field,
    )
  ) {
    return raw ===
      "true";
  }

  if (
    numericField(
      field,
    )
  ) {
    if (
      !raw.trim()
    ) {
      return null;
    }

    const value =
      Number(
        raw,
      );

    if (
      !Number.isFinite(
        value,
      )
    ) {
      throw new Error(
        `${field.label} must be a valid number.`,
      );
    }

    return value;
  }

  if (
    Array.isArray(
      original,
    ) ||
    (
      original &&
      typeof original ===
        "object"
    )
  ) {
    if (
      !raw.trim()
    ) {
      return null;
    }

    try {
      return JSON.parse(
        raw,
      );
    } catch {
      throw new Error(
        `${field.label} contains structured data. Enter valid JSON.`,
      );
    }
  }

  return raw;
}


export default function ResponsibilityRecordsClient() {
  const [
    responsibilities,
    setResponsibilities,
  ] =
    useState<
      Responsibility[]
    >(
      [],
    );

  const [
    responsibilityKey,
    setResponsibilityKey,
  ] =
    useState("");

  const [
    records,
    setRecords,
  ] =
    useState<
      GenericRecord[]
    >(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    editing,
    setEditing,
  ] =
    useState<
      GenericRecord | null
    >(
      null,
    );

  const [
    draft,
    setDraft,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {},
    );


  const responsibility =
    useMemo(
      () =>
        responsibilities.find(
          (item) =>
            item.key ===
            responsibilityKey,
        ) ??
        null,
      [
        responsibilities,
        responsibilityKey,
      ],
    );


  const fields =
    useMemo(
      () =>
        responsibility
          ?.definition
          .input
          .fields ??
        [],
      [
        responsibility,
      ],
    );


  const loadResponsibilities =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const body =
            await apiJson<{
              responsibilities:
                Responsibility[];
            }>(
              "/api/appliance/responsibilities",
            );

          const active =
            (
              body.responsibilities ??
              []
            ).filter(
              (item) =>
                item.isActive !==
                false,
            );

          setResponsibilities(
            active,
          );

          setResponsibilityKey(
            (current) =>
              current &&
              active.some(
                (item) =>
                  item.key ===
                  current,
              )
                ? current
                : (
                    active[0]
                      ?.key ??
                    ""
                  ),
          );
        } catch (
          error
        ) {
          setMessage(
            error instanceof
              Error
              ? error.message
              : "Unable to load Responsibilities.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );


  const loadRecords =
    useCallback(
      async () => {
        if (
          !responsibilityKey
        ) {
          setRecords(
            [],
          );
          return;
        }

        setLoading(
          true,
        );

        try {
          const query =
            new URLSearchParams({
              responsibilityKey,
              limit:
                "500",
            });

          const body =
            await apiJson<{
              records:
                GenericRecord[];
            }>(
              `/api/appliance/records?${query.toString()}`,
            );

          setRecords(
            body.records ??
              [],
          );

          setMessage(
            null,
          );
        } catch (
          error
        ) {
          setRecords(
            [],
          );

          setMessage(
            error instanceof
              Error
              ? error.message
              : "Unable to load submitted records.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        responsibilityKey,
      ],
    );


  useEffect(
    () => {
      void loadResponsibilities();
    },
    [
      loadResponsibilities,
    ],
  );


  useEffect(
    () => {
      if (
        responsibilityKey
      ) {
        void loadRecords();
      }
    },
    [
      responsibilityKey,
      loadRecords,
    ],
  );


  const columns =
    useMemo<
      GenericJsonColumn[]
    >(
      () => [
        {
          key:
            "employee",
          label:
            "Employee",
        },

        ...fields.map(
          (field) => ({
            key:
              field.key,
            label:
              field.label,
          }),
        ),

        {
          key:
            "status",
          label:
            "Status",
        },

        {
          key:
            "updatedAt",
          label:
            "Updated",
        },
      ],
      [
        fields,
      ],
    );


  const rows =
    useMemo<
      GenericJsonRow[]
    >(
      () =>
        records.map(
          (record) => ({
            id:
              record.id,

            employee:
              record.employeeName ??
              record.employeeCode ??
              `Employee ${record.userId}`,

            ...Object.fromEntries(
              fields.map(
                (field) => [
                  field.key,
                  record.payload?.[
                    field.key
                  ],
                ],
              ),
            ),

            status:
              record.status,

            updatedAt:
              formatDateTime(
                record.updatedAt ??
                record.createdAt,
              ),
          }),
        ),
      [
        records,
        fields,
      ],
    );


  const filteredRows =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (
          !query
        ) {
          return rows;
        }

        return rows.filter(
          (row) =>
            JSON.stringify(
              row,
            )
              .toLowerCase()
              .includes(
                query,
              ),
        );
      },
      [
        rows,
        search,
      ],
    );


  function openEdit(
    row: GenericJsonRow,
  ) {
    const record =
      records.find(
        (item) =>
          item.id ===
          String(
            row.id,
          ),
      );

    if (
      !record
    ) {
      return;
    }

    setEditing(
      record,
    );

    setDraft(
      Object.fromEntries(
        fields.map(
          (field) => [
            field.key,
            editorText(
              record.payload?.[
                field.key
              ],
            ),
          ],
        ),
      ),
    );

    setMessage(
      null,
    );
  }


  async function saveEdit() {
    if (
      !editing
    ) {
      return;
    }

    if (
      !Number.isInteger(
        editing.serverVersion,
      )
    ) {
      setMessage(
        "This record has no server version. Refresh before editing.",
      );
      return;
    }

    setSaving(
      true,
    );

    try {
      const payload =
        Object.fromEntries(
          fields.map(
            (field) => [
              field.key,
              parseEditedValue(
                field,
                draft[
                  field.key
                ] ??
                  "",
                editing.payload?.[
                  field.key
                ],
              ),
            ],
          ),
        );

      const body =
        await apiJson<{
          record:
            GenericRecord;
        }>(
          `/api/appliance/records/${encodeURIComponent(editing.id)}`,
          {
            method:
              "PATCH",

            body:
              JSON.stringify({
                payload,
                expectedServerVersion:
                  editing.serverVersion,
              }),
          },
        );

      setRecords(
        (current) =>
          current.map(
            (record) =>
              record.id ===
                editing.id
                ? {
                    ...record,
                    ...body.record,
                  }
                : record,
          ),
      );

      setEditing(
        null,
      );

      setMessage(
        "Record updated. The change was written to the Responsibility record and audited.",
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to update record.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-[#E1E4E0] bg-white">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
          <div className="w-full lg:w-[320px]">
            <SearchSelect
              options={
                responsibilities.map(
                  (item) => ({
                    label:
                      item.title,
                    value:
                      item.key,
                  }),
                )
              }
              value={
                responsibilityKey
              }
              placeholder="Choose a responsibility"
              searchPlaceholder="Search responsibilities"
              onChange={(
                value,
              ) => {
                const next =
                  Array.isArray(
                    value,
                  )
                    ? value[0]
                    : value;

                setResponsibilityKey(
                  next ??
                    "",
                );
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <input
              type="search"
              value={
                search
              }
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search submitted data..."
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[#2F6B62]/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="whitespace-nowrap text-sm text-muted-foreground">
              {
                records.length
              }{" "}
              record{
                records.length ===
                  1
                  ? ""
                  : "s"
              }
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              disabled={
                loading ||
                !responsibilityKey
              }
              onClick={() =>
                void loadRecords()
              }
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>


      <div className="rounded-[14px] border border-[#E1E4E0] bg-white p-4">
        <div className="mb-4">
          <div className="text-[16px] font-semibold text-[#1D2321]">
            Salesman input
          </div>

          <div className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Submitted values for this Responsibility. Admin edits change
            captured payload values only; employee identity, assignment,
            Kernel state and BRIXTA system metadata remain protected.
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            {
              message
            }
          </div>
        )}

        {loading &&
        !records.length ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredRows.length ? (
          <GenericJsonTable
            data={
              filteredRows
            }
            columns={
              columns
            }
            onEditRow={
              openEdit
            }
          />
        ) : (
          <EmptyState
            title={
              search
                ? "No matching records"
                : "No submitted data yet"
            }
            description={
              search
                ? "Try a different search."
                : "Salesman submissions for this Responsibility will appear here automatically."
            }
          />
        )}
      </div>


      <Dialog
        open={
          Boolean(
            editing,
          )
        }
        onOpenChange={(
          open,
        ) => {
          if (
            !open &&
            !saving
          ) {
            setEditing(
              null,
            );
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
          <DialogTitle>
            Edit submitted data
          </DialogTitle>

          <DialogDescription>
            Correct captured employee values. BRIXTA system fields are not editable here.
          </DialogDescription>

          {editing && (
            <div className="space-y-4 pt-2">
              <div className="grid gap-3 rounded-lg border bg-muted/15 p-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Employee
                  </div>
                  <div className="font-medium">
                    {
                      editing.employeeName ??
                      editing.employeeCode ??
                      `Employee ${editing.userId}`
                    }
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    Status
                  </div>
                  <div className="font-medium">
                    {
                      editing.status
                    }
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    Version
                  </div>
                  <div className="font-medium">
                    {
                      editing.serverVersion ??
                      "—"
                    }
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {fields.map(
                  (field) => {
                    const original =
                      editing.payload?.[
                        field.key
                      ];

                    const options =
                      optionsFor(
                        field,
                      );

                    const complex =
                      Array.isArray(
                        original,
                      ) ||
                      (
                        original &&
                        typeof original ===
                          "object"
                      );

                    return (
                      <div
                        key={
                          field.key
                        }
                        className={
                          complex
                            ? "md:col-span-2"
                            : ""
                        }
                      >
                        <label className="mb-1.5 block text-sm font-medium">
                          {
                            field.label
                          }
                        </label>

                        {booleanField(
                          field,
                        ) ? (
                          <select
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={
                              draft[
                                field.key
                              ] ??
                              "false"
                            }
                            onChange={(
                              event,
                            ) =>
                              setDraft(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [
                                    field.key
                                  ]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          >
                            <option value="true">
                              Yes
                            </option>
                            <option value="false">
                              No
                            </option>
                          </select>
                        ) : (
                          options.length > 0 &&
                          field.inputType ===
                            "select"
                        ) ? (
                          <select
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={
                              draft[
                                field.key
                              ] ??
                              ""
                            }
                            onChange={(
                              event,
                            ) =>
                              setDraft(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [
                                    field.key
                                  ]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          >
                            <option value="">
                              —
                            </option>

                            {options.map(
                              (
                                option,
                              ) => (
                                <option
                                  key={
                                    option
                                  }
                                  value={
                                    option
                                  }
                                >
                                  {
                                    option
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        ) : complex ? (
                          <textarea
                            rows={
                              7
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                            value={
                              draft[
                                field.key
                              ] ??
                              ""
                            }
                            onChange={(
                              event,
                            ) =>
                              setDraft(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [
                                    field.key
                                  ]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          />
                        ) : (
                          <input
                            type={
                              numericField(
                                field,
                              )
                                ? "number"
                                : "text"
                            }
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={
                              draft[
                                field.key
                              ] ??
                              ""
                            }
                            onChange={(
                              event,
                            ) =>
                              setDraft(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [
                                    field.key
                                  ]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          />
                        )}
                      </div>
                    );
                  },
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    setEditing(
                      null,
                    )
                  }
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void saveEdit()
                  }
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save correction
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
