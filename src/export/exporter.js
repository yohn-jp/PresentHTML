/**
 * Presentation exporter.
 *
 * This module is deliberately a packaging adapter.  It accepts the public
 * renderer result and never reads Deck fields, layout contracts, theme
 * tokens, or editor DOM.  A renderer can therefore be replaced as long as it
 * exposes `renderDeck(deck)` (or the equivalent `render(deck)`) and returns a
 * complete HTML document in its `html` property.
 */

const PRINT_STYLE_MARKER = "data-presenthtml-export-print";

// Keep this string in sync with print.css.  The source CSS remains a separate
// file for authoring/tooling; this copy lets a browser-native ES module create
// a standalone artifact without loading a stylesheet at runtime.
export const DEFAULT_PRINT_CSS = `@media print {
  @page {
    size: 16in 9in;
    margin: 0;
  }

  html,
  body {
    min-height: 0;
    padding: 0 !important;
    background: #fff !important;
  }

  .ph-presentation {
    display: block;
    width: 100%;
  }

  .ph-slide {
    width: 100% !important;
    min-height: 100vh;
    height: 100vh;
    aspect-ratio: auto;
    break-after: page;
    page-break-after: always;
  }

  .ph-slide:last-child {
    break-after: auto;
    page-break-after: auto;
  }
}`;

export const EXPORTER_CONTRACT_ID = "presenthtml-exporter";
export const EXPORTER_CONTRACT_VERSION = 1;

class PresentationExportError extends Error {
  constructor(message) {
    super(message);
    this.name = "PresentationExportError";
  }
}

export { PresentationExportError };

function isEmbeddedUrl(value) {
  const source = String(value).trim();
  return /^(?:data:|about:)/i.test(source) || source.startsWith("#");
}

function isExternalUrl(value) {
  const source = String(value).trim();
  return /^(?:https?:|file:|ftp:|blob:|javascript:|vbscript:|data:text\/html)/i.test(source)
    || source.startsWith("//");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&#39;");
}

function assertHtmlDocument(html) {
  if (typeof html !== "string" || html.trim().length === 0) {
    throw new PresentationExportError("Renderer output must contain a non-empty html string");
  }
  if (!/^\s*<!doctype\s+html\b/i.test(html)) {
    throw new PresentationExportError("Renderer output must be one HTML document");
  }
  if ((html.match(/<html\b/gi) || []).length !== 1 || (html.match(/<\/html\s*>/gi) || []).length !== 1) {
    throw new PresentationExportError("Renderer output must contain exactly one html element");
  }
  if (/<script\b/i.test(html) || /<iframe\b/i.test(html)) {
    throw new PresentationExportError("Exported presentation cannot contain executable or embedded documents");
  }
}

function rendererMethod(renderer) {
  if (typeof renderer === "function") return renderer;
  if (!renderer || typeof renderer !== "object") {
    throw new TypeError("A renderer with a public renderDeck(deck) method is required");
  }
  if (typeof renderer.renderDeck === "function") return renderer.renderDeck.bind(renderer);
  if (typeof renderer.render === "function") return renderer.render.bind(renderer);
  throw new TypeError("Renderer must expose renderDeck(deck) or render(deck)");
}

function renderedHtml(rendered) {
  if (typeof rendered === "string") return rendered;
  if (rendered && typeof rendered.html === "string") return rendered.html;
  throw new PresentationExportError("Renderer result must expose html");
}

function resourceValue(resources, source) {
  if (resources === undefined || resources === null) return undefined;
  if (resources instanceof Map) return resources.get(source);
  if (typeof resources === "object" && Object.prototype.hasOwnProperty.call(resources, source)) {
    return resources[source];
  }
  return undefined;
}

function bytesToBase64(bytes) {
  let binary = "";
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < values.length; index += 0x8000) {
    binary += String.fromCharCode(...values.subarray(index, index + 0x8000));
  }
  if (typeof btoa === "function") return btoa(binary);
  // Node's Buffer is intentionally used only as an optional packaging aid;
  // product runtime never requires Node or a server.
  if (typeof Buffer !== "undefined") return Buffer.from(values).toString("base64");
  throw new PresentationExportError("Cannot encode a binary resource in this runtime");
}

function resourceToDataUrl(value, source) {
  if (typeof value === "string") {
    if (!/^data:/i.test(value)) {
      throw new PresentationExportError(`Resource for ${source} must be a data URL`);
    }
    return value;
  }
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    throw new PresentationExportError(`Binary resource for ${source} needs a mimeType`);
  }
  if (!value || typeof value !== "object") {
    throw new PresentationExportError(`Resource for ${source} is not embeddable`);
  }
  if (typeof value.dataUrl === "string") return resourceToDataUrl(value.dataUrl, source);
  const mimeType = value.mimeType || value.type;
  const bytes = value.bytes || value.data;
  if (typeof mimeType !== "string" || (!bytes && bytes !== 0)) {
    throw new PresentationExportError(`Resource for ${source} needs dataUrl or mimeType/data`);
  }
  if (typeof bytes === "string") {
    return `data:${mimeType};base64,${bytes}`;
  }
  if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
    return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  }
  throw new PresentationExportError(`Resource for ${source} contains unsupported data`);
}

function resolveResource(source, { resources, resourceResolver } = {}) {
  const mapped = resourceValue(resources, source);
  const value = mapped === undefined && typeof resourceResolver === "function"
    ? resourceResolver(source)
    : mapped;
  if (value && typeof value.then === "function") {
    throw new PresentationExportError("Resource resolver must be synchronous");
  }
  if (value === undefined) {
    throw new PresentationExportError(`Resource is not embedded: ${source}`);
  }
  return resourceToDataUrl(value, source);
}

function replaceResourceAttributes(html, options) {
  // Only resource-bearing elements are rewritten.  Navigation links are not
  // resources and are left untouched; stylesheet links are rejected below.
  const resourceTag = /<(?:img|source|audio|video|track|object|embed)\b[^>]*>/gi;
  return html.replace(resourceTag, (tag) => tag.replace(
    /\b(src|data)=(["'])(.*?)\2/gi,
    (match, name, quote, source) => {
      if (isEmbeddedUrl(source)) return match;
      return `${name}=${quote}${escapeAttribute(resolveResource(source, options))}${quote}`;
    },
  ));
}

function replaceCssResources(html, options) {
  return html.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (match, quote, source) => {
    if (isEmbeddedUrl(source)) return match;
    return `url(${quote}${escapeAttribute(resolveResource(source.trim(), options))}${quote})`;
  });
}

function assertNoUnpackagedResources(html) {
  if (/<link\b[^>]*\bhref\s*=/i.test(html)) {
    throw new PresentationExportError("Exported presentation cannot contain a stylesheet link");
  }
  html.replace(/<(?:img|source|audio|video|track|object|embed)\b[^>]*>/gi, (tag) => {
    tag.replace(/\b(src|data)=(["'])(.*?)\2/gi, (_match, _name, _quote, source) => {
      if (!isEmbeddedUrl(source) || isExternalUrl(source)) {
        throw new PresentationExportError(`Resource is not self-contained: ${source}`);
      }
      return _match;
    });
    return tag;
  });
  html.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (_match, _quote, source) => {
    if (!isEmbeddedUrl(source) || isExternalUrl(source)) {
      throw new PresentationExportError(`CSS resource is not self-contained: ${source.trim()}`);
    }
    return _match;
  });
}

function withPrintCss(html, printCss = DEFAULT_PRINT_CSS) {
  if (typeof printCss !== "string" || printCss.trim().length === 0) {
    throw new TypeError("printCss must be a non-empty string");
  }
  if (html.includes(PRINT_STYLE_MARKER)) return html;
  const style = `    <style ${PRINT_STYLE_MARKER}>\n${printCss.split("\n").map((line) => line.trim().length === 0 ? "" : `      ${line}`).join("\n")}\n    </style>`;
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${style}\n  </head>`);
  }
  throw new PresentationExportError("Renderer output must contain a head element");
}

/**
 * Embed resources in renderer HTML and add the print stylesheet.  This is a
 * pure string operation; it does not create or inspect DOM nodes.
 */
export function packageRenderedPresentation(rendered, options = {}) {
  let html = renderedHtml(rendered);
  assertHtmlDocument(html);
  const rendererResources = rendered && typeof rendered === "object"
    ? {
      ...(rendered.resources === undefined ? {} : { resources: rendered.resources }),
      ...(rendered.resourceResolver === undefined ? {} : { resourceResolver: rendered.resourceResolver }),
    }
    : {};
  const resourceOptions = {
    ...rendererResources,
    ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
  };
  html = replaceResourceAttributes(html, resourceOptions);
  html = replaceCssResources(html, resourceOptions);
  html = withPrintCss(html, options.printCss);
  assertNoUnpackagedResources(html);
  return html;
}

/** Export one standalone HTML document through a renderer's public boundary. */
export function exportPresentation(deck, {
  renderer,
  resources,
  resourceResolver,
  printCss = DEFAULT_PRINT_CSS,
} = {}) {
  const render = rendererMethod(renderer);
  const rendered = render(deck);
  if (rendered && typeof rendered.then === "function") {
    throw new PresentationExportError("Renderer must return synchronously");
  }
  return packageRenderedPresentation(rendered, { resources, resourceResolver, printCss });
}

/** Create a replaceable exporter adapter around a public renderer. */
export function createPresentationExporter({ renderer, resources, resourceResolver, printCss } = {}) {
  const render = rendererMethod(renderer);
  const defaults = { resources, resourceResolver, printCss };
  const exportHtml = (deck, options = {}) => packageRenderedPresentation(
    render(deck),
    { ...defaults, ...options },
  );
  return Object.freeze({
    id: EXPORTER_CONTRACT_ID,
    version: EXPORTER_CONTRACT_VERSION,
    export: exportHtml,
    package: packageRenderedPresentation,
  });
}
