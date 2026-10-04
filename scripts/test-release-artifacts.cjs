const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Only the build timestamp is volatile. Runtime, config and assets must match.
function normalizeBuildTimestamp(html) {
  const match = html.match(/,BUILD_MANIFEST=(\{[^\n]+?\}),ASSETS=/);
  assert.ok(match, 'generated build manifest must exist');
  const manifest = JSON.parse(match[1]);
  assert.equal(typeof manifest.generatedAtUtc, 'string');
  assert.ok(!Number.isNaN(Date.parse(manifest.generatedAtUtc)), 'build timestamp must be valid');
  const normalized = match[1].replace(/"generatedAtUtc":"[^"]+"/, '"generatedAtUtc":"<build-time>"');
  return html.replace(match[1], normalized);
}

test('checked-in root release matches the fresh readable build', () => {
  assert.ok(normalizeBuildTimestamp(read('image-counter.html')) === normalizeBuildTimestamp(read('dist/index.html')),
    'image-counter.html is stale; run ./build-standalone.ps1 and commit the regenerated alias');
});

test('self-extract payload restores the exact fresh readable bytes', () => {
  const match = read('dist/index.self-extract.html').match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
  assert.ok(match, 'self-extract payload must exist');
  assert.deepEqual(zlib.gunzipSync(Buffer.from(match[1], 'base64')), fs.readFileSync(path.join(root, 'dist/index.html')));
});

test('timestamp normalization cannot hide stale runtime, config or assets', () => {
  const html = read('dist/index.html');
  const baseline = normalizeBuildTimestamp(html);
  const timestampOnly = html.replace(/"generatedAtUtc":"[^"]+"/, '"generatedAtUtc":"2000-01-01T00:00:00Z"');
  assert.equal(normalizeBuildTimestamp(timestampOnly), baseline);
  for (const [before, after] of [['cameraGeneration', 'staleCameraGeneration'], ['"slug":"image-counter"', '"slug":"stale-counter"'], ['ASSETS={', 'ASSETS={"stale":true,']]) {
    assert.ok(html.includes(before), `negative fixture marker must exist: ${before}`);
    assert.notEqual(normalizeBuildTimestamp(html.replace(before, after)), baseline);
  }
});
