# Adding Embedded Dependencies

## Configuration

Add a package to `dependencies.json`:

```json
{
  "dependencies": [
    {
      "id": "dayjs",
      "package": "dayjs",
      "version": "1.11.13",
      "license": "MIT",
      "homepage": "https://day.js.org/",
      "assets": [
        {
          "key": "main",
          "path": "dayjs.min.js",
          "mime": "text/javascript",
          "stripSourceMapComment": true,
          "compression": "auto"
        }
      ]
    }
  ]
}
```

A complete example is available at `examples/dependencies.dayjs.json`.


## Asset compression and bundle size

Each asset may set `compression` to:

- `none` (default): store the original bytes as one Base64 payload.
- `gzip`: always gzip before Base64 embedding.
- `auto`: gzip only when the compressed bytes are smaller.

The asset JSON bundle itself is embedded directly in the HTML; it is **not** Base64-encoded a second time. This avoids the old double-Base64 size penalty.

Compressed assets require asynchronous expansion in the browser via native `DecompressionStream`:

```js
const wasmBytes = await StandaloneAssets.bytesAsync('library-id', 'wasm');
const workerUrl = await StandaloneAssets.blobUrlAsync('library-id', 'worker');
```

`bytes()`, `text()`, and `blobUrl()` remain available for uncompressed assets. `loadClassicScript()` and `importModule()` automatically use the async path and therefore work with compressed assets.

The build writes `dist/build-size-report.json` with readable HTML size, self-extract size, and original/stored bytes for every embedded asset. `app.config.json` can define warning-only budgets under `build.sizeBudget`. A warning should prompt review, not automatically justify removing useful UX.

## Runtime loading

For a classic browser bundle:

```js
await StandaloneAssets.loadClassicScript('dayjs', 'main', 'dayjs');
console.log(window.dayjs().format('YYYY-MM-DD'));
```

For a self-contained ES module:

```js
const library = await StandaloneAssets.importModule('library-id', 'main');
```

For a worker or WASM asset:

```js
const workerUrl = await StandaloneAssets.blobUrlAsync('library-id', 'worker');
const worker = new Worker(workerUrl, { type: 'module' });

const wasmBytes = await StandaloneAssets.bytesAsync('library-id', 'wasm');
const wasm = await WebAssembly.instantiate(wasmBytes, imports);
```

Revoke long-lived asset URLs after the consumer is finished:

```js
URL.revokeObjectURL(workerUrl);
```

## Checklist

- Pin an exact package version.
- List every runtime support file.
- Confirm the chosen bundle has no unresolved relative import.
- Update `THIRD_PARTY_NOTICES.md` with the required copyright and license text.
- Rebuild with `-ForceDownload` after changing versions.
- Inspect `dependency-manifest.json` and `build-size-report.json`, including whether `auto` compression actually reduced stored bytes.
- Test with the network disabled.
