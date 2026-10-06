// BRIXTA_UNIVERSAL_INTEGRATION_V2
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const cms = process.cwd();
const previewIndex = resolve(cms, "public/flutter-preview/index.html");

if (existsSync(previewIndex)) {
  console.log("[dev:studio] Flutter preview: /flutter-preview/?brixtaPreview=1");
  console.log("[dev:studio] Using static Flutter renderer bundled with CMS.");
} else {
  console.warn("[dev:studio] Flutter preview bundle is not installed.");
  console.warn("[dev:studio] Run: npm run preview:install");
}

const child = spawn("npm", ["run", "dev"], {
  cwd: cms,
  stdio: "inherit",
  env: process.env,
});

function shutdown(code = 0) {
  if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 100);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

child.on("error", (error) => {
  console.error("[dev:studio] CMS failed:", error.message);
  shutdown(1);
});

child.on("exit", (code, signal) => {
  if (signal) return;
  process.exit(typeof code === "number" ? code : 0);
});
