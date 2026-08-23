"use client";

import { useState } from "react";
import {
  Blocks,
  Boxes,
  BrainCircuit,
  Database,
  ShieldCheck,
} from "lucide-react";

import ResponsibilitiesClient from "./responsibilities-client";
import DataSourcesClient from "./data-sources-client";
import EntitiesClient from "./entities-client";
import ResponsibilityPowerClient from "./responsibility-power-client";
import RolesVNextClient from "./roles-vnext-client";

type TabKey =
  | "build"
  | "power"
  | "entities"
  | "data"
  | "roles";

const tabs: Array<{
  key: TabKey;
  label: string;
  description: string;
  icon: typeof Blocks;
}> = [
  {
    key: "build",
    label: "BUILD",
    description: "Drag ordinary employee inputs + buttons",
    icon: Blocks,
  },
  {
    key: "power",
    label: "POWER",
    description: "Smart blocks, rules, flow, output, runtime",
    icon: BrainCircuit,
  },
  {
    key: "entities",
    label: "ENTITIES",
    description: "Reusable business data, one generic store",
    icon: Boxes,
  },
  {
    key: "data",
    label: "DATA SOURCES",
    description: "Entities + legacy tables + Responsibility records",
    icon: Database,
  },
  {
    key: "roles",
    label: "ROLES",
    description: "Stable tenant Role IDs used by access + flow",
    icon: ShieldCheck,
  },
];

export default function ResponsibilityPlatformStudio() {
  const [tab, setTab] = useState<TabKey>("build");

  return (
    <div className="min-h-full">
      <div className="sticky top-16 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex w-full max-w-[1500px] gap-2 overflow-x-auto">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = item.key === tab;

            return (
              <button
                type="button"
                key={item.key}
                onClick={() => setTab(item.key)}
                className={[
                  "min-w-max rounded-lg border px-4 py-2.5 text-left transition",
                  active
                    ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                    : "hover:bg-muted/50",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "build" && <ResponsibilitiesClient />}

      {tab === "power" && (
        <div className="mx-auto w-full max-w-[1500px] p-4 md:p-6">
          <ResponsibilityPowerClient />
        </div>
      )}

      {tab === "entities" && (
        <div className="mx-auto w-full max-w-[1500px] p-4 md:p-6">
          <EntitiesClient />
        </div>
      )}

      {tab === "data" && (
        <div className="mx-auto w-full max-w-[1500px] p-4 md:p-6">
          <DataSourcesClient />
        </div>
      )}

      {tab === "roles" && (
        <div className="mx-auto w-full max-w-[1500px] p-4 md:p-6">
          <RolesVNextClient />
        </div>
      )}
    </div>
  );
}
