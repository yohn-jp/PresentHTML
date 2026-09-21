import { createMvpBriefFixture, createMvpDeckFixture } from "./core/fixtures.js";
import { createStaticRenderer } from "./renderer/renderer.js";
import { createEditorStore } from "./editor/store.js";
import { createAuthoringShell } from "./editor/shell.js";
import { createMvpControls } from "./editor/mvp-controls.js";
import { createPlannerViewAdapter } from "./planner/planner-view.js";
import { createPromptViewAdapter, createBrowserClipboardAdapter } from "./prompt/prompt-view.js";
import { createProjectPersistenceAdapter } from "./project/project-ui.js";
import { createPresentationExportAdapter } from "./export/export-ui.js";
import { DEFAULT_LAYOUT_REGISTRY } from "./layouts/core-layouts.js";

const app = document.querySelector("[data-presenthtml-app]");

if (app) {
  const planner = createPlannerViewAdapter();
  planner.setBrief(createMvpBriefFixture());

  const store = createEditorStore({
    deck: createMvpDeckFixture(),
    defaultSlideFactory: ({ index }) => ({
      id: `slide-${index + 1}`,
      purpose: "Add the next idea",
      layout: {
        kind: "title",
        content: {
          title: "Untitled slide",
          subtitle: "Add a clear message",
        },
      },
    }),
  });
  const renderer = createStaticRenderer();
  let clipboard;
  try {
    clipboard = createBrowserClipboardAdapter();
  } catch {
    // Clipboard access is optional for file:// authoring.  The prompt remains
    // available for manual selection when the browser blocks clipboard APIs.
  }
  const prompt = createPromptViewAdapter({ clipboard });
  const persistence = createProjectPersistenceAdapter({
    getDeck: store.getDeck,
    replaceDeck: store.replaceDeck,
    getBrief: planner.getBrief,
    replaceBrief: planner.setBrief,
  });
  const exporter = createPresentationExportAdapter({ renderer });
  createAuthoringShell({ root: app, store, renderer, layoutRegistry: DEFAULT_LAYOUT_REGISTRY });
  createMvpControls({
    root: app,
    store,
    planner,
    prompt,
    persistence,
    exporter,
    layoutRegistry: DEFAULT_LAYOUT_REGISTRY,
  });
  app.dataset.appReady = "true";
}
