const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let source = fs.readFileSync(process.env.IMAGE_COUNTER_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
if (source.includes('id="self-extract-payload"')) source = require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1], 'base64')).toString('utf8');
function section(start, end) {
  assert.ok(source.includes(start) && source.includes(end), `Runtime section: ${start}`);
  return source.slice(source.indexOf(start), source.indexOf(end));
}
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
function project(title='Previous') {
  return {title,updatedAt:Date.UTC(2026,9,6,4,59),categories:[{id:'one',name:'Keep my name',color:'#d15c52',visible:true}],images:[{id:'image',name:'synthetic.png',dataUrl:'data:image/png;base64,AA==',width:800,height:600,markers:[{id:'marker',categoryId:'one',x:.2,y:.3,needsReview:true}],note:'Keep my note',completed:false}]};
}
function setup() {
  const nodes=[], messages=[], writes=[];
  function element(tag='div',attrs={}) {
    const el={tagName:tag.toUpperCase(),attrs:{...attrs},dataset:{},children:[],style:{},hidden:'hidden' in attrs,open:false,value:'',checked:false,
      setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v)},
      getAttribute(k){return this.attrs[k]??null},append(...children){this.children.push(...children)},getContext(){return new Proxy({}, {get:()=>()=>{}})},toDataURL(){return 'data:image/jpeg;base64,AA=='},focus(){},showModal(){this.open=true}};
    for(const name of ['title','className'])Object.defineProperty(el,name,{get(){return this.attrs[name==='className'?'class':name]||''},set(v){this.attrs[name==='className'?'class':name]=v}});
    Object.defineProperty(el,'textContent',{get(){return this.text||''},set(v){this.text=String(v);this.children=[]}});
    el.classList={toggle(){},add(){},remove(){}};
    for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
    nodes.push(el);return el;
  }
  // Only the browser primitives are represented here; application labels and state transitions run unchanged.
  for(const match of source.slice(0,source.indexOf('<script>')).matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs={};for(const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';
    element(match[1],attrs);
  }
  const $$=selector=>nodes.filter(el=>selector.startsWith('#')?el.attrs.id===selector.slice(1):selector.startsWith('.')?(el.attrs.class||'').split(' ').includes(selector.slice(1)):selector.startsWith('[')?selector.slice(1,-1) in el.attrs:false);
  const $=selector=>{const e=$$(selector)[0];assert.ok(e,selector);return e};
  let dbRead=async()=>structuredClone(project()),decode=async()=>({naturalWidth:800,naturalHeight:600}),confirm=async()=>false,record=async f=>({...project('New').images[0],name:f.name});
  const context={$, $$,console:{error(){}},document:{documentElement:{},createElement:element},navigator:{language:'ja'},localStorage:{getItem(){return 'ja'}},APP_CONFIG:{slug:'image-counter',version:'1.0.0'},BUILD_MANIFEST:{},COLORS:['#d15c52','#16624f'],MAX_IMAGES:30,MAX_PROJECT_BYTES:220*1024*1024,Date,Intl,Blob,Map,Math,structuredClone,
    id:()=>`id-${nodes.length}`,renderAll(){},renderStorage(){},resizeCanvas(){},fitView(){},updateHistoryButtons(){},requestAnimationFrame(){},setTimeout(){},touch(){writes.push('save')},projectBytes:()=>0,dataUrlBytes:()=>1,loadImage:(...args)=>decode(...args),fileToRecord:(...args)=>record(...args),dbGet:()=>dbRead(),dbDel:async()=>writes.push('delete'),Toast:{show:msg=>messages.push(msg)},Confirm:{ask:(...args)=>confirm(...args)},
    DOMParser:class{parseFromString(text){return{querySelector(){const m=text.match(/<script id="imageCounterProject"[^>]*>([\s\S]*)<\/script>/);return m?{textContent:m[1]}:null}}}}};
  const c=vm.createContext(context);
  vm.runInContext([
    section('const I18N=', 'const Toast='),section('function defaultSettings()', 'function cloneLight()'),
    section('async function saveDraft(', 'function formatCapturedAt('),section('async function addFiles(', 'function displayDims('),
    section('function syncCatDock()', 'function renderCategoryButtons('),section('function openTypes()', 'function setMarkersVisible('),
    section('async function importViewerFile(', 'async function startCamera('),section('async function sampleProject()', "$('#chooseStart').onclick="),
    section("$('#restoreDraft').onclick=", "document.addEventListener('dragover'"),section('async function init()', '\ninit();'),
  ].join('\n'),c);
  return {c,$,$$,messages,writes,read:expr=>vm.runInContext(expr,c),lang:value=>{vm.runInContext(`lang=${JSON.stringify(value)};applyLang()`,c)},seed:value=>{c.seed=structuredClone(value);vm.runInContext('P=normalizeProject(seed);activeImageId=P.images[0].id;activeCategoryId=P.categories[0].id',c)},db:fn=>dbRead=fn,decode:fn=>decode=fn,confirm:fn=>confirm=fn,record:fn=>record=fn,import:async value=>c.importViewerFile({text:async()=>`<script id="imageCounterProject" type="application/json">${JSON.stringify(value)}</script>`})};
}

test('language changes localize every static accessible label and tooltip in both directions',()=>{
  const f=setup();
  const labels={'#helpBtn':['ヘルプ','Help'],'#fitBtn':['全体表示','Fit'],'#displayBtn':['表示設定','Display settings'],'#prevImage':['前の画像','Previous image'],'#nextImage':['次の画像','Next image'],'#cameraAddBtn':['カメラで画像を追加','Add image with camera'],'.mode-group':['カウントモード','Counting mode'],'#markerCat':['マーカーの種類','Marker type'],'#deleteMarker':['マーカーを削除','Delete marker'],'#memoClose':['閉じる','Close']};
  for(const [language,index] of [['en',1],['ja',0],['en',1]]){
    f.lang(language);
    for(const [selector,values] of Object.entries(labels))assert.equal(f.$(selector).getAttribute('aria-label'),values[index],selector);
    for(const close of f.$$('.dlg-close'))assert.equal(close.getAttribute('aria-label'),index?'Close':'閉じる');
    assert.equal(f.$('#quickMarkers').title,index?'Marker display':'マーカー表示');
    assert.equal(f.$('#adjustBtn').title,index?'Display correction':'画像の表示補正');
    assert.equal(f.$('#reviewMarker').getAttribute('aria-label'),index?'Mark for review':'要確認にする');
    assert.equal(f.$('#cameraReview').getAttribute('alt'),index?'Captured photo preview':'撮影プレビュー');
    assert.equal(f.$('#confirmCancel').textContent,index?'Cancel':'キャンセル');
    assert.equal(f.$('#confirmOk').textContent,index?'Continue':'実行');
    assert.equal(f.$('#langBtn').textContent,index?'JA':'EN');
  }
});

test('open type-management controls follow language without replacing typed values or project data',()=>{
  const f=setup();f.seed(project());f.c.renderCatDialog();const before=f.read('JSON.stringify(P)');
  const [color,name,eye,del]=f.$('#catList').children[0].children;name.value='Uncommitted edit';f.lang('en');
  assert.equal(color.getAttribute('aria-label'),'Type color');assert.equal(name.getAttribute('aria-label'),'Type name');
  assert.equal(eye.title,'Hide');assert.equal(eye.getAttribute('aria-label'),'Hide');assert.equal(del.getAttribute('aria-label'),'Delete type');
  assert.equal(name.value,'Uncommitted edit');assert.equal(f.read('JSON.stringify(P)'),before);
  f.lang('ja');assert.equal(eye.title,'非表示');assert.equal(del.title,'種類を削除');
});

test('previous-work summary refreshes language while the restore offer remains available',async()=>{
  const f=setup();await f.c.init();assert.equal(f.$('#restoreBanner').hidden,false);assert.match(f.$('#restoreMeta').textContent,/1枚・1個/);
  f.lang('en');assert.match(f.$('#restoreMeta').textContent,/1 images · 1 markers/);assert.doesNotMatch(f.$('#restoreMeta').textContent,/[枚個月]/);
  f.lang('ja');assert.match(f.$('#restoreMeta').textContent,/1枚・1個/);
});

test('successful viewer import retires the old restore offer and preserves editable project data',async()=>{
  const f=setup();await f.c.init();await f.import(project('Imported'));
  assert.equal(f.$('#workspace').hidden,false);assert.equal(f.$('#restoreBanner').hidden,true);assert.equal(f.$('#restoreMeta').textContent,'');
  assert.equal(f.read('P.title'),'Imported');assert.equal(f.read('P.images[0].markers.length'),1);assert.equal(f.read('P.images[0].note'),'Keep my note');assert.deepEqual(f.writes,['save']);
  await f.$('#restoreDraft').onclick();assert.equal(f.read('P.title'),'Imported','a retired restore action cannot replace accepted work');
});

for(const failure of ['missing','invalid JSON','empty images','decode'])test(`failed viewer import keeps prior work and its restore offer: ${failure}`,async()=>{
  const f=setup();await f.c.init();f.seed(project('Current'));const before=f.read('JSON.stringify(P)');
  if(failure==='decode')f.decode(async()=>{throw new Error('decode')});
  if(failure==='missing')await f.c.importViewerFile({text:async()=>'<p>no project</p>'});
  else if(failure==='invalid JSON')await f.c.importViewerFile({text:async()=>'<script id="imageCounterProject">{</script>'});
  else await f.import(failure==='empty images'?{images:[]}:project('Invalid'));
  assert.equal(f.$('#restoreBanner').hidden,false);assert.equal(f.read('JSON.stringify(P)'),before);assert.deepEqual(f.writes,[]);
});

test('late startup draft lookup cannot offer old work above an accepted viewer import',async()=>{
  const f=setup(),pending=deferred();f.db(()=>pending.promise);const starting=f.c.init();await f.import(project('Imported'));pending.resolve(project());await starting;
  assert.equal(f.$('#restoreBanner').hidden,true);assert.equal(f.read('P.title'),'Imported');
});

test('pending restore lookup cannot replace a newer imported project',async()=>{
  const f=setup();await f.c.init();const pending=deferred();f.db(()=>pending.promise);const restoring=f.$('#restoreDraft').onclick();await f.import(project('Newer'));pending.resolve(project());await restoring;
  assert.equal(f.read('P.title'),'Newer');assert.equal(f.$('#restoreBanner').hidden,true);
});

test('a slow viewer decode cannot replace a workspace accepted after that import started',async()=>{
  const f=setup();await f.c.init();const pending=deferred();let calls=0;
  f.decode(()=>++calls===1?pending.promise:Promise.resolve({naturalWidth:800,naturalHeight:600}));
  const older=f.import(project('Older'));await new Promise(resolve=>setImmediate(resolve));
  await f.import(project('Newer'));pending.resolve({naturalWidth:800,naturalHeight:600});await older;
  assert.equal(f.read('P.title'),'Newer');assert.deepEqual(f.writes,['save']);assert.equal(f.$('#restoreBanner').hidden,true);
});

test('an obsolete viewer import failure cannot replace the newer workspace status',async()=>{
  const f=setup();await f.c.init();const pending=deferred();let calls=0;
  f.decode(()=>++calls===1?pending.promise:Promise.resolve({naturalWidth:800,naturalHeight:600}));
  const older=f.import(project('Older'));await new Promise(resolve=>setImmediate(resolve));
  await f.import(project('Newer'));const status=f.messages.at(-1);pending.reject(new Error('obsolete decode'));await older;
  assert.equal(f.read('P.title'),'Newer');assert.equal(f.messages.at(-1),status);
});

test('pending discard confirmation cannot delete the draft for newly accepted work',async()=>{
  const f=setup();await f.c.init();const pending=deferred();f.confirm(()=>pending.promise);const discarding=f.$('#discardDraft').onclick();await f.import(project('Newer'));pending.resolve(true);await discarding;
  assert.deepEqual(f.writes,['save']);assert.equal(f.read('P.title'),'Newer');
});

test('cancelled discard leaves the restore offer and saved data available',async()=>{
  const f=setup();await f.c.init();await f.$('#discardDraft').onclick();assert.equal(f.$('#restoreBanner').hidden,false);assert.deepEqual(f.writes,[]);
});

test('empty or rejected image selection retains restore, while accepted images retire it',async()=>{
  const f=setup();await f.c.init();await f.c.addFiles([],{newProjectIfEmpty:true});assert.equal(f.$('#restoreBanner').hidden,false);
  f.record(async()=>{throw new Error('decode')});await f.c.addFiles([{type:'image/png',name:'bad.png'}],{newProjectIfEmpty:true});assert.equal(f.$('#restoreBanner').hidden,false);
  f.record(async()=>project('New').images[0]);await f.c.addFiles([{type:'image/png',name:'good.png'}],{newProjectIfEmpty:true});assert.equal(f.$('#restoreBanner').hidden,true);
});

test('sample acceptance also retires the old restore offer',async()=>{
  const f=setup();await f.c.init();await f.c.sampleProject();assert.equal(f.$('#restoreBanner').hidden,true);assert.equal(f.read('P.images.length'),2);
});

test('continue still restores the saved draft after cancelling an import selection',async()=>{
  const f=setup();await f.c.init();await f.$('#restoreDraft').onclick();assert.equal(f.read('P.title'),'Previous');assert.equal(f.read('P.images[0].markers.length'),1);assert.equal(f.$('#restoreBanner').hidden,true);
});
