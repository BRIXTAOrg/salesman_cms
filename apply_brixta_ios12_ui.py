#!/usr/bin/env python3
"""
BRIXTA CMS — Apple/iOS 12 inspired UI + declutter pass.

Run:
    python3 apply_brixta_ios12_ui.py \
      --repo /path/to/salesman_cms \
      --image "/path/to/brixta-work-hero(1).jpg"

The script backs up changed source files under:
    .brixta-ui-backup/<timestamp>/
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

THEME_START = "/* BRIXTA_IOS12_UI_START */"
THEME_END = "/* BRIXTA_IOS12_UI_END */"

THEME_CSS = r'''
/* BRIXTA_IOS12_UI_START */

:root {
  --radius: 0.875rem;

  --background: #F2F2F7;
  --foreground: #1C1C1E;
  --card: #FFFFFF;
  --card-foreground: #1C1C1E;
  --popover: #FFFFFF;
  --popover-foreground: #1C1C1E;

  --primary: #5477A6;
  --primary-foreground: #FFFFFF;
  --secondary: #E9E9EE;
  --secondary-foreground: #1C1C1E;
  --muted: #ECECF1;
  --muted-foreground: #6E6E73;
  --accent: #E7ECF3;
  --accent-foreground: #1C1C1E;

  --destructive: #C9343A;
  --border: #DCDCE2;
  --input: #D1D1D6;
  --ring: #5477A6;

  --sidebar: #1C1C1E;
  --sidebar-foreground: #F5F5F7;
  --sidebar-primary: #6F8FB8;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #2C2C2E;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #38383A;
  --sidebar-ring: #7D9CC2;
  --sidebar-sub-item-active-bg: #2C2C2E;
  --sidebar-sub-item-active-foreground: #FFFFFF;

  --brixta-shadow-sm:
    0 1px 2px rgba(28, 28, 30, 0.04),
    0 5px 16px rgba(28, 28, 30, 0.045);

  --brixta-shadow:
    0 2px 4px rgba(28, 28, 30, 0.035),
    0 14px 36px rgba(28, 28, 30, 0.065);

  --brixta-shadow-float:
    0 8px 18px rgba(28, 28, 30, 0.06),
    0 24px 48px rgba(28, 28, 30, 0.07);
}

.dark {
  --background: #1C1C1E;
  --foreground: #F5F5F7;
  --card: #2C2C2E;
  --card-foreground: #F5F5F7;
  --popover: #2C2C2E;
  --popover-foreground: #F5F5F7;
  --primary: #7D9CC2;
  --primary-foreground: #FFFFFF;
  --secondary: #3A3A3C;
  --secondary-foreground: #F5F5F7;
  --muted: #3A3A3C;
  --muted-foreground: #AEAEB2;
  --accent: #3A3A3C;
  --accent-foreground: #FFFFFF;
  --border: #48484A;
  --input: #545458;
  --ring: #7D9CC2;
  --sidebar: #151517;
  --sidebar-foreground: #F5F5F7;
  --sidebar-accent: #2C2C2E;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #38383A;
}

/* Shared CMS shell. Your supplied image is used directly; no CSS blur. */
.brixta-cms-shell {
  position: relative;
  isolation: isolate;
  background-color: #F2F2F7 !important;
  background-image:
    linear-gradient(
      rgba(242, 242, 247, 0.82),
      rgba(242, 242, 247, 0.91)
    ),
    url("/brand/brixta-soft-field.jpg");
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center top;
  background-attachment: fixed;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.brixta-cms-shell > main {
  position: relative;
  z-index: 1;
}

.brixta-cms-shell :where(
  section,
  header,
  nav,
  aside,
  [role="dialog"],
  [role="tablist"]
) {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* Header */
.brixta-site-header {
  background: #F2F2F7 !important;
  border-bottom: 0 !important;
  min-height: 68px !important;
}

.brixta-site-header > div {
  padding-inline: clamp(18px, 2vw, 30px);
}

.brixta-site-header input {
  background: #FFFFFF !important;
}

.brixta-site-header [class*="rounded-md"][class*="border"] {
  border-color: rgba(60, 60, 67, 0.10) !important;
  border-radius: 14px !important;
  box-shadow: var(--brixta-shadow-sm);
}

/* Sidebar */
.brixta-sidebar {
  --sidebar: #1C1C1E;
  --sidebar-foreground: #F5F5F7;
  --sidebar-accent: #2C2C2E;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #38383A;
}

.brixta-sidebar [data-sidebar="sidebar"] {
  background: #1C1C1E !important;
  color: #F5F5F7 !important;
  border-right: 0 !important;
}

.brixta-sidebar [data-sidebar="header"] {
  border-bottom-color: rgba(255, 255, 255, 0.07) !important;
}

.brixta-sidebar [data-sidebar="menu-button"] {
  min-height: 40px;
  border-radius: 12px !important;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.brixta-sidebar [data-sidebar="menu-button"]:hover {
  background: #2C2C2E !important;
}

.brixta-sidebar [data-sidebar="group-label"] {
  color: #8E8E93 !important;
}

/* Solid iOS-style surfaces. No glass. */
.brixta-panel,
.card-premium,
.brixta-responsibility-bar,
.brixta-studio-tabs,
.brixta-ai-brief {
  background: #FFFFFF !important;
  border: 1px solid rgba(60, 60, 67, 0.075) !important;
  box-shadow: var(--brixta-shadow-sm) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.brixta-panel,
.brixta-responsibility-bar,
.brixta-ai-brief {
  border-radius: 20px !important;
}

.brixta-studio-tabs {
  border-radius: 18px !important;
}

.brixta-studio-tab {
  min-height: 42px;
  border-radius: 13px;
  color: #6E6E73;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.brixta-studio-tab:hover {
  background: #F2F2F7;
  color: #1C1C1E;
}

.brixta-studio-tab[data-active="true"] {
  background: #E8EEF5;
  color: #355A84;
  font-weight: 600;
}

.brixta-responsibility-bar {
  padding: 18px !important;
}

.brixta-role-targets {
  border-top: 1px solid rgba(60, 60, 67, 0.08);
  padding-top: 12px;
}

.brixta-role-targets > summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
}

.brixta-role-targets > summary::-webkit-details-marker {
  display: none;
}

.brixta-role-targets[open] .brixta-role-chevron {
  transform: rotate(180deg);
}

.brixta-role-chevron {
  transition: transform 160ms ease;
}

/* Buttons */
.brixta-primary-button,
.brixta-secondary-button {
  border-radius: 12px !important;
  min-height: 40px;
  font-weight: 600;
  box-shadow: none !important;
}

.brixta-primary-button {
  background: #5477A6 !important;
}

.brixta-primary-button:hover {
  background: #486A98 !important;
}

.brixta-secondary-button {
  background: #FFFFFF !important;
  border: 1px solid rgba(60, 60, 67, 0.10) !important;
  box-shadow: var(--brixta-shadow-sm) !important;
}

.brixta-secondary-button:hover {
  background: #F7F7FA !important;
}

/* Fields */
.brixta-input,
.brixta-textarea {
  border-radius: 12px !important;
  border: 1px solid rgba(60, 60, 67, 0.10) !important;
  background: #F7F7FA !important;
  box-shadow: inset 0 1px 0 rgba(28, 28, 30, 0.02) !important;
}

.brixta-input:focus,
.brixta-textarea:focus {
  border-color: rgba(84, 119, 166, 0.65) !important;
  box-shadow: 0 0 0 3px rgba(84, 119, 166, 0.12) !important;
}

/* Compact AI builder */
.brixta-ai-brief {
  margin-bottom: 16px !important;
}

.brixta-ai-brief > div:first-child {
  padding: 16px 18px !important;
  gap: 12px !important;
}

.brixta-ai-brief > div:last-child {
  padding: 18px !important;
}

.brixta-ai-brief h2 {
  font-size: 1.05rem !important;
  line-height: 1.35 !important;
}

.brixta-ai-brief textarea {
  min-height: 118px !important;
}

body {
  background: #F2F2F7 !important;
  color: #1C1C1E;
  font-family:
    var(--font-geist-sans),
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Text",
    "SF Pro Display",
    "Helvetica Neue",
    Arial,
    sans-serif;
}

h1,
h2,
h3 {
  letter-spacing: -0.025em;
}

::selection {
  background: rgba(84, 119, 166, 0.20);
}

@media (prefers-reduced-motion: reduce) {
  .brixta-studio-tab,
  .brixta-primary-button,
  .brixta-secondary-button,
  .brixta-role-chevron {
    transition: none !important;
  }
}

/* BRIXTA_IOS12_UI_END */
'''

PLATFORM_STUDIO = '''"use client";

import { useState } from "react";
import { Boxes, BrainCircuit, Database, GitBranch } from "lucide-react";

import DataSourcesClient from "./data-sources-client";
import EntitiesClient from "./entities-client";
import PixelLogicStudioClient from "./pixel-logic-studio-client";
import ResponsibilityKernelClient from "./responsibility-kernel-client";

// BRIXTA_PIXEL_LOGIC_KERNEL_V1
type TabKey = "studio" | "logic" | "entities" | "data";

const tabs = [
  { key: "studio" as const, label: "Studio", icon: BrainCircuit },
  { key: "logic" as const, label: "Logic", icon: GitBranch },
  { key: "entities" as const, label: "Entities", icon: Boxes },
  { key: "data" as const, label: "Connections", icon: Database },
];

export default function ResponsibilityPlatformStudio() {
  const [tab, setTab] = useState<TabKey>("studio");

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden">
      <div className="relative z-10 px-3 pt-3 sm:px-4 md:px-6">
        <div
          className="brixta-studio-tabs grid w-full grid-cols-4 gap-1 p-1.5"
          role="tablist"
          aria-label="Responsibility workspace"
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = item.key === tab;

            return (
              <button
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active ? "true" : "false"}
                key={item.key}
                onClick={() => setTab(item.key)}
                className="brixta-studio-tab flex min-w-0 items-center justify-center gap-2 px-3 py-2 text-sm"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "studio" && (
        <div className="w-full min-w-0 px-3 pb-6 pt-4 sm:px-4 md:px-6">
          <ResponsibilityKernelClient />
        </div>
      )}

      {tab === "logic" && (
        <div className="w-full min-w-0 px-3 pb-6 pt-4 sm:px-4 md:px-6">
          <PixelLogicStudioClient />
        </div>
      )}

      {tab === "entities" && (
        <div className="w-full min-w-0 px-3 pb-6 pt-4 sm:px-4 md:px-6">
          <EntitiesClient />
        </div>
      )}

      {tab === "data" && (
        <div className="w-full min-w-0 px-3 pb-6 pt-4 sm:px-4 md:px-6">
          <DataSourcesClient />
        </div>
      )}
    </div>
  );
}
'''


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--repo", type=Path, default=Path.cwd())
    p.add_argument("--image", type=Path, required=True)
    return p.parse_args()


def require_file(path: Path) -> None:
    if not path.is_file():
        raise SystemExit(f"Required file not found: {path}")


def backup_file(repo: Path, path: Path, backup_root: Path) -> None:
    rel = path.relative_to(repo)
    dest = backup_root / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def write_changed(repo: Path, path: Path, new_text: str, backup_root: Path) -> bool:
    old_text = path.read_text(encoding="utf-8")
    if old_text == new_text:
        print(f"unchanged  {path.relative_to(repo)}")
        return False
    backup_file(repo, path, backup_root)
    path.write_text(new_text, encoding="utf-8")
    print(f"changed    {path.relative_to(repo)}")
    return True


def replace_literal(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(
            f"Could not find expected source fragment for {label}. "
            "Your local branch may differ from the current main branch."
        )
    return text.replace(old, new, 1)


def patch_theme_css(repo: Path, backup_root: Path) -> None:
    path = repo / "src/app/globals.css"
    require_file(path)
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(THEME_START) + r".*?" + re.escape(THEME_END), re.DOTALL)
    text = pattern.sub("", text).rstrip() + "\n\n" + THEME_CSS.strip() + "\n"
    write_changed(repo, path, text, backup_root)


def patch_root_layout(repo: Path, backup_root: Path) -> None:
    path = repo / "src/app/layout.tsx"
    require_file(path)
    text = path.read_text(encoding="utf-8")
    text = text.replace('<html lang="en" className="dark">', '<html lang="en">')
    write_changed(repo, path, text, backup_root)


def patch_dashboard_shell(repo: Path, backup_root: Path) -> None:
    path = repo / "src/app/dashboard/dashboardShell.tsx"
    require_file(path)
    text = path.read_text(encoding="utf-8")
    text = replace_literal(
        text,
        '<SidebarInset className="min-h-svh bg-muted/15">',
        '<SidebarInset className="brixta-cms-shell min-h-svh">',
        "dashboard shell",
    )
    write_changed(repo, path, text, backup_root)


def patch_sidebar(repo: Path, backup_root: Path) -> None:
    path = repo / "src/components/app-sidebar.tsx"
    require_file(path)
    text = path.read_text(encoding="utf-8")
    if '<Sidebar className="brixta-sidebar">' not in text:
        text = replace_literal(text, "<Sidebar>", '<Sidebar className="brixta-sidebar">', "sidebar")
    text = text.replace('className="border-b px-3 py-4"', 'className="border-b px-4 py-5"')
    text = text.replace('className="px-2 py-3"', 'className="px-3 py-3"')
    write_changed(repo, path, text, backup_root)


def patch_site_header(repo: Path, backup_root: Path) -> None:
    path = repo / "src/components/site-header.tsx"
    require_file(path)
    text = path.read_text(encoding="utf-8")
    old = '<header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center border-b bg-background">'
    new = '<header className="brixta-site-header sticky top-0 z-30 flex min-h-16 shrink-0 items-center">'
    text = replace_literal(text, old, new, "site header")
    write_changed(repo, path, text, backup_root)


def patch_primitives(repo: Path, backup_root: Path) -> None:
    path = repo / "src/components/appliance/primitives.tsx"
    require_file(path)
    text = path.read_text(encoding="utf-8")

    replacements = [
        (
            '"rounded-lg border border-border bg-card p-6 shadow-none",',
            '"brixta-panel rounded-[20px] border bg-card p-6",',
        ),
        (
            '<div className="rounded-lg border border-border bg-card px-6 py-5 shadow-none">',
            '<div className="brixta-panel rounded-[20px] border bg-card px-6 py-5">',
        ),
        (
            '"inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground shadow-none hover:bg-primary/90",',
            '"brixta-primary-button inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 text-[14px] font-medium text-primary-foreground",',
        ),
        (
            '"inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-transparent px-4 text-[14px] font-medium text-foreground shadow-none hover:bg-muted",',
            '"brixta-secondary-button inline-flex h-10 items-center justify-center gap-2 px-4 text-[14px] font-medium text-foreground",',
        ),
        (
            '  "h-10 w-full rounded-md border border-input bg-background px-3 text-[14px] leading-5 text-foreground shadow-none outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background";',
            '  "brixta-input h-10 w-full px-3 text-[14px] leading-5 text-foreground outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-muted-foreground/70";',
        ),
        (
            '  "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-[14px] leading-6 text-foreground shadow-none outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background";',
            '  "brixta-textarea min-h-24 w-full px-3 py-2 text-[14px] leading-6 text-foreground outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-muted-foreground/70";',
        ),
    ]

    for old, new in replacements:
        if new in text:
            continue
        if old not in text:
            raise RuntimeError("primitives.tsx differs from expected main-branch source")
        text = text.replace(old, new, 1)

    write_changed(repo, path, text, backup_root)


def patch_platform_studio(repo: Path, backup_root: Path) -> None:
    path = repo / "src/components/appliance/responsibility-platform-studio.tsx"
    require_file(path)
    write_changed(repo, path, PLATFORM_STUDIO, backup_root)


def patch_responsibility_kernel(repo: Path, backup_root: Path) -> None:
    path = repo / "src/components/appliance/responsibility-kernel-client.tsx"
    require_file(path)
    text = path.read_text(encoding="utf-8")

    text = text.replace(
        'className="rounded-2xl border bg-background/95 p-3 shadow-sm sm:p-4"',
        'className="brixta-responsibility-bar"',
    )

    old_roles = '''        {roles.length > 0 && selectedResponsibility && (
          <div className="mt-3 rounded-lg border bg-muted/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium">
              <UsersRound className="h-3.5 w-3.5" />
              This Responsibility is for
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleTargetRole(role.id)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs transition",
                    targetRoleIds.includes(role.id)
                      ? "border-primary bg-primary/[0.08] text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
        )}'''

    new_roles = '''        {roles.length > 0 && selectedResponsibility && (
          <details className="brixta-role-targets mt-3">
            <summary className="flex items-center justify-between gap-3 rounded-xl px-1 py-1 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <UsersRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">
                  Used by {targetRoleIds.length} role{targetRoleIds.length === 1 ? "" : "s"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {roles
                    .filter((role) => targetRoleIds.includes(role.id))
                    .slice(0, 3)
                    .map((role) => role.label)
                    .join(" · ")}
                  {targetRoleIds.length > 3 ? ` · +${targetRoleIds.length - 3}` : ""}
                </span>
              </div>
              <ChevronDown className="brixta-role-chevron h-4 w-4 shrink-0 text-muted-foreground" />
            </summary>

            <div className="mt-3 flex flex-wrap gap-2 px-1 pb-1">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleTargetRole(role.id)}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    targetRoleIds.includes(role.id)
                      ? "border-primary/30 bg-primary/10 text-foreground"
                      : "border-border bg-white text-muted-foreground hover:bg-muted",
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </details>
        )}'''

    if new_roles not in text:
        if old_roles not in text:
            raise RuntimeError("Could not find role-target block in responsibility-kernel-client.tsx")
        text = text.replace(old_roles, new_roles, 1)

    old_reload = '''            <SecondaryButton
              type="button"
              disabled={!responsibilityId || loading}
              onClick={() =>
                responsibilityId && void loadDetail(responsibilityId)
              }
            >
              <RefreshCw className="h-4 w-4" /> Reload
            </SecondaryButton>'''

    new_reload = '''            <SecondaryButton
              type="button"
              className="w-10 px-0"
              aria-label="Reload Responsibility"
              title="Reload Responsibility"
              disabled={!responsibilityId || loading}
              onClick={() =>
                responsibilityId && void loadDetail(responsibilityId)
              }
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Reload</span>
            </SecondaryButton>'''

    if new_reload not in text:
        if old_reload not in text:
            raise RuntimeError("Could not patch Responsibility reload control")
        text = text.replace(old_reload, new_reload, 1)

    write_changed(repo, path, text, backup_root)


def patch_ai_builder(repo: Path, backup_root: Path) -> None:
    path = repo / "src/components/appliance/ai-builder-brief.tsx"
    require_file(path)
    text = path.read_text(encoding="utf-8")
    text = replace_literal(
        text,
        '    <section className="mb-6 rounded-lg border border-border bg-card shadow-none">',
        '    <section className="brixta-ai-brief">',
        "AI builder",
    )
    write_changed(repo, path, text, backup_root)


def patch_workspace_manifest(repo: Path, backup_root: Path) -> None:
    path = repo / "src/lib/workspace-manifest.ts"
    require_file(path)
    text = path.read_text(encoding="utf-8")

    active_block = '''  for (const responsibility of activeResponsibilities) {
    addNav(nav, "Field App Control", {
      key: `responsibility:${responsibility.key}`,
      label: responsibility.title,
      href: `/dashboard/work/${encodeURIComponent(responsibility.key)}`,
      icon: responsibility.icon || "blocks",
      description: responsibility.description,
      section: "Responsibilities Created",
    });
  }
'''

    active_replacement = '''  /*
   * BRIXTA_IOS12_DECLUTTER_V1
   * Individual Responsibilities are intentionally omitted from permanent
   * global navigation. "All Responsibilities" remains the stable entry point.
   */
'''

    if active_replacement not in text:
        if active_block not in text:
            raise RuntimeError("Could not locate active Responsibility sidebar loop")
        text = text.replace(active_block, active_replacement, 1)

    archived_block = '''  for (const responsibility of archivedResponsibilities) {
    addNav(nav, "Field App Control", {
      key: `archived:${responsibility.key}`,

      label: responsibility.title,

      href: `/dashboard/archive/${encodeURIComponent(responsibility.key)}`,

      icon: "archive",

      description: "Archived Responsibility — historical records only.",

      section: "Archived Responsibilities",
    });
  }
'''

    archived_replacement = '''  /* Archived Responsibilities stay accessible through All Responsibilities. */
'''

    if archived_replacement not in text and archived_block in text:
        text = text.replace(archived_block, archived_replacement, 1)

    write_changed(repo, path, text, backup_root)


def copy_brand_image(repo: Path, source: Path) -> str:
    if not source.is_file():
        raise SystemExit(f"Image not found: {source}")

    suffix = source.suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise SystemExit("Image must be jpg/jpeg/png/webp")

    destination_dir = repo / "public/brand"
    destination_dir.mkdir(parents=True, exist_ok=True)

    if suffix in {".jpg", ".jpeg"}:
        destination = destination_dir / "brixta-soft-field.jpg"
        public_url = "/brand/brixta-soft-field.jpg"
    else:
        destination = destination_dir / f"brixta-soft-field{suffix}"
        public_url = f"/brand/brixta-soft-field{suffix}"

    shutil.copy2(source, destination)
    print(f"copied     {destination.relative_to(repo)}")
    return public_url


def point_css_to_image(repo: Path, public_url: str) -> None:
    path = repo / "src/app/globals.css"
    text = path.read_text(encoding="utf-8")
    text = re.sub(
        r'url\("/brand/brixta-soft-field(?:\.jpg|\.jpeg|\.png|\.webp)"\)',
        f'url("{public_url}")',
        text,
    )
    path.write_text(text, encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo = args.repo.expanduser().resolve()
    image = args.image.expanduser().resolve()

    if not (repo / "package.json").is_file():
        raise SystemExit(f"{repo} does not look like salesman_cms")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = repo / ".brixta-ui-backup" / timestamp

    try:
        patch_theme_css(repo, backup_root)
        public_url = copy_brand_image(repo, image)
        point_css_to_image(repo, public_url)

        patch_root_layout(repo, backup_root)
        patch_dashboard_shell(repo, backup_root)
        patch_sidebar(repo, backup_root)
        patch_site_header(repo, backup_root)
        patch_primitives(repo, backup_root)
        patch_platform_studio(repo, backup_root)
        patch_responsibility_kernel(repo, backup_root)
        patch_ai_builder(repo, backup_root)
        patch_workspace_manifest(repo, backup_root)

    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        print(f"Backups are at: {backup_root}", file=sys.stderr)
        raise SystemExit(1)

    print("\nBRIXTA iOS-12 UI + declutter pass applied.")
    print(f"Backups: {backup_root}")
    print("\nRun:")
    print("  npm run build")
    print("  npm run dev")
    print("\nReview:")
    print("  /dashboard")
    print("  /dashboard/workspace/responsibilities")
    print("  /dashboard/workspace/assignments")
    print("  /dashboard/workforce/organization")


if __name__ == "__main__":
    main()
