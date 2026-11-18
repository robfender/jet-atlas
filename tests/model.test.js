import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DEFAULTS,freshState,rgPerPixel,extent,fitRange,validRange,stateFromHash,stateToHash} from '../model.js';
const sources=JSON.parse(readFileSync(new URL('../sources.json',import.meta.url))).sources;
test('physical image scales reproduce the vetted montage',()=>{
  const expected={j1727:5628809.139839726,cygx1:1148744.8472807263,ngc6251:25797769.933249675,cena:15228391.238,m87:153451.02732463548};
  for(const s of sources)assert.ok(Math.abs(rgPerPixel(s,'deprojected')/expected[s.id]-1)<1e-5,s.id);
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
