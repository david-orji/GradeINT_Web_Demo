import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "@anthropic-ai/sdk",
  "axios",
  "bcryptjs",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "redis",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "p-limit",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

// Resolve @shared/* → <root>/shared/* at build time.
// esbuild does NOT read tsconfig paths automatically.
const sharedAlias = {
  "@shared": path.resolve(root, "shared"),
};

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  const pkg = JSON.parse(await readFile(path.resolve(root, "package.json"), "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  const sharedEsbuildConfig = {
    platform: "node" as const,
    bundle: true,
    format: "cjs" as const,
    alias: sharedAlias,
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info" as const,
  };

  console.log("building server...");
  await esbuild({
    ...sharedEsbuildConfig,
    entryPoints: ["server/index.ts"],
    outfile: "dist/index.cjs",
  });

  console.log("building migrate runner...");
  await esbuild({
    ...sharedEsbuildConfig,
    entryPoints: ["server/migrate.ts"],
    outfile: "dist/migrate.cjs",
    // drizzle-orm migrator reads SQL files from disk at runtime — keep external
    external: [...externals, "drizzle-orm"],
  });

  console.log("build complete.");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
