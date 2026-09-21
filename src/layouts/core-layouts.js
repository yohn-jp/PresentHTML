import { LAYOUT_SLOT_NAMES } from "../core/schema.js";
import { validateLayoutContent as validateCanonicalLayoutContent } from "../core/validation.js";
import { createLayoutContract } from "./layout-contract.js";
import { createLayoutRegistry } from "./registry.js";

const text = (name, required = false, description) => ({
  name,
  type: "text",
  required,
  ...(description === undefined ? {} : { description }),
});

const list = (name, type, required = false, fields) => ({
  name,
  type,
  required,
  cardinality: "many",
  overflow: { policy: "preserve" },
  ...(fields === undefined ? {} : { fields }),
});

const object = (name, type, required, fields) => ({
  name,
  type,
  required,
  fields,
});

const sideFields = {
  heading: text("heading", true),
  body: text("body"),
  items: list("items", "text"),
};

const imageFields = {
  src: text("src", true),
  alt: text("alt", true),
  caption: text("caption"),
  width: { name: "width", type: "positive-number", required: false },
  height: { name: "height", type: "positive-number", required: false },
};

const metricFields = {
  label: text("label", true),
  value: text("value", true),
  unit: text("unit"),
  detail: text("detail"),
  trend: text("trend"),
};

function validator(kind) {
  return (content) => validateCanonicalLayoutContent(kind, content);
}

function definition(kind, slots, name, description) {
  // LAYOUT_SLOT_NAMES is the canonical list of persisted slot names.  Keeping
  // this assertion here makes a contract/schema drift fail at module load.
  const expected = LAYOUT_SLOT_NAMES[kind];
  const actual = slots.map((slot) => slot.name);
  if (!expected || expected.length !== actual.length || expected.some((slot, index) => slot !== actual[index])) {
    throw new Error(`Layout slot contract mismatch for ${kind}`);
  }
  return createLayoutContract({
    kind,
    name,
    description,
    slots,
    validate: validator(kind),
  });
}

export const TITLE_LAYOUT = definition(
  "title",
  [text("title", true), text("subtitle"), text("eyebrow")],
  "Title",
  "Opening slide with a title and optional supporting context.",
);

export const SECTION_LAYOUT = definition(
  "section",
  [text("title", true), text("subtitle"), { name: "number", type: "number-or-text", required: false }],
  "Section",
  "Section divider that introduces a new part of the narrative.",
);

export const STATEMENT_LAYOUT = definition(
  "statement",
  [text("statement", true), text("supportingText"), text("attribution")],
  "Statement",
  "Single-message slide with optional support and attribution.",
);

export const TITLE_BODY_LAYOUT = definition(
  "title-body",
  [text("title", true), text("body", true), list("bullets", "text"), text("eyebrow")],
  "Title and body",
  "A titled explanation with optional supporting bullets.",
);

export const COMPARISON_LAYOUT = definition(
  "comparison",
  [
    text("title"),
    object("left", "comparison-side", true, sideFields),
    object("right", "comparison-side", true, sideFields),
  ],
  "Comparison",
  "Two semantic comparison sides with optional item lists.",
);

export const IMAGE_TEXT_LAYOUT = definition(
  "image-text",
  [
    text("title", true),
    text("body", true),
    object("image", "image", true, imageFields),
    { name: "imagePosition", type: "image-position", required: false },
  ],
  "Image and text",
  "An image reference paired with explanatory text.",
);

export const KPI_LAYOUT = definition(
  "kpi",
  [text("title"), list("metrics", "metric", true, metricFields)],
  "KPI",
  "A set of semantic metrics with labels and values.",
);

export const CLOSING_LAYOUT = definition(
  "closing",
  [text("title", true), text("takeaway", true), text("nextStep"), text("attribution")],
  "Closing",
  "Takeaway slide with an optional next step and attribution.",
);

export const CORE_LAYOUTS = Object.freeze([
  TITLE_LAYOUT,
  SECTION_LAYOUT,
  STATEMENT_LAYOUT,
  TITLE_BODY_LAYOUT,
  COMPARISON_LAYOUT,
  IMAGE_TEXT_LAYOUT,
  KPI_LAYOUT,
  CLOSING_LAYOUT,
]);

export function createCoreLayoutRegistry(layouts = []) {
  const extensions = Array.isArray(layouts) ? layouts : [layouts];
  return createLayoutRegistry([...CORE_LAYOUTS, ...extensions.filter((layout) => layout !== undefined)], {
    defaultKind: TITLE_LAYOUT.kind,
  });
}

export const DEFAULT_LAYOUT_REGISTRY = createCoreLayoutRegistry();
