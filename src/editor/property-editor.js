import { DEFAULT_LAYOUT_REGISTRY } from "../layouts/core-layouts.js";
import { createContentControls } from "./content-controls.js";
import { createLayoutSwitcher } from "./layout-switch.js";

function requireElement(value, name) {
  if (!value || typeof value.replaceChildren !== "function" || typeof value.ownerDocument?.createElement !== "function") {
    throw new TypeError(`${name} must be a DOM element`);
  }
  return value;
}

function appendText(document, parent, tag, value, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.appendChild(element);
  return element;
}

/**
 * Compose layout-driven semantic controls.  This adapter owns no semantic
 * state: every committed value goes through the editor store's canonical
 * Deck validation boundary.
 */
export function createPropertyEditor({ root, store, layoutRegistry, registry, onError } = {}) {
  const element = requireElement(root, "property editor root");
  if (!store || typeof store.getState !== "function" || typeof store.subscribe !== "function") {
    throw new TypeError("property editor store must expose getState() and subscribe()");
  }
  layoutRegistry = layoutRegistry || registry || DEFAULT_LAYOUT_REGISTRY;
  if (!layoutRegistry || typeof layoutRegistry.resolve !== "function") {
    throw new TypeError("property editor requires a layout registry");
  }

  let destroyed = false;
  let controls;
  let switcher;
  let errorNode;
  let lastError;

  function report(error) {
    lastError = error;
    if (errorNode) {
      errorNode.hidden = !error;
      errorNode.textContent = error ? `Could not save change: ${error.message}` : "";
    }
    if (onError) onError(error);
  }

  function commitContent(nextContent) {
    const state = store.getState();
    const active = state.deck.slides.find((slide) => slide.id === state.activeSlideId);
    if (!active) return;
    try {
      store.updateSlideContent(active.id, nextContent);
      report(undefined);
    } catch (error) {
      // Store.commit validates before replacing its Deck, so invalid input
      // leaves the canonical state intact while the transient control can be
      // corrected by the author.
      report(error);
    }
  }

  function render(state = store.getState()) {
    if (destroyed) return;
    controls?.destroy();
    switcher?.destroy();
    element.replaceChildren();
    const active = state.deck.slides.find((slide) => slide.id === state.activeSlideId);
    if (!active) {
      appendText(element.ownerDocument, element, "p", "Semantic properties", "editor-kicker");
      appendText(element.ownerDocument, element, "h2", "No active slide");
      appendText(element.ownerDocument, element, "p", "Add a slide to begin authoring.", "editor-muted");
      controls = undefined;
      switcher = undefined;
      return;
    }

    let contract;
    try {
      contract = layoutRegistry.resolve(active.layout.kind);
    } catch (error) {
      appendText(element.ownerDocument, element, "p", "Semantic properties", "editor-kicker");
      appendText(element.ownerDocument, element, "h2", "Unknown layout");
      report(error);
      return;
    }

    const heading = element.ownerDocument.createElement("div");
    heading.className = "editor-panel-heading";
    const headingText = element.ownerDocument.createElement("div");
    appendText(element.ownerDocument, headingText, "p", "Semantic properties", "editor-kicker");
    appendText(element.ownerDocument, headingText, "h2", contract.name || contract.kind);
    heading.appendChild(headingText);
    element.appendChild(heading);

    if (contract.description) appendText(element.ownerDocument, element, "p", contract.description, "editor-muted");
    const switcherRoot = element.ownerDocument.createElement("div");
    switcherRoot.className = "editor-control-field editor-layout-switcher";
    element.appendChild(switcherRoot);
    const error = element.ownerDocument.createElement("p");
    error.className = "editor-control-error";
    error.setAttribute("role", "alert");
    error.hidden = !lastError;
    error.textContent = lastError ? `Could not save change: ${lastError.message}` : "";
    errorNode = error;
    element.appendChild(error);

    const controlsRoot = element.ownerDocument.createElement("div");
    controlsRoot.className = "editor-content-controls";
    element.appendChild(controlsRoot);
    switcher = createLayoutSwitcher({
      root: switcherRoot,
      store,
      layoutRegistry,
      onError: report,
    });
    controls = createContentControls({
      root: controlsRoot,
      contract,
      content: active.layout.content,
      onChange: (nextContent) => commitContent(nextContent),
      onError: report,
    });
  }

  const unsubscribe = store.subscribe(render);
  render();
  return Object.freeze({
    render,
    getContract() {
      const active = store.getState().deck.slides.find((slide) => slide.id === store.getState().activeSlideId);
      return active ? layoutRegistry.resolve(active.layout.kind) : undefined;
    },
    getLastError: () => lastError,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      controls?.destroy();
      switcher?.destroy();
      element.replaceChildren();
    },
  });
}
