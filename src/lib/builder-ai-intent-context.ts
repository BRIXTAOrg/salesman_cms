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

  // BRIXTA_AI_LOGIC_EDIT_CONTRACT_V1
  if (
    kind === "logic"
    && mode === "modify"
  ) {
    return [
      "EDIT THE EXISTING LOGIC IN PLACE.",
      "Treat the current Responsibility Kernel and current Pixel Logic program as authoritative source code.",
      "Interpret the human request as a semantic modification, not permission to redesign the Responsibility.",
      "Make the smallest coherent business-logic change that satisfies the request.",
      "Preserve all unrelated actors, captures, actions, outputs, states, guards, variables, nodes and edges.",
      "Preserve stable IDs whenever the business concept still represents the same thing.",
      "Do not delete existing logic merely because it is not mentioned in the new request.",
      "Do not replace unrelated working logic with a newly invented alternative.",
      "When modifying an existing action, keep the SAME action ID and restate every required action field accurately.",
      "When changing only action.config, preserve actorId, objectId, captureIds, availableState and resultingState unless the human explicitly changes them.",
      "Return the COMPLETE BRIXTA AI envelope required by the existing importer, even though the semantic change itself should be minimal.",
      "The full returned program must contain unchanged existing nodes/edges plus the requested edits.",
      "Reality declarations should introduce/update only business definitions actually needed by the requested change.",
      "Use installed server-side submission guards for pre-persistence invariants instead of pretending a post-save Pixel effect can reject an already-created record.",
      "Never fake unsupported behavior.",
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
- The Responsibility Kernel is the authoritative business model.
- New AI-authored Responsibilities MUST NOT depend on separately authored Workflow definitions.
- Express multi-step business routing with Kernel actors, states, actions, rules and effects.
- Existing Workflow records are legacy compatibility infrastructure, not an AI authoring target.
- Reuse the employee reporting hierarchy and existing Role administration for manager/approver authority.
- If a rule can reject a write, authorize an actor, change business state, affect money, enforce uniqueness, create records, assign work or approve/reject something, it MUST be enforceable by the backend Kernel.
- Flutter may present business behaviour, but Flutter must never be the sole authority for business truth.
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

For Logic Builder MODIFY mode:
- This is an UPDATE request.
- Do not return prose describing what the human should manually change.
- Do not return a separate invented patch format.
- Return the COMPLETE valid BRIXTA Pixel Reality + Pixel Logic JSON envelope expected by the existing importer.
- The complete JSON must represent the CURRENT logic plus the requested modification.
- Preserve unrelated existing program nodes, graph wires and stable business IDs.
- Treat the human's exact brief as authoritative.
`;
}
