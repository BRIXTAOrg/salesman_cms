"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  AlignCenter,
  BadgeIcon,
  BarChart3,
  Boxes,
  CircleGauge,
  Columns3,
  GripVertical,
  ImageIcon,
  Layers3,
  LayoutList,
  MousePointerClick,
  MoveVertical,
  PanelTop,
  Play,
  RectangleHorizontal,
  Rows3,
  Sparkles,
  Trash2,
  Type,
  WandSparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { ResponsibilityKernel } from "@/lib/responsibility-kernel-types";

import {
  RESPONSIBILITY_UI_BLOCK_REGISTRY,
  type ResponsibilityUiAnimationPreset,
  type ResponsibilityUiBinding,
  type ResponsibilityUiBlock,
  type ResponsibilityUiBlockDefinition,
  type ResponsibilityUiBlockType,
  type ResponsibilityUiDocument,
} from "@/lib/responsibility-ui-document";

import { cx } from "./client";

import { Field, inputClass, Panel } from "./primitives";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function randomKey(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}

function humanize(value: string) {
  return value
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function visualIcon(type: ResponsibilityUiBlockType): LucideIcon {
  if (type === "layout.column") {
    return Columns3;
  }

  if (type === "layout.row") {
    return Rows3;
  }

  if (type === "layout.stack") {
    return Layers3;
  }

  if (type === "display.text") {
    return Type;
  }

  if (type === "display.value") {
    return AlignCenter;
  }

  if (type === "display.counter") {
    return CircleGauge;
  }

  if (type === "display.metric") {
    return BarChart3;
  }

  if (type === "display.progress") {
    return MoveVertical;
  }

  if (type === "display.badge") {
    return BadgeIcon;
  }

  if (type === "interaction.action_button") {
    return MousePointerClick;
  }

  if (type === "overlay.banner") {
    return RectangleHorizontal;
  }

  if (type === "overlay.fullscreen") {
    return PanelTop;
  }

  if (type === "media.image") {
    return ImageIcon;
  }

  if (type === "animation.lottie") {
    return Play;
  }

  if (type === "spacing.spacer") {
    return MoveVertical;
  }

  if (type === "spacing.divider") {
    return LayoutList;
  }

  return Boxes;
}

export function ensureVisualDocument(
  kernel: ResponsibilityKernel,
): ResponsibilityUiDocument {
  return clone(
    kernel.metadata.ui?.uiDocument ?? {
      version: 1,

      engine: "brixta_stac_v1",

      rootIds: [],

      blocks: [],
    },
  );
}

function withDocument(
  kernel: ResponsibilityKernel,
  document: ResponsibilityUiDocument,
) {
  const next = clone(kernel);

  next.metadata = {
    ...next.metadata,

    ui: {
      ...(next.metadata.ui ?? {
        layout: [],
      }),

      uiDocument: document,
    },
  };

  return next;
}

function computedKeys(kernel: ResponsibilityKernel) {
  const keys = new Set<string>();

  for (const rule of kernel.rules) {
    for (const effect of rule.effects) {
      if (effect.kind === "set_computed" && effect.targetKey) {
        keys.add(effect.targetKey);
      }
    }
  }

  return [...keys];
}

export type VisualBindingOption = {
  value: string;
  label: string;
};

export function visualBindingOptions(
  kernel: ResponsibilityKernel,
): VisualBindingOption[] {
  const options: VisualBindingOption[] = [];

  for (const item of kernel.possibilities) {
    if (item.type !== "capture") {
      continue;
    }

    options.push({
      value: `capture:${item.capture.storeAs ?? item.capture.id}`,

      label: `${item.capture.label} · captured`,
    });
  }

  for (const key of computedKeys(kernel)) {
    options.push({
      value: `computed:${key}`,

      label: `${humanize(key)} · calculated`,
    });
  }

  for (const context of kernel.runtimeWorld.contexts) {
    options.push({
      value: `context:${context.id}`,

      label: `${context.label} · app context`,
    });
  }

  options.push({
    value: "state:process",

    label: "Current process state",
  });

  return options;
}

function encodeBinding(binding: ResponsibilityUiBinding | undefined) {
  if (!binding) {
    return "";
  }

  if (binding.scope === "literal") {
    return "literal:";
  }

  return `${binding.scope}:${binding.key ?? ""}`;
}

function decodeBinding(value: string): ResponsibilityUiBinding | undefined {
  if (!value) {
    return undefined;
  }

  const [scope, ...rest] = value.split(":");

  const key = rest.join(":");

  if (
    scope === "capture" ||
    scope === "computed" ||
    scope === "context" ||
    scope === "state" ||
    scope === "record" ||
    scope === "actor"
  ) {
    return {
      scope,
      key,
    };
  }

  return undefined;
}

function defaultBinding(kernel: ResponsibilityKernel) {
  const options = visualBindingOptions(kernel);

  return decodeBinding(options[0]?.value ?? "");
}

function defaultVisibility(kernel: ResponsibilityKernel) {
  const terminal = kernel.runtimeWorld.states.find(
    (state) => state.terminal === true,
  );

  if (!terminal) {
    return undefined;
  }

  return {
    binding: {
      scope: "state" as const,

      key: "process",
    },

    operator: "eq" as const,

    value: terminal.id,
  };
}

export function addVisualBlock(
  kernel: ResponsibilityKernel,
  type: ResponsibilityUiBlockType,
  index?: number,
): {
  kernel: ResponsibilityKernel;
  id: string;
} {
  const definition = RESPONSIBILITY_UI_BLOCK_REGISTRY.find(
    (item) => item.type === type,
  );

  if (!definition) {
    throw new Error(`Unknown visual block "${type}".`);
  }

  const document = ensureVisualDocument(kernel);

  const id = randomKey(
    type.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, ""),
  );

  const block: ResponsibilityUiBlock = {
    id,

    type,

    config: clone(definition.defaultConfig),
  };

  if (definition.allowsBinding) {
    block.binding = defaultBinding(kernel);
  }

  if (definition.allowsAction) {
    block.actionId =
      kernel.possibilities.find((item) => item.type === "action")?.type ===
      "action"
        ? (
            kernel.possibilities.find(
              (item) => item.type === "action",
            ) as Extract<
              (typeof kernel.possibilities)[number],
              {
                type: "action";
              }
            >
          ).action.id
        : undefined;
  }

  if (type === "overlay.fullscreen") {
    block.visibility = defaultVisibility(kernel);
  }

  document.blocks.push(block);

  const position = Math.max(
    0,
    Math.min(index ?? document.rootIds.length, document.rootIds.length),
  );

  document.rootIds.splice(position, 0, id);

  return {
    kernel: withDocument(kernel, document),

    id,
  };
}

export function reorderVisualRoots(
  kernel: ResponsibilityKernel,
  activeId: string,
  overId: string,
) {
  const document = ensureVisualDocument(kernel);

  const from = document.rootIds.indexOf(activeId);

  const to = document.rootIds.indexOf(overId);

  if (from < 0 || to < 0 || from === to) {
    return kernel;
  }

  const [moved] = document.rootIds.splice(from, 1);

  document.rootIds.splice(to, 0, moved);

  return withDocument(kernel, document);
}

export function patchVisualBlock(
  kernel: ResponsibilityKernel,
  blockId: string,
  patch: Partial<ResponsibilityUiBlock>,
) {
  const document = ensureVisualDocument(kernel);

  document.blocks = document.blocks.map((block) =>
    block.id === blockId
      ? {
          ...block,
          ...patch,

          config: patch.config
            ? {
                ...block.config,
                ...patch.config,
              }
            : block.config,
        }
      : block,
  );

  return withDocument(kernel, document);
}

function childReferences(document: ResponsibilityUiDocument) {
  const references = new Set<string>();

  for (const block of document.blocks) {
    for (const child of block.children ?? []) {
      references.add(child);
    }
  }

  return references;
}

export function setVisualChildren(
  kernel: ResponsibilityKernel,
  parentId: string,
  children: string[],
) {
  const document = ensureVisualDocument(kernel);

  const previous =
    document.blocks.find((block) => block.id === parentId)?.children ?? [];

  document.blocks = document.blocks.map((block) =>
    block.id === parentId
      ? {
          ...block,

          children: [...new Set(children.filter((id) => id !== parentId))],
        }
      : block,
  );

  /*
   * Children stop being top-level phone blocks.
   */
  const selected = new Set(children);

  document.rootIds = document.rootIds.filter((id) => !selected.has(id));

  /*
   * If a former child was removed and isn't owned by another layout block,
   * promote it back to the root instead of making it disappear.
   */
  const references = childReferences(document);

  for (const oldChild of previous) {
    if (
      !selected.has(oldChild) &&
      !references.has(oldChild) &&
      !document.rootIds.includes(oldChild)
    ) {
      document.rootIds.push(oldChild);
    }
  }

  return withDocument(kernel, document);
}

export function deleteVisualBlock(
  kernel: ResponsibilityKernel,
  blockId: string,
) {
  const document = ensureVisualDocument(kernel);

  const deleting = document.blocks.find((block) => block.id === blockId);

  document.blocks = document.blocks.filter((block) => block.id !== blockId);

  document.rootIds = document.rootIds.filter((id) => id !== blockId);

  for (const block of document.blocks) {
    if (block.children?.includes(blockId)) {
      block.children = block.children.filter((id) => id !== blockId);
    }
  }

  /*
   * Don't destroy nested children when deleting their layout container.
   */
  const references = childReferences(document);

  for (const child of deleting?.children ?? []) {
    if (!references.has(child) && !document.rootIds.includes(child)) {
      document.rootIds.push(child);
    }
  }

  return withDocument(kernel, document);
}

function paletteMatches(
  definition: ResponsibilityUiBlockDefinition,
  query: string,
) {
  const q = query.trim().toLowerCase();

  if (!q) {
    return ["Display", "Interaction", "Overlay"].includes(definition.category);
  }

  const haystack = [
    definition.label,
    definition.description,
    definition.category,
    definition.type,
    ...definition.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function PaletteVisualBlock({
  definition,
  onAdd,
}: {
  definition: ResponsibilityUiBlockDefinition;
  onAdd: () => void;
}) {
  const Icon = visualIcon(definition.type);

  const draggable = useDraggable({
    id: `visual-palette:${definition.type}`,
  });

  return (
    <div
      ref={draggable.setNodeRef}
      {...draggable.attributes}
      {...draggable.listeners}
      className={cx(
        "group cursor-grab rounded-xl border bg-background p-3 transition hover:border-primary/40 hover:bg-muted/20 active:cursor-grabbing",
        draggable.isDragging && "opacity-50",
      )}
      onDoubleClick={onAdd}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg border bg-muted/20 p-2">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{definition.label}</div>

          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {definition.description}
          </div>

          <button
            type="button"
            className="mt-2 text-[10px] font-medium text-primary opacity-70 hover:opacity-100"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onAdd();
            }}
          >
            + Add to phone
          </button>
        </div>
      </div>
    </div>
  );
}

export function VisualPaletteSection({
  query,
  onAdd,
}: {
  query: string;
  onAdd: (type: ResponsibilityUiBlockType) => void;
}) {
  const matches = RESPONSIBILITY_UI_BLOCK_REGISTRY.filter((definition) =>
    paletteMatches(definition, query),
  );

  if (matches.length === 0) {
    return null;
  }

  const categories = [
    "Display",
    "Interaction",
    "Overlay",
    "Layout",
    "Media",
    "Animation",
    "Spacing",
    "Advanced",
  ] as const;

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const items = matches.filter((item) => item.category === category);

        if (items.length === 0) {
          return null;
        }

        return (
          <div key={category}>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Visual · {category}
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <PaletteVisualBlock
                  key={item.type}
                  definition={item}
                  onAdd={() => onAdd(item.type)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function previewBinding(binding: ResponsibilityUiBinding | undefined) {
  if (!binding) {
    return "—";
  }

  if (binding.scope === "literal") {
    return String(binding.value ?? "");
  }

  if (binding.scope === "state") {
    return "state";
  }

  const key = binding.key ?? "value";

  if (
    binding.scope === "computed" &&
    (key.includes("count") || key.includes("score"))
  ) {
    return "0";
  }

  return humanize(key);
}

function previewAnimationClass(
  preset: ResponsibilityUiAnimationPreset | undefined,
) {
  if (preset === "pulse") {
    return "animate-pulse";
  }

  if (preset === "shake") {
    return "animate-bounce";
  }

  if (preset === "scale" || preset === "fade_scale") {
    return "transition-transform hover:scale-[1.02]";
  }

  return "";
}

function VisualPreviewBlock({
  block,
  map,
}: {
  block: ResponsibilityUiBlock;
  map: Map<string, ResponsibilityUiBlock>;
}) {
  const config = block.config ?? {};

  const children = (block.children ?? [])
    .map((id) => map.get(id))
    .filter((child): child is ResponsibilityUiBlock => Boolean(child));

  const animationClass = previewAnimationClass(block.animation?.preset);

  if (block.type === "layout.column") {
    return (
      <div
        className={cx(
          "space-y-3 rounded-2xl border border-dashed p-3",
          animationClass,
        )}
      >
        {children.length ? (
          children.map((child) => (
            <VisualPreviewBlock key={child.id} block={child} map={map} />
          ))
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Empty column
          </div>
        )}
      </div>
    );
  }

  if (block.type === "layout.row") {
    return (
      <div
        className={cx(
          "flex gap-2 rounded-2xl border border-dashed p-3",
          animationClass,
        )}
      >
        {children.length ? (
          children.map((child) => (
            <div key={child.id} className="min-w-0 flex-1">
              <VisualPreviewBlock block={child} map={map} />
            </div>
          ))
        ) : (
          <div className="w-full py-8 text-center text-xs text-muted-foreground">
            Empty row
          </div>
        )}
      </div>
    );
  }

  if (block.type === "layout.stack") {
    return (
      <div
        className={cx(
          "relative min-h-32 rounded-2xl border border-dashed p-3",
          animationClass,
        )}
      >
        {children.map((child) => (
          <VisualPreviewBlock key={child.id} block={child} map={map} />
        ))}

        {!children.length && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Empty stack
          </div>
        )}
      </div>
    );
  }

  if (block.type === "display.text") {
    const size = String(config.size ?? "body");

    return (
      <div
        className={cx(
          size === "hero"
            ? "text-4xl font-black tracking-tight"
            : size === "large"
              ? "text-2xl font-bold"
              : size === "title"
                ? "text-xl font-bold"
                : "text-base font-medium",

          String(config.alignment ?? "") === "center" && "text-center",

          animationClass,
        )}
      >
        {String(config.text ?? "Text")}
      </div>
    );
  }

  if (
    block.type === "display.value" ||
    block.type === "display.counter" ||
    block.type === "display.metric"
  ) {
    const value = previewBinding(block.binding);

    return (
      <div
        className={cx(
          "rounded-2xl border bg-muted/[0.10] p-5",
          String(config.alignment ?? "") === "center" && "text-center",
          animationClass,
        )}
      >
        <div
          className={cx(
            block.type === "display.counter"
              ? "text-6xl font-black tracking-[-0.08em]"
              : block.type === "display.metric"
                ? "text-4xl font-black tracking-tight"
                : "text-xl font-semibold",
          )}
        >
          {String(config.prefix ?? "")}
          {value}
          {String(config.suffix ?? "")}
        </div>
      </div>
    );
  }

  if (block.type === "display.progress") {
    return (
      <div className="space-y-2">
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[45%] rounded-full bg-primary" />
        </div>

        <div className="text-[10px] text-muted-foreground">
          {previewBinding(block.binding)}
        </div>
      </div>
    );
  }

  if (block.type === "display.badge") {
    return (
      <span className="inline-flex rounded-full border bg-muted/30 px-3 py-1 text-xs font-semibold">
        {previewBinding(block.binding)}
      </span>
    );
  }

  if (block.type === "interaction.action_button") {
    return (
      <button
        type="button"
        className={cx(
          "w-full rounded-xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-sm",
          animationClass,
        )}
      >
        {String(config.label ?? "Continue")}
      </button>
    );
  }

  if (block.type === "overlay.banner") {
    return (
      <div
        className={cx(
          "rounded-2xl border bg-primary/10 p-5 text-center text-xl font-black",
          animationClass,
        )}
      >
        {String(config.text ?? "Done!")}
      </div>
    );
  }

  if (block.type === "overlay.fullscreen") {
    return (
      <div
        className={cx(
          "flex min-h-[360px] items-center justify-center rounded-[2rem] p-8 text-center text-5xl font-black tracking-[-0.06em]",
          animationClass,
        )}
        style={{
          backgroundColor: String(config.background ?? "#111111"),

          color: String(config.foreground ?? "#FFFFFF"),
        }}
      >
        {String(config.text ?? "DONE!")}
      </div>
    );
  }

  if (block.type === "media.image") {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-2xl border bg-muted/10">
        <ImageIcon className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }

  if (block.type === "animation.lottie") {
    return (
      <div
        className={cx(
          "flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10",
          animationClass,
        )}
      >
        <WandSparkles className="h-10 w-10" />

        <div className="mt-3 text-xs font-medium">Lottie animation</div>
      </div>
    );
  }

  if (block.type === "spacing.spacer") {
    return (
      <div
        className="rounded border border-dashed"
        style={{
          height: Number(config.height ?? 16),
        }}
      />
    );
  }

  if (block.type === "spacing.divider") {
    return <div className="border-t" />;
  }

  return (
    <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
      Stac widget
    </div>
  );
}

function SortableVisualRoot({
  block,
  blockMap,
  selected,
  onSelect,
}: {
  block: ResponsibilityUiBlock;
  blockMap: Map<string, ResponsibilityUiBlock>;
  selected: boolean;
  onSelect: () => void;
}) {
  const sortable = useSortable({
    id: `visual:${block.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(sortable.transform),

    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cx(
        "group relative rounded-2xl border-2 border-transparent p-1 transition",
        selected && "border-primary/40 bg-primary/[0.03]",
        sortable.isDragging && "opacity-50",
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        className="absolute -left-7 top-3 z-20 rounded-md border bg-background p-1 opacity-0 shadow-sm transition group-hover:opacity-100"
        {...sortable.attributes}
        {...sortable.listeners}
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <VisualPreviewBlock block={block} map={blockMap} />
    </div>
  );
}

export function VisualPhoneCanvas({
  kernel,
  selectedId,
  onSelect,
}: {
  kernel: ResponsibilityKernel;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const document = ensureVisualDocument(kernel);

  const droppable = useDroppable({
    id: "visual-phone-canvas",
  });

  const map = new Map(document.blocks.map((block) => [block.id, block]));

  const roots = document.rootIds
    .map((id) => map.get(id))
    .filter((block): block is ResponsibilityUiBlock => Boolean(block));

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <div className="overflow-hidden rounded-[2.7rem] border-[7px] border-foreground/90 bg-background shadow-xl">
        <div className="flex h-7 items-center justify-center bg-foreground/90">
          <div className="h-2 w-20 rounded-full bg-background/20" />
        </div>

        <div className="border-b px-5 py-4">
          <div className="text-sm font-semibold">
            {kernel.metadata.ui?.title ?? "Employee app"}
          </div>

          <div className="mt-0.5 text-[10px] text-muted-foreground">
            Visual UI · live builder
          </div>
        </div>

        <div
          ref={droppable.setNodeRef}
          className={cx(
            "min-h-[620px] bg-background px-8 py-8 transition",
            droppable.isOver && "bg-primary/[0.035]",
          )}
        >
          <SortableContext
            items={roots.map((block) => `visual:${block.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-5">
              {roots.map((block) => (
                <SortableVisualRoot
                  key={block.id}
                  block={block}
                  blockMap={map}
                  selected={selectedId === block.id}
                  onSelect={() => onSelect(block.id)}
                />
              ))}

              {!roots.length && (
                <div className="flex min-h-[500px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed p-8 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />

                  <div className="mt-4 text-sm font-semibold">
                    Drop visual blocks here
                  </div>

                  <div className="mt-1 max-w-56 text-xs leading-relaxed text-muted-foreground">
                    Build a real application surface — text, counters, buttons,
                    metrics, layouts, banners and animation.
                  </div>
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>
    </div>
  );
}

function patchConfig(
  kernel: ResponsibilityKernel,
  block: ResponsibilityUiBlock,
  patch: Record<string, unknown>,
) {
  return patchVisualBlock(kernel, block.id, {
    config: {
      ...block.config,
      ...patch,
    },
  });
}

export function VisualBlockInspector({
  kernel,
  block,
  onChange,
  onDelete,
}: {
  kernel: ResponsibilityKernel;
  block: ResponsibilityUiBlock;
  onChange: (kernel: ResponsibilityKernel) => void;
  onDelete: () => void;
}) {
  const definition = RESPONSIBILITY_UI_BLOCK_REGISTRY.find(
    (item) => item.type === block.type,
  );

  const bindings = visualBindingOptions(kernel);

  const actions = kernel.possibilities.filter(
    (
      item,
    ): item is Extract<
      (typeof kernel.possibilities)[number],
      {
        type: "action";
      }
    > => item.type === "action",
  );

  const document = ensureVisualDocument(kernel);

  const possibleChildren = document.blocks.filter(
    (item) => item.id !== block.id,
  );

  const supportsChildren = definition?.allowsChildren === true;

  const supportsBinding = definition?.allowsBinding === true;

  const supportsAction = definition?.allowsAction === true;

  function update(patch: Partial<ResponsibilityUiBlock>) {
    onChange(patchVisualBlock(kernel, block.id, patch));
  }

  function config(patch: Record<string, unknown>) {
    onChange(patchConfig(kernel, block, patch));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">
            {definition?.label ?? humanize(block.type)}
          </div>

          <div className="text-xs text-muted-foreground">
            Visual block · {humanize(block.type)}
          </div>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-xl border bg-primary/[0.025] p-3 text-xs leading-relaxed text-muted-foreground">
        This controls presentation only. Business calculations and workflow
        remain in Pixel Logic.
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Type className="h-3.5 w-3.5" />
          Look
        </div>

        {["display.text", "overlay.banner", "overlay.fullscreen"].includes(
          block.type,
        ) && (
          <Field label="Text">
            <input
              className={inputClass}
              value={String(block.config.text ?? "")}
              onChange={(event) =>
                config({
                  text: event.target.value,
                })
              }
            />
          </Field>
        )}

        {block.type === "interaction.action_button" && (
          <Field label="Button text">
            <input
              className={inputClass}
              value={String(block.config.label ?? "")}
              onChange={(event) =>
                config({
                  label: event.target.value,
                })
              }
            />
          </Field>
        )}

        {[
          "display.text",
          "display.value",
          "display.counter",
          "display.metric",
        ].includes(block.type) && (
          <>
            <Field label="Size">
              <select
                className={inputClass}
                value={String(
                  block.config.size ??
                    (block.type === "display.counter" ? "hero" : "body"),
                )}
                onChange={(event) =>
                  config({
                    size: event.target.value,
                  })
                }
              >
                <option value="small">Small</option>

                <option value="body">Body</option>

                <option value="title">Title</option>

                <option value="large">Large</option>

                <option value="hero">Hero</option>
              </select>
            </Field>

            <Field label="Alignment">
              <select
                className={inputClass}
                value={String(block.config.alignment ?? "left")}
                onChange={(event) =>
                  config({
                    alignment: event.target.value,
                  })
                }
              >
                <option value="left">Left</option>

                <option value="center">Center</option>

                <option value="right">Right</option>
              </select>
            </Field>
          </>
        )}

        {["display.value", "display.counter", "display.metric"].includes(
          block.type,
        ) && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Prefix">
              <input
                className={inputClass}
                value={String(block.config.prefix ?? "")}
                onChange={(event) =>
                  config({
                    prefix: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Suffix">
              <input
                className={inputClass}
                value={String(block.config.suffix ?? "")}
                onChange={(event) =>
                  config({
                    suffix: event.target.value,
                  })
                }
              />
            </Field>
          </div>
        )}

        {block.type === "overlay.fullscreen" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Background">
              <input
                className={inputClass}
                type="color"
                value={String(block.config.background ?? "#111111")}
                onChange={(event) =>
                  config({
                    background: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Text">
              <input
                className={inputClass}
                type="color"
                value={String(block.config.foreground ?? "#FFFFFF")}
                onChange={(event) =>
                  config({
                    foreground: event.target.value,
                  })
                }
              />
            </Field>
          </div>
        )}
      </div>

      {supportsBinding && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CircleGauge className="h-3.5 w-3.5" />
            Data
          </div>

          <Field label="Display value from">
            <select
              className={inputClass}
              value={encodeBinding(block.binding)}
              onChange={(event) =>
                update({
                  binding: decodeBinding(event.target.value),
                })
              }
            >
              <option value="">No binding</option>

              {bindings.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {supportsAction && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            Interaction
          </div>

          <Field label="Run this action">
            <select
              className={inputClass}
              value={block.actionId ?? ""}
              onChange={(event) =>
                update({
                  actionId: event.target.value || undefined,
                })
              }
            >
              <option value="">Choose action...</option>

              {actions.map((item) => (
                <option key={item.action.id} value={item.action.id}>
                  {item.action.label}
                </option>
              ))}
            </select>
          </Field>

          {!actions.length && (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Add an Action block first, then bind this button to it.
            </div>
          )}
        </div>
      )}

      {supportsChildren && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Layers3 className="h-3.5 w-3.5" />
            Children
          </div>

          <div className="max-h-64 space-y-1 overflow-auto rounded-xl border p-2">
            {!possibleChildren.length && (
              <div className="p-3 text-xs text-muted-foreground">
                Add more visual blocks, then place them inside this layout.
              </div>
            )}

            {possibleChildren.map((child) => {
              const selected = (block.children ?? []).includes(child.id);

              return (
                <label
                  key={child.id}
                  className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted/30"
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => {
                      const current = block.children ?? [];

                      onChange(
                        setVisualChildren(
                          kernel,
                          block.id,
                          event.target.checked
                            ? [...new Set([...current, child.id])]
                            : current.filter((id) => id !== child.id),
                        ),
                      );
                    }}
                  />

                  {humanize(child.type)}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          Visibility
        </div>

        <label className="flex items-start gap-3 rounded-xl border p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(block.visibility)}
            onChange={(event) => {
              if (!event.target.checked) {
                update({
                  visibility: undefined,
                });

                return;
              }

              const target =
                kernel.runtimeWorld.states.find((state) => state.terminal) ??
                kernel.runtimeWorld.states[0];

              update({
                visibility: {
                  binding: {
                    scope: "state",

                    key: "process",
                  },

                  operator: "eq",

                  value: target?.id ?? "",
                },
              });
            }}
          />

          <div>
            <div className="text-sm font-medium">
              Show only in a certain state
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Pixel Logic changes state; this visual block reacts to it.
            </div>
          </div>
        </label>

        {block.visibility && (
          <Field label="Visible when state is">
            <select
              className={inputClass}
              value={String(block.visibility.value ?? "")}
              onChange={(event) =>
                update({
                  visibility: {
                    binding: {
                      scope: "state",

                      key: "process",
                    },

                    operator: "eq",

                    value: event.target.value,
                  },
                })
              }
            >
              <option value="">Choose state...</option>

              {kernel.runtimeWorld.states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <WandSparkles className="h-3.5 w-3.5" />
          Animation
        </div>

        <Field label="Animation">
          <select
            className={inputClass}
            value={block.animation?.preset ?? "none"}
            onChange={(event) => {
              const preset = event.target
                .value as ResponsibilityUiAnimationPreset;

              update({
                animation:
                  preset === "none"
                    ? undefined
                    : {
                        preset,

                        durationMs: block.animation?.durationMs ?? 400,
                      },
              });
            }}
          >
            <option value="none">None</option>

            <option value="fade">Fade</option>

            <option value="scale">Scale</option>

            <option value="fade_scale">Fade + scale</option>

            <option value="slide_up">Slide up</option>

            <option value="pulse">Pulse</option>

            <option value="shake">Shake</option>
          </select>
        </Field>

        {block.animation && (
          <Field label="Duration (milliseconds)">
            <input
              className={inputClass}
              type="number"
              min={50}
              max={10000}
              value={block.animation.durationMs ?? 400}
              onChange={(event) =>
                update({
                  animation: {
                    ...block.animation!,

                    durationMs: Math.max(
                      50,
                      Math.min(10000, Number(event.target.value) || 400),
                    ),
                  },
                })
              }
            />
          </Field>
        )}
      </div>

      {block.type === "animation.lottie" && (
        <div className="space-y-3">
          <Field label="Lottie URL">
            <input
              className={inputClass}
              value={String(block.config.url ?? "")}
              onChange={(event) =>
                config({
                  url: event.target.value,
                })
              }
              placeholder="https://.../animation.json"
            />
          </Field>

          <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
            Prefer packaged/company-controlled animation assets in production.
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-muted/10 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          UI and logic stay separate
        </div>

        <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
          This block controls what the employee sees. Pixel Logic controls what
          happens.
        </div>
      </div>
    </div>
  );
}
