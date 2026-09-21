import { createPresentationExporter } from "./exporter.js";

function defaultFilename(deck) {
  const title = deck && deck.metadata && typeof deck.metadata.title === "string"
    ? deck.metadata.title
    : "presentation";
  const safe = title
    .trim()
    .replace(/[^a-zA-Z0-9\u00a0-\uffff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${safe || "presentation"}.html`;
}

function assertHtml(html) {
  if (typeof html !== "string" || html.length === 0) {
    throw new TypeError("A standalone presentation HTML string is required");
  }
}

/**
 * Download a standalone presentation using browser-native Blob APIs.
 * The HTML is supplied by the exporter; this adapter has no editor state and
 * does not parse or mutate renderer output.
 */
export function downloadPresentationHtml(html, {
  filename = "presentation.html",
  documentObject = globalThis.document,
  urlObject = globalThis.URL,
  BlobConstructor = globalThis.Blob,
} = {}) {
  assertHtml(html);
  if (!documentObject || typeof documentObject.createElement !== "function") {
    throw new TypeError("A browser document is required to download a presentation");
  }
  if (!urlObject || typeof urlObject.createObjectURL !== "function") {
    throw new TypeError("A URL object with createObjectURL is required");
  }
  if (typeof BlobConstructor !== "function") {
    throw new TypeError("A Blob constructor is required");
  }

  const blob = new BlobConstructor([html], { type: "text/html;charset=utf-8" });
  const url = urlObject.createObjectURL(blob);
  const link = documentObject.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.hidden = true;
  (documentObject.body || documentObject.documentElement).append(link);
  link.click();
  link.remove();
  if (typeof urlObject.revokeObjectURL === "function") urlObject.revokeObjectURL(url);
  return { blob, url, filename };
}

/**
 * Bind the browser download affordance to a renderer-backed exporter.  The
 * caller owns the canonical Deck and passes it to `export` when needed.
 */
export function createPresentationExportAdapter({
  renderer,
  exporter,
  resources,
  resourceResolver,
  printCss,
  documentObject,
  urlObject,
  BlobConstructor,
} = {}) {
  const packagePresentation = exporter || createPresentationExporter({
    renderer,
    resources,
    resourceResolver,
    printCss,
  });

  function exportHtml(deck, options = {}) {
    return packagePresentation.export(deck, options);
  }

  function download(deck, options = {}) {
    const { filename = defaultFilename(deck), ...exportOptions } = options;
    const html = exportHtml(deck, exportOptions);
    return downloadPresentationHtml(html, {
      filename,
      documentObject,
      urlObject,
      BlobConstructor,
    });
  }

  return Object.freeze({ exportHtml, download });
}
