export const BILLION = 1e9;
export const RG_PC_PER_SOLAR_MASS = 4.785560552051379e-14;
export const DEFAULTS = Object.freeze({selected:['j1727','cygx1','ngc6251','cena','m87'],order:['j1727','cygx1','1e1740','ngc6251','ngc6251-lobes','cena','m87'],above:3,below:6.2,units:'rg',projection:'deprojected',theme:'dark',insets:true,information:true});
export function freshState(){return structuredClone(DEFAULTS);}
export function rgPerPixel(source,projection){
  return source.rgPerPixelProjected / (projection==='deprojected' && source.inclination!==null ? Math.sin(source.inclination*Math.PI/180) : 1);
}
export function unitsPerPixel(source,projection,units='rg'){
  const rg=rgPerPixel(source,projection);
  return units==='physical' ? rg*source.mass*RG_PC_PER_SOLAR_MASS : rg/BILLION;
}
export function extent(source,projection,units='rg'){
  const k=unitsPerPixel(source,projection,units);
  return {above:source.core[1]*k,below:(source.height-source.core[1])*k};
}
export function fitRange(sources,projection,units='rg'){
  if(!sources.length)return null;
  const ext=sources.map(s=>extent(s,projection,units)),minimum=units==='physical'?1e-12:.01;
  const a=Math.max(minimum,Math.max(...ext.map(e=>e.above))),b=Math.max(minimum,Math.max(...ext.map(e=>e.below)));
  // The plot is 620 units high with 250 usable units in each source column.
  // Widen the vertical range if necessary to retain the full image width too.
  const widthSpan=Math.max(...sources.map(s=>s.width*unitsPerPixel(s,projection,units)))*620/250;
  const factor=Math.max(1,widthSpan/(a+b))*1.08;
  const step=units==='physical'?10**(Math.floor(Math.log10(Math.max(a,b)*factor))-2):.01;
  return {above:Math.ceil(a*factor/step)*step,below:Math.ceil(b*factor/step)*step};
}
export function validRange(above,below,units='rg'){const max=units==='physical'?1e9:10000,min=units==='physical'?1e-12:.001;return Number.isFinite(above)&&Number.isFinite(below)&&above>=0&&below>=0&&above+below>=min&&above<=max&&below<=max;}
export function tickStep(span){const rough=span/9;const base=10**Math.floor(Math.log10(rough));return [1,2,2.5,5,10].find(n=>n*base>=rough)*base;}
export function insetPlacement(imageTop,imageBottom,core,plotTop=92,plotBottom=712){
  // Keep insets inside the plot, on whichever side leaves more clear space.
  const belowTop=Math.max(plotTop+8,imageBottom+30,core+38);
  const aboveBottom=Math.min(plotBottom-8,imageTop-30,core-25);
  const belowSpace=plotBottom-8-belowTop,aboveSpace=aboveBottom-(plotTop+8);
  const side=belowSpace>=aboveSpace?'below':'above',space=Math.max(belowSpace,aboveSpace);
  if(space<160)return null;
  const height=Math.min(330,space);
  return {side,height,top:side==='below'?belowTop:aboveBottom-height};
}
export function stateToHash(state){
  const p=new URLSearchParams({sources:state.order.filter(id=>state.selected.includes(id)).join(','),order:state.order.join(','),above:String(state.above),below:String(state.below),units:state.units,view:state.projection,theme:state.theme,insets:state.insets?'1':'0',info:state.information?'1':'0'});
  return '#'+p.toString();
}
export function stateFromHash(hash,ids){
  const s=freshState(),p=new URLSearchParams(hash.replace(/^#/,''));
  if(p.has('sources'))s.selected=[...new Set(p.get('sources').split(',').filter(id=>ids.includes(id)))];
  const order=(p.get('order')||p.get('sources')||'').split(',').filter(id=>ids.includes(id));
  s.order=[...new Set([...order,...ids])];
  if(['rg','physical'].includes(p.get('units')))s.units=p.get('units');
  const a=Number(p.get('above')),b=Number(p.get('below'));
  if(p.has('above')&&p.has('below')&&validRange(a,b,s.units)){s.above=a;s.below=b;}
  if(['projected','deprojected'].includes(p.get('view')))s.projection=p.get('view');
  if(['dark','light'].includes(p.get('theme')))s.theme=p.get('theme');
  if(p.has('insets'))s.insets=p.get('insets')!=='0';
  if(p.has('info'))s.information=p.get('info')!=='0';
  return s;
}
