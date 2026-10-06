#!/usr/bin/env python3

from pathlib import Path
import json
import os
import subprocess
import sys

CMS = Path.cwd()
APP = CMS.parent / "salesapp"
BACKEND = CMS.parent / "salesapp_backend"

FAILURES = []


def heading(value):
    print("\n" + "=" * 76)
    print(value)
    print("=" * 76)


def run(label, cmd, cwd):
    print("\n" + "-" * 76)
    print(label)
    print("-" * 76)

    result = subprocess.run(
        cmd,
        cwd=cwd,
    )

    if result.returncode != 0:
        raise SystemExit(
            f"\nFAILED: {label}"
        )

    print(f"PASS: {label}")


def git_branch(repo):
    result = subprocess.run(
        [
            "git",
            "branch",
            "--show-current",
        ],
        cwd=repo,
        text=True,
        capture_output=True,
        check=True,
    )

    return result.stdout.strip()


def require_file(path, label):
    if not path.exists():
        FAILURES.append(
            f"{label} missing: {path}"
        )

    return path


def read(path):
    return path.read_text(
        encoding="utf-8",
        errors="replace",
    )


def must_contain(path, value, label):
    if not path.exists():
        return

    if value not in read(path):
        FAILURES.append(
            f"{label}: missing {value!r}"
        )


def must_not_contain(path, value, label):
    if not path.exists():
        return

    if value in read(path):
        FAILURES.append(
            f"{label}: forbidden {value!r}"
        )


heading("BRIXTA RELEASE CHECK")


# ============================================================
# REPOSITORIES
# ============================================================

for repo in [
    CMS,
    APP,
    BACKEND,
]:
    require_file(
        repo / ".git",
        repo.name,
    )


# ============================================================
# SAME BRANCH ACROSS ALL 3 REPOS
# ============================================================

branches = {
    "salesman_cms":
        git_branch(CMS),

    "salesapp":
        git_branch(APP),

    "salesapp_backend":
        git_branch(BACKEND),
}

print("\nBranches:")

for name, branch in branches.items():
    print(
        f"  {name}: {branch}"
    )

if len(set(branches.values())) != 1:
    FAILURES.append(
        "BRIXTA repositories are not on the same branch."
    )


# ============================================================
# ONE BUILDER CONTRACT
# ============================================================

legacy_builder = (
    CMS
    / "src/components/appliance/responsibilities-client.tsx"
)

if legacy_builder.exists():
    FAILURES.append(
        "Legacy Responsibility builder must remain retired: "
        + str(legacy_builder)
    )

unified_route = require_file(
    CMS
    / "src/app/dashboard/workspace/all-responsibilities/page.tsx",
    "Legacy route redirect",
)

must_contain(
    unified_route,
    "/dashboard/workspace/responsibilities",
    "Old Responsibility URL must enter canonical Studio",
)


# ============================================================
# IMPORTANT FILES
# ============================================================

builder = require_file(
    CMS
    / "src/components/appliance/responsibility-app-builder.tsx",
    "App Creator",
)

kernel_client = require_file(
    CMS
    / "src/components/appliance/responsibility-kernel-client.tsx",
    "Responsibility parent",
)

preview = require_file(
    CMS
    / "src/components/appliance/flutter-live-preview.tsx",
    "Flutter preview bridge",
)

assignment_ui = require_file(
    CMS
    / "src/components/appliance/assign-list-work.tsx",
    "Assign Work UI",
)

crm_browser = require_file(
    CMS
    / "src/components/appliance/entity-records-browser.tsx",
    "CRM record browser",
)

crm_api = require_file(
    CMS
    / "src/app/api/platform/entity-records/[id]/route.ts",
    "CRM field activity API",
)

mobile_runtime = require_file(
    APP
    / "lib/features/dynamic/presentation/kernel_responsibility_screen.dart",
    "Flutter Responsibility runtime",
)

preview_runtime = require_file(
    APP
    / "lib/features/dynamic/presentation/builder_preview_app.dart",
    "Flutter Builder Preview runtime",
)

backend_assignment = require_file(
    BACKEND
    / "src/admin/applianceRuntime.ts",
    "Backend assignment API",
)

backend_engine = require_file(
    BACKEND
    / "src/platform/kernel/runtimeEngine.ts",
    "Backend Kernel runtime",
)


# ============================================================
# CREATOR FLOW CONTRACT
# ============================================================

for stage in [
    '"start"',
    '"data"',
    '"design"',
    '"logic"',
    '"users"',
    '"preview"',
    '"publish"',
]:
    must_contain(
        builder,
        stage,
        "Creator stage contract",
    )

must_contain(
    builder,
    "creatorFooter",
    "Creator Back/Next navigation",
)

must_contain(
    builder,
    "embedded",
    "Embedded real Flutter preview",
)


# ============================================================
# UNSAVED-DRAFT PROTECTION
# ============================================================

must_contain(
    kernel_client,
    "setDirty",
    "Dirty draft tracking",
)

must_contain(
    kernel_client,
    "beforeunload",
    "Browser leave protection",
)

must_contain(
    kernel_client,
    'event.key.toLowerCase() === "s"',
    "Cmd/Ctrl-S support",
)

must_contain(
    kernel_client,
    "Unsaved changes",
    "Unsaved status UI",
)


# ============================================================
# FLUTTER PREVIEW ARCHITECTURE
# ============================================================

must_contain(
    preview,
    "/flutter-preview/",
    "Bundled Flutter preview",
)

must_contain(
    preview,
    "embedded",
    "Embedded Flutter preview mode",
)

must_not_contain(
    preview,
    'configured || "http://localhost:5050/"',
    "Old Flutter localhost preview server",
)


# ============================================================
# BUSINESS DATA CONTRACT
# ============================================================

must_contain(
    mobile_runtime,
    "config['source']",
    "Flutter Data Source compatibility",
)

must_contain(
    mobile_runtime,
    "config['sourceKey']",
    "Flutter canonical sourceKey support",
)

must_contain(
    mobile_runtime,
    "config['dataSourceKey']",
    "Flutter dataSourceKey compatibility",
)


# ============================================================
# CRM -> FIELD APP CONTRACT
# ============================================================

must_contain(
    assignment_ui,
    "/api/appliance/work-items",
    "CRM assignment API usage",
)

must_contain(
    backend_assignment,
    '"/work-items"',
    "Backend assignment endpoint",
)

must_contain(
    backend_assignment,
    "sourceRecordIds: string[]",
    "Strongly typed CRM IDs",
)

must_contain(
    backend_assignment,
    "recordLinks",
    "CRM Responsibility traceability",
)

must_contain(
    backend_engine,
    '"in_progress"',
    "Assigned work lifecycle",
)

must_contain(
    backend_engine,
    '"completed"',
    "Completed work lifecycle",
)


# ============================================================
# FIELD RESULT -> CRM CONTRACT
# ============================================================

must_contain(
    crm_api,
    "recordLinks",
    "CRM result linkage",
)

must_contain(
    crm_api,
    "dynamicSubmissions",
    "CRM Responsibility result projection",
)

must_contain(
    crm_browser,
    "Employee input & results",
    "CRM employee-input interface",
)


# ============================================================
# OLD PREVIEW SERVER CONTRACT
# ============================================================
#
# The real production source is checked explicitly above:
#
#   flutter-live-preview.tsx MUST use /flutter-preview/
#   flutter-live-preview.tsx MUST NOT use localhost:5050
#
# Do not globally grep scripts for the literal localhost URL because
# the smoke/release tests themselves intentionally contain that string
# as a forbidden-value assertion.
#
# ============================================================
# STRUCTURAL FAILURES
# ============================================================

if FAILURES:
    print(
        "\nSTRUCTURAL CONTRACT FAILURES:"
    )

    for failure in FAILURES:
        print(
            " - " + failure
        )

    raise SystemExit(1)

print(
    "\nPASS: cross-repository structural contracts"
)


# ============================================================
# BUILD STATIC FLUTTER PREVIEW
# ============================================================

run(
    "FLUTTER STATIC PREVIEW INSTALL",
    [
        "npm",
        "run",
        "preview:install",
    ],
    CMS,
)

preview_index = require_file(
    CMS
    / "public/flutter-preview/index.html",
    "Generated Flutter preview index",
)

require_file(
    CMS
    / "public/flutter-preview/flutter_bootstrap.js",
    "Flutter bootstrap",
)

must_contain(
    preview_index,
    "/flutter-preview/",
    "Flutter Web base href",
)

if FAILURES:
    print(
        "\nFLUTTER PREVIEW CONTRACT FAILURES:"
    )

    for failure in FAILURES:
        print(
            " - " + failure
        )

    raise SystemExit(1)


# ============================================================
# BRIXTA SMOKE
# ============================================================

run(
    "BRIXTA STRUCTURAL SMOKE",
    [
        "npm",
        "run",
        "smoke:brixta",
    ],
    CMS,
)


# ============================================================
# CMS
# ============================================================

run(
    "CMS TYPESCRIPT",
    [
        "npm",
        "run",
        "check",
    ],
    CMS,
)

run(
    "CMS PRODUCTION BUILD",
    [
        "npm",
        "run",
        "build",
    ],
    CMS,
)


# ============================================================
# FLUTTER
# ============================================================

run(
    "FLUTTER ANALYZE",
    [
        "flutter",
        "analyze",
    ],
    APP,
)

test_dir = (
    APP /
    "test"
)

flutter_tests = (
    list(
        test_dir.rglob(
            "*_test.dart"
        )
    )
    if test_dir.exists()
    else []
)

if flutter_tests:
    run(
        "FLUTTER TEST",
        [
            "flutter",
            "test",
        ],
        APP,
    )
else:
    print(
        "\nINFO: no Flutter tests detected; skipping flutter test."
    )


# ============================================================
# BACKEND
# ============================================================

run(
    "BACKEND TYPESCRIPT",
    [
        "npm",
        "run",
        "check",
    ],
    BACKEND,
)

run(
    "BACKEND PRODUCTION BUILD",
    [
        "npm",
        "run",
        "build",
    ],
    BACKEND,
)


# ============================================================
# GIT DIFF SANITY
# ============================================================

for repo in [
    CMS,
    APP,
    BACKEND,
]:
    run(
        f"{repo.name} GIT DIFF CHECK",
        [
            "git",
            "diff",
            "--check",
        ],
        repo,
    )


# ============================================================
# NO LEFTOVER PATCH BACKUPS
# ============================================================

backup_files = []

for repo in [
    CMS,
    APP,
    BACKEND,
]:
    for path in repo.rglob("*"):
        if not path.is_file():
            continue

        if (
            path.name.endswith(
                ".brixta.bak"
            )
            or (
                ".phase-"
                in path.name
                and path.name.endswith(
                    ".bak"
                )
            )
        ):
            backup_files.append(
                path,
            )

if backup_files:
    print(
        "\nFAILED: temporary backup files remain:"
    )

    for path in backup_files:
        print(
            " -",
            path,
        )

    raise SystemExit(1)


# ============================================================
# SUCCESS
# ============================================================

heading(
    "BRIXTA RELEASE CHECK PASSED"
)

print()
print("Architecture:")
print("  CMS Creator")
print("      -> Responsibility Kernel + UI Document")
print("      -> Compiler")
print("      -> Published Manifest")
print("      -> Universal Flutter Runtime")
print()
print("Business data:")
print("  Dealer / Site / Product")
print("      -> Data Source")
print("      -> Searchable Flutter picker")
print("      -> Stable record identity")
print()
print("Field work:")
print("  CRM record")
print("      -> Assign Work")
print("      -> Work Item")
print("      -> Responsibility record")
print("      -> Employee Work inbox")
print("      -> Flutter execution")
print("      -> record_links")
print("      -> CRM Field Work history")
print()
print("Creator:")
print("  START -> DATA -> DESIGN -> LOGIC -> USERS -> PREVIEW -> PUBLISH")
print()
print("No per-Responsibility Flutter project.")
print("No permanent Flutter preview development server.")
print("No fake React runtime replacing Flutter.")
print("No disconnected CSV copy workflow.")

print()
print("MANUAL ACCEPTANCE TEST:")
tests = [
    "Open an existing Responsibility.",
    "Move through Start -> Data -> Design -> Logic -> Users -> Preview -> Publish.",
    "Change a field and verify 'Unsaved changes' appears.",
    "Press Cmd+S and verify the draft becomes Saved.",
    "Open Preview and verify the real Flutter renderer loads.",
    "Open Lists and View records for a Site or Dealer list.",
    "Assign one CRM record to an employee.",
    "Open the employee app and verify the work appears.",
    "Complete or advance the Responsibility.",
    "Return to the CRM record and verify Field Work shows employee, status and captured values.",
]

for index, test in enumerate(
    tests,
    start=1,
):
    print(
        f"  {index}. {test}"
    )

print()
print("Git status:")

for repo in [
    CMS,
    APP,
    BACKEND,
]:
    print(
        f"\n[{repo.name}]"
    )

    subprocess.run(
        [
            "git",
            "status",
            "--short",
        ],
        cwd=repo,
    )
