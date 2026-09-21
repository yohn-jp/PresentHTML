import {
  THEME_CSS_PREFIX,
  resolveTheme,
} from "../themes/theme-contract.js";
import { resolveThemeCss } from "../themes/theme-css.js";

function resolveThemeOptions(options = {}) {
  const registry = options.themeRegistry || options.registry;
  return {
    registry,
    prefix: options.prefix || THEME_CSS_PREFIX,
  };
}

/**
 * Build the deterministic stylesheet used by the static renderer.
 *
 * The theme remains semantic input.  This function only translates it to
 * custom properties and renderer output; it never stores or mutates deck
 * state.  `themeRegistry` is intentionally injected so a renderer can be
 * used with a replacement theme implementation.
 */
export function renderPresentationCss(themeOrRef, options = {}) {
  const themeOptions = resolveThemeOptions(options);
  const theme = resolveTheme(themeOrRef, themeOptions.registry);
  const themeCss = resolveThemeCss(theme, themeOptions);

  return [
    themeCss,
    `
/* PresentHTML static presentation renderer */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background: var(--ph-color-background);
  color: var(--ph-color-text);
  font-family: var(--ph-typography-body-font-family);
}

body {
  padding: var(--ph-spacing-xl);
}

.ph-presentation {
  display: grid;
  gap: var(--ph-spacing-xl);
  justify-items: center;
  width: 100%;
}

.ph-slide {
  position: relative;
  display: grid;
  overflow: hidden;
  aspect-ratio: var(--ph-geometry-aspect-ratio);
  width: min(100%, var(--ph-geometry-width));
  min-height: 0;
  padding: var(--ph-grid-content-padding);
  background: var(--ph-color-surface);
  color: var(--ph-color-text);
  isolation: isolate;
}

.ph-slide::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--ph-color-background);
  content: "";
}

.ph-slide__content {
  display: grid;
  align-content: center;
  gap: var(--ph-spacing-lg);
  width: min(100%, var(--ph-grid-content-max-width));
  min-width: 0;
  margin: auto;
}

.ph-slide__eyebrow,
.ph-slide__number,
.ph-slide__label {
  margin: 0;
  color: var(--ph-color-accent-strong);
  font: var(--ph-typography-caption-font-weight) var(--ph-typography-caption-font-size) / var(--ph-typography-caption-line-height) var(--ph-typography-caption-font-family);
  letter-spacing: var(--ph-typography-caption-letter-spacing);
  text-transform: uppercase;
}

.ph-slide h1,
.ph-slide h2,
.ph-slide h3,
.ph-slide p,
.ph-slide blockquote,
.ph-slide figure,
.ph-slide ul {
  margin: 0;
}

.ph-slide h1,
.ph-slide h2 {
  font-family: var(--ph-typography-title-font-family);
  font-size: var(--ph-typography-title-font-size);
  font-weight: var(--ph-typography-title-font-weight);
  line-height: var(--ph-typography-title-line-height);
  letter-spacing: var(--ph-typography-title-letter-spacing);
}

.ph-slide__subtitle,
.ph-slide__supporting,
.ph-slide__body,
.ph-slide__takeaway,
.ph-slide__next-step {
  color: var(--ph-color-text-muted);
  font-family: var(--ph-typography-subtitle-font-family);
  font-size: var(--ph-typography-subtitle-font-size);
  font-weight: var(--ph-typography-subtitle-font-weight);
  line-height: var(--ph-typography-subtitle-line-height);
  letter-spacing: var(--ph-typography-subtitle-letter-spacing);
}

.ph-slide--title .ph-slide__content,
.ph-slide--statement .ph-slide__content,
.ph-slide--closing .ph-slide__content {
  max-width: 76rem;
}

.ph-slide--title {
  background: var(--ph-color-accent);
  color: var(--ph-color-accent-contrast);
}

.ph-slide--title::before {
  background: linear-gradient(135deg, var(--ph-color-accent-strong), var(--ph-color-accent));
}

.ph-slide--title .ph-slide__eyebrow,
.ph-slide--title .ph-slide__subtitle {
  color: var(--ph-color-accent-contrast);
}

.ph-slide--section {
  background: var(--ph-color-accent-strong);
  color: var(--ph-color-accent-contrast);
}

.ph-slide--section::before {
  background: var(--ph-color-accent-strong);
}

.ph-slide--section .ph-slide__number,
.ph-slide--section .ph-slide__subtitle {
  color: var(--ph-color-accent-contrast);
}

.ph-slide--statement blockquote {
  border-inline-start: var(--ph-border-width) var(--ph-border-style) var(--ph-color-accent);
  padding-inline-start: var(--ph-spacing-lg);
  font-family: var(--ph-typography-display-font-family);
  font-size: var(--ph-typography-display-font-size);
  font-weight: var(--ph-typography-display-font-weight);
  line-height: var(--ph-typography-display-line-height);
  letter-spacing: var(--ph-typography-display-letter-spacing);
}

.ph-slide__attribution {
  color: var(--ph-color-text-subtle);
  font-family: var(--ph-typography-caption-font-family);
  font-size: var(--ph-typography-caption-font-size);
  font-weight: var(--ph-typography-caption-font-weight);
  line-height: var(--ph-typography-caption-line-height);
}

.ph-slide__body-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: var(--ph-grid-column-gap);
  align-items: start;
}

.ph-slide__list,
.ph-slide__side-list {
  display: grid;
  gap: var(--ph-spacing-sm);
  padding-inline-start: var(--ph-spacing-lg);
  color: var(--ph-color-text-muted);
  font-family: var(--ph-typography-body-font-family);
  font-size: var(--ph-typography-body-font-size);
  line-height: var(--ph-typography-body-line-height);
}

.ph-slide__comparison,
.ph-slide__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ph-grid-column-gap);
}

.ph-slide__comparison-side,
.ph-slide__metric {
  display: grid;
  align-content: start;
  gap: var(--ph-spacing-sm);
  min-width: 0;
  padding: var(--ph-spacing-lg);
  border: var(--ph-border-width) var(--ph-border-style) var(--ph-color-border);
  border-radius: var(--ph-radius-lg);
  background: var(--ph-color-surface-raised);
  box-shadow: var(--ph-shadow-sm);
}

.ph-slide__comparison-side h3,
.ph-slide__metric-label {
  font-family: var(--ph-typography-subtitle-font-family);
  font-size: var(--ph-typography-subtitle-font-size);
  font-weight: var(--ph-typography-subtitle-font-weight);
  line-height: var(--ph-typography-subtitle-line-height);
}

.ph-slide__comparison-side p,
.ph-slide__metric-detail {
  color: var(--ph-color-text-muted);
  font-family: var(--ph-typography-body-font-family);
  font-size: var(--ph-typography-body-font-size);
  line-height: var(--ph-typography-body-line-height);
}

.ph-slide--image-text .ph-slide__content {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--ph-grid-column-gap);
}

.ph-slide--image-text .ph-slide__copy {
  display: grid;
  gap: var(--ph-spacing-lg);
}

.ph-slide--image-text .ph-slide__media {
  order: 2;
  overflow: hidden;
  border-radius: var(--ph-imagery-radius);
  box-shadow: var(--ph-shadow-md);
}

.ph-slide--image-text.ph-slide--image-left .ph-slide__media {
  order: 0;
}

.ph-slide__image {
  display: block;
  aspect-ratio: 16 / 9;
  width: 100%;
  object-fit: var(--ph-imagery-object-fit);
  object-position: var(--ph-imagery-object-position);
}

.ph-slide__caption {
  display: block;
  padding: var(--ph-spacing-sm) var(--ph-spacing-md);
  background: var(--ph-color-surface-raised);
  color: var(--ph-color-text-subtle);
  font-family: var(--ph-typography-caption-font-family);
  font-size: var(--ph-typography-caption-font-size);
  line-height: var(--ph-typography-caption-line-height);
}

.ph-slide__metric-value {
  color: var(--ph-color-accent-strong);
  font-family: var(--ph-typography-metric-font-family);
  font-size: var(--ph-typography-metric-font-size);
  font-weight: var(--ph-typography-metric-font-weight);
  line-height: var(--ph-typography-metric-line-height);
  letter-spacing: var(--ph-typography-metric-letter-spacing);
}

.ph-slide__metric-unit {
  color: var(--ph-color-text-muted);
  font-family: var(--ph-typography-subtitle-font-family);
  font-size: var(--ph-typography-subtitle-font-size);
  font-weight: var(--ph-typography-subtitle-font-weight);
}

.ph-slide--closing {
  background: var(--ph-color-text);
  color: var(--ph-color-accent-contrast);
}

.ph-slide--closing::before {
  background: var(--ph-color-text);
}

.ph-slide--closing .ph-slide__takeaway,
.ph-slide--closing .ph-slide__next-step,
.ph-slide--closing .ph-slide__attribution {
  color: var(--ph-color-accent-contrast);
}

.ph-slide--closing .ph-slide__next-step {
  display: inline-block;
  padding: var(--ph-spacing-md) var(--ph-spacing-lg);
  border-radius: var(--ph-radius-pill);
  background: var(--ph-color-accent);
}

.ph-slot {
  min-width: 0;
}

@media (max-width: 52rem) {
  body {
    padding: var(--ph-spacing-md);
  }

  .ph-slide {
    min-height: auto;
    padding: var(--ph-spacing-lg);
  }

  .ph-slide__body-layout,
  .ph-slide--image-text .ph-slide__content,
  .ph-slide__comparison,
  .ph-slide__metrics {
    grid-template-columns: 1fr;
  }

  .ph-slide--image-text .ph-slide__media,
  .ph-slide--image-text.ph-slide--image-left .ph-slide__media {
    order: 0;
  }
}
`.trim(),
  ].join("\n\n");
}
