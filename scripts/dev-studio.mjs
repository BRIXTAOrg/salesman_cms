// BRIXTA_UNIVERSAL_INTEGRATION_V1
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const cms = process.cwd();
const flutter = process.env.BRIXTA_FLUTTER_REPO || resolve(cms, "../salesapp");
const port = process.env.BRIXTA_FLUTTER_PREVIEW_PORT || "5050";

const children = [];

function start(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[dev:studio] ${command} failed:`, error.message);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (typeof code === "number" && code !== 0) shutdown(code);
  });
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 100);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`[dev:studio] Flutter preview: http://localhost:${port}/?brixtaPreview=1`);
console.log(`[dev:studio] Flutter repo: ${flutter}`);

start("flutter", ["run", "-d", "web-server", "--web-port", port], flutter);
start("npm", ["run", "dev"], cms);
