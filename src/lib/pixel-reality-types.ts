// BRIXTA_PIXEL_REALITY_V2
//
// Pixel Logic owns the operational reality INSIDE one Responsibility.
// It may declare business actors, relationships, states, actions, outputs,
// access intent and surface intent. It does NOT alter authentication,
// tenant isolation, platform secrets, database infrastructure or execute
// arbitrary source code.

import type {
  KernelActionKind,
  KernelCaptureKind,
  KernelContextSource,
  KernelObjectKind,
  KernelOutputKind,
} from "@/lib/responsibility-kernel-types";

import {
  parseResponsibilityUiDocument,
  type ResponsibilityUiDocument,
} from "@/lib/responsibility-ui-document";

export const PIXEL_REALITY_METADATA_KEY = "pixelReality";

export type PixelRealitySurface = "app" | "dashboard";

export type PixelRealityRecordScope =
  | "own"
  | "related"
  | "organization";

export type PixelRealityActorResolver =
  | { kind: "current_user" }
  | { kind: "record_creator" }
  | { kind: "specific_user"; userId?: number }
  | { kind: "role"; roleId?: number; roleLabel?: string }
  | { kind: "manager_of"; actorId: string }
  | { kind: "selected_reference"; referenceKey: string }
  | { kind: "query_result"; queryKey: string; path?: string }
  | {
      kind: "relationship";
      sourceActorId: string;
      relation: string;
    }
  | { kind: "system" };

export type PixelRealityActor = {
  id: string;
  label: string;
  resolver: PixelRealityActorResolver;
  surfaces: PixelRealitySurface[];
  recordScope?: PixelRealityRecordScope;
  description?: string;
  rationale?: string;
};

export type PixelRealityContext = {
  id: string;
  label: string;
  source: KernelContextSource;
  sourceKey?: string;
  path?: string;
  value?: unknown;
  mutable?: boolean;
  config?: Record<string, unknown>;
};

export type PixelRealityObject = {
  id: string;
  label: string;
  kind: KernelObjectKind;
  sourceKey?: string;
  description?: string;
};

export type PixelRealityState = {
  id: string;
  label: string;
  dimension?: string;
  initial?: boolean;
  terminal?: boolean;
  description?: string;
};

export type PixelRealityCapture = {
  id: string;
  label: string;
  kind: KernelCaptureKind;
  required?: boolean;
  storeAs?: string;
  config?: Record<string, unknown>;
};

export type PixelRealityAction = {
  id: string;
  label: string;
  kind: KernelActionKind;
  actorId?: string;
  objectId?: string;
  captureIds?: string[];
  availableState?: string;
  resultingState?: string;
  config?: Record<string, unknown>;
};

export type PixelRealityOutput = {
  id: string;
  label: string;
  kind: KernelOutputKind;
  actorIds: string[];
  stateIds?: string[];
  visibleKeys?: string[];
  surfaces?: PixelRealitySurface[];
  config?: Record<string, unknown>;
};

export type PixelRealityInterface = {
  /**
   * AUTHORING-TIME complete app UI document.
   *
   * Omit it to preserve the current App Builder UI.
   * When present, it replaces metadata.ui.uiDocument atomically with
   * Reality + Program on Save Logic / Publish.
   */
  appUiDocument?: ResponsibilityUiDocument;
};

export type PixelRealityProposal = {
  version: 1;
  actors: PixelRealityActor[];
  contexts: PixelRealityContext[];
  objects: PixelRealityObject[];
  states: PixelRealityState[];
  captures: PixelRealityCapture[];
  actions: PixelRealityAction[];
  outputs: PixelRealityOutput[];
  interface?: PixelRealityInterface;
  warnings: string[];
  notes: string[];
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(String).map((x) => x.trim()).filter(Boolean))]
    : [];
}

function surfaceArray(value: unknown): PixelRealitySurface[] {
  return stringArray(value).filter(
    (item): item is PixelRealitySurface =>
      item === "app" || item === "dashboard",
  );
}

export function blankPixelReality(): PixelRealityProposal {
  return {
    version: 1,
    actors: [],
    contexts: [],
    objects: [],
    states: [],
    captures: [],
    actions: [],
    outputs: [],
    interface: {},
    warnings: [],
    notes: [],
  };
}

export function normalizePixelReality(
  raw: unknown,
): PixelRealityProposal {
  const value = objectValue(raw);

  const actors: PixelRealityActor[] = Array.isArray(value.actors)
    ? value.actors.flatMap((item) => {
        const actor = objectValue(item);
        const resolver = objectValue(actor.resolver);
        const id = stringValue(actor.id);
        const label = stringValue(actor.label) || id;
        const kind = stringValue(resolver.kind);

        if (!id || !kind) return [];

        let normalizedResolver: PixelRealityActorResolver;

        switch (kind) {
          case "current_user":
            normalizedResolver = { kind: "current_user" };
            break;
          case "record_creator":
            normalizedResolver = { kind: "record_creator" };
            break;
          case "specific_user":
            normalizedResolver = {
              kind: "specific_user",
              userId:
                Number.isInteger(Number(resolver.userId)) &&
                Number(resolver.userId) > 0
                  ? Number(resolver.userId)
                  : undefined,
            };
            break;
          case "role":
            normalizedResolver = {
              kind: "role",
              roleId:
                Number.isInteger(Number(resolver.roleId)) &&
                Number(resolver.roleId) > 0
                  ? Number(resolver.roleId)
                  : undefined,
              roleLabel: stringValue(resolver.roleLabel) || undefined,
            };
            break;
          case "manager_of":
            normalizedResolver = {
              kind: "manager_of",
              actorId:
                stringValue(resolver.actorId) || "current_employee",
            };
            break;
          case "selected_reference":
            normalizedResolver = {
              kind: "selected_reference",
              referenceKey: stringValue(resolver.referenceKey),
            };
            break;
          case "query_result":
            normalizedResolver = {
              kind: "query_result",
              queryKey: stringValue(resolver.queryKey),
              path: stringValue(resolver.path) || undefined,
            };
            break;
          case "relationship":
            normalizedResolver = {
              kind: "relationship",
              sourceActorId:
                stringValue(resolver.sourceActorId) || "current_employee",
              relation: stringValue(resolver.relation) || "manager",
            };
            break;
          case "system":
            normalizedResolver = { kind: "system" };
            break;
          default:
            return [];
        }

        const rawScope = stringValue(actor.recordScope);
        const recordScope =
          rawScope === "own" ||
          rawScope === "related" ||
          rawScope === "organization"
            ? (rawScope as PixelRealityRecordScope)
            : undefined;

        return [{
          id,
          label,
          resolver: normalizedResolver,
          surfaces: surfaceArray(actor.surfaces),
          recordScope,
          description: stringValue(actor.description) || undefined,
          rationale: stringValue(actor.rationale) || undefined,
        }];
      })
    : [];

  const contexts: PixelRealityContext[] = Array.isArray(value.contexts)
    ? value.contexts.flatMap((item) => {
        const x = objectValue(item);
        const id = stringValue(x.id);
        const source = stringValue(x.source) as KernelContextSource;
        if (!id || !source) return [];
        return [{
          id,
          label: stringValue(x.label) || id,
          source,
          sourceKey: stringValue(x.sourceKey) || undefined,
          path: stringValue(x.path) || undefined,
          value: x.value,
          mutable: x.mutable === true,
          config: objectValue(x.config),
        }];
      })
    : [];

  const objects: PixelRealityObject[] = Array.isArray(value.objects)
    ? value.objects.flatMap((item) => {
        const x = objectValue(item);
        const id = stringValue(x.id);
        const kind = stringValue(x.kind) as KernelObjectKind;
        if (!id || !kind) return [];
        return [{
          id,
          label: stringValue(x.label) || id,
          kind,
          sourceKey: stringValue(x.sourceKey) || undefined,
          description: stringValue(x.description) || undefined,
        }];
      })
    : [];

  const states: PixelRealityState[] = Array.isArray(value.states)
    ? value.states.flatMap((item) => {
        const x = objectValue(item);
        const id = stringValue(x.id);
        if (!id) return [];
        return [{
          id,
          label: stringValue(x.label) || id,
          dimension: stringValue(x.dimension) || "process",
          initial: x.initial === true,
          terminal: x.terminal === true,
          description: stringValue(x.description) || undefined,
        }];
      })
    : [];

  const captures: PixelRealityCapture[] = Array.isArray(value.captures)
    ? value.captures.flatMap((item) => {
        const x = objectValue(item);
        const id = stringValue(x.id);
        const kind = stringValue(x.kind) as KernelCaptureKind;
        if (!id || !kind) return [];
        return [{
          id,
          label: stringValue(x.label) || id,
          kind,
          required: x.required === true,
          storeAs: stringValue(x.storeAs) || undefined,
          config: objectValue(x.config),
        }];
      })
    : [];

  const actions: PixelRealityAction[] = Array.isArray(value.actions)
    ? value.actions.flatMap((item) => {
        const x = objectValue(item);
        const id = stringValue(x.id);
        const kind = stringValue(x.kind) as KernelActionKind;
        if (!id || !kind) return [];
        return [{
          id,
          label: stringValue(x.label) || id,
          kind,
          actorId: stringValue(x.actorId) || undefined,
          objectId: stringValue(x.objectId) || undefined,
          captureIds: stringArray(x.captureIds),
          availableState: stringValue(x.availableState) || undefined,
          resultingState: stringValue(x.resultingState) || undefined,
          config: objectValue(x.config),
        }];
      })
    : [];

  const outputs: PixelRealityOutput[] = Array.isArray(value.outputs)
    ? value.outputs.flatMap((item) => {
        const x = objectValue(item);
        const id = stringValue(x.id);
        const kind = stringValue(x.kind) as KernelOutputKind;
        if (!id || !kind) return [];
        return [{
          id,
          label: stringValue(x.label) || id,
          kind,
          actorIds: stringArray(x.actorIds),
          stateIds: stringArray(x.stateIds),
          visibleKeys: stringArray(x.visibleKeys),
          surfaces: surfaceArray(x.surfaces),
          config: objectValue(x.config),
        }];
      })
    : [];

  const interfaceValue =
    objectValue(
      value.interface,
    );

  const appUiDocument =
    interfaceValue.appUiDocument ===
      undefined
      ? undefined
      : parseResponsibilityUiDocument(
          interfaceValue.appUiDocument,
        );

  return {
    version: 1,
    actors,
    contexts,
    objects,
    states,
    captures,
    actions,
    outputs,
    interface: {
      ...(appUiDocument
        ? { appUiDocument }
        : {}),
    },
    warnings: stringArray(value.warnings),
    notes: stringArray(value.notes),
  };
}
