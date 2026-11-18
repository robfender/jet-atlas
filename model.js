export const BILLION = 1e9;
export const DEFAULTS = Object.freeze({selected:['j1727','cygx1','ngc6251','cena','m87'],order:['j1727','cygx1','ngc6251','cena','m87'],above:3,below:6.2,projection:'deprojected',theme:'dark',insets:true,information:true});
export function freshState(){return structuredClone(DEFAULTS);}
export function rgPerPixel(source,projection){
  return source.rgPerPixelProjected / (projection==='deprojected' && source.inclination!==null ? Math.sin(source.inclination*Math.PI/180) : 1);
}
export function extent(source,projection){
  const k=rgPerPixel(source,projection)/BILLION;
  return {above:source.core[1]*k,below:(source.height-source.core[1])*k};
}
export function fitRange(sources,projection){
  if(!sources.length)return null;
  const ext=sources.map(s=>extent(s,projection));
  const a=Math.max(.01,Math.max(...ext.map(e=>e.above))),b=Math.max(.01,Math.max(...ext.map(e=>e.below)));
  // The plot is 620 units high with 250 usable units in each source column.
  // Widen the vertical range if necessary to retain the full image width too.
  const widthSpan=Math.max(...sources.map(s=>s.width*rgPerPixel(s,projection)/BILLION))*620/250;
  const factor=Math.max(1,widthSpan/(a+b))*1.08;
  return {above:Math.ceil(a*factor*100)/100,below:Math.ceil(b*factor*100)/100};
}
export function validRange(above,below){return Number.isFinite(above)&&Number.isFinite(below)&&above>=0&&below>=0&&above+below>=.001&&above<=10000&&below<=10000;}
export function tickStep(span){const rough=span/9;const base=10**Math.floor(Math.log10(rough));return [1,2,2.5,5,10].find(n=>n*base>=rough)*base;}
export function stateToHash(state){
  const p=new URLSearchParams({sources:state.order.filter(id=>state.selected.includes(id)).join(','),order:state.order.join(','),above:String(state.above),below:String(state.below),view:state.projection,theme:state.theme,insets:state.insets?'1':'0',info:state.information?'1':'0'});
  return '#'+p.toString();
}
export function stateFromHash(hash,ids){
  const s=freshState(),p=new URLSearchParams(hash.replace(/^#/,''));
  if(p.has('sources'))s.selected=[...new Set(p.get('sources').split(',').filter(id=>ids.includes(id)))];
  const order=(p.get('order')||p.get('sources')||'').split(',').filter(id=>ids.includes(id));
  s.order=[...new Set([...order,...ids])];
  const a=Number(p.get('above')),b=Number(p.get('below'));
  if(p.has('above')&&p.has('below')&&validRange(a,b)){s.above=a;s.below=b;}
  if(['projected','deprojected'].includes(p.get('view')))s.projection=p.get('view');
  if(['dark','light'].includes(p.get('theme')))s.theme=p.get('theme');
  if(p.has('insets'))s.insets=p.get('insets')!=='0';
  if(p.has('info'))s.information=p.get('info')!=='0';
  return s;
}
