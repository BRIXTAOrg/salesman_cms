"use client";

import {
  useMemo,
} from "react";
import dynamic from "next/dynamic";

import {
  GenericJsonTable,
} from "@/components/generic-json-table";

import type {
  GenericRecord,
  Responsibility,
  ResponsibilitySurfaceDefinition,
} from "@/lib/appliance-types";

import {
  formatSurfaceValue,
  resolveSurfaceBinding,
  resolveSurfaceColumnValue,
  surfaceColumnsFor,
  type ResponsibilitySurfaceBinding,
} from "@/lib/responsibility-surface-projection";

import {
  formatDateTime,
} from "./client";

import {
  EmptyState,
  Panel,
  Stat,
} from "./primitives";

const RecordMap =
  dynamic(
    () =>
      import(
        "./record-map"
      ),
    {
      ssr: false,
    },
  );

type Props = {
  responsibility:
    Responsibility;

  records:
    GenericRecord[];

  surface?:
    ResponsibilitySurfaceDefinition;
};

function objectValue(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
    ? value as
        Record<
          string,
          unknown
        >
    : {};
}

function mediaUrl(
  value: unknown,
) {
  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  const media =
    objectValue(value);

  return typeof media.url ===
    "string"
    ? media.url
    : null;
}

function pointValue(
  value: unknown,
) {
  const point =
    objectValue(value);

  const lat =
    Number(
      point.lat ??
        point.latitude,
    );

  const lng =
    Number(
      point.lng ??
        point.longitude,
    );

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return [
      lat,
      lng,
    ] as [
      number,
      number,
    ];
  }

  return null;
}

function routeValue(
  value: unknown,
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .map(pointValue)
    .filter(
      (
        point,
      ): point is [
        number,
        number,
      ] =>
        Boolean(point),
    );
}

function person(
  record: GenericRecord,
) {
  return (
    record.employeeName ??
    record.employeeCode ??
    `Employee ${record.userId}`
  );
}

function configFor(
  props: Props,
) {
  return props.surface
    ?.config ??
    props.responsibility
      .definition.output
      .config ??
    {};
}

function rendererFor(
  props: Props,
) {
  return (
    props.surface
      ?.renderer ??
    props.responsibility
      .definition.output
      .renderer ??
    "table"
  );
}

function bindingFromConfig(
  raw: unknown,
  fallback?:
    ResponsibilitySurfaceBinding,
): ResponsibilitySurfaceBinding | undefined {
  const value =
    objectValue(raw);

  const scope =
    typeof value.scope ===
      "string"
      ? value.scope
      : "";

  if (
    scope === "capture" ||
    scope === "computed" ||
    scope === "context" ||
    scope === "state" ||
    scope === "record" ||
    scope === "actor" ||
    scope === "query" ||
    scope === "literal"
  ) {
    return {
      scope,
      key:
        typeof value.key ===
          "string"
          ? value.key
          : undefined,
      path:
        typeof value.path ===
          "string"
          ? value.path
          : undefined,
      value:
        scope === "literal"
          ? value.value
          : undefined,
    };
  }

  return fallback;
}

function RecordListTable(
  props: Props,
) {
  const columns =
    useMemo(
      () =>
        surfaceColumnsFor(
          props.responsibility,
          props.surface,
        ),
      [
        props.responsibility,
        props.surface,
      ],
    );

  const tableColumns =
    useMemo(
      () => [
        {
          key:
            "employee",
          label:
            "Employee",
        },

        ...columns.map(
          (column) => ({
            key:
              column.key,
            label:
              column.label,
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
      [columns],
    );

  const rows =
    useMemo(
      () =>
        props.records.map(
          (record) => ({
            id:
              record.id,

            employee:
              person(record),

            ...Object.fromEntries(
              columns.map(
                (column) => [
                  column.key,
                  resolveSurfaceColumnValue(
                    record,
                    column,
                  ),
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
        props.records,
        columns,
      ],
    );

  return (
    <GenericJsonTable
      data={rows}
      columns={
        tableColumns
      }
    />
  );
}

function MetricOutput(
  props: Props,
) {
  const config =
    objectValue(
      configFor(
        props,
      ),
    );

  const columns =
    surfaceColumnsFor(
      props.responsibility,
      props.surface,
    );

  const binding =
    bindingFromConfig(
      config.metricBinding,
      columns[0]?.binding,
    );

  const values =
    binding
      ? props.records
          .map(
            (record) =>
              Number(
                resolveSurfaceBinding(
                  record,
                  binding,
                ),
              ),
          )
          .filter(
            Number.isFinite,
          )
      : [];

  const aggregation =
    typeof config.aggregation ===
      "string"
      ? config.aggregation
      : "sum";

  const value =
    aggregation === "count"
      ? props.records.length
      : aggregation ===
          "average"
        ? values.length
          ? values.reduce(
              (
                sum,
                item,
              ) =>
                sum +
                item,
              0,
            ) /
            values.length
          : 0
        : aggregation ===
            "min"
          ? (
              values.length
                ? Math.min(
                    ...values,
                  )
                : 0
            )
          : aggregation ===
              "max"
            ? (
                values.length
                  ? Math.max(
                      ...values,
                    )
                  : 0
              )
            : values.reduce(
                (
                  sum,
                  item,
                ) =>
                  sum +
                  item,
                0,
              );

  const format =
    objectValue(
      config.format,
    );

  const presented =
    formatSurfaceValue(
      value,
      {
        kind:
          typeof format.kind ===
            "string"
            ? format.kind as
                | "text"
                | "number"
                | "currency"
                | "percent"
                | "date"
                | "datetime"
                | "boolean"
            : "number",

        currency:
          typeof format.currency ===
            "string"
            ? format.currency
            : undefined,

        decimals:
          Number.isInteger(
            Number(
              format.decimals,
            ),
          )
            ? Number(
                format.decimals,
              )
            : undefined,
      },
    );

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat
        value={
          String(
            presented ??
              0,
          )
        }
        label={
          typeof config.metricLabel ===
            "string"
            ? config.metricLabel
            : (
                columns[0]
                  ?.label ??
                props.surface
                  ?.label ??
                "Metric"
              )
        }
        hint={
          aggregation
        }
      />

      <Stat
        value={
          props.records.length
        }
        label="Records"
      />

      <Stat
        value={
          new Set(
            props.records.map(
              (record) =>
                record.userId,
            ),
          ).size
        }
        label="Employees"
      />
    </div>
  );
}

function SnapshotOutput(
  props: Props,
) {
  const latest =
    props.records[0];

  if (!latest) {
    return null;
  }

  return (
    <RecordListTable
      {...props}
      records={[
        latest,
      ]}
    />
  );
}

function MapPointsOutput(
  props: Props,
) {
  const config =
    objectValue(
      configFor(
        props,
      ),
    );

  const columns =
    surfaceColumnsFor(
      props.responsibility,
      props.surface,
    );

  const binding =
    bindingFromConfig(
      config.pointBinding,
      columns[0]?.binding,
    );

  const points =
    binding
      ? props.records
          .map(
            (record) => ({
              id:
                record.id,

              position:
                pointValue(
                  resolveSurfaceBinding(
                    record,
                    binding,
                  ),
                ),

              title:
                person(
                  record,
                ),

              subtitle:
                formatDateTime(
                  record.updatedAt ??
                    record.createdAt,
                ),
            }),
          )
          .filter(
            (
              item,
            ): item is {
              id: string;
              position: [
                number,
                number,
              ];
              title: string;
              subtitle: string;
            } =>
              Boolean(
                item.position,
              ),
          )
      : [];

  if (
    !points.length
  ) {
    return (
      <EmptyState
        title="No map points"
        description="This output needs a binding that resolves to latitude/longitude data."
      />
    );
  }

  return (
    <Panel className="overflow-hidden p-0">
      <RecordMap
        points={
          points
        }
      />
    </Panel>
  );
}

function MapRouteOutput(
  props: Props,
) {
  const config =
    objectValue(
      configFor(
        props,
      ),
    );

  const columns =
    surfaceColumnsFor(
      props.responsibility,
      props.surface,
    );

  const binding =
    bindingFromConfig(
      config.routeBinding,
      columns[0]?.binding,
    );

  const routes =
    binding
      ? props.records
          .map(
            (record) => ({
              id:
                record.id,

              positions:
                routeValue(
                  resolveSurfaceBinding(
                    record,
                    binding,
                  ),
                ),

              title:
                person(
                  record,
                ),
            }),
          )
          .filter(
            (item) =>
              item.positions.length >
              1,
          )
      : [];

  if (
    !routes.length
  ) {
    return (
      <EmptyState
        title="No routes"
        description="This output needs a binding that resolves to a route/coordinate array."
      />
    );
  }

  return (
    <Panel className="overflow-hidden p-0">
      <RecordMap
        routes={
          routes
        }
      />
    </Panel>
  );
}

function GalleryOutput(
  props: Props,
) {
  const columns =
    surfaceColumnsFor(
      props.responsibility,
      props.surface,
    );

  const images =
    props.records.flatMap(
      (record) =>
        columns.flatMap(
          (column) => {
            const raw =
              resolveSurfaceBinding(
                record,
                column.binding,
              );

            const values =
              Array.isArray(raw)
                ? raw
                : [raw];

            return values
              .map(mediaUrl)
              .filter(
                (
                  url,
                ): url is string =>
                  Boolean(url),
              )
              .map(
                (url) => ({
                  url,
                  label:
                    column.label,
                  record,
                }),
              );
          },
        ),
    );

  if (
    !images.length
  ) {
    return (
      <EmptyState
        title="No media"
        description="The configured output bindings do not contain media yet."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {images.map(
        (
          image,
          index,
        ) => (
          <Panel
            key={`${image.record.id}:${image.url}:${index}`}
            className="overflow-hidden p-0"
          >
            <img
              src={
                image.url
              }
              alt={
                image.label
              }
              className="aspect-square w-full object-cover"
            />

            <div className="p-3">
              <div className="text-sm font-medium">
                {
                  image.label
                }
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                {
                  person(
                    image.record,
                  )
                }
              </div>
            </div>
          </Panel>
        ),
      )}
    </div>
  );
}

function NodeGraphOutput(
  props: Props,
) {
  const config =
    objectValue(
      configFor(
        props,
      ),
    );

  const columns =
    surfaceColumnsFor(
      props.responsibility,
      props.surface,
    );

  const binding =
    bindingFromConfig(
      config.labelBinding,
      columns[0]?.binding,
    );

  return (
    <Panel>
      <div className="mb-4 text-sm text-muted-foreground">
        Generic node projection from the published output binding.
      </div>

      <div className="flex flex-wrap gap-3">
        {props.records.map(
          (record) => (
            <div
              key={
                record.id
              }
              className="min-w-44 rounded-lg border bg-muted/20 px-4 py-3"
            >
              <div className="font-medium">
                {
                  binding
                    ? String(
                        resolveSurfaceBinding(
                          record,
                          binding,
                        ) ??
                          "—",
                      )
                    : person(
                        record,
                      )
                }
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                {
                  record.id.slice(
                    0,
                    8,
                  )
                }{" "}
                ·{" "}
                {
                  record.status
                }
              </div>
            </div>
          ),
        )}
      </div>
    </Panel>
  );
}

export default function RecordOutput(
  props: Props,
) {
  if (
    props.records.length ===
    0
  ) {
    return (
      <EmptyState
        title="No records yet"
        description="This output is active. Values will appear when the runtime creates matching records."
      />
    );
  }

  switch (
    rendererFor(
      props,
    )
  ) {
    case "metric":
    case "chart":
      return (
        <MetricOutput
          {...props}
        />
      );

    case "snapshot":
      return (
        <SnapshotOutput
          {...props}
        />
      );

    case "map_points":
    case "map":
      return (
        <MapPointsOutput
          {...props}
        />
      );

    case "map_route":
    case "route":
      return (
        <MapRouteOutput
          {...props}
        />
      );

    case "gallery":
      return (
        <GalleryOutput
          {...props}
        />
      );

    case "node_graph":
      return (
        <NodeGraphOutput
          {...props}
        />
      );

    case "detail":
    case "card":
    case "cards":
    case "list":
    case "timeline":
    case "table":
    case "calendar":
    case "document":
    case "receipt":
    case "dashboard":
    case "notification":
    default:
      return (
        <RecordListTable
          {...props}
        />
      );
  }
}
