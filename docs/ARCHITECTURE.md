# Architecture

## Overview

The repository separates editable source from the release artifact:

```text
app.config.json              Product metadata
APP_SPEC.md                  Product behavior and acceptance contract
dependencies.json            Exact npm packages and files to embed
components/                   Reusable source snippets copied/adapted into apps
src/index.template.html      Editable application source
build-standalone.ps1         Dependency fetch, hash, embed, and build
scripts/verify-standalone.ps1 Static release checks
image-counter.html           Tracked readable release alias for downstream consumers
dist/index.html              Generated readable release artifact
dist/index.self-extract.html Generated gzip self-extracting artifact
dist/build-size-report.json    Generated size and embedded-asset storage report
```

`image-counter.html`, `dist/index.html` and `dist/index.self-extract.html` are generated and must not be edited manually.

A default build copies the readable output byte-for-byte to the tracked root alias. Custom `-OutputPath` builds leave that alias unchanged. Commit the regenerated alias with source changes so downstream raw-file consumers receive the current runtime.

The repository check uses `-CheckReleaseAlias` to compare the existing root alias with a fresh build before any alias write, ignoring only the generated manifest timestamp. A stale alias makes CI fail instead of silently repairing the working tree. The same check verifies exact self-extract payload parity and runs camera lifecycle, counting/cancellation, ZIP export, language/restore-ownership, Help/header, type-dialog focus, and paired-dialog return tests against source, readable output, root alias, and unpacked self-extract output. Node.js 24 is installed by each CI build workflow.


## Reusable component layer

`components/` contains dependency-free source snippets for common UI patterns. These files are not loaded at runtime and are not a separate bundle layer. An app copies or adapts the needed CSS, HTML, and JavaScript into `src/index.template.html`, preserving the one-file runtime model.

The starter includes the canonical confirmation and toast APIs in the default source, while `components/` also carries the mobile bottom bar, compact popover, preset/custom setting field, and async source-state guard. Reversible operations should normally use Toast + Undo; irreversible/high-risk operations use `AppConfirm`. See `docs/COMPONENTS.md`.

## Build pipeline

1. Read `app.config.json` and `dependencies.json`.
2. Resolve each exact npm version through the npm registry.
3. Cache and extract each tarball.
4. Validate the package's own version.
5. Read only the explicitly listed asset files.
6. Calculate SHA-256 hashes for the package tarball and every original embedded asset.
7. Optionally gzip each declared asset (`gzip` / `auto`), then Base64-encode the stored bytes exactly once.
8. Embed the asset bundle JSON directly, avoiding a second Base64 wrapper around the whole bundle.
9. Replace the three source placeholders exactly once.
10. Write and verify `dist/index.html`.
11. Gzip that HTML, embed it into a small ASCII-only native `DecompressionStream` loader, inherit the readable HTML favicon, and write `dist/index.self-extract.html`.
12. Verify that the loader stays ASCII-only and embedded-only, the favicon matches the readable HTML, and the gzip payload restores byte-for-byte.
13. Write manifests, `build-size-report.json`, and `dist/.nojekyll`; emit warning-only size-budget messages when configured thresholds are exceeded.
14. Reject the declared unresolved build placeholders and common external runtime resource references.

## Build placeholders

The source template contains exactly one of each:

- `__APP_CONFIG_JSON__`
- `__BUILD_MANIFEST_JSON__`
- `__EMBEDDED_ASSET_BUNDLE_JSON__`

Do not rename or duplicate them without changing the builder and verifier. Other runtime identifiers that happen to use a `__NAME__` convention are allowed and must not be rejected as build placeholders.

## Embedded asset API

The generated page exposes `window.StandaloneAssets`:

```js
StandaloneAssets.list();
StandaloneAssets.has('library-id', 'asset-key');
StandaloneAssets.bytes('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.bytesAsync('library-id', 'asset-key'); // compressed or uncompressed
StandaloneAssets.text('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.textAsync('library-id', 'asset-key');
StandaloneAssets.blobUrl('library-id', 'asset-key'); // uncompressed only
await StandaloneAssets.blobUrlAsync('library-id', 'asset-key');
await StandaloneAssets.loadClassicScript('library-id', 'main', 'ExpectedGlobal');
const module = await StandaloneAssets.importModule('library-id', 'main');
```

Blob URLs are revoked after script/module loading and on page exit. Gzip assets are expanded with native `DecompressionStream` and cached in memory after first use.

### Important limitation

`importModule` does not rewrite relative imports inside a module. Choose a self-contained browser bundle, list every required file and implement a package-specific loader, or bundle the library before embedding.

## Runtime security boundary

The default Content Security Policy blocks all network connections with `connect-src 'none'`. It also blocks frames, objects, forms, and external base URLs. Inline CSS and JavaScript are allowed because the release is intentionally one HTML document. Embedded scripts and workers may be loaded through `blob:` URLs.

Static scanning is a guardrail, not a proof. Browser developer tools should still be used to verify that the generated app makes no unexpected request.

## Large applications

Keep source in one HTML while it remains understandable. When an app grows substantially, development files may be split under `src/` and assembled by the build script. Preserve these properties:

- Two generated one-file release variants.
- Pinned and auditable dependencies.
- No runtime external resource.
- Clear state ownership.
- A build that fails on missing input.

## Restore-offer ownership

The startup draft offer stores only summary metadata. `showWorkspace()` retires that offer and advances its generation after a project is accepted. Startup reads, restore reads/decodes, discard confirmations, and viewer imports check that ownership before committing. Viewer imports normalize and decode the initial image before replacing `P`; failed imports keep the previous project and restore offer. Language changes re-render the summary and declarative accessible attributes without rebuilding editable type inputs.

## Help and header interaction

The header reserves non-shrinking space for language/Help actions and the version badge, while the app title can truncate at narrow widths. Only modal Help locks document scrolling through `html:has(#helpDlg:modal)` and `body:has(#helpDlg:modal)`; closing it releases the lock without saved scroll state. The existing dialog shell and native focus/Escape behavior are unchanged. Shared backdrop handlers ignore descendant targets before checking the dialog rectangle, including zero-coordinate keyboard clicks from the Build info summary.

`node --test scripts/test-help-header.cjs` exercises the actual binding code and CSS contracts without a browser. The repository aggregate applies it to source, readable, root-alias, and unpacked self-extract variants. Native rendering, wheel scrolling, keyboard focus, and short/narrow content reachability still require browser verification.

## Type-dialog focus

Name commits normalize the same input; visibility changes refresh the same eye button's label and icon. Neither operation rebuilds `catList` or schedules a focus repair. `renderAll()` continues to refresh counts, overlays, and summaries outside the dialog. This preserves the browser's Tab destination and existing focus ownership. Adding and deleting types retain their existing rebuilding behavior.

`node --test scripts/test-type-dialog-focus.cjs` runs the production handlers, history, and render dispatcher with a small DOM/focus model. It covers both name rows, forward/reverse Tab candidates around blur/change, repeated bilingual Hide/Show, newer focus/modal ownership, and unchanged count/data/history semantics. Native event ordering and viewport/scroll reachability still require browser verification.

## Paired dialog return focus

Only Types and Export use `showPairedDialog` around native `showModal()`. The close handler records the actual desktop/mobile launcher and checks the current viewport at close time. If that launcher is non-rendered or wholly offscreen, its visible, enabled peer may receive normal focus, allowing the browser to reveal it. The fallback runs only if focus is still on that launcher, BODY, or a descendant of the now-closed dialog. It skips reopened dialogs, another modal, meaningful unrelated focus, non-paired Types launchers, and visible original launchers. There is no focus trap, resize handler, delayed focus callback, or change to Display/history/export data behavior.

`node --test scripts/test-dialog-return-focus.cjs` exercises the production Types/Export opening and shared dismissal bindings with modeled native close restoration. It covers both breakpoint directions, closed-dialog/BODY ownership, ordinary returns, unavailable peers, newer focus/modals, reopen ordering, and unchanged export setup. Both focus suites join the source/readable/root-alias/self-extract check matrix; actual browser event/viewport behavior remains a separate gate.
