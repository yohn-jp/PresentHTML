import {
  DECK_KIND,
  DEFAULT_THEME_REF,
  SCHEMA_ID,
  SCHEMA_VERSION,
} from "./schema.js";
import {
  parseJson,
  validateSlide,
  validateDeck,
  validateThemeRef,
} from "./validation.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createThemeRef(input) {
  const theme = input === undefined ? { ...DEFAULT_THEME_REF } : input;
  validateThemeRef(theme);
  return clone(theme);
}

export function createSlide({ id, purpose, layout, notes } = {}) {
  const slide = { id, purpose, layout };
  if (notes !== undefined) slide.notes = notes;
  validateSlide(slide);
  return clone(slide);
}

export function createDeck(input = {}) {
  const metadata = input.metadata || {};
  const deck = {
    schemaId: SCHEMA_ID,
    schemaVersion: SCHEMA_VERSION,
    kind: DECK_KIND,
    metadata: {
      title: metadata.title,
    },
    theme: createThemeRef(input.theme === undefined ? input.themeRef : input.theme),
    slides: input.slides,
  };
  if (metadata.author !== undefined) deck.metadata.author = metadata.author;
  if (metadata.description !== undefined) deck.metadata.description = metadata.description;
  validateDeck(deck);
  return clone(deck);
}

export function serializeDeck(deck, space = 0) {
  validateDeck(deck);
  return JSON.stringify(deck, null, space);
}

export function deserializeDeck(serialized) {
  const deck = parseJson(serialized, "deck");
  validateDeck(deck);
  return clone(deck);
}
