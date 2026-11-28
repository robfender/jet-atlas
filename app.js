import {freshState,unitsPerPixel,extent,fitRange,validRange,zoomRange,tickStep,insetPlacement,stateToHash,stateFromHash} from './model.js?v=11';

const $=id=>document.getElementById(id);
const escapeXML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const palettes={dark:{bg:'#05080b',ink:'#e7edf1',muted:'#8e9ca8',line:'#26343f',faint:'#131c24'},light:{bg:'#ffffff',ink:'#1d2c32',muted:'#5d6b74',line:'#d3ddd8',faint:'#f3f6f4'}};
// Every exported figure text style is explicitly sized for presentation use.
const figureType={axisUnits:28,axisTick:22,core:14,sourceName:25.5,band:15,projection:12,annotation:13.5,insetTitle:18,insetScale:16.5,footerName:21,footerMass:18,footerInclination:16.5,footerEddington:16.5,footerReference:13.5};
let sources=[],state=freshState(),dragged=null,toastTimer;
const imageData=new Map();
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function selected(){return state.order.filter(id=>state.selected.includes(id)).map(id=>sources.find(s=>s.id===id)).filter(Boolean);}
function sourceColor(source){return state.theme==='dark'?source.color:source.lightColor;}
function updateZoomButtons(){
  $('zoom-in').disabled=!state.selected.length||!zoomRange(state.above,state.below,.8,state.units);
  $('zoom-out').disabled=!state.selected.length||!zoomRange(state.above,state.below,1.25,state.units);
}
function commit(){
  const viewport=$('figure-viewport'),scroll=viewport.scrollLeft;
  document.documentElement.dataset.theme=state.theme;
  $('theme').textContent=state.theme==='dark'?'Light theme ◐':'Dark theme ◑';
  $('range-above').value=state.above;$('range-below').value=state.below;
  const physical=state.units==='physical';
  $('units-rg').setAttribute('aria-pressed',String(!physical));
  $('units-physical').setAttribute('aria-pressed',String(physical));
  for(const el of document.querySelectorAll('.range-unit'))el.innerHTML=physical?'pc':'× 10⁹ R<sub>G</sub>';
  for(const id of ['range-above','range-below'])$(id).max=physical?'1000000000':'100000';
  document.querySelector('.definition').innerHTML=physical?'<span>THE UNIT</span><strong>Physical distance</strong><p>Parsecs: 1 pc ≈ 206,265 AU. Each image uses its own black-hole mass to convert from R<sub>G</sub>.</p>':'<span>THE UNIT</span><strong>R<sub>G</sub> = GM / c²</strong><p>Distance measured in the natural length scale of each black hole.</p>';
  $('method-note').textContent=physical?'Common physical distance in parsecs. Labelled core markers indicate jets smaller than one pixel; marker sizes do not represent jet sizes. Colours and brightness are illustrative.':'Images share a scale in gravitational radii, not a brightness scale. Colours are illustrative; different observations have different resolutions and sensitivities.';
  $('deprojected').setAttribute('aria-pressed',String(state.projection==='deprojected'));
  $('projected').setAttribute('aria-pressed',String(state.projection==='projected'));
  $('projection-note').textContent=state.projection==='deprojected'?'Adopted inclinations; unknown angles stay projected.':'All distances projected onto the plane of the sky.';
  $('insets').checked=state.insets;$('information').checked=state.information;
  $('scroll-zoom').checked=state.scrollZoom;
  updateZoomButtons();
  $('selected-count').textContent=`${state.selected.length} / ${sources.length}`;
  $('fit').disabled=!state.selected.length;
  for(const id of ['svg','png','share'])$(id).disabled=!state.selected.length;
  renderChoices();renderFigure();renderDetails();
  try{history.replaceState(null,'',stateToHash(state));}catch{}
  viewport.scrollLeft=scroll;
}
function renderChoices(){
  $('source-list').innerHTML=state.order.map((id,i)=>{
    const s=sources.find(s=>s.id===id),checked=state.selected.includes(id);
    return `<div class="source-choice ${checked?'selected':''}" draggable="true" data-id="${id}" style="--source:${sourceColor(s)}"><label><input type="checkbox" data-select="${id}" ${checked?'checked':''}><span class="source-dot"></span><span class="source-name">${escapeXML(s.name)}<span class="source-type">${s.kind}</span></span></label><div class="reorder"><button type="button" data-move="${id}" data-direction="-1" ${i===0?'disabled':''} aria-label="Move ${escapeXML(s.name)} left">▲</button><button type="button" data-move="${id}" data-direction="1" ${i===state.order.length-1?'disabled':''} aria-label="Move ${escapeXML(s.name)} right">▼</button></div></div>`;
  }).join('');
}
function renderFigure(){
  const list=selected(),p=palettes[state.theme];
  const physical=state.units==='physical',unit=physical?'pc':'× 10⁹ Rɢ';
  $('view-label').innerHTML=(state.projection==='deprojected'?'Deprojected':'Projected')+(physical?' · physical size (pc)':' · shared R<sub>G</sub> scale');
  $('figure-summary').textContent=`${list.length} source${list.length===1?'':'s'} · −${formatNumber(state.above)} to +${formatNumber(state.below)} ${unit}`;
  if(!list.length){$('figure').innerHTML='<div class="empty"><strong>A universe of scales.</strong><p>Select a source to start comparing.</p></div>';return;}
  const col=270;
  const measure=document.createElement('canvas').getContext('2d');
  const wrapLabel=(value,size)=>{
    measure.font=`${size}px Arial,Helvetica,sans-serif`;
    const lines=[];let line='';
    for(const word of String(value).split(/\s+/)){
      const next=line?`${line} ${word}`:word;
      if(line&&measure.measureText(next).width>col-24){lines.push(line);line=word;}else line=next;
    }
    if(line)lines.push(line);return lines;
  };
  const headers=list.map(s=>({name:wrapLabel(s.name,figureType.sourceName),band:wrapLabel(s.band,figureType.band)}));
  const bandY=35+(Math.max(...headers.map(h=>h.name.length))-1)*31+29;
  const projectionY=bandY+(Math.max(...headers.map(h=>h.band.length))-1)*20+24;
  const top=projectionY+20,plotH=620,bottom=top+plotH;
  // Reserve enough room for presentation-sized labels, including wide pc ranges.
  const axisWidth=Math.max(190,Math.ceil(Math.max(formatNumber(-state.above).length,formatNumber(state.below).length)*14+40));
  const axisX=axisWidth-28,W=axisWidth+list.length*col;
  const scale=plotH/(state.above+state.below),core=top+state.above*scale;
  const hasInsets=state.insets,footerY=bottom+75;
  const footerRoles=['footerName','footerMass','footerInclination','footerEddington','footerReference','footerReference'];
  const footerSizes=footerRoles.map(role=>figureType[role]),footerLines=[27,24,22,22,19,19];
  const footers=list.map(s=>[
    s.name,`Mʙʜ = ${s.massLabel}`,
    s.id==='m87'?'Inner jet 17.2°; halo i unknown':`i = ${s.inclinationLabel}`,
    `Lbol / LEdd ${s.eddington}`,...s.references.slice(0,2).map(r=>r.label.split(' · ')[0])
  ].map((value,row)=>wrapLabel(value,footerSizes[row])));
  let footerHeight=0;const footerOffsets=footerSizes.map((_,row)=>{
    const offset=footerHeight;
    footerHeight+=Math.max(...footers.map(rows=>rows[row]?.length||0))*footerLines[row]+8;
    return offset;
  });
  const H=state.information?footerY+footerHeight+10:bottom+45;
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="plot-title plot-desc"><title id="plot-title">Black hole low Eddington / hard state jets across the mass scale</title><desc id="plot-desc">${escapeXML(list.map(s=>s.name).join(', '))}. Shared size scale: ${unit}. ${state.projection} distances; Views with unknown inclinations remain projected. R_G equals GM over c squared. Core markers are not jet sizes. Colours do not compare brightness.</desc><defs><filter id="light-emission" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="0.58"/><feFuncG type="linear" slope="0.58"/><feFuncB type="linear" slope="0.58"/><feFuncA type="gamma" amplitude="1" exponent="0.6" offset="0"/></feComponentTransfer></filter></defs><rect width="${W}" height="${H}" fill="${p.bg}"/><g font-family="Arial,Helvetica,sans-serif">`];
  const text=(x,y,str,role='annotation',color=p.muted,anchor='middle',extra='')=>parts.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${figureType[role]}" data-text-role="${role}" fill="${color}" ${extra}>${escapeXML(str)}</text>`);
  const image=(s,x,y,k)=>{
    const w=s.width*k,h=s.height*k;
    return `<image data-source="${s.id}" x="${x-s.core[0]*k}" y="${y-s.core[1]*k}" width="${w}" height="${h}" href="${s.image}" ${state.theme==='light'?'filter="url(#light-emission)"':''}/>`;
  };
  parts.push(`<line x1="${axisX+12}" x2="${W-18}" y1="${core}" y2="${core}" stroke="${p.muted}" stroke-width=".7" stroke-dasharray="2 6" opacity=".55"/>`);
  text(axisX,35,physical?'pc':'10⁹ Rɢ','axisUnits',p.ink,'end','font-weight="600" data-axis-units="true"');
  text(18,core-16,'CORE','core',p.ink,'start','font-weight="600"');
  parts.push(`<line x1="${axisX}" x2="${axisX}" y1="${top}" y2="${bottom}" stroke="${p.ink}" stroke-width="1.5" opacity=".75"/>`);
  const step=tickStep(state.above+state.below);
  for(let i=Math.ceil(-state.above/step);i<=Math.floor(state.below/step);i++){
    const val=i*step,y=core+val*scale,label=formatNumber(Number(val.toPrecision(5))).replace('-','−');
    parts.push(`<line x1="${axisX-7}" x2="${axisX+7}" y1="${y}" y2="${y}" stroke="${p.ink}" stroke-width="1.5"/>`);text(axisX-16,y+7,label,'axisTick',p.ink,'end','font-weight="600" data-axis-tick="true"');
  }
  list.forEach((s,i)=>{
    const left=axisWidth+i*col,cx=left+col/2,color=sourceColor(s),k=unitsPerPixel(s,state.projection,state.units)*scale;
    headers[i].name.forEach((line,j)=>text(cx,35+j*31,line,'sourceName',color));
    headers[i].band.forEach((line,j)=>text(cx,bandY+j*20,line,'band'));
    if(s.inclination===null)text(cx,projectionY,s.id==='m87'?'PROJECTED HALO':'PROJECTED','projection',p.muted);
    parts.push(`<defs><clipPath id="plot-${s.id}"><rect x="${left+5}" y="${top}" width="${col-10}" height="${plotH}"/></clipPath></defs>`);
    parts.push(`<g clip-path="url(#plot-${s.id})">${image(s,cx,core,k)}</g>`);
    const tiny=s.height*k<1;
    if(tiny){
      parts.push(`<circle data-core-marker="${s.id}" cx="${cx}" cy="${core}" r="2.2" fill="${color}"><title>Core marker; jet smaller than one pixel at this scale</title></circle>`);
      text(cx,core+27,'Jet below 1 pixel · core marker','annotation',color);
    }
    const e=extent(s,state.projection,state.units),clipped=e.below>state.below*1.001||e.above>state.above*1.001||s.width*k>col-10;
    if(clipped)text(cx,bottom+23,'Image extends beyond view','annotation',color);
    const placement=insetPlacement(core-s.core[1]*k,core+(s.height-s.core[1])*k,core,top,bottom);
    if(hasInsets&&placement&&(s.inset||s.height*k<40||(physical&&s.height*k<120))){
      const insetTop=placement.top,insetH=placement.height,bodyH=insetH-95;
      // Uniform magnification only; changing range never changes the common calibration.
      const available=Math.min((col-34)/(s.width*k),bodyH/(s.height*k));
      const zoom=(physical||s.height*k<20)?niceMagnification(available*.95):Math.min(s.inset||5,Math.floor(available*10)/10);
      if(zoom>1){
        const bw=Math.max(16,Math.min(s.width*k+12,col-20)),bh=Math.max(20,Math.min(s.height*k+12,plotH));
        const boxY=Math.max(top,Math.min(core-s.core[1]*k-6,bottom-bh));
        const fromY=placement.side==='below'?boxY+bh:boxY,toY=placement.side==='below'?insetTop:insetTop+insetH;
        parts.push(`<rect x="${cx-bw/2}" y="${boxY}" width="${bw}" height="${bh}" fill="none" stroke="${color}" stroke-width=".8"/><path d="M${cx-bw/2},${fromY} L${left+10},${toY} M${cx+bw/2},${fromY} L${left+col-10},${toY}" stroke="${color}" opacity=".35" stroke-dasharray="3 4" fill="none"/><rect data-inset="${s.id}" x="${left+10}" y="${insetTop}" width="${col-20}" height="${insetH}" rx="5" fill="${p.bg}" stroke="${p.line}"/>`);
        text(cx,insetTop+25,(zoom>=1e4?`Enlarged ${scientific(zoom)} times`:`×${zoom} enlargement`),'insetTitle',color);
        const zk=k*zoom,bodyY=insetTop+44;
        const imageTop=bodyY+(bodyH-s.height*zk)/2,zy=imageTop+s.core[1]*zk;
        const insetCoreX=cx+(s.core[0]-s.width/2)*zk;
        parts.push(image(s,insetCoreX,zy,zk));
        const barValue=10**Math.floor(Math.log10(125/(scale*zoom))),barW=barValue*scale*zoom;
        const bx=cx-barW/2,by=insetTop+insetH-33;
        parts.push(`<path d="M${bx},${by-4}v8 M${bx},${by}h${barW} M${bx+barW},${by-4}v8" fill="none" stroke="${color}"/>`);
        text(cx,by+24,physical?physicalBar(barValue):`${formatPower(barValue*1e9)} Rɢ`,'insetScale',color);
      }
    }
    if(state.information){
      const colors=[color,p.ink,p.muted,p.ink,p.muted,p.muted];
      footers[i].forEach((lines,row)=>lines.forEach((line,j)=>
        text(cx,footerY+footerOffsets[row]+j*footerLines[row],line,footerRoles[row],colors[row])
      ));
    }
  });
  parts.push('</g></svg>');$('figure').innerHTML=parts.join('');
  $('figure').querySelector('svg').style.minWidth=Math.max(650,list.length*190)+'px';
}
function formatPower(v){const exp=Math.round(Math.log10(v));return '10'+String(exp).replace(/./g,d=>d==='-'?'⁻':'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);}
function formatNumber(v){return v!==0&&Math.abs(v)<.001?Number(v.toPrecision(3)).toExponential():v.toLocaleString('en-US',{maximumFractionDigits:5});}
function scientific(v){const exp=Math.floor(Math.log10(v)),m=Number((v/10**exp).toPrecision(2));return m===1?formatPower(v):`${m} × ${formatPower(10**exp)}`;}
function niceMagnification(v){const base=10**Math.floor(Math.log10(v));return ([5,2,1].find(n=>n*base<=v)||1)*base;}
function physicalBar(pc){return pc>=1000?`${formatNumber(pc/1000)} kpc`:pc>=.001?`${formatNumber(pc)} pc`:`${formatNumber(Number((pc*206264.806247).toPrecision(3)))} AU`;}
function renderDetails(){
  const list=selected();$('source-details').style.display=state.information?'':'none';
  $('source-details').innerHTML=list.map(s=>`<article class="source-detail"><h3 style="color:${sourceColor(s)}">${escapeXML(s.name)}</h3><dl><dt>Black-hole mass</dt><dd>${escapeXML(s.massLabel)}</dd><dt>Distance / scale</dt><dd>${escapeXML(s.distance)}</dd><dt>Inclination</dt><dd>${escapeXML(s.inclinationLabel)}</dd><dt>L<sub>bol</sub> / L<sub>Edd</sub></dt><dd>${escapeXML(s.eddington)}</dd></dl><p>${escapeXML(s.notes)}</p><details><summary style="font-size:10px;cursor:pointer">Image calibration</summary><p>${escapeXML(s.calibration)}</p></details><p>${s.references.map(r=>`<a class="ref" href="${escapeXML(r.url)}" target="_blank" rel="noreferrer">${escapeXML(r.label)} ↗</a>`).join('')}</p></article>`).join('');
}
function move(id,offset){const i=state.order.indexOf(id),j=i+offset;if(j<0||j>=state.order.length)return;[state.order[i],state.order[j]]=[state.order[j],state.order[i]];commit();}
function bind(){
  $('source-list').addEventListener('change',e=>{const id=e.target.dataset.select;if(!id)return;state.selected=e.target.checked?[...state.selected,id]:state.selected.filter(v=>v!==id);commit();});
  $('source-list').addEventListener('click',e=>{const btn=e.target.closest('[data-move]');if(btn)move(btn.dataset.move,Number(btn.dataset.direction));});
  $('source-list').addEventListener('dragstart',e=>{const row=e.target.closest('[data-id]');if(!row)return;dragged=row.dataset.id;e.dataTransfer.setData('text/plain',dragged);e.dataTransfer.effectAllowed='move';row.classList.add('dragging');});
  $('source-list').addEventListener('dragover',e=>e.preventDefault());
  $('source-list').addEventListener('dragend',()=>{dragged=null;renderChoices();});
  $('source-list').addEventListener('drop',e=>{e.preventDefault();const target=e.target.closest('[data-id]')?.dataset.id;if(!target||!dragged||target===dragged)return;const old=state.order.indexOf(dragged),dest=state.order.indexOf(target);state.order.splice(old,1);state.order.splice(dest,0,dragged);dragged=null;commit();});
  $('select-all').onclick=()=>{state.selected=sources.map(s=>s.id);commit();};
  $('clear-all').onclick=()=>{state.selected=[];commit();};
  $('theme').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';commit();};
  for(const mode of ['projected','deprojected'])$(mode).onclick=()=>{state.projection=mode;commit();};
  for(const mode of ['rg','physical'])$('units-'+mode).onclick=()=>{
    if(state.units===mode)return;
    state.units=mode;
    if(mode==='physical')state.insets=false;
    Object.assign(state,fitRange(selected().length?selected():sources,state.projection,state.units));
    $('range-error').hidden=true;commit();
  };
  const updateRange=()=>{
    const a=Number($('range-above').value),b=Number($('range-below').value);
    const ok=$('range-above').value!==''&&$('range-below').value!==''&&validRange(a,b,state.units);
    $('range-error').hidden=ok;
    if(!ok){$('range-error').textContent=state.units==='physical'?'Use non-negative distances up to 1 billion parsecs, with a positive total range.':'Use non-negative values up to 10,000, with a total range of at least 0.001.';return;}
    state.above=a;state.below=b;renderFigure();updateZoomButtons();
    try{history.replaceState(null,'',stateToHash(state));}catch{}
  };
  for(const id of ['range-above','range-below']){
    $(id).addEventListener('input',updateRange);
    $(id).addEventListener('change',updateRange);
  }
  $('fit').onclick=()=>{Object.assign(state,fitRange(selected(),state.projection,state.units));$('range-error').hidden=true;commit();};
  for(const [id,key] of [['insets','insets'],['information','information'],['scroll-zoom','scrollZoom']])$(id).onchange=e=>{state[key]=e.target.checked;commit();};
  const applyZoom=factor=>{const next=zoomRange(state.above,state.below,factor,state.units);if(next){Object.assign(state,next);$('range-error').hidden=true;commit();}};
  $('zoom-in').onclick=()=>applyZoom(.8);
  $('zoom-out').onclick=()=>applyZoom(1.25);
  $('reset').onclick=()=>{state=freshState();$('range-error').hidden=true;commit();};
  $('figure-viewport').addEventListener('wheel',e=>{
    if(!state.scrollZoom||!state.selected.length||Math.abs(e.deltaX)>Math.abs(e.deltaY)||e.shiftKey||e.ctrlKey)return;
    e.preventDefault();const f=Math.exp(Math.max(-.35,Math.min(.35,e.deltaY*.0015)));
    applyZoom(f);
  },{passive:false});
  $('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Comparison link copied.');}catch{window.prompt('Copy this comparison link:',location.href);}};
  $('svg').onclick=()=>exportFigure('svg');$('png').onclick=()=>exportFigure('png');
  addEventListener('hashchange',()=>{state=stateFromHash(location.hash,sources.map(s=>s.id));commit();});
}
async function exportFigure(format){
  const live=$('figure').querySelector('svg');if(!live)return;
  const button=$(format);button.disabled=true;const label=button.textContent;button.textContent='Preparing…';
  let url;
  try{
    const clone=live.cloneNode(true);
    for(const image of clone.querySelectorAll('image')){
      const path=image.getAttribute('href');
      if(!imageData.has(path))imageData.set(path,await fetch(path).then(r=>{if(!r.ok)throw Error('Image unavailable');return r.blob();}).then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);})));
      image.setAttribute('href',imageData.get(path));
    }
    const metadata=document.createElementNS('http://www.w3.org/2000/svg','metadata');
    metadata.textContent=JSON.stringify({title:document.title,url:location.href,definition:'R_G = GM/c^2; physical mode in parsecs, converted using each source mass',settings:state,sources:selected()});clone.prepend(metadata);
    const svg=new XMLSerializer().serializeToString(clone),blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
    let download=blob;
    if(format==='png'){
      url=URL.createObjectURL(blob);const img=new Image();img.src=url;await img.decode();
      const canvas=document.createElement('canvas'),width=Number(clone.getAttribute('width')),height=Number(clone.getAttribute('height'));
      canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
      download=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not render PNG')),'image/png'));
    }
    const target=URL.createObjectURL(download),a=document.createElement('a');a.href=target;a.download=`jet-atlas-${state.units}-${state.projection}-${state.theme}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(target),30000);toast(`${format.toUpperCase()} downloaded.`);
  }catch(error){console.error(error);toast('Export failed. Please try again.');}
  finally{if(url)URL.revokeObjectURL(url);button.disabled=false;button.textContent=label;}
}
async function init(){
  try{
    const response=await fetch('sources.json?v=11');if(!response.ok)throw Error('Could not load source catalogue');
    sources=(await response.json()).sources;
    document.querySelector('.edition').textContent=`01 / ${sources.length} VIEWS`;
    const objectCount=new Set(sources.map(s=>s.objectId||s.id)).size;
    document.querySelector('.lede').textContent=`Real radio images. ${sources.length} views of ${objectCount} black holes. Compare gravitational radii or physical size.`;
    state=stateFromHash(location.hash,sources.map(s=>s.id));
    // Preload every selected image before allowing an export.
    await Promise.all(sources.map(s=>{const image=new Image();image.src=s.image;return image.decode().catch(error=>{throw Error('Could not load image for '+s.name+' ('+s.image+')',{cause:error});});}));
    bind();commit();
  }catch(error){console.error(error);$('figure').innerHTML='<div class="empty"><strong>The atlas could not load.</strong><p>Refresh the page to try again.</p></div>';}
}
init();
