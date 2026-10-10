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
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `actual runtime section: ${start}`);
  return source.slice(a, b);
}

function setup(language = 'en') {
  const nodes = new Map(), timers = [], renders = [], focusCalls = [];
  let saves = 0, renderHook = () => {};
  const document = {documentElement: {}};
  function element(tag = 'div', id) {
    const el = {tagName: tag.toUpperCase(), id, children: [], parentElement: null, attrs: {}, dataset: {}, value: '', open: false,
      append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
      get isConnected() { return document.body?.contains(this) || false; },
      setAttribute(key, value) {
        this.attrs[key] = String(value);
        if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
      },
      getAttribute(key) { return this.attrs[key] ?? null; },
      focus(options) { if (this.isConnected) { document.activeElement = this; focusCalls.push({target: this, options}); } },
      showModal() { this.open = true; this.children[0]?.focus(); },
      close() { this.open = false; if (this.contains(document.activeElement)) nodes.get('typesBtn').focus(); },
    };
    for (const property of ['textContent', 'innerHTML']) Object.defineProperty(el, property, {
      get() { return this[`_${property}`] || ''; },
      set(value) {
        // Browser removal of the focused descendant falls back to BODY.
        if (this.children.some(child => child.contains(document.activeElement))) document.activeElement = document.body;
        for (const child of this.children) child.parentElement = null;
        this.children = [];
        this[`_${property}`] = String(value);
      },
    });
    if (id) nodes.set(id, el);
    return el;
  }
  document.createElement = element;
  document.body = element('body');
  document.activeElement = document.body;
  const opener = element('button', 'typesBtn'), outside = element('button', 'outside');
  const dialog = element('dialog', 'typesDlg'), close = element('button', 'typesClose');
  const list = element('div', 'catList'), newCat = element('input', 'newCat');
  const help = element('dialog', 'helpDlg'), helpClose = element('button', 'helpClose');
  dialog.append(close, list, newCat); help.append(helpClose); document.body.append(opener, outside, dialog, help);
  const $ = selector => nodes.get(selector.slice(1));
  const c = vm.createContext({document, $, $$: () => [], navigator: {language}, localStorage: {getItem: () => language},
    APP_CONFIG: {slug: 'image-counter'}, Date, Math, structuredClone,
    P: {title: 'Synthetic focus regression', updatedAt: 123, settings: {markersVisible: true},
      categories: [{id: 'first', name: 'Type 1', color: '#d15c52', visible: true}, {id: 'second', name: 'Type 2', color: '#16624f', visible: true}],
      images: [{id: 'photo', name: 'synthetic.png', note: 'Keep note', completed: true, adjustments: {rotation: 90},
        markers: [{id: 'point', categoryId: 'first', shape: 'point', x: .2, y: .3}, {id: 'rect', categoryId: 'second', shape: 'rect', x: .4, y: .4, w: .1, h: .2}]}]},
    activeImageId: 'photo', activeCategoryId: 'second', selectedMarkerId: null, history: [], future: [{redo: 'old'}],
    setTimeout: fn => timers.push(fn), scheduleSave: () => saves++, renderStorageSoon() {},
    renderCanvas() { renders.push('canvas'); renderHook(); },
  });
  for (const name of ['renderModes', 'renderImages', 'renderCategories', 'renderStatus', 'renderSummary', 'renderAdjust', 'renderDisplay']) c[name] = () => renders.push(name);
  vm.runInContext([
    section('const I18N=', 'const Toast='),
    section('function activeImage()', 'function normalizeProject('),
    section('function cloneLight()', 'function dataUrlBytes('),
    section('function renderAll()', 'function setMarkersVisible('),
  ].join('\n'), c);
  const flush = () => { while (timers.length) timers.shift()(); };
  opener.focus(); c.openTypes(); flush(); focusCalls.length = 0;
  const row = index => list.children[index].children;
  const snapshot = () => JSON.parse(JSON.stringify(c.P));
  const commit = (input, value) => { input.value = value; input.onchange({target: input}); };
  // Model the focus destination chosen by Tab and the possible change-event
  // timing around blur. Actual browser key dispatch/scroll geometry is a separate gate.
  function tabCommit(index, backwards, order) {
    const controls = row(index), input = controls[1], destination = controls[backwards ? 0 : 2];
    input.focus(); input.value = `  Type ${index ? 'B' : 'A'}  `;
    if (order === 'during-blur') document.activeElement = document.body;
    if (order === 'after-focus') destination.focus();
    input.onchange({target: input});
    if (order !== 'after-focus') { document.activeElement = document.body; destination.focus(); }
    flush();
    return {input, destination};
  }
  return {c, document, dialog, list, newCat, close, outside, help, helpClose, row, snapshot, commit, tabCommit, flush,
    renders, focusCalls, timers, saves: () => saves, onRender: fn => { renderHook = fn; }};
}

for (const index of [0, 1]) for (const backwards of [false, true]) for (const order of ['before-blur', 'during-blur', 'after-focus']) {
  test(`name commit preserves ${backwards ? 'reverse' : 'forward'} Tab target, row ${index + 1}, ${order}`, () => {
    const f = setup(), controls = [...f.row(index)];
    const {input, destination} = f.tabCommit(index, backwards, order);
    assert.equal(f.document.activeElement, destination, 'the browser-selected Tab destination must remain focused');
    assert.equal(input.isConnected, true, 'the name field must remain in its row');
    assert.deepEqual(f.row(index), controls, 'committing text must not replace type controls');
    assert.equal(input.value, `Type ${index ? 'B' : 'A'}`);
    assert.equal(f.dialog.open, true);
  });
}

for (const language of ['en', 'ja']) test(`Hide/Show updates the same focused button and translated labels repeatedly: ${language}`, () => {
  const f = setup(language), eye = f.row(1)[2], controls = [...f.row(1)], shownIcon = eye.innerHTML;
  eye.focus(); f.focusCalls.length = 0;
  for (const visible of [false, true, false]) {
    eye.onclick({target: eye}); f.flush();
    assert.equal(f.document.activeElement, eye, 'visibility toggling must not detach the focused button');
    assert.deepEqual(f.row(1), controls);
    assert.equal(f.c.P.categories[1].visible, visible);
    const key = visible ? 'hide' : 'show', label = language === 'en' ? (visible ? 'Hide' : 'Show') : (visible ? '非表示' : '表示');
    assert.equal(eye.getAttribute('aria-label'), label); assert.equal(eye.title, label);
    assert.equal(eye.dataset.i18nAriaLabel, key); assert.equal(eye.dataset.i18nTitle, key);
    assert.equal(eye.innerHTML === shownIcon, visible);
  }
  assert.equal(f.focusCalls.length, 0, 'retaining the node requires no focus call or delayed repair');
});

test('name blur followed by clicking its existing Hide button preserves both operations', () => {
  const f = setup(), [color, name, eye] = f.row(1);
  name.focus(); f.document.activeElement = f.document.body; f.commit(name, '  Renamed  ');
  eye.focus(); if (eye.isConnected) eye.onclick({target: eye});
  assert.equal(f.c.P.categories[1].name, 'Renamed'); assert.equal(f.c.P.categories[1].visible, false);
  assert.equal(f.document.activeElement, eye); assert.equal(color.isConnected, true);
  assert.equal(f.c.history.length, 2); assert.equal(f.saves(), 2);
});

for (const value of ['  Renamed  ', '   ']) test(`name normalization and history preserve all unrelated project data: ${JSON.stringify(value)}`, () => {
  const f = setup(), before = f.snapshot(), name = f.row(0)[1]; name.focus(); f.commit(name, value);
  const expected = value.trim() || before.categories[0].name;
  assert.equal(name.value, expected); assert.equal(f.c.P.categories[0].name, expected);
  assert.equal(f.c.history.length, 1); assert.equal(f.c.history[0].categories[0].name, before.categories[0].name);
  assert.equal(f.c.future.length, 0); assert.equal(f.saves(), 1); assert.equal(f.c.totalMarkers(), 2);
  const after = f.snapshot(); after.updatedAt = before.updatedAt; after.categories[0].name = before.categories[0].name;
  assert.deepEqual(after, before); assert.equal(f.c.activeCategoryId, 'second');
  assert.equal(f.renders.filter(value => value === 'renderCategories').length, 1);
  f.c.undo(); assert.deepEqual(f.snapshot().categories, before.categories);
  f.c.redo(); assert.equal(f.c.P.categories[0].name, expected);
});

test('Hide changes only visibility and current type, with the same undo/redo and count semantics', () => {
  const f = setup(), before = f.snapshot(), eye = f.row(1)[2]; eye.focus(); eye.onclick({target: eye});
  assert.equal(f.c.activeCategoryId, 'first'); assert.equal(f.c.P.categories[1].visible, false);
  assert.equal(f.c.history.length, 1); assert.equal(f.c.history[0].categories[1].visible, true);
  assert.equal(f.c.future.length, 0); assert.equal(f.saves(), 1); assert.equal(f.c.totalMarkers(), 2);
  const after = f.snapshot(); after.updatedAt = before.updatedAt; after.categories[1].visible = true;
  assert.deepEqual(after, before);
  f.c.undo(); assert.deepEqual(f.snapshot().categories, before.categories);
  f.c.redo(); assert.equal(f.c.P.categories[1].visible, false);
});

for (const action of ['rename', 'toggle']) for (const owner of ['other-row', 'new-name', 'outside', 'new-modal', 'closed']) {
  test(`${action} leaves newer ${owner} focus ownership unchanged`, () => {
    const f = setup(), target = owner === 'other-row' ? f.row(0)[1] : owner === 'new-name' ? f.newCat : owner === 'new-modal' ? f.helpClose : f.outside;
    const control = f.row(1)[action === 'rename' ? 1 : 2]; control.focus();
    f.onRender(() => {
      if (owner === 'closed') f.dialog.close();
      if (owner === 'new-modal') f.help.showModal();
      target.focus();
    });
    if (action === 'rename') f.commit(control, 'Changed'); else control.onclick({target: control});
    f.focusCalls.length = 0; f.flush();
    assert.equal(f.document.activeElement, target); assert.equal(target.isConnected, true);
    assert.equal(f.dialog.open, owner !== 'closed'); assert.equal(f.help.open, owner === 'new-modal');
    assert.equal(f.focusCalls.length, 0, 'no delayed focus repair can take ownership back');
  });
}

test('Help includes bilingual type-name and visibility keyboard guidance', () => {
  const help = source.split('<!-- APP:HELP:BEGIN -->')[1].split('<!-- APP:HELP:END -->')[0];
  assert.match(help, /data-i18n="typeKeyboardNote"/);
  const translations = vm.runInNewContext(section('const I18N=', '\nlet lang=') + '\nI18N;');
  for (const language of ['en', 'ja']) {
    assert.equal(typeof translations[language].typeKeyboardNote, 'string');
    assert.match(translations[language].typeKeyboardNote, /Tab/);
  }
});
