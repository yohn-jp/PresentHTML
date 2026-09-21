/**
 * Semantic theme contract.
 *
 * Themes describe presentation values by role.  They do not contain layout
 * selectors, DOM nodes, or generated markup, so a theme can be replaced
 * without changing a Deck or a layout's semantic content.
 */

export const THEME_CONTRACT_ID = "presenthtml-theme";
export const THEME_CONTRACT_VERSION = 1;
export const THEME_CSS_PREFIX = "ph";

export const THEME_TOKEN_SECTIONS = Object.freeze([
  "geometry",
  "typography",
  "spacing",
  "grid",
  "color",
  "border",
  "radius",
  "shadow",
  "imagery",
]);

export const THEME_TOKEN_ROLES = Object.freeze({
  geometry: Object.freeze(["aspectRatio", "width", "height"]),
  typography: Object.freeze([
    "display",
    "title",
    "subtitle",
    "body",
    "caption",
    "metric",
  ]),
  spacing: Object.freeze(["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"]),
  grid: Object.freeze(["columns", "contentMaxWidth", "contentPadding", "columnGap", "rowGap"]),
  color: Object.freeze([
    "background",
    "surface",
    "surfaceRaised",
    "text",
    "textMuted",
    "textSubtle",
    "accent",
    "accentStrong",
    "accentContrast",
    "border",
    "borderStrong",
  ]),
  border: Object.freeze(["width", "style"]),
  radius: Object.freeze(["none", "sm", "md", "lg", "xl", "pill"]),
  shadow: Object.freeze(["none", "sm", "md", "lg"]),
  imagery: Object.freeze(["objectFit", "objectPosition", "radius", "overlay"]),
});

const TYPOGRAPHY_FIELDS = Object.freeze([
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((item) => deepFreeze(item));
    Object.freeze(value);
  }
  return value;
}

function fail(path, message) {
  throw new TypeError(`Invalid theme at ${path}: ${message}`);
}

function expectRecord(value, path) {
  if (!isPlainObject(value)) fail(path, "expected a plain object");
}

function expectString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(path, "expected a non-empty string");
  }
}

function expectCssValue(value, path) {
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    fail(path, "expected a finite CSS value");
  }
  expectString(value, path);
}

function expectNumber(value, path, { integer = false, minimum = 0 } = {}) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (integer && !Number.isInteger(value)) ||
    value < minimum
  ) {
    fail(path, `expected a finite number${integer ? " integer" : ""} >= ${minimum}`);
  }
}

function assertAllowedKeys(value, allowed, path) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) fail(`${path}.${unknown}`, "unsupported token");
}

function validateTypography(tokens, path) {
  THEME_TOKEN_ROLES.typography.forEach((role) => {
    const rolePath = `${path}.${role}`;
    expectRecord(tokens[role], rolePath);
    assertAllowedKeys(tokens[role], TYPOGRAPHY_FIELDS, rolePath);
    TYPOGRAPHY_FIELDS.forEach((field) => expectCssValue(tokens[role][field], `${rolePath}.${field}`));
  });
}

function validateCssRoles(tokens, section, path) {
  THEME_TOKEN_ROLES[section].forEach((role) => expectCssValue(tokens[role], `${path}.${role}`));
}

function validateTokens(tokens) {
  expectRecord(tokens, "theme.tokens");
  assertAllowedKeys(tokens, THEME_TOKEN_SECTIONS, "theme.tokens");
  THEME_TOKEN_SECTIONS.forEach((section) => expectRecord(tokens[section], `theme.tokens.${section}`));

  const geometryPath = "theme.tokens.geometry";
  assertAllowedKeys(tokens.geometry, THEME_TOKEN_ROLES.geometry, geometryPath);
  validateCssRoles(tokens.geometry, "geometry", geometryPath);

  validateTypography(tokens.typography, "theme.tokens.typography");

  const spacingPath = "theme.tokens.spacing";
  assertAllowedKeys(tokens.spacing, THEME_TOKEN_ROLES.spacing, spacingPath);
  validateCssRoles(tokens.spacing, "spacing", spacingPath);

  const gridPath = "theme.tokens.grid";
  assertAllowedKeys(tokens.grid, THEME_TOKEN_ROLES.grid, gridPath);
  expectNumber(tokens.grid.columns, `${gridPath}.columns`, { integer: true, minimum: 1 });
  ["contentMaxWidth", "contentPadding", "columnGap", "rowGap"].forEach((role) =>
    expectCssValue(tokens.grid[role], `${gridPath}.${role}`),
  );

  const colorPath = "theme.tokens.color";
  assertAllowedKeys(tokens.color, THEME_TOKEN_ROLES.color, colorPath);
  validateCssRoles(tokens.color, "color", colorPath);

  const borderPath = "theme.tokens.border";
  assertAllowedKeys(tokens.border, THEME_TOKEN_ROLES.border, borderPath);
  validateCssRoles(tokens.border, "border", borderPath);

  const radiusPath = "theme.tokens.radius";
  assertAllowedKeys(tokens.radius, THEME_TOKEN_ROLES.radius, radiusPath);
  validateCssRoles(tokens.radius, "radius", radiusPath);

  const shadowPath = "theme.tokens.shadow";
  assertAllowedKeys(tokens.shadow, THEME_TOKEN_ROLES.shadow, shadowPath);
  validateCssRoles(tokens.shadow, "shadow", shadowPath);

  const imageryPath = "theme.tokens.imagery";
  assertAllowedKeys(tokens.imagery, THEME_TOKEN_ROLES.imagery, imageryPath);
  validateCssRoles(tokens.imagery, "imagery", imageryPath);

  return tokens;
}

/** Validate a complete theme without changing the supplied value. */
export function validateTheme(theme) {
  expectRecord(theme, "theme");
  assertAllowedKeys(theme, ["id", "version", "name", "tokens"], "theme");
  expectString(theme.id, "theme.id");
  if (theme.version !== THEME_CONTRACT_VERSION) {
    fail("theme.version", `expected ${THEME_CONTRACT_VERSION}`);
  }
  if (theme.name !== undefined) expectString(theme.name, "theme.name");
  validateTokens(theme.tokens);
  return theme;
}

/** Create an immutable theme value suitable for registration or resolution. */
export function createTheme(input) {
  validateTheme(input);
  return deepFreeze(clone(input));
}

function themeId(value) {
  if (typeof value === "string") return value;
  if (isPlainObject(value) && value.id !== undefined) return value.id;
  return undefined;
}

function isTheme(value) {
  return isPlainObject(value) && value.tokens !== undefined;
}

/**
 * Create an isolated theme registry.  The registry is the substitution
 * boundary used by renderers; it never mutates Deck data.
 */
export function createThemeRegistry(initialThemes = [], { defaultId } = {}) {
  const themes = new Map();
  const values = Array.isArray(initialThemes) ? initialThemes : [initialThemes];

  function register(theme, { replace = false } = {}) {
    const value = createTheme(theme);
    if (!replace && themes.has(value.id)) {
      throw new TypeError(`Theme already registered: ${value.id}`);
    }
    themes.set(value.id, value);
    return value;
  }

  values.filter((value) => value !== undefined).forEach((theme) => register(theme));
  const initialDefault = defaultId || (values[0] && values[0].id);

  function get(ref) {
    if (isTheme(ref)) return createTheme(ref);
    const id = themeId(ref);
    if (id === undefined) return undefined;
    return themes.get(id);
  }

  function resolve(ref) {
    const value = ref === undefined ? themes.get(initialDefault) : get(ref);
    if (!value) {
      const id = themeId(ref);
      throw new RangeError(`Theme not found: ${id === undefined ? "(default)" : id}`);
    }
    if (isPlainObject(ref) && ref.version !== undefined && ref.version !== value.version) {
      throw new RangeError(`Theme version mismatch for ${value.id}`);
    }
    return value;
  }

  function unregister(ref) {
    const id = themeId(ref);
    if (id === undefined) return false;
    return themes.delete(id);
  }

  return Object.freeze({
    register,
    get,
    resolve,
    unregister,
    has: (ref) => themes.has(themeId(ref)),
    list: () => Object.freeze([...themes.values()]),
  });
}

/** Resolve a theme object or reference through an injected registry. */
export function resolveTheme(themeOrRef, registry) {
  if (isTheme(themeOrRef)) return createTheme(themeOrRef);
  if (!registry || typeof registry.resolve !== "function") {
    throw new TypeError("A theme registry is required to resolve a theme reference");
  }
  return registry.resolve(themeOrRef);
}
