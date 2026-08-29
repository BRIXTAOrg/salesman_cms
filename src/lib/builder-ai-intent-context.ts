/**
 * BRIXTA BUILDER AI INTENT CONTEXT V1.1
 *
 * This wraps the EXISTING App Builder / Pixel Logic AI context.
 * It does not replace either AI bridge.
 */

export type BuilderAiMode =
  | "create"
  | "modify"
  | "restyle"
  | "logic";

export type BuilderAiKind =
  | "app"
  | "logic";

type BuilderAiIntentInput = {
  kind: BuilderAiKind;

  mode: BuilderAiMode;

  userRequest: string;

  contextItems?: string[];
};

function scopeRules(
  kind: BuilderAiKind,
  mode: BuilderAiMode,
) {
  if (
    kind === "app"
    && mode === "restyle"
  ) {
    return [
      "RESTYLE ONLY.",
      "Preserve business logic.",
      "Preserve captures.",
      "Preserve actions.",
      "Preserve outputs.",
      "Preserve Data Source bindings.",
      "Preserve stable IDs.",
      "Change presentation, hierarchy, spacing, typography, surfaces and motion only as required.",
    ];
  }

  if (
    kind === "logic"
    || mode === "logic"
  ) {
    return [
      "BEHAVIOUR / LOGIC MODE.",
      "Use registered Pixel Logic capabilities.",
      "Preserve unrelated presentation.",
      "Do not manufacture another role, employee, assignment or Data Source system.",
    ];
  }

  if (
    mode === "modify"
  ) {
    return [
      "MODIFY ONLY THE REQUESTED SLICE.",
      "Preserve unrelated useful UI and functionality.",
      "Preserve stable IDs for concepts that still represent the same thing.",
    ];
  }

  return [
    "CREATE A COMPLETE APP EXPERIENCE.",
    "Reuse the organization's existing structures before creating anything new.",
  ];
}

export function augmentBuilderAiContext(
  baseContext: string,
  input: BuilderAiIntentInput,
) {
  const request =
    input.userRequest.trim();

  const available =
    input.contextItems?.length
      ? input.contextItems
          .map(
            (item) =>
              `- ${item}`,
          )
          .join("\n")
      : "- Existing BRIXTA context.";

  const scoped =
    scopeRules(
      input.kind,
      input.mode,
    )
      .map(
        (item) =>
          `- ${item}`,
      )
      .join("\n");

  return `${baseContext}

======================================================================
BRIXTA USER INTENT V1.1
======================================================================

BUILDER
${input.kind === "app" ? "APP BUILDER" : "PIXEL LOGIC"}

MODE
${input.mode.toUpperCase()}

USER REQUEST
${request || "No additional human brief supplied. Preserve the current application and infer as little as possible."}

AVAILABLE CONTEXT
${available}

CHANGE SCOPE
${scoped}

NON-NEGOTIABLE EXISTING-SYSTEM CONTRACT

- Employee administration remains the source of truth for employees.
- Role administration remains the source of truth for roles.
- Existing Role assignment remains authoritative.
- Existing Responsibility assignment remains authoritative.
- Do not create a second employee system.
- Do not create a second role system.
- Do not create a second permission system.
- Reuse existing Data Sources whenever they satisfy the requested data need.
- Reuse existing captures/actions/outputs when they represent the same business concept.
- Preserve stable IDs wherever possible.
- Use registered BRIXTA capabilities only.
- Do not invent unsupported native phone capabilities.
- Visual-only changes must not rewrite business logic.
- Logic-only changes must not redesign unrelated presentation.

APP QUALITY CONTRACT

- Interpret LOOK + INTERACTION + DATA + BEHAVIOUR together.
- Do not return a generic enterprise form when the user explicitly requests a designed experience.
- Use strong visual hierarchy, spacing, typography, surfaces and motion where appropriate.
- Functional controls must remain real functional controls.
- BRIXTA_VISUAL_FUNCTIONAL_INTENT_V11
- In a visual uiDocument, an editable existing capture must be placed with interaction.capture.
- display.value, display.metric and display.counter are read-only presentation and must never impersonate an editable control.
- Dealer/site/product/customer/business-record selection must use an existing reference capture + existing Data Source whenever available.
- Preserve the existing visual composition when converting a read-only capture display into an interactive capture.
- Never create decorative fake buttons, fake dropdowns or fake evidence controls.
- Business-record selection must use a real reference/Data Source binding where available.
- Photo, File, Signature, GPS and similar inputs must use real registered capture primitives.
- Action buttons must bind to real actions.
- Generated presentation must preserve accessibility and mobile usability.
- Restyling must not break behaviour.
- Advanced business behaviour belongs to Pixel Logic rather than executable presentation code.

95 / 5 AUTHORING MODEL

AI should aim to produce approximately 95% of the requested app:
- structure
- composition
- visual hierarchy
- interaction
- bindings
- ordinary validation
- states
- ordinary business behaviour
- appropriate outputs

The remaining manual Builder refinement should mainly concern:
- exact wording
- color taste
- typography direction
- spacing
- component variants
- motion preference
- small layout adjustments

OUTPUT CONTRACT

Continue following the original BRIXTA AI bridge output format exactly.
If that contract requires JSON-only output, return JSON only.
`;
}
