/* Print layout owns its map, images and event listeners. Never attach the live map's
   editing/save handlers here. The only app reads happen in openAbearcMapPrint. */
(function(root) {
  const papers = { A4:[210,297], A3:[297,420], Letter:[215.9,279.4], Legal:[215.9,355.6], 'Long Bond':[215.9,330.2] };
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const inside = (p,w,h) => p.x>=0 && p.y>=0 && p.x<=w && p.y<=h;
  const overlap = (a,b) => Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  function edge(a,r) {
    const p={x:clamp(a.x,r.x,r.x+r.w),y:clamp(a.y,r.y,r.y+r.h)};
    if (a.x>r.x && a.x<r.x+r.w && a.y>r.y && a.y<r.y+r.h) {
      const d=[a.x-r.x,r.x+r.w-a.x,a.y-r.y,r.y+r.h-a.y];
      const i=d.indexOf(Math.min(...d));
      if(i<2) p.x=i?r.x+r.w:r.x; else p.y=i===2?r.y:r.y+r.h;
    }
    return p;
  }
  function crosses(a,b,c,d) {
    const side=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    return side(a,b,c)*side(a,b,d)<0 && side(c,d,a)*side(c,d,b)<0;
  }
  function place(anchor,w,h,width,height,obstacles,lines) {
    let best,score=Infinity;
    // ponytail: bounded greedy placement; crowded pages can still overlap. A spatial
    // index is the next step if layouts with thousands of thumbnails are needed.
    for(let radius=45;radius<Math.max(width,height)*1.5;radius+=45) {
      for(let angle=0;angle<16;angle++) {
        const t=angle*Math.PI/8;
        const r={x:clamp(anchor.x+Math.cos(t)*radius-w/2,0,width-w),y:clamp(anchor.y+Math.sin(t)*radius-h/2,0,height-h),w,h};
        const end=edge(anchor,r);
        const cost=obstacles.reduce((n,o)=>n+overlap(r,o)*(o.weight||100),0)
          +lines.reduce((n,l)=>n+(crosses(anchor,end,l[0],l[1])?1000:0),0)+Math.hypot(end.x-anchor.x,end.y-anchor.y);
        if(cost<score) {score=cost;best=r;}
      }
      if(score<radius+45) break;
    }
    return best;
  }
  function snap(r,others,anchor,width,height,bypass=false) {
    const guides=[];
    if(bypass) return {rect:r,guides};
    for(const axis of ['x','y']) {
      const size=axis==='x'?'w':'h',limit=axis==='x'?width:height;
      const targets=[0,limit/2,limit,anchor[axis],...others.flatMap(o=>[o[axis],o[axis]+o[size]/2,o[axis]+o[size]])];
      let delta=8,target=null;
      for(const value of targets) for(const own of [r[axis],r[axis]+r[size]/2,r[axis]+r[size]]) {
        if(Math.abs(value-own)<Math.abs(delta)) {delta=value-own;target=value;}
      }
      if(target!==null) {r[axis]=clamp(r[axis]+delta,0,limit-r[size]);guides.push({axis,value:target});}
    }
    return {rect:r,guides};
  }
  const api={papers,edge,place,snap,crosses,overlap};
  if(typeof module==='object' && module.exports) {module.exports=api;return;}
  let session=null;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const text=value=>String(value??'');
  function plain(html) { const el=document.createElement('div');el.innerHTML=html;return el.textContent.trim(); }
  function snapshotOverlays(map) {
    const svgs=[document.getElementById('abearcMapMeasureLayer'),document.querySelector('[data-map-ram-pump-layer]')].filter(Boolean);
    if(!svgs.length) return [];
    const guides=document.querySelector('[data-map-annotation-guide-layer]');
    const shapes=[...(guides?.querySelectorAll('line') || []),...svgs.flatMap(svg=>[...svg.querySelectorAll('polyline,polygon,line,path,circle,text,rect')])];
    return shapes.filter(el=>!el.classList.contains('abearc-map-measure-hit')&&!el.classList.contains('abearc-ram-route-hit')&&!el.classList.contains('abearc-ram-route-vertex')).map(el=>{
      const style=getComputedStyle(el),tag=el.tagName.toLowerCase(),matrix=el.getCTM();
      const n=name=>Number(el.getAttribute(name)||0);
      let points=[];
      if(tag==='polyline'||tag==='polygon') points=[...el.points].map(p=>[p.x,p.y]);
      if(tag==='path') { const values=(el.getAttribute('d').match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);for(let i=0;i<values.length;i+=2) points.push([values[i],values[i+1]]); }
      if(tag==='line') points=[[n('x1'),n('y1')],[n('x2'),n('y2')]];
      if(tag==='circle') points=[[n('cx'),n('cy')]];
      if(tag==='text'||tag==='rect') points=[[n('x'),n('y')]];
      return {tag,points:points.map(p=>{const q=new DOMPoint(...p).matrixTransform(matrix);return map.unproject([q.x,q.y]).toArray();}),fill:style.fill,stroke:style.stroke,lineWidth:parseFloat(style.strokeWidth)||1,font:style.font,text:el.textContent,r:n('r'),w:n('width'),h:n('height'),align:el.getAttribute('text-anchor'),baseline:el.getAttribute('dominant-baseline')};
    });
  }
  root.openAbearcMapPrint=async function(options={}) {
    if(session || !abearcMap || !currentUser || !hasPrivilege('view_abearc_map')) return;
    if(!abearcMap.isStyleLoaded()) return toast('Wait for the map layers to finish loading before opening Print Mode.','error');
    const original=abearcMap;
    const printablePhotos=abearcMapPhotosVisible
      ? abearcMapScopedFeatures().filter(feature=>!abearcMapSessionHiddenPhotoIds.has(Number(abearcFeatureId(feature))))
      : [];
    const snapshot={style:copy(original.getStyle()),camera:{center:original.getCenter().toArray(),zoom:original.getZoom(),bearing:original.getBearing(),pitch:original.getPitch()},
      photos:copy(printablePhotos),overlays:snapshotOverlays(original),photoLayout:{
        moved:Object.fromEntries([...abearcMapMovedPhotoPositions].map(([id,position])=>[String(id),position])),
        expanded:Object.fromEntries([...abearcMapExpandedPhotos].map(([id,size])=>[String(id),size]))
      }};
    // DOM photo markers replace these invisible clustering layers in the composer.
    snapshot.style.layers=snapshot.style.layers.filter(l=>l.source!=='abearc-map-media');
    delete snapshot.style.sources['abearc-map-media'];
    const s=session={snapshot,photos:[],overlays:snapshot.overlays,raf:0,urls:new Set(),abort:new AbortController(),closed:false,busy:false,loading:true,selected:null,guides:[],errors:new Set(),margin:32};
    s.focus=document.activeElement;
    const el=s.el=document.createElement('section');el.className='map-print';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Map Print Mode');
    el.innerHTML=`<header><strong>Map Print Mode</strong><button data-action="settings" aria-expanded="true">Settings</button><button data-action="undo" disabled title="Undo print layout change (Ctrl+Z)">Undo</button><button data-export="png" disabled>Export PNG</button><button data-export="pdf" disabled>Export PDF</button><button data-export="print" disabled>Print</button><button data-action="close">Close</button></header>
      <div class="map-print-main"><aside>
      <h3>Page setup</h3>
      <label>Paper<select name="paper">${Object.keys(papers).map(p=>`<option>${p}</option>`).join('')}</select></label>
      <label>Orientation<select name="orientation"><option>Portrait</option><option>Landscape</option></select></label>
      <label>Resolution<select name="dpi"><option>96</option><option>150</option><option selected>300</option></select></label>
      <label>Page margin (mm)<input name="margin" type="number" min="0" max="30" step="0.5" value="8.5"></label>
      <p data-page-summary></p>
      <h3>Map elements</h3>
      <label>Map title<input name="title" maxlength="160" value="ABEARC Geotag Map"></label>
      <label><input type="checkbox" name="north" checked> North arrow</label><label><input type="checkbox" name="scale" checked> Scale bar</label><label><input type="checkbox" name="legend" checked> Legend</label>
      <h3>Composition</h3>
      <button data-action="reset-view">Reset original view</button><button data-action="fit">Fit photos</button><button data-action="auto">Arrange photos / restore hidden</button>
      <details><summary>Layers (print only)</summary><div data-layers></div></details>
      <details open><summary>Photo layout</summary><p>Drag a photo to move it. Select it to resize using corner handles. Right-click or long-press for actions. Alt bypasses snapping. Escape cancels; Enter confirms.</p><label>Selected photo<select name="photo"><option value="">Choose a photo</option></select></label><button data-action="photo-menu">Photo actions</button></details>
      <p>Layout changes are temporary. Photo GPS anchors stay fixed. Surface and scale estimates depend on the source data.</p>
      </aside><div class="map-print-work"><div class="map-print-page-wrap"><div class="map-print-page"><div class="map-print-map"></div><canvas class="map-print-overlay"></canvas><div class="map-print-hits"></div></div></div></div></div>
      <div class="map-print-status" role="status" aria-live="polite">Loading the copied map and photo thumbnails…</div><div class="map-print-menu" role="menu" hidden></div><div class="map-print-viewer" role="dialog" aria-label="Photo preview" hidden></div>`;
    document.body.append(el);
    const requestedTitle=text(options?.title || '').trim();
    if(requestedTitle) el.querySelector('[name=title]').value=requestedTitle.slice(0,160);
    // Prevent keyboard navigation into the underlying live workspace.
    s.siblings=[...document.body.children].filter(n=>n!==el && n instanceof HTMLElement).map(n=>[n,n.inert]);s.siblings.forEach(([n])=>n.inert=true);
    s.page=el.querySelector('.map-print-page');s.canvas=el.querySelector('canvas');s.hits=el.querySelector('.map-print-hits');s.status=el.querySelector('[role=status]');s.menu=el.querySelector('.map-print-menu');
    dimensions(s);
    s.map=new maplibregl.Map({container:el.querySelector('.map-print-map'),style:snapshot.style,...snapshot.camera,attributionControl:false,pixelRatio:Math.min(devicePixelRatio,2),canvasContextAttributes:{preserveDrawingBuffer:true}});
    s.map.on('error',e=>{s.errors.add(e.sourceId||'map resource');s.status.textContent='A map resource failed to load. Export is blocked; close and reopen after the source is available.';});
    s.map.on('move',()=>schedule(s));s.map.on('moveend',()=>{if(!s.restoring){arrange(s);commitEdit(s);}schedule(s);});
    const on=(node,event,fn)=>node.addEventListener(event,fn,{signal:s.abort.signal});
    on(el,'click',e=>handleClick(s,e));on(el,'change',e=>handleChange(s,e));on(el,'input',e=>{if(e.target.name==='title') schedule(s);});
    on(s.hits,'pointerdown',e=>startDrag(s,e));on(s.hits,'contextmenu',e=>{const p=findPhoto(s,e.target);if(p){e.preventDefault();select(s,p);menu(s,e.clientX,e.clientY);}});
    on(document,'keydown',e=>keyboard(s,e));
    s.resize=new ResizeObserver(()=>fitPage(s));s.resize.observe(el.querySelector('.map-print-work'));
    s.observer=new MutationObserver(()=>{if(!currentUser || document.getElementById('mapPage')?.classList.contains('hidden')) close(s);});s.observer.observe(document.getElementById('mapPage'),{attributes:true,attributeFilter:['class']});
    on(window,'pagehide',()=>close(s));
    el.querySelector('[data-action=close]').focus();
    try {
      await Promise.all([ready(s),loadPhotos(s)]);
      if(s.closed) return;
      s.loading=false;buildLayers(s);arrange(s);schedule(s);
      s.el.querySelectorAll('[data-export]').forEach(button=>button.disabled=false);
      const failed=s.photos.filter(p=>p.failed).length;
      s.status.textContent=`${s.photos.length} authorized photos copied${failed ? ` · ${failed} thumbnails failed; hide them before export` : ''}. Pan or zoom to compose the page. Only photos whose GPS anchors are on the page are printed.`;
      s.undo=[];s.lastEdit=captureEdit(s);
    } catch(error) {if(!s.closed)s.status.textContent=error.message;}
  };
  function value(s,name) {return s.el.querySelector(`[name="${name}"]`).value;}
  function captureEdit(s) {
    return {camera:{center:s.map.getCenter().toArray(),zoom:s.map.getZoom(),bearing:s.map.getBearing(),pitch:s.map.getPitch()},
      photos:s.photos.map(p=>({dx:p.dx,dy:p.dy,w:p.w,h:p.h,hidden:p.hidden})),
      controls:[...s.el.querySelectorAll('input,select')].filter(n=>n.name!=='photo').map(n=>({value:n.value,checked:n.checked}))};
  }
  function commitEdit(s) {
    if(!s.lastEdit||s.loading||s.restoring)return;
    const next=captureEdit(s);
    if(JSON.stringify(next)===JSON.stringify(s.lastEdit))return;
    s.undo.push(s.lastEdit);if(s.undo.length>50)s.undo.shift();s.lastEdit=next;
    s.el.querySelector('[data-action=undo]').disabled=false;
  }
  function undoEdit(s) {
    commitEdit(s);
    const state=s.undo?.pop();if(!state)return;
    s.restoring=true;
    try {
      finish(s);
      [...s.el.querySelectorAll('input,select')].filter(n=>n.name!=='photo').forEach((n,i)=>{
        n.value=state.controls[i].value;n.checked=state.controls[i].checked;
        if(n.dataset.layer){if(n.dataset.opacity)s.map.setPaintProperty(n.dataset.layer,n.dataset.opacity,Number(n.value));else s.map.setLayoutProperty(n.dataset.layer,'visibility',n.checked?'visible':'none');}
      });
      dimensions(s);s.map.jumpTo(state.camera);state.photos.forEach((p,i)=>Object.assign(s.photos[i],p));
      s.lastEdit=captureEdit(s);schedule(s);
    }finally{s.restoring=false;s.el.querySelector('[data-action=undo]').disabled=!s.undo.length;}
  }
  function checked(s,name) {return s.el.querySelector(`[name="${name}"]`).checked;}
  function dimensions(s) {
    s.margin=clamp(Number(value(s,'margin')) || 0,0,30)*96/25.4;
    s.mm=[...papers[value(s,'paper')]];if(value(s,'orientation')==='Landscape')s.mm.reverse();
    s.pw=s.mm[0]*96/25.4;s.ph=s.mm[1]*96/25.4;s.w=s.pw-2*s.margin;s.h=s.ph-2*s.margin;
    Object.assign(s.page.style,{width:s.pw+'px',height:s.ph+'px'});
    for(const node of s.page.children) Object.assign(node.style,{left:s.margin+'px',top:s.margin+'px',width:s.w+'px',height:s.h+'px'});
    s.map?.resize();fitPage(s);
    const dpi=Number(value(s,'dpi'));
    s.el.querySelector('[data-page-summary]').textContent=`${s.mm[0]} × ${s.mm[1]} mm · ${Math.round(s.mm[0]*dpi/25.4)} × ${Math.round(s.mm[1]*dpi/25.4)} px at ${dpi} DPI`;
  }
  function fitPage(s) {
    const work=s.el.querySelector('.map-print-work'),wrap=s.el.querySelector('.map-print-page-wrap');
    s.factor=Math.max(.15,Math.min(1,(work.clientWidth-44)/s.pw,(work.clientHeight-44)/s.ph));
    s.page.style.transform=`scale(${s.factor})`;wrap.style.width=s.pw*s.factor+'px';wrap.style.height=s.ph*s.factor+'px';
  }
  function ready(s) {
    return new Promise((resolve,reject)=>{
      let timer;
      const done=()=>{clearTimeout(timer);s.map.off('idle',idle);s.abort.signal.removeEventListener('abort',cancel);};
      const idle=()=>{done();s.errors.size?reject(new Error('Map resources failed to load. Close and reopen Print Mode to retry.')):resolve();};
      const cancel=()=>{done();reject(new Error('Print Mode closed.'));};
      timer=setTimeout(()=>{done();reject(new Error('Map loading timed out. Check the layer sources, then retry.'));},45000);
      s.abort.signal.addEventListener('abort',cancel,{once:true});s.map.on('idle',idle);
      if(s.map.loaded() && s.map.areTilesLoaded()) idle();else s.map.triggerRepaint();
    });
  }
  async function loadPhotos(s) {
    const choices=s.el.querySelector('[name=photo]');
    const features=s.snapshot.photos.filter(f=>f.geometry?.type==='Point' && f.geometry.coordinates.slice(0,2).every(Number.isFinite));
    let cursor=0,completed=0;
    const load=async(f,index)=>{
      const p={id:String(index),feature:f,anchor:Object.freeze([...f.geometry.coordinates]),hidden:false,dx:null,dy:null,w:72,h:72};
      const url=f.properties?.thumbnail_url;
      if(url) {
        p.image=new Image();p.image.crossOrigin='anonymous';
        await new Promise(resolve=>{let timer;const finish=()=>{clearTimeout(timer);resolve();};p.image.onload=finish;p.image.onerror=()=>{p.failed=true;finish();};timer=setTimeout(()=>{p.failed=true;finish();},30000);p.image.src=abearcAuthenticatedMediaUrl(url);s.abort.signal.addEventListener('abort',()=>{p.image.src='';finish();},{once:true});});
        if(p.image.naturalWidth) {p.ratio=p.image.naturalWidth/p.image.naturalHeight;p.w=p.ratio>=1?72:72*p.ratio;p.h=p.ratio>=1?72/p.ratio:72;}
      }
      p.ratio=p.ratio||1;
      const appPhotoId=String(Number(abearcFeatureId(f)));
      const savedSize=s.snapshot.photoLayout?.expanded?.[appPhotoId];
      if(savedSize){p.w=clamp(Number(savedSize.width)||p.w,48,720);p.h=clamp(Number(savedSize.height)||p.h,48,720);}
      p.defaultSize={w:p.w,h:p.h};
      const savedPosition=s.snapshot.photoLayout?.moved?.[appPhotoId];
      if(Array.isArray(savedPosition)&&savedPosition.length>=2&&savedPosition.every(Number.isFinite)){
        const origin=s.map.project(p.anchor),moved=s.map.project(savedPosition);p.dx=moved.x-origin.x;p.dy=moved.y-origin.y;
      }
      if(s.closed)return;
      p.node=document.createElement('button');p.node.className='map-print-photo';p.node.dataset.photo=p.id;p.node.setAttribute('aria-label',f.properties?.category||`Photo ${index+1}`);
      p.node.innerHTML=['nw','ne','sw','se'].map(c=>`<i data-corner="${c}"></i>`).join('');s.hits.append(p.node);s.photos.push(p);
      const option=document.createElement('option');option.value=p.id;option.textContent=p.node.getAttribute('aria-label');choices.append(option);
      completed++;s.status.textContent=`Loading thumbnails: ${completed} / ${features.length}…`;
    };
    const worker=async()=>{while(cursor<features.length&&!s.closed){const index=cursor++;await load(features[index],index);}};
    await Promise.all(Array.from({length:Math.min(6,features.length)},worker));
    s.photos.sort((a,b)=>Number(a.id)-Number(b.id));
  }
  function buildLayers(s) {
    const layers=s.el.querySelector('[data-layers]');
    s.snapshot.style.layers.forEach(layer=>{
      const row=document.createElement('div');row.className='map-print-layer';
      const label=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=layer.layout?.visibility!=='none';toggle.dataset.layer=layer.id;
      label.append(toggle,document.createTextNode(' '+layer.id.replace(/^abearc-/,'').replace(/-/g,' ')));row.append(label);
      const opacity={raster:'raster-opacity',fill:'fill-opacity',line:'line-opacity',circle:'circle-opacity',symbol:'text-opacity',background:'background-opacity'}[layer.type];
      if(opacity) {const range=document.createElement('input');range.type='range';range.min=0;range.max=1;range.step=.05;range.value=typeof layer.paint?.[opacity]==='number'?layer.paint[opacity]:1;range.dataset.opacity=opacity;range.dataset.layer=layer.id;range.setAttribute('aria-label',layer.id+' print opacity');row.append(range);}
      layers.append(row);
    });
  }
  function photoRect(s,p) {const a=s.map.project(p.anchor);return {x:clamp(a.x+(p.dx||0),0,s.w-p.w),y:clamp(a.y+(p.dy||0),0,s.h-p.h),w:p.w,h:p.h};}
  function visible(s,p) {return !p.hidden && inside(s.map.project(p.anchor),s.w,s.h);}
  function blockRects(s) {
    const out=[{x:0,y:s.h-52,w:s.w,h:52,weight:1000}];
    if(value(s,'title'))out.push({x:0,y:0,w:s.w-75,h:56,weight:1000});
    if(checked(s,'north'))out.push({x:s.w-65,y:0,w:65,h:80,weight:1000});
    if(checked(s,'legend'))out.push({x:8,y:s.h-80-legendLines(s).length*15,w:245,h:legendLines(s).length*15+24,weight:1000});
    if(checked(s,'scale'))out.push({x:s.w-215,y:s.h-120,w:205,h:64,weight:1000});
    return out;
  }
  function arrange(s,reset=false) {
    if(!s.map?.isStyleLoaded()||s.busy)return;
    const obstacles=blockRects(s),lines=[];
    // Capture vector labels and sample route/boundary segments once, never per drag.
    // Raster tile labels have no separate geometry available for collision tests.
    const addPath=(coords,label=false)=>{
      const points=coords.map(c=>s.map.project(c));
      points.forEach((p,i)=>{
        if(inside(p,s.w,s.h))obstacles.push({x:p.x-(label?50:8),y:p.y-10,w:label?100:16,h:20,weight:15});
        if(i){const a=points[i-1],steps=Math.min(100,Math.ceil(Math.hypot(p.x-a.x,p.y-a.y)/18));for(let j=1;j<steps;j++){const x=a.x+(p.x-a.x)*j/steps,y=a.y+(p.y-a.y)*j/steps;if(inside({x,y},s.w,s.h))obstacles.push({x:x-6,y:y-6,w:12,h:12,weight:10});}}
      });
    };
    for(const f of s.map.queryRenderedFeatures()) {
      const walk=coords=>{if(typeof coords?.[0]==='number')addPath([coords],f.layer?.type==='symbol');else if(typeof coords?.[0]?.[0]==='number')addPath(coords);else if(Array.isArray(coords))coords.forEach(walk);};
      walk(f.geometry?.coordinates);
    }
    for(const o of s.overlays)addPath(o.points,o.tag==='text');
    for(const p of s.photos) {
      if(reset){p.dx=null;p.hidden=false;Object.assign(p,p.defaultSize);}
      if(!visible(s,p))continue;
      const a=s.map.project(p.anchor);
      if(p.dx===null){const r=place(a,p.w,p.h,s.w,s.h,obstacles,lines);p.dx=r.x-a.x;p.dy=r.y-a.y;}
      const r=photoRect(s,p);obstacles.push(r);lines.push([a,edge(a,r)]);
    }
  }
  function legendLines(s) {
    const sources=new Set(visibleLayers(s).filter(l=>(!l.minzoom||s.map.getZoom()>=l.minzoom) && (!l.maxzoom||s.map.getZoom()<l.maxzoom)).map(l=>l.source));
    const lines=[...sources].filter(id=>id && s.snapshot.style.sources[id]?.data?.features?.length!==0).map(id=>id.replace(/^abearc-/,'').replace(/-/g,' '));
    if(sources.has('abearc-noah-flood-100yr'))lines.push('Low: 0–0.5 m; medium: >0.5–1.5 m','High: >1.5 m (velocity can raise category)');
    if(s.photos.some(p=>visible(s,p)))lines.push('● Photo GPS anchor — thumbnail leader');
    if(s.overlays.length)lines.push('Measurements / terrain annotations');
    return lines;
  }
  function visibleLayers(s) {return s.snapshot.style.layers.filter(l=>s.map.getLayer(l.id)&&s.map.getLayoutProperty(l.id,'visibility')!=='none');}
  function schedule(s) {if(s.closed||s.raf)return;s.raf=requestAnimationFrame(()=>{s.raf=0;render(s);});}
  function render(s) {
    if(!s.map||s.closed)return;
    const ratio=Math.min(devicePixelRatio,2);s.canvas.width=Math.round(s.w*ratio);s.canvas.height=Math.round(s.h*ratio);
    const ctx=s.canvas.getContext('2d');ctx.scale(ratio,ratio);draw(s,ctx);
    for(const p of s.photos) {p.node.hidden=!visible(s,p);const r=photoRect(s,p);Object.assign(p.node.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});p.node.classList.toggle('is-selected',s.selected===p);}
    ctx.strokeStyle='#1683ff';ctx.lineWidth=1;ctx.setLineDash([5,4]);
    for(const g of s.guides){ctx.beginPath();g.axis==='x'?(ctx.moveTo(g.value,0),ctx.lineTo(g.value,s.h)):(ctx.moveTo(0,g.value),ctx.lineTo(s.w,g.value));ctx.stroke();}
  }
  function wrap(ctx,str,x,y,max,lineHeight=14) {
    let line='';for(const word of text(str).split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>max&&line){ctx.fillText(line,x,y);y+=lineHeight;line=word;}else line=next;}ctx.fillText(line,x,y);return y+lineHeight;
  }
  function draw(s,ctx) {
    ctx.save();ctx.beginPath();ctx.rect(0,0,s.w,s.h);ctx.clip();
    for(const o of s.overlays) {
      const pts=o.points.map(p=>s.map.project(p));if(!pts.length)continue;
      ctx.save();ctx.strokeStyle=o.stroke;ctx.fillStyle=o.fill;ctx.lineWidth=o.lineWidth;ctx.beginPath();
      if(o.tag==='text'){ctx.font=o.font;ctx.textAlign=o.align==='middle'?'center':o.align==='end'?'right':'left';if(o.baseline==='central')ctx.textBaseline='middle';if(o.stroke!=='none')ctx.strokeText(o.text,pts[0].x,pts[0].y);ctx.fillText(o.text,pts[0].x,pts[0].y);}
      else {
        if(o.tag==='circle')ctx.arc(pts[0].x,pts[0].y,o.r,0,2*Math.PI);
        else if(o.tag==='rect')ctx.rect(pts[0].x,pts[0].y,o.w,o.h);
        else {pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(o.tag==='polygon')ctx.closePath();}
        if(o.fill!=='none')ctx.fill();if(o.stroke!=='none')ctx.stroke();
      }
      ctx.restore();
    }
    const photos=s.photos.filter(p=>visible(s,p));ctx.strokeStyle='#0e7490';ctx.lineWidth=1.5;
    for(const p of photos){const a=s.map.project(p.anchor),r=photoRect(s,p),b=edge(a,r);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#0e7490';ctx.beginPath();ctx.arc(a.x,a.y,3.5,0,Math.PI*2);ctx.fill();}
    for(const p of photos) {
      const r=photoRect(s,p);ctx.fillStyle='white';ctx.fillRect(r.x-2,r.y-2,r.w+4,r.h+4);
      if(p.image?.naturalWidth&&!p.failed)ctx.drawImage(p.image,r.x,r.y,r.w,r.h);else {ctx.fillStyle='#e2e8f0';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#334155';ctx.font='11px Arial';ctx.fillText(p.failed?'Image failed':'No image',r.x+4,r.y+r.h/2);}
      const bearing=p.feature.properties?.bearing_deg;
      if(bearing!==null && bearing!==undefined && Number.isFinite(Number(bearing))){ctx.save();ctx.translate(r.x+r.w/2,r.y+10);ctx.rotate((Number(bearing)-s.map.getBearing())*Math.PI/180);ctx.fillStyle='#fff';ctx.strokeStyle='#0e7490';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
    }
    const box=(x,y,w,h)=>{ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(x,y,w,h);ctx.fillStyle='#172b3a';};
    if(value(s,'title')){box(0,0,s.w-75,56);ctx.font='bold 20px Arial';wrap(ctx,value(s,'title'),12,25,s.w-100,22);}
    if(checked(s,'north')){box(s.w-65,0,65,80);ctx.save();ctx.translate(s.w-32,42);ctx.rotate(-s.map.getBearing()*Math.PI/180);ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.fillText('N',0,-24);ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(10,18);ctx.lineTo(0,12);ctx.lineTo(-10,18);ctx.closePath();ctx.fill();ctx.restore();}
    if(checked(s,'legend')){const lines=legendLines(s),y=s.h-80-lines.length*15;box(8,y,245,lines.length*15+24);ctx.font='bold 11px Arial';ctx.fillText('LEGEND / VISIBLE LAYERS',16,y+15);ctx.font='11px Arial';lines.forEach((line,i)=>ctx.fillText(line,16,y+31+i*15,228));}
    if(checked(s,'scale')) {
      const x=s.w-205,y=s.h-108;box(x-10,y-12,205,58);
      const a=s.map.unproject([s.w/2-50,s.h/2]),b=s.map.unproject([s.w/2+50,s.h/2]);const perPixel=a.distanceTo(b)/100;
      const raw=perPixel*130,base=10**Math.floor(Math.log10(raw)),length=[5,2,1].map(n=>n*base).find(n=>n<=raw)||base/2,pixels=length/perPixel;
      ctx.font='11px Arial';ctx.fillText(length>=1000?`${length/1000} km`:`${length} m`,x,y);ctx.strokeStyle='#172b3a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+6);ctx.lineTo(x,y+14);ctx.lineTo(x+pixels,y+14);ctx.lineTo(x+pixels,y+6);ctx.stroke();ctx.fillText(`Approx. 1:${Math.round(perPixel*96/.0254).toLocaleString()}`,x,y+32);
    }
    box(0,s.h-50,s.w,50);ctx.font='10px Arial';
    const sourceIds=new Set(visibleLayers(s).map(l=>l.source));
    const attribution=[...new Set([...sourceIds].map(id=>s.snapshot.style.sources[id]?.attribution).filter(Boolean).map(plain))].join(' | ');
    wrap(ctx,attribution||'ABEARC map data',8,s.h-35,s.w-16,12);
    ctx.fillText(`ABEARC • ${new Date().toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})} • WGS 84 / Web Mercator`,8,s.h-8);
    ctx.restore();
  }
  function findPhoto(s,node){return s.photos.find(p=>p.id===node.closest('[data-photo]')?.dataset.photo);}
  function select(s,p) {
    if(s.selected!==p) {finish(s);s.selected=p;s.before={dx:p.dx,dy:p.dy,w:p.w,h:p.h,hidden:p.hidden};}
    s.el.querySelector('[name=photo]').value=p.id;schedule(s);
  }
  function finish(s,cancel=false) {
    if(cancel && s.selected && s.before)Object.assign(s.selected,s.before);
    s.selected=null;s.before=null;s.guides=[];s.drag=null;clearTimeout(s.longPress);s.map?.dragPan.enable();s.menu.hidden=true;schedule(s);
  }
  function menu(s,x,y) {
    s.menu.replaceChildren();
    for(const [action,label] of [['open','Open Photo'],['details','Photo Details'],['move','Move Photo'],['resize','Resize Photo'],['reset','Reset Position and Size'],['hide','Hide from Print']]) {
      const button=document.createElement('button');button.textContent=label;button.dataset.photoAction=action;button.setAttribute('role','menuitem');s.menu.append(button);
    }
    s.menu.hidden=false;const bounds=s.menu.getBoundingClientRect();s.menu.style.left=clamp(x,4,innerWidth-bounds.width-4)+'px';s.menu.style.top=clamp(y,4,innerHeight-bounds.height-4)+'px';s.menu.firstChild.focus();
  }
  function startDrag(s,e) {
    const p=findPhoto(s,e.target);if(!p||s.busy||e.button!==0)return;
    e.preventDefault();select(s,p);s.menu.hidden=true;
    const start=photoRect(s,p),corner=e.target.dataset.corner;
    s.drag={p,start,corner,x:e.clientX,y:e.clientY};s.map.dragPan.disable();p.node.setPointerCapture(e.pointerId);
    if(e.pointerType==='touch')s.longPress=setTimeout(()=>{if(s.drag){s.drag=null;s.map.dragPan.enable();menu(s,e.clientX,e.clientY);}},550);
    const move=ev=>{
      if(!s.drag)return;
      const dx=(ev.clientX-e.clientX)/s.factor,dy=(ev.clientY-e.clientY)/s.factor;
      if(Math.hypot(dx,dy)>5)clearTimeout(s.longPress);
      const a=s.map.project(p.anchor),others=s.photos.filter(q=>q!==p&&visible(s,q)).map(q=>photoRect(s,q));
      let r={...start};
      if(corner) {
        const west=corner.includes('w'),north=corner.includes('n'),fixed={x:west?start.x+start.w:start.x,y:north?start.y+start.h:start.y};
        let width=start.w+(west?-dx:dx),height=start.h+(north?-dy:dy);
        const maxWidth=Math.min(180,180*p.ratio,west?fixed.x:s.w-fixed.x,(north?fixed.y:s.h-fixed.y)*p.ratio);
        const minWidth=Math.min(maxWidth,Math.max(48,48*p.ratio));
        width=clamp(Math.abs(dx)>Math.abs(dy)*p.ratio?width:height*p.ratio,minWidth,maxWidth);
        r={x:west?fixed.x-width:fixed.x,y:north?fixed.y-width/p.ratio:fixed.y,w:width,h:width/p.ratio};
        const snapped=snap({...r},others,a,s.w,s.h,ev.altKey);
        // Snap the dragged corner, keeping the opposite corner and image ratio fixed.
        if(snapped.guides.length) {
          const g=snapped.guides[0];const candidate=g.axis==='x'?Math.abs(g.value-fixed.x):Math.abs(g.value-fixed.y)*p.ratio;
          if(Math.abs(candidate-width)<8 && candidate>=minWidth&&candidate<=maxWidth){width=candidate;r={x:west?fixed.x-width:fixed.x,y:north?fixed.y-width/p.ratio:fixed.y,w:width,h:width/p.ratio};s.guides=[g];}else s.guides=[];
        }else s.guides=[];
      }else {
        r.x=clamp(start.x+dx,0,s.w-r.w);r.y=clamp(start.y+dy,0,s.h-r.h);
        const result=snap(r,others,a,s.w,s.h,ev.altKey);r=result.rect;s.guides=result.guides;
      }
      p.dx=r.x-a.x;p.dy=r.y-a.y;p.w=r.w;p.h=r.h;schedule(s);
    };
    const up=()=>{clearTimeout(s.longPress);s.drag=null;s.guides=[];s.map.dragPan.enable();p.node.removeEventListener('pointermove',move);p.node.removeEventListener('pointerup',up);p.node.removeEventListener('pointercancel',cancel);commitEdit(s);schedule(s);};
    const cancel=()=>{up();finish(s,true);};
    p.node.addEventListener('pointermove',move,{signal:s.abort.signal});p.node.addEventListener('pointerup',up,{signal:s.abort.signal});p.node.addEventListener('pointercancel',cancel,{signal:s.abort.signal});
  }
  function keyboard(s,e) {
    if(s.closed)return;
    if(e.key==='Escape') {e.preventDefault();if(!s.el.querySelector('.map-print-viewer').hidden)s.el.querySelector('.map-print-viewer').hidden=true;else if(s.selected)finish(s,true);else if(!s.busy)close(s);return;}
    if(e.key==='Tab'){const nodes=[...s.el.querySelectorAll('button,input,select,summary')].filter(n=>!n.disabled&&n.getClientRects().length&&!n.closest('[hidden]'));const i=nodes.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0]?.focus();}}
    if(s.busy)return;
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!e.target.closest('input:not([type="checkbox"]):not([type="range"]),textarea,[contenteditable="true"]')){e.preventDefault();e.stopPropagation();undoEdit(s);return;}
    if(e.key==='Enter'&&s.selected&&!s.menu.contains(e.target)){e.preventDefault();finish(s);}
    const p=findPhoto(s,e.target);
    if(p && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();select(s,p);const r=photoRect(s,p),a=s.map.project(p.anchor),step=e.shiftKey?10:1;r.x+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;r.y+=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;p.dx=clamp(r.x,0,s.w-r.w)-a.x;p.dy=clamp(r.y,0,s.h-r.h)-a.y;schedule(s);}
    if(p&&(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10'))){e.preventDefault();select(s,p);const r=p.node.getBoundingClientRect();menu(s,r.right,r.top);}
    if(p && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))commitEdit(s);
  }
  function handleChange(s,e) {
    if(s.busy)return;
    const t=e.target;
    if(t.dataset.layer){if(t.dataset.opacity)s.map.setPaintProperty(t.dataset.layer,t.dataset.opacity,Number(t.value));else s.map.setLayoutProperty(t.dataset.layer,'visibility',t.checked?'visible':'none');}
    if(t.name==='paper'||t.name==='orientation'||t.name==='margin'){finish(s);dimensions(s);arrange(s);}
    if(t.name==='dpi')dimensions(s);
    if(t.name==='photo'){const p=s.photos.find(p=>p.id===t.value);if(p){select(s,p);p.node.focus();}}
    commitEdit(s);
    schedule(s);
  }
  function handleClick(s,e) {
    const button=e.target.closest('button'),action=button?.dataset.action,photoAction=button?.dataset.photoAction;
    if(action==='close')return close(s);
    if(s.busy)return;
    if(action==='undo')return undoEdit(s);
    if(button?.dataset.export)return exportPage(s,button.dataset.export);
    if(photoAction && s.selected){
      const p=s.selected;s.menu.hidden=true;
      if(photoAction==='hide'){p.hidden=true;finish(s);}
      if(photoAction==='reset'){p.dx=null;Object.assign(p,p.defaultSize);finish(s);arrange(s);}
      if(photoAction==='move'||photoAction==='resize'){p.node.focus();s.status.textContent=photoAction==='move'?'Drag the selected thumbnail or use arrow keys. Escape cancels; Enter confirms.':'Drag a corner handle to resize. Escape cancels; Enter confirms.';}
      if(photoAction==='open'||photoAction==='details')showPhoto(s,p,photoAction);
      commitEdit(s);return schedule(s);
    }
    if(action==='settings'){const aside=s.el.querySelector('aside');aside.hidden=!aside.hidden;button.setAttribute('aria-expanded',String(!aside.hidden));fitPage(s);}
    if(action==='reset-view'){s.map.jumpTo(s.snapshot.camera);}
    if(action==='fit'&&s.photos.length){const bounds=new maplibregl.LngLatBounds();s.photos.filter(p=>!p.hidden).forEach(p=>bounds.extend(p.anchor));if(!bounds.isEmpty())s.map.fitBounds(bounds,{padding:100,maxZoom:19,duration:0});}
    if(action==='auto'){finish(s);arrange(s,true);schedule(s);}
    if(action==='photo-menu'){if(s.selected){const b=button.getBoundingClientRect();menu(s,b.right,b.top);}else s.status.textContent='Select a thumbnail or choose a photo from the list first.';}
    if(!action&&!findPhoto(s,e.target)&&!s.menu.contains(e.target)&&!s.el.querySelector('aside').contains(e.target))finish(s);
    const p=findPhoto(s,e.target);if(p)select(s,p);
    commitEdit(s);
  }
  function showPhoto(s,p,mode) {
    const viewer=s.el.querySelector('.map-print-viewer');viewer.replaceChildren();viewer.hidden=false;
    const closeButton=document.createElement('button');closeButton.textContent='Close photo';closeButton.onclick=()=>{viewer.hidden=true;p.node.focus();};viewer.append(closeButton);
    const props=p.feature.properties||{};
    if(mode==='open') {const img=new Image();img.alt=props.category||'Geotagged photo';img.src=abearcAuthenticatedMediaUrl(props.original_url||props.thumbnail_url||'');viewer.append(img);}
    else {const pre=document.createElement('pre');pre.textContent=Object.entries(props).filter(([key])=>!/(url|token)/i.test(key)).map(([key,v])=>`${key.replace(/_/g,' ')}: ${text(v)}`).join('\n')+`\nLongitude: ${p.anchor[0]}\nLatitude: ${p.anchor[1]}`;viewer.append(pre);}
    closeButton.focus();
  }
  let pdfLibrary;
  function loadPdf() {
    if(root.PDFLib)return Promise.resolve(root.PDFLib);
    if(!pdfLibrary)pdfLibrary=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/assets/vendor/pdf-lib.min.js';script.onload=()=>resolve(root.PDFLib);script.onerror=()=>{pdfLibrary=null;script.remove();reject(new Error('PDF library could not load. Please retry.'));};document.head.append(script);});
    return pdfLibrary;
  }
  async function exportPage(s,format) {
    if(s.busy||s.closed)return;
    if(s.loading){s.status.textContent='The copied map and thumbnails are still loading. Please wait.';return;}
    finish(s);s.busy=true;s.el.classList.add('is-exporting');s.el.setAttribute('aria-busy','true');
    s.el.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);s.el.querySelector('[data-action=close]').disabled=false;
    const pixelRatio=s.map.getPixelRatio();
    try {
      s.status.textContent='Preparing full-resolution map, layers and thumbnails…';
      await ready(s);
      if(s.photos.some(p=>visible(s,p)&&p.failed))throw new Error('A visible photo could not load. Restore the connection or hide that photo from this print before exporting.');
      const dpi=Number(value(s,'dpi')),ratio=dpi/96;
      s.map.setPixelRatio(ratio);s.map.triggerRepaint();await ready(s);
      if(s.closed)return;
      const mapCanvas=s.map.getCanvas();
      if(Math.abs(mapCanvas.width-s.w*ratio)>2 || Math.abs(mapCanvas.height-s.h*ratio)>2)throw new Error('The graphics device cannot render this page at the selected resolution. Choose a lower DPI.');
      const canvas=document.createElement('canvas');canvas.width=Math.round(s.pw*ratio);canvas.height=Math.round(s.ph*ratio);
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(ratio,ratio);ctx.translate(s.margin,s.margin);ctx.drawImage(mapCanvas,0,0,s.w,s.h);draw(s,ctx);
      const png=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to encode this page. Try a lower DPI.')),'image/png'));
      if(s.closed)return;
      const filename=`ABEARC-map-${value(s,'paper').replace(/ /g,'-')}-${value(s,'orientation').toLowerCase()}`;
      if(format==='pdf') {
        s.status.textContent='Creating the PDF…';const lib=await loadPdf();const pdf=await lib.PDFDocument.create();const page=pdf.addPage(s.mm.map(mm=>mm*72/25.4));const img=await pdf.embedPng(await png.arrayBuffer());page.drawImage(img,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});const bytes=await pdf.save();if(!s.closed)save(s,new Blob([bytes],{type:'application/pdf'}),filename+'.pdf');
      }else if(format==='print') {
        const url=URL.createObjectURL(png);s.urls.add(url);
        const frame=document.createElement('iframe');frame.title='Printable map';frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;';s.el.append(frame);
        const doc=frame.contentDocument;doc.open();doc.write(`<!doctype html><html><head><style>@page{size:${s.mm[0]}mm ${s.mm[1]}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:${s.mm[0]}mm;height:${s.mm[1]}mm}</style></head><body><img alt="Printable ABEARC map" src="${url}"></body></html>`);doc.close();
        await frame.contentDocument.querySelector('img').decode();if(!s.closed){frame.contentWindow.addEventListener('afterprint',()=>{frame.remove();URL.revokeObjectURL(url);s.urls.delete(url);},{once:true});frame.contentWindow.focus();frame.contentWindow.print();}
      }else save(s,png,filename+'.png');
      if(!s.closed)s.status.textContent=`${format==='print'?'Print dialog opened':'Export ready'} · ${canvas.width} × ${canvas.height} px · ${dpi} DPI. Print at actual size to preserve the scale.`;
    }catch(error){if(!s.closed)s.status.textContent=`Export failed: ${error.message}`;}
    finally {if(!s.closed){s.map.setPixelRatio(pixelRatio);s.busy=false;s.el.classList.remove('is-exporting');s.el.removeAttribute('aria-busy');s.el.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);s.el.querySelector('[data-action=undo]').disabled=!s.undo?.length;schedule(s);}}
  }
  function save(s,blob,filename){const url=URL.createObjectURL(blob);s.urls.add(url);const a=document.createElement('a');a.href=url;a.download=filename;s.el.append(a);a.click();a.remove();}
  function close(s) {
    if(s.closed)return;s.closed=true;s.abort.abort();clearTimeout(s.longPress);cancelAnimationFrame(s.raf);s.resize?.disconnect();s.observer?.disconnect();s.map?.remove();s.urls.forEach(url=>URL.revokeObjectURL(url));s.el.remove();s.siblings.forEach(([n,inert])=>n.inert=inert);s.focus?.focus();session=null;
  }
})(typeof window!=='undefined'?window:globalThis);
