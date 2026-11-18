import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DEFAULTS,freshState,rgPerPixel,unitsPerPixel,extent,fitRange,validRange,insetPlacement,stateFromHash,stateToHash} from '../model.js';
const sources=JSON.parse(readFileSync(new URL('../sources.json',import.meta.url))).sources;
test('physical image scales reproduce the vetted montage',()=>{
  const expected={j1727:5628809.139839726,cygx1:1148744.8472807263,ngc6251:25797769.933249675,cena:15228391.238,m87:153451.02732463548};
  for(const s of sources.filter(s=>s.id in expected))assert.ok(Math.abs(rgPerPixel(s,'deprojected')/expected[s.id]-1)<1e-5,s.id);
});
test('M87 halo remains projected in either convention',()=>{const s=sources.find(s=>s.id==='m87');assert.equal(rgPerPixel(s,'projected'),rgPerPixel(s,'deprojected'));});
test('deprojection uses the adopted angle once',()=>{const s=sources[0];assert.ok(Math.abs(rgPerPixel(s,'deprojected')*Math.sin(40*Math.PI/180)-s.rgPerPixelProjected)<1e-8);});
test('fit includes both sides of every source',()=>{
  for(const mode of ['projected','deprojected']){
    const fit=fitRange(sources,mode);for(const s of sources){const e=extent(s,mode);assert.ok(fit.above>=e.above);assert.ok(fit.below>=e.below);}
  }
  assert.equal(fitRange([],'projected'),null);
});
test('share links preserve choices, order, empty selection, theme and numeric ranges',()=>{
  const ids=sources.map(s=>s.id);
  for(const selection of [[],['m87','j1727'],ids]){
    const s={...freshState(),selected:selection,order:[...ids].reverse(),above:.008,below:14.8,theme:'light',insets:false,information:false,projection:'projected'};
    const restored=stateFromHash(stateToHash(s),ids);assert.deepEqual({...restored,selected:[...restored.selected].sort()},{...s,selected:[...s.selected].sort()});
  }
});
test('malformed URL settings are bounded and unknown source IDs ignored',()=>{
  const s=stateFromHash('#sources=bogus,m87,m87&above=-1&below=0&theme=no&view=no&order=m87,m87,bogus',sources.map(s=>s.id));assert.deepEqual(s.selected,['m87']);assert.equal(s.order.length,sources.length);assert.equal(s.above,DEFAULTS.above);assert.equal(s.theme,'dark');
  for(const [a,b] of [[-1,2],[0,0],[NaN,1],[1,Infinity],[10001,1]])assert.equal(validRange(a,b),false);
});
test('catalogue images and their core coordinates are valid',()=>{
  assert.equal(new Set(sources.map(s=>s.id)).size,sources.length);
  for(const s of sources){assert.ok(existsSync(new URL('../'+s.image,import.meta.url)));assert.ok(s.core[0]>=0&&s.core[0]<s.width);assert.ok(s.core[1]>=0&&s.core[1]<s.height);assert.ok(s.references.length>0);assert.ok(s.rgPerPixelProjected>0);}
});
test('physical sizes recover original angular and printed-bar calibrations',()=>{
  const byId=Object.fromEntries(sources.map(s=>[s.id,s]));
  assert.ok(Math.abs(unitsPerPixel(byId.j1727,'projected','physical')*206264.806247-(10/154*5.5))<1e-6);
  assert.ok(Math.abs(unitsPerPixel(byId.cygx1,'projected','physical')*206264.806247-.05*2.22)<1e-6);
  assert.ok(Math.abs(unitsPerPixel(byId.ngc6251,'projected','physical')-100000/270)<1e-6);
  assert.ok(Math.abs(unitsPerPixel(byId.m87,'deprojected','physical')-20000/419)<1e-7);
});
test('equal R_G sizes correspond to physical sizes proportional to black-hole mass',()=>{
  const a={...sources[0],mass:10,rgPerPixelProjected:100},b={...a,mass:6.5e9};
  assert.equal(unitsPerPixel(a,'projected','rg'),unitsPerPixel(b,'projected','rg'));
  assert.ok(Math.abs(unitsPerPixel(b,'projected','physical')/unitsPerPixel(a,'projected','physical')/6.5e8-1)<1e-12);
});
test('physical fitting supports tiny stellar jets and leaves them unresolved beside AGN',()=>{
  const stars=sources.filter(s=>['j1727','cygx1'].includes(s.id));
  for(const sample of [stars,sources]){
    const fit=fitRange(sample,'deprojected','physical');assert.ok(validRange(fit.above,fit.below,'physical'));
    for(const s of sample){const e=extent(s,'deprojected','physical');assert.ok(fit.above>=e.above);assert.ok(fit.below>=e.below);}
  }
  const fit=fitRange(sources,'deprojected','physical');
  for(const s of stars)assert.ok(s.height*unitsPerPixel(s,'deprojected','physical')*620/(fit.above+fit.below)<1e-4);
});
test('physical unit links retain tiny parsec ranges and old links default to R_G',()=>{
  const ids=sources.map(s=>s.id),state={...freshState(),units:'physical',above:.0001,below:.003};
  assert.deepEqual(stateFromHash(stateToHash(state),ids),state);
  assert.equal(stateFromHash('#above=3&below=6.2',ids).units,'rg');
});

test('insets stay inside the main plot and never cover the source or core',()=>{
  for(const [imageTop,imageBottom,core] of [[280,320,294],[150,150.001,150],[430,460,450],[50,750,300],[130,500,300]]){
    const p=insetPlacement(imageTop,imageBottom,core);
    if(!p)continue;
    assert.ok(p.top>=92&&p.top+p.height<=712);
    if(p.side==='below')assert.ok(p.top>imageBottom&&p.top>core+25);
    else assert.ok(p.top+p.height<imageTop&&p.top+p.height<core);
  }
  assert.equal(insetPlacement(0,800,300),null);
});

test('new extended sources recover their documented physical calibrations',()=>{
  const ann=sources.find(s=>s.id==='1e1740'),lobes=sources.find(s=>s.id==='ngc6251-lobes');
  assert.ok(Math.abs(unitsPerPixel(ann,'projected','physical')-8500/206264.806247*15/123)<1e-10);
  assert.ok(Math.abs(unitsPerPixel(lobes,'projected','physical')-3259.536253157527)<1e-5);
  for(const s of [ann,lobes])assert.equal(rgPerPixel(s,'projected'),rgPerPixel(s,'deprojected'));
  assert.ok(ann.height*unitsPerPixel(ann,'projected','physical')>2.5);
  assert.ok(lobes.height*unitsPerPixel(lobes,'projected','physical')>1.7e6);
});

test('fit includes both transverse sides of asymmetric source images',()=>{
  for(const s of sources)for(const units of ['rg','physical']){
    const fit=fitRange([s],'deprojected',units),k=unitsPerPixel(s,'deprojected',units)*620/(fit.above+fit.below);
    assert.ok(Math.max(s.core[0],s.width-s.core[0])*k<=125,s.id);
  }
});
