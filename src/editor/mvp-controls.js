import { importGeneratedDeck } from "../prompt/prompt-generator.js";

function requireElement(value, name) {
  if (!value || typeof value.appendChild !== "function" || typeof value.ownerDocument?.createElement !== "function") {
    throw new TypeError(`${name} must be a DOM element`);
  }
  return value;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return value === undefined || value === null ? "" : String(value);
}

function appendText(document, parent, tag, value, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.appendChild(element);
  return element;
}

function field(document, parent, labelText, name, value = "", type = "text") {
  const wrapper = document.createElement("label");
  wrapper.className = "mvp-field";
  wrapper.textContent = labelText;
  const control = document.createElement(type === "textarea" ? "textarea" : "input");
  control.name = name;
  control.dataset.mvpField = name;
  if (type !== "textarea") control.type = type;
  control.value = text(value);
  if (type === "textarea") control.rows = 3;
  wrapper.appendChild(control);
  parent.appendChild(wrapper);
  return control;
}

function button(document, parent, action, labelText, className = "editor-button") {
  const control = document.createElement("button");
  control.type = "button";
  control.className = className;
  control.dataset.mvpAction = action;
  control.textContent = labelText;
  parent.appendChild(control);
  return control;
}

function section(document, root, kicker, title) {
  const panel = document.createElement("section");
  panel.className = "mvp-integration-panel";
  const heading = document.createElement("div");
  heading.className = "mvp-panel-heading";
  appendText(document, heading, "p", kicker, "editor-kicker");
  appendText(document, heading, "h2", title);
  panel.appendChild(heading);
  root.appendChild(panel);
  return panel;
}

function briefFormValues(form) {
  const value = (name) => form.querySelector(`[data-mvp-field="${name}"]`)?.value.trim() || "";
  const slideCount = value("slideCount");
  const durationMinutes = value("durationMinutes");
  return {
    topic: value("topic"),
    audience: value("audience"),
    objective: value("objective"),
    keyMessage: value("keyMessage"),
    ...(slideCount ? { slideCount: Number(slideCount) } : {}),
    ...(durationMinutes ? { durationMinutes: Number(durationMinutes) } : {}),
  };
}

function briefFormFromBrief(form, brief) {
  if (!brief) return;
  const set = (name, value) => {
    const control = form.querySelector(`[data-mvp-field="${name}"]`);
    if (control) control.value = text(value);
  };
  const firstTopic = brief.sections?.[0]?.title || brief.keyMessage;
  set("topic", firstTopic);
  set("audience", brief.audience);
  set("objective", brief.objective);
  set("keyMessage", brief.keyMessage);
  set("slideCount", brief.slideCount);
  set("durationMinutes", brief.durationMinutes);
}

/**
 * Compose the MVP-only workflow controls around the existing semantic
 * adapters.  This module owns transient form values and browser actions; the
 * planner, prompt view, editor store, persistence adapter, and exporter own
 * the canonical semantic values.
 */
export function createMvpControls({
  root,
  store,
  planner,
  prompt,
  persistence,
  exporter,
  layoutRegistry,
  onStatus,
} = {}) {
  const element = requireElement(root, "MVP controls root");
  if (!store || typeof store.getDeck !== "function" || typeof store.replaceDeck !== "function") {
    throw new TypeError("MVP controls require an editor store");
  }
  if (!planner || typeof planner.plan !== "function" || typeof planner.getBrief !== "function") {
    throw new TypeError("MVP controls require a planner view adapter");
  }
  if (!prompt || typeof prompt.generate !== "function" || typeof prompt.copy !== "function") {
    throw new TypeError("MVP controls require a prompt view adapter");
  }
  if (!persistence || typeof persistence.exportJson !== "function" || typeof persistence.importFile !== "function") {
    throw new TypeError("MVP controls require a project persistence adapter");
  }
  if (!exporter || typeof exporter.exportHtml !== "function" || typeof exporter.download !== "function") {
    throw new TypeError("MVP controls require a presentation export adapter");
  }

  const document = element.ownerDocument;
  const integration = document.createElement("section");
  integration.className = "mvp-integration";
  integration.setAttribute("aria-label", "PresentHTML workflow");

  const briefPanel = section(document, integration, "1 · Intent", "Create a presentation brief");
  appendText(document, briefPanel, "p", "Start with audience, objective, and the message that should survive into the deck.", "editor-muted");
  const briefForm = document.createElement("div");
  briefForm.className = "mvp-form-grid";
  field(document, briefForm, "Topic", "topic");
  field(document, briefForm, "Audience", "audience");
  field(document, briefForm, "Objective", "objective");
  field(document, briefForm, "Key message", "keyMessage");
  field(document, briefForm, "Slide count hint", "slideCount", "", "number");
  field(document, briefForm, "Duration (minutes)", "durationMinutes", "", "number");
  briefPanel.appendChild(briefForm);
  const briefActions = document.createElement("div");
  briefActions.className = "mvp-actions";
  button(document, briefActions, "plan", "Plan brief");
  briefPanel.appendChild(briefActions);

  const promptPanel = section(document, integration, "2 · Prompt", "Generate a Deck prompt");
  appendText(document, promptPanel, "p", "Copy the provider-neutral prompt into an LLM, then paste its JSON Deck below or author slides manually.", "editor-muted");
  const promptOutput = field(document, promptPanel, "Generated prompt", "prompt", "", "textarea");
  promptOutput.readOnly = true;
  promptOutput.rows = 8;
  const promptActions = document.createElement("div");
  promptActions.className = "mvp-actions";
  button(document, promptActions, "generate-prompt", "Generate prompt");
  button(document, promptActions, "copy-prompt", "Copy prompt", "editor-button editor-button--small");
  promptPanel.appendChild(promptActions);

  const deckPanel = section(document, integration, "3 · Deck", "Import or author semantic slides");
  appendText(document, deckPanel, "p", "The editor below changes canonical Deck data through layout metadata; this text area is only an explicit import surface.", "editor-muted");
  const deckJson = field(document, deckPanel, "Deck JSON", "deckJson", JSON.stringify(store.getDeck(), null, 2), "textarea");
  deckJson.rows = 8;
  const deckActions = document.createElement("div");
  deckActions.className = "mvp-actions";
  button(document, deckActions, "import-deck", "Import Deck JSON");
  deckPanel.appendChild(deckActions);

  const projectPanel = section(document, integration, "4 · Project", "Save, reopen, and export");
  appendText(document, projectPanel, "p", "Project JSON contains semantic Brief and Deck data only. Export uses the same renderer as live preview.", "editor-muted");
  const projectActions = document.createElement("div");
  projectActions.className = "mvp-actions mvp-actions--wrap";
  button(document, projectActions, "save-project", "Save project JSON");
  const projectFile = document.createElement("input");
  projectFile.type = "file";
  projectFile.accept = ".json,application/json";
  projectFile.dataset.mvpProjectFile = "true";
  projectFile.className = "mvp-file-input";
  const projectLabel = document.createElement("label");
  projectLabel.className = "editor-button editor-button--small mvp-file-label";
  projectLabel.textContent = "Reopen project JSON";
  projectLabel.appendChild(projectFile);
  projectActions.appendChild(projectLabel);
  button(document, projectActions, "export-presentation", "Export presentation HTML");
  projectPanel.appendChild(projectActions);

  const status = appendText(document, integration, "p", "Ready. Semantic state is held by the adapters.", "mvp-integration-status");
  element.insertBefore(integration, element.firstChild);

  function report(message, error) {
    status.textContent = message;
    status.dataset.status = error ? "error" : "ok";
    if (onStatus) onStatus({ message, error });
  }

  function currentBrief() {
    const brief = planner.getBrief();
    if (!brief) throw new Error("Create a brief before generating a prompt");
    return brief;
  }

  function handleClick(event) {
    const action = event.target.closest("[data-mvp-action]")?.dataset.mvpAction;
    if (!action || !integration.contains(event.target)) return;
    try {
      if (action === "plan") {
        const brief = planner.plan(briefFormValues(briefForm));
        briefFormFromBrief(briefForm, brief);
        report("PresentationBrief created. Generate a prompt or edit the Deck below.");
      } else if (action === "generate-prompt") {
        const result = prompt.generate(currentBrief(), { layoutRegistry });
        promptOutput.value = result.prompt;
        report("Prompt generated. It is ready to copy.");
      } else if (action === "copy-prompt") {
        Promise.resolve(prompt.copy()).then((result) => {
          if (result?.ok) report("Prompt copied to the clipboard.");
          else report(result?.message || "Clipboard is unavailable; select the prompt to copy it.", result?.error);
        });
      } else if (action === "import-deck") {
        const deck = importGeneratedDeck(deckJson.value);
        store.replaceDeck(deck);
        report(`Deck imported: ${deck.slides.length} semantic slides.`);
      } else if (action === "save-project") {
        const result = persistence.download({ filename: "presenthtml-project.json" });
        if (result.ok) report("Project JSON downloaded.");
        else report(result.message, result.error);
      } else if (action === "export-presentation") {
        exporter.download(store.getDeck(), { filename: "presenthtml-presentation.html" });
        report("Standalone JavaScript-free presentation exported.");
      }
    } catch (error) {
      report(error.message, error);
    }
  }

  async function handleProjectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await persistence.importFile(file);
    if (result.ok) {
      briefFormFromBrief(briefForm, planner.getBrief());
      report(`Project reopened: ${result.project.deck.slides.length} semantic slides.`);
    } else {
      report(result.message, result.error);
    }
    event.target.value = "";
  }

  integration.addEventListener("click", handleClick);
  projectFile.addEventListener("change", handleProjectFile);
  const unsubscribe = planner.subscribe((brief) => briefFormFromBrief(briefForm, brief));
  briefFormFromBrief(briefForm, planner.getBrief());

  return Object.freeze({
    render() {
      briefFormFromBrief(briefForm, planner.getBrief());
    },
    getBrief: () => clone(planner.getBrief()),
    destroy() {
      unsubscribe();
      integration.removeEventListener("click", handleClick);
      projectFile.removeEventListener("change", handleProjectFile);
      integration.remove();
    },
  });
}
