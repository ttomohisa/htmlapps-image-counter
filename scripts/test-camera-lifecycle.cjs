const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const target = process.env.IMAGE_COUNTER_HTML || path.join(__dirname, '../src/index.template.html');
let source = fs.readFileSync(target, 'utf8');
if (source.includes('id="self-extract-payload"')) {
  const payload = source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
  assert.ok(payload, 'self-extract payload must exist');
  source = require('node:zlib').gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
}
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }
function setup() {
  const elements = new Map(), pending = [], listeners = {};
  const $ = id => { if (!elements.has(id)) elements.set(id,{hidden:false,disabled:false,srcObject:null,open:false,textContent:'',focus(){},showModal(){this.open=true;},play:async()=>{}}); return elements.get(id); };
  const ctx = vm.createContext({$,t:k=>k,window:{addEventListener(type,fn){listeners[type]=fn;}},console:{error(){}},navigator:{mediaDevices:{getUserMedia(){const d=deferred();pending.push(d);return d.promise;}}}});
  vm.runInContext(source.match(/^let P=null[^\n]+/m)[0],ctx);
  vm.runInContext(source.slice(source.indexOf('async function startCamera()'),source.indexOf('function reviewCameraFile(')),ctx);
  return {$,pending,hide:()=>listeners.pagehide(),start:()=>ctx.startCamera(),stop:()=>ctx.stopCamera()};
}
function stream() { const track={readyState:'live',stop(){this.readyState='ended';}}; return {track,getTracks:()=>[track]}; }

test('closing while permission is pending stops the late stream',async()=>{const s=setup(),work=s.start(),media=stream();s.$('#cameraDlg').open=false;s.stop();s.pending[0].resolve(media);await work;assert.equal(media.track.readyState,'ended');assert.equal(s.$('#cameraVideo').srcObject,null);});
test('a superseded acquisition cannot replace the current camera',async()=>{const s=setup(),first=s.start(),second=s.start(),old=stream(),current=stream();s.pending[1].resolve(current);await second;s.pending[0].resolve(old);await first;assert.equal(old.track.readyState,'ended');assert.equal(s.$('#cameraVideo').srcObject,current);s.stop();assert.equal(current.track.readyState,'ended');});
test('video playback failure releases an acquired stream',async()=>{const s=setup(),media=stream();s.$('#cameraVideo').play=async()=>{throw Error('decode failure');};const work=s.start();s.pending[0].resolve(media);await work;assert.equal(media.track.readyState,'ended');assert.equal(s.$('#cameraVideo').srcObject,null);assert.equal(s.$('#captureBtn').disabled,true);});
test('closing while video playback is pending never re-enables capture',async()=>{const s=setup(),media=stream(),play=deferred();s.$('#cameraVideo').play=()=>play.promise;const work=s.start();s.pending[0].resolve(media);await new Promise(resolve=>setImmediate(resolve));s.$('#cameraDlg').open=false;s.stop();play.resolve();await work;assert.equal(media.track.readyState,'ended');assert.equal(s.$('#captureBtn').disabled,true);assert.equal(s.$('#cameraVideo').hidden,true);});
test('a late failed acquisition cannot overwrite a newer success',async()=>{const s=setup(),first=s.start(),second=s.start(),current=stream();s.pending[1].resolve(current);await second;s.pending[0].reject(Error('old request denied'));await first;assert.equal(current.track.readyState,'live');assert.equal(s.$('#captureBtn').disabled,false);assert.equal(s.$('#cameraState').hidden,true);});
test('normal camera preview remains usable and stops on request',async()=>{const s=setup(),media=stream(),work=s.start();s.pending[0].resolve(media);await work;assert.equal(s.$('#cameraVideo').srcObject,media);assert.equal(s.$('#captureBtn').disabled,false);s.stop();assert.equal(media.track.readyState,'ended');assert.equal(s.$('#cameraVideo').srcObject,null);});

test('page exit stops preview and invalidates pending permission',async()=>{const s=setup(),media=stream(),work=s.start();s.hide();s.pending[0].resolve(media);await work;assert.equal(media.track.readyState,'ended');assert.equal(s.$('#cameraVideo').srcObject,null);});
