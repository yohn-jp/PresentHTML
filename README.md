# PresentHTML
Turn ideas into presentations. Ship them as HTML.

## Development

The authoring app is kept as separate browser-native HTML, CSS, and JavaScript
source files under `src/`. Packaging is a delivery step and does not change the
source boundaries.

```sh
node tools/package.mjs
node tools/verify.mjs
```

The package command writes the standalone authoring app to
`dist/index.html`. It contains the source stylesheet and browser script inline,
so it can be opened directly with `file://` and does not require a server or a
network connection. When the source app uses browser ESM imports, packaging
bundles the reachable relative modules into the one classic inline script; the
development modules remain separate.

To verify another worktree's source without changing that worktree, provide
its repository root and an output path outside the repository:

```sh
node tools/verify.mjs \
  --source /path/to/PresentHTML-22 \
  --output /tmp/presenthtml-22.html
```

## MVP workflow

Open `dist/index.html` directly from the filesystem. The workflow controls
connect the browser-native adapters in this order:

`intent -> PresentationBrief -> prompt -> Deck JSON/manual authoring -> semantic editor -> renderer preview -> project JSON -> standalone HTML export`

The initial demo deck contains one slide for each of the eight MVP layouts.
`examples/demo-project.json` is the same semantic project envelope used by the
Save/Reopen controls, and `examples/demo-presentation.html` is a JavaScript-free
exported presentation.

## Source responsibilities

- `src/core/` owns the versioned PresentationBrief and Deck contracts and validation.
- `src/planner/` turns intent into a semantic PresentationBrief.
- `src/prompt/` generates a provider-neutral Deck prompt and validates imported Deck JSON.
- `src/layouts/` exposes replaceable renderer-neutral layout contracts and registries.
- `src/themes/` exposes replaceable semantic design-token themes.
- `src/renderer/` resolves Deck + Layout + Theme into static presentation HTML/CSS.
- `src/editor/` edits canonical semantic state and derives live preview from the renderer.
- `src/project/` serializes and validates semantic project JSON.
- `src/export/` packages renderer output into one JavaScript-free HTML document.
- `src/app.js` and `src/editor/mvp-controls.js` compose those adapters into the MVP UI.

The DOM and generated HTML are transient views. Project JSON contains only the
semantic Brief and Deck, and both preview and export call the same public
renderer boundary.
