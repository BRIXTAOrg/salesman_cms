// BRIXTA_STATIC_FLUTTER_PREVIEW_V1
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cms = process.cwd();

const flutterRepo =
  process.env.BRIXTA_FLUTTER_REPO ||
  resolve(cms, "../salesapp");

const source = resolve(flutterRepo, "build/web");
const destination = resolve(cms, "public/flutter-preview");

if (!existsSync(resolve(flutterRepo, "pubspec.yaml"))) {
  console.error("[preview:install] Flutter app not found:", flutterRepo);
  process.exit(1);
}

console.log("[preview:install] Building universal Flutter renderer...");

const result = spawnSync(
  "flutter",
  [
    "build",
    "web",
    "--release",
    "--base-href",
    "/flutter-preview/",
  ],
  {
    cwd: flutterRepo,
    stdio: "inherit",
    env: process.env,
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(resolve(source, "index.html"))) {
  console.error(
    "[preview:install] Flutter build succeeded but build/web/index.html is missing.",
  );
  process.exit(1);
}

rmSync(destination, {
  recursive: true,
  force: true,
});

mkdirSync(destination, {
  recursive: true,
});

cpSync(source, destination, {
  recursive: true,
});

writeFileSync(
  resolve(destination, "brixta-preview-build.json"),
  JSON.stringify(
    {
      renderer: "brixta_flutter_web",
      mode: "builder_preview",
      installedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);

console.log("");
console.log("✅ Flutter renderer installed into CMS");
console.log("   /flutter-preview/?brixtaPreview=1");
