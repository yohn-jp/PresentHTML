import { createSlide } from "../core/deck.js";
import { createSlideNavigator } from "./navigator.js";
import { createLivePreview } from "./preview.js";
import { createPropertyEditor } from "./property-editor.js";

function requireElement(value, name) {
  if (!value || typeof value.replaceChildren !== "function") {
    throw new TypeError(`${name} must be a DOM element`);
  }
  return value;
}

function text(value) {
  return value === undefined || value === null ? "" : String(value);
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
export function createAuthoringShell({ root, store, renderer, createSlide: makeSlide, layoutRegistry } = {}) {
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
  const propertyEditor = createPropertyEditor({ root: propertiesRoot, store, layoutRegistry });

  function renderProperties(state = store.getState()) {
    const active = state.deck.slides.find((slide) => slide.id === state.activeSlideId);
    titleRoot.textContent = text(state.deck.metadata.title);
    if (!active) {
      statusRoot.textContent = "No active slide.";
      return;
    }
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
      propertyEditor.destroy();
      element.replaceChildren();
    },
  });
}
