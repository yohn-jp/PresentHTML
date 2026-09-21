import {
  THEME_CSS_PREFIX,
  resolveTheme,
} from "./theme-contract.js";

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function kebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

function flatten(value, path = [], output = []) {
  if (isPlainObject(value)) {
    Object.keys(value)
      .sort()
      .forEach((key) => flatten(value[key], [...path, key], output));
    return output;
  }
  output.push({ path, value });
  return output;
}

/** Return a stable list of semantic token/CSS value pairs. */
export function resolveThemeVariables(
  themeOrRef,
  { registry, prefix = THEME_CSS_PREFIX } = {},
) {
  const theme = resolveTheme(themeOrRef, registry);
  return flatten(theme.tokens).map(({ path, value }) => ({
    name: themeCssVariable(path, prefix),
    path: Object.freeze([...path]),
    value: String(value),
  }));
}

/** Convert a semantic token path into its renderer-facing CSS variable name. */
export function themeCssVariable(path, prefix = THEME_CSS_PREFIX) {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  if (
    typeof prefix !== "string" ||
    prefix.trim().length === 0 ||
    parts.length === 0 ||
    parts.some((part) => String(part).trim().length === 0)
  ) {
    throw new TypeError("A non-empty semantic token path is required");
  }
  return `--${kebabCase(prefix)}-${parts.map((part) => kebabCase(String(part))).join("-")}`;
}

/**
 * Resolve a theme into deterministic CSS custom properties.  The output is
 * presentation output only; the theme object remains the canonical semantic
 * value and can be resolved again by preview or export.
 */
export function resolveThemeCss(
  themeOrRef,
  { registry, selector = ":root", prefix = THEME_CSS_PREFIX } = {},
) {
  if (typeof selector !== "string" || selector.trim().length === 0) {
    throw new TypeError("CSS selector must be a non-empty string");
  }
  if (typeof prefix !== "string" || prefix.trim().length === 0) {
    throw new TypeError("CSS variable prefix must be a non-empty string");
  }

  const variables = resolveThemeVariables(themeOrRef, { registry, prefix });
  const lines = variables
    .map(({ path, value }) => `  ${themeCssVariable(path, prefix)}: ${value};`)
    .join("\n");
  return `${selector.trim()} {\n${lines}\n}`;
}
