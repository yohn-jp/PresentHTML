import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOLS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOLS_DIRECTORY, "..");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, "dist", "index.html");

function resolveProjectPath(value) {
  return path.resolve(PROJECT_ROOT, value);
}

function sourcePaths(sourceRoot) {
  const root = resolveProjectPath(sourceRoot);
  const sourceDirectory = path.join(root, "src");
  return {
    root,
    sourceDirectory,
    html: path.join(sourceDirectory, "index.html"),
    css: path.join(sourceDirectory, "styles", "app.css"),
    entry: path.join(sourceDirectory, "app.js"),
  };
}

function moduleId(filePath, sourceDirectory) {
  return path.relative(sourceDirectory, filePath).split(path.sep).join("/");
}

function resolveImport(sourceFile, specifier, sourceDirectory) {
  if (!specifier.startsWith(".")) {
    throw new Error(`Only relative browser imports are supported: ${specifier}`);
  }

  let target = path.resolve(path.dirname(sourceFile), specifier);
  if (path.extname(target) === "") target += ".js";
  const relative = path.relative(sourceDirectory, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Import escapes the source directory: ${specifier}`);
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`Imported module does not exist: ${specifier}`);
  }
  return target;
}

function splitBindings(value) {
  return value
    .split(",")
    .map((binding) => binding.trim())
    .filter(Boolean);
}

function parseNamedBindings(value) {
  const inner = value.trim().replace(/^\{/, "").replace(/\}$/, "").trim();
  return splitBindings(inner).map((binding) => {
    const parts = binding.split(/\s+as\s+/);
    const imported = parts[0].trim();
    const local = (parts[1] || imported).trim();
    if (!/^[$A-Z_a-z][$\w]*$/.test(imported) || !/^[$A-Z_a-z][$\w]*$/.test(local)) {
      throw new Error(`Unsupported named import binding: ${binding}`);
    }
    return { imported, local };
  });
}

function importReplacement(specifier, dependencyId) {
  const trimmed = specifier.trim();
  const requireExpression = `require(${JSON.stringify(dependencyId)})`;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const bindings = parseNamedBindings(trimmed);
    const fields = bindings.map(({ imported, local }) =>
      imported === local ? imported : `${imported}: ${local}`,
    );
    return `const { ${fields.join(", ")} } = ${requireExpression};`;
  }

  if (trimmed.startsWith("*")) {
    const namespaceMatch = trimmed.match(/^\*\s+as\s+([$A-Z_a-z][$\w]*)$/);
    if (!namespaceMatch) throw new Error(`Unsupported namespace import: ${specifier}`);
    return `const ${namespaceMatch[1]} = ${requireExpression};`;
  }

  const comma = trimmed.indexOf(",");
  if (comma === -1) {
    if (!/^[$A-Z_a-z][$\w]*$/.test(trimmed)) {
      throw new Error(`Unsupported default import: ${specifier}`);
    }
    return `const ${trimmed} = ${requireExpression}.default;`;
  }

  const defaultName = trimmed.slice(0, comma).trim();
  const remainder = trimmed.slice(comma + 1).trim();
  if (!/^[$A-Z_a-z][$\w]*$/.test(defaultName)) {
    throw new Error(`Unsupported default import: ${defaultName}`);
  }
  return [
    `const ${defaultName} = ${requireExpression}.default;`,
    importReplacement(remainder, dependencyId),
  ].join("\n");
}

function transformModule(source, imports) {
  const importedSource = source
    .replace(
      /^import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']\s*;?/gm,
      (statement, bindings, specifier) => {
        const dependencyId = imports.resolve(specifier);
        return importReplacement(bindings, dependencyId);
      },
    )
    .replace(
      /^import\s*["']([^"']+)["']\s*;?/gm,
      (statement, specifier) => `require(${JSON.stringify(imports.resolve(specifier))});`,
    );

  const exported = new Map();
  let transformed = importedSource
    .replace(
      /^export\s+(?:(async)\s+)?(function|class)\s+([$A-Z_a-z][$\w]*)/gm,
      (statement, asyncKeyword = "", declaration, name) => {
        exported.set(name, name);
        return `${asyncKeyword ? "async " : ""}${declaration} ${name}`;
      },
    )
    .replace(
      /^export\s+(const|let|var)\s+([$A-Z_a-z][$\w]*)/gm,
      (statement, declaration, name) => {
        exported.set(name, name);
        return `${declaration} ${name}`;
      },
    )
    .replace(/^export\s*\{([\s\S]*?)\}\s*;?/gm, (statement, bindings) => {
      splitBindings(bindings).forEach((binding) => {
        const parts = binding.split(/\s+as\s+/);
        const local = parts[0].trim();
        const name = (parts[1] || local).trim();
        if (!/^[$A-Z_a-z][$\w]*$/.test(local) || !/^[$A-Z_a-z][$\w]*$/.test(name)) {
          throw new Error(`Unsupported export binding: ${binding}`);
        }
        exported.set(name, local);
      });
      return "";
    });

  transformed = transformed.replace(
    /^export\s+default\s+(?:(async)\s+)?(function|class)\s+([$A-Z_a-z][$\w]*)/gm,
    (statement, asyncKeyword = "", declaration, name) => {
      exported.set("default", name);
      return `${asyncKeyword ? "async " : ""}${declaration} ${name}`;
    },
  );

  if (/^\s*export\b/m.test(transformed) || /^\s*import\b/m.test(transformed)) {
    throw new Error("Unsupported ESM syntax remains after packaging transform");
  }

  const assignments = [...exported.entries()]
    .map(([name, local]) => `exports[${JSON.stringify(name)}] = ${local};`)
    .join("\n");
  return assignments ? `${transformed.trimEnd()}\n\n${assignments}\n` : transformed;
}

function collectModules(entry, sourceDirectory) {
  const modules = new Map();
  const visiting = new Set();

  function visit(filePath) {
    const id = moduleId(filePath, sourceDirectory);
    if (modules.has(id)) return;
    if (visiting.has(id)) return;
    visiting.add(id);
    const source = fs.readFileSync(filePath, "utf8");
    const dependencies = [];
    const importPattern = /^import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']\s*;?|^import\s*["']([^"']+)["']\s*;?/gm;
    let match;
    while ((match = importPattern.exec(source)) !== null) {
      dependencies.push(resolveImport(filePath, match[1] || match[2], sourceDirectory));
    }
    modules.set(id, { filePath, source, dependencies });
    dependencies.forEach(visit);
    visiting.delete(id);
  }

  visit(entry);
  return modules;
}

function createBundle({ sourceRoot = PROJECT_ROOT } = {}) {
  const paths = sourcePaths(sourceRoot);
  const modules = collectModules(paths.entry, paths.sourceDirectory);
  const entries = [...modules.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([id, module]) => {
      const transformed = transformModule(module.source, {
        resolve(specifier) {
          const dependency = resolveImport(module.filePath, specifier, paths.sourceDirectory);
          return moduleId(dependency, paths.sourceDirectory);
        },
      });
      return `    ${JSON.stringify(id)}: function (module, exports, require) {\n${transformed}\n    }`;
    });

  return [
    "(function () {",
    '  "use strict";',
    "  const modules = {",
    `${entries.join(",\n")}\n  };`,
    "  const cache = Object.create(null);",
    "  function requireModule(id) {",
    "    if (cache[id]) return cache[id].exports;",
    "    const module = { exports: {} };",
    "    cache[id] = module;",
    "    if (!modules[id]) throw new Error(`Unknown bundled module: ${id}`);",
    "    modules[id](module, module.exports, requireModule);",
    "    return module.exports;",
    "  }",
    `  requireModule(${JSON.stringify(moduleId(paths.entry, paths.sourceDirectory))});`,
    "})();",
    "",
  ].join("\n");
}

function inlineSource(html, css, javascript) {
  const stylesheetTag = /<link\b(?=[^>]*\bhref=["']styles\/app\.css["'])[^>]*>/i;
  const scriptTag = /<script\b(?=[^>]*\bsrc=["']app\.js["'])[^>]*>\s*<\/script>/i;

  if (!stylesheetTag.test(html)) {
    throw new Error("src/index.html must reference styles/app.css");
  }
  if (!scriptTag.test(html)) {
    throw new Error("src/index.html must reference app.js");
  }

  const withStyles = html.replace(
    stylesheetTag,
    `<style data-presenthtml-source="styles/app.css">\n${css}\n</style>`,
  );
  const safeScript = javascript.replace(/<\/script/gi, "<\\/script");
  return withStyles.replace(
    scriptTag,
    `<script data-presenthtml-source="app.js">\n${safeScript}\n</script>`,
  );
}

export function buildAuthoringBundle({ sourceRoot = PROJECT_ROOT } = {}) {
  return createBundle({ sourceRoot: resolveProjectPath(sourceRoot) });
}

export function packageAuthoringApp({ output = DEFAULT_OUTPUT, sourceRoot = PROJECT_ROOT } = {}) {
  const paths = sourcePaths(sourceRoot);
  const html = fs.readFileSync(paths.html, "utf8");
  const css = fs.readFileSync(paths.css, "utf8");
  const javascript = buildAuthoringBundle({ sourceRoot: paths.root });
  const packaged = inlineSource(html, css, javascript);
  const outputPath = resolveProjectPath(output);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, packaged, "utf8");
  return outputPath;
}

function parseCliArguments(argv) {
  const options = { output: DEFAULT_OUTPUT, sourceRoot: PROJECT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output" || argument === "-o") {
      options.output = argv[++index];
    } else if (argument === "--source" || argument === "--source-root" || argument === "-s") {
      options.sourceRoot = argv[++index];
    } else {
      throw new Error("Usage: node tools/package.mjs [--source <repo>] [--output <path>]");
    }
  }
  if (!options.output || !options.sourceRoot) {
    throw new Error("Both --source and --output require a path");
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const outputPath = packageAuthoringApp(parseCliArguments(process.argv.slice(2)));
    console.log(`Packaged authoring app: ${path.relative(PROJECT_ROOT, outputPath)}`);
  } catch (error) {
    console.error(`Packaging failed: ${error.message}`);
    process.exitCode = 1;
  }
}
