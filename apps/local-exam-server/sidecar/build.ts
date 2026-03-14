import { build } from "esbuild";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function runBuild() {
  console.log("Bundling sidecar using esbuild...");
  
  // Bundle the TypeScript server into a single CommonJS file
  await build({
    entryPoints: ["server.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "dist/server.js",
    format: "cjs",
    external: [], 
  });

  console.log("Packaging sidecar using pkg...");
  
  // Run vercel/pkg to create a native Windows executable
  // -t node18-win-x64 targeting typical 64-bit windows
  execSync("npx pkg dist/server.js -t node18-win-x64 -o ../src-tauri/binaries/sidecar-x86_64-pc-windows-msvc.exe", {
    stdio: "inherit"
  });

  console.log("Done! Tauri Sidecar binary is ready at src-tauri/binaries/sidecar-x86_64-pc-windows-msvc.exe");
}

runBuild().catch(err => {
  console.error(err);
  process.exit(1);
});
