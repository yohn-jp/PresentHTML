import { BRIEF_KIND, SCHEMA_ID, SCHEMA_VERSION } from "./schema.js";
import { parseJson, validatePresentationBrief } from "./validation.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createPresentationBrief(input = {}) {
  const brief = {
    schemaId: SCHEMA_ID,
    schemaVersion: SCHEMA_VERSION,
    kind: BRIEF_KIND,
    audience: input.audience,
    objective: input.objective,
    keyMessage: input.keyMessage,
    narrative: input.narrative,
    sections: input.sections,
  };
  if (input.slideCount !== undefined) brief.slideCount = input.slideCount;
  if (input.durationMinutes !== undefined) brief.durationMinutes = input.durationMinutes;
  validatePresentationBrief(brief);
  return clone(brief);
}

export function serializePresentationBrief(brief, space = 0) {
  validatePresentationBrief(brief);
  return JSON.stringify(brief, null, space);
}

export function deserializePresentationBrief(serialized) {
  const brief = parseJson(serialized, "brief");
  validatePresentationBrief(brief);
  return clone(brief);
}

export const createBrief = createPresentationBrief;
export const serializeBrief = serializePresentationBrief;
export const deserializeBrief = deserializePresentationBrief;
