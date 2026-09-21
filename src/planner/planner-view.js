import { validatePresentationBrief } from "../core/validation.js";
import { defaultPlanner } from "./planner.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolvePlanner(value) {
  if (value && typeof value.plan === "function") return value;
  if (value && value.planner && typeof value.planner.plan === "function") return value.planner;
  return defaultPlanner;
}

/**
 * Minimal, DOM-free adapter for planner output.  It keeps editable semantic
 * data in memory, exposes snapshots to a view, and never treats rendered HTML
 * as state.
 */
export function createPlannerViewAdapter(plannerOrOptions = defaultPlanner) {
  const planner = resolvePlanner(plannerOrOptions);
  let brief;
  const listeners = new Set();

  function notify() {
    const snapshot = brief === undefined ? undefined : clone(brief);
    listeners.forEach((listener) => listener(snapshot));
  }

  function setBrief(nextBrief) {
    validatePresentationBrief(nextBrief);
    brief = clone(nextBrief);
    notify();
    return clone(brief);
  }

  const adapter = {
    plan(input = {}) {
      return setBrief(planner.plan(input));
    },

    getBrief() {
      return brief === undefined ? undefined : clone(brief);
    },

    setBrief,

    updateBrief(edit) {
      if (typeof edit !== "function" && (!edit || typeof edit !== "object")) {
        throw new TypeError("brief edit must be a function or a patch object");
      }
      if (brief === undefined) {
        throw new Error("cannot edit before a brief has been planned");
      }
      const draft = clone(brief);
      const result = typeof edit === "function" ? edit(draft) : Object.assign(draft, edit);
      return setBrief(result === undefined ? draft : result);
    },

    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("planner view listener must be a function");
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return Object.freeze(adapter);
}
