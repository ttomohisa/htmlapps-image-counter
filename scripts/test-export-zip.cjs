const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
let source = fs.readFileSync(process.env.IMAGE_COUNTER_HTML || path.join(__dirname, '../src/index.template.html'), 'utf8');
if (source.includes('id="self-extract-payload"')) source = zlib.gunzipSync(Buffer.from(source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/)[1], 'base64')).toString('utf8');
function section(start,end){assert.ok(source.includes(start)&&source.includes(end));return source.slice(source.indexOf(start),source.indexOf(end));}
function project(){return{app:'image-counter',schemaVersion:4,title:'Synthetic',categories:[{id:'a',name:'Count',visible:true},{id:'b',name:'Other',visible:false}],settings:{markersVisible:true,viewerCompression:{enabled:true,quality:.82}},images:[
  {id:'im1',name:'test-1.png',width:1200,height:800,note:'line 1\nline 2, "quoted"',completed:false,capturedAt:1700000000000,capturedAtSource:'file',adjustments:{brightness:100,contrast:120,grayscale:0,rotation:90},markers:[{id:'p1',shape:'point',categoryId:'a',x:.25,y:.5,order:1,needsReview:true},{id:'r1',shape:'rect',categoryId:'b',x:.1,y:.2,w:.3,h:.4,order:2,needsReview:false}]},
  {id:'im2',name:'empty.png',width:800,height:1200,note:'',completed:true,adjustments:{brightness:100,contrast:100,grayscale:0,rotation:0},markers:[]}
]};}
const expectedMarkers='\ufeff'+[
  'image_index,image_id,image_name,image_completed,image_note,image_captured_at,capture_time_source,image_width,image_height,brightness,contrast,grayscale,rotation,marker_id,marker_shape,needs_review,global_number,category_number,category,category_id,x_normalized,y_normalized,width_normalized,height_normalized,x_px,y_px,width_px,height_px',
  '1,im1,test-1.png,false,"line 1\nline 2, ""quoted""",2023-11-14T22:13:20.000Z,file,1200,800,100,120,0,90,p1,point,true,1,1,Count,a,0.250000,0.500000,,,300,400,,',
  '1,im1,test-1.png,false,"line 1\nline 2, ""quoted""",2023-11-14T22:13:20.000Z,file,1200,800,100,120,0,90,r1,rect,false,2,1,Other,b,0.100000,0.200000,0.300000,0.400000,120,160,360,320'
].join('\r\n');
const expectedSummary='\ufeff'+[
  'scope,image_index,image_id,image_name,completed,image_captured_at,capture_time_source,category,category_id,count,review_count',
  'image,1,im1,test-1.png,false,2023-11-14T22:13:20.000Z,file,Count,a,1,1',
  'image,1,im1,test-1.png,false,2023-11-14T22:13:20.000Z,file,Other,b,1,0',
  'image,1,im1,test-1.png,false,2023-11-14T22:13:20.000Z,file,Total,,2,1',
  'image,2,im2,empty.png,true,,,Count,a,0,0',
  'image,2,im2,empty.png,true,,,Other,b,0,0',
  'image,2,im2,empty.png,true,,,Total,,0,0',
  'project,,,ALL,,,,Count,a,1,1',
  'project,,,ALL,,,,Other,b,1,0',
  'project,,,ALL,,,,Total,,2,1'
].join('\r\n');
function fixture({includeImages=true,stubJpeg=false,name='Synthetic export.zip'}={}){
  const calls=[],saves=[],errors=[],messages=[],nodes=new Map();
  const $=key=>{if(!nodes.has(key))nodes.set(key,{value:'',checked:false});return nodes.get(key);};
  $('#exportName').value=name;$('#zipIncludeImages').checked=includeImages;
  const c={P:project(),TextEncoder,Uint8Array,Uint32Array,Blob,Map,Date,Math,URL,setTimeout,console:{error:e=>errors.push(e)},Toast:{show:key=>messages.push(key)},t:x=>x,$,APP_CONFIG:{slug:'image-counter'},imageCache:new Map(),loadImage:()=>{calls.push('loadImage');throw Error('Image decoding must not run for CSV-only');},document:{createElement:()=>{calls.push('canvas');throw Error('Canvas must not run for CSV-only');}},compressProjectForViewer:()=>{calls.push('compress');throw Error('Compression must not run for ZIP');}};
  vm.createContext(c);
  vm.runInContext(section('function imageReviewCount(', 'function drawReviewBadge(')+section('function safeName()', 'async function compressProjectForViewer('),c);
  if(stubJpeg)c.annotatedJpeg=async(im,p,visibility,quality)=>{calls.push({id:im.id,visibility,quality});return new Blob([Buffer.from([255,216,255,217])],{type:'image/jpeg'});};
  c.saveBlob=(blob,name)=>saves.push({blob,name});
  // Run the actual editor button binding, including the session-only choice.
  const binding=source.match(/\$\('#saveZip'\)\.onclick=[^;]+;/);assert.ok(binding);vm.runInContext(binding[0],c);
  return{c,$,calls,saves,errors,messages,click:()=>$('#saveZip').onclick()};
}
async function readZip(blob){
  const bytes=Buffer.from(await blob.arrayBuffer()),files=new Map(),entries=[];let offset=0;
  while(bytes.readUInt32LE(offset)===0x04034b50){
    assert.equal(bytes.readUInt16LE(offset+6),0x0800);assert.equal(bytes.readUInt16LE(offset+8),0);
    const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),name=bytes.subarray(offset+30,offset+30+length).toString('utf8'),start=offset+30+length+extra,data=bytes.subarray(start,start+size),crc=bytes.readUInt32LE(offset+14);
    assert.equal(zlib.crc32(data),crc);assert.equal(bytes.readUInt32LE(offset+22),size);assert.ok(!files.has(name));files.set(name,data);entries.push({offset,name,size,crc});offset=start+size;
  }
  const centralStart=offset;
  for(const entry of entries){assert.equal(bytes.readUInt32LE(offset),0x02014b50);assert.equal(bytes.readUInt32LE(offset+16),entry.crc);assert.equal(bytes.readUInt32LE(offset+20),entry.size);assert.equal(bytes.readUInt32LE(offset+42),entry.offset);const length=bytes.readUInt16LE(offset+28);assert.equal(bytes.subarray(offset+46,offset+46+length).toString('utf8'),entry.name);offset+=46+length+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);}
  assert.equal(bytes.readUInt32LE(offset),0x06054b50);assert.equal(bytes.readUInt16LE(offset+8),entries.length);assert.equal(bytes.readUInt16LE(offset+10),entries.length);assert.equal(bytes.readUInt32LE(offset+12),offset-centralStart);assert.equal(bytes.readUInt32LE(offset+16),centralStart);assert.equal(bytes.length,offset+22);
  return files;
}
test('default ZIP preserves names, both CSV byte sequences and one JPEG per image',async()=>{
  const f=fixture({stubJpeg:true}),before=JSON.stringify(f.c.P);await f.click();assert.deepEqual(f.errors,[]);assert.equal(f.saves.length,1);assert.equal(f.saves[0].name,'Synthetic export.zip');
  const files=await readZip(f.saves[0].blob);assert.deepEqual([...files.keys()],['markers.csv','summary.csv','images/01-counted-test-1.jpg','images/02-counted-empty.jpg']);assert.equal(files.get('markers.csv').toString('utf8'),expectedMarkers);assert.equal(files.get('summary.csv').toString('utf8'),expectedSummary);assert.deepEqual(f.calls.map(c=>c.id),['im1','im2']);assert.ok(f.calls.every(c=>c.quality===.9));assert.equal(JSON.stringify(f.c.P),before);
});
test('unchecked editor option saves exactly two CSV entries without any image work',async()=>{
  const f=fixture({includeImages:false}),before=JSON.stringify(f.c.P);await f.click();assert.deepEqual(f.errors,[]);assert.deepEqual(f.calls,[]);assert.equal(f.saves.length,1);
  const files=await readZip(f.saves[0].blob);assert.deepEqual([...files.keys()],['markers.csv','summary.csv']);assert.equal(files.get('markers.csv').toString('utf8'),expectedMarkers);assert.equal(files.get('summary.csv').toString('utf8'),expectedSummary);assert.equal(JSON.stringify(f.c.P),before);
});
test('repeated editor exports honor current option without modifying project settings',async()=>{
  const f=fixture({includeImages:false,stubJpeg:true}),before=JSON.stringify(f.c.P);await f.click();assert.equal(f.calls.length,0);f.$('#zipIncludeImages').checked=true;await f.click();assert.equal(f.calls.length,2);f.$('#zipIncludeImages').checked=false;await f.click();assert.equal(f.calls.length,2);assert.equal((await readZip(f.saves[2].blob)).size,2);assert.equal(JSON.stringify(f.c.P),before);
});
test('closing and reopening the export dialog preserves its session-only image choice',()=>{
  const f=fixture({includeImages:false}),before=JSON.stringify(f.c.P);let opens=0;f.$('#exportDlg').showModal=()=>opens++;
  vm.runInContext(section('function showPairedDialog(', 'function setMarkersVisible(')+section("$('#exportBtn').onclick=", ";$('#completeBtn').addEventListener")+';',f.c);
  f.$('#exportBtn').onclick();assert.equal(f.$('#zipIncludeImages').checked,false);f.$('#mobExport').onclick();assert.equal(opens,2);assert.equal(f.$('#zipIncludeImages').checked,false);assert.equal(JSON.stringify(f.c.P),before);
});
test('CSV-only retains all hidden markers, review counts and original coordinates at every rotation',async()=>{
  for(const rotation of [0,90,180,270]){const f=fixture({includeImages:false});f.c.P.images[0].adjustments.rotation=rotation;f.c.P.settings.markersVisible=false;f.c.P.categories.forEach(c=>c.visible=false);await f.click();assert.deepEqual(f.errors,[]);assert.deepEqual(f.calls,[]);const files=await readZip(f.saves[0].blob);assert.equal(files.get('markers.csv').toString('utf8'),expectedMarkers.replaceAll(',120,0,90,',`,120,0,${rotation},`));assert.equal(files.get('summary.csv').toString('utf8'),expectedSummary);}
});
test('CSV-only ZIP is valid for a project with no images and uses safe edited filenames',async()=>{
  const f=fixture({includeImages:false,name:'  Edited/name:counts.HTML  '});f.c.P.images=[];await f.click();assert.deepEqual(f.errors,[]);assert.equal(f.saves[0].name,'Edited-name-counts.zip');const files=await readZip(f.saves[0].blob);assert.equal(files.size,2);assert.equal(files.get('markers.csv').toString('utf8').split('\r\n').length,1);
  f.$('#exportName').value='...';await f.click();assert.equal(f.saves[1].name,'image-counter.zip');
});
test('ZIP image option is an initially checked native input with a translated accessible label',()=>{
  const input=source.match(/<input\b[^>]*id="zipIncludeImages"[^>]*>/);assert.ok(input,'ZIP image option must exist');assert.match(input[0],/type="checkbox"/);assert.match(input[0],/\bchecked\b/);assert.match(source,/<label[^>]*for="zipIncludeImages"[^>]*data-i18n="includeAnnotatedJpegs"/);
  const c={};vm.createContext(c);vm.runInContext(section('const I18N=', 'let lang=').replace('const I18N=','globalThis.I18N='),c);for(const lang of ['ja','en'])assert.ok(c.I18N[lang].includeAnnotatedJpegs);
});
