import { MVP_LAYOUT_FIXTURES as CORE_FIXTURE_SOURCE } from "../core/fixtures.js";
import { validateLayoutContent } from "../core/validation.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const fixtureValues = clone(CORE_FIXTURE_SOURCE);
Object.entries(fixtureValues).forEach(([kind, content]) => {
  validateLayoutContent(kind, content);
});

/** Representative semantic content for every MVP layout kind. */
export const MVP_LAYOUT_FIXTURES = Object.freeze(fixtureValues);

export function createMvpLayoutFixtures() {
  return clone(MVP_LAYOUT_FIXTURES);
}

export function getLayoutFixture(kind) {
  if (!Object.prototype.hasOwnProperty.call(MVP_LAYOUT_FIXTURES, kind)) return undefined;
  return clone(MVP_LAYOUT_FIXTURES[kind]);
}

export function requireLayoutFixture(kind) {
  const fixture = getLayoutFixture(kind);
  if (fixture === undefined) throw new RangeError(`Layout fixture not found: ${kind}`);
  return fixture;
}
