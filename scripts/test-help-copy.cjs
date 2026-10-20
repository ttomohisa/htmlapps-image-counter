'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const argument = process.argv.indexOf('--html');
const file = argument >= 0 ? process.argv[argument + 1] : path.join(__dirname, '../src/index.template.html');
let html = fs.readFileSync(file, 'utf8');
const payload = html.match(/<script id="self-extract-payload"[^>]*>([A-Za-z0-9+/=\s]+)<\/script>/);
if (payload) html = gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
const excluded = [
  "右上のEN / JAで言語を切り替えられます。閉じるボタン・Esc・枠の外側のクリックで閉じます。",
  "Use EN / JA at the top right to switch languages. Close with the close button, Esc, or a click outside the dialog.",
  "狭い画面でも右上のEN / JAで言語を切り替えられます。ヘルプ表示中は背景のスクロールが止まり、ビルド情報はキーボードでも開閉できます。",
  "Use EN / JA at the top right even on narrow screens. Help keeps the background still, and Build info works with the keyboard.",
  "表示・非表示を切り替えた後も同じ目ボタンから操作を続けられます。画面幅を変えて「種類」「書き出し」を閉じた場合は、表示中の同じ操作ボタンへ戻ります。",
  " After Hide / Show, continue from the same eye button. After resizing and closing Types or Export, focus can return to its visible launcher."
];
for (const text of excluded) {
  assert.equal(html.includes(text), false, `User-facing help must exclude obsolete audit/implementation copy: ${text}`);
}
console.log('User-facing help copy regression passed.');
