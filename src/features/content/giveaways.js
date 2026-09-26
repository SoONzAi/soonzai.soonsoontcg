/** V93 beta: features/content/giveaways. Shared dependencies are explicit on appContext. */
export function register(appContext){
function giveawayDateLabel(value){
    if(!value) return "No end date";
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-US",{
      timeZone:"Asia/Kuala_Lumpur",
      year:"numeric",
      month:"short",
      day:"numeric",
      hour:"numeric",
      minute:"2-digit",
      hour12:true
    }).format(d);
  }

function giveawayEndsInputToIso(value){
    const safe=String(value||"").trim();
    if(!safe) return null;
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(safe)) return null;

    // datetime-local has no timezone. Explicitly attach +08:00 so "22:00"
    // always means 22:00 in Malaysia/Singapore.
    const d=new Date(`${safe}:00+08:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

function giveawayEndsIsoToInputValue(value){
    if(!value) return "";
    const d=new Date(value);
    if(Number.isNaN(d.getTime())) return "";

    // Convert the stored instant into MY/SG wall-clock components.
    const parts=new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Kuala_Lumpur",
      year:"numeric",
      month:"2-digit",
      day:"2-digit",
      hour:"2-digit",
      minute:"2-digit",
      hourCycle:"h23"
    }).formatToParts(d);

    const map={};
    for(const part of parts){
      if(part.type!=="literal") map[part.type]=part.value;
    }

    if(!map.year || !map.month || !map.day || map.hour===undefined || map.minute===undefined){
      return "";
    }

    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  }

async function uploadOwnerImage(file, bucket, errorLabel){
    if(!file) return null;
    if(!appContext.requireOwner(`upload to ${bucket}`)) return null;

    let verifiedMime="";
    try{
      verifiedMime=await appContext.validateOwnerImageFile(file,{
        allowedMimes:appContext.SAFE_GENERIC_IMAGE_MIMES,
        maxBytes:appContext.GENERIC_OWNER_IMAGE_MAX_BYTES
      });
    }catch(error){
      console.warn(`${errorLabel} validation rejected:`,error);
      appContext.showToast(error?.message || `Invalid ${errorLabel.toLowerCase()}`);
      return null;
    }

    const extensionByMime={
      "image/jpeg":"jpg",
      "image/png":"png",
      "image/webp":"webp",
      "image/gif":"gif"
    };
    const safeExt=extensionByMime[verifiedMime];
    if(!safeExt) return null;

    const randomPart=(crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,12)}`)
      .replace(/[^a-zA-Z0-9-]/g,"");
    const path = `${appContext.ownerSession.user.id}/${Date.now()}-${randomPart}.${safeExt}`;

    const { error: uploadError } = await appContext.supabaseClient.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl:"3600",
        upsert:false,
        contentType:verifiedMime
      });

    if(uploadError){
      console.error(`${errorLabel} upload error:`, uploadError);
      appContext.showToast(`Could not upload ${errorLabel.toLowerCase()}`);
      return null;
    }

    const { data } = appContext.supabaseClient.storage.from(bucket).getPublicUrl(path);
    const publicUrl=appContext.safeHttpUrl(data?.publicUrl||"");
    if(!publicUrl){
      await appContext.supabaseClient.storage.from(bucket).remove([path]);
      appContext.showToast(`Could not validate uploaded ${errorLabel.toLowerCase()}`);
      return null;
    }
    return publicUrl;
  }

async function uploadGiveawayImage(file,source="",photoNumber=1){
    if(!file) return null;

    const mime=appContext.normalizedImageMime(file.type);

    // Preserve animated GIFs exactly as uploaded.
    if(mime==="image/gif"){
      return appContext.uploadOwnerImage(file,"giveaway-images",`Giveaway photo ${photoNumber}`);
    }

    // Phone photos can be several MB even when visually small. Normalize
    // JPG/PNG/WEBP into the same web-sized JPEG pipeline used by card images
    // before sending them to the 5 MB giveaway bucket. This also avoids
    // browser/storage differences between the first and later photos.
    try{
      const localSource=source || URL.createObjectURL(file);
      const revoke=!source;
      try{
        const {img}=await appContext.loadImageElementFromSource(localSource);
        let processed=await appContext.renderCardImage(img,1800,0.92,false);
        let blob=appContext.dataUrlToBlob(processed);

        // Extremely detailed images can still exceed the bucket limit. Retry
        // once at a smaller size/quality rather than failing the whole giveaway.
        if(blob.size>appContext.GENERIC_OWNER_IMAGE_MAX_BYTES){
          processed=await appContext.renderCardImage(img,1400,0.86,false);
          blob=appContext.dataUrlToBlob(processed);
        }

        if(blob.size>appContext.GENERIC_OWNER_IMAGE_MAX_BYTES){
          throw new Error("Processed giveaway photo is still larger than 5 MB");
        }

        return await appContext.uploadOwnerProcessedImage(
          processed,
          "giveaway-images",
          `Giveaway photo ${photoNumber}`
        );
      }finally{
        if(revoke){ try{ URL.revokeObjectURL(localSource); }catch{} }
      }
    }catch(error){
      console.error(`Giveaway photo ${photoNumber} normalization/upload error:`,error);
      appContext.showToast(error?.message || `Could not upload giveaway photo ${photoNumber}`);
      return null;
    }
  }

async function uploadOwnerProcessedImage(dataUrl,bucket,errorLabel){
    let blob;
    try{
      blob=appContext.dataUrlToBlob(dataUrl);
    }catch(error){
      console.error(`${errorLabel} processed-image decode error:`,error);
      appContext.showToast(`Could not prepare ${errorLabel.toLowerCase()}`);
      return null;
    }

    const verifiedMime=appContext.normalizedImageMime(blob.type);
    if(!appContext.SAFE_GENERIC_IMAGE_MIMES.has(verifiedMime)){
      appContext.showToast(`Unsupported ${errorLabel.toLowerCase()} format`);
      return null;
    }
    if(blob.size<=0 || blob.size>appContext.GENERIC_OWNER_IMAGE_MAX_BYTES){
      appContext.showToast(`${errorLabel} is too large`);
      return null;
    }

    const extensionByMime={
      "image/jpeg":"jpg",
      "image/png":"png",
      "image/webp":"webp",
      "image/gif":"gif"
    };
    const safeExt=extensionByMime[verifiedMime];
    if(!safeExt){
      appContext.showToast(`Unsupported ${errorLabel.toLowerCase()} format`);
      return null;
    }

    const randomPart=(crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,12)}`)
      .replace(/[^a-zA-Z0-9-]/g,"");
    const path = `${appContext.ownerSession.user.id}/${Date.now()}-${randomPart}.${safeExt}`;

    const { error: uploadError } = await appContext.supabaseClient.storage
      .from(bucket)
      .upload(path, blob, {
        cacheControl:"3600",
        upsert:false,
        contentType:verifiedMime
      });

    if(uploadError){
      console.error(`${errorLabel} processed upload error:`, uploadError);
      const storageMessage=String(uploadError?.message||"").trim();
      appContext.showToast(storageMessage
        ? `Could not upload ${errorLabel.toLowerCase()}: ${storageMessage.slice(0,120)}`
        : `Could not upload ${errorLabel.toLowerCase()}`);
      return null;
    }

    const { data } = appContext.supabaseClient.storage.from(bucket).getPublicUrl(path);
    const publicUrl=appContext.safeHttpUrl(data?.publicUrl||"");
    if(!publicUrl){
      await appContext.supabaseClient.storage.from(bucket).remove([path]);
      appContext.showToast(`Could not validate uploaded ${errorLabel.toLowerCase()}`);
      return null;
    }
    return publicUrl;
  }

function loadGiveawayWinnerListingFrame(){
    if(appContext.giveawayWinnerListingFramePromise) return appContext.giveawayWinnerListingFramePromise;

    appContext.giveawayWinnerListingFramePromise=new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>{
        appContext.giveawayWinnerListingFramePromise=null;
        reject(new Error("Winner listing frame could not be loaded"));
      };
      img.src=appContext.GIVEAWAY_WINNER_LISTING_FRAME;
    });

    return appContext.giveawayWinnerListingFramePromise;
  }

async function getGiveawayWinnerListingOverlay(){
    if(appContext.giveawayWinnerListingOverlayPromise) return appContext.giveawayWinnerListingOverlayPromise;

    appContext.giveawayWinnerListingOverlayPromise=(async()=>{
      const frame=await appContext.loadGiveawayWinnerListingFrame();
      const w=frame.naturalWidth||frame.width;
      const h=frame.naturalHeight||frame.height;
      if(!w || !h) throw new Error("Invalid winner listing frame");

      const canvas=document.createElement("canvas");
      canvas.width=w;
      canvas.height=h;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      if(!ctx) throw new Error("Winner frame canvas unavailable");

      ctx.drawImage(frame,0,0,w,h);

      // The uploaded giveaway image sits inside the large central winner frame.
      // Remove only the dark background pixels from that opening so the supplied
      // gold borders, title, side glow and branding remain on top.
      const x1=Math.round(w*0.038);
      const y1=Math.round(h*0.165);
      const x2=Math.round(w*0.962);
      const y2=Math.round(h*0.906);

      // Preserve the supplied Collect TCG logo area in the bottom-right corner.
      const logoX1=Math.round(w*0.775);
      const logoY1=Math.round(h*0.755);

      const imageData=ctx.getImageData(0,0,w,h);
      const data=imageData.data;

      for(let y=y1;y<y2;y++){
        for(let x=x1;x<x2;x++){
          if(x>=logoX1 && y>=logoY1) continue;

          const offset=(y*w+x)*4;
          const r=data[offset];
          const g=data[offset+1];
          const b=data[offset+2];
          const a=data[offset+3];

          if(a>0 && r<34 && g<34 && b<34){
            data[offset+3]=0;
          }
        }
      }

      ctx.clearRect(0,0,w,h);
      ctx.putImageData(imageData,0,0);

      return canvas;
    })();

    try{
      return await appContext.giveawayWinnerListingOverlayPromise;
    }catch(error){
      appContext.giveawayWinnerListingOverlayPromise=null;
      throw error;
    }
  }

async function renderGiveawayWinnerListingImage(source,quality=0.94){
    if(!source) throw new Error("Giveaway image is required");

    const frame=await appContext.loadGiveawayWinnerListingFrame();
    const overlay=await appContext.getGiveawayWinnerListingOverlay();
    const {img}=await appContext.loadImageElementFromSource(source);

    const w=frame.naturalWidth||frame.width;
    const h=frame.naturalHeight||frame.height;
    const sourceW=img.naturalWidth||img.width;
    const sourceH=img.naturalHeight||img.height;

    if(!w || !h || !sourceW || !sourceH){
      throw new Error("Invalid giveaway winner image dimensions");
    }

    const canvas=document.createElement("canvas");
    canvas.width=w;
    canvas.height=h;
    const ctx=canvas.getContext("2d",{alpha:false});
    if(!ctx) throw new Error("Winner image canvas unavailable");

    ctx.fillStyle="#000";
    ctx.fillRect(0,0,w,h);
    ctx.imageSmoothingEnabled=true;
    if("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality="high";

    // Draw the supplied frame first so any empty space around portrait/square
    // photos retains the original black/gold winner artwork.
    ctx.drawImage(frame,0,0,w,h);

    const area={
      x:Math.round(w*0.040),
      y:Math.round(h*0.168),
      width:Math.round(w*0.920),
      height:Math.round(h*0.735)
    };

    const scale=Math.min(area.width/sourceW,area.height/sourceH);
    const drawW=Math.max(1,Math.round(sourceW*scale));
    const drawH=Math.max(1,Math.round(sourceH*scale));
    const drawX=Math.round(area.x+(area.width-drawW)/2);
    const drawY=Math.round(area.y+(area.height-drawH)/2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x,area.y,area.width,area.height);
    ctx.clip();
    ctx.drawImage(img,drawX,drawY,drawW,drawH);
    ctx.restore();

    // Reapply the transparent version of the supplied artwork so all gold
    // borders, side effects and the Collect TCG logo surround the photo.
    ctx.drawImage(overlay,0,0,w,h);

    return canvas.toDataURL("image/jpeg",quality);
  }

function newGiveawayPhotoItem(source="",file=null){
    return {
      file:file||null,
      cleanSource:source||"",
      privacyMaskedSource:"",
      privacyApplied:false,
      watermarkedSource:"",
      websiteWatermarkedSource:"",
      watermarkApplied:false,
      watermarkMode:"original",
      objectUrl:file && source ? source : ""
    };
  }

function giveawayPhotoSourcesFromRecord(g){
    const out=[];
    const add=value=>{
      const url=appContext.safeHttpUrl(value||"");
      if(url && !out.includes(url)) out.push(url);
    };
    if(Array.isArray(g?.images)) g.images.forEach(add);
    add(g?.image_url);
    return out.slice(0,appContext.GIVEAWAY_PHOTO_LIMIT);
  }

function commitGiveawayActiveEditorItem(){
    const item=appContext.giveawayPhotoItems[appContext.giveawaySelectedPhotoIndex];
    if(!item) return;
    item.cleanSource=appContext.giveawayImageEditorState.cleanSource||"";
    item.privacyMaskedSource=appContext.giveawayImageEditorState.privacyMaskedSource||"";
    item.privacyApplied=appContext.giveawayImageEditorState.privacyApplied===true;
    item.watermarkedSource=appContext.giveawayImageEditorState.watermarkedSource||"";
    item.websiteWatermarkedSource=appContext.giveawayImageEditorState.websiteWatermarkedSource||"";
    item.watermarkApplied=appContext.giveawayImageEditorState.watermarkApplied===true;
    item.watermarkMode=appContext.giveawayImageEditorState.watermarkMode||"original";
    if(appContext.giveawayImageEditorState.objectUrl) item.objectUrl=appContext.giveawayImageEditorState.objectUrl;
  }

function loadGiveawayEditorItem(index,{commitCurrent=true}={}){
    // Loading and committing are separate operations. In particular, when a
    // brand-new first photo is inserted at index 0 there is no previous item
    // to commit; committing the stale blank editor state here would erase the
    // newly-created object URL before it can ever be previewed.
    if(commitCurrent) appContext.commitGiveawayActiveEditorItem();
    if(!appContext.giveawayPhotoItems.length){
      appContext.giveawaySelectedPhotoIndex=0;
      Object.assign(appContext.giveawayImageEditorState,appContext.newGiveawayPhotoItem(""));
      appContext.renderGiveawayImagePreview("");
      appContext.syncGiveawayWatermarkControls();
      appContext.syncGiveawayPrivacyControls();
      return;
    }

    appContext.giveawaySelectedPhotoIndex=Math.max(0,Math.min(Number(index)||0,appContext.giveawayPhotoItems.length-1));
    const item=appContext.giveawayPhotoItems[appContext.giveawaySelectedPhotoIndex];
    Object.assign(appContext.giveawayImageEditorState,{
      cleanSource:item.cleanSource||"",
      privacyMaskedSource:item.privacyMaskedSource||"",
      privacyApplied:item.privacyApplied===true,
      watermarkedSource:item.watermarkedSource||"",
      websiteWatermarkedSource:item.websiteWatermarkedSource||"",
      watermarkApplied:item.watermarkApplied===true,
      watermarkMode:item.watermarkMode||"original",
      objectUrl:item.objectUrl||""
    });

    appContext.$("giveawayImage").value=appContext.giveawayPhotoItems[0]?.cleanSource||"";
    appContext.renderGiveawayImagePreview(appContext.currentGiveawayPreviewSource());
    appContext.syncGiveawayWatermarkControls();
    appContext.syncGiveawayPrivacyControls();
  }

function revokeAllGiveawayPhotoObjectUrls(){
    appContext.giveawayPhotoItems.forEach(item=>{
      if(item?.file && item.objectUrl){
        try{ URL.revokeObjectURL(item.objectUrl); }catch{}
      }
    });
  }

function revokeGiveawayPreviewObjectUrl(){
    if(appContext.giveawayImageEditorState.objectUrl){
      try{ URL.revokeObjectURL(appContext.giveawayImageEditorState.objectUrl); }catch(_){}
      appContext.giveawayImageEditorState.objectUrl="";
    }
  }

function currentGiveawayBaseSource(){
    if(appContext.giveawayImageEditorState.privacyApplied && appContext.giveawayImageEditorState.privacyMaskedSource){
      return appContext.giveawayImageEditorState.privacyMaskedSource;
    }
    return appContext.giveawayImageEditorState.cleanSource;
  }

function currentGiveawayPreviewSource(){
    if(appContext.giveawayImageEditorState.watermarkMode==="website" && appContext.giveawayImageEditorState.websiteWatermarkedSource){
      return appContext.giveawayImageEditorState.websiteWatermarkedSource;
    }
    if(appContext.giveawayImageEditorState.watermarkMode==="full" && appContext.giveawayImageEditorState.watermarkedSource){
      return appContext.giveawayImageEditorState.watermarkedSource;
    }
    return appContext.currentGiveawayBaseSource();
  }

function selectedGiveawayFileIsGif(){
    const file=appContext.giveawayPhotoItems[appContext.giveawaySelectedPhotoIndex]?.file || null;
    return appContext.normalizedImageMime(file?.type)==="image/gif";
  }

function syncGiveawayWatermarkControls(){
    const originalBtn=appContext.$("giveawayWatermarkOriginalBtn");
    const applyBtn=appContext.$("giveawayWatermarkApplyBtn");
    const websiteBtn=appContext.$("giveawayWatermarkWebsiteBtn");
    const stateEl=appContext.$("giveawayWatermarkState");
    if(!originalBtn || !applyBtn || !websiteBtn || !stateEl) return;

    const hasImage=Boolean(appContext.giveawayImageEditorState.cleanSource);
    const gifMode=appContext.selectedGiveawayFileIsGif();
    const mode=appContext.giveawayImageEditorState.watermarkMode||"original";

    originalBtn.disabled=!hasImage;
    applyBtn.disabled=!hasImage || gifMode;
    websiteBtn.disabled=!hasImage || gifMode;

    originalBtn.classList.toggle("active",mode==="original");
    applyBtn.classList.toggle("active",mode==="full");
    websiteBtn.classList.toggle("active",mode==="website");

    if(!hasImage){
      stateEl.textContent="No image selected";
      stateEl.className="owner-only image-watermark-state without-mark";
      return;
    }

    if(gifMode && mode==="original"){
      stateEl.textContent="GIF preview · watermark unavailable";
      stateEl.className="owner-only image-watermark-state without-mark";
      return;
    }

    if(mode==="website"){
      stateEl.textContent="Website-only watermark preview";
      stateEl.className="owner-only image-watermark-state with-mark";
      return;
    }

    if(mode==="full"){
      stateEl.textContent="Logo + website watermark preview";
      stateEl.className="owner-only image-watermark-state with-mark";
      return;
    }

    stateEl.textContent="Original";
    stateEl.className="owner-only image-watermark-state without-mark";
  }

function syncGiveawayPrivacyControls(){
    const originalBtn=appContext.$("giveawayPrivacyOriginalBtn");
    const hideBtn=appContext.$("giveawayPrivacyHideBtn");
    const stateEl=appContext.$("giveawayPrivacyState");
    if(!originalBtn || !hideBtn || !stateEl) return;

    const hasImage=Boolean(appContext.giveawayImageEditorState.cleanSource);
    const gifMode=appContext.selectedGiveawayFileIsGif();
    const isHidden=appContext.giveawayImageEditorState.privacyApplied===true;

    originalBtn.disabled=!hasImage;
    hideBtn.disabled=!hasImage || gifMode;

    originalBtn.classList.toggle("active",!isHidden);
    hideBtn.classList.toggle("active",isHidden);

    if(!hasImage){
      stateEl.textContent="No image selected";
      stateEl.className="owner-only image-watermark-state without-mark";
      return;
    }

    if(gifMode && !isHidden){
      stateEl.textContent="GIF preview · PSA hide unavailable";
      stateEl.className="owner-only image-watermark-state without-mark";
      return;
    }

    if(isHidden){
      stateEl.textContent="PSA barcode + cert hidden";
      stateEl.className="owner-only image-watermark-state with-mark";
      return;
    }

    stateEl.textContent="Original";
    stateEl.className="owner-only image-watermark-state without-mark";
  }

async function setGiveawayImageWatermark(mode){
    if(!appContext.requireOwner("change giveaway image watermark")) return;

    const normalizedMode=
      mode==="website" ? "website" :
      (mode===true || mode==="full") ? "full" :
      "original";

    const source=appContext.currentGiveawayBaseSource() || appContext.giveawayImageEditorState.cleanSource || appContext.$("giveawayImage")?.value?.trim() || "";
    if(!source){
      appContext.showToast("Choose a giveaway image first");
      return;
    }

    if(normalizedMode==="original"){
      appContext.giveawayImageEditorState.watermarkMode="original";
      appContext.giveawayImageEditorState.watermarkApplied=false;
      appContext.commitGiveawayActiveEditorItem();
      appContext.renderGiveawayImagePreview(appContext.currentGiveawayPreviewSource());
      appContext.syncGiveawayWatermarkControls();
      return;
    }

    if(appContext.selectedGiveawayFileIsGif()){
      appContext.showToast("GIF watermark is not supported. Use JPG, PNG, or WEBP instead.");
      appContext.syncGiveawayWatermarkControls();
      return;
    }

    try{
      if(normalizedMode==="website"){
        if(!appContext.giveawayImageEditorState.websiteWatermarkedSource){
          const {img}=await appContext.loadImageElementFromSource(source);
          appContext.giveawayImageEditorState.websiteWatermarkedSource=await appContext.renderCardImage(img,1800,0.94,"website");
        }
        appContext.giveawayImageEditorState.watermarkMode="website";
        appContext.giveawayImageEditorState.watermarkApplied=true;
      }else{
        if(!appContext.giveawayImageEditorState.watermarkedSource){
          const {img}=await appContext.loadImageElementFromSource(source);
          appContext.giveawayImageEditorState.watermarkedSource=await appContext.renderCardImage(img,1800,0.94,true);
        }
        appContext.giveawayImageEditorState.watermarkMode="full";
        appContext.giveawayImageEditorState.watermarkApplied=true;
      }

      appContext.commitGiveawayActiveEditorItem();
      appContext.renderGiveawayImagePreview(appContext.currentGiveawayPreviewSource());
      appContext.syncGiveawayWatermarkControls();

      appContext.showToast(
        normalizedMode==="website"
          ? "Giveaway website-only watermark selected"
          : "Giveaway logo + website watermark selected"
      );
    }catch(error){
      console.error("Could not watermark giveaway image:",error);
      appContext.showToast("Could not apply this giveaway watermark");
      appContext.syncGiveawayWatermarkControls();
    }
  }

async function setGiveawayImagePsaPrivacy(apply){
    if(!appContext.requireOwner("change giveaway image PSA privacy")) return;

    const shouldApply=apply===true;
    const source=appContext.giveawayImageEditorState.cleanSource || appContext.$("giveawayImage")?.value?.trim() || "";
    if(!source){
      appContext.showToast("Choose a giveaway image first");
      return;
    }

    if(shouldApply && appContext.selectedGiveawayFileIsGif()){
      appContext.showToast("GIF privacy hide is not supported. Use JPG, PNG, or WEBP instead.");
      appContext.syncGiveawayPrivacyControls();
      return;
    }

    try{
      if(shouldApply){
        appContext.giveawayImageEditorState.privacyMaskedSource=await appContext.applyPsaPrivacyMaskToCardImageSource(source,0.94);
        appContext.giveawayImageEditorState.privacyApplied=true;
      }else{
        appContext.giveawayImageEditorState.privacyMaskedSource="";
        appContext.giveawayImageEditorState.privacyApplied=false;
      }

      appContext.giveawayImageEditorState.watermarkedSource="";
      appContext.giveawayImageEditorState.websiteWatermarkedSource="";

      if(appContext.giveawayImageEditorState.watermarkMode==="website"){
        const {img}=await appContext.loadImageElementFromSource(appContext.currentGiveawayBaseSource());
        appContext.giveawayImageEditorState.websiteWatermarkedSource=await appContext.renderCardImage(img,1800,0.94,"website");
        appContext.giveawayImageEditorState.watermarkApplied=true;
      }else if(appContext.giveawayImageEditorState.watermarkMode==="full"){
        const {img}=await appContext.loadImageElementFromSource(appContext.currentGiveawayBaseSource());
        appContext.giveawayImageEditorState.watermarkedSource=await appContext.renderCardImage(img,1800,0.94,true);
        appContext.giveawayImageEditorState.watermarkApplied=true;
      }else{
        appContext.giveawayImageEditorState.watermarkApplied=false;
      }

      appContext.commitGiveawayActiveEditorItem();
      appContext.renderGiveawayImagePreview(appContext.currentGiveawayPreviewSource());
      appContext.syncGiveawayWatermarkControls();
      appContext.syncGiveawayPrivacyControls();
      appContext.showToast(shouldApply ? "PSA barcode and certificate areas hidden" : "Giveaway image restored to original PSA view");
    }catch(error){
      console.error("Could not apply giveaway PSA privacy:",error);
      appContext.showToast("Could not hide PSA info on this giveaway image");
      appContext.syncGiveawayWatermarkControls();
      appContext.syncGiveawayPrivacyControls();
    }
  }

function resetGiveawayImageEditorState(url="",images=null){
    appContext.revokeAllGiveawayPhotoObjectUrls();

    const initial=Array.isArray(images)
      ? images
      : (url ? [url] : []);

    appContext.giveawayPhotoItems=initial
      .map(value=>appContext.safeHttpUrl(value||""))
      .filter(Boolean)
      .slice(0,appContext.GIVEAWAY_PHOTO_LIMIT)
      .map(value=>appContext.newGiveawayPhotoItem(value,null));

    appContext.giveawaySelectedPhotoIndex=0;
    // These items were just rebuilt from saved URLs, so there is no prior
    // editor item to commit into them.
    appContext.loadGiveawayEditorItem(0,{commitCurrent:false});
  }

function selectedGiveawayPhotoPreviewSource(index){
    const item=appContext.giveawayPhotoItems[index];
    if(!item) return "";
    if(index===appContext.giveawaySelectedPhotoIndex){
      appContext.commitGiveawayActiveEditorItem();
    }
    if(item.watermarkMode==="website" && item.websiteWatermarkedSource) return item.websiteWatermarkedSource;
    if(item.watermarkMode==="full" && item.watermarkedSource) return item.watermarkedSource;
    if(item.privacyApplied && item.privacyMaskedSource) return item.privacyMaskedSource;
    return item.cleanSource||"";
  }

function renderGiveawayImagePreview(url){
    const mount=appContext.$("giveawayImagePreview");
    if(!mount) return;

    if(!appContext.giveawayPhotoItems.length){
      mount.innerHTML=`<div class="giveaway-photo-empty">No giveaway photos selected yet.</div>`;
      return;
    }

    const selected=Math.max(0,Math.min(appContext.giveawaySelectedPhotoIndex,appContext.giveawayPhotoItems.length-1));
    const selectedUrl=url || appContext.selectedGiveawayPhotoPreviewSource(selected);

    mount.innerHTML=`
      <div class="giveaway-photo-selected">
        <div class="giveaway-image-preview">
          ${selectedUrl ? `<img src="${appContext.escapeHtml(selectedUrl)}" alt="Giveaway photo ${selected+1} preview">` : ""}
          <span class="giveaway-photo-number">${selected+1} / ${appContext.giveawayPhotoItems.length}</span>
        </div>
        <div class="giveaway-photo-selected-actions">
          <button type="button" class="btn-ghost" data-giveaway-photo-move="-1" ${selected===0?"disabled":""}>← Move</button>
          <button type="button" class="btn-ghost" data-giveaway-photo-move="1" ${selected===appContext.giveawayPhotoItems.length-1?"disabled":""}>Move →</button>
          <button type="button" class="btn-ghost" data-giveaway-photo-remove="${selected}" style="color:var(--danger)">Remove</button>
        </div>
      </div>

      <div class="giveaway-photo-thumbs" aria-label="Giveaway photos">
        ${appContext.giveawayPhotoItems.map((item,index)=>{
          const thumb=appContext.selectedGiveawayPhotoPreviewSource(index);
          return `
            <button type="button"
                    class="giveaway-photo-thumb ${index===selected?"active":""}"
                    data-giveaway-photo-select="${index}"
                    aria-label="Edit giveaway photo ${index+1}">
              ${thumb ? `<img src="${appContext.escapeHtml(thumb)}" alt="">` : ""}
              <span>${index+1}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  Object.assign(appContext,{giveawayDateLabel,giveawayEndsInputToIso,giveawayEndsIsoToInputValue,uploadOwnerImage,uploadGiveawayImage,uploadOwnerProcessedImage,loadGiveawayWinnerListingFrame,getGiveawayWinnerListingOverlay,renderGiveawayWinnerListingImage,newGiveawayPhotoItem,giveawayPhotoSourcesFromRecord,commitGiveawayActiveEditorItem,loadGiveawayEditorItem,revokeAllGiveawayPhotoObjectUrls,revokeGiveawayPreviewObjectUrl,currentGiveawayBaseSource,currentGiveawayPreviewSource,selectedGiveawayFileIsGif,syncGiveawayWatermarkControls,syncGiveawayPrivacyControls,setGiveawayImageWatermark,setGiveawayImagePsaPrivacy,resetGiveawayImageEditorState,selectedGiveawayPhotoPreviewSource,renderGiveawayImagePreview});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.GIVEAWAY_WINNER_LISTING_FRAME = "./assets/giveaway-winner-frame.png";

  appContext.giveawayWinnerListingFramePromise = null;

  appContext.giveawayWinnerListingOverlayPromise = null;

  appContext.GIVEAWAY_PHOTO_LIMIT = 10;

  appContext.giveawayPhotoItems = [];

  appContext.giveawaySelectedPhotoIndex = 0;

  appContext.giveawayImageEditorState = {
    cleanSource:"",
    privacyMaskedSource:"",
    privacyApplied:false,
    watermarkedSource:"",
    websiteWatermarkedSource:"",
    watermarkApplied:false,
    watermarkMode:"original",
    objectUrl:""
  };
}
