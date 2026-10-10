const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let source = fs.readFileSync(process.env.IMAGE_COUNTER_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
if (source.includes('id="self-extract-payload"')) {
  const payload = source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
  assert.ok(payload, 'self-extract payload must exist');
  source = require('node:zlib').gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
}
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = css.match(new RegExp(`(?:^|[{}])\\s*${escaped}\\s*\\{([^{}]*)\\}`));
  assert.ok(rule, `CSS contract: ${selector}`);
  return rule[1];
}

function setup() {
  const dialogs = new Map([...source.matchAll(/<dialog\b[^>]*\bid="([^"]+)"/g)].map(([, id]) => [id, {
    id, open: true, closes: 0, measurements: 0, listeners: {},
    showModal() { this.open = true; },
    close() { this.open = false; this.closes++; },
    getBoundingClientRect() { this.measurements++; return {left: 20, right: 300, top: 30, bottom: 240}; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  }]));
  const buttons = {'#helpBtn': {}, '#langBtn': {}};
  const closeButtons = [...dialogs.values()].map(dialog => ({
    id: dialog.id === 'cameraDlg' ? 'cameraClose' : '',
    closest(selector) { assert.equal(selector, 'dialog'); return dialog; },
  }));
  const writes = [];
  const context = vm.createContext({
    $: selector => buttons[selector] || dialogs.get(selector.slice(1)),
    $$: selector => {
      if (selector === '.dlg-close') return closeButtons;
      assert.equal(selector, 'dialog:not(#confirmDlg):not(#cameraDlg)');
      return [...dialogs.values()].filter(d => !['confirmDlg', 'cameraDlg'].includes(d.id));
    },
    lang: 'ja', APP_CONFIG: {slug: 'image-counter'},
    localStorage: {setItem: (...args) => writes.push(args)}, applyLang() {},
  });
  const start = source.indexOf("$('#helpBtn').onclick=");
  const end = source.indexOf("$('#restoreDraft').onclick=", start);
  assert.ok(start >= 0 && end > start, 'actual Help/language/dialog bindings must exist');
  vm.runInContext(source.slice(start, end), context);
  return {dialogs, buttons, closeButtons, writes, context};
}

test('child keyboard click at 0,0 never reaches backdrop geometry or closes Help', () => {
  const {dialogs} = setup(), dialog = dialogs.get('helpDlg');
  // Native keyboard activation of Build info bubbles a click with zero coordinates.
  dialog.listeners.click({target: {tagName: 'SUMMARY'}, clientX: 0, clientY: 0, detail: 0});
  assert.equal(dialog.open, true);
  assert.equal(dialog.closes, 0);
  assert.equal(dialog.measurements, 0, 'ignore child activation before checking bounds');
});

test('every shared dialog ignores descendant clicks outside its rectangle', () => {
  for (const dialog of setup().dialogs.values()) {
    if (!dialog.listeners.click) continue;
    dialog.listeners.click({target: {tagName: 'BUTTON'}, clientX: 0, clientY: 0, detail: 1});
    assert.equal(dialog.closes, 0, dialog.id);
    assert.equal(dialog.measurements, 0, dialog.id);
  }
});

for (const [name, x, y] of [['left', 19, 100], ['right', 301, 100], ['above', 100, 29], ['below', 100, 241]]) {
  test(`actual ${name} backdrop click closes each shared dialog`, () => {
    for (const dialog of setup().dialogs.values()) {
      if (!dialog.listeners.click) continue;
      dialog.listeners.click({target: dialog, clientX: x, clientY: y, detail: 1});
      assert.equal(dialog.closes, 1, dialog.id);
    }
  });
}

test('inside and border clicks on a dialog do not dismiss it', () => {
  for (const dialog of setup().dialogs.values()) {
    if (!dialog.listeners.click) continue;
    for (const [clientX, clientY] of [[100, 100], [20, 30], [300, 240]]) {
      dialog.listeners.click({target: dialog, clientX, clientY, detail: 1});
    }
    assert.equal(dialog.closes, 0, dialog.id);
  }
});

test('camera and confirmation retain their separate dismissal handling', () => {
  const {dialogs, closeButtons} = setup();
  assert.equal(dialogs.get('cameraDlg').listeners.click, undefined);
  assert.equal(dialogs.get('confirmDlg').listeners.click, undefined);
  assert.equal(closeButtons.find(button => button.id === 'cameraClose').onclick, undefined);
});

test('Help opens, closes with its button, and reopens through the actual bindings', () => {
  const {dialogs, buttons, closeButtons} = setup(), dialog = dialogs.get('helpDlg');
  const close = closeButtons.find(button => button.closest('dialog') === dialog);
  close.onclick(); assert.equal(dialog.open, false);
  buttons['#helpBtn'].onclick(); assert.equal(dialog.open, true);
  close.onclick(); assert.equal(dialog.open, false);
  buttons['#helpBtn'].onclick(); assert.equal(dialog.open, true);
});

test('language binding still switches and saves both directions', () => {
  const {buttons, writes, context} = setup();
  buttons['#langBtn'].onclick(); assert.equal(context.lang, 'en');
  buttons['#langBtn'].onclick(); assert.equal(context.lang, 'ja');
  assert.deepEqual(writes, [['image-counter:lang', 'en'], ['image-counter:lang', 'ja']]);
});

test('background overflow lock is scoped to modal Help on both document roots', () => {
  const locks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => selector.includes(':has('));
  assert.equal(locks.length, 1, 'one narrowly scoped modal Help lock');
  assert.deepEqual(locks[0][1].trim().split(',').map(s => s.trim()), ['html:has(#helpDlg:modal)', 'body:has(#helpDlg:modal)']);
  assert.match(locks[0][2], /(?:^|;)overflow:hidden(?:;|$)/);
});

test('header language control stays available at narrow widths', () => {
  assert.match(source, /<button id="langBtn" class="lang" type="button">/);
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/(?:\.lang\b|#langBtn\b|\.head-actions\b)/.test(selector)) {
      assert.doesNotMatch(body, /(?:display:none|visibility:hidden|opacity:0)(?:;|$)/, selector);
    }
  }
});

test('brand title can shrink while version and header controls keep their allocation', () => {
  assert.match(declarations('.brand'), /(?:^|;)flex:1(?:;|$)/);
  assert.match(declarations('.brand-mark'), /(?:^|;)flex:none(?:;|$)/);
  assert.match(declarations('.brand-copy'), /(?:^|;)min-width:0(?:;|$)/);
  assert.match(declarations('.brand-name'), /(?:^|;)display:flex(?:;|$)/);
  assert.match(declarations('.brand-name [data-i18n="appName"]'), /(?:^|;)min-width:0(?:;|$)/);
  assert.match(declarations('.brand-name [data-i18n="appName"]'), /(?:^|;)text-overflow:ellipsis(?:;|$)/);
  assert.match(declarations('.version'), /(?:^|;)flex:none(?:;|$)/);
  assert.match(declarations('.head-actions'), /(?:^|;)flex:none(?:;|$)/);
});

test('Help includes bilingual header and dismissal guidance within its editable markers', () => {
  const help = source.split('<!-- APP:HELP:BEGIN -->')[1].split('<!-- APP:HELP:END -->')[0];
  assert.match(help, /data-i18n="helpNavigationNote"/);
  const translations = vm.runInNewContext(source.slice(source.indexOf('const I18N='), source.indexOf('\nlet lang=')) + '\nI18N;');
  for (const language of ['ja', 'en']) {
    assert.equal(typeof translations[language].helpNavigationNote, 'string');
    assert.match(translations[language].helpNavigationNote, /EN.*JA/);
    assert.match(translations[language].helpNavigationNote, /Esc/);
  }
});
