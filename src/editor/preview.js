function requireElement(value, name) {
  if (!value || typeof value.appendChild !== "function") {
    throw new TypeError(`${name} must be a DOM element`);
  }
  return value;
}

function renderWith(renderer, deck) {
  if (renderer && typeof renderer.renderDeck === "function") return renderer.renderDeck(deck);
  if (renderer && typeof renderer.render === "function") return renderer.render(deck);
  throw new TypeError("preview renderer must expose renderDeck() or render()");
}

/**
 * Renderer-backed preview adapter.  It keeps no preview representation: each
 * update renders the current canonical Deck and inserts only the renderer's
 * output markup into the preview surface.
 */
export function createLivePreview({ root, store, renderer } = {}) {
  const element = requireElement(root, "preview root");
  if (!store || typeof store.getState !== "function" || typeof store.subscribe !== "function") {
    throw new TypeError("preview store must expose getState() and subscribe()");
  }
  if (!renderer) throw new TypeError("preview renderer is required");

  element.classList.add("editor-preview");
  const style = document.createElement("style");
  style.dataset.editorPreviewStyles = "true";
  const presentation = document.createElement("div");
  presentation.className = "editor-preview-presentation";
  presentation.setAttribute("aria-live", "polite");
  element.replaceChildren(style, presentation);
  let currentRenderer = renderer;
  let destroyed = false;

  function render(state = store.getState()) {
    if (destroyed) return;
    const output = renderWith(currentRenderer, state.deck);
    const index = state.deck.slides.findIndex((slide) => slide.id === state.activeSlideId);
    style.textContent = typeof output.css === "string" ? output.css : "";
    if (Array.isArray(output.slides)) {
      const markup = index < 0 ? "" : (output.slides[index] || "");
      presentation.innerHTML = markup
        ? `<main class="ph-presentation" data-editor-preview-output>${markup}</main>`
        : '<p class="editor-preview-empty">Add a slide to start previewing.</p>';
      return output;
    }
    if (typeof output.html === "string") {
      presentation.innerHTML = output.html;
      return output;
    }
    throw new TypeError("preview renderer output must include slides or html");
  }

  const unsubscribe = store.subscribe(render);
  render();

  return Object.freeze({
    render,
    setRenderer(nextRenderer) {
      if (!nextRenderer) throw new TypeError("preview renderer is required");
      currentRenderer = nextRenderer;
      return render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      element.replaceChildren();
    },
  });
}
