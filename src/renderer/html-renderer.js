function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function classToken(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "layout";
}

function text(value, className = "") {
  const classAttribute = className ? ` class="${className}"` : "";
  return `<span${classAttribute}>${escapeHtml(value)}</span>`;
}

function optionalParagraph(value, className) {
  if (value === undefined || value === null || value === "") return [];
  return [`<p class="${className}">${escapeHtml(value)}</p>`];
}

function renderList(items, className = "ph-slide__list") {
  if (!Array.isArray(items) || items.length === 0) return [];
  return [
    `<ul class="${className}">`,
    ...items.map((item) => `  <li>${escapeHtml(item)}</li>`),
    "</ul>",
  ];
}

function renderComparisonSide(side, sideName) {
  return [
    `<article class="ph-slide__comparison-side ph-slot ph-slot--${sideName}">`,
    `  <h3>${escapeHtml(side.heading)}</h3>`,
    ...(side.body ? [`  <p>${escapeHtml(side.body)}</p>`] : []),
    ...renderList(side.items, "ph-slide__side-list").map((line) => `  ${line}`),
    "</article>",
  ];
}

function renderMetric(metric, index) {
  return [
    `<article class="ph-slide__metric ph-slot ph-slot--metric-${index + 1}">`,
    `  <p class="ph-slide__metric-label">${escapeHtml(metric.label)}</p>`,
    `  <p class="ph-slide__metric-value">${escapeHtml(metric.value)}${metric.unit ? ` <span class="ph-slide__metric-unit">${escapeHtml(metric.unit)}</span>` : ""}</p>`,
    ...(metric.detail ? [`  <p class="ph-slide__metric-detail">${escapeHtml(metric.detail)}</p>`] : []),
    ...(metric.trend ? [`  <p class="ph-slide__label">${escapeHtml(metric.trend)}</p>`] : []),
    "</article>",
  ];
}

function renderCoreLayout(kind, content) {
  switch (kind) {
    case "title":
      return [
        ...(content.eyebrow ? [`<p class="ph-slide__eyebrow ph-slot ph-slot--eyebrow">${escapeHtml(content.eyebrow)}</p>`] : []),
        `<h1 class="ph-slot ph-slot--title">${escapeHtml(content.title)}</h1>`,
        ...optionalParagraph(content.subtitle, "ph-slide__subtitle ph-slot ph-slot--subtitle"),
      ];
    case "section":
      return [
        ...(content.number !== undefined ? [`<p class="ph-slide__number ph-slot ph-slot--number">${escapeHtml(content.number)}</p>`] : []),
        `<h1 class="ph-slot ph-slot--title">${escapeHtml(content.title)}</h1>`,
        ...optionalParagraph(content.subtitle, "ph-slide__subtitle ph-slot ph-slot--subtitle"),
      ];
    case "statement":
      return [
        `<blockquote class="ph-slot ph-slot--statement">${escapeHtml(content.statement)}</blockquote>`,
        ...optionalParagraph(content.supportingText, "ph-slide__supporting ph-slot ph-slot--supporting-text"),
        ...(content.attribution ? [`<p class="ph-slide__attribution ph-slot ph-slot--attribution">— ${escapeHtml(content.attribution)}</p>`] : []),
      ];
    case "title-body":
      return [
        ...(content.eyebrow ? [`<p class="ph-slide__eyebrow ph-slot ph-slot--eyebrow">${escapeHtml(content.eyebrow)}</p>`] : []),
        `<div class="ph-slide__body-layout">`,
        `  <h1 class="ph-slot ph-slot--title">${escapeHtml(content.title)}</h1>`,
        `  <div class="ph-slide__body-copy ph-slot ph-slot--body">`,
        `    <p class="ph-slide__body">${escapeHtml(content.body)}</p>`,
        ...renderList(content.bullets).map((line) => `    ${line}`),
        "  </div>",
        "</div>",
      ];
    case "comparison":
      return [
        ...(content.title ? [`<h1 class="ph-slot ph-slot--title">${escapeHtml(content.title)}</h1>`] : []),
        `<div class="ph-slide__comparison">`,
        ...renderComparisonSide(content.left, "left").map((line) => `  ${line}`),
        ...renderComparisonSide(content.right, "right").map((line) => `  ${line}`),
        "</div>",
      ];
    case "image-text": {
      const image = content.image;
      return [
        `<figure class="ph-slide__media ph-slot ph-slot--image">`,
        `  <img class="ph-slide__image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}">`,
        ...(image.caption ? [`  <figcaption class="ph-slide__caption">${escapeHtml(image.caption)}</figcaption>`] : []),
        "</figure>",
        `<div class="ph-slide__copy">`,
        `  <h1 class="ph-slot ph-slot--title">${escapeHtml(content.title)}</h1>`,
        `  <p class="ph-slide__body ph-slot ph-slot--body">${escapeHtml(content.body)}</p>`,
        "</div>",
      ];
    }
    case "kpi":
      return [
        ...(content.title ? [`<h1 class="ph-slot ph-slot--title">${escapeHtml(content.title)}</h1>`] : []),
        `<div class="ph-slide__metrics">`,
        ...content.metrics.flatMap((metric, index) => renderMetric(metric, index).map((line) => `  ${line}`)),
        "</div>",
      ];
    case "closing":
      return [
        `<h1 class="ph-slot ph-slot--title">${escapeHtml(content.title)}</h1>`,
        `<p class="ph-slide__takeaway ph-slot ph-slot--takeaway">${escapeHtml(content.takeaway)}</p>`,
        ...(content.nextStep ? [`<p class="ph-slide__next-step ph-slot ph-slot--next-step">${escapeHtml(content.nextStep)}</p>`] : []),
        ...(content.attribution ? [`<p class="ph-slide__attribution ph-slot ph-slot--attribution">${escapeHtml(content.attribution)}</p>`] : []),
      ];
    default:
      return renderGenericLayout(content);
  }
}

function renderGenericValue(value, depth = 0) {
  const indent = "  ".repeat(depth);
  if (Array.isArray(value)) {
    return [
      `${indent}<ul>`,
      ...value.flatMap((item) => [`${indent}  <li>${escapeHtml(item)}</li>`]),
      `${indent}</ul>`,
    ];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => [
      `${indent}<div class="ph-slot ph-slot--${classToken(key)}">`,
      `${indent}  <span class="ph-slide__label">${escapeHtml(key)}</span>`,
      ...renderGenericValue(item, depth + 1),
      `${indent}</div>`,
    ]);
  }
  return [`${indent}${escapeHtml(value)}`];
}

function renderGenericLayout(content) {
  return Object.entries(content).flatMap(([key, value]) => [
    `<div class="ph-slot ph-slot--${classToken(key)}">`,
    `  <span class="ph-slide__label">${escapeHtml(key)}</span>`,
    ...renderGenericValue(value, 1),
    "</div>",
  ]);
}

/** Render one semantic slide into static HTML markup. */
export function renderSlideMarkup({ slide, layout, content, slideNumber }) {
  const kind = classToken(layout.kind);
  const modifiers = layout.kind === "image-text" && content?.imagePosition
    ? ` ph-slide--image-${classToken(content.imagePosition)}`
    : "";
  const slideId = `ph-slide-${slideNumber}`;
  const layoutContent = content === undefined ? layout.validate(slide.layout.content) : content;
  const lines = [
    `<section class="ph-slide ph-slide--${kind}${modifiers}" data-layout="${escapeHtml(layout.kind)}" data-slide-id="${escapeHtml(slide.id)}" aria-label="Slide ${slideNumber}">`,
    "  <div class=\"ph-slide__content\">",
    ...renderCoreLayout(layout.kind, layoutContent).map((line) => `    ${line}`),
    "  </div>",
    "</section>",
  ];

  // An explicit heading id gives consumers of the generated markup a stable
  // target while the slide id remains generated output, not canonical state.
  const markup = lines.join("\n");
  return markup.replace(
    /(<(?:h1|h2) class="ph-slot ph-slot--title")>/,
    `$1 id="${slideId}-title">`,
  );
}

/** Render a complete static presentation document with no runtime script. */
export function renderPresentationDocument({ deck, slides, css, themeId }) {
  const title = escapeHtml(deck.metadata.title);
  const slideMarkup = slides.join("\n\n").split("\n").map((line) => `    ${line}`).join("\n");
  return [
    "<!doctype html>",
    `<html lang="en">`,
    "  <head>",
    "    <meta charset=\"utf-8\">",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `    <title>${title}</title>`,
    "    <style data-presenthtml-renderer>",
    ...css.split("\n").map((line) => `      ${line}`),
    "    </style>",
    "  </head>",
    "  <body>",
    `    <main class="ph-presentation" data-theme="${escapeHtml(themeId)}">`,
    slideMarkup,
    "    </main>",
    "  </body>",
    "</html>",
  ].join("\n");
}
