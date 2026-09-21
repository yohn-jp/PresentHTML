import { createSlide } from "../core/deck.js";
import { createSlideNavigator } from "./navigator.js";
import { createLivePreview } from "./preview.js";

function requireElement(value, name) {
  if (!value || typeof value.replaceChildren !== "function") {
    throw new TypeError(`${name} must be a DOM element`);
  }
  return value;
}

function text(value) {
  return value === undefined || value === null ? "" : String(value);
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function defaultSlideFactory({ index }) {
  return createSlide({
    id: `slide-${index + 1}`,
    purpose: "Add the next idea",
    layout: {
      kind: "title",
      content: {
        title: "Untitled slide",
        subtitle: "Add a clear message",
      },
    },
  });
}

/**
 * Compose the browser-native authoring chrome around injected store and
 * renderer adapters.  Navigator and preview remain replaceable independently
 * of the semantic state boundary.
 */
export function createAuthoringShell({ root, store, renderer, createSlide: makeSlide } = {}) {
  const element = requireElement(root, "shell root");
  if (!store || typeof store.getState !== "function") throw new TypeError("shell store is required");
  if (!renderer) throw new TypeError("shell renderer is required");

  element.innerHTML = [
    '<header class="editor-header">',
    '  <div><p class="app-kicker">PresentHTML authoring</p><h1 data-editor-deck-title></h1><p class="app-status" data-editor-status>Semantic deck ready.</p></div>',
    '  <div class="editor-header-actions"><span class="editor-mode-label">Browser-native editor</span></div>',
    "</header>",
    '<main class="editor-workspace" aria-label="Presentation workspace">',
    '  <aside class="editor-sidebar editor-sidebar--left" data-editor-navigator></aside>',
    '  <section class="editor-canvas" aria-label="Live preview"><div data-editor-preview></div></section>',
    '  <aside class="editor-sidebar editor-sidebar--right" data-editor-properties></aside>',
    "</main>",
  ].join("\n");

  const navigatorRoot = element.querySelector("[data-editor-navigator]");
  const previewRoot = element.querySelector("[data-editor-preview]");
  const propertiesRoot = element.querySelector("[data-editor-properties]");
  const titleRoot = element.querySelector("[data-editor-deck-title]");
  const statusRoot = element.querySelector("[data-editor-status]");
  const createSlideValue = makeSlide || defaultSlideFactory;

  const navigator = createSlideNavigator({
    root: navigatorRoot,
    store,
    onAdd: (editorStore) => editorStore.addSlide(createSlideValue({
      index: editorStore.getState().deck.slides.length,
      deck: editorStore.getDeck(),
      activeSlideId: editorStore.getState().activeSlideId,
    })),
  });
  const preview = createLivePreview({ root: previewRoot, store, renderer });

  function renderProperties(state = store.getState()) {
    const active = state.deck.slides.find((slide) => slide.id === state.activeSlideId);
    titleRoot.textContent = text(state.deck.metadata.title);
    if (!active) {
      propertiesRoot.innerHTML = '<p class="editor-kicker">Semantic properties</p><h2>No active slide</h2><p class="editor-muted">Add a slide to begin authoring.</p>';
      statusRoot.textContent = "No active slide.";
      return;
    }
    const content = active.layout.content || {};
    const summary = content.title || content.statement || content.takeaway || active.purpose;
    propertiesRoot.innerHTML = [
      '<p class="editor-kicker">Semantic properties</p>',
      `<h2>${escapeHtml(summary)}</h2>`,
      '<dl class="editor-property-list">',
      `  <div><dt>Purpose</dt><dd>${escapeHtml(active.purpose)}</dd></div>`,
      `  <div><dt>Layout</dt><dd><code>${escapeHtml(active.layout.kind)}</code></dd></div>`,
      `  <div><dt>Slide id</dt><dd><code>${escapeHtml(active.id)}</code></dd></div>`,
      "</dl>",
    ].join("\n");
    statusRoot.textContent = `Editing slide ${state.deck.slides.indexOf(active) + 1} of ${state.deck.slides.length}.`;
  }

  const unsubscribe = store.subscribe(renderProperties);
  renderProperties();

  return Object.freeze({
    store,
    navigator,
    preview,
    render: renderProperties,
    destroy() {
      unsubscribe();
      navigator.destroy();
      preview.destroy();
      element.replaceChildren();
    },
  });
}
