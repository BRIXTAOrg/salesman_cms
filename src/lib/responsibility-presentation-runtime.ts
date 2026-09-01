import { RESPONSIBILITY_UI_BLOCK_REGISTRY } from "@/lib/responsibility-ui-document";

import type { ResponsibilityKernel } from "@/lib/responsibility-kernel-types";

export const BRIXTA_PRESENTATION_CONTRACT_ID =
  "brixta-presentation-v2" as const;

export const BRIXTA_PRESENTATION_RUNTIME_VERSION = 2 as const;

/**
 * BRIXTA_PRESENTATION_RUNTIME_CAPABILITIES_V2
 *
 * This is the common truth consumed by:
 *
 * - App Builder AI
 * - Pixel Logic AI
 * - publish validation/context
 *
 * It describes what the currently manufactured BRIXTA Flutter runtime can
 * actually render/control.
 */
export const BRIXTA_PRESENTATION_RUNTIME_CAPABILITIES = {
  contractId: BRIXTA_PRESENTATION_CONTRACT_ID,

  runtimeVersion: BRIXTA_PRESENTATION_RUNTIME_VERSION,

  engine: "brixta_stac_v1",

  designSystem: {
    baseTheme: "brixta_editorial_v1",

    inheritance:
      "The Responsibility always starts from the installed Flutter application's BRIXTA/tenant ThemeData. Responsibility styling is an override layer, not an unrelated second app theme.",

    themeScopes: ["inherit", "responsibility", "immersive"],

    supportedThemeTokens: {
      colors: [
        "primary",
        "background",
        "surface",
        "foreground",
        "muted",
        "border",
      ],

      typography: ["scale"],
    },
  },

  shell: {
    normalAppBar: true,

    safeArea: true,

    keyboardAware: true,

    pullToRefresh: true,

    immersiveResponsibility: true,
  },

  visualBlocks: RESPONSIBILITY_UI_BLOCK_REGISTRY,

  motion: {
    presets: ["fade", "scale", "fade_scale", "slide_up", "pulse", "shake"],

    lottie: true,

    triggers: [
      "initial_mount",
      "binding_change",
      "state_change",
      "visibility_enter",
      "pixel_ui_animate",
      "pixel_ui_play",
    ],

    reducedMotionAware: true,

    maxDurationMs: 10000,
  },

  transientPixelEffects: [
    {
      nodeType: "effect.ui_animate",

      purpose:
        "Replay an installed animation on an EXISTING App Builder UI block.",

      persistent: false,
    },

    {
      nodeType: "effect.ui_show",

      purpose:
        "Force an EXISTING UI block visible for the current rendered screen session.",

      persistent: false,
    },

    {
      nodeType: "effect.ui_hide",

      purpose:
        "Force an EXISTING UI block hidden for the current rendered screen session.",

      persistent: false,
    },

    {
      nodeType: "effect.ui_play",

      purpose: "Replay an EXISTING Lottie/animation UI block.",

      persistent: false,
    },

    {
      nodeType: "effect.haptic",

      purpose: "Emit a permitted device haptic response.",

      persistent: false,
    },

    {
      nodeType: "effect.device_sound",
      purpose: "Play a packaged BRIXTA sound on the current foreground device.",
      persistent: false,
      deliveryScope: "current_action_response_device",
    },

    {
      nodeType: "effect.device_ring",
      purpose: "Play a bounded attention ring on the current foreground device.",
      persistent: false,
      deliveryScope: "current_action_response_device",
    },

    {
      nodeType: "effect.device_notification",
      purpose: "Display an immediate in-app foreground notification on the current device.",
      persistent: false,
      deliveryScope: "current_action_response_device",
      backgroundPush: false,
    },
  ],

  accessibility: {
    inheritsSystemTextScaling: true,

    reducedMotionCanOverrideAuthoredAnimation: true,

    nativeFlutterSemantics: true,

    rule: "Accessibility/system preferences outrank authored presentation.",
  },

  security: {
    remoteExecutableCode: false,

    declarationOnly: true,

    rule: "CMS may select installed declarative capabilities. It may not download or execute arbitrary Dart/Swift/Kotlin/JavaScript.",
  },

  resourcePolicy: {
    arbitraryBackgroundLoops: false,

    unboundedAnimationDuration: false,

    unboundedInMemoryCollections: false,
  },
} as const;

function uiDocumentFromKernel(kernel: ResponsibilityKernel | null) {
  return kernel?.metadata.ui?.uiDocument ?? null;
}

/**
 * BRIXTA_SHARED_INTERFACE_IR_V1
 *
 * Pixel may inspect AND author a complete replacement UI document while
 * editing/publishing a Responsibility.
 *
 * This does NOT grant runtime structural mutation. Runtime Pixel effects
 * remain transient reactions against the already-published document.
 */
export function buildPixelPresentationContext(
  kernel: ResponsibilityKernel | null,
) {
  const document = uiDocumentFromKernel(kernel);

  const blocks =
    document?.blocks.map((block) => {
      const definition = RESPONSIBILITY_UI_BLOCK_REGISTRY.find(
        (candidate) => candidate.type === block.type,
      );

      return {
        id: block.id,

        type: block.type,

        actionId: block.actionId ?? null,

        binding: block.binding ?? null,

        visibility: block.visibility ?? null,

        authoredAnimation: block.animation ?? null,

        supportedAnimations: definition?.supportedAnimations ?? [],

        controllable: {
          visibility: true,

          oneShotAnimation: Boolean(definition?.supportedAnimations?.length),

          playback: block.type === "animation.lottie",
        },
      };
    }) ?? [];

  return {
    runtime: BRIXTA_PRESENTATION_RUNTIME_CAPABILITIES,

    currentUi: {
      exists: Boolean(document),

      /*
       * The complete authored document is intentionally included so
       * Logic AI can preserve/modify the actual interface rather than
       * reconstructing it from a lossy block summary.
       */
      document,

      engine: document?.engine ?? null,

      theme: document?.theme ?? {
        scope: "inherit",
        base: "brixta_editorial_v1",
      },

      blocks,
    },

    authoring: {
      canReplaceAppUiDocument: true,

      writePath:
        "reality.interface.appUiDocument",

      semantics:
        "Authoring-time complete-document replacement. Omit appUiDocument to preserve the current UI.",

      runtimeStructuralMutation:
        false,
    },

    separationRules: [
      "App Builder and Pixel Logic are two editors over the SAME published Responsibility interface.",
      "During AUTHORING, Pixel Logic MAY create captures/actions and MAY provide a complete replacement app UI document when the requested behavior requires new/changed inputs or outputs.",
      "When authoring appUiDocument, preserve unrelated useful existing blocks and stable IDs.",
      "At RUNTIME, Pixel Logic MUST NOT structurally rewrite the published UI. It changes state/computed/data and the declarative UI reacts.",
      "effect.ui_* remains transient runtime presentation against blocks that exist in the published UI document.",
      "Persistent application structure is versioned/published as Responsibility interface data, regardless of whether App Builder or Logic Builder authored it.",
      "A runtime targetBlockId must reference a block present in the published currentUi document.",
    ],
  };
}
