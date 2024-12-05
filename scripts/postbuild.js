//@ts-check

import { readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../lib/cjs");
const files = readdirSync(join(import.meta.dirname, "../lib/cjs"));

for (const file of files) {
  if (file.endsWith(".js")) {
    const oldPath = join(dir, file);
    const newPath = join(dir, file.replace(".js", ".cjs"));

    renameSync(oldPath, newPath);
  }
}
