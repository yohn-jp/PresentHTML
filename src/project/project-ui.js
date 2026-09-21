import {
  createProject,
  deserializeProject,
  serializeProject,
} from "./project-io.js";

const DEFAULT_PROJECT_FILENAME = "presenthtml-project.json";

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
}

function report(onStatus, status) {
  if (onStatus) onStatus(status);
  return status;
}

/**
 * Create the persistence adapter used by an authoring store.
 *
 * The adapter only exchanges canonical semantic data with the store.  It does
 * not inspect editor DOM or renderer output.  Import validation completes
 * before `replaceDeck` is called, which makes malformed/incompatible input
 * non-destructive.
 */
export function createProjectPersistenceAdapter({
  getDeck,
  replaceDeck,
  getBrief,
  replaceBrief,
  onStatus,
} = {}) {
  assertFunction(getDeck, "getDeck");
  assertFunction(replaceDeck, "replaceDeck");
  if (getBrief !== undefined) assertFunction(getBrief, "getBrief");
  if (replaceBrief !== undefined) assertFunction(replaceBrief, "replaceBrief");

  function readProject() {
    const state = { deck: getDeck() };
    if (getBrief !== undefined) {
      const brief = getBrief();
      if (brief !== undefined) state.brief = brief;
    }
    return createProject(state);
  }

  function exportJson({ space = 2 } = {}) {
    return serializeProject(readProject(), space);
  }

  function importJson(serialized) {
    let project;
    try {
      // This is the complete validation boundary.  No state setter is reached
      // until parsing and every semantic child document have succeeded.
      project = deserializeProject(serialized);
      if (project.brief !== undefined && replaceBrief === undefined) {
        throw new TypeError("replaceBrief is required to import a project with a brief");
      }
    } catch (error) {
      return report(onStatus, { ok: false, error, message: error.message });
    }

    replaceDeck(project.deck);
    if (project.brief !== undefined) replaceBrief(project.brief);
    return report(onStatus, { ok: true, project });
  }

  async function importFile(file) {
    if (!file || typeof file.text !== "function") {
      const error = new TypeError("file must provide a text() method");
      return report(onStatus, { ok: false, error, message: error.message });
    }
    try {
      return importJson(await file.text());
    } catch (error) {
      return report(onStatus, { ok: false, error, message: error.message });
    }
  }

  function download({ filename = DEFAULT_PROJECT_FILENAME, space = 2 } = {}) {
    const json = exportJson({ space });
    if (typeof document === "undefined" || typeof Blob === "undefined" ||
        typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      const error = new Error("project download requires browser file APIs");
      return report(onStatus, { ok: false, error, message: error.message });
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return report(onStatus, { ok: true, json });
  }

  return Object.freeze({
    exportJson,
    importJson,
    importFile,
    download,
  });
}
