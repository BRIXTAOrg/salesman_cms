/**
 * BRIXTA RESPONSIBILITY UI DOCUMENT V1
 *
 * This is deliberately separate from Pixel Logic.
 *
 * Pixel Logic:
 *   events / calculations / conditions / effects / state.
 *
 * UI Document:
 *   what the employee actually sees and interacts with.
 *
 * Captures remain DATA COLLECTION primitives.
 * They must not be abused as display widgets.
 */

export type ResponsibilityUiBindingScope =
  | "capture"
  | "computed"
  | "context"
  | "state"
  | "record"
  | "actor"
  | "literal";

export type ResponsibilityUiBinding = {
  scope: ResponsibilityUiBindingScope;

  /**
   * Required unless scope === literal.
   */
  key?: string;

  path?: string;

  /**
   * Used only by literal bindings.
   */
  value?: unknown;
};

export type ResponsibilityUiVisibility = {
  binding: ResponsibilityUiBinding;

  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "exists"
    | "not_exists";

  value?: unknown;
};

export type ResponsibilityUiAnimationPreset =
  | "none"
  | "fade"
  | "scale"
  | "fade_scale"
  | "slide_up"
  | "pulse"
  | "shake";

export type ResponsibilityUiAnimation = {
  preset: ResponsibilityUiAnimationPreset;
  durationMs?: number;
  delayMs?: number;
  repeat?: number;
};

export type ResponsibilityUiThemeScope =
  | "inherit"
  | "responsibility"
  | "immersive";

export type ResponsibilityUiTheme = {
  /**
   * inherit:
   *   Use the existing BRIXTA/tenant application design unchanged.
   *
   * responsibility:
   *   Inherit the host design, then apply approved Responsibility tokens.
   *
   * immersive:
   *   Same scoped theme capability, but the Responsibility may occupy the
   *   entire employee screen without the normal Responsibility AppBar.
   */
  scope: ResponsibilityUiThemeScope;

  base?: "brixta_editorial_v1";

  tokens?: {
    colors?: {
      primary?: string;
      background?: string;
      surface?: string;
      foreground?: string;
      muted?: string;
      border?: string;
    };

    typography?: {
      /**
       * Scales the inherited BRIXTA typography.
       * Flutter/system accessibility text scaling still applies afterward.
       */
      scale?: number;
    };
  };
};

export type ResponsibilityUiBlockType =
  | "layout.column"
  | "layout.row"
  | "layout.stack"
  | "display.text"
  | "display.value"
  | "display.counter"
  | "display.metric"
  | "display.progress"
  | "display.badge"
  | "interaction.action_button"
  | "overlay.banner"
  | "overlay.fullscreen"
  | "media.image"
  | "animation.lottie"
  | "spacing.spacer"
  | "spacing.divider"
  | "stac.raw";

export type ResponsibilityUiBlock = {
  id: string;

  type: ResponsibilityUiBlockType;

  /**
   * Container block children.
   */
  children?: string[];

  /**
   * Dynamic value displayed by this block.
   */
  binding?: ResponsibilityUiBinding;

  /**
   * Kernel action executed by an interaction block.
   */
  actionId?: string;

  /**
   * Declarative visibility. Pixel Logic changes data/state;
   * the UI reacts to the resulting reality.
   */
  visibility?: ResponsibilityUiVisibility;

  animation?: ResponsibilityUiAnimation;

  /**
   * Presentation-only configuration.
   *
   * NO executable JS/Dart/source code belongs here.
   */
  config: Record<string, unknown>;
};

export type ResponsibilityUiDocument = {
  version: 1;

  engine: "brixta_stac_v1";

  /**
   * BRIXTA_PRESENTATION_THEME_V2
   *
   * Presentation inherits the host Flutter app by default.
   */
  theme?: ResponsibilityUiTheme;

  /**
   * Ordered top-level UI blocks.
   */
  rootIds: string[];

  blocks: ResponsibilityUiBlock[];
};

export type ResponsibilityUiBlockDefinition = {
  type: ResponsibilityUiBlockType;

  label: string;

  category:
    | "Layout"
    | "Display"
    | "Interaction"
    | "Overlay"
    | "Media"
    | "Animation"
    | "Spacing"
    | "Advanced";

  description: string;

  keywords: string[];

  allowsBinding?: boolean;

  allowsAction?: boolean;

  allowsChildren?: boolean;

  defaultConfig: Record<string, unknown>;

  supportedAnimations?: ResponsibilityUiAnimationPreset[];

  runtime: "brixta" | "stac";
};

/**
 * ---------------------------------------------------------------------
 * VISUAL APP BUILDER BLOCK REGISTRY
 * ---------------------------------------------------------------------
 *
 * ADD UPCOMING VISUAL BLOCKS HERE.
 *
 * Pure Stac-compatible presentation can often be added without changing
 * backend logic.
 *
 * BRIXTA-specific dynamic behavior should use an installed renderer adapter.
 */
export const RESPONSIBILITY_UI_BLOCK_REGISTRY: ResponsibilityUiBlockDefinition[] =
  [
    {
      type: "layout.column",
      label: "Column",
      category: "Layout",
      description: "Stack child blocks vertically.",
      keywords: ["column", "vertical", "layout", "stack"],
      allowsChildren: true,
      defaultConfig: {
        gap: 16,
        alignment: "stretch",
      },
      runtime: "brixta",
    },

    {
      type: "layout.row",
      label: "Row",
      category: "Layout",
      description: "Place child blocks horizontally.",
      keywords: ["row", "horizontal", "layout"],
      allowsChildren: true,
      defaultConfig: {
        gap: 12,
      },
      runtime: "brixta",
    },

    {
      type: "layout.stack",
      label: "Stack",
      category: "Layout",
      description: "Layer child blocks on top of each other.",
      keywords: ["stack", "overlay", "layer"],
      allowsChildren: true,
      defaultConfig: {},
      runtime: "brixta",
    },

    {
      type: "display.text",
      label: "Text",
      category: "Display",
      description: "Display static text. This is NOT an input field.",
      keywords: ["text", "label", "heading", "title", "paragraph"],
      defaultConfig: {
        text: "Text",
        size: "body",
        alignment: "left",
      },
      supportedAnimations: ["fade", "scale", "fade_scale", "slide_up"],
      runtime: "brixta",
    },

    {
      type: "display.value",
      label: "Dynamic Value",
      category: "Display",
      description:
        "Display capture, computed, context, state or record data without asking the employee to type it.",
      keywords: [
        "value",
        "dynamic",
        "display",
        "calculated",
        "computed",
        "read only",
      ],
      allowsBinding: true,
      defaultConfig: {
        size: "body",
        alignment: "left",
      },
      supportedAnimations: ["fade", "scale", "fade_scale"],
      runtime: "brixta",
    },

    {
      type: "display.counter",
      label: "Counter",
      category: "Display",
      description:
        "Large read-only counter bound to computed/capture/context data.",
      keywords: ["counter", "click count", "number display", "score", "tally"],
      allowsBinding: true,
      defaultConfig: {
        size: "hero",
        alignment: "center",
        suffix: "",
      },
      supportedAnimations: ["scale", "fade_scale", "pulse"],
      runtime: "brixta",
    },

    {
      type: "display.metric",
      label: "Metric",
      category: "Display",
      description: "Prominent KPI/metric display.",
      keywords: ["metric", "kpi", "distance", "amount", "score", "dashboard"],
      allowsBinding: true,
      defaultConfig: {
        size: "large",
        alignment: "left",
      },
      supportedAnimations: ["fade", "scale"],
      runtime: "brixta",
    },

    {
      type: "display.progress",
      label: "Progress",
      category: "Display",
      description: "Show numeric progress.",
      keywords: ["progress", "percent", "completion"],
      allowsBinding: true,
      defaultConfig: {
        min: 0,
        max: 100,
      },
      runtime: "brixta",
    },

    {
      type: "display.badge",
      label: "Badge",
      category: "Display",
      description: "Compact status/value badge.",
      keywords: ["badge", "status", "pill", "tag"],
      allowsBinding: true,
      defaultConfig: {},
      runtime: "brixta",
    },

    {
      type: "interaction.action_button",
      label: "Action Button",
      category: "Interaction",
      description:
        "A real app button bound to a Responsibility action. It does not create a form field.",
      keywords: ["button", "click", "tap", "action", "start", "stop"],
      allowsAction: true,
      defaultConfig: {
        label: "Continue",
        style: "primary",
        size: "large",
      },
      supportedAnimations: ["fade", "scale", "fade_scale"],
      runtime: "brixta",
    },

    {
      type: "overlay.banner",
      label: "Banner",
      category: "Overlay",
      description: "Animated in-page banner.",
      keywords: ["banner", "message", "success", "alert"],
      defaultConfig: {
        text: "Done",
      },
      supportedAnimations: [
        "fade",
        "scale",
        "fade_scale",
        "slide_up",
        "pulse",
        "shake",
      ],
      runtime: "brixta",
    },

    {
      type: "overlay.fullscreen",
      label: "Fullscreen Overlay",
      category: "Overlay",
      description:
        "Fill the employee screen with an animated state-driven experience.",
      keywords: [
        "fullscreen",
        "overlay",
        "celebration",
        "meow",
        "animation",
        "success screen",
      ],
      defaultConfig: {
        text: "DONE!",
        background: "#111111",
        foreground: "#FFFFFF",
      },
      supportedAnimations: ["fade", "scale", "fade_scale", "pulse", "shake"],
      runtime: "brixta",
    },

    {
      type: "media.image",
      label: "Image",
      category: "Media",
      description: "Display an image.",
      keywords: ["image", "picture", "logo", "photo display"],
      allowsBinding: true,
      defaultConfig: {
        fit: "cover",
      },
      runtime: "brixta",
    },

    {
      type: "animation.lottie",
      label: "Lottie Animation",
      category: "Animation",
      description:
        "Display a packaged or permitted remote Lottie animation asset.",
      keywords: ["lottie", "animation", "celebration", "motion"],
      defaultConfig: {
        repeat: true,
      },
      runtime: "brixta",
    },

    {
      type: "spacing.spacer",
      label: "Spacer",
      category: "Spacing",
      description: "Add deliberate whitespace.",
      keywords: ["space", "spacer", "gap"],
      defaultConfig: {
        height: 16,
      },
      runtime: "brixta",
    },

    {
      type: "spacing.divider",
      label: "Divider",
      category: "Spacing",
      description: "Visual separator.",
      keywords: ["divider", "line", "separator"],
      defaultConfig: {},
      runtime: "brixta",
    },

    {
      type: "stac.raw",
      label: "Stac Widget",
      category: "Advanced",
      description:
        "Render whitelisted declarative Stac JSON. No executable source code is accepted.",
      keywords: ["stac", "advanced", "widget", "server driven ui"],
      defaultConfig: {
        json: {
          type: "text",
          data: "Stac widget",
        },
      },
      runtime: "stac",
    },
  ];

function rawObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function rawArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  return value;
}

function rawString(value: unknown, path: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return value.trim();
}

const allowedTypes = new Set(
  RESPONSIBILITY_UI_BLOCK_REGISTRY.map((block) => block.type),
);

export function parseResponsibilityUiDocument(
  value: unknown,
): ResponsibilityUiDocument {
  const raw = rawObject(value, "app.uiDocument");

  if (Number(raw.version) !== 1) {
    throw new Error("app.uiDocument.version must be 1.");
  }

  if (raw.engine !== "brixta_stac_v1") {
    throw new Error('app.uiDocument.engine must be "brixta_stac_v1".');
  }

  let theme: ResponsibilityUiTheme | undefined;

  if (raw.theme !== undefined) {
    const rawTheme = rawObject(raw.theme, "app.uiDocument.theme");

    const scope = rawTheme.scope;

    if (
      scope !== "inherit" &&
      scope !== "responsibility" &&
      scope !== "immersive"
    ) {
      throw new Error(
        'app.uiDocument.theme.scope must be "inherit", "responsibility", or "immersive".',
      );
    }

    if (
      rawTheme.base !== undefined &&
      rawTheme.base !== "brixta_editorial_v1"
    ) {
      throw new Error(
        'app.uiDocument.theme.base must be "brixta_editorial_v1".',
      );
    }

    const tokens =
      rawTheme.tokens === undefined
        ? undefined
        : (rawObject(
            rawTheme.tokens,
            "app.uiDocument.theme.tokens",
          ) as ResponsibilityUiTheme["tokens"]);

    theme = {
      scope,
      base:
        rawTheme.base === "brixta_editorial_v1"
          ? "brixta_editorial_v1"
          : undefined,
      tokens,
    };
  }

  const rootIds = rawArray(raw.rootIds, "app.uiDocument.rootIds").map(
    (item, index) => rawString(item, `app.uiDocument.rootIds[${index}]`),
  );

  const blockRaw = rawArray(raw.blocks, "app.uiDocument.blocks");

  const ids = new Set<string>();

  const blocks: ResponsibilityUiBlock[] = blockRaw.map((item, index) => {
    const block = rawObject(item, `app.uiDocument.blocks[${index}]`);

    const id = rawString(block.id, `app.uiDocument.blocks[${index}].id`);

    if (ids.has(id)) {
      throw new Error(`Duplicate UI block id "${id}".`);
    }

    ids.add(id);

    const type = rawString(
      block.type,
      `app.uiDocument.blocks[${index}].type`,
    ) as ResponsibilityUiBlockType;

    if (!allowedTypes.has(type)) {
      throw new Error(`Unsupported UI block type "${type}".`);
    }

    const children =
      block.children === undefined
        ? undefined
        : rawArray(
            block.children,
            `app.uiDocument.blocks[${index}].children`,
          ).map((child, childIndex) =>
            rawString(
              child,
              `app.uiDocument.blocks[${index}].children[${childIndex}]`,
            ),
          );

    const config =
      block.config === undefined
        ? {}
        : rawObject(block.config, `app.uiDocument.blocks[${index}].config`);

    const binding =
      block.binding === undefined
        ? undefined
        : (rawObject(
            block.binding,
            `app.uiDocument.blocks[${index}].binding`,
          ) as ResponsibilityUiBinding);

    const visibility =
      block.visibility === undefined
        ? undefined
        : (rawObject(
            block.visibility,
            `app.uiDocument.blocks[${index}].visibility`,
          ) as unknown as ResponsibilityUiVisibility);

    const animation =
      block.animation === undefined
        ? undefined
        : (rawObject(
            block.animation,
            `app.uiDocument.blocks[${index}].animation`,
          ) as unknown as ResponsibilityUiAnimation);

    return {
      id,
      type,
      children,
      binding,
      actionId: typeof block.actionId === "string" ? block.actionId : undefined,
      visibility,
      animation,
      config,
    };
  });

  for (const rootId of rootIds) {
    if (!ids.has(rootId)) {
      throw new Error(
        `app.uiDocument.rootIds references missing UI block "${rootId}".`,
      );
    }
  }

  for (const block of blocks) {
    for (const child of block.children ?? []) {
      if (!ids.has(child)) {
        throw new Error(
          `UI block "${block.id}" references missing child "${child}".`,
        );
      }
    }
  }

  return {
    version: 1,
    engine: "brixta_stac_v1",
    theme,
    rootIds,
    blocks,
  };
}
