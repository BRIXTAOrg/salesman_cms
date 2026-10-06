import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

const cms = process.cwd();

const app =
  resolve(
    cms,
    "../salesapp",
  );

const backend =
  resolve(
    cms,
    "../salesapp_backend",
  );

const failures = [];

function requireFile(
  path,
  label,
) {
  if (
    !existsSync(path)
  ) {
    failures.push(
      `${label} missing: ${path}`,
    );

    return "";
  }

  return readFileSync(
    path,
    "utf8",
  );
}

function requireText(
  content,
  value,
  label,
) {
  if (
    !content.includes(
      value,
    )
  ) {
    failures.push(
      `${label}: expected ${value}`,
    );
  }
}

function forbidText(
  content,
  value,
  label,
) {
  if (
    content.includes(
      value,
    )
  ) {
    failures.push(
      `${label}: forbidden ${value}`,
    );
  }
}

const builder =
  requireFile(
    resolve(
      cms,
      "src/components/appliance/responsibility-app-builder.tsx",
    ),
    "Responsibility creator",
  );

for (
  const stage
  of [
    '"start"',
    '"data"',
    '"design"',
    '"logic"',
    '"users"',
    '"preview"',
    '"publish"',
  ]
) {
  requireText(
    builder,
    stage,
    "Creator stages",
  );
}

const preview =
  requireFile(
    resolve(
      cms,
      "src/components/appliance/flutter-live-preview.tsx",
    ),
    "Flutter preview bridge",
  );

requireText(
  preview,
  "/flutter-preview/",
  "Static Flutter preview",
);

forbidText(
  preview,
  'configured || "http://localhost:5050/"',
  "Flutter preview must not require dev server",
);

requireFile(
  resolve(
    cms,
    "public/flutter-preview/index.html",
  ),
  "Built Flutter Web preview",
);

requireFile(
  resolve(
    cms,
    "src/components/appliance/assign-list-work.tsx",
  ),
  "CRM assignment UI",
);

requireFile(
  resolve(
    cms,
    "src/components/appliance/entity-records-browser.tsx",
  ),
  "CRM record activity UI",
);

requireFile(
  resolve(
    cms,
    "src/app/api/platform/entity-records/[id]/route.ts",
  ),
  "CRM activity API",
);

const flutterRuntime =
  requireFile(
    resolve(
      app,
      "lib/features/dynamic/presentation/kernel_responsibility_screen.dart",
    ),
    "Flutter Responsibility runtime",
  );

requireText(
  flutterRuntime,
  "config['source']",
  "Flutter business-data compatibility",
);

const backendRuntime =
  requireFile(
    resolve(
      backend,
      "src/admin/applianceRuntime.ts",
    ),
    "Backend assignment runtime",
  );

requireText(
  backendRuntime,
  '"/work-items"',
  "Work assignment API",
);

requireText(
  backendRuntime,
  "recordLinks",
  "Canonical record traceability",
);

if (
  failures.length
) {
  console.error(
    "\\n❌ BRIXTA smoke check failed:\\n",
  );

  for (
    const failure
    of failures
  ) {
    console.error(
      " - " + failure,
    );
  }

  process.exit(1);
}

console.log(
  "\\n✅ BRIXTA smoke check passed",
);

console.log(
  "Creator → business data → assignment → Flutter → CRM traceability is structurally present.",
);
