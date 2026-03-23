/**
 * Build script for the GradeINT sidecar (better-sqlite3 + pkg).
 *
 * ROOT CAUSE FIX: pkg embeds a Node.js 18 runtime. The better_sqlite3.node in
 * node_modules is compiled against your LOCAL Node.js (v24), which has a different
 * ABI (v131 vs v108 for Node 18). pkg bundles the .node file but its runtime
 * can't load an incompatible ABI — causing a silent crash on startup.
 *
 * FIX: Before running pkg, download the Node 18-compatible prebuilt binary from
 * better-sqlite3's GitHub releases using prebuild-install. After pkg finishes,
 * restore the original .node so local development still works fine.
 */

import { build } from "esbuild";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const ROOT       = process.cwd();
const DIST       = path.join(ROOT, "dist");
const BINARIES   = path.join(ROOT, "..", "src-tauri", "binaries");

// Path to better_sqlite3.node in node_modules
const NATIVE_PATH = path.join(
  ROOT, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node"
);
// Backup location (temp) to preserve the local dev binary
const BACKUP_PATH = path.join(os.tmpdir(), "better_sqlite3_dev_backup.node");

const OUT_EXE = path.join(
  BINARIES,
  "sidecar-x86_64-pc-windows-msvc.exe"
);

// ─── Ensure dirs ──────────────────────────────────────────────────────────
for (const dir of [DIST, BINARIES]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── Step 1: Bundle with esbuild (mark better-sqlite3 external) ───────────
console.log("1/4  Bundling with esbuild...");
await build({
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: path.join(DIST, "server.cjs"),
  format: "cjs",
  external: ["better-sqlite3"],  // pkg handles the native .node via assets
});

// ─── Step 2: Swap in Node 18 prebuilt ─────────────────────────────────────
// Backup local dev binary first
console.log("2/4  Downloading better_sqlite3.node prebuilt for Node 18...");
if (fs.existsSync(NATIVE_PATH)) {
  fs.copyFileSync(NATIVE_PATH, BACKUP_PATH);
  console.log("     Backed up dev binary to", BACKUP_PATH);
}

// prebuild-install downloads the official prebuilt for the given --target.
// Node 18 uses ABI version 108, which is bundled by pkg (node18-win-x64).
const PREBUILD_BIN = path.join(ROOT, "node_modules", ".bin", "prebuild-install");
execSync(
  `"${PREBUILD_BIN}" --tag-prefix v --target 18.20.4 --runtime node --arch x64 --platform win32`,
  {
    stdio: "inherit",
    cwd: path.join(ROOT, "node_modules", "better-sqlite3"),
  }
);
console.log("     Node 18 prebuilt installed.");

// ─── Step 3: Bundle with pkg ──────────────────────────────────────────────
console.log("3/4  Packaging with pkg (node18-win-x64)...");
execSync(
  `npx pkg dist/server.cjs --target node18-win-x64 --output "${OUT_EXE}"`,
  { stdio: "inherit" }
);

// ─── Step 4: Export native binding as Tauri resource ──────────────────────
// pkg cannot load native .node files from snapshot. We keep it external.
const RESOURCE_DIR = path.join(ROOT, "..", "src-tauri", "resources");
if (!fs.existsSync(RESOURCE_DIR)) fs.mkdirSync(RESOURCE_DIR, { recursive: true });

console.log("4/4  Exporting Node 18 native binding to resources...");
fs.copyFileSync(NATIVE_PATH, path.join(RESOURCE_DIR, "better_sqlite3.node"));

// Restore local dev binary for development
if (fs.existsSync(BACKUP_PATH)) {
  fs.copyFileSync(BACKUP_PATH, NATIVE_PATH);
  console.log("     Restored Node 24 better_sqlite3.node for local development.");
  fs.unlinkSync(BACKUP_PATH);
}

console.log("\n✅ Sidecar ready:", OUT_EXE);
