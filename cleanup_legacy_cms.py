#!/usr/bin/env python3
"""Remove superseded sales-domain CMS routes after applying Platform Core files.

Dry-run by default. Run with --apply from the salesman_cms repository root.

This script intentionally does NOT touch Drizzle schemas, migration history,
physical tenant tables, auth, or the users-and-team dashboard-access API.
Those are persistence/control-plane concerns and require separate migrations.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

REMOVE = [
    # Legacy sales-domain HTTP routes. Keep dashboardPagesAPI/users-and-team.
    "src/app/api/dashboardPagesAPI/dealerManagement",
    "src/app/api/dashboardPagesAPI/distributorManagement",
    "src/app/api/dashboardPagesAPI/influencerManagement",
    "src/app/api/dashboardPagesAPI/institutionManagement",
    "src/app/api/dashboardPagesAPI/outletManagement",
    "src/app/api/dashboardPagesAPI/permanent-journey-plan",
    "src/app/api/dashboardPagesAPI/reports",
    "src/app/api/dashboardPagesAPI/slm-attendance",
    "src/app/api/dashboardPagesAPI/slm-geotracking",
    "src/app/api/dashboardPagesAPI/slm-leaves",
    "src/app/api/dashboardPagesAPI/tadaBill",
    "src/app/api/dashboardPagesAPI/update-location",
    "src/app/api/mobileWorkspace",
    "src/app/api/custom-report-generator",

    # Direct-DB Workspace APIs superseded by /api/appliance -> backend.
    "src/app/api/workspace/work",
    "src/app/api/workspace/workflows",

    # Legacy sales-domain dashboard pages.
    "src/app/dashboard/dealerManagement",
    "src/app/dashboard/distributorManagement",
    "src/app/dashboard/influencerManagement",
    "src/app/dashboard/institutionManagement",
    "src/app/dashboard/outletManagement",
    "src/app/dashboard/permanentJourneyPlan",
    "src/app/dashboard/reports",
    "src/app/dashboard/slmAttendance",
    "src/app/dashboard/slmGeotracking",
    "src/app/dashboard/slmLeaves",
    "src/app/dashboard/tadaBill",

    # Backend Platform Core no longer exposes these old appliance surfaces.
    "src/app/dashboard/workforce/devices",
    "src/app/dashboard/administration/setup",
    "src/components/appliance/devices-client.tsx",
    "src/components/appliance/setup-client.tsx",

    # Legacy report/UI helpers tied to the removed sales-domain pages.
    "src/app/home/customReportGenerator",
    "src/app/home/page.tsx",
    "src/app/home/layout.tsx",
    "src/app/home/homeShell.tsx",
    "src/lib/reports-transformer.ts",
    "src/components/conditionalSidebar.tsx",
    "src/app/dashboard/data-format.ts",
    "src/app/dashboard/linearGraphs.tsx",
    "src/app/dashboard/pieGraphs.tsx",
]


def remove_path(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists() or path.is_symlink():
        path.unlink()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete the listed legacy paths.",
    )
    args = parser.parse_args()

    root = Path.cwd()
    package = root / "package.json"
    if not package.exists():
        raise SystemExit(
            "Run this script from the salesman_cms repository root (package.json not found)."
        )

    existing = [Path(item) for item in REMOVE if (root / item).exists()]
    missing = [Path(item) for item in REMOVE if not (root / item).exists()]

    print("BRIXTA salesman_cms Platform Core cleanup")
    print(f"mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print()

    if existing:
        print("Paths that will be removed:")
        for item in existing:
            print(f"  - {item}")
    else:
        print("No listed legacy paths are currently present.")

    if missing:
        print()
        print(f"Already absent: {len(missing)} path(s)")

    if not args.apply:
        print()
        print("Nothing changed. Re-run with --apply when ready.")
        return 0

    for item in existing:
        remove_path(root / item)

    print()
    print(f"Removed {len(existing)} legacy path(s).")
    print("Drizzle schema/migration history and dashboard-access APIs were left untouched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
