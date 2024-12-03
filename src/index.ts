import { merge, set as timmSet } from "timm";
import Mustache from "mustache";
import type { OpeningAndClosingTags } from "mustache";
import Papa from "papaparse";
import { readFileSync } from "node:fs";
import YAML from 'yaml';

const TEMPLATE_TAGS: OpeningAndClosingTags = ["<<", ">>"];
const CSV_PARSE_OPTIONS = {
  header: true,
  delimiter: ",",
  dynamicTyping: true,
  comments: "#",
  skipEmptyLines: true,
};

// ====================================
// Types
// ====================================
type Context = Record<string, any>;
type Tree = any;
type Options = {
  // Note: this will remove `undefined` property values and functions
  noDeepCopies?: boolean;
};

// ====================================
// Main
// ====================================
const tri = (tree: Tree, options: Options = {}): Tree => {
  if (tree == null || typeof tree !== "object") return tree;
  const { $definitions: ctx = {}, ...other } = tree;
  const mustacheEscape = Mustache.escape;
  Mustache.escape = (str) => str;
  let out = _process(other, ctx);
  Mustache.escape = mustacheEscape;
  if (options.noDeepCopies) {
    out = JSON.parse(JSON.stringify(out));
  }
  return out;
};

// ====================================
// Recursive processor
// ====================================
const _process = (tree: Tree, ctx: Context) => {
  // Array
  if (Array.isArray(tree)) {
    const arr = tree;
    tree = [];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (isExplodingObjectCall(item)) {
        const results = _objectCall(item, ctx);
        if (!Array.isArray(results))
          throw new Error(
            `INVALID_EXPLODED_CALL ${JSON.stringify(item, null, 2)}`
          );
        tree = tree.concat(results);
      } else if (isExplodingShortCall(item)) {
        const results = _shortCall(item, ctx);
        if (!Array.isArray(results))
          throw new Error(`INVALID_EXPLODED_SHORT_CALL ${item}`);
        tree = tree.concat(results);
      } else {
        tree.push(_process(item, ctx));
      }
    }
    // Object
  } else if (tree != null && typeof tree === "object") {
    if (tree.$call) tree = _objectCall(tree, ctx);
    else if (tree.$merge !== undefined) tree = _merge(tree, ctx);
    else if (tree.$concatenate !== undefined) tree = _concat(tree, ctx);
    else if (tree.$csv !== undefined) tree = _csv(tree, ctx);
    else if (tree.$yaml !== undefined) tree = _yaml(tree, ctx);
    else tree = _object(tree, ctx);

    // String
  } else if (typeof tree === "string") {
    if (tree[0] === "$") tree = _shortCall(tree, ctx);
    else tree = _interpolate(tree, ctx);
  }

  return tree;
};

// ====================================
// Microprocessors ;)
// ====================================
const _objectCall = (tree: Tree, ctx: Context) => {
  const name = tree.$call;
  const optional = Boolean(tree.$optional);
  ctx = merge(ctx, tree.$params);
  const definition = ctx[name];
  if (definition === undefined && !optional)
    throw new Error(`MISSING_DEFINITION ${name}`);

  // Multiple calls (using $forEach)
  if (tree.$forEach) {
    const data = _process(tree.$forEach, ctx);
    if (!Array.isArray(data))
      throw new Error(`SYNTAX_ERROR $forEach should always contain an array`);
    let results = data.map((item) => _process(definition, merge(ctx, item)));
    if (tree.$explode) {
      results = results.reduce((acc, item) => acc.concat(item), []);
    }
    return results;
  }

  // Single call
  return _process(definition, ctx);
};

const _shortCall = (tree: Tree, ctx: Context) => {
  let name = tree.slice(1);
  if (name[0] === "*") name = name.slice(1);
  let optional = false;
  if (name[name.length - 1] === "?") {
    optional = true;
    name = name.slice(0, name.length - 1);
  }
  const out = ctx[name];
  if (out === undefined && !optional)
    throw new Error(`MISSING_DEFINITION ${name}`);
  return _process(out, ctx);
};

const _merge = (tree: Tree, ctx: Context) => {
  const arr = tree.$merge;
  if (!Array.isArray(arr))
    throw new Error(`SYNTAX_ERROR $merge should always contain an array`);
  return merge({}, ...arr.map((o) => _process(o, ctx)));
};

const _concat = (tree: Tree, ctx: Context) => {
  const arr = tree.$concatenate;
  if (!Array.isArray(arr))
    throw new Error(`SYNTAX_ERROR $concatenate should always contain an array`);
  let out: any = [];
  for (let i = 0; i < arr.length; i++) {
    out = out.concat(_process(arr[i], ctx));
  }
  return out;
};

// CSV can be (i) directly the CSV content as a string, or (ii) a path, of the form:
// - $csv: './myFile.csv'
// - $csv: 'file:///home/user/myFile.csv'
const _csv = (tree: Tree, ctx: Context) => {
  let csv = tree.$csv;
  if (typeof csv !== "string")
    throw new Error(`SYNTAX_ERROR $csv should always contain a string`);

  // If the user is passing a path, resolve it and read its contents as a string
  if (csv.startsWith("./") || csv.startsWith("file:/")) {
    const { pathname } = new URL(
      csv,
      `file://${process.cwd()}/` /* does nothing if csv is a URL */
    );
    csv = readFileSync(pathname, "utf8");
  }

  csv = csv.trim();
  csv = _interpolate(csv, ctx);
  const parsed = Papa.parse(csv, CSV_PARSE_OPTIONS);
  if (parsed.errors.length > 0) {
    const err = parsed.errors[0];
    throw new Error(`CSV_PARSE_ERROR ${err.message} (row ${err.row})`);
  }
  const out = parsed.data;
  const jsonParse = tree.$json ?? [];
  for (let i = 0; i < out.length; i++) {
    const row = out[i] as Record<string, any>;
    for (let j = 0; j < jsonParse.length; j++) {
      const key = jsonParse[j];
      if (row[key] != null) row[key] = JSON.parse(row[key]);
    }
  }
  return out;
};

// YAML can be (i) directly the YAML content as a string, or (ii) a path, of the form:
// - $yaml: './myFile.yaml'
// - $yaml: 'file:///home/user/myFile.yaml'
const _yaml = (tree: Tree, ctx: Context) => {
  let yaml = tree.$yaml;
  if (typeof yaml !== "string")
    throw new Error(`SYNTAX_ERROR $yaml should always contain a string`);

  // If the user is passing a path, resolve it and read its contents as a string
  if (yaml.startsWith("./") || yaml.startsWith("file:/")) {
    const { pathname } = new URL(
      yaml,
      `file://${process.cwd()}/` /* does nothing if yaml is a URL */
    );
    yaml = readFileSync(pathname, "utf8");
  }

  yaml = yaml.trim();
  const parsed = YAML.parse(yaml);
  return _process(parsed, ctx);
};

const _object = (tree: Tree, ctx: Context) => {
  Object.keys(tree).forEach((key) => {
    tree = timmSet(tree, key, _process(tree[key], ctx));
  });
  return tree;
};

// Resolve context properties used in the template,
// and then apply the template to the new context
const _interpolate = (tree: Tree, ctx: Context) => {
  const re = /<<.*?\$\.(\w+)/g;
  let match: any;
  while ((match = re.exec(tree))) {
    const name = match[1];
    ctx = timmSet(ctx, name, _process(ctx[name], ctx));
  }
  const interpolated = Mustache.render(tree, { $: ctx }, {}, TEMPLATE_TAGS);
  return interpolated !== tree ? _process(interpolated, ctx) : interpolated;
};

const isExplodingObjectCall = (tree: Tree) =>
  tree != null && typeof tree === "object" && tree.$call && tree.$explode;

const isExplodingShortCall = (tree: Tree) =>
  typeof tree === "string" && tree[0] === "$" && tree[1] === "*";

// ====================================
// Public
// ====================================
export { tri };
