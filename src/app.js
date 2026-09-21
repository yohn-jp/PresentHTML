import { createMvpDeckFixture } from "./core/fixtures.js";
import { createStaticRenderer } from "./renderer/renderer.js";
import { createEditorStore } from "./editor/store.js";
import { createAuthoringShell } from "./editor/shell.js";

const app = document.querySelector("[data-presenthtml-app]");

if (app) {
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
  createAuthoringShell({ root: app, store, renderer });
  app.dataset.appReady = "true";
}
