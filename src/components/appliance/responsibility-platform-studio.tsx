"use client";

/*
 * BRIXTA_UI_V2 — Responsibilities studio shell.
 *
 * One page title and three plain tabs. Lists (entities) moved to their own
 * page under Field work → Lists, so they are no longer duplicated here.
 */

import { useState } from "react";
import Link from "next/link";

import DataSourcesClient from "./data-sources-client";
import PixelLogicStudioClient from "./pixel-logic-studio-client";
import ResponsibilityKernelClient from "./responsibility-kernel-client";

type TabKey = "builder" | "automations" | "data";

const tabs: Array<{ key: TabKey; label: string; hint: string }> = [
  {
    key: "builder",
    label: "Builder",
    hint: "Design what your team fills in on the phone, then publish it.",
  },
  {
    key: "automations",
    label: "Automations",
    hint: "When something happens in a responsibility, decide what follows.",
  },
  {
    key: "data",
    label: "Data connections",
    hint: "Feed list data into app fields so people pick instead of type.",
  },
];

export default function ResponsibilityPlatformStudio() {
  const [tab, setTab] = useState<TabKey>("builder");
  const active = tabs.find((item) => item.key === tab) ?? tabs[0];

  return (
    <div className="brixta-studio-v2 mx-auto flex w-full min-w-0 max-w-[1500px] flex-col overflow-x-clip px-3 pb-8 pt-5 sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="brixta-page-title text-[26px] font-semibold leading-8 text-foreground">
          Responsibilities
        </h1>
        <p className="max-w-2xl text-[14px] leading-6 text-muted-foreground">
          {active.hint}{" "}
          {tab === "data" && (
            <>
              Lists themselves live in{" "}
              <Link href="/dashboard/lists" className="font-medium text-[#2F6B62] underline-offset-2 hover:underline">
                Lists &amp; imports
              </Link>
              .
            </>
          )}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Responsibilities sections"
        className="mt-4 flex min-w-0 gap-1 overflow-x-auto border-b border-[#E1E4E0]"
      >
        {tabs.map((item) => {
          const selected = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`studio-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`studio-panel-${item.key}`}
              onClick={() => setTab(item.key)}
              className={[
                "-mb-px h-10 shrink-0 border-b-2 px-3 text-[14px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6B62]/40 rounded-t-[8px]",
                selected
                  ? "border-[#2F6B62] text-[#1D2321]"
                  : "border-transparent text-[#5F6964] hover:text-[#1D2321]",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`studio-panel-${tab}`}
        aria-labelledby={`studio-tab-${tab}`}
        className="w-full min-w-0 max-w-full pt-5"
      >
        {tab === "builder" && <ResponsibilityKernelClient />}
        {tab === "automations" && <PixelLogicStudioClient />}
        {tab === "data" && <DataSourcesClient />}
      </div>
    </div>
  );
}
