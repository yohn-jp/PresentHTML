import { createPresentationBrief } from "../core/brief.js";
import { validatePresentationBrief } from "../core/validation.js";
import { DEFAULT_PLANNER_TEMPLATES } from "./templates.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => text(item))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

function firstText(...values) {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return "";
}

function parseHint(value, name, { integer = false } = {}) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) {
    throw new TypeError(`${name} must be a non-negative ${integer ? "integer" : "number"}`);
  }
  return number;
}

function normalizeIntent(input = {}) {
  if (!isRecord(input)) {
    throw new TypeError("planner intent must be a plain object");
  }

  const rawNotes = firstText(input.rawNotes, input.notes, input.rawIntent);
  const topic = firstText(input.topic, rawNotes.split("\n")[0], "Untitled presentation");
  const audience = firstText(input.audience, "A general audience");
  const objective = firstText(input.objective, `Help ${audience} understand ${topic}`);
  const keyMessage = firstText(input.keyMessage, input.message, topic);
  const durationMinutes = parseHint(input.durationMinutes, "durationMinutes");
  const requestedSlideCount = parseHint(input.slideCount, "slideCount", { integer: true });

  // Six intentions are supplied by the default outline.  A hint is retained
  // in the canonical brief even when it intentionally differs from that
  // initial outline; later semantic editing can add or remove slides.
  const slideCount = requestedSlideCount === undefined
    ? (durationMinutes === undefined ? DEFAULT_PLANNER_TEMPLATES
      .reduce((count, section) => count + section.slideIntentions.length, 0)
      : Math.max(1, Math.round(durationMinutes)))
    : requestedSlideCount;

  return {
    topic,
    rawNotes,
    audience,
    objective,
    keyMessage,
    durationMinutes,
    slideCount,
  };
}

function contextualizeTemplates(intent, templates) {
  return templates.map((section) => ({
    id: section.id,
    title: section.title,
    intention: `${section.intention} Topic: ${intent.topic}.`,
    slideIntentions: section.slideIntentions.map((slide) => ({
      id: slide.id,
      purpose: `${slide.purpose} Focus: ${intent.keyMessage}.`,
      layoutKind: slide.layoutKind,
    })),
  }));
}

/**
 * The built-in, local planning strategy.  It accepts raw intent and returns
 * only canonical PresentationBrief data; it has no network or DOM dependency.
 */
export function deterministicPlannerStrategy(input = {}) {
  const intent = normalizeIntent(input);
  const sections = contextualizeTemplates(intent, DEFAULT_PLANNER_TEMPLATES);
  const beats = sections.map((section) => section.title);
  const summary = `${intent.topic} moves ${intent.audience} from context to action: ${intent.objective}.`;

  return createPresentationBrief({
    audience: intent.audience,
    objective: intent.objective,
    keyMessage: intent.keyMessage,
    narrative: { summary, beats },
    sections,
    slideCount: intent.slideCount,
    ...(intent.durationMinutes === undefined ? {} : { durationMinutes: intent.durationMinutes }),
  });
}

function resolveStrategy(strategy) {
  if (typeof strategy === "function") return strategy;
  if (strategy && typeof strategy.plan === "function") return strategy.plan.bind(strategy);
  throw new TypeError("planner strategy must be a function or an object with plan()");
}

/**
 * Create a replaceable planner boundary.  Custom strategies must return a
 * canonical PresentationBrief; this boundary validates and clones the result
 * so callers cannot mutate the strategy's state accidentally.
 */
export function createPresentationPlanner(strategy = deterministicPlannerStrategy) {
  const plan = resolveStrategy(strategy);
  return Object.freeze({
    plan(input = {}) {
      const brief = plan(input);
      // createPresentationBrief is intentionally not used here: custom
      // strategies may already contain fields introduced by the core contract.
      // The strategy boundary still requires the canonical shape by round-trip
      // validation through the public constructor's validator.
      if (!brief || typeof brief !== "object") {
        throw new TypeError("planner strategy must return a PresentationBrief");
      }
      validatePresentationBrief(brief);
      return clone(brief);
    },
  });
}

export const defaultPlanner = createPresentationPlanner();

export function planPresentationBrief(input = {}) {
  return defaultPlanner.plan(input);
}
