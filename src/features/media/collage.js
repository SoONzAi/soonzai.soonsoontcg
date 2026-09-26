/** V93 beta: features/media/collage. Shared dependencies are explicit on appContext. */
export function register(appContext){
function setCollectionCollageExportBusy(isBusy,label="Preparing collage…"){
    [appContext.$("collectionExportCollageBtn"),appContext.$("collectionMobileCollageBtn"),appContext.$("inventoryExportCollageBtn"),appContext.$("inventoryMobileCollageBtn")].filter(Boolean).forEach(btn=>{
      if(isBusy){
        btn.dataset.originalLabel=btn.dataset.originalLabel||btn.textContent;
        btn.disabled=true;
        btn.textContent=label;
      }else{
        btn.disabled=false;
        btn.textContent=btn.dataset.originalLabel||"⬇ Export Collage";
      }
    });
  }

function collageScopeLabel(){
    return appContext.listingAvailabilityScope==="inventory" ? "Inventory" : "Collection";
  }

function collageCardsForCurrentScope(){
    if(!["collection","inventory"].includes(appContext.listingAvailabilityScope)) return [];
    return appContext.getFiltered().filter(card=>appContext.cardMatchesListingScope(card,appContext.listingAvailabilityScope));
  }

function collageCardPriceLabel(card){
    const preferred=appContext.getPriceCurrencyPreference();
    const candidates=[
      {currency:preferred,value:appContext.cardCurrencyValue(card,preferred)},
      ...["USD","MYR","SGD"].filter(c=>c!==preferred).map(currency=>({currency,value:appContext.cardCurrencyValue(card,currency)}))
    ];
    const match=candidates.find(entry=>appContext.hasListedPrice(entry.value));
    return match ? appContext.formatCurrencyValue(match.currency, match.value) : "";
  }

function collectionCollageRoundedRect(ctx,x,y,w,h,r){
    const radius=Math.max(0,Math.min(r,Math.min(w,h)/2));
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
  }

function collectionCollageDrawImageContain(ctx,img,x,y,w,h){
    const sw=Math.max(1,img.naturalWidth||img.width||1);
    const sh=Math.max(1,img.naturalHeight||img.height||1);
    const scale=Math.min(w/sw,h/sh);
    const dw=sw*scale;
    const dh=sh*scale;
    const dx=x+(w-dw)/2;
    const dy=y+(h-dh)/2;
    ctx.drawImage(img,dx,dy,dw,dh);
  }

function collectionCollageDrawLeaf(ctx,x,y,length,angle,color){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.bezierCurveTo(length*0.18,-length*0.08,length*0.72,-length*0.34,length,0);
    ctx.bezierCurveTo(length*0.72,length*0.34,length*0.18,length*0.08,0,0);
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
    ctx.restore();
  }

function collectionCollageDrawVineCorner(ctx,width,height,corner='tl',scale=1,color='rgba(204,173,98,0.20)'){
    const pad=70*scale;
    const isLeft=corner.includes('l');
    const isTop=corner.includes('t');
    const ox=isLeft ? pad : width-pad;
    const oy=isTop ? pad : height-pad;
    const dirX=isLeft ? 1 : -1;
    const dirY=isTop ? 1 : -1;
    ctx.save();
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.strokeStyle=color;
    ctx.lineWidth=4*scale;
    ctx.beginPath();
    ctx.moveTo(ox,oy+dirY*10*scale);
    ctx.bezierCurveTo(ox+dirX*36*scale,oy+dirY*22*scale,ox+dirX*74*scale,oy+dirY*72*scale,ox+dirX*118*scale,oy+dirY*116*scale);
    ctx.bezierCurveTo(ox+dirX*150*scale,oy+dirY*150*scale,ox+dirX*182*scale,oy+dirY*170*scale,ox+dirX*230*scale,oy+dirY*180*scale);
    ctx.stroke();
    const leaves=[
      [ox+dirX*42*scale,oy+dirY*38*scale,-0.7*dirX*dirY],
      [ox+dirX*84*scale,oy+dirY*92*scale,0.22*dirX*dirY],
      [ox+dirX*138*scale,oy+dirY*146*scale,-0.45*dirX*dirY],
      [ox+dirX*186*scale,oy+dirY*170*scale,0.15*dirX*dirY]
    ];
    leaves.forEach(([lx,ly,a],idx)=>{
      const leafColor=idx%2===0 ? 'rgba(205,177,101,0.18)' : 'rgba(103,189,150,0.16)';
      appContext.collectionCollageDrawLeaf(ctx,lx,ly,20*scale,a,leafColor);
      appContext.collectionCollageDrawLeaf(ctx,lx,ly,17*scale,a+Math.PI,idx%2===0 ? 'rgba(205,177,101,0.12)' : 'rgba(103,189,150,0.11)');
    });
    ctx.restore();
  }

function collectionCollageDrawTrophy(ctx,cx,cy,size,fill='rgba(225,182,72,0.20)',stroke='rgba(244,220,145,0.45)'){
    const s=size;
    ctx.save();
    ctx.translate(cx,cy);
    ctx.lineJoin='round';
    ctx.fillStyle=fill;
    ctx.strokeStyle=stroke;
    ctx.lineWidth=Math.max(2,s*0.022);
    ctx.beginPath();
    ctx.moveTo(-s*0.28,-s*0.12);
    ctx.quadraticCurveTo(-s*0.18,s*0.14,0,s*0.18);
    ctx.quadraticCurveTo(s*0.18,s*0.14,s*0.28,-s*0.12);
    ctx.lineTo(s*0.21,-s*0.34);
    ctx.quadraticCurveTo(0,-s*0.48,-s*0.21,-s*0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s*0.20,-s*0.23);
    ctx.bezierCurveTo(-s*0.42,-s*0.28,-s*0.44,-s*0.04,-s*0.28,s*0.02);
    ctx.moveTo(s*0.20,-s*0.23);
    ctx.bezierCurveTo(s*0.42,-s*0.28,s*0.44,-s*0.04,s*0.28,s*0.02);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0,s*0.18); ctx.lineTo(0,s*0.38); ctx.stroke();
    appContext.collectionCollageRoundedRect(ctx,-s*0.16,s*0.38,s*0.32,s*0.10,s*0.03); ctx.fill(); ctx.stroke();
    appContext.collectionCollageRoundedRect(ctx,-s*0.26,s*0.49,s*0.52,s*0.08,s*0.025); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

function collectionCollageDrawCompass(ctx,cx,cy,size){
    ctx.save();
    ctx.translate(cx,cy);
    ctx.strokeStyle='rgba(222,193,122,0.22)';
    ctx.fillStyle='rgba(222,193,122,0.08)';
    ctx.lineWidth=Math.max(2,size*0.015);
    ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,size*0.7,0,Math.PI*2); ctx.stroke();
    for(let i=0;i<8;i++){
      ctx.save(); ctx.rotate((Math.PI/4)*i);
      ctx.beginPath();
      ctx.moveTo(0,-size*0.92); ctx.lineTo(size*0.10,0); ctx.lineTo(0,size*0.32); ctx.lineTo(-size*0.10,0);
      ctx.closePath();
      ctx.fillStyle=i%2===0 ? 'rgba(222,193,122,0.18)' : 'rgba(103,189,150,0.10)';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

function collectionCollageDrawArch(ctx,cx,baseY,w,h,stroke='rgba(255,255,255,0.06)'){
    ctx.save();
    ctx.translate(cx,baseY-h);
    ctx.strokeStyle=stroke;
    ctx.lineWidth=Math.max(2,w*0.01);
    ctx.beginPath();
    ctx.moveTo(-w/2,h);
    ctx.lineTo(-w/2,h*0.42);
    ctx.quadraticCurveTo(-w/2,0,0,0);
    ctx.quadraticCurveTo(w/2,0,w/2,h*0.42);
    ctx.lineTo(w/2,h);
    ctx.stroke();
    ctx.restore();
  }

function collectionCollageDrawThemeBackground(ctx,width,height,settings={}){
    const theme=String(settings.background||'geometric');

    if(theme==='aurora'){
      const auraA=ctx.createRadialGradient(width*.22,height*.18,20,width*.22,height*.18,width*.62);
      auraA.addColorStop(0,'rgba(88,205,190,.24)');
      auraA.addColorStop(.42,'rgba(74,118,210,.10)');
      auraA.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=auraA; ctx.fillRect(0,0,width,height);
      const auraB=ctx.createRadialGradient(width*.82,height*.72,20,width*.82,height*.72,width*.58);
      auraB.addColorStop(0,'rgba(220,159,72,.20)');
      auraB.addColorStop(.45,'rgba(142,78,180,.08)');
      auraB.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=auraB; ctx.fillRect(0,0,width,height);
      return;
    }

    if(theme==='minimal'){
      ctx.save();
      ctx.strokeStyle='rgba(255,255,255,0.035)';
      ctx.lineWidth=1;
      for(let y=0; y<=height; y+=260){
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if(theme==='geometric'){
      ctx.save();
      const ribbonGradA=ctx.createLinearGradient(0,0,780,0);
      ribbonGradA.addColorStop(0,'rgba(236,192,87,0.20)');
      ribbonGradA.addColorStop(0.55,'rgba(236,192,87,0.06)');
      ribbonGradA.addColorStop(1,'rgba(236,192,87,0)');
      ctx.translate(width*0.18,height*0.17); ctx.rotate(-0.20);
      appContext.collectionCollageRoundedRect(ctx,-390,-92,980,184,48); ctx.fillStyle=ribbonGradA; ctx.fill();
      ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.stroke();
      ctx.restore();

      ctx.save();
      const ribbonGradB=ctx.createLinearGradient(0,0,820,0);
      ribbonGradB.addColorStop(0,'rgba(74,203,184,0.16)');
      ribbonGradB.addColorStop(0.48,'rgba(102,132,255,0.08)');
      ribbonGradB.addColorStop(1,'rgba(102,132,255,0)');
      ctx.translate(width*0.84,height*0.80); ctx.rotate(0.24);
      appContext.collectionCollageRoundedRect(ctx,-420,-90,1040,180,48); ctx.fillStyle=ribbonGradB; ctx.fill();
      ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,0.045)'; ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.lineWidth=4; ctx.strokeStyle='rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.arc(width*0.89,height*0.18,210,0,Math.PI*2); ctx.stroke();
      ctx.lineWidth=2; ctx.strokeStyle='rgba(236,192,87,0.16)';
      ctx.beginPath(); ctx.arc(width*0.89,height*0.18,268,0,Math.PI*2); ctx.stroke();
      ctx.lineWidth=3; ctx.strokeStyle='rgba(74,203,184,0.12)';
      ctx.beginPath(); ctx.arc(width*0.12,height*0.79,186,0,Math.PI*2); ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(width*0.11,height*0.27); ctx.rotate(Math.PI/6);
      ctx.strokeStyle='rgba(236,192,87,0.18)'; ctx.lineWidth=3; ctx.beginPath();
      for(let i=0;i<6;i++){
        const angle=(Math.PI/3)*i; const px=Math.cos(angle)*92; const py=Math.sin(angle)*92;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath(); ctx.stroke(); ctx.restore();

      ctx.save(); ctx.translate(width*0.83,height*0.41); ctx.rotate(Math.PI/4);
      ctx.strokeStyle='rgba(102,132,255,0.16)'; ctx.lineWidth=3; ctx.strokeRect(-74,-74,148,148); ctx.restore();

      ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.035)'; ctx.lineWidth=1;
      for(let x=0; x<=width; x+=220){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
      for(let y=0; y<=height; y+=220){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }
      ctx.restore();

      ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=2;
      const networkPoints=[[width*0.16,height*0.59],[width*0.23,height*0.53],[width*0.29,height*0.60],[width*0.34,height*0.51],[width*0.73,height*0.16],[width*0.79,height*0.22],[width*0.86,height*0.19],[width*0.91,height*0.27]];
      [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[5,7]].forEach(([a,b])=>{ ctx.beginPath(); ctx.moveTo(networkPoints[a][0],networkPoints[a][1]); ctx.lineTo(networkPoints[b][0],networkPoints[b][1]); ctx.stroke(); });
      networkPoints.forEach((pt,index)=>{ ctx.beginPath(); ctx.fillStyle=index<4 ? 'rgba(74,203,184,0.28)' : 'rgba(236,192,87,0.24)'; ctx.arc(pt[0],pt[1],5,0,Math.PI*2); ctx.fill(); });
      ctx.restore();

      ctx.save();
      const ghostCards=[{x:width*0.045,y:height*0.08,w:170,h:246,rot:-0.10,stroke:'rgba(255,255,255,0.05)'},{x:width*0.91,y:height*0.62,w:184,h:262,rot:0.13,stroke:'rgba(236,192,87,0.07)'},{x:width*0.86,y:height*0.075,w:146,h:214,rot:0.08,stroke:'rgba(74,203,184,0.06)'}];
      ghostCards.forEach(shape=>{ ctx.save(); ctx.translate(shape.x,shape.y); ctx.rotate(shape.rot); appContext.collectionCollageRoundedRect(ctx,0,0,shape.w,shape.h,22); ctx.fillStyle='rgba(255,255,255,0.015)'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=shape.stroke; ctx.stroke(); ctx.restore(); });
      ctx.restore();

      ctx.save();
      for(let i=0;i<220;i++){
        const px=((i*97)%1000)/1000*width; const py=((i*53)%1000)/1000*height; const pr=0.8+((i*17)%100)/110;
        ctx.beginPath(); ctx.fillStyle=i%11===0 ? 'rgba(236,192,87,0.14)' : (i%7===0 ? 'rgba(74,203,184,0.10)' : 'rgba(255,255,255,0.04)');
        ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      return;
    }

    if(theme==='trophy'){
      const spotlight=ctx.createRadialGradient(width*0.5,height*0.12,30,width*0.5,height*0.12,width*0.32);
      spotlight.addColorStop(0,'rgba(252,237,189,0.20)'); spotlight.addColorStop(0.45,'rgba(252,237,189,0.08)'); spotlight.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=spotlight; ctx.fillRect(0,0,width,height);
      appContext.collectionCollageDrawTrophy(ctx,width*0.31,height*0.12,220);
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'tl',1.0);
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'tr',1.0);
      ctx.save(); ctx.strokeStyle='rgba(236,192,87,0.10)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(width*0.17,height*0.80,170,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(width*0.83,height*0.77,150,0,Math.PI*2); ctx.stroke();
      ctx.restore();
      return;
    }

    if(theme==='vintage'){
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'tl',1.05,'rgba(218,182,96,0.20)');
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'tr',1.05,'rgba(218,182,96,0.20)');
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'bl',1.05,'rgba(218,182,96,0.20)');
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'br',1.05,'rgba(218,182,96,0.20)');
      ctx.save();
      ctx.strokeStyle='rgba(218,182,96,0.18)'; ctx.lineWidth=3;
      appContext.collectionCollageRoundedRect(ctx,44,44,width-88,height-88,28); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1.5;
      appContext.collectionCollageRoundedRect(ctx,68,68,width-136,height-136,22); ctx.stroke();
      ctx.restore();
      return;
    }

    if(theme==='championship'){
      appContext.collectionCollageDrawTrophy(ctx,width*0.29,height*0.12,210,'rgba(220,166,53,0.18)','rgba(255,231,165,0.38)');
      ctx.save();
      const beams=[[0.12,-0.18],[0.30,-0.09],[0.70,0.09],[0.88,0.18]];
      beams.forEach(([x,rot],i)=>{
        ctx.save(); ctx.translate(width*x,0); ctx.rotate(rot);
        const beam=ctx.createLinearGradient(0,0,0,height*0.44);
        beam.addColorStop(0,i<2 ? 'rgba(255,233,171,0.16)' : 'rgba(110,168,255,0.12)');
        beam.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=beam; ctx.fillRect(-48,0,96,height*0.44); ctx.restore();
      });
      for(let i=0;i<90;i++){
        const x=((i*97)%1000)/1000*width; const y=((i*61)%1000)/1000*(height*0.38)+height*0.08;
        ctx.fillStyle=i%3===0 ? 'rgba(236,192,87,0.22)' : (i%3===1 ? 'rgba(74,203,184,0.18)' : 'rgba(255,255,255,0.14)');
        ctx.fillRect(x,y,4,12);
      }
      ctx.restore();
      return;
    }

    if(theme==='pirate'){
      appContext.collectionCollageDrawCompass(ctx,width*0.84,height*0.18,118);
      ctx.save();
      ctx.strokeStyle='rgba(207,174,110,0.14)'; ctx.lineWidth=7; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(70,height*0.22); ctx.bezierCurveTo(width*0.12,height*0.20,width*0.18,height*0.12,width*0.26,height*0.14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(width-70,height*0.80); ctx.bezierCurveTo(width*0.89,height*0.82,width*0.82,height*0.90,width*0.74,height*0.88); ctx.stroke();
      ctx.restore();
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'tl',0.95,'rgba(205,173,98,0.16)');
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'br',0.95,'rgba(205,173,98,0.16)');
      ctx.save();
      const cx=width*0.18, cy=height*0.83, s=150;
      appContext.collectionCollageRoundedRect(ctx,cx-s*0.48,cy-s*0.18,s*0.96,s*0.34,18); ctx.fillStyle='rgba(90,58,33,0.34)'; ctx.fill(); ctx.strokeStyle='rgba(211,176,105,0.18)'; ctx.lineWidth=3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-s*0.48,cy-s*0.02); ctx.quadraticCurveTo(cx,cy-s*0.48,cx+s*0.48,cy-s*0.02); ctx.stroke();
      for(let i=0;i<7;i++){ ctx.beginPath(); ctx.fillStyle='rgba(222,193,122,0.16)'; ctx.arc(cx-s*0.34+i*28,cy-s*0.22-(i%2)*6,8,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
      return;
    }

    if(theme==='botanical'){
      appContext.collectionCollageDrawTrophy(ctx,width*0.31,height*0.12,200,'rgba(219,176,82,0.16)','rgba(250,235,182,0.32)');
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'tl',1.15,'rgba(113,185,142,0.20)');
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'tr',1.15,'rgba(113,185,142,0.20)');
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'bl',0.95,'rgba(113,185,142,0.16)');
      appContext.collectionCollageDrawVineCorner(ctx,width,height,'br',0.95,'rgba(113,185,142,0.16)');
      return;
    }

    if(theme==='gallery'){
      appContext.collectionCollageDrawArch(ctx,width*0.17,height*0.84,250,320,'rgba(255,255,255,0.06)');
      appContext.collectionCollageDrawArch(ctx,width*0.83,height*0.84,250,320,'rgba(255,255,255,0.06)');
      ctx.save();
      ctx.strokeStyle='rgba(216,188,117,0.16)'; ctx.lineWidth=3;
      appContext.collectionCollageRoundedRect(ctx,width*0.09,height*0.11,150,218,20); ctx.stroke();
      appContext.collectionCollageRoundedRect(ctx,width*0.86,height*0.58,165,236,20); ctx.stroke();
      const spotA=ctx.createRadialGradient(width*0.22,height*0.15,20,width*0.22,height*0.15,width*0.20);
      spotA.addColorStop(0,'rgba(250,241,214,0.20)'); spotA.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=spotA; ctx.fillRect(0,0,width,height);
      const spotB=ctx.createRadialGradient(width*0.76,height*0.16,20,width*0.76,height*0.16,width*0.18);
      spotB.addColorStop(0,'rgba(250,241,214,0.12)'); spotB.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=spotB; ctx.fillRect(0,0,width,height);
      ctx.restore();
      return;
    }
  }

async function loadImageForCollectionCollage(url){
    const safe=appContext.safeHttpUrl(url);
    if(!safe) throw new Error("Missing image URL");

    let objectUrl="";
    try{
      const response=await appContext.fetch(safe,{mode:"cors",cache:"force-cache"});
      if(response.ok){
        const blob=await response.blob();
        objectUrl=URL.createObjectURL(blob);
      }
    }catch(error){
      console.warn("Collection collage fetch fallback:",error);
    }

    const img=new Image();
    img.decoding="async";
    img.crossOrigin="anonymous";
    img.referrerPolicy="no-referrer";

    const src=objectUrl||safe;
    await new Promise((resolve,reject)=>{
      img.onload=()=>resolve();
      img.onerror=()=>reject(new Error("Image could not be loaded"));
      img.src=src;
    });

    return {
      img,
      cleanup:()=>{ if(objectUrl) URL.revokeObjectURL(objectUrl); }
    };
  }

function chooseCollectionCollageColumns(count,width,targetHeight,padding,gap){
    const maxCols=Math.min(9,Math.max(4,Math.ceil(Math.sqrt(Math.max(1,count))))+2);
    let bestCols=4;
    let bestScore=Number.POSITIVE_INFINITY;

    for(let cols=4; cols<=maxCols; cols++){
      const slotW=Math.floor((width-padding*2-gap*(cols-1))/cols);
      if(slotW<150) continue;
      const slotH=Math.round(slotW*1.42);
      const rows=Math.ceil(count/cols);
      const totalH=padding+170+rows*slotH+Math.max(0,rows-1)*gap+padding;
      const aspectScore=Math.abs(totalH-targetHeight);
      const rowPenalty=rows*3;
      const score=aspectScore+rowPenalty;
      if(score<bestScore){
        bestScore=score;
        bestCols=cols;
      }
    }
    return bestCols;
  }

function collectionCollageAspectSize(aspect){
    switch(String(aspect||"portrait")){
      case "square": return {width:3600,height:3600,label:"Square 1:1"};
      case "story": return {width:2160,height:3840,label:"Story 9:16"};
      case "landscape": return {width:3840,height:2160,label:"Landscape 16:9"};
      default: return {width:3600,height:4500,label:"Portrait 4:5"};
    }
  }

function chooseCollectionCollageGrid(count,areaW,areaH,gap){
    let best={cols:1,rows:Math.max(1,count),score:-Infinity};
    const desiredAspect=0.704;
    for(let cols=1;cols<=Math.min(14,count);cols++){
      const rows=Math.ceil(count/cols);
      const cellW=(areaW-gap*(cols-1))/cols;
      const cellH=(areaH-gap*(rows-1))/rows;
      if(cellW<=20 || cellH<=20) continue;
      const area=cellW*cellH;
      const cellAspect=cellW/cellH;
      const aspectPenalty=Math.abs(Math.log(Math.max(.01,cellAspect/desiredAspect)));
      const unused=cols*rows-count;
      const score=Math.log(Math.max(1,area))*5-aspectPenalty*2-unused*.025;
      if(score>best.score) best={cols,rows,cellW,cellH,score};
    }
    return best;
  }

function chooseCollectionCollageGridWithCenterGap(count,areaW,areaH,gap){
    const desiredCardAspect=0.704;
    const desiredQrAspect=0.92;
    let best=null;
    const maxCols=Math.min(14,Math.max(4,count+2));

    for(let cols=2; cols<=maxCols; cols++){
      const minRows=Math.max(2,Math.ceil(count/cols));
      const maxRows=Math.min(18,Math.ceil((count+6)/cols)+4);
      for(let rows=minRows; rows<=maxRows; rows++){
        const cellW=(areaW-gap*(cols-1))/cols;
        const cellH=(areaH-gap*(rows-1))/rows;
        if(cellW<=20 || cellH<=20) continue;

        // Prefer a centre gap that stays visually centred in the collage.
        // Matching grid/gap parity keeps the QR exactly on the true centre line,
        // while tall portrait gaps such as 1x2 are discouraged.
        const reserveShapes=[[1,1],[2,1],[1,2],[2,2]];
        for(const [reserveCols,reserveRows] of reserveShapes){
          if(reserveCols>cols || reserveRows>rows) continue;

          const startCol=Math.max(0,Math.floor((cols-reserveCols)/2));
          const startRow=Math.max(0,Math.floor((rows-reserveRows)/2));
          const capacity=cols*rows-reserveCols*reserveRows;
          if(capacity<count) continue;

          const qrW=reserveCols*cellW+gap*(reserveCols-1);
          const qrH=reserveRows*cellH+gap*(reserveRows-1);
          const qrSize=Math.min(qrW,qrH);
          if(qrSize<120) continue;

          const area=cellW*cellH;
          const cardAspect=cellW/cellH;
          const cardAspectPenalty=Math.abs(Math.log(Math.max(.01,cardAspect/desiredCardAspect)));
          const qrAspect=qrW/qrH;
          const qrAspectPenalty=Math.abs(Math.log(Math.max(.01,qrAspect/desiredQrAspect)));
          const unused=capacity-count;

          const gapCenterCol=startCol+(reserveCols-1)/2;
          const gapCenterRow=startRow+(reserveRows-1)/2;
          const gridCenterCol=(cols-1)/2;
          const gridCenterRow=(rows-1)/2;
          const centerPenalty=Math.abs(gapCenterCol-gridCenterCol)+Math.abs(gapCenterRow-gridCenterRow);

          const exactCenterX=((cols-reserveCols)%2)===0;
          const exactCenterY=((rows-reserveRows)%2)===0;
          const exactCenterBonus=(exactCenterX?1.45:0)+(exactCenterY?1.05:0);

          const tallRatio=qrH/Math.max(1,qrW);
          const wideRatio=qrW/Math.max(1,qrH);
          const tallPenalty=Math.max(0,tallRatio-1.10)*6.4;
          const widePenalty=Math.max(0,wideRatio-1.45)*1.6;
          const shapePenalty=(reserveRows>reserveCols ? 0.45 : 0);

          const qrBonus=Math.log(Math.max(1,qrSize))*1.25;
          const score=
            Math.log(Math.max(1,area))*5
            -cardAspectPenalty*2
            -qrAspectPenalty*5.0
            -unused*.03
            -centerPenalty*.42
            -tallPenalty
            -widePenalty
            -shapePenalty
            +exactCenterBonus
            +qrBonus;

          if(!best || score>best.score){
            const positions=[];
            for(let r=0;r<rows;r++){
              for(let c=0;c<cols;c++){
                const inGap=c>=startCol && c<startCol+reserveCols && r>=startRow && r<startRow+reserveRows;
                if(inGap) continue;
                positions.push({x:c*(cellW+gap),y:r*(cellH+gap),col:c,row:r});
              }
            }
            best={
              cols,rows,cellW,cellH,score,
              positions,
              qrBox:{
                x:startCol*(cellW+gap),
                y:startRow*(cellH+gap),
                w:qrW,
                h:qrH,
                reserveCols,
                reserveRows,
                startCol,
                startRow,
                exactCenterX,
                exactCenterY
              }
            };
          }
        }
      }
    }
    return best || appContext.chooseCollectionCollageGrid(count,areaW,areaH,gap);
  }

function createCollectionCollageQrCode(text,size=640){
    return new Promise((resolve,reject)=>{
      if(typeof QRCode!=="function"){
        reject(new Error("QR library could not load"));
        return;
      }
      const holder=document.createElement("div");
      holder.style.position="fixed";
      holder.style.left="-99999px";
      holder.style.top="0";
      holder.style.width=size+"px";
      holder.style.height=size+"px";
      holder.style.pointerEvents="none";
      holder.setAttribute("aria-hidden","true");
      document.body.appendChild(holder);
      try{
        new QRCode(holder,{
          text,
          width:size,
          height:size,
          colorDark:"#111111",
          colorLight:"#ffffff",
          correctLevel:QRCode.CorrectLevel.H
        });
      }catch(error){
        holder.remove();
        reject(error);
        return;
      }
      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          try{
            const qrCanvas=holder.querySelector("canvas");
            const qrImg=holder.querySelector("img");
            if(qrCanvas){
              const copy=document.createElement("canvas");
              copy.width=qrCanvas.width;
              copy.height=qrCanvas.height;
              const copyCtx=copy.getContext("2d");
              copyCtx.drawImage(qrCanvas,0,0);
              holder.remove();
              resolve(copy);
              return;
            }
            if(qrImg && qrImg.complete){
              const img=new Image();
              img.onload=()=>{ holder.remove(); resolve(img); };
              img.onerror=(err)=>{ holder.remove(); reject(err || new Error("Could not load QR image")); };
              img.src=qrImg.src;
              return;
            }
            holder.remove();
            reject(new Error("Could not generate QR code"));
          }catch(error){
            holder.remove();
            reject(error);
          }
        });
      });
    });
  }

function collagePickerCards(){
    return appContext.cards.filter(card=>["inventory","collection","sold","reserved"].some(scope=>appContext.cardMatchesListingScope(card,scope)));
  }

function collageResolveSelected(ids){
    const available=new Map(appContext.collagePickerCards().map(card=>[String(card.id),card]));
    return [...new Set(Array.isArray(ids)?ids.map(String):[])].map(id=>available.get(id)).filter(Boolean);
  }

function collageMoveSelected(ids,from,to){
    const result=ids.slice();
    if(from<0 || to<0 || from>=result.length || to>=result.length) return result;
    result.splice(to,0,result.splice(from,1)[0]);
    return result;
  }

function setupCollageCardPicker(){
    const mode=appContext.$("collageCardSource"), panel=appContext.$("collageManualPanel"), search=appContext.$("collageCardSearch"), scope=appContext.$("collagePickerScope");
    let selected=appContext.collageResolveSelected(appContext.collageManualSelectedIds).map(card=>String(card.id));
    let draggedId=null;
    const candidates=appContext.collagePickerCards();
    const matches=()=>{
      const query=search.value.trim().toLowerCase();
      return candidates.filter(card=>(scope.value==="all" || appContext.cardMatchesListingScope(card,scope.value)) &&
        [card.name,card.card_code,card.game,card.series,card.year,card.language,card.format,card.condition,
          ...(Array.isArray(card.grading)?card.grading.map(g=>`${g.company||""} ${g.grade||""}`):[])]
          .join(" ").toLowerCase().includes(query));
    };
    function caption(card){
      return [card.card_code,card.game,card.availability,appContext.cardLifecycle(card)==="draft"?"Draft":""].filter(Boolean).join(" · ");
    }
    function render(){
      appContext.collageManualSelectedIds=selected.slice();
      panel.hidden=mode.value!=="manual";
      const count=mode.value==="manual"?selected.length:appContext.collageCardsForCurrentScope().length;
      appContext.$("collageSelectionCount").textContent=`${count} card${count===1?"":"s"} to export`;
      appContext.$("collectionCollageGenerateBtn").disabled=count===0;
      if(panel.hidden) return;
      const visible=matches(), checked=new Set(selected), list=appContext.$("collagePickerResults");
      appContext.$("collageMatchCount").textContent=`${visible.length} matching cards`;
      list.replaceChildren();
      if(!visible.length) list.textContent="No matching cards. Try another search or category.";
      visible.forEach(card=>{
        const row=document.createElement("label");row.className="collage-picker-row";
        const check=document.createElement("input");check.type="checkbox";check.checked=checked.has(String(card.id));
        check.setAttribute("aria-label",`Select ${card.name||"Untitled card"}`);
        check.addEventListener("change",()=>{
          const id=String(card.id);selected=check.checked?[...selected,id]:selected.filter(value=>value!==id);render();
          const replacement=list.querySelectorAll('input')[visible.indexOf(card)];replacement?.focus({preventScroll:true});
        });
        const src=appContext.safeHttpUrl(card.thumbnail_url||card.image||card.images?.[0]||"");
        row.append(check);
        if(src){const img=document.createElement("img");img.src=src;img.alt="";img.loading="lazy";row.append(img);}
        const text=document.createElement("span"), title=document.createElement("strong"), detail=document.createElement("small");
        title.textContent=card.name||"Untitled card";detail.textContent=caption(card);text.append(title,detail);row.append(text);list.append(row);
      });
      const ordered=appContext.$("collageSelectedCards");ordered.replaceChildren();
      const selectedCards=appContext.collageResolveSelected(selected);
      if(!selectedCards.length) ordered.textContent="Select cards above to build your collage.";
      selectedCards.forEach((card,index)=>{
        const row=document.createElement("li");row.className="collage-selected-row";row.draggable=true;
        const label=document.createElement("span");label.textContent=`${index+1}. ${card.name||"Untitled card"}`;row.append(label);
        const actions=document.createElement("div");actions.className="collage-picker-actions";
        [["↑","Move up",index===0,()=>{selected=appContext.collageMoveSelected(selected,index,index-1);}],
         ["↓","Move down",index===selectedCards.length-1,()=>{selected=appContext.collageMoveSelected(selected,index,index+1);}],
         ["×","Remove",false,()=>{selected=selected.filter(id=>id!==String(card.id));}]].forEach(([text,title,disabled,action])=>{
          const btn=document.createElement("button");btn.type="button";btn.className="btn-ghost";btn.textContent=text;
          btn.setAttribute("aria-label",`${title}: ${card.name||"Untitled card"}`);btn.disabled=disabled;
          btn.addEventListener("click",()=>{action();render();});actions.append(btn);
        });
        row.append(actions);
        row.addEventListener("dragstart",event=>{draggedId=String(card.id);event.dataTransfer.setData("text/plain",draggedId);event.dataTransfer.effectAllowed="move";});
        row.addEventListener("dragover",event=>{if(draggedId){event.preventDefault();event.dataTransfer.dropEffect="move";}});
        row.addEventListener("drop",event=>{event.preventDefault();if(draggedId){selected=appContext.collageMoveSelected(selected,selected.indexOf(draggedId),selected.indexOf(String(card.id)));draggedId=null;render();}});
        row.addEventListener("dragend",()=>{draggedId=null;});ordered.append(row);
      });
    }
    mode.addEventListener("change",render);search.addEventListener("input",render);scope.addEventListener("change",render);
    appContext.$("collageSelectMatching").addEventListener("click",()=>{selected=[...new Set([...selected,...matches().map(card=>String(card.id))])];render();});
    appContext.$("collageUseFiltered").addEventListener("click",()=>{selected=[...new Set([...selected,...appContext.collageCardsForCurrentScope().map(card=>String(card.id))])];render();});
    appContext.$("collageClearSelection").addEventListener("click",()=>{selected=[];render();});
    render();
    return ()=>mode.value==="manual"?selected.slice():null;
  }

function closeCollectionCollageSettingsModal(){
    const overlay=appContext.$("collectionCollageSettingsOverlay");
    if(overlay) overlay.remove();
  }

function openCollectionCollageSettingsModal(){
    if(!appContext.requireCollectionOrderOwner("export Collection collage")) return;
    if(!["collection","inventory"].includes(appContext.listingAvailabilityScope)){
      appContext.showToast("Open Collection or Inventory first");
      return;
    }

    appContext.closeCollectionCollageSettingsModal();

    const scopeLabel=appContext.collageScopeLabel();
    const defaultTitle="Collect TCG MY & SG Inventory";
    const overlay=document.createElement("div");
    overlay.id="collectionCollageSettingsOverlay";
    overlay.className="collection-collage-modal-overlay";
    overlay.innerHTML=`
      <div class="collection-collage-modal" role="dialog" aria-modal="true" aria-labelledby="collectionCollageModalTitle">
        <h2 id="collectionCollageModalTitle">Export ${scopeLabel} Collage</h2>
        <p class="collage-modal-sub">Choose your cards and how the high-resolution social-media image should look.</p>

        <div class="collection-collage-settings-grid">
          <div class="collection-collage-field full">
            <label for="collageCardSource">Cards to include</label>
            <select id="collageCardSource"><option value="filtered">Use filtered results</option><option value="manual">Choose cards manually</option></select>
            <strong id="collageSelectionCount" role="status" aria-live="polite"></strong>
          </div>
          <div id="collageManualPanel" class="collection-collage-field full" hidden>
            <label for="collageCardSearch">Search all cards</label>
            <input id="collageCardSearch" type="text" placeholder="Name, card code, game, series or year">
            <label for="collagePickerScope">Category</label>
            <select id="collagePickerScope"><option value="all">All categories</option><option value="inventory">Inventory</option><option value="collection">Collection / NFS</option><option value="sold">Sold</option><option value="reserved">Reserved</option></select>
            <div class="collage-picker-actions"><button type="button" class="btn-ghost" id="collageSelectMatching">Select matching</button><button type="button" class="btn-ghost" id="collageUseFiltered">Add current filtered results</button><button type="button" class="btn-ghost" id="collageClearSelection">Clear selection</button></div>
            <small id="collageMatchCount" role="status"></small>
            <div id="collagePickerResults" class="collage-picker-list" aria-label="Available collage cards"></div>
            <strong>Selected cards — export order</strong>
            <small>Selections stay when you search or change category. Drag to reorder, or use the arrow buttons.</small>
            <ol id="collageSelectedCards" class="collage-picker-list"></ol>
          </div>
          <div class="collection-collage-field full">
            <span>Title</span>
            <input id="collectionCollageTitleInput" type="text" maxlength="90" value="${appContext.escapeHtml(defaultTitle)}" placeholder="Leave blank for no title">
          </div>
          <div class="collection-collage-field full">
            <span>Subtitle</span>
            <input id="collectionCollageSubtitleInput" type="text" maxlength="90" value="" placeholder="Optional second line under the title">
          </div>

          <div class="collection-collage-field">
            <span>Aspect ratio</span>
            <select id="collectionCollageAspect">
              <option value="portrait" selected>Portrait 4:5 — Instagram post</option>
              <option value="square">Square 1:1</option>
              <option value="story">Story / Reel 9:16</option>
              <option value="landscape">Landscape 16:9</option>
            </select>
          </div>

          <div class="collection-collage-field">
            <span>Background</span>
            <select id="collectionCollageBackground">
              <option value="geometric" selected>Geometric Luxe</option>
              <option value="aurora">Aurora Glow</option>
              <option value="minimal">Minimal Dark</option>
              <option value="trophy">Trophy Showcase</option>
              <option value="vintage">Vintage Ornamental</option>
              <option value="championship">Championship Theme</option>
              <option value="pirate">Pirate Treasure</option>
              <option value="botanical">Luxury Botanical</option>
              <option value="gallery">Gallery / Museum</option>
            </select>
          </div>

          <div class="collection-collage-field">
            <span>Card spacing</span>
            <select id="collectionCollageSpacing">
              <option value="tight">Tight</option>
              <option value="standard" selected>Standard</option>
              <option value="airy">Airy</option>
            </select>
          </div>

          <div class="collection-collage-field">
            <span>Card corners</span>
            <select id="collectionCollageCorners">
              <option value="soft" selected>Soft</option>
              <option value="square">Square</option>
            </select>
          </div>

          <div class="collection-collage-checks full">
            <label class="collection-collage-check"><input id="collectionCollageShowLogo" type="checkbox" checked> Show website logo</label>
            <label class="collection-collage-check"><input id="collectionCollageShowDate" type="checkbox" checked> Show date</label>
            <label class="collection-collage-check"><input id="collectionCollageShowWebsite" type="checkbox" checked> Show website footer</label>
            <label class="collection-collage-check"><input id="collectionCollageShowPrice" type="checkbox"> Show price below each card</label>
            <label class="collection-collage-check"><input id="collectionCollageShowQr" type="checkbox"> Add centre QR code to Inventory page</label>
          </div>

          <div class="collection-collage-preview-note">
            Filtered mode uses the first image of each filtered ${scopeLabel} card in its existing order. Manual mode uses only your selected cards, in the order shown above. If QR is enabled, the code points to your Inventory page and the cards are arranged around it.
          </div>
        </div>

        <div class="collection-collage-modal-actions">
          <button type="button" class="btn-ghost" id="collectionCollageCancelBtn">Cancel</button>
          <button type="button" class="btn-primary" id="collectionCollageGenerateBtn">Generate PNG</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    appContext.$("collectionCollageTitleInput")?.focus();

    const close=()=>appContext.closeCollectionCollageSettingsModal();
    appContext.$("collectionCollageCancelBtn")?.addEventListener("click",close);
    overlay.addEventListener("click",event=>{ if(event.target===overlay) close(); });
    overlay.addEventListener("keydown",event=>{ if(event.key==="Escape") close(); });

    const getManualCollageSelection=appContext.setupCollageCardPicker();
    appContext.$("collectionCollageGenerateBtn")?.addEventListener("click",async()=>{
      const selectedCardIds=getManualCollageSelection();
      if(selectedCardIds && !selectedCardIds.length){appContext.showToast("Choose at least one card");return;}
      const settings={
        selectedCardIds,
        title:String(appContext.$("collectionCollageTitleInput")?.value||"").trim(),
        subtitle:String(appContext.$("collectionCollageSubtitleInput")?.value||"").trim(),
        aspect:String(appContext.$("collectionCollageAspect")?.value||"portrait"),
        background:String(appContext.$("collectionCollageBackground")?.value||"geometric"),
        spacing:String(appContext.$("collectionCollageSpacing")?.value||"standard"),
        corners:String(appContext.$("collectionCollageCorners")?.value||"soft"),
        showLogo:!!appContext.$("collectionCollageShowLogo")?.checked,
        showDate:!!appContext.$("collectionCollageShowDate")?.checked,
        showWebsite:!!appContext.$("collectionCollageShowWebsite")?.checked,
        showPrice:!!appContext.$("collectionCollageShowPrice")?.checked,
        showQr:!!appContext.$("collectionCollageShowQr")?.checked
      };
      close();
      await appContext.exportCollectionCollage(settings);
    });
  }

async function exportCollectionCollage(settings={}){
    if(!appContext.requireCollectionOrderOwner("export Collection collage")) return;
    if(!["collection","inventory"].includes(appContext.listingAvailabilityScope)){
      appContext.showToast("Open Collection or Inventory first");
      return;
    }

    const manual=Array.isArray(settings.selectedCardIds);
    const scopeLabel=manual ? "Selected" : appContext.collageScopeLabel();
    const scopeSlug=manual ? "selected" : (appContext.listingAvailabilityScope==="inventory" ? "inventory" : "collection");
    const items=manual ? appContext.collageResolveSelected(settings.selectedCardIds) : appContext.collageCardsForCurrentScope();
    if(!items.length){
      appContext.showToast(`No ${scopeLabel} cards to export`);
      return;
    }

    const collageTitle=String(settings.title||"").trim();
    const collageSubtitle=String(settings.subtitle||"").trim();
    const hasHeading=!!(collageTitle || collageSubtitle);
    const hasSubtitle=!!collageSubtitle;

    appContext.setCollectionCollageExportBusy(true,"Preparing…");
    appContext.showToast(`Preparing collage for ${items.length} ${scopeLabel} cards…`);

    try{
      const prepared=[];
      for(const card of items){
        let src=appContext.safeHttpUrl(card?.thumbnail_url||card?.image||(Array.isArray(card?.images)?card.images[0]:""));
        if(!src && card?._images_loaded===false){
          await appContext.ensureCardImagesLoaded(card);
          src=appContext.safeHttpUrl(card?.thumbnail_url||card?.image||(Array.isArray(card?.images)?card.images[0]:""));
        }
        if(src) prepared.push({card,src});
      }

      if(!prepared.length){
        appContext.showToast(`No ${scopeLabel} images available`);
        return;
      }

      const canvas=document.createElement("canvas");
      const aspectSize=appContext.collectionCollageAspectSize(settings.aspect);
      const width=aspectSize.width;
      const height=aspectSize.height;
      const padding=Math.round(width*0.034);
      const gapRatio=settings.spacing==="tight" ? 0.0045 : (settings.spacing==="airy" ? 0.011 : 0.007);
      const gap=Math.max(12,Math.round(width*gapRatio));
      const headerHeight=hasHeading
        ? Math.round(height*(settings.showLogo ? (hasSubtitle ? 0.145 : 0.112) : (hasSubtitle ? 0.128 : 0.098)))
        : Math.round(height*(settings.showLogo ? 0.046 : 0.022));
      const footerHeight=settings.showWebsite ? Math.round(height*0.022) : 0;
      const cardsTop=padding+headerHeight;
      const cardsBottom=height-padding-footerHeight;
      const gridInfo=(settings.showQr ? appContext.chooseCollectionCollageGridWithCenterGap(prepared.length,width-padding*2,cardsBottom-cardsTop,gap) : appContext.chooseCollectionCollageGrid(prepared.length,width-padding*2,cardsBottom-cardsTop,gap));
      const cols=gridInfo.cols;
      const rows=gridInfo.rows;
      const slotW=gridInfo.cellW;
      const slotH=gridInfo.cellH;
      const slotPositions=(Array.isArray(gridInfo.positions) && gridInfo.positions.length ? gridInfo.positions : Array.from({length:prepared.length},(_,index)=>({x:(index%cols)*(slotW+gap),y:Math.floor(index/cols)*(slotH+gap)})));
      const qrBox=gridInfo.qrBox||null;
      const gridBlockW=cols*slotW + Math.max(0,cols-1)*gap;
      const gridBlockH=rows*slotH + Math.max(0,rows-1)*gap;
      const gridOffsetX=Math.round(padding + ((width-padding*2)-gridBlockW)/2);
      const gridOffsetY=Math.round(cardsTop + ((cardsBottom-cardsTop)-gridBlockH)/2);
      canvas.width=width;
      canvas.height=height;

      const ctx=canvas.getContext("2d",{alpha:false});
      ctx.fillStyle="#0a0d12";
      ctx.fillRect(0,0,width,height);

      const baseGrad=ctx.createLinearGradient(0,0,width,height);
      baseGrad.addColorStop(0,"#141a24");
      baseGrad.addColorStop(0.34,"#0f1722");
      baseGrad.addColorStop(0.7,"#0b1018");
      baseGrad.addColorStop(1,"#16131b");
      ctx.fillStyle=baseGrad;
      ctx.fillRect(0,0,width,height);

      const glowTop=ctx.createRadialGradient(width*0.5,height*0.12,30,width*0.5,height*0.12,width*0.55);
      glowTop.addColorStop(0,"rgba(236,192,87,0.24)");
      glowTop.addColorStop(0.32,"rgba(236,192,87,0.10)");
      glowTop.addColorStop(1,"rgba(236,192,87,0)");
      ctx.fillStyle=glowTop;
      ctx.fillRect(0,0,width,height);

      const glowLeft=ctx.createRadialGradient(width*0.14,height*0.78,20,width*0.14,height*0.78,width*0.44);
      glowLeft.addColorStop(0,"rgba(74,203,184,0.15)");
      glowLeft.addColorStop(0.38,"rgba(74,203,184,0.08)");
      glowLeft.addColorStop(1,"rgba(74,203,184,0)");
      ctx.fillStyle=glowLeft;
      ctx.fillRect(0,0,width,height);

      const glowRight=ctx.createRadialGradient(width*0.88,height*0.24,20,width*0.88,height*0.24,width*0.34);
      glowRight.addColorStop(0,"rgba(102,132,255,0.12)");
      glowRight.addColorStop(0.34,"rgba(102,132,255,0.06)");
      glowRight.addColorStop(1,"rgba(102,132,255,0)");
      ctx.fillStyle=glowRight;
      ctx.fillRect(0,0,width,height);

      appContext.collectionCollageDrawThemeBackground(ctx,width,height,settings);

            const vignette=ctx.createRadialGradient(width*0.5,height*0.46,Math.min(width,height)*0.16,width*0.5,height*0.5,Math.max(width,height)*0.72);
      vignette.addColorStop(0,"rgba(0,0,0,0)");
      vignette.addColorStop(0.72,"rgba(0,0,0,0.08)");
      vignette.addColorStop(1,"rgba(0,0,0,0.38)");
      ctx.fillStyle=vignette;
      ctx.fillRect(0,0,width,height);

      let collageLogo=null;
      let collageLogoCleanup=()=>{};
      if(settings.showLogo){
        try{
          collageLogo=await appContext.loadWatermarkLogo();
        }catch(error){
          console.warn("Could not load collage watermark logo:",error);
        }
      }

      let collageQr=null;
      if(settings.showQr && qrBox){
        try{
          collageQr=await appContext.createCollectionCollageQrCode(appContext.CARD_WATERMARK_URL,720);
        }catch(error){
          console.warn("Could not generate collage QR code:",error);
        }
      }

      ctx.textBaseline="top";
      if(hasHeading){
        const headerCenterX=width/2;
        const titleTop=padding-8;
        const headingMaxWidth=Math.round(width*(settings.showLogo ? 0.72 : 0.82));

        const fitFont=(content,startSize,minSize,weight)=>{
          let size=Math.max(minSize,startSize);
          while(size>minSize){
            ctx.font=`${weight} ${size}px Inter, system-ui, sans-serif`;
            if(ctx.measureText(content).width<=headingMaxWidth) break;
            size-=2;
          }
          return size;
        };

        const drawGoldText=(content,x,y,size,weight,{shadow='rgba(255,196,72,0.45)',shadowBlur=20,stroke='rgba(66,42,0,0.42)',lineWidth=3}={})=>{
          const gradient=ctx.createLinearGradient(0,y,0,y+size);
          gradient.addColorStop(0,'#fff7c8');
          gradient.addColorStop(0.2,'#ffe895');
          gradient.addColorStop(0.45,'#ffd24f');
          gradient.addColorStop(0.72,'#f1b52d');
          gradient.addColorStop(1,'#b97912');
          ctx.save();
          ctx.textAlign='center';
          ctx.textBaseline='top';
          ctx.font=`${weight} ${size}px Inter, system-ui, sans-serif`;
          ctx.lineJoin='round';
          ctx.shadowColor=shadow;
          ctx.shadowBlur=shadowBlur;
          ctx.shadowOffsetY=4;
          ctx.lineWidth=lineWidth;
          ctx.strokeStyle=stroke;
          ctx.strokeText(content,x,y);
          ctx.fillStyle=gradient;
          ctx.fillText(content,x,y);
          ctx.restore();
        };

        let headingBottom=titleTop;
        if(collageTitle){
          const titleFontSize=fitFont(collageTitle,Math.round(width*0.05),Math.round(width*0.024),900);
          drawGoldText(collageTitle,headerCenterX,titleTop,titleFontSize,900,{shadow:'rgba(255,198,84,0.52)',shadowBlur:28,stroke:'rgba(72,44,0,0.50)',lineWidth:Math.max(3,Math.round(titleFontSize*0.038))});
          headingBottom=titleTop+titleFontSize;
        }

        if(collageSubtitle){
          const subtitleY=headingBottom+Math.max(18,Math.round(width*0.008));
          const subtitleFontSize=fitFont(collageSubtitle,Math.round(width*0.026),Math.round(width*0.014),800);
          drawGoldText(collageSubtitle,headerCenterX,subtitleY,subtitleFontSize,800,{shadow:'rgba(255,208,96,0.34)',shadowBlur:16,stroke:'rgba(72,44,0,0.34)',lineWidth:Math.max(2,Math.round(subtitleFontSize*0.034))});
          ctx.font=`800 ${subtitleFontSize}px Inter, system-ui, sans-serif`;
          const subtitleWidth=Math.min(headingMaxWidth*0.62,Math.max(220,ctx.measureText(collageSubtitle).width));
          const lineY=subtitleY+subtitleFontSize*0.62;
          const sideGap=Math.max(24,Math.round(width*0.018));
          const lineStart=Math.max(padding+10,headerCenterX-subtitleWidth/2-sideGap-Math.round(width*0.13));
          const leftEnd=headerCenterX-subtitleWidth/2-sideGap;
          const rightStart=headerCenterX+subtitleWidth/2+sideGap;
          const lineEnd=Math.min(width-padding-10,headerCenterX+subtitleWidth/2+sideGap+Math.round(width*0.13));
          const lineGradLeft=ctx.createLinearGradient(lineStart,0,leftEnd,0);
          lineGradLeft.addColorStop(0,'rgba(255,210,79,0)');
          lineGradLeft.addColorStop(1,'rgba(255,210,79,0.72)');
          const lineGradRight=ctx.createLinearGradient(rightStart,0,lineEnd,0);
          lineGradRight.addColorStop(0,'rgba(255,210,79,0.72)');
          lineGradRight.addColorStop(1,'rgba(255,210,79,0)');
          ctx.save();
          ctx.lineWidth=Math.max(3,Math.round(width*0.0012));
          ctx.lineCap='round';
          ctx.strokeStyle=lineGradLeft;
          ctx.beginPath();
          ctx.moveTo(lineStart,lineY);
          ctx.lineTo(leftEnd,lineY);
          ctx.stroke();
          ctx.strokeStyle=lineGradRight;
          ctx.beginPath();
          ctx.moveTo(rightStart,lineY);
          ctx.lineTo(lineEnd,lineY);
          ctx.stroke();
          ctx.restore();
        }else if(collageTitle){
          const lineY=headingBottom+Math.max(24,Math.round(width*0.012));
          const lineGrad=ctx.createLinearGradient(width*0.28,0,width*0.72,0);
          lineGrad.addColorStop(0,'rgba(255,210,79,0)');
          lineGrad.addColorStop(0.18,'rgba(255,210,79,0.32)');
          lineGrad.addColorStop(0.50,'rgba(255,247,200,0.22)');
          lineGrad.addColorStop(0.82,'rgba(255,210,79,0.32)');
          lineGrad.addColorStop(1,'rgba(255,210,79,0)');
          ctx.save();
          ctx.strokeStyle=lineGrad;
          ctx.lineWidth=4;
          ctx.lineCap='round';
          ctx.beginPath();
          ctx.moveTo(width*0.30,lineY);
          ctx.lineTo(width*0.70,lineY);
          ctx.stroke();
          ctx.restore();
        }
      }

      if(settings.showDate){
        ctx.textAlign="right";
        ctx.fillStyle="rgba(247,248,251,0.62)";
        ctx.font=`500 ${Math.max(20,Math.round(width*0.0078))}px Inter, system-ui, sans-serif`;
        ctx.fillText(new Date().toLocaleDateString(),width-padding,padding+(hasHeading ? Math.round(width*.005) : 8));
        ctx.textAlign="left";
      }

      const loaded=[];
      const cleanups=[];
      let loadedCount=0;
      const batchSize=8;
      for(let i=0;i<prepared.length;i+=batchSize){
        const batch=prepared.slice(i,i+batchSize);
        const results=await Promise.all(batch.map(async entry=>{
          try{
            const asset=await appContext.loadImageForCollectionCollage(entry.src);
            return {...entry,...asset};
          }catch(error){
            console.warn("Collection collage image skipped:",entry.src,error);
            return {...entry,img:null,cleanup:()=>{}};
          }
        }));
        results.forEach(result=>{
          loaded.push(result);
          if(typeof result.cleanup==="function") cleanups.push(result.cleanup);
          loadedCount+=1;
        });
        appContext.showToast(`Preparing collage… ${Math.min(loadedCount,prepared.length)}/${prepared.length}`);
      }

      if(collageQr && qrBox){
        // Keep the visible QR panel compact and centred inside its reserved area.
        const reservedW=qrBox.w;
        const reservedH=qrBox.h;
        const compactPanelW=Math.min(reservedW,Math.round(Math.min(reservedW,reservedH)*1.04));
        const compactPanelH=Math.min(reservedH,Math.round(compactPanelW*1.18));
        const panelW=Math.round(compactPanelW);
        const panelH=Math.round(compactPanelH);
        const panelX=Math.round(gridOffsetX+qrBox.x+(reservedW-panelW)/2);
        const panelY=Math.round(gridOffsetY+qrBox.y+(reservedH-panelH)/2);
        const panelRadius=settings.corners==="square" ? 8 : Math.max(20,Math.round(Math.min(panelW,panelH)*0.09));
        const panelBg=ctx.createLinearGradient(panelX,panelY,panelX,panelY+panelH);
        panelBg.addColorStop(0,"rgba(255,255,255,0.13)");
        panelBg.addColorStop(1,"rgba(255,255,255,0.06)");
        ctx.save();
        appContext.collectionCollageRoundedRect(ctx,panelX,panelY,panelW,panelH,panelRadius);
        ctx.fillStyle=panelBg;
        ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,0.18)";
        ctx.lineWidth=2;
        ctx.stroke();
        ctx.restore();

        const qrInset=Math.max(18,Math.round(Math.min(panelW,panelH)*0.08));
        const labelTop=Math.max(24,Math.round(panelH*0.14));
        const labelBottom=Math.max(26,Math.round(panelH*0.14));
        const qrSize=Math.max(120,Math.min(panelW-qrInset*2,panelH-qrInset*2-labelTop-labelBottom));
        const qrX=panelX+(panelW-qrSize)/2;
        const qrY=panelY+qrInset+labelTop;

        ctx.save();
        ctx.textAlign="center";
        ctx.textBaseline="top";
        ctx.fillStyle="rgba(248,248,251,0.95)";
        ctx.font=`700 ${Math.max(18,Math.round(qrSize*0.11))}px Inter, system-ui, sans-serif`;
        ctx.fillText("Scan to browse",panelX+panelW/2,panelY+qrInset*0.72);
        ctx.fillStyle="rgba(248,248,251,0.76)";
        ctx.font=`500 ${Math.max(16,Math.round(qrSize*0.075))}px Inter, system-ui, sans-serif`;
        ctx.fillText("Collect TCG Inventory",panelX+panelW/2,panelY+qrInset*0.72+Math.max(26,Math.round(qrSize*0.13)));
        ctx.restore();

        ctx.save();
        appContext.collectionCollageRoundedRect(ctx,qrX-10,qrY-10,qrSize+20,qrSize+20,settings.corners==="square" ? 6 : Math.max(14,Math.round(qrSize*0.08)));
        ctx.fillStyle="rgba(255,255,255,0.96)";
        ctx.fill();
        ctx.restore();
        ctx.drawImage(collageQr,qrX,qrY,qrSize,qrSize);

        ctx.save();
        ctx.textAlign="center";
        ctx.textBaseline="bottom";
        ctx.fillStyle="rgba(248,248,251,0.55)";
        ctx.font=`400 ${Math.max(14,Math.round(qrSize*0.058))}px Inter, system-ui, sans-serif`;
        ctx.fillText("collecttcg.github.io",panelX+panelW/2,panelY+panelH-qrInset*0.75);
        ctx.restore();
      }

      loaded.forEach((entry,index)=>{
        const position=slotPositions[index] || {x:(index%cols)*(slotW+gap),y:Math.floor(index/cols)*(slotH+gap)};
        const x=gridOffsetX+position.x;
        const y=gridOffsetY+position.y;
        const outerRadius=settings.corners==="square" ? 4 : Math.max(14,Math.round(slotW*.035));
        const innerRadius=settings.corners==="square" ? 3 : Math.max(12,Math.round(slotW*.032));
        const priceLabel=settings.showPrice ? appContext.collageCardPriceLabel(entry.card) : "";
        const priceAreaH=settings.showPrice ? Math.max(34,Math.min(58,Math.round(slotH*0.115))) : 0;
        const contentInset=8;
        const imageBoxY=y+contentInset;
        const imageBoxH=slotH-contentInset*2-(priceAreaH ? priceAreaH+6 : 0);

        ctx.save();
        appContext.collectionCollageRoundedRect(ctx,x,y,slotW,slotH,outerRadius);
        ctx.fillStyle="#1b2028";
        ctx.fill();
        ctx.restore();

        if(entry.img){
          ctx.save();
          appContext.collectionCollageRoundedRect(ctx,x+2,imageBoxY,slotW-4,imageBoxH,innerRadius);
          ctx.clip();
          appContext.collectionCollageDrawImageContain(ctx,entry.img,x+8,imageBoxY+6,slotW-16,Math.max(40,imageBoxH-12));
          ctx.restore();
        }else{
          ctx.save();
          appContext.collectionCollageRoundedRect(ctx,x+2,imageBoxY,slotW-4,imageBoxH,innerRadius);
          ctx.fillStyle="#2b313b";
          ctx.fill();
          ctx.fillStyle="rgba(247,248,251,0.72)";
          ctx.font=`600 ${Math.max(20,Math.round(slotW*0.11))}px Inter, system-ui, sans-serif`;
          ctx.textAlign="center";
          ctx.textBaseline="middle";
          ctx.fillText("No Image",x+slotW/2,imageBoxY+imageBoxH/2);
          ctx.restore();
        }

        if(settings.showPrice){
          const priceY=y+slotH-priceAreaH-contentInset+2;
          ctx.save();
          appContext.collectionCollageRoundedRect(ctx,x+10,priceY,slotW-20,priceAreaH,settings.corners==="square" ? 3 : Math.max(10,Math.round(slotW*.026)));
          const priceBg=ctx.createLinearGradient(x,priceY,x,priceY+priceAreaH);
          priceBg.addColorStop(0,"rgba(255,255,255,0.06)");
          priceBg.addColorStop(1,"rgba(255,255,255,0.025)");
          ctx.fillStyle=priceBg;
          ctx.fill();
          ctx.strokeStyle="rgba(255,255,255,0.06)";
          ctx.lineWidth=1;
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.textAlign="center";
          ctx.textBaseline="middle";
          ctx.fillStyle=priceLabel ? "rgba(248,248,251,0.96)" : "rgba(248,248,251,0.42)";
          ctx.font=`600 ${Math.max(17,Math.min(28,Math.round(slotW*0.09)))}px Inter, system-ui, sans-serif`;
          ctx.fillText(priceLabel || "—",x+slotW/2,priceY+priceAreaH/2+1);
          ctx.restore();
        }
      });

      if(settings.showWebsite){
        ctx.fillStyle="rgba(247,248,251,0.42)";
        ctx.font=`400 ${Math.max(18,Math.round(width*0.0062))}px Inter, system-ui, sans-serif`;
        ctx.textAlign="left";
        ctx.fillText("collecttcg.github.io",padding,height-Math.round(padding*.55));
        ctx.textAlign="left";
      }

      if(collageLogo && settings.showLogo){
        const logoSize=Math.max(86,Math.round(width*0.056));
        const logoX=width-padding-logoSize;
        const logoY=height-padding-logoSize-Math.max(0,footerHeight-Math.round(logoSize*0.12));
        ctx.save();
        ctx.shadowColor="rgba(0,0,0,0.32)";
        ctx.shadowBlur=18;
        ctx.shadowOffsetY=6;
        ctx.globalAlpha=0.96;
        ctx.drawImage(collageLogo,logoX,logoY,logoSize,logoSize);
        ctx.restore();
      }

      try{ collageLogoCleanup(); }catch{}

      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png",1));
      if(!blob) throw new Error("Could not generate collage image");

      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      const stamp=new Date().toISOString().slice(0,10);
      link.href=url;
      link.download=`collect-tcg-${scopeSlug}-collage-${stamp}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      cleanups.forEach(fn=>{ try{ fn(); }catch{} });
      appContext.showToast(`${scopeLabel} collage downloaded (${prepared.length} cards)`);
    }catch(error){
      console.error("Collection collage export failed:",error);
      appContext.showToast(error?.message ? `Could not export collage: ${error.message}` : `Could not export ${scopeLabel} collage`);
    }finally{
      appContext.setCollectionCollageExportBusy(false);
    }
  }

  Object.assign(appContext,{setCollectionCollageExportBusy,collageScopeLabel,collageCardsForCurrentScope,collageCardPriceLabel,collectionCollageRoundedRect,collectionCollageDrawImageContain,collectionCollageDrawLeaf,collectionCollageDrawVineCorner,collectionCollageDrawTrophy,collectionCollageDrawCompass,collectionCollageDrawArch,collectionCollageDrawThemeBackground,loadImageForCollectionCollage,chooseCollectionCollageColumns,collectionCollageAspectSize,chooseCollectionCollageGrid,chooseCollectionCollageGridWithCenterGap,createCollectionCollageQrCode,collagePickerCards,collageResolveSelected,collageMoveSelected,setupCollageCardPicker,closeCollectionCollageSettingsModal,openCollectionCollageSettingsModal,exportCollectionCollage});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.collageManualSelectedIds = [];

  appContext.cardLookupVersion = -1;

  appContext.cardLookupMap = new Map();
}
