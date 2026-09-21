import { createDeck, createSlide } from "../core/deck.js";
import { validateDeck } from "../core/validation.js";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isDeck(value) {
  return value && typeof value === "object" && value.kind === "deck";
}

function resolveInput(input = {}) {
  if (isDeck(input)) return { deck: input };
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("editor store options must be an object or Deck");
  }
  if (!input.deck) throw new TypeError("editor store requires a Deck");
  return input;
}

function activeFor(deck, requestedId) {
  if (requestedId && deck.slides.some((slide) => slide.id === requestedId)) {
    return requestedId;
  }
  return deck.slides[0]?.id;
}

function uniqueSlideId(slides, requestedId) {
  const base = String(requestedId || "slide").trim() || "slide";
  const ids = new Set(slides.map((slide) => slide.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function withSlideId(slide, id) {
  return createSlide({ ...clone(slide), id });
}

/**
 * Create the small state/action boundary used by editor adapters.
 *
 * The store owns a validated semantic Deck and an editor-only active id.  It
 * never stores DOM nodes or renderer output.  Every action creates a fresh
 * validated Deck so callers cannot mutate canonical state behind the store's
 * back.
 */
export function createEditorStore(input = {}) {
  const options = resolveInput(input);
  const defaultSlideFactory = options.defaultSlideFactory;
  if (defaultSlideFactory !== undefined && typeof defaultSlideFactory !== "function") {
    throw new TypeError("defaultSlideFactory must be a function");
  }

  let deck = createDeck(options.deck);
  let activeSlideId = activeFor(deck, options.activeSlideId);
  const listeners = new Set();

  function snapshot() {
    return Object.freeze({
      deck: clone(deck),
      activeSlideId,
    });
  }

  function notify() {
    const value = snapshot();
    listeners.forEach((listener) => listener(value));
    return value;
  }

  function commit(nextDeck, nextActiveSlideId = activeSlideId) {
    validateDeck(nextDeck);
    deck = createDeck(nextDeck);
    activeSlideId = activeFor(deck, nextActiveSlideId);
    return notify();
  }

  function currentIndex(slideId = activeSlideId) {
    return deck.slides.findIndex((slide) => slide.id === slideId);
  }

  function getState() {
    return snapshot();
  }

  function getDeck() {
    return clone(deck);
  }

  function getActiveSlide() {
    const index = currentIndex();
    return index < 0 ? undefined : clone(deck.slides[index]);
  }

  function selectSlide(slideId) {
    if (slideId === undefined || slideId === null) return snapshot();
    if (currentIndex(slideId) < 0) return snapshot();
    if (activeSlideId === slideId) return snapshot();
    activeSlideId = slideId;
    return notify();
  }

  function addSlide(slide, { index, select = true } = {}) {
    const source = slide === undefined
      ? (defaultSlideFactory ? defaultSlideFactory({
        index: deck.slides.length,
        deck: getDeck(),
        activeSlideId,
      }) : undefined)
      : slide;
    if (!source) throw new TypeError("addSlide requires a semantic slide or defaultSlideFactory");
    const candidate = createSlide(source);
    const value = withSlideId(candidate, uniqueSlideId(deck.slides, candidate.id));
    const nextSlides = deck.slides.map((item) => clone(item));
    const insertionIndex = Number.isInteger(index)
      ? Math.max(0, Math.min(index, nextSlides.length))
      : nextSlides.length;
    nextSlides.splice(insertionIndex, 0, value);
    return commit({ ...deck, slides: nextSlides }, select ? value.id : activeSlideId);
  }

  function duplicateSlide(slideId = activeSlideId) {
    const sourceIndex = currentIndex(slideId);
    if (sourceIndex < 0) return snapshot();
    const source = deck.slides[sourceIndex];
    const copy = withSlideId(source, uniqueSlideId(deck.slides, `${source.id}-copy`));
    const nextSlides = deck.slides.map((item) => clone(item));
    nextSlides.splice(sourceIndex + 1, 0, copy);
    return commit({ ...deck, slides: nextSlides }, copy.id);
  }

  function deleteSlide(slideId = activeSlideId) {
    const sourceIndex = currentIndex(slideId);
    if (sourceIndex < 0) return snapshot();
    const nextSlides = deck.slides.filter((slide) => slide.id !== slideId).map((item) => clone(item));
    const nextActive = nextSlides[Math.min(sourceIndex, nextSlides.length - 1)]?.id;
    return commit({ ...deck, slides: nextSlides }, nextActive);
  }

  function reorderSlide(slideIdOrIndex, targetIndex) {
    const sourceIndex = typeof slideIdOrIndex === "number"
      ? slideIdOrIndex
      : currentIndex(slideIdOrIndex);
    if (sourceIndex < 0 || sourceIndex >= deck.slides.length) return snapshot();
    if (!Number.isInteger(targetIndex)) throw new TypeError("targetIndex must be an integer");
    const boundedTarget = Math.max(0, Math.min(targetIndex, deck.slides.length - 1));
    if (sourceIndex === boundedTarget) return snapshot();
    const nextSlides = deck.slides.map((item) => clone(item));
    const [moved] = nextSlides.splice(sourceIndex, 1);
    nextSlides.splice(boundedTarget, 0, moved);
    return commit({ ...deck, slides: nextSlides }, activeSlideId);
  }

  function replaceDeck(nextDeck, { activeSlideId: requestedId } = {}) {
    return commit(nextDeck, requestedId === undefined ? activeSlideId : requestedId);
  }

  function updateSlide(slideId = activeSlideId, update) {
    const index = currentIndex(slideId);
    if (index < 0) return snapshot();
    if (typeof update !== "function" && (!update || typeof update !== "object" || Array.isArray(update))) {
      throw new TypeError("slide update must be a function or plain object");
    }
    const current = clone(deck.slides[index]);
    const nextSlide = typeof update === "function" ? update(current) : { ...current, ...clone(update) };
    const nextSlides = deck.slides.map((item, itemIndex) => itemIndex === index ? nextSlide : clone(item));
    return commit({ ...deck, slides: nextSlides }, activeSlideId);
  }

  function updateSlideContent(slideId = activeSlideId, content) {
    return updateSlide(slideId, (slide) => ({
      ...slide,
      layout: { ...slide.layout, content: clone(content) },
    }));
  }

  function updateSlideLayout(slideId = activeSlideId, layout) {
    if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
      throw new TypeError("slide layout must be a plain object");
    }
    return updateSlide(slideId, (slide) => ({
      ...slide,
      layout: clone(layout),
    }));
  }

  function subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return Object.freeze({
    getState,
    getDeck,
    getActiveSlide,
    selectSlide,
    addSlide,
    duplicateSlide,
    deleteSlide,
    reorderSlide,
    replaceDeck,
    updateSlide,
    updateSlideContent,
    updateSlideLayout,
    subscribe,
  });
}
