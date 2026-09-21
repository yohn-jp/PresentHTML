import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOLS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOLS_DIRECTORY, "..");
const SOURCE_HTML = path.join(PROJECT_ROOT, "src", "index.html");
const SOURCE_CSS = path.join(PROJECT_ROOT, "src", "styles", "app.css");
const SOURCE_JS = path.join(PROJECT_ROOT, "src", "app.js");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, "dist", "index.html");

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
  return withStyles.replace(
    scriptTag,
    `<script data-presenthtml-source="app.js">\n${javascript}\n</script>`,
  );
}

export function packageAuthoringApp({ output = DEFAULT_OUTPUT } = {}) {
  const html = fs.readFileSync(SOURCE_HTML, "utf8");
  const css = fs.readFileSync(SOURCE_CSS, "utf8");
  const javascript = fs.readFileSync(SOURCE_JS, "utf8");
  const packaged = inlineSource(html, css, javascript);
  const outputPath = path.resolve(PROJECT_ROOT, output);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, packaged, "utf8");
  return outputPath;
}

function parseOutputArgument(argv) {
  if (argv.length === 0) {
    return DEFAULT_OUTPUT;
  }
  if (argv.length === 2 && (argv[0] === "--output" || argv[0] === "-o")) {
    return argv[1];
  }
  throw new Error("Usage: node tools/package.mjs [--output <path>]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const outputPath = packageAuthoringApp({ output: parseOutputArgument(process.argv.slice(2)) });
    console.log(`Packaged authoring app: ${path.relative(PROJECT_ROOT, outputPath)}`);
  } catch (error) {
    console.error(`Packaging failed: ${error.message}`);
    process.exitCode = 1;
  }
}
