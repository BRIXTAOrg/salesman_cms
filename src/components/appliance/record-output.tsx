"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { GenericJsonTable } from "@/components/generic-json-table";
import type {
  GenericRecord,
  Responsibility,
  ResponsibilityField,
} from "@/lib/appliance-types";
import {
  formatDateTime,
} from "./client";
import {
  EmptyState,
  Panel,
  Pill,
  Stat,
} from "./primitives";

const RecordMap = dynamic(
  () => import("./record-map"),
  { ssr: false },
);

type Props = {
  responsibility: Responsibility;
  records: GenericRecord[];
};

function objectValue(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mediaUrl(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  const media = objectValue(value);
  return typeof media.url === "string"
    ? media.url
    : null;
}

function pointValue(value: unknown) {
  const point = objectValue(value);
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
    return [lat, lng] as [number, number];
  }

  return null;
}

function routeValue(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(pointValue)
    .filter((point): point is [number, number] => Boolean(point));
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
      return value.map(String).join(", ");
    }
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  const media = mediaUrl(value);
  if (media) return media;

  const point = pointValue(value);
  if (point) return `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`;

  return JSON.stringify(value);
}

function fieldsFor(
  responsibility: Responsibility,
) {
  return responsibility.definition.input.fields ?? [];
}

function person(record: GenericRecord) {
  return (
    record.employeeName ??
    record.employeeCode ??
    `Employee ${record.userId}`
  );
}

/**
 * Shared renderer for every "just show me the records" output kind
 * (table, cards, detail, timeline). Rows are built from the
 * Responsibility's own field definitions, so columns are auto-derived
 * with real labels instead of raw JSON keys, photo/media values render
 * as thumbnails, and every row gets an Actions -> View column that opens
 * a full detail dialog with large image previews.
 */
function RecordListTable({
  responsibility,
  records,
}: Props) {
  const fields = fieldsFor(responsibility);

  const columns = useMemo(
    () => [
      { key: "employee", label: "Employee" },
      ...fields.map((field: ResponsibilityField) => ({
        key: field.key,
        label: field.label,
      })),
      { key: "status", label: "Status" },
      { key: "updatedAt", label: "Updated" },
    ],
    [fields],
  );

  const rows = useMemo(
    () =>
      records.map((record) => ({
        id: record.id,
        employee: person(record),
        status: record.status,
        updatedAt: formatDateTime(record.updatedAt ?? record.createdAt),
        ...Object.fromEntries(
          fields.map((field) => [field.key, record.payload[field.key]]),
        ),
      })),
    [records, fields],
  );

  return (
    <GenericJsonTable
      data={rows}
      columns={columns}
    />
  );
}

function MetricOutput({
  responsibility,
  records,
}: Props) {
  const config = objectValue(responsibility.definition.output.config);
  const numericFields = fieldsFor(responsibility).filter((field) =>
    ["number", "integer"].includes(field.dataType),
  );
  const key =
    typeof config.metricField === "string"
      ? config.metricField
      : numericFields[0]?.key;
  const field = fieldsFor(responsibility).find((item) => item.key === key);
  const values = key
    ? records
        .map((record) => Number(record.payload[key]))
        .filter(Number.isFinite)
    : [];
  const aggregation =
    typeof config.aggregation === "string"
      ? config.aggregation
      : "sum";

  const value =
    aggregation === "count"
      ? records.length
      : aggregation === "average"
        ? values.length
          ? values.reduce((sum, item) => sum + item, 0) / values.length
          : 0
        : values.reduce((sum, item) => sum + item, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat
        value={Number.isInteger(value) ? value : value.toFixed(2)}
        label={field?.label ?? "Records"}
        hint={aggregation}
      />
      <Stat value={records.length} label="Records" />
      <Stat
        value={new Set(records.map((record) => record.userId)).size}
        label="Employees"
      />
    </div>
  );
}

function SnapshotOutput(props: Props) {
  const latest = props.records[0];
  if (!latest) return null;
  return (
    <RecordListTable
      responsibility={props.responsibility}
      records={[latest]}
    />
  );
}

function geoField(
  fields: ResponsibilityField[],
) {
  return fields.find((field) => field.dataType === "geo_point");
}

function routeField(
  fields: ResponsibilityField[],
) {
  return fields.find(
    (field) =>
      field.inputType === "location_route" ||
      field.config?.semanticType === "route",
  );
}

function MapPointsOutput({
  responsibility,
  records,
}: Props) {
  const config = objectValue(responsibility.definition.output.config);
  const fields = fieldsFor(responsibility);
  const key =
    typeof config.pointField === "string"
      ? config.pointField
      : geoField(fields)?.key;

  const points = key
    ? records
        .map((record) => ({
          id: record.id,
          position: pointValue(record.payload[key]),
          title: person(record),
          subtitle: formatDateTime(record.updatedAt ?? record.createdAt),
        }))
        .filter(
          (item): item is {
            id: string;
            position: [number, number];
            title: string;
            subtitle: string;
          } => Boolean(item.position),
        )
    : [];

  if (!points.length) {
    return (
      <EmptyState
        title="No map points"
        description="This output renderer needs a geo_point field with recorded coordinates."
      />
    );
  }

  return (
    <Panel className="overflow-hidden p-0">
      <RecordMap points={points} />
    </Panel>
  );
}

function MapRouteOutput({
  responsibility,
  records,
}: Props) {
  const config = objectValue(responsibility.definition.output.config);
  const fields = fieldsFor(responsibility);
  const key =
    typeof config.routeField === "string"
      ? config.routeField
      : routeField(fields)?.key;

  const routes = key
    ? records
        .map((record) => ({
          id: record.id,
          positions: routeValue(record.payload[key]),
          title: person(record),
        }))
        .filter((item) => item.positions.length > 1)
    : [];

  if (!routes.length) {
    return (
      <EmptyState
        title="No routes"
        description="This renderer needs a location_route field containing at least two coordinates."
      />
    );
  }

  return (
    <Panel className="overflow-hidden p-0">
      <RecordMap routes={routes} />
    </Panel>
  );
}

function GalleryOutput({
  responsibility,
  records,
}: Props) {
  const fields = fieldsFor(responsibility).filter(
    (field) => field.dataType === "media",
  );
  const images = records.flatMap((record) =>
    fields.flatMap((field) => {
      const value = record.payload[field.key];
      const values = Array.isArray(value) ? value : [value];
      return values
        .map(mediaUrl)
        .filter((url): url is string => Boolean(url))
        .map((url) => ({
          url,
          label: field.label,
          record,
        }));
    }),
  );

  if (!images.length) {
    return (
      <EmptyState
        title="No media"
        description="Photo, file, signature or audio values will appear here when records contain media URLs."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {images.map((image, index) => (
        <Panel key={`${image.record.id}:${image.url}:${index}`} className="overflow-hidden p-0">
          <img
            src={image.url}
            alt={image.label}
            className="aspect-square w-full object-cover"
          />
          <div className="p-3">
            <div className="text-sm font-medium">{image.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{person(image.record)}</div>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function NodeGraphOutput({
  responsibility,
  records,
}: Props) {
  const config = objectValue(responsibility.definition.output.config);
  const labelField =
    typeof config.labelField === "string"
      ? config.labelField
      : fieldsFor(responsibility)[0]?.key;

  return (
    <Panel>
      <div className="mb-4 text-sm text-muted-foreground">
        Generic node projection. Configure a future graph renderer with explicit node/edge fields without changing the record API.
      </div>
      <div className="flex flex-wrap gap-3">
        {records.map((record) => (
          <div
            key={record.id}
            className="min-w-44 rounded-lg border bg-muted/20 px-4 py-3"
          >
            <div className="font-medium">
              {labelField
                ? displayValue(record.payload[labelField])
                : person(record)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {record.id.slice(0, 8)} · {record.status}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function RecordOutput(props: Props) {
  if (props.records.length === 0) {
    return (
      <EmptyState
        title="No records yet"
        description="This surface exists because the Responsibility is active. Records will appear here when the runtime creates them."
      />
    );
  }

  switch (props.responsibility.definition.output.renderer) {
    case "metric":
      return <MetricOutput {...props} />;
    case "snapshot":
      return <SnapshotOutput {...props} />;
    case "map_points":
      return <MapPointsOutput {...props} />;
    case "map_route":
      return <MapRouteOutput {...props} />;
    case "gallery":
      return <GalleryOutput {...props} />;
    case "node_graph":
      return <NodeGraphOutput {...props} />;
    case "detail":
    case "cards":
    case "timeline":
    case "table":
    default:
      return <RecordListTable {...props} />;
  }
}