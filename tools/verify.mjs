import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { packageAuthoringApp } from "./package.mjs";

const TOOLS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOLS_DIRECTORY, "..");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "dist", "index.html");

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
  assert(!/<script\b[^>]*\bsrc=/i.test(artifact), "packaged artifact contains an external script reference");
  assert(!/\bhttps?:\/\//i.test(artifact), "packaged artifact contains a network URL");
  assert(pathToFileURL(artifactPath).protocol === "file:", "artifact must have a file:// URL");
  assert(artifact.includes("PresentHTML"), "packaged shell is missing PresentHTML");
}

function verifyDeterminism() {
  const first = fs.readFileSync(OUTPUT_PATH, "utf8");
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "presenthtml-verify-"));
  const secondPath = path.join(temporaryDirectory, "index.html");

  try {
    packageAuthoringApp({ output: secondPath });
    const second = fs.readFileSync(secondPath, "utf8");
    assert(first === second, "packaging is not deterministic");
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

try {
  const packagedPath = packageAuthoringApp();
  const artifact = fs.readFileSync(packagedPath, "utf8");
  verifyArtifact(artifact, packagedPath);
  execFileSync(process.execPath, ["--check", path.join(PROJECT_ROOT, "src", "app.js")], {
    stdio: "pipe",
  });
  verifyDeterminism();
  console.log("Verified source syntax, deterministic packaging, and file:// artifact invariants.");
} catch (error) {
  console.error(`Verification failed: ${error.message}`);
  process.exitCode = 1;
}
