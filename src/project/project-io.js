import {
  DECK_KIND,
  PROJECT_SCHEMA_VERSION,
  SCHEMA_ID,
  isSupportedSchemaVersion,
} from "../core/schema.js";
import {
  ContractError,
  VALIDATION_ERROR_CODES,
  parseJson,
  validateDeck,
  validatePresentationBrief,
} from "../core/validation.js";

/**
 * A project document is the persistence envelope around canonical semantic
 * state.  It intentionally contains no editor, DOM, or rendered HTML data.
 */
export const PROJECT_KIND = "project";
export const PROJECT_SCHEMA_ID = SCHEMA_ID;
export const SUPPORTED_PROJECT_SCHEMA_VERSIONS = Object.freeze([
  PROJECT_SCHEMA_VERSION,
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(code, path, message) {
  throw new ContractError(code, path, message);
}

function expectRecord(value, path) {
  if (!isRecord(value)) {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, path, "expected a plain object");
  }
}

function assertAllowedKeys(value, allowed, path) {
  const unknown = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort()[0];
  if (unknown) {
    fail(VALIDATION_ERROR_CODES.INVALID_VALUE, `${path}.${unknown}`, "unsupported field");
  }
}

function validateProjectVersion(value) {
  if (value.schemaId !== PROJECT_SCHEMA_ID) {
    fail(
      VALIDATION_ERROR_CODES.INVALID_VERSION,
      "project.schemaId",
      `expected ${PROJECT_SCHEMA_ID}`,
    );
  }
  if (!isSupportedSchemaVersion(value.schemaVersion) ||
      !SUPPORTED_PROJECT_SCHEMA_VERSIONS.includes(value.schemaVersion)) {
    fail(
      VALIDATION_ERROR_CODES.INVALID_VERSION,
      "project.schemaVersion",
      `unsupported version; expected ${PROJECT_SCHEMA_VERSION}`,
    );
  }
}

/**
 * Validate a project document without changing it.
 *
 * All nested canonical documents are validated before a caller is allowed to
 * replace its current state.  The original value is returned for validator
 * composition, matching the core validators' contract.
 */
export function validateProject(value) {
  const path = "project";
  expectRecord(value, path);
  assertAllowedKeys(value, ["schemaId", "schemaVersion", "kind", "deck", "brief"], path);
  validateProjectVersion(value);
  if (value.kind !== PROJECT_KIND) {
    fail(VALIDATION_ERROR_CODES.INVALID_VALUE, `${path}.kind`, `expected ${PROJECT_KIND}`);
  }
  if (value.deck === undefined) {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${path}.deck`, "expected a Deck");
  }
  validateDeck(value.deck);
  if (value.brief !== undefined) {
    validatePresentationBrief(value.brief);
  }
  return value;
}

function isDeck(value) {
  return isRecord(value) && value.kind === DECK_KIND;
}

/**
 * Build a versioned project document from canonical state.
 *
 * Passing a Deck directly is supported for the common authoring-store case;
 * passing an object with `deck` may additionally persist its PresentationBrief.
 */
export function createProject(input = {}) {
  const source = isDeck(input) ? { deck: input } : input;
  expectRecord(source, "project");

  const project = {
    schemaId: PROJECT_SCHEMA_ID,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    kind: PROJECT_KIND,
    deck: source.deck,
  };
  if (source.brief !== undefined) {
    project.brief = source.brief;
  }
  validateProject(project);
  return clone(project);
}

/**
 * Serialize a validated project document as JSON.
 */
export function serializeProject(project, space = 0) {
  validateProject(project);
  return JSON.stringify(project, null, space);
}

/**
 * Parse, validate, and clone a project document.
 *
 * Validation happens before cloning and no caller-owned object is returned, so
 * callers can safely use the result as the next canonical state.
 */
export function deserializeProject(serialized) {
  const project = parseJson(serialized, "project");
  validateProject(project);
  return clone(project);
}

/**
 * Export canonical state as a project JSON document.  The Deck shorthand is
 * useful to adapters whose store owns Deck rather than the persistence envelope.
 */
export function exportProject(state, { space = 2 } = {}) {
  return serializeProject(createProject(state), space);
}

export function importProject(serialized) {
  return deserializeProject(serialized);
}

export function isValidProject(value) {
  try {
    validateProject(value);
    return true;
  } catch (error) {
    if (error instanceof ContractError) return false;
    throw error;
  }
}
