import { validateDeck } from "../core/validation.js";
import { resolveTheme } from "../themes/theme-contract.js";
import { DEFAULT_THEME_REGISTRY } from "../themes/default-theme.js";
import { resolveLayout } from "../layouts/registry.js";
import { DEFAULT_LAYOUT_REGISTRY } from "../layouts/core-layouts.js";
import { renderPresentationCss } from "./render-css.js";
import {
  renderPresentationDocument,
  renderSlideMarkup,
} from "./html-renderer.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRegistry(registry, name) {
  if (!registry || typeof registry.resolve !== "function") {
    throw new TypeError(`${name} registry is required`);
  }
}

/**
 * Create the narrow, replaceable renderer adapter shared by preview/export.
 * It accepts only semantic Deck data and public layout/theme registries; it
 * has no editor or DOM dependency.
 */
export function createStaticRenderer({
  layoutRegistry = DEFAULT_LAYOUT_REGISTRY,
  themeRegistry = DEFAULT_THEME_REGISTRY,
} = {}) {
  assertRegistry(layoutRegistry, "A layout");
  assertRegistry(themeRegistry, "A theme");

  function renderSlide(slide, slideNumber = 1, deckTheme) {
    const layout = resolveLayout(slide.layout.kind, layoutRegistry);
    const content = layout.validate(slide.layout.content);
    return renderSlideMarkup({ slide, layout, content, slideNumber, theme: deckTheme });
  }

  function renderDeck(deck) {
    validateDeck(deck);
    const theme = resolveTheme(deck.theme, themeRegistry);
    const css = renderPresentationCss(theme, { registry: themeRegistry });
    const slides = deck.slides.map((slide, index) => renderSlide(slide, index + 1, theme));
    const html = renderPresentationDocument({
      deck,
      slides,
      css,
      themeId: theme.id,
    });

    // `html` is the complete output representation.  The semantic `deck`
    // remains the caller's canonical value and is never read back from this
    // markup.  The individual slide strings are useful to a live preview
    // adapter without requiring that adapter to parse the full document.
    return Object.freeze({
      html,
      css,
      slides: Object.freeze([...slides]),
      theme: clone(theme),
    });
  }

  return Object.freeze({
    render: renderDeck,
    renderDeck,
    renderSlide,
  });
}

/** Render a Deck with the default public MVP registries. */
export function renderDeck(deck, options = {}) {
  return createStaticRenderer(options).renderDeck(deck);
}
