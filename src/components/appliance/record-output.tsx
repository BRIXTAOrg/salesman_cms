"use client";

import dynamic from "next/dynamic";

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

function TableOutput({
  responsibility,
  records,
}: Props) {
  const fields = fieldsFor(responsibility);

  return (
    <Panel className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-muted/45 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              {fields.map((field) => (
                <th key={field.key} className="px-4 py-3 font-medium">
                  {field.label}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((record) => (
              <tr key={record.id} className="align-top">
                <td className="px-4 py-4 font-medium">{person(record)}</td>
                {fields.map((field) => (
                  <td key={field.key} className="max-w-[320px] px-4 py-4">
                    <div className="line-clamp-4 break-words">
                      {displayValue(record.payload[field.key])}
                    </div>
                  </td>
                ))}
                <td className="px-4 py-4">
                  <Pill>{record.status}</Pill>
                </td>
                <td className="px-4 py-4 text-muted-foreground">
                  {formatDateTime(record.updatedAt ?? record.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CardsOutput({
  responsibility,
  records,
}: Props) {
  const fields = fieldsFor(responsibility);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {records.map((record) => (
        <Panel key={record.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{person(record)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(record.updatedAt ?? record.createdAt)}
              </div>
            </div>
            <Pill>{record.status}</Pill>
          </div>
          <dl className="mt-5 space-y-3">
            {fields.map((field) => (
              <div key={field.key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="mt-1 break-words text-sm">
                  {displayValue(record.payload[field.key])}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}
    </div>
  );
}

function DetailOutput({
  responsibility,
  records,
}: Props) {
  const fields = fieldsFor(responsibility);

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <Panel key={record.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">{person(record)}</div>
              <div className="text-xs text-muted-foreground">
                Record {record.id}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Pill>{record.status}</Pill>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(record.updatedAt ?? record.createdAt)}
              </span>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="rounded-md border p-3">
                <dt className="text-xs font-medium text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="mt-1 break-words text-sm">
                  {displayValue(record.payload[field.key])}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}
    </div>
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
    <DetailOutput
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

function TimelineOutput({
  responsibility,
  records,
}: Props) {
  const fields = fieldsFor(responsibility);

  return (
    <Panel>
      <div className="space-y-0">
        {records.map((record, index) => (
          <div key={record.id} className="relative flex gap-4 pb-6 last:pb-0">
            {index < records.length - 1 && (
              <div className="absolute left-[7px] top-4 h-[calc(100%-4px)] w-px bg-border" />
            )}
            <div className="relative mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-background bg-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium">{person(record)}</div>
                <Pill>{record.status}</Pill>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(record.updatedAt ?? record.createdAt)}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {fields.slice(0, 3).map((field) => (
                  <span key={field.key} className="mr-3">
                    <strong className="font-medium text-foreground">{field.label}:</strong>{" "}
                    {displayValue(record.payload[field.key])}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
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
    case "detail":
      return <DetailOutput {...props} />;
    case "cards":
      return <CardsOutput {...props} />;
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
    case "timeline":
      return <TimelineOutput {...props} />;
    case "node_graph":
      return <NodeGraphOutput {...props} />;
    case "table":
    default:
      return <TableOutput {...props} />;
  }
}
