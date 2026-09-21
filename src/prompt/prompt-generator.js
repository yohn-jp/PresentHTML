import {
  BRIEF_KIND,
  DECK_KIND,
  SCHEMA_ID,
  SCHEMA_VERSION,
  isLayoutKind,
} from "../core/schema.js";
import { deserializeDeck } from "../core/deck.js";
import {
  validateDeck,
  validatePresentationBrief,
} from "../core/validation.js";
import { DEFAULT_LAYOUT_REGISTRY } from "../layouts/core-layouts.js";
import { isLayoutContract } from "../layouts/layout-contract.js";

/**
 * Prompt generation is deliberately a semantic adapter.  It knows about the
 * PresentationBrief, the Deck contract, and layout capabilities, but not
 * about a model, provider, renderer, or editor.
 */

const DEFAULT_COPY_RULES = Object.freeze([
  "Use one clear idea per slide.",
  "Keep titles short and scannable.",
  "Use concise body copy; prefer short bullets over paragraphs.",
  "Preserve the brief's meaning and narrative order.",
  "Use only the declared semantic layouts and their declared slots.",
  "Do not put markup, CSS, or provider-specific fields in Deck data.",
]);

export const PROMPT_GENERATOR_VERSION = 1;
export const DEFAULT_PROMPT_SETTINGS = Object.freeze({
  language: "the same language as the brief",
  tone: "clear and audience-appropriate",
  copyRules: DEFAULT_COPY_RULES,
});

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function stableJson(value, space = 2) {
  return JSON.stringify(stableValue(value), null, space);
}

function expectString(value, name, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new TypeError(`${name} must be ${allowEmpty ? "a string" : "a non-empty string"}`);
  }
  return value.trim();
}

function normalizeCopyRules(value) {
  const source = value === undefined ? DEFAULT_COPY_RULES : value;
  const rules = typeof source === "string" ? [source] : source;
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new TypeError("settings.copyRules must be a non-empty array of strings");
  }
  return rules.map((rule, index) => expectString(rule, `settings.copyRules[${index}]`));
}

function normalizeSettings(input = {}) {
  if (!isRecord(input)) throw new TypeError("prompt settings must be a plain object");

  const language = input.language === undefined
    ? DEFAULT_PROMPT_SETTINGS.language
    : expectString(input.language, "settings.language");
  const tone = input.tone === undefined
    ? DEFAULT_PROMPT_SETTINGS.tone
    : expectString(input.tone, "settings.tone");
  const copyRules = normalizeCopyRules(input.copyRules);
  const additionalInstructions = input.additionalInstructions === undefined
    ? ""
    : expectString(input.additionalInstructions, "settings.additionalInstructions", { allowEmpty: true });

  const targetSlideCount = input.targetSlideCount;
  if (
    targetSlideCount !== undefined &&
    (!Number.isInteger(targetSlideCount) || targetSlideCount < 0)
  ) {
    throw new TypeError("settings.targetSlideCount must be a non-negative integer");
  }

  return {
    language,
    tone,
    copyRules,
    ...(additionalInstructions ? { additionalInstructions } : {}),
    ...(targetSlideCount === undefined ? {} : { targetSlideCount }),
  };
}

function layoutSource(value) {
  if (value === undefined) return DEFAULT_LAYOUT_REGISTRY.list();
  if (value && typeof value.list === "function") return value.list();
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  throw new TypeError("layout capabilities must be an array or a layout registry");
}

function normalizeSlot(slot, path) {
  if (!isRecord(slot)) throw new TypeError(`${path} must be a plain object`);
  expectString(slot.name, `${path}.name`);
  expectString(slot.type, `${path}.type`);
  if (typeof slot.required !== "boolean") {
    throw new TypeError(`${path}.required must be a boolean`);
  }
  const result = {
    name: slot.name,
    type: slot.type,
    required: slot.required,
  };
  if (slot.cardinality !== undefined) {
    if (!["one", "many"].includes(slot.cardinality)) {
      throw new TypeError(`${path}.cardinality must be one or many`);
    }
    result.cardinality = slot.cardinality;
  }
  if (slot.description !== undefined) result.description = expectString(slot.description, `${path}.description`);
  if (slot.overflow !== undefined) result.overflow = clone(slot.overflow);
  if (slot.fields !== undefined) {
    if (!isRecord(slot.fields)) throw new TypeError(`${path}.fields must be a plain object`);
    result.fields = Object.fromEntries(
      Object.keys(slot.fields).sort().map((name) => [name, normalizeSlot({ name, ...slot.fields[name] }, `${path}.fields.${name}`)]),
    );
  }
  return result;
}

function normalizeLayoutCapability(value, index) {
  if (!isRecord(value)) throw new TypeError(`layouts[${index}] must be a layout contract`);
  if (!isLayoutContract(value) && (!isLayoutKind(value.kind) || !Array.isArray(value.slots))) {
    throw new TypeError(`layouts[${index}] must declare a supported layout kind and slots`);
  }
  if (!isLayoutKind(value.kind)) {
    throw new TypeError(`layouts[${index}].kind is not supported by the Deck contract`);
  }
  if (!Array.isArray(value.slots) || value.slots.length === 0) {
    throw new TypeError(`layouts[${index}].slots must be a non-empty array`);
  }

  const slots = value.slots.map((slot, slotIndex) => normalizeSlot(slot, `layouts[${index}].slots[${slotIndex}]`));
  const capability = {
    kind: value.kind,
    ...(value.name === undefined ? {} : { name: expectString(value.name, `layouts[${index}].name`) }),
    ...(value.description === undefined ? {} : { description: expectString(value.description, `layouts[${index}].description`) }),
    slots,
    requiredSlots: slots.filter((slot) => slot.required).map((slot) => slot.name),
    optionalSlots: slots.filter((slot) => !slot.required).map((slot) => slot.name),
  };
  return capability;
}

function normalizeLayoutCapabilities(value) {
  const capabilities = layoutSource(value)
    .map(normalizeLayoutCapability)
    .sort((left, right) => left.kind.localeCompare(right.kind));
  const seen = new Set();
  capabilities.forEach((capability) => {
    if (seen.has(capability.kind)) throw new TypeError(`duplicate layout capability: ${capability.kind}`);
    seen.add(capability.kind);
  });
  if (capabilities.length === 0) throw new TypeError("at least one layout capability is required");
  return capabilities;
}

function requestParts(input, options = {}) {
  if (input && input.kind === BRIEF_KIND) {
    return { brief: input, ...options };
  }
  if (!isRecord(input)) throw new TypeError("prompt input must be a PresentationBrief or request object");
  const request = { ...input, ...options };
  if (!request.brief || request.brief.kind !== BRIEF_KIND) {
    throw new TypeError("prompt input.brief must be a PresentationBrief");
  }
  return request;
}

function normalizeRequest(input, options) {
  const request = requestParts(input, options);
  validatePresentationBrief(request.brief);
  const settings = normalizeSettings(request.settings);
  const layoutValue = request.layoutRegistry === undefined
    ? request.layouts
    : request.layoutRegistry;
  const layouts = normalizeLayoutCapabilities(layoutValue);
  return {
    brief: clone(request.brief),
    settings,
    layouts,
  };
}

function slideCountGuidance(brief, settings) {
  if (settings.targetSlideCount !== undefined) {
    return `Target slide count: ${settings.targetSlideCount}.`;
  }
  if (brief.slideCount !== undefined) {
    return `Target slide count: ${brief.slideCount}. Treat this as guidance and preserve the brief's narrative order.`;
  }
  const intentionCount = brief.sections.reduce(
    (count, section) => count + section.slideIntentions.length,
    0,
  );
  return `Slide-count guidance: cover the ${intentionCount} declared slide intention${intentionCount === 1 ? "" : "s"}; keep the deck concise and do not add filler slides.`;
}

function layoutInstructions(layouts) {
  return layouts.map((layout) => {
    const label = layout.name ? ` — ${layout.name}` : "";
    const description = layout.description ? `\n${layout.description}` : "";
    const slots = layout.slots.map((slot) => {
      const required = slot.required ? "required" : "optional";
      const cardinality = slot.cardinality === "many" ? ", many" : "";
      return `- \`${slot.name}\` (${slot.type}${cardinality}, ${required})`;
    }).join("\n");
    return `### \`${layout.kind}\`${label}${description}\nSlots:\n${slots}`;
  }).join("\n\n");
}

function createDeckOutputContract(layouts) {
  return {
    name: "PresentHTML Deck",
    schemaId: SCHEMA_ID,
    schemaVersion: SCHEMA_VERSION,
    kind: DECK_KIND,
    format: "json",
    required: ["schemaId", "schemaVersion", "kind", "metadata", "theme", "slides"],
    properties: {
      schemaId: { type: "string", const: SCHEMA_ID },
      schemaVersion: { type: "integer", const: SCHEMA_VERSION },
      kind: { type: "string", const: DECK_KIND },
      metadata: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          description: { type: "string" },
        },
      },
      theme: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          version: { type: "integer" },
          variant: { type: "string" },
          config: { type: "object" },
        },
      },
      slides: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "purpose", "layout"],
          properties: {
            id: { type: "string" },
            purpose: { type: "string" },
            notes: { type: "string" },
            layout: {
              type: "object",
              required: ["kind", "content"],
              supportedKinds: layouts.map((layout) => layout.kind),
            },
          },
        },
      },
    },
    layouts,
  };
}

function renderPrompt({ brief, settings, layouts, outputContract }) {
  const narrative = typeof brief.narrative === "string"
    ? brief.narrative
    : `${brief.narrative.summary}\nBeats: ${brief.narrative.beats.join("; ")}`;
  const copyRules = settings.copyRules.map((rule) => `- ${rule}`).join("\n");
  const extra = settings.additionalInstructions
    ? `\n\nAdditional instructions:\n${settings.additionalInstructions}`
    : "";

  return [
    "# PresentHTML Deck Generation Request",
    "",
    "Generate a semantic PresentHTML Deck from the PresentationBrief below.",
    "Return JSON only. Do not return Markdown fences, HTML, CSS, or provider-specific fields.",
    "",
    "## Audience",
    brief.audience,
    "",
    "## Objective",
    brief.objective,
    "",
    "## Key message",
    brief.keyMessage,
    "",
    "## Narrative",
    narrative,
    "",
    "## Slide-count guidance",
    slideCountGuidance(brief, settings),
    "",
    "## Concise copy constraints",
    `Language: ${settings.language}.`,
    `Tone: ${settings.tone}.`,
    copyRules,
    extra,
    "",
    "## Supported semantic layouts",
    "Use only these layout kinds and provide their required slots:",
    layoutInstructions(layouts),
    "",
    "## Deck output contract",
    "The root object must conform to this PresentHTML Deck contract. Validate the generated object against the canonical Deck validator before importing it.",
    "```json",
    stableJson(outputContract),
    "```",
    "",
    "## PresentationBrief",
    "```json",
    stableJson(brief),
    "```",
  ].join("\n");
}

/**
 * The built-in deterministic strategy.  It returns a prompt and a
 * provider-neutral description of the canonical Deck output.
 */
export function deterministicPromptStrategy(input = {}) {
  const request = normalizeRequest(input);
  const outputContract = createDeckOutputContract(request.layouts);
  const prompt = renderPrompt({ ...request, outputContract });
  return {
    prompt,
    outputContract,
    supportedLayouts: clone(request.layouts),
    settings: clone(request.settings),
  };
}

function resolveStrategy(strategy) {
  if (typeof strategy === "function") return strategy;
  if (strategy && typeof strategy.generate === "function") return strategy.generate.bind(strategy);
  throw new TypeError("prompt strategy must be a function or an object with generate()");
}

function normalizeResult(value) {
  if (typeof value === "string") return { prompt: value };
  if (!isRecord(value)) throw new TypeError("prompt strategy must return a prompt result");
  const prompt = expectString(value.prompt, "prompt result.prompt");
  return {
    ...clone(value),
    prompt,
  };
}

/** Create the replaceable prompt strategy boundary. */
export function createPresentationPromptGenerator(strategy = deterministicPromptStrategy) {
  const generate = resolveStrategy(strategy);
  return Object.freeze({
    generate(input = {}, options = {}) {
      const request = normalizeRequest(input, options);
      return normalizeResult(generate(request));
    },
  });
}

export const defaultPromptGenerator = createPresentationPromptGenerator();

/** Generate a deterministic provider-neutral prompt result. */
export function generatePresentationPrompt(input = {}, options = {}) {
  return defaultPromptGenerator.generate(input, options);
}

/** Return the structured Deck contract used by the default prompt strategy. */
export function getDeckOutputContract(layouts = DEFAULT_LAYOUT_REGISTRY) {
  return clone(createDeckOutputContract(normalizeLayoutCapabilities(layouts)));
}

/** Validate a generated structured result at the canonical Deck boundary. */
export function validateGeneratedDeck(value) {
  if (typeof value === "string") return deserializeDeck(value);
  validateDeck(value);
  return value;
}

/** Import generated JSON/object data as an isolated, validated Deck value. */
export function importGeneratedDeck(value) {
  if (typeof value === "string") return deserializeDeck(value);
  validateDeck(value);
  return clone(value);
}
