import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "public/licenses");
await mkdir(output, { recursive: true });
await copyFile(path.join(root, "LICENSE"), path.join(output, "LGPL-3.0.txt"));
await copyFile(path.join(root, "COPYING"), path.join(output, "GPL-3.0.txt"));

const packages = [
  "react",
  "react-dom",
  "scheduler",
  "idb",
  "fflate",
  "sql.js",
  "lucide-react",
];
const licenses = [];
for (const name of packages) {
  const directory = path.join(root, "node_modules", name);
  const metadata = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  const license = await readFile(path.join(directory, "LICENSE"), "utf8");
  licenses.push(
    `${name} ${metadata.version}\n${"=".repeat(72)}\n${license.trim()}\n`,
  );
}
await writeFile(
  path.join(output, "DEPENDENCY-LICENSES.txt"),
  licenses.join("\n"),
);
console.log(
  "Prepared project and runtime dependency license texts for offline use.",
);
