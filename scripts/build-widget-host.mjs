/**
 * Production artifact for widget.toncast.me:
 * - SPA: examples/widget-constructor/dist/
 * - CDN: examples/widget-constructor/dist/v0/index.iife.js
 */
import { cp, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "examples/widget-constructor/dist");
const iifeSrc = join(root, "packages/widget/dist/iife/index.iife.js");
const iifeDest = join(distDir, "v0/index.iife.js");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
  });
}

// Workspace packages export ./dist/* — build deps before widget IIFE (esbuild resolves via package.json).
for (const workspace of ["@toncast/sdk", "@toncast/sdk-react", "@toncast/widget"]) {
  await run("npm", ["run", "build", "--workspace", workspace]);
}
await run("npm", ["run", "build", "--workspace", "@toncast/widget-constructor"]);
await mkdir(join(distDir, "v0"), { recursive: true });
await cp(iifeSrc, iifeDest);
console.log(`[build-widget-host] ${iifeDest}`);
