function requireElement(value, name) {
  if (!value || typeof value.addEventListener !== "function") {
    throw new TypeError(`${name} must be a DOM element`);
  }
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function labelFor(slide, index) {
  const content = slide.layout?.content || {};
  const title = content.title || content.statement || content.takeaway || slide.purpose;
  return escapeHtml(title || `Slide ${index + 1}`);
}

function button(action, label, slideId, disabled = false) {
  const id = slideId === undefined ? "" : ` data-slide-id="${encodeURIComponent(slideId)}"`;
  return `<button type="button" class="editor-button editor-button--small" data-editor-action="${action}"${id}${disabled ? " disabled" : ""}>${label}</button>`;
}

/**
 * DOM adapter for ordered semantic slide navigation.  The DOM only contains
 * labels and ids needed to dispatch actions; the Deck remains in the store.
 */
export function createSlideNavigator({ root, store, onAdd } = {}) {
  const element = requireElement(root, "navigator root");
  if (!store || typeof store.getState !== "function" || typeof store.subscribe !== "function") {
    throw new TypeError("navigator store must expose getState() and subscribe()");
  }
  if (onAdd !== undefined && typeof onAdd !== "function") {
    throw new TypeError("onAdd must be a function");
  }

  element.classList.add("editor-navigator");
  let destroyed = false;

  function render(state = store.getState()) {
    if (destroyed) return;
    const { deck, activeSlideId } = state;
    const items = deck.slides.map((slide, index) => {
      const selected = slide.id === activeSlideId;
      const first = index === 0;
      const last = index === deck.slides.length - 1;
      return [
        `<li class="editor-slide-item${selected ? " is-active" : ""}">`,
        `  <button type="button" class="editor-slide-select" data-editor-action="select" data-slide-id="${encodeURIComponent(slide.id)}" aria-current="${selected ? "true" : "false"}">`,
        `    <span class="editor-slide-number">${index + 1}</span>`,
        `    <span class="editor-slide-label"><strong>${labelFor(slide, index)}</strong><small>${escapeHtml(slide.layout.kind)}</small></span>`,
        "  </button>",
        `  <div class="editor-slide-actions" aria-label="Actions for slide ${index + 1}">`,
        `    ${button("move-up", "↑", slide.id, first)}`,
        `    ${button("move-down", "↓", slide.id, last)}`,
        `    ${button("duplicate", "Duplicate", slide.id)}`,
        `    ${button("delete", "Delete", slide.id)}`,
        "  </div>",
        "</li>",
      ].join("\n");
    }).join("\n");

    element.innerHTML = [
      '<div class="editor-panel-heading">',
      '  <div><p class="editor-kicker">Navigator</p><h2>Slides</h2></div>',
      '  <button type="button" class="editor-button" data-editor-action="add">Add slide</button>',
      "</div>",
      `<p class="editor-muted">${deck.slides.length} semantic slide${deck.slides.length === 1 ? "" : "s"}</p>`,
      `<ol class="editor-slide-list" aria-label="Presentation slides">${items}</ol>`,
    ].join("\n");
  }

  function slideIdFrom(target) {
    const value = target.closest("[data-slide-id]")?.dataset.slideId;
    return value === undefined ? undefined : decodeURIComponent(value);
  }

  function handleClick(event) {
    const control = event.target.closest("[data-editor-action]");
    if (!control || !element.contains(control)) return;
    const action = control.dataset.editorAction;
    const slideId = slideIdFrom(control);
    const state = store.getState();
    const index = state.deck.slides.findIndex((slide) => slide.id === slideId);
    if (action === "select") store.selectSlide(slideId);
    if (action === "duplicate") store.duplicateSlide(slideId);
    if (action === "delete") store.deleteSlide(slideId);
    if (action === "move-up") store.reorderSlide(slideId, index - 1);
    if (action === "move-down") store.reorderSlide(slideId, index + 1);
    if (action === "add") {
      if (onAdd) onAdd(store);
      else store.addSlide();
    }
  }

  element.addEventListener("click", handleClick);
  const unsubscribe = store.subscribe(render);
  render();

  return Object.freeze({
    render,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      element.removeEventListener("click", handleClick);
      element.replaceChildren();
    },
  });
}
