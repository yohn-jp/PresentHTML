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
network connection.
