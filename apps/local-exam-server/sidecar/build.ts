import { build } from "esbuild";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function runBuild() {
  // Ensure output dir exists
  if (!fs.existsSync("dist")) fs.mkdirSync("dist");
  
  // Ensure binaries dir exists for Tauri
  const binariesDir = path.join("..", "src-tauri", "binaries");
  if (!fs.existsSync(binariesDir)) fs.mkdirSync(binariesDir, { recursive: true });

  console.log("Bundling sidecar with esbuild...");

  await build({
    entryPoints: ["server.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "dist/server.cjs",
    format: "cjs",
    // better-sqlite3 has a native .node binary — pkg will handle it separately
    // We must mark it as external so esbuild doesn't try to bundle the .node file
    external: ["better-sqlite3"],
  });

  console.log("Packaging sidecar with pkg...");

  // The pkg config is in package.json under "pkg" key.
  // -t node18-win-x64 targets 64-bit Windows.
  // better-sqlite3's native .node is bundled automatically by pkg when listed in assets.
  execSync(
    `npx pkg dist/server.cjs --target node18-win-x64 --output ${path.join(binariesDir, "sidecar-x86_64-pc-windows-msvc.exe")}`,
    { stdio: "inherit" }
  );

  console.log(`\n✅ Sidecar binary ready at: src-tauri/binaries/sidecar-x86_64-pc-windows-msvc.exe`);
}

runBuild().catch(err => {
  console.error("Build failed:", err);
  process.exit(1);
});
