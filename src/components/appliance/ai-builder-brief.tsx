"use client";

import {
  FileText,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type {
  BuilderAiMode,
} from "@/lib/builder-ai-intent-context";

import {
  textareaClass,
} from "./primitives";

type Props = {
  kind:
    | "app"
    | "logic";

  value: string;

  onChange:
    (value: string) =>
      void;

  mode:
    BuilderAiMode;

  onModeChange:
    (
      mode:
        BuilderAiMode,
    ) => void;

  inventory?:
    string[];

  contextItems?:
    string[];
};

const APP_MODES: Array<{
  id: BuilderAiMode;
  label: string;
  description: string;
}> = [
  {
    id: "create",
    label: "Create",
    description:
      "Build the complete experience.",
  },
  {
    id: "modify",
    label: "Modify",
    description:
      "Change only what I ask.",
  },
  {
    id: "restyle",
    label: "Restyle",
    description:
      "Change look, preserve behaviour.",
  },
  {
    id: "logic",
    label: "Behaviour",
    description:
      "Describe what should happen.",
  },
];

const LOGIC_MODES: Array<{
  id: BuilderAiMode;
  label: string;
  description: string;
}> = [
  {
    id: "logic",
    label: "Generate Logic",
    description:
      "Build WHEN → IF → THEN.",
  },
  {
    id: "modify",
    label: "Modify Logic",
    description:
      "Change only requested behaviour.",
  },
];

const STYLES = [
  "Editorial",
  "Minimal",
  "Executive",
  "Industrial",
  "Luxury",
  "Monochrome",
  "High Contrast",
  "Dense Operations",
];

const TYPOGRAPHY = [
  "Editorial serif headings",
  "Modern sans",
  "Geometric",
  "Humanist",
  "Technical",
  "Classic serif",
];

function appendIntent(
  current: string,
  intent: string,
) {
  if (
    current
      .toLowerCase()
      .includes(
        intent.toLowerCase(),
      )
  ) {
    return current;
  }

  const clean =
    current.trim();

  return clean
    ? `${clean}\n${intent}`
    : intent;
}

export function AiBuilderBrief({
  kind,
  value,
  onChange,
  mode,
  onModeChange,
  inventory = [],
  contextItems = [],
}: Props) {
  const modes =
    kind === "app"
      ? APP_MODES
      : LOGIC_MODES;

  return (
    <section className="mb-6 rounded-lg border border-border bg-card shadow-none">
      {/* ================================================================
          HEADER
          Uses the SAME hierarchy/colors as the rest of the CMS.
          ================================================================ */}
      <div className="flex flex-col gap-4 border-b border-border px-6 py-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.02em] text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />

            Generate with AI
          </div>

          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground">
            {kind === "app"
              ? "Describe the app exactly the way you want it."
              : "Describe the behaviour in normal language."}
          </h2>

          <p className="mt-2 max-w-3xl text-[14px] leading-6 text-muted-foreground">
            {kind === "app"
              ? "Describe the look, interaction, data and behaviour together. BRIXTA uses the systems already configured for this company."
              : "Explain when something happens, what must be true, and what BRIXTA should do next."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Existing roles preserved
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground">
            Registered blocks only
          </span>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* ================================================================
            MODE
            Same button geometry as the CMS.
            ================================================================ */}
        <div>
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
            What do you want AI to do?
          </div>

          <div className="flex flex-wrap gap-2">
            {modes.map(
              (item) => {
                const active =
                  item.id === mode;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      onModeChange(
                        item.id,
                      )
                    }
                    className={[
                      "min-w-[145px] rounded-md border px-3 py-2.5 text-left shadow-none",
                      "transition-[background-color,color,border-color] duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    <span className="block text-[13px] font-medium">
                      {item.label}
                    </span>

                    <span
                      className={[
                        "mt-0.5 block text-[11px]",
                        active
                          ? "text-primary-foreground/75"
                          : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {item.description}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* ================================================================
            USER BRIEF
            Uses the repo's EXISTING textarea primitive.
            ================================================================ */}
        <div>
          <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
            Your brief
          </div>

          <textarea
            value={value}
            onChange={(event) =>
              onChange(
                event.target.value,
              )
            }
            maxLength={6000}
            rows={7}
            placeholder={
              kind === "app"
                ? "Example: Build a Daily Visit app. Keep it cream and editorial. Let the salesman choose a dealer from our existing Dealer data, take a proof photo, capture GPS/time automatically and submit. Make dealer selection a fullscreen searchable picker. Animate into VISIT RECORDED after success."
                : "Example: When Submit Visit happens, require dealer and proof photo. If valid, create the record, change state to Recorded and append history."
            }
            className={textareaClass}
          />

          <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
            <span>
              This requirement is included in the existing BRIXTA AI context.
            </span>

            <span>
              {value.length.toLocaleString()}
              /6,000
            </span>
          </div>
        </div>

        {/* ================================================================
            STYLE CONTROLS
            Neutral CMS surfaces. No custom purple/navy design language.
            ================================================================ */}
        {kind === "app" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
                Style direction
              </div>

              <p className="mt-1 text-[12px] text-muted-foreground">
                Add a visual direction to your brief.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {STYLES.map(
                  (style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() =>
                        onChange(
                          appendIntent(
                            value,
                            `Look: ${style}.`,
                          ),
                        )
                      }
                      className="rounded-md border border-input bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground shadow-none transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {style}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />

                Typography direction
              </div>

              <p className="mt-1 text-[12px] text-muted-foreground">
                Tell AI how the generated app should feel typographically.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {TYPOGRAPHY.map(
                  (style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() =>
                        onChange(
                          appendIntent(
                            value,
                            `Typography: ${style}.`,
                          ),
                        )
                      }
                      className="rounded-md border border-input bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground shadow-none transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {style}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            CONTEXT / REGISTRY INFORMATION
            Compact supporting information instead of giant dashboard cards.
            ================================================================ */}
        <div className="grid gap-4 border-t border-border pt-5 xl:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              Context AI receives
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {contextItems.map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-md border border-border bg-muted px-2 py-1 text-[12px] text-muted-foreground"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.02em] text-foreground">
              {kind === "logic" && (
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              )}

              Existing building blocks
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {inventory.map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-md border border-border bg-muted px-2 py-1 text-[12px] text-muted-foreground"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-3 text-[12px] leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            BRIXTA reuses existing Roles, Employees, Responsibility assignments,
            Data Sources, captures, actions, outputs and stable IDs. This panel
            changes the AI authoring experience; it does not replace those
            systems.
          </span>
        </div>
      </div>
    </section>
  );
}
