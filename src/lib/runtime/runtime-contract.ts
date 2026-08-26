export const RUNTIME_CONTRACT_VERSION = 1 as const;

export const RUNTIME_FIELD_KINDS = [
  "text", "long_text", "integer", "decimal", "boolean", "date", "datetime",
  "single_select", "multi_select", "reference", "photo", "file", "location", "signature",
] as const;

export type RuntimeFieldKind = (typeof RUNTIME_FIELD_KINDS)[number];

const CANONICAL = new Set<string>(RUNTIME_FIELD_KINDS);
const ALIASES: Record<string, RuntimeFieldKind> = {
  string:"text", text:"text", short_text:"text", textarea:"long_text", longtext:"long_text", long_text:"long_text",
  int:"integer", integer:"integer", whole_number:"integer",
  number:"decimal", numeric:"decimal", float:"decimal", double:"decimal", decimal:"decimal",
  bool:"boolean", boolean:"boolean", date:"date",
  datetime:"datetime", date_time:"datetime", timestamp:"datetime", time_stamp:"datetime",
  select:"single_select", dropdown:"single_select", choice:"single_select", single_select:"single_select", singleselect:"single_select",
  multiselect:"multi_select", multi_select:"multi_select", multi_choice:"multi_select",
  ref:"reference", reference:"reference", entity:"reference", entity_reference:"reference", reference_picker:"reference",
  image:"photo", camera:"photo", camera_capture:"photo", selfie:"photo", photo:"photo",
  attachment:"file", document:"file", upload:"file", file:"file",
  gps:"location", geo:"location", geo_point:"location", geopoint:"location", geolocation:"location", coordinates:"location", location:"location",
  sign:"signature", signature:"signature",
};

const EXPLICIT_TYPE_KEYS = new Set(["fieldType", "field_type", "captureType", "capture_type"]);
const AMBIGUOUS_TYPE_KEYS = new Set(["type", "kind"]);

function normKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\\s-]+/g, "_");
}

export function normalizeRuntimeFieldKind(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const k = normKey(value);
  return CANONICAL.has(k) ? k : (ALIASES[k] ?? value);
}

function looksFieldLike(obj: Record<string, unknown>): boolean {
  return "fieldType" in obj || "field_type" in obj || "captureType" in obj || "capture_type" in obj ||
    "required" in obj || "label" in obj || "options" in obj || "placeholder" in obj || "validation" in obj;
}

export function normalizeRuntimeContract<T>(input: T): T {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (value === null || typeof value !== "object") return value;
    const src = value as Record<string, unknown>;
    const fieldLike = looksFieldLike(src);
    const out: Record<string, unknown> = {};
    for (const [k, raw] of Object.entries(src)) {
      let next = visit(raw);
      if (EXPLICIT_TYPE_KEYS.has(k) || (fieldLike && AMBIGUOUS_TYPE_KEYS.has(k))) {
        next = normalizeRuntimeFieldKind(next);
      }
      out[k] = next;
    }
    return out;
  };
  return visit(input) as T;
}

export class RuntimeContractError extends Error {
  constructor(message: string) { super(message); this.name = "RuntimeContractError"; }
}

export function assertRuntimeContract(input: unknown): void {
  const errors: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) { value.forEach((v, i) => visit(v, `${path}[${i}]`)); return; }
    if (value === null || typeof value !== "object") return;
    const obj = value as Record<string, unknown>;
    const fieldLike = looksFieldLike(obj);
    for (const [k, raw] of Object.entries(obj)) {
      const p = `${path}.${k}`;
      if ((EXPLICIT_TYPE_KEYS.has(k) || (fieldLike && AMBIGUOUS_TYPE_KEYS.has(k))) && typeof raw === "string") {
        const n = normalizeRuntimeFieldKind(raw);
        if (n !== raw) errors.push(`${p}: non-canonical runtime kind \"${raw}\" -> \"${n}\"`);
        else if (!CANONICAL.has(normKey(raw))) errors.push(`${p}: unsupported runtime kind \"${raw}\"`);
      }
      visit(raw, p);
    }
  };
  visit(input, "$");
  if (errors.length) throw new RuntimeContractError(`BRIXTA runtime contract rejected the manifest:\n${errors.slice(0,25).map(e=>` - ${e}`).join("\n")}`);
}

export function enforceRuntimeContract<T>(input: T): T {
  const normalized = normalizeRuntimeContract(input);
  assertRuntimeContract(normalized);
  return normalized;
}
