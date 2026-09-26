import { createModalKeyboardController } from './modal-keyboard.js?v=2026-09-25-v07';
/** V93 beta: features/cards/details. Shared dependencies are explicit on appContext. */
export function register(appContext){
function syncDetailsStatusCornerToVisibleImage(){
    const stage=appContext.detailsMount?.querySelector(".detail-slider-stage");
    const img=stage?.querySelector(".detail-slider-image");
    const corner=stage?.querySelector(".status-corner");
    if(!stage || !img || !corner) return;

    const naturalW=Number(img.naturalWidth||0);
    const naturalH=Number(img.naturalHeight||0);
    if(!naturalW || !naturalH) return;

    const style=getComputedStyle(img);
    const padLeft=parseFloat(style.paddingLeft)||0;
    const padRight=parseFloat(style.paddingRight)||0;
    const padTop=parseFloat(style.paddingTop)||0;
    const padBottom=parseFloat(style.paddingBottom)||0;

    const boxW=Math.max(0,img.clientWidth-padLeft-padRight);
    const boxH=Math.max(0,img.clientHeight-padTop-padBottom);
    if(!boxW || !boxH) return;

    const scale=Math.min(boxW/naturalW,boxH/naturalH);
    const renderedW=naturalW*scale;
    const renderedH=naturalH*scale;

    const imageLeft=img.offsetLeft+padLeft+Math.max(0,(boxW-renderedW)/2);
    const imageTop=img.offsetTop+padTop+Math.max(0,(boxH-renderedH)/2);

    const triangleSize=Math.max(
      90,
      Math.min(renderedW*0.46,renderedH*0.46,360)
    );

    corner.style.setProperty("--detail-status-left",`${imageLeft}px`);
    corner.style.setProperty("--detail-status-top",`${imageTop}px`);
    corner.style.setProperty("--detail-status-size",`${triangleSize}px`);
  }

function scheduleDetailsStatusCornerSync(){
    requestAnimationFrame(()=>{
      appContext.syncDetailsStatusCornerToVisibleImage();
      requestAnimationFrame(appContext.syncDetailsStatusCornerToVisibleImage);
    });
  }

function renderLightboxImage(index){
    if(!appContext.lightboxImages.length) return;
    appContext.lightboxIndex = (index + appContext.lightboxImages.length) % appContext.lightboxImages.length;
    appContext.$("imageLightboxImg").src = appContext.lightboxImages[appContext.lightboxIndex];
    appContext.$("imageLightboxCount").textContent = `${appContext.lightboxIndex + 1} / ${appContext.lightboxImages.length}`;
    appContext.$("imageLightboxPrev").hidden = appContext.lightboxImages.length <= 1;
    appContext.$("imageLightboxNext").hidden = appContext.lightboxImages.length <= 1;
    Array.from(appContext.$("imageLightboxThumbs").querySelectorAll(".image-lightbox-thumb")).forEach((thumb,i)=>{
      thumb.classList.toggle("active", i === appContext.lightboxIndex);
      if(i === appContext.lightboxIndex) thumb.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
    });
  }

function openImageLightbox(images, startIndex){
    appContext.lightboxImages = (images || []).filter(Boolean);
    if(!appContext.lightboxImages.length) return;
    appContext.$("imageLightboxThumbs").innerHTML = appContext.lightboxImages.map((img,i)=>
      `<img class="image-lightbox-thumb ${i===startIndex?"active":""}" src="${appContext.escapeHtml(img)}" data-lightbox-index="${i}" alt="Thumbnail ${i+1}">`
    ).join("");
    appContext.$("imageLightboxThumbs").querySelectorAll("[data-lightbox-index]").forEach(thumb=>{
      thumb.addEventListener("click", ()=>appContext.renderLightboxImage(Number(thumb.dataset.lightboxIndex)));
    });
    appContext.$("imageLightbox").hidden = false;
    document.body.style.overflow = "hidden";
    appContext.imageLightboxKeyboard?.open();
    appContext.renderLightboxImage(startIndex || 0);
  }

function closeImageLightbox(){
    appContext.$("imageLightbox").hidden = true;
    appContext.$("imageLightboxImg").src = "";
    appContext.$("imageLightboxThumbs").innerHTML = "";
    appContext.lightboxImages = [];
    appContext.lightboxIndex = 0;
    document.body.style.overflow = "";
    appContext.imageLightboxKeyboard?.close();
  }

function safeDownloadName(value){
    const clean = String(value || "card")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0,80);
    return clean || "card";
  }

function getDownloadStatusWatermarkMeta(availability){
    const value = String(availability || "").trim().toLowerCase();
    if(value === "sold"){
      return {
        label:"SOLD",
        color:"#ff1f1f",
        shadow:"rgba(140,0,0,.30)",
        textColor:"#ffffff",
        strokeColor:"rgba(0,0,0,.20)"
      };
    }
    if(value === "reserved"){
      return {
        label:"RESERVE",
        color:"#ffd400",
        shadow:"rgba(140,112,0,.30)",
        textColor:"#171717",
        strokeColor:"rgba(255,255,255,.35)"
      };
    }
    return null;
  }

async function createStatusWatermarkedDownloadBlob(src, availability){
    const meta = appContext.getDownloadStatusWatermarkMeta(availability);
    if(!meta) return null;

    const loaded = await appContext.loadImageElementFromSource(src);
    if(!loaded || !loaded.img) throw new Error("Could not load image for watermarking");

    const {img} = loaded;
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    if(!width || !height) throw new Error("Invalid image size");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if(!ctx) throw new Error("Could not get canvas context");

    ctx.drawImage(img,0,0,width,height);

    const tri = Math.max(210, Math.min(Math.round(Math.min(width,height) * 0.38), 620));

    // Filled top-left triangle.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(tri,0);
    ctx.lineTo(0,tri);
    ctx.closePath();
    ctx.fillStyle = meta.color;
    ctx.shadowColor = meta.shadow;
    ctx.shadowBlur = Math.max(16, Math.round(tri * 0.09));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(2, Math.round(tri * 0.02));
    ctx.fill();
    ctx.restore();

    // Subtle inner stroke for definition.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(tri,0);
    ctx.lineTo(0,tri);
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,.24)";
    ctx.lineWidth = Math.max(3, Math.round(tri * 0.014));
    ctx.stroke();
    ctx.restore();

    // Diagonal text centered in the triangle.
    ctx.save();
    const text = meta.label;
    const diagonalFont = text.length > 5
      ? Math.round(tri * 0.18)
      : Math.round(tri * 0.205);
    ctx.translate(tri * 0.355, tri * 0.355);
    ctx.rotate(-Math.PI / 4);
    ctx.font = `900 ${Math.max(18, diagonalFont)}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(7, Math.round(tri * 0.038));
    ctx.strokeStyle = meta.strokeColor || "rgba(0,0,0,.20)";
    ctx.strokeText(text,0,0);
    ctx.fillStyle = meta.textColor || "#ffffff";
    ctx.fillText(text,0,0);
    ctx.restore();

    return new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>{
        if(blob) resolve(blob);
        else reject(new Error("Could not encode watermarked image"));
      },"image/jpeg",0.94);
    });
  }

async function downloadImageSource(src, filenameBase, imageNumber = 1, cardOrAvailability = null){
    if(!src) return;

    const filename = `${appContext.safeDownloadName(filenameBase)}-${imageNumber}.jpg`;

    try{
      let href = src;
      let revoke = false;
      const availability = typeof cardOrAvailability === "string"
        ? cardOrAvailability
        : cardOrAvailability?.availability;

      const watermarkMeta = appContext.getDownloadStatusWatermarkMeta(availability);
      if(watermarkMeta){
        const watermarkedBlob = await appContext.createStatusWatermarkedDownloadBlob(src, availability);
        href = URL.createObjectURL(watermarkedBlob);
        revoke = true;
      }else if(!/^data:/i.test(src) && !/^blob:/i.test(src)){
        const response = await appContext.fetch(src, {
          mode:"cors",
          credentials:"omit",
          referrerPolicy:"no-referrer"
        });
        if(!response.ok) throw new Error("download fetch failed");
        const blob = await response.blob();
        href = URL.createObjectURL(blob);
        revoke = true;
      }

      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();

      if(revoke){
        setTimeout(()=>URL.revokeObjectURL(href), 1000);
      }
    }catch(err){
      console.warn("Direct image download failed:", err);
      // Legacy external images may block CORS. Open them safely rather than
      // weakening browser security or proxying through an owner credential.
      const opened=appContext.openSafeExternalUrl(src);
      appContext.showToast(opened ? "Opened image in a new tab" : "Image could not be opened safely");
    }
  }

async function createInventoryQrDownloadBlob(card){
    if(typeof appContext.createCollectionCollageQrCode !== "function") throw new Error("QR generator unavailable");

    const qrGraphic = await appContext.createCollectionCollageQrCode(appContext.CARD_WATERMARK_URL, 720);
    const logo = (typeof appContext.loadWatermarkLogo === "function")
      ? await appContext.loadWatermarkLogo().catch(()=>null)
      : null;

    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 2000;
    const ctx = canvas.getContext("2d");
    if(!ctx) throw new Error("Could not get canvas context");
    ctx.imageSmoothingEnabled = true;
    if("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";

    const bg = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
    bg.addColorStop(0,"#0f172a");
    bg.addColorStop(0.5,"#101826");
    bg.addColorStop(1,"#172235");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Decorative accents
    const glowA = ctx.createRadialGradient(280,240,40,280,240,420);
    glowA.addColorStop(0,"rgba(74,203,184,0.24)");
    glowA.addColorStop(1,"rgba(74,203,184,0)");
    ctx.fillStyle = glowA;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const glowB = ctx.createRadialGradient(1310,1710,50,1310,1710,460);
    glowB.addColorStop(0,"rgba(236,192,87,0.20)");
    glowB.addColorStop(1,"rgba(236,192,87,0)");
    ctx.fillStyle = glowB;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 2;
    for(let x=110; x<canvas.width; x+=230){
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.lineTo(x,canvas.height);
      ctx.stroke();
    }
    for(let y=110; y<canvas.height; y+=230){
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(canvas.width,y);
      ctx.stroke();
    }
    ctx.restore();

    const panelX = 140;
    const panelY = 140;
    const panelW = canvas.width - panelX*2;
    const panelH = canvas.height - 280;
    const radius = 46;
    const roundRect = (x,y,w,h,r)=>{
      ctx.beginPath();
      if(typeof ctx.roundRect === "function"){
        ctx.roundRect(x,y,w,h,r);
      }else{
        ctx.moveTo(x+r,y);
        ctx.lineTo(x+w-r,y);
        ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r);
        ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h);
        ctx.quadraticCurveTo(x,y+h,x,y+h-r);
        ctx.lineTo(x,y+r);
        ctx.quadraticCurveTo(x,y,x+r,y);
        ctx.closePath();
      }
    };

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 38;
    ctx.shadowOffsetY = 16;
    roundRect(panelX,panelY,panelW,panelH,radius);
    ctx.fillStyle = "rgba(255,255,255,0.975)";
    ctx.fill();
    ctx.restore();

    roundRect(panelX,panelY,panelW,panelH,radius);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(236,192,87,0.88)";
    ctx.stroke();

    // Canvas text does not wrap automatically. Keep every line inside the
    // white panel, including very long card names from the Inventory export.
    const contentWidth = panelW - 180;
    const fitLine = (text,maxWidth,ellipsis=false)=>{
      let value = String(text || "").trim();
      if(ctx.measureText(value).width <= maxWidth) return value;
      const suffix = ellipsis ? "…" : "";
      while(value && ctx.measureText(value + suffix).width > maxWidth){
        value = value.slice(0,-1).trimEnd();
      }
      return value + suffix;
    };
    const drawCenteredLines = (text,y,{font,color,maxWidth=contentWidth,lineHeight,maxLines=2})=>{
      ctx.font = font;
      const words = String(text || "").trim().split(/\s+/).filter(Boolean);
      const lines = [];
      let line = "";
      words.forEach(word=>{
        const safeWord = fitLine(word,maxWidth,true);
        const candidate = line ? `${line} ${safeWord}` : safeWord;
        if(ctx.measureText(candidate).width <= maxWidth){
          line = candidate;
        }else if(line){
          lines.push(line);
          line = safeWord;
        }else{
          line = safeWord;
        }
      });
      if(line) lines.push(line);
      if(lines.length > maxLines){
        lines.length = maxLines;
        let finalLine = lines[maxLines-1];
        while(finalLine && ctx.measureText(`${finalLine}…`).width > maxWidth){
          finalLine = finalLine.slice(0,-1).trimEnd();
        }
        lines[maxLines-1] = `${finalLine}…`;
      }
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = color;
      lines.forEach((entry,index)=>ctx.fillText(entry,canvas.width/2,y+index*lineHeight));
      ctx.restore();
      return y + lines.length*lineHeight;
    };

    let copyY = panelY + 80;
    copyY = drawCenteredLines("Scan to browse our Inventory",copyY,{
      font:"800 88px Inter, Arial, sans-serif",color:"#0f172a",lineHeight:96,maxLines:2
    }) + 14;
    copyY = drawCenteredLines("Collect TCG",copyY,{
      font:"800 106px Inter, Arial, sans-serif",color:"#111827",lineHeight:116,maxLines:1
    }) + 16;
    copyY = drawCenteredLines("More cards, more photos, prices and updates on our website",copyY,{
      font:"700 48px Inter, Arial, sans-serif",color:"rgba(17,24,39,0.78)",lineHeight:62,maxLines:2
    }) + 20;

    if(card){
      const line = [card.card_code, card.name].filter(Boolean).join(" • ");
      if(line){
        copyY = drawCenteredLines(line,copyY,{
          font:"600 34px Inter, Arial, sans-serif",color:"rgba(17,24,39,0.62)",lineHeight:46,maxLines:2
        }) + 18;
      }
    }

    const qrSize = 720;
    const qrX = Math.round((canvas.width-qrSize)/2);
    const qrY = Math.max(panelY + 650,Math.round(copyY + 18));
    roundRect(qrX-24, qrY-24, qrSize+48, qrSize+48, 32);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.drawImage(qrGraphic, qrX, qrY, qrSize, qrSize);

    let footerY = qrY + qrSize + 62;
    footerY = drawCenteredLines("Open the full website inventory",footerY,{
      font:"700 46px Inter, Arial, sans-serif",color:"rgba(17,24,39,0.92)",lineHeight:54,maxLines:1
    }) + 10;
    drawCenteredLines("collecttcg.github.io/Collect_TCG/#/inventory",footerY,{
      font:"500 30px 'JetBrains Mono', monospace",color:"rgba(17,24,39,0.78)",lineHeight:38,maxLines:1
    });

    drawCenteredLines("Thank you for supporting Collect TCG",panelY + panelH - 84,{
      font:"500 28px Inter, Arial, sans-serif",color:"rgba(17,24,39,0.58)",lineHeight:34,maxLines:1
    });

    if(logo){
      const logoSize = 152;
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 12;
      ctx.drawImage(logo, canvas.width - panelX - logoSize, canvas.height - panelY - logoSize, logoSize, logoSize);
      ctx.restore();
    }

    return new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>{
        if(blob) resolve(blob);
        else reject(new Error("Could not encode inventory QR image"));
      },"image/png");
    });
  }

async function downloadInventoryQrImage(){
    if(!appContext.requireOwner("download Inventory QR")) return false;

    try{
      const blob=await appContext.createInventoryQrDownloadBlob(null);
      const href=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=href;
      link.download="Collect-TCG-Inventory-QR.png";
      link.rel="noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(href),1000);
      appContext.showToast("Inventory QR downloaded");
      return true;
    }catch(error){
      console.warn("Could not download Inventory QR:",error);
      appContext.showToast("Could not create the Inventory QR. Please try again.");
      return false;
    }
  }

async function downloadSingleCardImagesZip(card, progressCallback){
    if(!card) return {added:0, failed:[]};
    const images = appContext.getImages(card);
    if(!images.length) return {added:0, failed:[]};
    const ZipCtor = await appContext.ensureJsZip();
    const zip = new ZipCtor();
    const failed = [];
    let added = 0;
    const soldWatermark = appContext.shouldApplySoldDownloadWatermark(card);

    const totalItems = images.length + 1;
    for(let i=0;i<images.length;i++){
      try{
        const blob = soldWatermark
          ? await appContext.renderSoldDownloadBlob(images[i], card)
          : await appContext.imageSourceToBlob(images[i]);
        const ext = soldWatermark ? "jpg" : appContext.imageExtensionFromBlob(blob);
        const base = appContext.safeDownloadName(
          [card.card_code, card.name].filter(Boolean).join(" - ") || "card"
        );
        const filename = `${String(i+1).padStart(2,"0")} - ${base}.${ext}`;
        zip.file(filename, blob);
        added++;
      }catch(err){
        failed.push({
          index:i+1,
          reason:err?.message || "Image could not be read"
        });
        console.warn("Could not add single-card image to ZIP:", card?.id, i+1, err);
      }

      if(progressCallback) progressCallback(i+1, totalItems, added, failed.length);
    }

    try{
      const qrBlob = await appContext.createInventoryQrDownloadBlob(card);
      const qrIndex = images.length + 1;
      const qrFilename = `${String(qrIndex).padStart(2,"0")} - Inventory QR.png`;
      zip.file(qrFilename, qrBlob);
      added++;
    }catch(err){
      failed.push({
        index:images.length + 1,
        reason:err?.message || "Inventory QR could not be created"
      });
      console.warn("Could not add Inventory QR image to ZIP:", card?.id, err);
    }

    if(progressCallback) progressCallback(totalItems, totalItems, added, failed.length);

    if(!added){
      const error = new Error(
        failed.length
          ? `None of the ${failed.length} card images could be added to the ZIP.`
          : "No downloadable card images found"
      );
      error.failed = failed;
      throw error;
    }

    const blob = await zip.generateAsync({
      type:"blob",
      compression:"DEFLATE",
      compressionOptions:{level:6}
    });

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${appContext.safeDownloadName(
      [card.card_code, card.name].filter(Boolean).join(" - ") || "Collect-TCG-Card"
    )}.zip`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),1500);

    return {added, failed};
  }

function getWebsiteShareUrl(){
    // Keep the deployed GitHub Pages sub-path, but exclude route/hash state.
    try{
      const url=new URL(location.href);
      url.hash="";
      url.search="";
      return url.toString();
    }catch{
      return `${location.origin}${location.pathname}`;
    }
  }

function getCardShareUrl(cardId){
    const id=appContext.safeCardId(cardId);
    const card=id ? appContext.getCardById(id) : null;
    const clean=card ? appContext.publishedSeoCardUrl(card) : "";
    if(clean) return clean;

    const base = `${location.origin}${location.pathname}${location.search}`;
    return `${base}${appContext.cardShareHash(cardId)}`;
  }

function publicCardSharePreview(card){
    if(!card) return "";
    const status=appContext.canonicalAvailability(card.availability);
    const priceText=status==="Collection (NFS)"
      ? "NOT FOR SALE"
      : (appContext.orderedCardPrices(card)[0]
          ? appContext.formatCurrencyValue(appContext.orderedCardPrices(card)[0].currency,appContext.orderedCardPrices(card)[0].value)
          : "Price: Please inquire");

    return [
      card.name||"Trading card",
      card.card_code ? `Card Code: ${card.card_code}` : "",
      priceText,
      "Collect TCG MY & SG"
    ].filter(Boolean).join(" · ");
  }

async function copySharePreview(card){
    const text=`${appContext.publicCardSharePreview(card)}\n${appContext.getCardShareUrl(card.id)}`;
    return appContext.copyTextToClipboard(text);
  }

async function loadPublicSharePreviewImage(src){
    const safe=appContext.safeHttpUrl(src||"");
    if(!safe) return null;
    try{
      const response=await appContext.fetch(safe,{
        method:"GET",
        mode:"cors",
        credentials:"omit",
        referrerPolicy:"no-referrer"
      });
      if(!response.ok) return null;
      const blob=await response.blob();
      if(!String(blob.type||"").startsWith("image/")) return null;

      const objectUrl=URL.createObjectURL(blob);
      try{
        return await new Promise((resolve,reject)=>{
          const img=new Image();
          img.onload=()=>resolve(img);
          img.onerror=()=>reject(new Error("share preview image decode failed"));
          img.src=objectUrl;
        });
      }finally{
        setTimeout(()=>URL.revokeObjectURL(objectUrl),0);
      }
    }catch{
      return null;
    }
  }

async function createPublicCardSharePreviewBlob(card){
    if(!card || (!appContext.isOwnerMode() && !appContext.isLiveLifecycle(card))) return null;
    await appContext.ensureCardImagesLoaded(card);

    const canvas=document.createElement("canvas");
    canvas.width=1200;
    canvas.height=1500;
    const ctx=canvas.getContext("2d",{alpha:false});
    if(!ctx) return null;

    ctx.fillStyle="#111216";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const imageSrc=appContext.getImages(card)[0]||"";
    const img=await appContext.loadPublicSharePreviewImage(imageSrc);
    if(img){
      const box={x:70,y:70,w:1060,h:860};
      const scale=Math.min(box.w/img.naturalWidth,box.h/img.naturalHeight);
      const w=Math.round(img.naturalWidth*scale);
      const h=Math.round(img.naturalHeight*scale);
      const x=box.x+Math.round((box.w-w)/2);
      const y=box.y+Math.round((box.h-h)/2);

      ctx.fillStyle="#1a1c22";
      ctx.fillRect(box.x,box.y,box.w,box.h);
      ctx.imageSmoothingEnabled=true;
      if("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality="high";
      ctx.drawImage(img,x,y,w,h);
    }

    const primary=appContext.orderedCardPrices(card)[0];
    const status=appContext.canonicalAvailability(card.availability);
    const priceText=status==="Collection (NFS)"
      ? "NOT FOR SALE"
      : (primary ? appContext.formatCurrencyValue(primary.currency,primary.value) : "Please inquire");

    ctx.fillStyle="#f5f5f7";
    ctx.font="800 58px Arial,sans-serif";

    const words=String(card.name||"Trading card").toUpperCase().split(/\s+/);
    const lines=[];
    let line="";
    for(const word of words){
      const test=(line+" "+word).trim();
      if(line && ctx.measureText(test).width>1060){
        lines.push(line);
        line=word;
      }else{
        line=test;
      }
    }
    if(line) lines.push(line);
    lines.slice(0,3).forEach((text,index)=>ctx.fillText(text,70,1030+(index*68)));

    ctx.fillStyle="#9da0aa";
    ctx.font="500 31px Arial,sans-serif";
    ctx.fillText([card.card_code,card.year,appContext.compareGradeLabel(card)].filter(Boolean).join(" · "),70,1255);

    ctx.fillStyle="#e3b341";
    ctx.font="800 50px Arial,sans-serif";
    ctx.fillText(priceText,70,1340);

    ctx.fillStyle="#5fd4c4";
    ctx.font="700 29px Arial,sans-serif";
    ctx.fillText("Collect TCG MY & SG",70,1420);

    return appContext.canvasToBlob(canvas,.94,"image/jpeg");
  }

async function downloadPublicCardSharePreview(card){
    const blob=await appContext.createPublicCardSharePreviewBlob(card);
    if(!blob){
      appContext.showToast("Could not create share preview");
      return false;
    }

    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=safeDownloadFilename(`${card.card_code||card.name||"card"}-share-preview.jpg`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    appContext.showToast("Share preview downloaded");
    return true;
  }

async function shareCurrentCard(){
    const card = appContext.getDetailsCard();
    if(!card || (!appContext.isOwnerMode() && !appContext.isLiveLifecycle(card))) return;

    const url=appContext.getCardShareUrl(card.id);
    const preview=appContext.publicCardSharePreview(card);

    if(navigator.share){
      let linkCopied=false;
      try{
        if(navigator.clipboard?.writeText){
          await navigator.clipboard.writeText(url);
          linkCopied=true;
          appContext.showToast("Link copied — choose an app to share");
          appContext.recordCardEngagement(card.id,"share","Copy Link").catch(()=>{});
          // Keep the confirmation visible long enough to notice before the OS share sheet covers the page.
          await new Promise(resolve=>setTimeout(resolve,900));
        }
      }catch(error){
        console.warn("Could not pre-copy card link",error);
      }

      try{
        await navigator.share({
          title:card.name||"Collect TCG MY & SG",
          text:preview,
          url
        });
        appContext.recordCardEngagement(card.id,"share","Native Share").catch(()=>{});
        return;
      }catch(error){
        if(error?.name==="AbortError"){
          if(linkCopied) appContext.showToast("Link copied to clipboard");
          return;
        }
      }

      if(linkCopied){
        appContext.showToast("Link copied to clipboard");
        return;
      }
    }

    const copied=await appContext.copySharePreview(card);
    if(copied) appContext.recordCardEngagement(card.id,"share","Copy Link").catch(()=>{});
    appContext.showToast(copied ? "Card preview and link copied" : "Could not copy card link");
  }

function contactCardReferenceLines(card){
    if(!card) return [];

    const status=appContext.canonicalAvailability(card.availability);
    const gradeCondition=appContext.compareGradeLabel(card);
    const prices=appContext.orderedCardPrices(card);
    const priceText=status==="Collection (NFS)"
      ? "NOT FOR SALE"
      : (prices[0] ? appContext.formatCurrencyValue(prices[0].currency,prices[0].value) : "Please inquire");

    return [
      `Name: ${card.name||"Trading card"}`,
      card.card_code ? `Card Code: ${card.card_code}` : "",
      gradeCondition ? `Grade / Condition: ${gradeCondition}` : "",
      card.language ? `Language: ${String(card.language).toUpperCase()}` : "",
      `Price: ${priceText}`,
      `Link: ${appContext.getCardShareUrl(card.id)}`
    ].filter(Boolean);
  }

function publicContactSellerMessage(card){
    if(!card) return "";

    const status=appContext.canonicalAvailability(card.availability);
    const opening=status==="Collection (NFS)"
      ? "Hi, I have a question about this Collection / NFS card:"
      : (status==="Sold"
          ? "Hi, I have a question about this sold card:"
          : (status==="Reserved"
              ? "Hi, I have a question about this reserved card:"
              : "Hi, I'm interested in this card:"));

    return [
      opening,
      "",
      ...appContext.contactCardReferenceLines(card)
    ].join("\n");
  }

function contactInquiryIntent(){
    const allowed=new Set(["availability","offer","photos","shipping","cod"]);
    return allowed.has(appContext.contactInquiryIntentState)
      ? appContext.contactInquiryIntentState
      : "availability";
  }

function setContactInquiryIntent(intent){
    const allowed=new Set(["availability","offer","photos","shipping","cod"]);
    appContext.contactInquiryIntentState=allowed.has(intent) ? intent : "availability";
    return appContext.contactInquiryIntentState;
  }

function contactInquiryMessage(card,intent=appContext.contactInquiryIntent()){
    if(!card) return "";

    const chosen=appContext.setContactInquiryIntent(intent);
    const messages={
      availability:"Hi, is this card still available?",
      offer:"Hi, I'm interested in this card. Would you be open to an offer?",
      photos:"Hi, I'm interested in this card. Could I get more photos or a short video?",
      shipping:"Hi, I'm interested in this card. Is international shipping available to my location?",
      cod:"Hi, I'm interested in this card. Is COD / meetup available in Malaysia or Singapore?"
    };

    return [
      messages[chosen]||messages.availability,
      "",
      ...appContext.contactCardReferenceLines(card)
    ].join("\n");
  }

function contactIntentButtonsHtml(extraClass=""){
    const active=appContext.contactInquiryIntent();
    const items=[
      ["availability","Availability"],
      ["offer","Make an offer"],
      ["photos","More photos / video"],
      ["shipping","Shipping / delivery"],
      ["cod","COD / meetup"]
    ];
    return `
      <div class="details-contact-intents ${appContext.escapeHtml(extraClass)}" aria-label="What would you like to ask?">
        <span>What would you like to ask?</span>
        <div>
          ${items.map(([value,label])=>`
            <button type="button"
                    class="${active===value?"active":""}"
                    data-details-inquiry-intent="${value}"
                    aria-pressed="${active===value?"true":"false"}">${label}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

function detailsContactSocialLinksHtml(extraClass=""){
    const messengerUrl = appContext.COLLECT_TCG_FACEBOOK_MESSENGER_URL || "https://m.me/61590041416102";
    return `
      <div class="collect-social-links ${appContext.escapeHtml(extraClass)}" aria-label="Collect TCG contact links">
        <a href="${appContext.COLLECT_SOCIAL_LINKS.instagram}" target="_blank" rel="noopener noreferrer" class="collect-social-icon" data-details-contact-platform="Instagram" aria-label="Instagram" title="Instagram"><span aria-hidden="true">◎</span><small>IG</small></a>
        <a href="${messengerUrl}" target="_blank" rel="noopener noreferrer" class="collect-social-icon" data-details-contact-platform="Facebook Messenger" aria-label="Message us on Facebook Messenger" title="Message us on Facebook Messenger"><span aria-hidden="true">f</span><small>FB</small></a>
        <a href="${appContext.COLLECT_SOCIAL_LINKS.carousellMY}" target="_blank" rel="noopener noreferrer" class="collect-social-icon" data-details-contact-platform="Carousell Malaysia" aria-label="Carousell Malaysia" title="Carousell Malaysia"><span aria-hidden="true">C</span><small>MY</small></a>
        <a href="${appContext.COLLECT_SOCIAL_LINKS.carousellSG}" target="_blank" rel="noopener noreferrer" class="collect-social-icon" data-details-contact-platform="Carousell Singapore" aria-label="Carousell Singapore" title="Carousell Singapore"><span aria-hidden="true">C</span><small>SG</small></a>
      </div>
    `;
  }

async function messageSellerOnFacebook(){
    const card = appContext.getDetailsCard();
    if(!card || (!appContext.isOwnerMode() && !appContext.isLiveLifecycle(card))) return;

    // Messenger does not reliably support arbitrary prefilled text in a safe
    // public URL. Open the fixed seller destination and copy the public card
    // reference so the buyer can paste it. No owner-only data enters the URL.
    const opened=appContext.openSafeExternalUrl(appContext.COLLECT_TCG_FACEBOOK_MESSENGER_URL);

    const copied=await appContext.copyTextToClipboard(appContext.publicContactSellerMessage(card));

    if(copied){
      appContext.showToast(opened
        ? "Card reference copied — paste it into Facebook Messenger"
        : "Card reference copied — allow pop-ups to open Facebook Messenger");
    }else if(!opened){
      appContext.showToast("Allow pop-ups to open Facebook Messenger");
    }else{
      appContext.showToast("Facebook Messenger opened");
    }
  }

function shareCurrentCardWhatsApp(){
    const card = appContext.getDetailsCard();
    if(!card) return;

    const url=appContext.getCardShareUrl(card.id);
    const message=[
      card.name||"Trading card",
      card.card_code ? `Card Code: ${card.card_code}` : "",
      url
    ].filter(Boolean).join("\n");

    // Fixed WhatsApp endpoint; only the encoded message is variable.
    const shareUrl=`https://wa.me/?text=${encodeURIComponent(message)}`;
    const opened=appContext.openSafeExternalUrl(shareUrl);
    if(!opened) appContext.showToast("Allow pop-ups to share via WhatsApp");
  }

function getSameSeriesNeighbors(card){
    const series=appContext.normalizeFilterValue(card?.series||"");
    if(!series) return {previous:null,next:null,total:0,index:-1};

    const list=appContext.cards
      .filter(c=>appContext.isLiveLifecycle(c) && appContext.normalizeFilterValue(c.series||"")===series)
      .slice()
      .sort((a,b)=>
        Number(a.year||9999)-Number(b.year||9999) ||
        String(a.card_code||"").localeCompare(String(b.card_code||"")) ||
        String(a.name||"").localeCompare(String(b.name||""))
      );

    const index=list.findIndex(c=>String(c.id)===String(card.id));
    return {
      previous:index>0 ? list[index-1] : null,
      next:index>=0 && index<list.length-1 ? list[index+1] : null,
      total:list.length,
      index,
      ids:list.map(item=>String(item.id))
    };
  }

function sameSeriesNavigationIsRedundant(seriesNav,filteredNav){
    if(!seriesNav || !filteredNav || seriesNav.total<=1 || filteredNav.total<=1) return false;
    if(seriesNav.total!==filteredNav.total) return false;

    const context=appContext.getFilteredResultsBrowseContext();
    if(!context || context.ids.length!==seriesNav.ids.length) return false;

    return seriesNav.ids.every((id,index)=>id===context.ids[index]);
  }

function replaceCardRouteWithoutRefresh(cardId){
    const id=appContext.safeCardId(cardId);
    if(!id) return;
    const card=appContext.getCardById(id);
    const clean=card && appContext.isLiveLifecycle(card)
      ? appContext.publishedSeoCardUrl(card)
      : "";
    const target=clean || appContext.cardShareHash(id);
    try{
      const state=history.state && typeof history.state==="object"
        ? {...history.state}
        : {};
      if(state.collectTcgSpaCard){
        state.collectTcgSpaCardId=id;
      }
      history.replaceState(state,"",target);
    }catch{
      // Do not fall back to location.hash here: that would trigger router()
      // and recreate the modal, which is exactly what this smooth path avoids.
    }
  }

function smoothNavigateDetailsCard(cardId,direction="next"){
    const id=appContext.safeCardId(cardId);
    if(!id || appContext.detailsCardTransitioning) return;

    const card=appContext.getCardById(id);
    if(!card || (!appContext.isOwnerMode() && !appContext.isLiveLifecycle(card))) return;

    appContext.detailsCardTransitioning=true;
    if(appContext.detailsCardTransitionTimer){
      clearTimeout(appContext.detailsCardTransitionTimer);
      appContext.detailsCardTransitionTimer=null;
    }

    const modal=appContext.$("detailsModal");
    const mount=appContext.detailsMount;
    const outgoingClass=direction==="previous"
      ? "details-card-slide-out-right"
      : "details-card-slide-out-left";
    const incomingClass=direction==="previous"
      ? "details-card-slide-in-left"
      : "details-card-slide-in-right";

    mount.classList.remove(
      "details-card-slide-out-left",
      "details-card-slide-out-right",
      "details-card-slide-in-left",
      "details-card-slide-in-right"
    );
    mount.classList.add("details-card-transitioning",outgoingClass);

    appContext.detailsCardTransitionTimer=setTimeout(()=>{
      appContext.replaceCardRouteWithoutRefresh(id);

      // Re-render only the contents inside the already-open modal.
      // The overlay itself never closes, so there is no flash/reopen effect.
      appContext.openDetailsModal(card);

      if(modal){
        try{modal.scrollTo({top:0,left:0,behavior:"auto"});}catch{modal.scrollTop=0;}
      }

      mount.classList.remove(outgoingClass);
      mount.classList.add(incomingClass);

      requestAnimationFrame(()=>{
        requestAnimationFrame(()=>{
          mount.classList.remove(incomingClass);
          appContext.detailsCardTransitionTimer=setTimeout(()=>{
            mount.classList.remove("details-card-transitioning");
            appContext.detailsCardTransitioning=false;
            appContext.detailsCardTransitionTimer=null;
          },170);
        });
      });
    },105);
  }

function syncDetailsFavoriteButton(card){
    const btn=appContext.$("detailsFavoriteBtn");
    if(!btn || !card) return;

    const fav=appContext.isFavorite(card.id);
    btn.classList.toggle("active",fav);
    btn.setAttribute("aria-label",fav ? "Remove from favorites" : "Add to favorites");

    const icon=btn.querySelector("[data-favorite-icon]");
    const desktop=btn.querySelector("[data-favorite-label-desktop]");
    const mobile=btn.querySelector("[data-favorite-label-mobile]");

    if(icon) icon.textContent=fav ? "♥" : "♡";
    if(desktop) desktop.textContent=fav ? "Favorited" : "Favorite";
    if(mobile) mobile.textContent=fav ? "Saved" : "Fav";
  }

function closeDetailsMoreMenu(restoreFocus=false){
    const menu=appContext.detailsMoreMenuEl;
    const btn=appContext.$("detailsMoreBtn");
    const wasOpen=!!menu && !menu.hidden;

    if(menu) menu.hidden=true;
    if(btn) btn.setAttribute("aria-expanded","false");

    if(restoreFocus && wasOpen && btn && !appContext.detailsOverlay.hidden){
      try{btn.focus({preventScroll:true});}catch{btn.focus();}
    }
  }

function toggleDetailsMoreMenu(){
    const menu=appContext.detailsMoreMenuEl;
    const btn=appContext.$("detailsMoreBtn");
    if(!menu || !btn) return;

    const willOpen=menu.hidden;
    menu.hidden=!willOpen;
    btn.setAttribute("aria-expanded",willOpen ? "true" : "false");

    if(willOpen){
      const first=menu.querySelector('button:not([hidden])');
      first?.focus({preventScroll:true});
    }
  }

async function refreshOwnerCardConversionSummary(cardId){
    const id=appContext.safeCardId(cardId);
    if(!id || !appContext.isOwnerMode() || typeof appContext.fetchOwnerCardConversionSummary!=="function") return;

    const summary=await appContext.fetchOwnerCardConversionSummary(id);
    if(!summary || !appContext.isOwnerMode() || String(appContext.detailsCardId)!==id) return;

    const setValue=(key,value)=>{
      const el=appContext.detailsMount?.querySelector(`[data-owner-conversion="${key}"]`);
      if(el) el.textContent=String(value);
    };

    setValue("qualified",Number(summary.qualified_views||0).toLocaleString());
    setValue("unique",Number(summary.unique_views||0).toLocaleString());
    setValue("favorites",Number(summary.favorite_adds||0).toLocaleString());
    setValue("intent",Number(summary.intent_count||0).toLocaleString());
    setValue("intent-rate",`${Number(summary.intent_rate||0).toFixed(1)}%`);
  }

async function openDetailsModal(card){
    if(!card) return;
    const openRequestId=++appContext.detailsOpenRequestId;
    const openRequestHash=location.hash;

    // Preserve the customer's current keyboard/focus position so closing
    // details returns them to the card they were browsing.
    if(appContext.detailsOverlay.hidden){
      appContext.detailsLastFocusedElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    }

    await appContext.ensureCardImagesLoaded(card);
    // Ignore an older image request after closing, navigating, or opening another card.
    if(openRequestId!==appContext.detailsOpenRequestId || location.hash!==openRequestHash) return;
    if(!appContext.isOwnerMode() && !appContext.isLiveLifecycle(card)){
      appContext.showToast("Card not found");
      return;
    }
    appContext.rememberRecentlyViewed(card && card.id);
    appContext.detailsCardId = card.id;
    appContext.detailsImageIndex = 0;

    // Clear the reused modal's previous position immediately. A second,
    // post-render reset below guarantees the new card starts at the top on
    // mobile browsers that restore scroll after DOM/layout changes.
    const detailsModal = appContext.detailsOverlay?.querySelector(".card-details-modal");
    if(detailsModal){
      detailsModal.scrollTop = 0;
      detailsModal.scrollLeft = 0;
    }

    appContext.recordCardViewEvent(card);
    const images = appContext.getImages(card);
    const imageHTML = images.length
      ? `<div class="detail-slider" data-card-slider>
          <div class="detail-slider-stage">
            <img class="detail-slider-image" src="${appContext.escapeHtml(images[0])}" alt="${appContext.escapeHtml(card.name)} image 1" decoding="async" fetchpriority="high">
            ${appContext.isNewCard(card) ? `<span class="new-card-badge detail-new-card-badge" aria-label="New this week">NEW</span>` : ""}
            ${appContext.statusCornerHTML(card)}
          </div>
          ${images.length > 1 ? `
            <button type="button" class="detail-slider-btn prev" aria-label="Previous image">‹</button>
            <button type="button" class="detail-slider-btn next" aria-label="Next image">›</button>
            <div class="detail-slider-count">1 / ${images.length}</div>
            <div class="detail-slider-dots">
              ${images.map((_,i)=>`<button type="button" class="detail-slider-dot ${i===0?"active":""}" data-slide="${i}" aria-label="Image ${i+1}"></button>`).join("")}
            </div>
            <div class="detail-thumb-strip-wrap">
              <div class="detail-thumb-strip-head"><strong>More photos</strong><span>${images.length} photos · Tap a thumbnail</span></div>
              <div class="detail-thumb-strip" aria-label="Card photo thumbnails">
                ${images.map((src,i)=>`<button type="button" class="detail-thumb-strip-btn ${i===0?"active":""}" data-detail-thumb="${i}" aria-label="Show image ${i+1}"><img src="${appContext.escapeHtml(src)}" alt="${appContext.escapeHtml(card.name)} thumbnail ${i+1}" loading="lazy" decoding="async"></button>`).join("")}
              </div>
            </div>` : ""}
        </div>`
      : `<div class="detail-empty-image">No uploaded pictures</div>`;

    const detailGrades = appContext.validGradingEntries(card);
    const hasGrade = detailGrades.length > 0;
    const condition = appContext.CONDITION_LABEL[card.condition] || card.condition || "—";
    const detailCondition = hasGrade
      ? appContext.gradingSummaryLabel(card)
      : condition;
    const detailPop = detailGrades.length===1 ? appContext.gradePopDetailLabel(detailGrades[0]) : "";
    const detailSlabRows = detailGrades.length>1
      ? detailGrades.map((g,i)=>{
          const gradeLabel=`${String(g.company||"").trim().toUpperCase()} ${String(g.grade||"").trim()}`.trim();
          const popLabel=appContext.gradePopDetailLabel(g);
          const cert=String(g.cert||"").trim();
          return `<div class="detail-slab-row">
            <div>
              <span class="detail-slab-number">Slab ${i+1}</span>
              <strong>${appContext.escapeHtml(gradeLabel)}</strong>
            </div>
            <div class="detail-slab-meta">
              ${popLabel ? `<span class="detail-slab-pop">${appContext.escapeHtml(popLabel)}</span>` : ""}
              ${appContext.isOwnerMode() && cert ? `<span class="detail-slab-cert">Cert ${appContext.escapeHtml(cert)}</span>` : ""}
            </div>
          </div>`;
        }).join("")
      : "";

    const detailSlabBreakdown = detailGrades.length>1
      ? `<div class="detail-slab-list detail-slab-list-desktop">
          <div class="detail-slab-list-head">
            <strong>Slabs in this listing</strong>
            <span>${detailGrades.length} graded copies</span>
          </div>
          ${detailSlabRows}
        </div>`
      : "";

    const detailSlabBreakdownMobile = detailGrades.length>1
      ? `<details class="detail-slab-mobile">
          <summary>
            <span class="detail-slab-mobile-copy">
              <strong>${detailGrades.length} graded copies</strong>
              <small>${appContext.escapeHtml(detailCondition)}</small>
            </span>
            <span class="detail-slab-mobile-action">
              <span class="detail-slab-mobile-closed">View slab details</span>
              <span class="detail-slab-mobile-open">Hide slab details</span>
              <span class="detail-slab-mobile-chevron" aria-hidden="true">⌄</span>
            </span>
          </summary>
          <div class="detail-slab-mobile-body">
            ${detailSlabRows}
          </div>
        </details>`
      : "";
    const cost = card.cost == null ? "—" : appContext.fmtMoney(card.cost);
    const isSoldListing = appContext.normalizeFilterValue(card.availability || "") === "sold";
    const isNfsListing = appContext.normalizeFilterValue(card.availability || "") === "collection (nfs)";
    const filteredResultNav=appContext.getFilteredResultNavigation(card.id);
    const soldDateLabel = appContext.formatSoldDate(card.sold_at);

    appContext.syncDetailsFavoriteButton(card);
    appContext.closeDetailsMoreMenu();

    const detailsCloseButton=appContext.$("detailsCloseBtn");
    if(detailsCloseButton){
      const returningToPage=!!appContext.detailsReturnHash && !appContext.detailsReturnHash.includes("#/card/");
      const returnRoute=appContext.routeBase(String(appContext.detailsReturnHash||"").replace(/^#\/?/,""));
      const returningHome=returnRoute==="home";
      const returningInsights=returnRoute==="insights" && !!appContext.insightsDetailsReturnState;
      detailsCloseButton.classList.toggle("is-return-action",returningToPage);
      detailsCloseButton.classList.toggle("is-close-action",!returningToPage);
      detailsCloseButton.innerHTML=returningToPage
        ? `<span aria-hidden="true">←</span> ${returningHome ? "Back to home" : (returningInsights ? "Back to insights" : "Back to results")}`
        : `<span aria-hidden="true">×</span> Close`;
      detailsCloseButton.setAttribute(
        "aria-label",
        returningToPage
          ? (returningHome ? "Back to home" : (returningInsights ? "Back to insights" : "Back to previous results"))
          : "Close card details"
      );
    }

    appContext.detailsMount.innerHTML = `
      <div class="detail-header detail-header-mobile">
        <div class="detail-title">
          <div class="eyebrow">Card details</div>
          <h2 id="detailsTitle">${appContext.escapeHtml(card.name).toUpperCase()}</h2>
          <div class="detail-meta">${appContext.escapeHtml(card.game || "—")}${card.set ? " · " + appContext.escapeHtml(card.set) : ""}</div>
        </div>
        ${!isNfsListing ? `
          <label class="global-currency-control detail-currency-control" title="Your preferred currency is saved on this device.">
            <span>Currency</span>
            <select id="detailsCurrencyPreferenceMobile" aria-label="Preferred display currency">
              <option value="USD" ${appContext.getPriceCurrencyPreference()==="USD"?"selected":""}>USD</option>
              <option value="MYR" ${appContext.getPriceCurrencyPreference()==="MYR"?"selected":""}>MYR</option>
              <option value="SGD" ${appContext.getPriceCurrencyPreference()==="SGD"?"selected":""}>SGD</option>
            </select>
          </label>
        ` : ""}
      </div>
      ${isNfsListing ? `
        <div class="nfs-detail-notice" role="status">
          <div class="nfs-detail-notice-mark">NFS</div>
          <div>
            <strong>Collection piece · Not for sale</strong>
            <span>This card is displayed as part of our collection and is not currently offered for sale.</span>
          </div>
        </div>
      ` : ""}
      ${appContext.highValueContactAlertHTML(card,false)}
      ${isSoldListing ? `
        <div class="sold-detail-notice" role="status">
          <div class="sold-detail-notice-mark">SOLD</div>
          <div>
            <strong>This card has been sold.</strong>
            <span>${soldDateLabel ? `Sold ${appContext.escapeHtml(soldDateLabel)} · ` : ""}This listing remains visible as part of the collection archive.</span>
          </div>
        </div>
      ` : ""}

      ${filteredResultNav && filteredResultNav.total>1 ? `
        <nav class="filtered-result-nav" aria-label="Browse current filtered results">
          <button type="button"
                  class="btn-ghost filtered-result-nav-btn"
                  data-filtered-result-id="${appContext.escapeHtml(filteredResultNav.previous)}"
                  data-filtered-result-direction="previous"
                  ${filteredResultNav.previous ? "" : "disabled"}
                  aria-label="Previous card in current filtered results">
            ← <span>Previous</span>
          </button>
          <div class="filtered-result-position">
            <span>Current results</span>
            <strong>${filteredResultNav.index+1} of ${filteredResultNav.total}</strong>
          </div>
          <button type="button"
                  class="btn-ghost filtered-result-nav-btn"
                  data-filtered-result-id="${appContext.escapeHtml(filteredResultNav.next)}"
                  data-filtered-result-direction="next"
                  ${filteredResultNav.next ? "" : "disabled"}
                  aria-label="Next card in current filtered results">
            <span>Next</span> →
          </button>
        </nav>
      ` : ""}

      <div class="detail-layout">
        <div>${imageHTML}</div>
        <div class="detail-info">
          <div class="detail-header detail-header-desktop">
            <div class="detail-title">
              <div class="eyebrow">Card details</div>
              <h2 id="detailsTitleDesktop" class="${String(card.name||"").length>88?"detail-title-extra-long":(String(card.name||"").length>52?"detail-title-long":"")}">${appContext.escapeHtml(card.name)}</h2>
              <div class="detail-meta">${appContext.escapeHtml(card.game || "—")}${card.set ? " · " + appContext.escapeHtml(card.set) : ""}</div>
            </div>
            ${!isNfsListing ? `
              <label class="global-currency-control detail-currency-control" title="Your preferred currency is saved on this device.">
                <span>Currency</span>
                <select id="detailsCurrencyPreference" aria-label="Preferred display currency">
                  <option value="USD" ${appContext.getPriceCurrencyPreference()==="USD"?"selected":""}>USD</option>
                  <option value="MYR" ${appContext.getPriceCurrencyPreference()==="MYR"?"selected":""}>MYR</option>
                  <option value="SGD" ${appContext.getPriceCurrencyPreference()==="SGD"?"selected":""}>SGD</option>
                </select>
              </label>
            ` : ""}
          </div>
          <div class="detail-summary-strip">
            <div class="detail-summary-card detail-summary-price">
              <span>Price</span>
              ${appContext.detailPriceDisplayHTML(card)}
            </div>
            <div class="detail-summary-card">
              <span>Grade / Condition</span>
              <strong>${appContext.escapeHtml(detailCondition)}</strong>
              ${detailPop ? `<small class="detail-psa-pop">${appContext.escapeHtml(detailPop)}</small>` : ""}
            </div>
            <div class="detail-summary-card" data-availability="${appContext.normalizeFilterValue(card.availability||"Available")}">
              <span>Availability</span>
              <strong>${appContext.escapeHtml(card.availability || "Available")}</strong>
            </div>
          </div>

          ${detailSlabBreakdown}

          ${!isNfsListing && !isSoldListing && appContext.normalizeFilterValue(card.availability||"Available")==="available" ? `
            <div class="detail-purchase-panel" aria-label="Purchase options">
              <div class="detail-purchase-location">
                <span class="detail-purchase-location-icon" aria-hidden="true">📍</span>
                <span>
                  <strong>Worldwide Shipping</strong>
                  <small>
                    <span class="purchase-copy-mobile">Negotiable • Worldwide shipping • High-value delivery by arrangement • COD / meetup in MY &amp; SG</span>
                    <span class="purchase-copy-desktop">Negotiable · Worldwide shipping · High-value delivery by arrangement · COD / meetup in MY &amp; SG</span>
                  </small>
                </span>
              </div>
              <details class="detail-buy-cta">
                <summary data-contact-buy-trigger aria-label="Contact to Buy">
                  <span>Contact to Buy</span>
                  <small>Choose contact method</small>
                </summary>
                <button type="button" class="mobile-buy-backdrop" data-mobile-buy-close aria-label="Close contact options"></button>
                <div class="detail-buy-chooser">
                  <button type="button" class="mobile-buy-close" data-mobile-buy-close aria-label="Close contact options">×</button>
                  <div>
                    <strong>Choose how to contact us</strong>
                    <span>Select what you want to ask, then choose a platform.</span>
                  </div>
                  ${contactIntentButtonsHtml("details-buy-intents")}
                  ${detailsContactSocialLinksHtml("details-buy-social-links")}
                </div>
              </details>
            </div>
          ` : ""}

          ${detailSlabBreakdownMobile}

          ${!isNfsListing ? `
            <div class="detail-buyer-confidence" aria-label="Buyer information">
              <div class="detail-confidence-item">
                <span class="detail-confidence-icon" aria-hidden="true">▣</span>
                <span>
                  <strong>${images.length} Listing Photo${images.length===1?"":"s"}</strong>
                  <small>Open the gallery to inspect the images provided for this listing.</small>
                </span>
              </div>
              <div class="detail-confidence-item">
                <span class="detail-confidence-icon" aria-hidden="true">✓</span>
                <span>
                  <strong>Secure Packing</strong>
                  <small>Cards are packed securely; a packing video can be provided.</small>
                </span>
              </div>
              <div class="detail-confidence-item">
                <span class="detail-confidence-icon" aria-hidden="true">◎</span>
                <span>
                  <strong>${isSoldListing ? "Sold Archive" : "Buyer Options"}</strong>
                  <small>${isSoldListing
                    ? "This listing is retained for collection history and reference."
                    : "Worldwide shipping is available; for USD 6,000+ items, contact us to discuss secure delivery. COD / meetup can be arranged in Malaysia or Singapore."}</small>
                </span>
              </div>
            </div>
          ` : ""}

          <div class="detail-info-section-title">Card information</div>
          <div class="detail-grid details-info-grid">
            <div class="detail-item"><div class="detail-label">Format</div><div class="detail-value">${appContext.escapeHtml(appContext.effectiveFormat(card))}</div></div>
            ${isSoldListing && soldDateLabel ? `<div class="detail-item"><div class="detail-label">Sold Date</div><div class="detail-value">${appContext.escapeHtml(soldDateLabel)}</div></div>` : ""}
            ${card.card_code ? `<div class="detail-item"><div class="detail-label">Card Code</div><div class="detail-value">${appContext.escapeHtml(card.card_code)}</div></div>` : ""}
            ${card.year ? `<div class="detail-item"><div class="detail-label">Year</div><div class="detail-value">${appContext.escapeHtml(card.year)}</div></div>` : ""}
            ${card.language ? `<div class="detail-item"><div class="detail-label">Language</div><div class="detail-value">${appContext.escapeHtml(card.language)}</div></div>` : ""}
            ${card.language_details ? `<div class="detail-item"><div class="detail-label">Language details</div><div class="detail-value">${appContext.escapeHtml(card.language_details)}</div></div>` : ""}
            ${card.era ? `<div class="detail-item"><div class="detail-label">Era</div><div class="detail-value">${appContext.escapeHtml(card.era)}</div></div>` : ""}
            ${card.series ? `<div class="detail-item"><div class="detail-label">Series</div><div class="detail-value">${appContext.escapeHtml(card.series)}</div></div>` : ""}
            <div class="detail-item"><div class="detail-label">Pictures</div><div class="detail-value">${images.length}</div></div>
            ${appContext.isOwnerMode() ? `<div class="detail-item owner-only owner-private-analytics">
              <div class="detail-label">Qualified Views</div>
              <div class="detail-value" data-owner-conversion="qualified">${appContext.freshQualifiedViewDisplay(card.id)}</div>
            </div>
            <div class="detail-item owner-only owner-private-analytics">
              <div class="detail-label">Unique Collectors</div>
              <div class="detail-value" data-owner-conversion="unique">—</div>
            </div>
            <div class="detail-item owner-only owner-private-analytics">
              <div class="detail-label">Favorite Adds</div>
              <div class="detail-value" data-owner-conversion="favorites">—</div>
            </div>
            <div class="detail-item owner-only owner-private-analytics">
              <div class="detail-label">Buyer Intents</div>
              <div class="detail-value" data-owner-conversion="intent">—</div>
            </div>
            <div class="detail-item owner-only owner-private-analytics">
              <div class="detail-label">Intent Rate</div>
              <div class="detail-value" data-owner-conversion="intent-rate">—</div>
            </div>` : ""}
          </div>

          ${card.notes ? `<div class="detail-section"><h3>Notes</h3><div class="detail-notes">${appContext.escapeHtml(card.notes)}</div></div>` : ""}

        </div>
      </div>

      ${(()=>{
        const nav=appContext.getSameSeriesNeighbors(card);
        if(nav.total<=1 || appContext.sameSeriesNavigationIsRedundant(nav,filteredResultNav)) return "";
        return `
          <section class="same-series-nav">
            <div>
              <div class="eyebrow">Same Series</div>
              <strong>${appContext.escapeHtml(card.series||"Series")}</strong>
              <span>${nav.index+1} of ${nav.total}</span>
            </div>
            <div class="same-series-actions">
              <button type="button" class="btn-ghost" data-series-card-id="${nav.previous ? appContext.escapeHtml(nav.previous.id) : ""}" ${nav.previous ? "" : "disabled"}>← Previous</button>
              <button type="button" class="btn-ghost" data-series-card-id="${nav.next ? appContext.escapeHtml(nav.next.id) : ""}" ${nav.next ? "" : "disabled"}>Next →</button>
            </div>
          </section>
        `;
      })()}

      ${(()=>{
        const related = appContext.getRelatedCards(card, 8, {availableOnly:isSoldListing});
        return related.length ? `
          <section class="related-cards-section ${isSoldListing ? "sold-alternatives-section" : ""}">
            <div class="related-cards-head">
              <div class="eyebrow">${isSoldListing ? "Available Alternatives" : "Keep Browsing"}</div>
              <h3>${isSoldListing ? "Similar Available Cards" : "Related Cards"}</h3>
            </div>
            <div class="related-cards-grid">
              ${related.map(appContext.relatedCardHTML).join("")}
            </div>
          </section>
        ` : "";
      })()}
    `;

    appContext.detailsOverlay.hidden = false;

    if(appContext.isOwnerMode()){
      appContext.refreshOwnerCardConversionSummary(card.id).catch(()=>{});
    }

    // The Card Details modal is reused between listings. Reset its actual
    // scrolling element only AFTER the new card has been rendered and the
    // overlay is visible; otherwise mobile Safari/Chrome may restore the old
    // scroll position during layout.
    const openedDetailsModal=appContext.detailsOverlay?.querySelector(".card-details-modal");
    const resetOpenedDetailsScroll=()=>{
      if(!openedDetailsModal) return;
      openedDetailsModal.scrollTop=0;
      openedDetailsModal.scrollLeft=0;
      if(typeof openedDetailsModal.scrollTo==="function"){
        try{ openedDetailsModal.scrollTo({top:0,left:0,behavior:"instant"}); }
        catch{ openedDetailsModal.scrollTo(0,0); }
      }
    };

    resetOpenedDetailsScroll();
    requestAnimationFrame(()=>{
      resetOpenedDetailsScroll();
      requestAnimationFrame(resetOpenedDetailsScroll);
    });

    // Move focus into the dialog without causing the page to jump.
    requestAnimationFrame(()=>{
      const preferredFocus = appContext.$("detailsCloseBtn") || appContext.detailsMount.querySelector("button,[href],select,input");
      if(preferredFocus && typeof preferredFocus.focus==="function"){
        try{ preferredFocus.focus({preventScroll:true}); }
        catch{ preferredFocus.focus(); }
      }
    });

    [appContext.$("detailsCurrencyPreference"),appContext.$("detailsCurrencyPreferenceMobile")].filter(Boolean).forEach(currencySelect=>{
      currencySelect.addEventListener("change",async e=>{
        const currency=appContext.setPriceCurrencyPreference(e.target.value);
        await appContext.openDetailsModal(card);

        // Card details and every overview surface now share one currency setting.
        appContext.syncCurrencyEverywhere(currency);

        appContext.showToast(`Primary price set to ${appContext.getPriceCurrencyPreference()}`);
      });
    });

    appContext.detailsMount.querySelectorAll("[data-details-inquiry-intent]").forEach(btn=>{
      btn.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        const intent=appContext.setContactInquiryIntent(String(btn.dataset.detailsInquiryIntent||"availability"));
        appContext.detailsMount.querySelectorAll("[data-details-inquiry-intent]").forEach(other=>{
          const active=String(other.dataset.detailsInquiryIntent||"")===intent;
          other.classList.toggle("active",active);
          other.setAttribute("aria-pressed",active?"true":"false");
        });
      });
    });

    appContext.detailsMount.querySelectorAll("[data-details-contact-platform]").forEach(link=>{
      link.addEventListener("click",()=>{
        const platform=String(link.dataset.detailsContactPlatform||"Contact");
        const message=appContext.contactInquiryMessage(card);
        appContext.copyTextToClipboard(message)
          .then(copied=>{
            if(copied){
              appContext.recordCardEngagement(card.id,"inquiry_copy",platform).catch(()=>{});
              appContext.showToast(`${platform} opened · inquiry copied and ready to paste`);
            }else{
              appContext.showToast(`${platform} opened · copy the card link if needed`);
            }
          })
          .catch(()=>{});

        appContext.recordCardEngagement(card.id,"contact_platform",platform).catch(()=>{});
      });
    });

    appContext.detailsMount.querySelectorAll("[data-high-value-contact]").forEach(btn=>btn.addEventListener("click",()=>{
      appContext.goToRoute("contact");
      appContext.closeDetailsModal(false);
    }));

    // Mobile purchase/contact triggers are delegated globally by enhancement-2.js.
    // This avoids per-render handlers competing with the fixed mobile footer CTA.

    if(appContext.isOwnerMode() && appContext.ownerPrivateSupported){
      appContext.fetchOwnerPrivateMeta(card.id).then(meta=>{
        if(!appContext.isOwnerMode() || String(appContext.detailsCardId)!==String(card.id)) return;
        if(!meta.tags.length && !meta.notes) return;
        const info=appContext.detailsMount.querySelector(".detail-info");
        if(!info) return;
        const panel=document.createElement("div");
        panel.className="detail-section owner-private-detail";
        panel.innerHTML=`
          <h3>Private Owner Info</h3>
          ${meta.tags.length ? `<div class="owner-private-detail-tags">${meta.tags.map(tag=>`<span>${appContext.escapeHtml(tag)}</span>`).join("")}</div>` : ""}
          ${meta.notes ? `<div class="owner-private-detail-notes">${appContext.escapeHtml(meta.notes)}</div>` : ""}
        `;
        info.appendChild(panel);
      });
    }

    appContext.detailsMount.querySelectorAll("[data-filtered-result-id]").forEach(el=>{
      el.addEventListener("click",()=>{
        const id=appContext.safeCardId(el.dataset.filteredResultId);
        if(!id || el.disabled) return;
        const context=appContext.getFilteredResultsBrowseContext();
        if(!context || !context.ids.includes(id)) return;

        const direction=el.dataset.filteredResultDirection==="previous" ? "previous" : "next";
        appContext.smoothNavigateDetailsCard(id,direction);
      });
    });

    appContext.detailsMount.querySelectorAll("[data-series-card-id]").forEach(el=>{
      el.addEventListener("click",()=>{
        const id=appContext.safeCardId(el.dataset.seriesCardId);
        if(!id) return;
        const direction=el.textContent.includes("Previous") ? "previous" : "next";
        appContext.smoothNavigateDetailsCard(id,direction);
      });
    });

    appContext.detailsMount.querySelectorAll("[data-related-card-id]").forEach(el=>{
      el.addEventListener("click", ()=>{
        const id=appContext.safeCardId(el.dataset.relatedCardId);
        if(!id) return;
        appContext.rememberCardDiscoverySource(id,el.dataset.discoverySource||"related");
        appContext.smoothNavigateDetailsCard(id,"next");
      });
    });

    const slider = appContext.detailsMount.querySelector("[data-card-slider]");
    if(slider && images.length){
      let slideIndex = 0;
      const slideImg = slider.querySelector(".detail-slider-image");
      const countEl = slider.querySelector(".detail-slider-count");
      const dots = Array.from(slider.querySelectorAll(".detail-slider-dot"));
      const thumbs = Array.from(slider.querySelectorAll(".detail-thumb-strip-btn"));

      function preloadDetailNeighbors(index){
        if(images.length<2) return;
        const indexes=[
          (index+1)%images.length,
          (index-1+images.length)%images.length
        ];
        indexes.forEach(i=>{
          const preload=new Image();
          preload.decoding="async";
          preload.src=images[i];
        });
      }

      function showSlide(index){
        slideIndex = (index + images.length) % images.length;
        appContext.detailsImageIndex = slideIndex;
        slideImg.classList.add("is-switching");
        slideImg.src = images[slideIndex];
        slideImg.alt = `${card.name} image ${slideIndex + 1}`;
        const settle=()=>{
          slideImg.classList.remove("is-switching");
          appContext.scheduleDetailsStatusCornerSync();
        };
        if(slideImg.complete) requestAnimationFrame(settle);
        else slideImg.addEventListener("load",settle,{once:true});
        if(countEl) countEl.textContent = `${slideIndex + 1} / ${images.length}`;
        dots.forEach((d,i)=>d.classList.toggle("active", i === slideIndex));
        thumbs.forEach((thumb,i)=>thumb.classList.toggle("active", i === slideIndex));
        const activeThumb=thumbs[slideIndex];
        if(activeThumb){
          try{activeThumb.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}catch{}
        }
        preloadDetailNeighbors(slideIndex);
      }

      preloadDetailNeighbors(0);

      if(slideImg.complete && slideImg.naturalWidth){
        appContext.scheduleDetailsStatusCornerSync();
      }else{
        slideImg.addEventListener("load",appContext.scheduleDetailsStatusCornerSync,{once:true});
      }

      const prev = slider.querySelector(".detail-slider-btn.prev");
      const next = slider.querySelector(".detail-slider-btn.next");
      if(prev) prev.addEventListener("click", e=>{ e.stopPropagation(); showSlide(slideIndex - 1); });
      if(next) next.addEventListener("click", e=>{ e.stopPropagation(); showSlide(slideIndex + 1); });
      dots.forEach(d=>d.addEventListener("click", e=>{
        e.stopPropagation();
        showSlide(Number(d.dataset.slide));
      }));
      thumbs.forEach(thumb=>thumb.addEventListener("click", e=>{
        e.stopPropagation();
        showSlide(Number(thumb.dataset.detailThumb));
      }));

      slideImg.addEventListener("click", ()=>{
        appContext.recordCardEngagement(card.id,"image_expand").catch(()=>{});
        appContext.openImageLightbox(images, slideIndex);
      });

      let touchStartX = null;
      let detailSwipeStartedInThumbStrip = false;

      slider.addEventListener("touchstart", e=>{
        detailSwipeStartedInThumbStrip=Boolean(e.target.closest?.(".detail-thumb-strip"));
        touchStartX=detailSwipeStartedInThumbStrip
          ? null
          : e.changedTouches[0].clientX;
      }, {passive:true});

      slider.addEventListener("touchend", e=>{
        if(detailSwipeStartedInThumbStrip){
          detailSwipeStartedInThumbStrip=false;
          touchStartX=null;
          return;
        }

        if(touchStartX == null) return;
        const dx=e.changedTouches[0].clientX-touchStartX;

        if(Math.abs(dx)>40){
          showSlide(slideIndex+(dx<0 ? 1 : -1));
        }

        touchStartX=null;
      }, {passive:true});

      slider.addEventListener("touchcancel", ()=>{
        detailSwipeStartedInThumbStrip=false;
        touchStartX=null;
      }, {passive:true});
    }
  }

function closeDetailsModal(navigateBack = true){
    ++appContext.detailsOpenRequestId;
    const returningToInsightsInPlace=
      !!appContext.insightsDetailsReturnState &&
      appContext.currentRoute()==="insights" &&
      !String(location.hash||"").includes("#/card/");

    appContext.cancelPendingCardViewQualification();
    appContext.closeDetailsMoreMenu();

    if(appContext.detailsCardTransitionTimer){
      clearTimeout(appContext.detailsCardTransitionTimer);
      appContext.detailsCardTransitionTimer=null;
    }
    appContext.detailsCardTransitioning=false;
    appContext.detailsMount.classList.remove(
      "details-card-transitioning",
      "details-card-slide-out-left",
      "details-card-slide-out-right",
      "details-card-slide-in-left",
      "details-card-slide-in-right"
    );
    appContext.detailsOverlay.hidden = true;
    appContext.detailsMount.innerHTML = "";
    appContext.detailsCardId = null;

    const focusTarget = appContext.detailsLastFocusedElement;
    appContext.detailsLastFocusedElement = null;
    if(focusTarget && document.contains(focusTarget) && typeof focusTarget.focus==="function"){
      requestAnimationFrame(()=>{
        try{ focusTarget.focus({preventScroll:true}); }
        catch{ focusTarget.focus(); }
      });
    }

    if(returningToInsightsInPlace){
      appContext.restoreInsightsDetailsReturnState();
      return;
    }

    if(navigateBack && appContext.currentRoute().startsWith("card/")){
      const target=appContext.detailsReturnHash && !appContext.detailsReturnHash.includes("#/card/")
        ? appContext.detailsReturnHash
        : "#/inventory";

      const spaCardEntry=!!(
        history.state &&
        typeof history.state==="object" &&
        history.state.collectTcgSpaCard
      );

      // Internal card opens use pushState, so closing should simply return to
      // the already-rendered previous page. popstate/router handles the rest.
      if(spaCardEntry){
        history.back();
        return;
      }

      if(appContext.canReusePreservedListing(target)){
        try{
          history.replaceState(history.state,"",target);
          appContext.setNavigationActiveRoute(appContext.listingRouteFromHash(target));
          appContext.updateSidebarFooter();
          appContext.restoreReturnScrollIfReady();
          appContext.detailsPreservedListingHash="";
          return;
        }catch{
          // Fall through to normal navigation.
        }
      }

      appContext.detailsPreservedListingHash="";
      const cleanPage=!!document.querySelector('meta[name="collect-tcg-card-id"]');
      if(cleanPage){
        location.assign(new URL(target,appContext.siteRootUrl()).toString());
      }else if(location.hash!==target){
        location.hash=target;
      }
    }
  }

  Object.assign(appContext,{contactCardReferenceLines,refreshOwnerCardConversionSummary,syncDetailsStatusCornerToVisibleImage,scheduleDetailsStatusCornerSync,renderLightboxImage,openImageLightbox,closeImageLightbox,safeDownloadName,getDownloadStatusWatermarkMeta,createStatusWatermarkedDownloadBlob,downloadImageSource,createInventoryQrDownloadBlob,downloadInventoryQrImage,downloadSingleCardImagesZip,getWebsiteShareUrl,getCardShareUrl,publicCardSharePreview,copySharePreview,loadPublicSharePreviewImage,createPublicCardSharePreviewBlob,downloadPublicCardSharePreview,shareCurrentCard,publicContactSellerMessage,contactInquiryIntent,setContactInquiryIntent,contactInquiryMessage,contactIntentButtonsHtml,messageSellerOnFacebook,shareCurrentCardWhatsApp,getSameSeriesNeighbors,sameSeriesNavigationIsRedundant,replaceCardRouteWithoutRefresh,smoothNavigateDetailsCard,syncDetailsFavoriteButton,closeDetailsMoreMenu,toggleDetailsMoreMenu,openDetailsModal,closeDetailsModal});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.lightboxImages = [];

  appContext.imageLightboxKeyboard=createModalKeyboardController({
    getOverlay:()=>appContext.$("imageLightbox"),
    getInitialFocus:()=>appContext.$("imageLightboxClose"),
    onEscape:()=>appContext.closeImageLightbox()
  });
  document.addEventListener("keydown",appContext.imageLightboxKeyboard.keydown);
  appContext.lightboxIndex = 0;

  appContext.COLLECT_TCG_FACEBOOK_MESSENGER_URL = "https://m.me/61590041416102";
  appContext.contactInquiryIntentState = "availability";

  appContext.detailsCardTransitionTimer = null;

  appContext.detailsCardTransitioning = false;

  appContext.detailsOpenRequestId = 0;

window.addEventListener("resize",()=>{
    if(!appContext.detailsOverlay.hidden) appContext.scheduleDetailsStatusCornerSync();
  },{passive:true});

window.addEventListener("orientationchange",()=>{
    if(!appContext.detailsOverlay.hidden) setTimeout(appContext.scheduleDetailsStatusCornerSync,80);
  });

appContext.$("imageLightboxClose").addEventListener("click", appContext.closeImageLightbox);

appContext.$("imageLightboxDownload").addEventListener("click", e=>{
    e.stopPropagation();
    if(!appContext.lightboxImages.length) return;
    const card = appContext.getDetailsCard();
    appContext.downloadImageSource(
      appContext.lightboxImages[appContext.lightboxIndex],
      card?.name || card?.card_code || "card",
      appContext.lightboxIndex + 1,
      card
    );
  });

appContext.$("imageLightboxPrev").addEventListener("click", e=>{ e.stopPropagation(); appContext.renderLightboxImage(appContext.lightboxIndex - 1); });

appContext.$("imageLightboxNext").addEventListener("click", e=>{ e.stopPropagation(); appContext.renderLightboxImage(appContext.lightboxIndex + 1); });

appContext.$("imageLightbox").addEventListener("click", e=>{
    if(e.target === appContext.$("imageLightbox")) appContext.closeImageLightbox();
  });

  appContext.lightboxTouchStartX = null;

appContext.$("imageLightboxMain").addEventListener("touchstart", e=>{
    appContext.lightboxTouchStartX = e.changedTouches[0].clientX;
  }, {passive:true});

appContext.$("imageLightboxMain").addEventListener("touchend", e=>{
    if(appContext.lightboxTouchStartX == null) return;
    const dx = e.changedTouches[0].clientX - appContext.lightboxTouchStartX;
    if(Math.abs(dx) > 35 && appContext.lightboxImages.length > 1){
      appContext.renderLightboxImage(appContext.lightboxIndex + (dx < 0 ? 1 : -1));
    }
    appContext.lightboxTouchStartX = null;
  }, {passive:true});

appContext.$("detailsFavoriteBtn").addEventListener("click",()=>{
    const card=appContext.cards.find(c=>c.id===appContext.detailsCardId);
    if(!card) return;
    appContext.toggleFavorite(card.id);
    appContext.syncDetailsFavoriteButton(card);
  });

appContext.$("detailsShareBtn").addEventListener("click",appContext.shareCurrentCard);

appContext.$("detailsMoreBtn").addEventListener("click",e=>{
    e.stopPropagation();
    appContext.toggleDetailsMoreMenu();
  });

appContext.detailsMoreMenuEl.addEventListener("click",e=>{
    if(e.target.closest("button")) appContext.closeDetailsMoreMenu();
  });

appContext.detailsMoreMenuEl.addEventListener("keydown",e=>{
    const menu=appContext.detailsMoreMenuEl;
    const items=Array.from(menu.querySelectorAll('button:not([hidden])'))
      .filter(item=>getComputedStyle(item).display!=="none");

    if(!items.length) return;

    const current=Math.max(0,items.indexOf(document.activeElement));

    if(e.key==="ArrowDown"){
      e.preventDefault();
      items[(current+1)%items.length].focus();
    }else if(e.key==="ArrowUp"){
      e.preventDefault();
      items[(current-1+items.length)%items.length].focus();
    }else if(e.key==="Home"){
      e.preventDefault();
      items[0].focus();
    }else if(e.key==="End"){
      e.preventDefault();
      items[items.length-1].focus();
    }else if(e.key==="Escape"){
      e.preventDefault();
      appContext.closeDetailsMoreMenu(true);
    }
  });

document.addEventListener("click",e=>{
    if(!e.target.closest(".details-more-wrap")) appContext.closeDetailsMoreMenu();
  });

appContext.$("detailsWhatsAppBtn").addEventListener("click",appContext.shareCurrentCardWhatsApp);

appContext.$("compareOpenBtn").addEventListener("click",appContext.renderCompareModal);

appContext.$("compareClearBtn").addEventListener("click",()=>{
    appContext.closeCompareModal({clearSelection:true});
  });

appContext.$("compareCloseBtn").addEventListener("click",()=>{
    appContext.closeCompareModal({clearSelection:true});
  });

appContext.$("compareOverlay").addEventListener("click",e=>{
    if(e.target===appContext.$("compareOverlay")){
      appContext.closeCompareModal({clearSelection:true});
    }
  });



appContext.$("detailsDownloadBtn").addEventListener("click", ()=>{
    const card = appContext.getDetailsCard();
    if(!card) return;
    const images = appContext.getImages(card);
    if(!images.length){
      appContext.showToast("No image to download");
      return;
    }
    const index = Math.min(appContext.detailsImageIndex, images.length - 1);
    appContext.recordCardEngagement(card.id,"download","Card Image").catch(()=>{});
    appContext.downloadImageSource(images[index], card.name || card.card_code || "card", index + 1, card);
  });

appContext.$("detailsCloseBtn").addEventListener("click", ()=>appContext.closeDetailsModal(true));

appContext.$("detailsCloneBtn").addEventListener("click", ()=>{
    if(!appContext.requireOwner("clone card")) return;
    const card = appContext.getCardById(appContext.detailsCardId||"");
    if(card) appContext.openCloneOptions(card);
  });

appContext.$("detailsDeleteBtn").addEventListener("click", async ()=>{
    if(!appContext.requireOwner("delete listing permanently")) return;
    const card=appContext.getCardById(appContext.detailsCardId||"");
    if(!card) return;
    appContext.closeDetailsMoreMenu(false);
    const ok=await appContext.deleteListingPermanently(card);
    if(ok){
      appContext.goToRoute("inventory");
      appContext.router();
    }
  });

appContext.$("cloneOptionsCloseBtn").addEventListener("click",appContext.closeCloneOptions);

appContext.$("cloneOptionsOverlay").addEventListener("click",e=>{
    if(e.target===appContext.$("cloneOptionsOverlay")) appContext.closeCloneOptions();
  });

appContext.$("cloneOptionsOverlay").querySelectorAll("[data-clone-mode]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(!appContext.cloneSourceCard || !appContext.requireOwner("clone card")) return;
      appContext.beginCloneCard(appContext.cloneSourceCard,String(btn.dataset.cloneMode||"details"));
    });
  });

appContext.$("detailsEditBtn").addEventListener("click", ()=>{
    if(!appContext.requireOwner()) return;
    const card = appContext.getDetailsCard();
    if(card){
      const editReturnHash=
        appContext.safeListingBrowseHash(appContext.detailsReturnHash) ||
        "#/inventory";

      appContext.closeDetailsModal(false);

      // Editing is a modal state, not a card-details route. Remove the stale
      // #/card/<id> URL so refreshing while/after editing returns to results
      // instead of unexpectedly reopening the previously edited card.
      try{
        history.replaceState(history.state,"",editReturnHash);
        appContext.setNavigationActiveRoute(appContext.listingRouteFromHash(editReturnHash)||"inventory");
        appContext.updateSidebarFooter();
      }catch{
        // Hash navigation fallback only if History API replacement fails.
        if(location.hash!==editReturnHash) location.hash=editReturnHash;
      }

      appContext.openEditModal(card);
    }
  });

appContext.detailsOverlay.addEventListener("click", e=>{
    if(e.target === appContext.detailsOverlay) appContext.closeDetailsModal(true);
  });

document.addEventListener("keydown", e=>{
    if(!appContext.$("imageLightbox").hidden){
      if(e.key === "ArrowLeft" && appContext.lightboxImages.length > 1){ appContext.renderLightboxImage(appContext.lightboxIndex - 1); return; }
      if(e.key === "ArrowRight" && appContext.lightboxImages.length > 1){ appContext.renderLightboxImage(appContext.lightboxIndex + 1); return; }
    }
    if(e.key==="Escape" && !appContext.detailsMoreMenuEl.hidden){
      appContext.closeDetailsMoreMenu(true);
      return;
    }
    if(e.key === "Escape" && !appContext.detailsOverlay.hidden) appContext.closeDetailsModal(true);
  });

  appContext.overlay = appContext.$("modalOverlay");

  appContext.editForm = appContext.$("editForm");

  appContext.editFormState = {
    images: [],
    imageCleanSources: [],
    imageWatermarkedSources: [],
    imageVariantKeys: [],
    imageWatermarkStates: [],
    watermarkEnabled:false,
    grading: [],
    processingImages: 0
  };

  appContext.editReturnScrollState = null;
}
