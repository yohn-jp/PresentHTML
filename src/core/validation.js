import {
  BRIEF_KIND,
  DECK_KIND,
  LAYOUT_KINDS,
  SCHEMA_ID,
  SCHEMA_VERSION,
  isLayoutKind,
  isSupportedSchemaVersion,
} from "./schema.js";

export const VALIDATION_ERROR_CODES = Object.freeze({
  INVALID_JSON: "INVALID_JSON",
  INVALID_TYPE: "INVALID_TYPE",
  INVALID_VALUE: "INVALID_VALUE",
  INVALID_VERSION: "INVALID_VERSION",
  INVALID_LAYOUT: "INVALID_LAYOUT",
  UNSUPPORTED_LAYOUT: "UNSUPPORTED_LAYOUT",
});

export class ContractError extends TypeError {
  constructor(code, path, message) {
    super(`${code} at ${path}: ${message}`);
    this.name = "ContractError";
    this.code = code;
    this.path = path;
  }
}

function fail(code, path, message) {
  throw new ContractError(code, path, message);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function expectRecord(value, path) {
  if (!isRecord(value)) {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, path, "expected a plain object");
  }
}

function expectString(value, path, { nonEmpty = true } = {}) {
  if (typeof value !== "string" || (nonEmpty && value.trim().length === 0)) {
    fail(
      VALIDATION_ERROR_CODES.INVALID_TYPE,
      path,
      nonEmpty ? "expected a non-empty string" : "expected a string",
    );
  }
}

function expectOptionalString(value, path) {
  if (value !== undefined) {
    expectString(value, path, { nonEmpty: false });
  }
}

function expectInteger(value, path, { minimum = 0 } = {}) {
  if (!Number.isInteger(value) || value < minimum) {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, path, `expected an integer >= ${minimum}`);
  }
}

function expectOptionalNumber(value, path, { minimum = 0 } = {}) {
  if (value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value) || value < minimum)) {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, path, `expected a finite number >= ${minimum}`);
  }
}

function expectJsonValue(value, path, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, path, "expected a finite JSON number");
  }
  if (typeof value !== "object") {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, path, "expected a JSON value");
  }
  if (seen.has(value)) {
    fail(VALIDATION_ERROR_CODES.INVALID_VALUE, path, "cyclic value is not serializable");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => expectJsonValue(item, `${path}[${index}]`, seen));
  } else {
    expectRecord(value, path);
    Object.keys(value).sort().forEach((key) => expectJsonValue(value[key], `${path}.${key}`, seen));
  }
  seen.delete(value);
}

function assertAllowedKeys(value, allowed, path) {
  const unknown = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort()[0];
  if (unknown) {
    fail(VALIDATION_ERROR_CODES.INVALID_VALUE, `${path}.${unknown}`, "unsupported field");
  }
}

function assertUniqueIds(items, path) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      fail(VALIDATION_ERROR_CODES.INVALID_VALUE, `${path}[${index}].id`, "duplicate id");
    }
    seen.add(item.id);
  });
}

function validateVersioned(value, expectedKind, path) {
  expectRecord(value, path);
  if (value.schemaId !== undefined && value.schemaId !== SCHEMA_ID) {
    fail(VALIDATION_ERROR_CODES.INVALID_VERSION, `${path}.schemaId`, `expected ${SCHEMA_ID}`);
  }
  if (!isSupportedSchemaVersion(value.schemaVersion)) {
    fail(
      VALIDATION_ERROR_CODES.INVALID_VERSION,
      `${path}.schemaVersion`,
      `unsupported version; expected ${SCHEMA_VERSION}`,
    );
  }
  if (value.kind !== expectedKind) {
    fail(VALIDATION_ERROR_CODES.INVALID_VALUE, `${path}.kind`, `expected ${expectedKind}`);
  }
}

function validateNarrative(value, path) {
  if (typeof value === "string") {
    expectString(value, path);
    return;
  }
  expectRecord(value, path);
  assertAllowedKeys(value, ["summary", "beats"], path);
  expectString(value.summary, `${path}.summary`);
  if (!Array.isArray(value.beats)) {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${path}.beats`, "expected an array");
  }
  value.beats.forEach((beat, index) => expectString(beat, `${path}.beats[${index}]`));
}

function validateSlideIntention(value, path) {
  expectRecord(value, path);
  assertAllowedKeys(value, ["id", "purpose", "layoutKind"], path);
  expectString(value.id, `${path}.id`);
  expectString(value.purpose, `${path}.purpose`);
  if (value.layoutKind !== undefined && !isLayoutKind(value.layoutKind)) {
    fail(VALIDATION_ERROR_CODES.UNSUPPORTED_LAYOUT, `${path}.layoutKind`, "unsupported layout kind");
  }
}

export function validatePresentationBrief(value) {
  const path = "brief";
  validateVersioned(value, BRIEF_KIND, path);
  assertAllowedKeys(
    value,
    ["schemaId", "schemaVersion", "kind", "audience", "objective", "keyMessage", "narrative", "sections", "slideCount", "durationMinutes"],
    path,
  );
  expectString(value.audience, `${path}.audience`);
  expectString(value.objective, `${path}.objective`);
  expectString(value.keyMessage, `${path}.keyMessage`);
  validateNarrative(value.narrative, `${path}.narrative`);
  if (!Array.isArray(value.sections)) {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${path}.sections`, "expected an array");
  }
  value.sections.forEach((section, index) => {
    const sectionPath = `${path}.sections[${index}]`;
    expectRecord(section, sectionPath);
    assertAllowedKeys(section, ["id", "title", "intention", "slideIntentions"], sectionPath);
    expectString(section.id, `${sectionPath}.id`);
    expectString(section.title, `${sectionPath}.title`);
    expectString(section.intention, `${sectionPath}.intention`);
    if (!Array.isArray(section.slideIntentions)) {
      fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${sectionPath}.slideIntentions`, "expected an array");
    }
    section.slideIntentions.forEach((item, itemIndex) =>
      validateSlideIntention(item, `${sectionPath}.slideIntentions[${itemIndex}]`),
    );
    assertUniqueIds(section.slideIntentions, `${sectionPath}.slideIntentions`);
  });
  assertUniqueIds(value.sections, `${path}.sections`);
  if (value.slideCount !== undefined) {
    expectInteger(value.slideCount, `${path}.slideCount`, { minimum: 0 });
  }
  expectOptionalNumber(value.durationMinutes, `${path}.durationMinutes`, { minimum: 0 });
  return value;
}

export function validateThemeRef(value, path = "deck.theme") {
  expectRecord(value, path);
  assertAllowedKeys(value, ["id", "version", "variant", "config"], path);
  expectString(value.id, `${path}.id`);
  if (value.version !== undefined) {
    expectInteger(value.version, `${path}.version`, { minimum: 1 });
  }
  expectOptionalString(value.variant, `${path}.variant`);
  if (value.config !== undefined) {
    expectRecord(value.config, `${path}.config`);
    expectJsonValue(value.config, `${path}.config`);
  }
  return value;
}

function validateImage(value, path) {
  expectRecord(value, path);
  assertAllowedKeys(value, ["src", "alt", "caption", "width", "height"], path);
  expectString(value.src, `${path}.src`);
  expectString(value.alt, `${path}.alt`, { nonEmpty: false });
  expectOptionalString(value.caption, `${path}.caption`);
  expectOptionalNumber(value.width, `${path}.width`, { minimum: 1 });
  expectOptionalNumber(value.height, `${path}.height`, { minimum: 1 });
}

function validateComparisonSide(value, path) {
  expectRecord(value, path);
  assertAllowedKeys(value, ["heading", "body", "items"], path);
  expectString(value.heading, `${path}.heading`);
  expectOptionalString(value.body, `${path}.body`);
  if (value.items !== undefined) {
    if (!Array.isArray(value.items)) {
      fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${path}.items`, "expected an array");
    }
    value.items.forEach((item, index) => expectString(item, `${path}.items[${index}]`));
  }
}

function validateMetric(value, path) {
  expectRecord(value, path);
  assertAllowedKeys(value, ["label", "value", "unit", "detail", "trend"], path);
  expectString(value.label, `${path}.label`);
  expectString(value.value, `${path}.value`);
  expectOptionalString(value.unit, `${path}.unit`);
  expectOptionalString(value.detail, `${path}.detail`);
  expectOptionalString(value.trend, `${path}.trend`);
}

export function validateLayoutContent(layoutKind, value, path = "slide.layout.content") {
  if (!isLayoutKind(layoutKind)) {
    fail(VALIDATION_ERROR_CODES.UNSUPPORTED_LAYOUT, `${path}.kind`, "unsupported layout kind");
  }
  expectRecord(value, path);
  const validators = {
    title() {
      assertAllowedKeys(value, ["title", "subtitle", "eyebrow"], path);
      expectString(value.title, `${path}.title`);
      expectOptionalString(value.subtitle, `${path}.subtitle`);
      expectOptionalString(value.eyebrow, `${path}.eyebrow`);
    },
    section() {
      assertAllowedKeys(value, ["title", "subtitle", "number"], path);
      expectString(value.title, `${path}.title`);
      expectOptionalString(value.subtitle, `${path}.subtitle`);
      if (value.number !== undefined && typeof value.number !== "string" && !Number.isInteger(value.number)) {
        fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${path}.number`, "expected a string or integer");
      }
    },
    statement() {
      assertAllowedKeys(value, ["statement", "supportingText", "attribution"], path);
      expectString(value.statement, `${path}.statement`);
      expectOptionalString(value.supportingText, `${path}.supportingText`);
      expectOptionalString(value.attribution, `${path}.attribution`);
    },
    "title-body"() {
      assertAllowedKeys(value, ["title", "body", "bullets", "eyebrow"], path);
      expectString(value.title, `${path}.title`);
      expectString(value.body, `${path}.body`);
      expectOptionalString(value.eyebrow, `${path}.eyebrow`);
      if (value.bullets !== undefined) {
        if (!Array.isArray(value.bullets)) {
          fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${path}.bullets`, "expected an array");
        }
        value.bullets.forEach((bullet, index) => expectString(bullet, `${path}.bullets[${index}]`));
      }
    },
    comparison() {
      assertAllowedKeys(value, ["title", "left", "right"], path);
      expectOptionalString(value.title, `${path}.title`);
      validateComparisonSide(value.left, `${path}.left`);
      validateComparisonSide(value.right, `${path}.right`);
    },
    "image-text"() {
      assertAllowedKeys(value, ["title", "body", "image", "imagePosition"], path);
      expectString(value.title, `${path}.title`);
      expectString(value.body, `${path}.body`);
      validateImage(value.image, `${path}.image`);
      if (value.imagePosition !== undefined && !["left", "right"].includes(value.imagePosition)) {
        fail(VALIDATION_ERROR_CODES.INVALID_VALUE, `${path}.imagePosition`, "expected left or right");
      }
    },
    kpi() {
      assertAllowedKeys(value, ["title", "metrics"], path);
      expectOptionalString(value.title, `${path}.title`);
      if (!Array.isArray(value.metrics) || value.metrics.length === 0) {
        fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${path}.metrics`, "expected a non-empty array");
      }
      value.metrics.forEach((metric, index) => validateMetric(metric, `${path}.metrics[${index}]`));
    },
    closing() {
      assertAllowedKeys(value, ["title", "takeaway", "nextStep", "attribution"], path);
      expectString(value.title, `${path}.title`);
      expectString(value.takeaway, `${path}.takeaway`);
      expectOptionalString(value.nextStep, `${path}.nextStep`);
      expectOptionalString(value.attribution, `${path}.attribution`);
    },
  };
  validators[layoutKind]();
  return value;
}

export function validateSlide(value, path = "deck.slides[0]") {
  expectRecord(value, path);
  assertAllowedKeys(value, ["id", "purpose", "layout", "notes"], path);
  expectString(value.id, `${path}.id`);
  expectString(value.purpose, `${path}.purpose`);
  expectRecord(value.layout, `${path}.layout`);
  assertAllowedKeys(value.layout, ["kind", "content"], `${path}.layout`);
  if (!isLayoutKind(value.layout.kind)) {
    fail(VALIDATION_ERROR_CODES.UNSUPPORTED_LAYOUT, `${path}.layout.kind`, "unsupported layout kind");
  }
  validateLayoutContent(value.layout.kind, value.layout.content, `${path}.layout.content`);
  expectOptionalString(value.notes, `${path}.notes`);
  return value;
}

export function validateDeck(value) {
  const path = "deck";
  validateVersioned(value, DECK_KIND, path);
  assertAllowedKeys(value, ["schemaId", "schemaVersion", "kind", "metadata", "theme", "slides"], path);
  expectRecord(value.metadata, `${path}.metadata`);
  assertAllowedKeys(value.metadata, ["title", "author", "description"], `${path}.metadata`);
  expectString(value.metadata.title, `${path}.metadata.title`);
  expectOptionalString(value.metadata.author, `${path}.metadata.author`);
  expectOptionalString(value.metadata.description, `${path}.metadata.description`);
  validateThemeRef(value.theme);
  if (!Array.isArray(value.slides)) {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, `${path}.slides`, "expected an array");
  }
  value.slides.forEach((slide, index) => validateSlide(slide, `${path}.slides[${index}]`));
  assertUniqueIds(value.slides, `${path}.slides`);
  return value;
}

export function isValidPresentationBrief(value) {
  try {
    validatePresentationBrief(value);
    return true;
  } catch (error) {
    if (error instanceof ContractError) return false;
    throw error;
  }
}

export function isValidDeck(value) {
  try {
    validateDeck(value);
    return true;
  } catch (error) {
    if (error instanceof ContractError) return false;
    throw error;
  }
}

export function isValidLayoutContent(layoutKind, value) {
  try {
    validateLayoutContent(layoutKind, value);
    return true;
  } catch (error) {
    if (error instanceof ContractError) return false;
    throw error;
  }
}

export function parseJson(value, path = "project") {
  if (typeof value !== "string") {
    fail(VALIDATION_ERROR_CODES.INVALID_TYPE, path, "expected a JSON string");
  }
  try {
    return JSON.parse(value);
  } catch {
    fail(VALIDATION_ERROR_CODES.INVALID_JSON, path, "malformed JSON");
  }
}
