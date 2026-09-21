import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAuthoringBundle, packageAuthoringApp } from "./package.mjs";

const TOOLS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOLS_DIRECTORY, "..");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, "dist", "index.html");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyArtifact(artifact, artifactPath) {
  assert(/^<!doctype html>/i.test(artifact), "packaged artifact must be an HTML document");
  assert(artifact.includes('<style data-presenthtml-source="styles/app.css">'), "CSS was not inlined");
  assert(artifact.includes('<script data-presenthtml-source="app.js">'), "browser JavaScript was not inlined");
  assert(!/<link\b[^>]*\bhref=/i.test(artifact), "packaged artifact contains an external stylesheet reference");
  assert(!/<script\b[^>]*(?:\bsrc=|\btype=["']module["'])/i.test(artifact), "packaged artifact contains an external/module script reference");
  assert(!/^\s*(?:import|export)\b/m.test(artifact), "packaged artifact still contains a top-level ESM statement");
  assert(!/\bimport\s*\(/.test(artifact), "packaged artifact contains a dynamic module import");
  assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(artifact), "packaged artifact contains a network runtime dependency");
  assert(pathToFileURL(artifactPath).protocol === "file:", "artifact must have a file:// URL");
  assert(artifact.includes("PresentHTML"), "packaged shell is missing PresentHTML");
}

function verifyBundleRuntime(bundle, sourceRoot) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "presenthtml-bundle-"));
  const bundlePath = path.join(temporaryDirectory, "app.js");
  try {
    fs.writeFileSync(bundlePath, bundle, "utf8");
    execFileSync(process.execPath, ["--check", bundlePath], { stdio: "pipe" });
    vm.runInNewContext(bundle, {
      document: { querySelector: () => null },
    }, { filename: bundlePath });
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  assert(sourceRoot, "source root is required for bundle verification");
}

function verifyDeterminism({ sourceRoot, outputPath, first }) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "presenthtml-verify-"));
  const secondPath = path.join(temporaryDirectory, "index.html");

  try {
    packageAuthoringApp({ output: secondPath, sourceRoot });
    const second = fs.readFileSync(secondPath, "utf8");
    assert(first === second, "packaging is not deterministic");
    assert(pathToFileURL(outputPath).protocol === "file:", "output must resolve to file://");
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
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
      throw new Error("Usage: node tools/verify.mjs [--source <repo>] [--output <path>]");
    }
  }
  if (!options.output || !options.sourceRoot) {
    throw new Error("Both --source and --output require a path");
  }
  return options;
}

try {
  const { output, sourceRoot } = parseCliArguments(process.argv.slice(2));
  const packagedPath = packageAuthoringApp({ output, sourceRoot });
  const artifact = fs.readFileSync(packagedPath, "utf8");
  const bundle = buildAuthoringBundle({ sourceRoot });
  verifyArtifact(artifact, packagedPath);
  verifyBundleRuntime(bundle, sourceRoot);
  verifyDeterminism({ sourceRoot, outputPath: packagedPath, first: artifact });
  console.log("Verified source graph bundling, runtime syntax, deterministic packaging, and file:// invariants.");
} catch (error) {
  console.error(`Verification failed: ${error.message}`);
  process.exitCode = 1;
}
