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

function setup(kind = 'export') {
  const nodes = new Map(), timers = [], closes = [], focusCalls = [];
  const document = {documentElement: {clientWidth: 1000, clientHeight: 800}};
  let c;
  function element(id, tagName = 'BUTTON') {
    const el = {id, tagName, isConnected: true, disabled: false, hidden: false, open: false, modal: false, value: '', checked: false,
      style: {display: 'block', visibility: 'visible'}, rect: {left: 10, right: 110, top: 10, bottom: 46, width: 100, height: 36}, listeners: {},
      focus(options) { document.activeElement = this; focusCalls.push({id: this.id, options}); },
      getBoundingClientRect() { return this.rect; },
      getClientRects() { return this.hidden || this.style.display === 'none' || !this.isConnected ? [] : [this.rect]; },
      contains(target) { return this === target || target?.parentDialog === this; },
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      emit(type, event = {}) { this[`on${type}`]?.({target: this, ...event}); for (const fn of this.listeners[type] || []) fn({target: this, ...event}); },
      showModal() { this.nativeOwner = document.activeElement; this.open = this.modal = true; nodes.get(this.id === 'typesDlg' ? 'newCat' : this.id === 'exportDlg' ? 'exportName' : 'helpClose').focus(); },
      close() { if (!this.open) return; this.open = this.modal = false; this.nativeOwner?.focus(); closes.push(() => this.emit('close')); },
      closest() { return nodes.get(this.id.replace('Close', 'Dlg')); },
    };
    nodes.set(id, el); return el;
  }
  document.body = element('body', 'BODY'); document.activeElement = document.body;
  for (const id of ['typesBtn', 'mobTypes', 'exportBtn', 'mobExport', 'canvasManageCats', 'manageCatsInline', 'outside', 'helpBtn', 'langBtn', 'catList', 'newCat', 'exportName', 'viewerCompress', 'viewerQuality', 'viewerQualityOut', 'zipIncludeImages']) element(id);
  for (const prefix of ['types', 'export', 'help']) { element(prefix + 'Dlg', 'DIALOG'); element(prefix + 'Close'); }
  for (const [control, dialog] of [['newCat', 'typesDlg'], ['exportName', 'exportDlg'], ['helpClose', 'helpDlg']]) nodes.get(control).parentDialog = nodes.get(dialog);
  const $ = selector => nodes.get(selector.slice(1));
  const dialogs = () => [...nodes.values()].filter(el => el.tagName === 'DIALOG');
  document.querySelector = selector => {
    assert.equal(selector, 'dialog:modal'); return dialogs().find(el => el.modal) || null;
  };
  const context = {document, $, $$: selector => {
    if (selector === '.dlg-close') return ['typesClose', 'exportClose', 'helpClose'].map(id => nodes.get(id));
    if (selector === 'dialog:not(#confirmDlg):not(#cameraDlg)') return dialogs();
    return [];
  }, innerWidth: 1000, innerHeight: 800, getComputedStyle: el => el.style,
    setTimeout: fn => timers.push(fn), localStorage: {setItem() {}}, lang: 'en', applyLang() {},
    APP_CONFIG: {slug: 'image-counter'}, P: {title: 'Synthetic result', categories: [], images: [{id: 'photo', name: 'synthetic.png'}], settings: {viewerCompression: {enabled: true, quality: .82}}},
    sanitizePart: name => name.replace(/\.[^.]*$/, ''),
  };
  c = vm.createContext(context);
  vm.runInContext([
    section('function openTypes(', 'function setMarkersVisible('),
    section("$('#typesBtn').onclick=", "$('#canvasDockToggle').onclick="),
    section("$('#exportBtn').onclick=", "$('#completeBtn').addEventListener"),
    section("$('#helpBtn').onclick=", "$('#restoreDraft').onclick="),
  ].join('\n'), c);
  const desktop = nodes.get(kind === 'types' ? 'typesBtn' : 'exportBtn'), mobile = nodes.get(kind === 'types' ? 'mobTypes' : 'mobExport');
  const dialog = nodes.get(kind + 'Dlg');
  mobile.style.display = 'none';
  function open(trigger = desktop) { trigger.focus(); trigger.onclick({currentTarget: trigger, target: trigger}); while (timers.length) timers.shift()(); focusCalls.length = 0; }
  function small() {
    c.innerWidth = document.documentElement.clientWidth = 323; c.innerHeight = document.documentElement.clientHeight = 257;
    desktop.rect = {left: 10, right: 310, top: 625.5, bottom: 661.5, width: 300, height: 36};
    mobile.style.display = 'block'; mobile.rect = {left: 250, right: 312, top: 209, bottom: 250, width: 62, height: 41};
  }
  const flushClose = () => { while (closes.length) closes.shift()(); };
  const close = () => { dialog.close(); focusCalls.length = 0; flushClose(); };
  return {c, document, nodes, desktop, mobile, dialog, focusCalls, open, small, close, flushClose};
}

for (const kind of ['types', 'export']) {
  test(`${kind}: desktop opener moved wholly below viewport returns to visible mobile counterpart`, () => {
    const f = setup(kind); f.open(); f.small(); f.close();
    assert.equal(f.document.activeElement, f.mobile);
    assert.deepEqual(f.focusCalls, [{id: f.mobile.id, options: undefined}], 'normal focus may reveal the fallback');
  });
  test(`${kind}: hidden mobile opener returns to visible desktop counterpart`, () => {
    const f = setup(kind); f.small(); f.open(f.mobile);
    f.c.innerWidth = 1000; f.c.innerHeight = 800; f.mobile.style.display = 'none';
    f.desktop.rect = {left: 600, right: 710, top: 50, bottom: 86, width: 110, height: 36}; f.close();
    assert.equal(f.document.activeElement, f.desktop);
  });
  test(`${kind}: reverse breakpoint repairs focus stranded inside its now-closed dialog`, () => {
    const f = setup(kind); f.small(); f.open(f.mobile);
    f.c.innerWidth = 1179; f.c.innerHeight = 756; f.mobile.style.display = 'none';
    f.desktop.rect = {left: 600, right: 710, top: 50, bottom: 86, width: 110, height: 36};
    f.dialog.close(); f.document.activeElement = f.nodes.get(kind === 'types' ? 'newCat' : 'exportName');
    f.focusCalls.length = 0; f.flushClose();
    assert.equal(f.dialog.open, false); assert.equal(f.document.activeElement, f.desktop);
    assert.deepEqual(f.focusCalls, [{id: f.desktop.id, options: undefined}]);
  });
  for (const owner of ['desktop', 'mobile']) test(`${kind}: ordinary ${owner} return remains native`, () => {
    const f = setup(kind); if (owner === 'mobile') f.small(); const opener = f[owner]; f.open(opener); f.close();
    assert.equal(f.document.activeElement, opener); assert.equal(f.focusCalls.length, 0);
  });
  test(`${kind}: native BODY return after hiding the mobile opener selects the visible desktop peer`, () => {
    const f = setup(kind); f.small(); f.open(f.mobile);
    f.c.innerWidth = 1175; f.c.innerHeight = 745; f.mobile.style.display = 'none';
    f.desktop.rect = {left: 600, right: 710, top: 50, bottom: 86, width: 110, height: 36};
    f.dialog.close(); f.document.activeElement = f.document.body; f.focusCalls.length = 0; f.flushClose();
    assert.equal(f.document.activeElement, f.desktop);
  });
  test(`${kind}: native BODY/browser Tab stops after the close event are not repaired`, () => {
    const f = setup(kind); f.open(); f.small(); f.close(); f.document.activeElement = f.document.body;
    f.focusCalls.length = 0; f.flushClose();
    assert.equal(f.document.activeElement, f.document.body); assert.equal(f.focusCalls.length, 0);
  });
  test(`${kind}: a visible captured opener never triggers BODY recovery`, () => {
    const f = setup(kind); f.open(); f.dialog.close(); f.document.activeElement = f.document.body;
    f.focusCalls.length = 0; f.flushClose();
    assert.equal(f.document.activeElement, f.document.body); assert.equal(f.focusCalls.length, 0);
  });
  for (const target of ['outside', 'helpClose']) test(`${kind}: newer ${target} focus wins over offscreen return fallback`, () => {
    const f = setup(kind); f.open(); f.small(); f.dialog.close();
    if (target === 'helpClose') f.nodes.get('helpDlg').showModal(); else f.nodes.get(target).focus();
    f.focusCalls.length = 0; f.flushClose();
    assert.equal(f.document.activeElement, f.nodes.get(target)); assert.equal(f.focusCalls.length, 0);
  });
  test(`${kind}: another modal prevents fallback even when old opener is still active`, () => {
    const f = setup(kind); f.open(); f.small(); f.dialog.close();
    f.nodes.get('helpDlg').showModal(); f.document.activeElement = f.desktop; f.focusCalls.length = 0; f.flushClose();
    assert.equal(f.document.activeElement, f.desktop); assert.equal(f.focusCalls.length, 0);
  });
  test(`${kind}: delayed close event cannot take focus from a reopened dialog`, () => {
    const f = setup(kind); f.open(); f.small(); f.dialog.close(); f.open(f.mobile); const active = f.document.activeElement;
    f.flushClose(); assert.equal(f.dialog.open, true); assert.equal(f.document.activeElement, active); assert.equal(f.focusCalls.length, 0);
  });
  for (const unavailable of ['offscreen', 'disabled', 'hidden', 'detached', 'invisible']) test(`${kind}: ${unavailable} counterpart is never focused`, () => {
    const f = setup(kind); f.open(); f.small();
    if (unavailable === 'offscreen') f.mobile.rect = {...f.mobile.rect, top: 300, bottom: 341};
    if (unavailable === 'disabled') f.mobile.disabled = true;
    if (unavailable === 'hidden') f.mobile.hidden = true;
    if (unavailable === 'detached') f.mobile.isConnected = false;
    if (unavailable === 'invisible') f.mobile.style.visibility = 'hidden';
    f.close(); assert.equal(f.document.activeElement, f.desktop); assert.equal(f.focusCalls.length, 0);
  });
  for (const route of ['button', 'backdrop']) test(`${kind}: ${route} close shares the guarded return behavior`, () => {
    const f = setup(kind); f.open(); f.small();
    if (route === 'button') f.nodes.get(kind + 'Close').onclick();
    else f.dialog.emit('click', {clientX: -1, clientY: -1});
    f.flushClose(); assert.equal(f.dialog.open, false); assert.equal(f.document.activeElement, f.mobile);
  });
  test(`${kind}: child activation and inside-dialog clicks do not close or restore focus`, () => {
    const f = setup(kind); f.open(); f.small(); const active = f.document.activeElement;
    f.dialog.emit('click', {target: active, clientX: 0, clientY: 0});
    f.dialog.emit('click', {clientX: 30, clientY: 30}); f.flushClose();
    assert.equal(f.dialog.open, true); assert.equal(f.document.activeElement, active); assert.equal(f.focusCalls.length, 0);
  });
}

test('Types canvas/inline openers keep their existing native ownership', () => {
  for (const id of ['canvasManageCats', 'manageCatsInline']) {
    const f = setup('types'), trigger = f.nodes.get(id); f.open(trigger); f.small(); trigger.rect = {...f.desktop.rect}; f.close();
    assert.equal(f.document.activeElement, trigger); assert.equal(f.focusCalls.length, 0);
  }
});

test('Export opening/closing preserves project data, filename defaults, and session image choice', () => {
  const f = setup('export'), before = JSON.stringify(f.c.P); f.nodes.get('zipIncludeImages').checked = false;
  f.open(); assert.equal(f.nodes.get('exportName').value, 'Synthetic result');
  assert.equal(f.nodes.get('viewerCompress').checked, true); assert.equal(f.nodes.get('viewerQuality').value, 82); assert.equal(f.nodes.get('viewerQualityOut').textContent, '82%');
  f.nodes.get('exportName').value = 'My edited output'; f.small(); f.close();
  assert.equal(f.nodes.get('exportName').value, 'My edited output'); assert.equal(f.nodes.get('zipIncludeImages').checked, false);
  assert.equal(JSON.stringify(f.c.P), before);
});
