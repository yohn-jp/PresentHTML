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
