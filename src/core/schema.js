/**
 * Canonical semantic schema constants.
 *
 * These values describe the persisted presentation model only.  They do not
 * describe DOM nodes, CSS classes, or a renderer's implementation details.
 */

export const SCHEMA_ID = "presenthtml";
export const SCHEMA_VERSION = 1;
export const PROJECT_SCHEMA_VERSION = SCHEMA_VERSION;
export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([SCHEMA_VERSION]);

export const BRIEF_KIND = "presentation-brief";
export const DECK_KIND = "deck";
export const SUPPORTED_DOCUMENT_KINDS = Object.freeze([BRIEF_KIND, DECK_KIND]);

export const LAYOUT_KINDS = Object.freeze([
  "title",
  "section",
  "statement",
  "title-body",
  "comparison",
  "image-text",
  "kpi",
  "closing",
]);

export const MVP_LAYOUT_KINDS = LAYOUT_KINDS;

export const DEFAULT_THEME_REF = Object.freeze({ id: "default" });

/**
 * The semantic fields available to a layout.  This metadata intentionally
 * stays renderer-neutral; layout registries may add editor/rendering metadata
 * without changing persisted Deck data.
 */
export const LAYOUT_SLOT_NAMES = Object.freeze({
  title: Object.freeze(["title", "subtitle", "eyebrow"]),
  section: Object.freeze(["title", "subtitle", "number"]),
  statement: Object.freeze(["statement", "supportingText", "attribution"]),
  "title-body": Object.freeze(["title", "body", "bullets", "eyebrow"]),
  comparison: Object.freeze(["title", "left", "right"]),
  "image-text": Object.freeze(["title", "body", "image", "imagePosition"]),
  kpi: Object.freeze(["title", "metrics"]),
  closing: Object.freeze(["title", "takeaway", "nextStep", "attribution"]),
});

export function isSupportedSchemaVersion(version) {
  return SUPPORTED_SCHEMA_VERSIONS.includes(version);
}

export function isLayoutKind(kind) {
  return typeof kind === "string" && LAYOUT_KINDS.includes(kind);
}
