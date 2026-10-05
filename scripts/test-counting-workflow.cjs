const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let source = fs.readFileSync(process.env.IMAGE_COUNTER_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
if (source.includes('id="self-extract-payload"')) source = require('node:zlib').gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1], 'base64')).toString('utf8');
function section(start, end) { assert.ok(source.includes(start) && source.includes(end)); return source.slice(source.indexOf(start), source.indexOf(end)); }
const runtime = [
  section('function activeImage()', 'function normalizeProject('),
  section('function cloneLight()', 'function dataUrlBytes('),
  section('function displayDims(', 'function drawBaseImage('),
  section('function markerRectScreen(', 'function drawGuide('),
  section('function hitMarker(', 'function positionMarkerPop('),
  section('function pointerDown(', 'function toggleSelectedReview('),
].join('\n');
const point = {id:'point-1',shape:'point',categoryId:'count',x:.25,y:.3,order:1,needsReview:true};
const rect = {id:'rect-1',shape:'rect',categoryId:'count',x:.2,y:.2,w:.3,h:.4,order:1,needsReview:false};
function fixture(rotation=0, mode='point', markers=[], dimensions={width:1200,height:800}) {
  const handlers={}, nodes=new Map(), captures=new Set(), classes=new Set();
  const node=()=>({classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},style:{},dataset:{},hidden:false,getBoundingClientRect:()=>({left:12,top:20,width:1000,height:700})});
  const wrap={...node(),setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),addEventListener:(name,fn)=>handlers[name]=fn};
  let ids=0,saves=0;
  const c={structuredClone,console,Date,Math,Map,P:{title:'Synthetic',updatedAt:123,categories:[{id:'count',name:'Count',visible:true}],settings:{markersVisible:true,markerSize:28},images:[{id:'image-1',name:'synthetic.png',...dimensions,completed:true,note:'keep',adjustments:{brightness:100,contrast:100,grayscale:0,rotation},markers:structuredClone(markers)}]},activeImageId:'image-1',activeCategoryId:'count',selectedMarkerId:null,mode,view:{zoom:1,panX:0,panY:0},pointers:new Map(),gesture:null,interaction:null,draftRect:null,lastMarkerId:null,lastMarkerAt:0,history:[],future:[{redo:'keep'}],wrap,canvas:node(),$:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},id:()=>`new-${++ids}`,scheduleSave:()=>saves++,renderStorageSoon(){},renderAll(){},renderCanvas(){}};
  vm.createContext(c);vm.runInContext(runtime,c);
  const event=(x,y,pointerId=1)=>{const p=c.originalToScreen(x,y);return{pointerId,clientX:p.x+12,clientY:p.y+20}};
  const send=(type,x,y,pointerId=1)=>handlers[type]({...event(x,y,pointerId),type});
  return {c,send,handlers,captures,classes,saves:()=>saves};
}
function unchanged(f,before) {
  assert.equal(JSON.stringify(f.c.P),before,'cancel must preserve project data, completion, and update timestamp');
  assert.equal(f.c.history.length,0);assert.equal(JSON.stringify(f.c.future),'[{"redo":"keep"}]');assert.equal(f.saves(),0);
  assert.equal(f.c.interaction,null);assert.equal(f.c.draftRect,null);assert.equal(f.c.gesture,null);assert.equal(f.c.pointers.size,0);assert.equal(f.classes.has('dragging'),false);
}
for (const rotation of [0,90,180,270]) {
  for (const dimensions of [{width:1200,height:800},{width:800,height:1200}]) {
    const suffix=`at ${rotation} degrees, ${dimensions.width}x${dimensions.height}`;
    for (const mode of ['point','rect']) test(`cancel discards new ${mode} ${suffix}`,()=>{
      const f=fixture(rotation,mode,[],dimensions),before=JSON.stringify(f.c.P);
      f.send('pointerdown',.2,.2);if(mode==='rect')f.send('pointermove',.5,.6);f.send('pointercancel',mode==='rect'?.5:.2,mode==='rect'?.6:.2);
      unchanged(f,before);assert.equal(f.captures.size,0);f.send('pointerup',.2,.2);unchanged(f,before);
    });
    for (const marker of [point,rect]) test(`cancel restores moved ${marker.shape} ${suffix}`,()=>{
      const f=fixture(rotation,'point',[marker],dimensions),before=JSON.stringify(f.c.P),x=marker.shape==='point'?.25:.35,y=marker.shape==='point'?.3:.4;
      f.send('pointerdown',x,y);f.send('pointermove',x+.1,y+.1);assert.notEqual(JSON.stringify(f.c.P),before);
      f.send('pointercancel',x+.1,y+.1);unchanged(f,before);assert.equal(f.c.selectedMarkerId,marker.id);
    });
    for(const handle of ['tl','tr','br','bl']) test(`cancel restores ${handle} rectangle resize ${suffix}`,()=>{
      const f=fixture(rotation,'rect',[rect],dimensions),before=JSON.stringify(f.c.P);f.c.selectedMarkerId=rect.id;
      const x=handle.includes('l')?.2:.5,y=handle.includes('t')?.2:.6;
      f.send('pointerdown',x,y);assert.equal(f.c.interaction.type,'resize');f.send('pointermove',x+.04,y+.04);assert.equal(f.c.P.images[0].completed,false);
      f.send('pointercancel',x+.04,y+.04);unchanged(f,before);
    });
    test(`normal release commits point and supports undo/redo ${suffix}`,()=>{
      const f=fixture(rotation,'point',[],dimensions);f.send('pointerdown',.25,.3);f.send('pointerup',.25,.3);
      const im=f.c.P.images[0],m=im.markers[0];assert.equal(im.markers.length,1);assert.ok(Math.abs(m.x-.25)<1e-12&&Math.abs(m.y-.3)<1e-12);assert.equal(im.completed,false);
      assert.equal(f.c.history.length,1);assert.equal(f.c.future.length,0);assert.equal(f.saves(),1);f.c.undo();assert.equal(im.markers.length,0);assert.equal(im.completed,true);f.c.redo();assert.equal(im.markers.length,1);
    });
    test(`normal rectangle release and editing remain undoable ${suffix}`,()=>{
      const f=fixture(rotation,'rect',[],dimensions);f.send('pointerdown',.2,.2);f.send('pointermove',.5,.6);f.send('pointerup',.5,.6);
      const im=f.c.P.images[0];assert.equal(im.markers.length,1);assert.ok(Math.abs(im.markers[0].w-.3)<1e-12&&Math.abs(im.markers[0].h-.4)<1e-12);
      f.c.selectedMarkerId=im.markers[0].id;f.send('pointerdown',.2,.2);f.send('pointermove',.1,.1);f.send('pointerup',.1,.1);assert.equal(f.c.history.length,2);assert.ok(Math.abs(im.markers[0].x-.1)<1e-12);
      f.c.undo();assert.ok(Math.abs(im.markers[0].x-.2)<1e-12);f.c.redo();assert.ok(Math.abs(im.markers[0].x-.1)<1e-12);
    });
  }
}
test('late cancelled-pointer events cannot commit a subsequent gesture',()=>{
  const f=fixture();f.send('pointerdown',.2,.2,1);f.send('pointercancel',.2,.2,1);f.send('pointerdown',.6,.6,2);
  f.send('pointermove',.3,.3,1);f.send('pointerup',.6,.6,1);f.send('pointercancel',.6,.6,1);assert.equal(f.c.P.images[0].markers.length,0);assert.ok(f.c.interaction);
  f.send('pointerup',.6,.6,2);assert.equal(f.c.P.images[0].markers.length,1);assert.equal(f.saves(),1);
});
test('cancelled pan preserves view but does not edit count data',()=>{
  const f=fixture(90,'pan'),before=JSON.stringify(f.c.P);f.send('pointerdown',.2,.2);f.send('pointermove',.4,.5);const view=JSON.stringify(f.c.view);assert.notEqual(f.c.view.panX,0);f.send('pointercancel',.4,.5);unchanged(f,before);assert.equal(JSON.stringify(f.c.view),view);
});
test('two-pointer zoom can cancel and release without creating counts',()=>{
  const f=fixture(),before=JSON.stringify(f.c.P);f.send('pointerdown',.2,.2,1);f.send('pointerdown',.6,.6,2);f.send('pointermove',.7,.7,2);assert.ok(f.c.view.zoom>1);
  f.send('pointercancel',.2,.2,1);f.send('pointerup',.7,.7,2);unchanged(f,before);
});
for(const rotation of [0,90,180,270]) for(const dimensions of [{width:1200,height:800},{width:800,height:1200}]) {
  for(const edit of ['point','rect','tl','tr','br','bl']) for(const order of [[1,2],[2,1]]) for(const ends of [['pointerup','pointerup'],['pointercancel','pointerup'],['pointerup','pointercancel'],['pointercancel','pointercancel']]) {
    test(`pinch interrupts ${edit}, rotation ${rotation}, ${dimensions.width}x${dimensions.height}, end ${order} ${ends}`,()=>{
      const marker=edit==='point'?point:rect,f=fixture(rotation,'point',[marker],dimensions),before=JSON.stringify(f.c.P);
      if(!['point','rect'].includes(edit))f.c.selectedMarkerId=rect.id;
      const x=edit==='point'?.25:edit==='rect'?.35:edit.includes('l')?.2:.5,y=edit==='point'?.3:edit==='rect'?.4:edit.includes('t')?.2:.6;
      f.send('pointerdown',x,y,1);f.send('pointermove',x+.04,y+.04,1);assert.notEqual(JSON.stringify(f.c.P),before);
      f.send('pointerdown',.8,.8,2);assert.equal(JSON.stringify(f.c.P),before);assert.equal(f.c.interaction,null);
      const zoom=f.c.view.zoom;f.send('pointermove',.9,.9,2);assert.notEqual(f.c.view.zoom,zoom);
      f.send(ends[0],.7,.7,order[0]);f.send(ends[1],.7,.7,order[1]);unchanged(f,before);
    });
  }
  for(const marker of [point,rect])test(`normal ${marker.shape} move remains undoable at ${rotation}, ${dimensions.width}x${dimensions.height}`,()=>{
    const f=fixture(rotation,'point',[marker],dimensions),x=marker.shape==='point'?.25:.35,y=marker.shape==='point'?.3:.4;
    f.send('pointerdown',x,y);f.send('pointermove',x+.1,y+.1);f.send('pointerup',x+.1,y+.1);
    assert.equal(f.c.history.length,1);assert.equal(f.saves(),1);const edited=JSON.stringify(f.c.P.images[0].markers);assert.notEqual(edited,JSON.stringify([marker]));
    f.c.undo();assert.deepEqual(JSON.parse(JSON.stringify(f.c.P.images[0].markers)),[marker]);f.c.redo();assert.equal(JSON.stringify(f.c.P.images[0].markers),edited);
  });
}
test('a third pointer cannot create an annotation or let another pointer commit it',()=>{
  const f=fixture(),before=JSON.stringify(f.c.P);f.send('pointerdown',.2,.2,1);f.send('pointerdown',.8,.8,2);f.send('pointerdown',.5,.5,3);f.send('pointerup',.5,.5,1);
  assert.equal(JSON.stringify(f.c.P),before);f.send('pointermove',.6,.6,3);f.send('pointerup',.6,.6,3);f.send('pointercancel',.8,.8,2);unchanged(f,before);
});
test('cancel without movement preserves existing marker and completed state',()=>{
  const f=fixture(0,'point',[point]),before=JSON.stringify(f.c.P);f.send('pointerdown',.25,.3);f.send('pointercancel',.25,.3);unchanged(f,before);
});
test('rollback preserves unrelated marker edits, notes, and existing undo/redo entries',()=>{
  const f=fixture(0,'point',[point]);f.c.history.push({undo:'keep'});const history=f.c.history,future=f.c.future;
  f.send('pointerdown',.25,.3);f.send('pointermove',.4,.5);const im=f.c.P.images[0];im.note='new note';im.markers[0].needsReview=false;im.markers[0].categoryId='updated-type';
  f.send('pointercancel',.4,.5);assert.equal(im.markers[0].x,.25);assert.equal(im.markers[0].y,.3);assert.equal(im.completed,true);assert.equal(im.note,'new note');assert.equal(im.markers[0].needsReview,false);assert.equal(im.markers[0].categoryId,'updated-type');assert.equal(f.c.history,history);assert.equal(f.c.future,future);assert.equal(f.saves(),0);
});
test('outside-image and tiny rectangle gestures do not add counts',()=>{
  const f=fixture();f.handlers.pointerdown({pointerId:1,clientX:-30,clientY:-30});f.handlers.pointercancel({pointerId:1,clientX:-30,clientY:-30});assert.equal(f.c.P.images[0].markers.length,0);
  f.c.mode='rect';f.send('pointerdown',.2,.2);f.send('pointermove',.2001,.2001);f.send('pointerup',.2001,.2001);assert.equal(f.c.P.images[0].markers.length,0);assert.equal(f.saves(),0);
});
