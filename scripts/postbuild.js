//@ts-check

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../lib/cjs");

const content = JSON.stringify({ type: "commonjs" });
writeFileSync(join(dir, "package.json"), content);
