(() => {
  "use strict";

  const app = document.querySelector("[data-presenthtml-app]");
  if (!app) {
    return;
  }

  // The app shell has no domain state yet. Later layers can mount their
  // adapters here while keeping semantic state outside the rendered DOM.
  app.dataset.appReady = "true";
})();
