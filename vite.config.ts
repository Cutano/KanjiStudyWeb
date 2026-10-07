import { defineConfig } from "vitest/config";
import type { ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (
        entry.name.startsWith(".") ||
        entry.name === "data" ||
        entry.name === "sw.js"
      )
        return [];
      return entry.isDirectory() ? walk(path) : [path];
    });
}

let buildConfig: ResolvedConfig;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "offline-shell",
      configResolved(config) {
        if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(config.base)) {
          throw new Error(
            "Use an absolute deployment path such as / or /KanjiStudyWeb/ for --base.",
          );
        }
        buildConfig = config;
      },
      writeBundle() {
        const {
          base,
          build: { outDir },
        } = buildConfig;
        const files = walk(outDir);
        const template = readFileSync("src/service-worker.js", "utf8");
        const version = createHash("sha256");
        version.update(template);
        version.update(base);
        files.forEach((file) =>
          version
            .update(relative(outDir, file))
            .update("\0")
            .update(readFileSync(file)),
        );
        const urls = files.map(
          (file) => `${base}${relative(outDir, file).split("\\").join("/")}`,
        );
        writeFileSync(
          join(outDir, "sw.js"),
          template
            .replace("__APP_BASE__", JSON.stringify(base))
            .replace("__SHELL_VERSION__", version.digest("hex").slice(0, 16))
            .replace("__SHELL_ASSETS__", JSON.stringify(urls)),
        );
      },
    },
  ],
  build: { target: "es2022", chunkSizeWarningLimit: 750 },
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
