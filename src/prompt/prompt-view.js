import { defaultPromptGenerator } from "./prompt-generator.js";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function promptText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.prompt === "string") return value.prompt;
  throw new TypeError("prompt must be a string or a prompt result");
}

/**
 * Browser clipboard adapter.  The browser API is injected/resolved here so
 * prompt generation itself remains usable in tests and non-browser contexts.
 */
export function createBrowserClipboardAdapter({ navigatorObject } = {}) {
  const source = navigatorObject === undefined
    ? (typeof globalThis !== "undefined" ? globalThis.navigator : undefined)
    : navigatorObject;
  if (!source || !source.clipboard || typeof source.clipboard.writeText !== "function") {
    throw new Error("browser clipboard API is unavailable");
  }
  return Object.freeze({
    writeText(text) {
      return source.clipboard.writeText(text);
    },
  });
}

/** Copy a generated prompt through an injected or browser clipboard adapter. */
export async function copyPromptToClipboard(prompt, clipboard) {
  const text = promptText(prompt);
  const adapter = clipboard || createBrowserClipboardAdapter();
  if (!adapter || typeof adapter.writeText !== "function") {
    throw new TypeError("clipboard adapter must provide writeText()");
  }
  await adapter.writeText(text);
  return { ok: true, text };
}

/**
 * Small DOM-free view adapter for an authoring shell.  It stores semantic
 * prompt results in memory and exposes copy as an explicit browser adapter
 * action; rendered DOM is never treated as canonical state.
 */
export function createPromptViewAdapter({
  generator = defaultPromptGenerator,
  clipboard,
  onStatus,
} = {}) {
  if (!generator || typeof generator.generate !== "function") {
    throw new TypeError("prompt generator must provide generate()");
  }
  if (onStatus !== undefined && typeof onStatus !== "function") {
    throw new TypeError("onStatus must be a function");
  }

  let result;
  const report = (status) => {
    if (onStatus) onStatus(status);
    return status;
  };

  const adapter = {
    generate(input = {}, options = {}) {
      result = generator.generate(input, options);
      return clone(result);
    },

    getResult() {
      return clone(result);
    },

    getPrompt() {
      return result === undefined ? undefined : result.prompt;
    },

    async copy() {
      if (result === undefined) throw new Error("cannot copy before a prompt has been generated");
      try {
        const copied = await copyPromptToClipboard(result, clipboard);
        return report(copied);
      } catch (error) {
        return report({ ok: false, error, message: error.message });
      }
    },
  };

  return Object.freeze(adapter);
}
