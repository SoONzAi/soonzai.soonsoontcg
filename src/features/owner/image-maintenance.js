/** V93 beta: features/owner/image-maintenance. Shared dependencies are explicit on appContext. */
export function register(appContext){
async function switchCardWatermarkVariant(card,target,onProgress){
    if(!card || !appContext.requireOwner("change card watermark")) return {ok:false,error:"Owner login required"};
    if(!appContext.cardImageVariantsSupported) return {ok:false,error:"Run the reversible watermark migration first"};
    if(!["original","watermarked"].includes(target)) return {ok:false,error:"Invalid watermark target"};

    await appContext.ensureCardImagesLoaded(card);
    const currentImages=appContext.getImages(card).slice();
    if(!currentImages.length) return {ok:true,changed:false,count:0};

    const storedVariants=await appContext.fetchOwnerCardImageVariants(card.id);
    const prepared=[];
    const newlyUploadedPaths=[];

    try{
      for(let i=0;i<currentImages.length;i++){
        if(typeof onProgress==="function") onProgress(i,currentImages.length);

        const current=currentImages[i];
        let variant=storedVariants.find(v=>
          v.original_url===current || v.watermarked_url===current
        );

        if(!variant){
          // First time this image is managed by the reversible system.
          // The currently stored image becomes the original source.
          variant={
            image_key:appContext.newCardImageVariantKey(),
            original_url:current,
            watermarked_url:"",
            active_variant:"original"
          };
        }else{
          variant={...variant};
        }

        if(target==="watermarked" && !variant.watermarked_url){
          const original=appContext.safeHttpUrl(variant.original_url)||variant.original_url;
          if(!original) throw new Error(`Original image unavailable for image ${i+1}`);

          const processed=await appContext.applyWatermarkToCardImageSource(original,1800,0.94);
          const stored=await appContext.uploadPendingCardImage(processed,i);
          variant.watermarked_url=stored.url;
          newlyUploadedPaths.push(stored.path);
        }

        variant.active_variant=target;
        prepared.push(variant);

        if(typeof onProgress==="function") onProgress(i+1,currentImages.length);
      }

      const targetImages=prepared.map(v=>
        target==="watermarked"
          ? (v.watermarked_url||v.original_url)
          : v.original_url
      );

      if(targetImages.some(v=>!appContext.safeHttpUrl(v))){
        throw new Error("One or more image URLs are invalid");
      }

      // Save reversible metadata first. If the public card update fails, restore
      // the previous active_variant values so the metadata remains truthful.
      const previousByKey=new Map(storedVariants.map(v=>[v.image_key,v.active_variant]));
      const variantResult=await appContext.saveOwnerCardImageVariants(card.id,prepared);
      if(!variantResult.ok){
        throw new Error("Could not save reversible watermark metadata");
      }

      const saved=await appContext.saveMigratedCardImageUrls(card.id,targetImages);
      if(!saved){
        const rollback=prepared.map(v=>({
          ...v,
          active_variant:previousByKey.get(v.image_key)||(
            currentImages.includes(v.watermarked_url) ? "watermarked" : "original"
          )
        }));
        await appContext.saveOwnerCardImageVariants(card.id,rollback);
        await appContext.removeCardStoragePaths(newlyUploadedPaths);
        return {ok:false,error:"Database update failed"};
      }

      card.images=Array.isArray(saved.images)?saved.images.slice():targetImages.slice();
      card.image=card.images[0]||null;
      card.thumbnail_url=card.image||"";
      card._images_loaded=true;
      if(saved.updated_at) card.updated_at=saved.updated_at;

      // Keep BOTH original and watermarked files. They are intentionally
      // retained so this operation is reversible later.
      return {
        ok:true,
        changed:currentImages.some((url,i)=>url!==targetImages[i]),
        count:targetImages.length
      };
    }catch(error){
      if(newlyUploadedPaths.length){
        await appContext.removeCardStoragePaths(newlyUploadedPaths);
      }
      console.error("Bulk reversible watermark switch failed:",card?.id,error);
      return {ok:false,error:String(error?.message||"Watermark switch failed")};
    }
  }

async function reapplyCardWatermarkVariants(card,onProgress){
    if(!card || !appContext.requireOwner("reapply card watermark")) return {ok:false,error:"Owner login required"};
    if(!appContext.cardImageVariantsSupported) return {ok:false,error:"Run the reversible watermark migration first"};

    await appContext.ensureCardImagesLoaded(card);
    const currentImages=appContext.getImages(card).slice();
    if(!currentImages.length) return {ok:true,changed:false,count:0};

    const storedVariants=await appContext.fetchOwnerCardImageVariants(card.id);
    const prepared=[];
    const newlyUploadedPaths=[];
    const oldWatermarkedPaths=[];

    try{
      for(let i=0;i<currentImages.length;i++){
        if(typeof onProgress==="function") onProgress(i,currentImages.length);

        const current=currentImages[i];
        let variant=storedVariants.find(v=>
          v.original_url===current || v.watermarked_url===current
        );

        if(!variant){
          // If this image has never used the reversible system, treat the
          // current stored file as its clean/original source.
          variant={
            image_key:appContext.newCardImageVariantKey(),
            original_url:current,
            watermarked_url:"",
            active_variant:"original"
          };
        }else{
          variant={...variant};
        }

        const original=appContext.safeHttpUrl(variant.original_url)||variant.original_url;
        if(!original) throw new Error(`Original image unavailable for image ${i+1}`);

        const previousWatermarked=appContext.safeHttpUrl(variant.watermarked_url)||"";
        const processed=await appContext.applyWatermarkToCardImageSource(original,1800,0.94);
        const stored=await appContext.uploadPendingCardImage(processed,i);

        newlyUploadedPaths.push(stored.path);
        if(previousWatermarked){
          const oldPath=appContext.cardStoragePathFromUrl(previousWatermarked);
          if(oldPath) oldWatermarkedPaths.push(oldPath);
        }

        variant.watermarked_url=stored.url;
        prepared.push(variant);

        if(typeof onProgress==="function") onProgress(i+1,currentImages.length);
      }

      const publicImages=prepared.map((variant,index)=>
        variant.active_variant==="watermarked"
          ? variant.watermarked_url
          : (variant.original_url || currentImages[index])
      );

      if(publicImages.some(v=>!appContext.safeHttpUrl(v))){
        throw new Error("One or more image URLs are invalid");
      }

      const variantResult=await appContext.saveOwnerCardImageVariants(card.id,prepared);
      if(!variantResult.ok){
        throw new Error("Could not save refreshed watermark metadata");
      }

      const saved=await appContext.saveMigratedCardImageUrls(card.id,publicImages);
      if(!saved){
        await appContext.removeCardStoragePaths(newlyUploadedPaths);
        return {ok:false,error:"Database update failed"};
      }

      card.images=Array.isArray(saved.images)?saved.images.slice():publicImages.slice();
      card.image=card.images[0]||null;
      card.thumbnail_url=card.image||"";
      card._images_loaded=true;
      if(saved.updated_at) card.updated_at=saved.updated_at;

      // The metadata and public URLs now point to the new watermarked files,
      // so stale watermarked Storage objects can be removed safely.
      const keepPaths=new Set(
        prepared.flatMap(v=>[v.original_url,v.watermarked_url])
          .map(appContext.cardStoragePathFromUrl)
          .filter(Boolean)
      );
      const stalePaths=[...new Set(oldWatermarkedPaths)].filter(path=>!keepPaths.has(path));
      if(stalePaths.length) await appContext.removeCardStoragePaths(stalePaths);

      return {ok:true,changed:true,count:prepared.length};
    }catch(error){
      if(newlyUploadedPaths.length){
        await appContext.removeCardStoragePaths(newlyUploadedPaths);
      }
      console.error("Reapply watermark failed:",card?.id,error);
      return {ok:false,error:String(error?.message||"Watermark refresh failed")};
    }
  }

async function reapplyAllCardsWatermarkVariants(onProgress){
    if(!appContext.requireOwner("reapply all card watermarks")){
      return {ok:false,done:0,failed:0,skipped:0,total:0};
    }
    if(!appContext.cardImageVariantsSupported){
      appContext.showToast("Run the reversible watermark migration first");
      return {ok:false,done:0,failed:0,skipped:0,total:0};
    }

    const eligible=appContext.cards.filter(card=>appContext.getImages(card).length);
    let done=0;
    let failed=0;
    let skipped=0;

    for(let i=0;i<eligible.length;i++){
      const card=eligible[i];

      if(typeof onProgress==="function"){
        onProgress({
          cardIndex:i,
          cardTotal:eligible.length,
          imageIndex:0,
          imageTotal:appContext.getImages(card).length,
          card
        });
      }

      const result=await appContext.reapplyCardWatermarkVariants(card,(imageIndex,imageTotal)=>{
        if(typeof onProgress==="function"){
          onProgress({
            cardIndex:i,
            cardTotal:eligible.length,
            imageIndex,
            imageTotal,
            card
          });
        }
      });

      if(result.ok){
        if(result.count) done++;
        else skipped++;
      }else{
        failed++;
      }
    }

    return {ok:failed===0,done,failed,skipped,total:eligible.length};
  }

async function switchAllCardsWatermarkVariant(target,onProgress){
    if(!appContext.requireOwner("change all card watermarks")){
      return {ok:false,done:0,failed:0,skipped:0};
    }
    if(!appContext.cardImageVariantsSupported){
      appContext.showToast("Run the reversible watermark migration first");
      return {ok:false,done:0,failed:0,skipped:0};
    }

    const eligible=appContext.cards.filter(card=>appContext.getImages(card).length);
    let done=0;
    let failed=0;
    let skipped=0;

    for(let i=0;i<eligible.length;i++){
      const card=eligible[i];
      if(typeof onProgress==="function"){
        onProgress({
          cardIndex:i,
          cardTotal:eligible.length,
          imageIndex:0,
          imageTotal:appContext.getImages(card).length,
          card
        });
      }

      const result=await appContext.switchCardWatermarkVariant(card,target,(imageIndex,imageTotal)=>{
        if(typeof onProgress==="function"){
          onProgress({
            cardIndex:i,
            cardTotal:eligible.length,
            imageIndex,
            imageTotal,
            card
          });
        }
      });

      if(result.ok){
        if(result.changed) done++;
        else skipped++;
      }else{
        failed++;
      }
    }

    return {ok:failed===0,done,failed,skipped,total:eligible.length};
  }

async function reprocessCardImages(card,onProgress){
    if(!card || !appContext.requireOwner("reprocess card images")) return {ok:false,error:"Owner login required"};
    await appContext.ensureCardImagesLoaded(card);
    const original=appContext.getImages(card).slice();
    if(!original.length) return {ok:false,error:"No images"};
    if(original.some(appContext.isPendingCardImage)) return {ok:false,error:"Migrate legacy Base64 images first"};

    const newUrls=[];
    const newPaths=[];
    try{
      for(let i=0;i<original.length;i++){
        const src=appContext.safeHttpUrl(original[i]);
        if(!src) throw new Error(`Invalid image URL ${i+1}`);
        if(typeof onProgress==="function") onProgress(i,original.length);
        const processed=await appContext.watermarkImageUrl(src,1800,0.94);
        const stored=await appContext.uploadPendingCardImage(processed,i);
        newUrls.push(stored.url);
        newPaths.push(stored.path);
        if(typeof onProgress==="function") onProgress(i+1,original.length);
      }

      const saved=await appContext.saveMigratedCardImageUrls(card.id,newUrls);
      if(!saved){
        await appContext.removeCardStoragePaths(newPaths);
        return {ok:false,error:"Database update failed"};
      }

      card.images=Array.isArray(saved.images)?saved.images.slice():newUrls.slice();
      card.image=card.images[0]||null;
      card.thumbnail_url=card.image||"";
      card._images_loaded=true;
      if(saved.updated_at) card.updated_at=saved.updated_at;

      // Delete old owned Storage objects only after the database points to the
      // replacement files. External image URLs are never deleted.
      await appContext.cleanupRemovedCardStorageImages(original,card.images);
      return {ok:true,count:newUrls.length};
    }catch(error){
      await appContext.removeCardStoragePaths(newPaths);
      console.error("Image reprocess failed:",card.id,error);
      return {ok:false,error:String(error?.message||"Reprocess failed")};
    }
  }

function renderImageReprocessPage(){
    if(!appContext.requireOwner("open image reprocessor")) return;
    const eligible=appContext.cards.filter(card=>appContext.getImages(card).length && !appContext.getImages(card).some(appContext.isPendingCardImage));
    const selected=new Set();

    appContext.view.innerHTML=`
      <div class="page-head"><div><div class="eyebrow">Inventory Tools · Quality</div><h2>Reprocess Images</h2><p>Manage image quality and the reversible Collect TCG watermark.</p></div></div>

      <section class="panel bulk-watermark-panel owner-only">
        <div class="bulk-watermark-copy">
          <div class="eyebrow">Reversible watermark</div>
          <h3>All card photos</h3>
          <p>Switch every card with photos between its saved original and watermarked version. Use <strong>Reapply current watermark</strong> after changing the watermark design to regenerate existing watermarked copies from the clean originals without re-uploading images.</p>
        </div>
        <div class="bulk-watermark-actions">
          <button type="button" class="btn-primary" id="watermarkAllCardsBtn">Watermark all cards</button>
          <button type="button" class="btn-ghost" id="reapplyAllWatermarksBtn">Reapply current watermark</button>
          <button type="button" class="btn-ghost" id="originalAllCardsBtn">Use originals for all cards</button>
        </div>
        <div class="bulk-watermark-progress" id="bulkWatermarkProgress">Ready</div>
      </section>

      <div class="image-reprocess-warning"><strong>Older images</strong><span>For photos that were already permanently watermarked before the reversible system was installed, the current file may be the only source available. Upload the clean original once if you need a truly unwatermarked version.</span></div>
      <div class="image-reprocess-layout">
        <section class="panel"><div class="image-reprocess-toolbar"><button class="btn-ghost" id="reprocessSelectAll" type="button">Select All</button><button class="btn-ghost" id="reprocessClear" type="button">Clear</button><span id="reprocessCount">0 selected</span></div><div class="image-reprocess-list" id="reprocessList">${eligible.map(card=>`<label class="image-reprocess-row"><input type="checkbox" value="${appContext.escapeHtml(card.id)}"><span class="image-reprocess-thumb">${appContext.getImages(card)[0]?`<img src="${appContext.escapeHtml(appContext.getImages(card)[0])}" alt="" loading="lazy" decoding="async">`:"No image"}</span><span><strong>${appContext.escapeHtml(card.name)}</strong><small>${appContext.escapeHtml([card.card_code,card.series].filter(Boolean).join(" · "))} · ${appContext.getImages(card).length} image${appContext.getImages(card).length===1?"":"s"}</small></span></label>`).join("")}</div></section>
        <section class="panel image-reprocess-action"><h3>High-quality reprocess</h3><p>1800px maximum dimension · JPEG quality 0.94 · current transparent vibrant watermark.</p><button type="button" class="btn-primary" id="reprocessRun">Reprocess selected</button><div class="hint" id="reprocessStatus"></div></section>
      </div>`;

    async function runBulkWatermarkSwitch(target){
      if(!appContext.requireOwner("change all card watermarks")) return;
      if(!appContext.cardImageVariantsSupported){
        appContext.showToast("Run the reversible watermark migration first");
        return;
      }

      const eligibleCount=appContext.cards.filter(card=>appContext.getImages(card).length).length;
      if(!eligibleCount){
        appContext.showToast("No cards with images found");
        return;
      }

      const watermarked=target==="watermarked";
      const actionLabel=watermarked ? "watermark" : "switch to original for";
      const confirmText=watermarked
        ? `Watermark all ${eligibleCount} card listing${eligibleCount===1?"":"s"} with images?\n\nThe original versions will be preserved so this can be reversed later. The first run may take time and use additional Supabase Storage because watermarked copies must be created.`
        : `Switch all ${eligibleCount} card listing${eligibleCount===1?"":"s"} back to their saved original images?\n\nWatermarked copies will be kept privately so you can switch back later.`;

      if(!confirm(confirmText)) return;

      const watermarkBtn=appContext.$("watermarkAllCardsBtn");
      const reapplyBtn=appContext.$("reapplyAllWatermarksBtn");
      const originalBtn=appContext.$("originalAllCardsBtn");
      const progress=appContext.$("bulkWatermarkProgress");
      watermarkBtn.disabled=true;
      if(reapplyBtn) reapplyBtn.disabled=true;
      originalBtn.disabled=true;

      try{
        const result=await appContext.switchAllCardsWatermarkVariant(target,state=>{
          if(!progress) return;
          const cardName=String(state.card?.name||"Card").slice(0,80);
          progress.textContent=
            `${state.cardIndex+1}/${state.cardTotal} · ${cardName}`+
            (state.imageTotal ? ` · image ${state.imageIndex}/${state.imageTotal}` : "");
        });

        if(progress){
          progress.textContent=
            `Finished · ${result.done} changed · ${result.skipped} already set · ${result.failed} failed`;
        }

        appContext.showToast(result.failed
          ? `${result.done} changed · ${result.failed} failed`
          : `${result.done} card${result.done===1?"":"s"} changed · ${result.skipped} already set`);

        // Refresh owner cards so every route reflects the new public image URLs.
        await appContext.loadCards();
      }finally{
        watermarkBtn.disabled=false;
        if(reapplyBtn) reapplyBtn.disabled=false;
        originalBtn.disabled=false;
      }
    }

    async function runBulkWatermarkReapply(){
      if(!appContext.requireOwner("reapply all card watermarks")) return;
      if(!appContext.cardImageVariantsSupported){
        appContext.showToast("Run the reversible watermark migration first");
        return;
      }

      const eligibleCount=appContext.cards.filter(card=>appContext.getImages(card).length).length;
      if(!eligibleCount){
        appContext.showToast("No cards with images found");
        return;
      }

      const ok=confirm(
        `Reapply the current logo + website watermark to ${eligibleCount} card listing${eligibleCount===1?"":"s"}?\n\n`+
        `This regenerates each watermarked copy from its saved original image. You do not need to re-upload the pictures. Clean originals are not modified.`
      );
      if(!ok) return;

      const watermarkBtn=appContext.$("watermarkAllCardsBtn");
      const reapplyBtn=appContext.$("reapplyAllWatermarksBtn");
      const originalBtn=appContext.$("originalAllCardsBtn");
      const progress=appContext.$("bulkWatermarkProgress");

      watermarkBtn.disabled=true;
      reapplyBtn.disabled=true;
      originalBtn.disabled=true;

      try{
        const result=await appContext.reapplyAllCardsWatermarkVariants(state=>{
          if(!progress) return;
          const cardName=String(state.card?.name||"Card").slice(0,80);
          progress.textContent=
            `${state.cardIndex+1}/${state.cardTotal} · ${cardName}`+
            (state.imageTotal ? ` · image ${state.imageIndex}/${state.imageTotal}` : "");
        });

        if(progress){
          progress.textContent=
            `Finished · ${result.done} refreshed · ${result.skipped} skipped · ${result.failed} failed`;
        }

        appContext.showToast(result.failed
          ? `${result.done} refreshed · ${result.failed} failed`
          : `${result.done} card${result.done===1?"":"s"} refreshed with the current watermark`);

        await appContext.loadCards();
      }finally{
        watermarkBtn.disabled=false;
        reapplyBtn.disabled=false;
        originalBtn.disabled=false;
      }
    }

    appContext.$("watermarkAllCardsBtn")?.addEventListener("click",()=>runBulkWatermarkSwitch("watermarked"));
    appContext.$("reapplyAllWatermarksBtn")?.addEventListener("click",runBulkWatermarkReapply);
    appContext.$("originalAllCardsBtn")?.addEventListener("click",()=>runBulkWatermarkSwitch("original"));

    const sync=()=>{
      selected.clear();
      appContext.$("reprocessList").querySelectorAll('input[type="checkbox"]:checked').forEach(cb=>selected.add(String(cb.value)));
      appContext.$("reprocessCount").textContent=`${selected.size} selected`;
    };
    appContext.$("reprocessList").addEventListener("change",sync);
    appContext.$("reprocessSelectAll").addEventListener("click",()=>{appContext.$("reprocessList").querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=true);sync();});
    appContext.$("reprocessClear").addEventListener("click",()=>{appContext.$("reprocessList").querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=false);sync();});
    appContext.$("reprocessRun").addEventListener("click",async()=>{
      if(!appContext.requireOwner("reprocess selected card images")) return;
      if(!selected.size){appContext.showToast("Select at least one listing");return;}
      if(!confirm(`Reprocess images for ${selected.size} selected listing${selected.size===1?"":"s"}?\n\nExisting owned Storage files are deleted only after replacement images are uploaded and the database update succeeds.`)) return;
      const btn=appContext.$("reprocessRun");
      btn.disabled=true;
      let done=0,failed=0;
      try{
        const ids=[...selected];
        for(let n=0;n<ids.length;n++){
          const card=appContext.cards.find(c=>String(c.id)===ids[n]);
          if(!card){failed++;continue;}
          const result=await appContext.reprocessCardImages(card,(i,total)=>{appContext.$("reprocessStatus").textContent=`${n+1}/${ids.length} · ${card.name} · image ${i}/${total}`;});
          if(result.ok) done++; else failed++;
        }
        appContext.showToast(failed?`${done} reprocessed · ${failed} failed`:`${done} listing${done===1?"":"s"} reprocessed`);
        appContext.renderInventoryToolsPage();
      }finally{btn.disabled=false;}
    });
  }

function legacyCardImageStats(){
    let cardsWithLegacy=0;
    let legacyImages=0;
    let estimatedBytes=0;

    appContext.cards.forEach(card=>{
      const images=appContext.getImages(card);
      const legacy=images.filter(appContext.isPendingCardImage);
      if(!legacy.length) return;

      cardsWithLegacy++;
      legacyImages+=legacy.length;

      legacy.forEach(value=>{
        const source=String(value||"");
        const comma=source.indexOf(",");
        if(comma<0) return;
        const b64=source.slice(comma+1).replace(/\s+/g,"");
        // Base64 represents roughly 3 bytes per 4 characters.
        estimatedBytes+=Math.floor(b64.length*3/4);
      });
    });

    return {cardsWithLegacy,legacyImages,estimatedBytes};
  }

function formatApproxBytes(bytes){
    const n=Math.max(0,Number(bytes)||0);
    if(n<1024) return `${Math.round(n)} B`;
    if(n<1024*1024) return `${(n/1024).toFixed(n<10*1024?1:0)} KB`;
    if(n<1024*1024*1024) return `${(n/(1024*1024)).toFixed(n<10*1024*1024?1:0)} MB`;
    return `${(n/(1024*1024*1024)).toFixed(2)} GB`;
  }

async function saveMigratedCardImageUrls(cardId,images){
    if(!appContext.requireOwner("migrate card images")) return null;

    const id=appContext.safeCardId(cardId);
    if(!id || !Array.isArray(images) || images.some(appContext.isPendingCardImage)) return null;

    // Deliberately update only the images column. A migration must never
    // accidentally modify prices, grading, lifecycle, notes, or other fields.
    const {data,error}=await appContext.supabaseClient
      .from("cards")
      .update({images:images.slice()})
      .eq("id",id)
      .select("id,images,updated_at")
      .single();

    if(error){
      console.error("Legacy image migration DB update failed:",error);
      return null;
    }

    return data;
  }

async function migrateLegacyImagesForCard(card,onProgress){
    if(!card || !appContext.requireOwner("migrate legacy card image")) return {ok:false,error:"Owner login required"};

    const originalImages=appContext.getImages(card).slice();
    const legacyCount=originalImages.filter(appContext.isPendingCardImage).length;
    if(!legacyCount) return {ok:true,migrated:0};

    let prepared=null;
    try{
      prepared=await appContext.prepareCardImagesForStorage(
        {images:originalImages},
        (done,total)=>{
          if(typeof onProgress==="function") onProgress(done,total);
        }
      );

      // Verify every legacy image became a normal HTTPS Storage URL before
      // touching the database.
      if(prepared.images.some(appContext.isPendingCardImage)){
        throw new Error("Legacy image verification failed");
      }
      const invalidUrl=prepared.images.find(image=>!appContext.safeHttpUrl(image));
      if(invalidUrl){
        throw new Error("Migrated image URL verification failed");
      }

      const saved=await appContext.saveMigratedCardImageUrls(card.id,prepared.images);
      if(!saved){
        await appContext.removeCardStoragePaths(prepared.uploadedPaths);
        return {ok:false,error:"Database update failed"};
      }

      // Update only the local image fields after DB confirmation.
      card.images=Array.isArray(saved.images)?saved.images.slice():prepared.images.slice();
      card.image=card.images[0]||null;
      if(saved.updated_at) card.updated_at=saved.updated_at;

      return {ok:true,migrated:legacyCount};
    }catch(error){
      if(prepared?.uploadedPaths?.length){
        await appContext.removeCardStoragePaths(prepared.uploadedPaths);
      }
      console.error("Legacy image migration failed:",card.id,error);
      return {ok:false,error:String(error?.message||"Migration failed")};
    }
  }

async function fetchSupabaseCapacityUsage(){
    if(!appContext.requireOwner("check Supabase capacity usage")) return null;

    const {data,error}=await appContext.supabaseClient.rpc("get_owner_capacity_usage");
    if(error){
      console.warn("Supabase capacity usage RPC unavailable:",error);
      return {
        ok:false,
        databaseBytes:null,
        storageBytes:null,
        storageFileCount:null,
        error:String(error.message||"Capacity usage unavailable")
      };
    }

    const row=Array.isArray(data) ? data[0] : data;
    const databaseBytes=Number(row?.database_bytes);
    const storageBytes=Number(row?.storage_bytes);
    const storageFileCount=Number(row?.storage_file_count);

    if(!Number.isFinite(databaseBytes) || !Number.isFinite(storageBytes)){
      return {
        ok:false,
        databaseBytes:null,
        storageBytes:null,
        storageFileCount:null,
        error:"Capacity RPC returned an invalid result"
      };
    }

    return {
      ok:true,
      databaseBytes:Math.max(0,databaseBytes),
      storageBytes:Math.max(0,storageBytes),
      storageFileCount:Number.isFinite(storageFileCount)?Math.max(0,storageFileCount):0
    };
  }

function capacityPercent(used,limit){
    if(!Number.isFinite(used) || !Number.isFinite(limit) || limit<=0) return 0;
    return Math.max(0,(used/limit)*100);
  }

function capacityLeft(used,limit){
    return Math.max(0,Number(limit||0)-Math.max(0,Number(used||0)));
  }

function capacitySummaryText(label,used,limit){
    const percent=appContext.capacityPercent(used,limit);
    return `${label}: ${appContext.formatApproxBytes(used)} used · ${appContext.formatApproxBytes(appContext.capacityLeft(used,limit))} left · ${percent.toFixed(percent<1?2:1)}% used`;
  }

async function checkCardImageStorageReady(){
    if(!appContext.requireOwner("check card image Storage")) return {ok:false,message:"Owner login required"};

    const probeBlob=new Blob(["collect-tcg-storage-probe"],{type:"image/jpeg"});
    const randomPart=(crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,12)}`)
      .replace(/[^a-zA-Z0-9-]/g,"");
    const path=`${appContext.ownerSession.user.id}/_migration-probe-${randomPart}.jpg`;

    const {error:uploadError}=await appContext.supabaseClient.storage
      .from(appContext.CARD_IMAGE_STORAGE_BUCKET)
      .upload(path,probeBlob,{
        cacheControl:"60",
        upsert:false,
        contentType:"image/jpeg"
      });

    if(uploadError){
      const raw=[uploadError.message,uploadError.error,uploadError.statusCode]
        .filter(Boolean).join(" · ");
      return {
        ok:false,
        message:raw || "Storage upload probe failed"
      };
    }

    const {data}=appContext.supabaseClient.storage.from(appContext.CARD_IMAGE_STORAGE_BUCKET).getPublicUrl(path);
    const publicUrl=appContext.safeHttpUrl(data?.publicUrl||"");

    const {error:removeError}=await appContext.supabaseClient.storage
      .from(appContext.CARD_IMAGE_STORAGE_BUCKET)
      .remove([path]);

    if(!publicUrl){
      return {ok:false,message:"Storage upload succeeded but no public URL was returned."};
    }

    if(removeError){
      return {
        ok:false,
        message:`Upload works, but cleanup/delete is blocked: ${removeError.message||"unknown Storage delete error"}`
      };
    }

    return {ok:true,message:"Storage upload and cleanup test passed."};
  }

function renderLegacyImageMigrationPage(){
    if(!appContext.requireOwner("open legacy image migration")) return;

    const initialStats=appContext.legacyCardImageStats();

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Storage</div>
          <h2>Legacy Image Migration</h2>
          <p>Move old Base64 card images out of PostgreSQL and into the secure <strong>card-images</strong> Storage bucket.</p>
        </div>
      </div>

      <div class="storage-migration-stats">
        <div><strong id="migrationCardsRemaining">${initialStats.cardsWithLegacy}</strong><span>Cards remaining</span></div>
        <div><strong id="migrationImagesRemaining">${initialStats.legacyImages}</strong><span>Legacy images</span></div>
        <div><strong id="migrationEstimatedSize">${appContext.escapeHtml(appContext.formatApproxBytes(initialStats.estimatedBytes))}</strong><span>Approx. embedded data</span></div>
        <div><strong id="migrationCompleted">0</strong><span>Cards migrated this run</span></div>
        <div><strong id="migrationStorageUsed">—</strong><span>File Storage used</span></div>
        <div><strong id="migrationStorageLeft">—</strong><span>File Storage left</span></div>
        <div><strong id="migrationDatabaseUsed">—</strong><span>Database used</span></div>
        <div><strong id="migrationDatabaseLeft">—</strong><span>Database left</span></div>
      </div>

      <section class="panel storage-migration-panel">
        <div class="storage-migration-warning">
          <strong>Safe migration behavior</strong>
          <span>Each image is uploaded and verified first. Only then is that card's <code>images</code> column replaced with Storage URLs. If upload or database update fails, newly uploaded files for that card are rolled back and the original database images remain untouched.</span>
        </div>

        <div class="storage-migration-progress">
          <div class="storage-migration-progress-head">
            <strong id="migrationProgressLabel">${initialStats.cardsWithLegacy ? "Ready to migrate" : "No legacy Base64 card images remain"}</strong>
            <span id="migrationProgressNumbers">0 / ${initialStats.cardsWithLegacy}</span>
          </div>
          <progress id="migrationProgressBar" max="${Math.max(1,initialStats.cardsWithLegacy)}" value="0"></progress>
          <div class="hint" id="migrationCurrentCard"></div>
        </div>

        <div class="storage-migration-actions">
          <button type="button" class="btn-ghost" id="migrationRefreshStorageBtn">
            Refresh Supabase Usage
          </button>
          <button type="button" class="btn-ghost" id="migrationTestBtn">
            Test Storage Connection
          </button>
          <button type="button" class="btn-primary" id="migrationStartBtn" ${initialStats.cardsWithLegacy?"":"disabled"}>
            Migrate Existing Images
          </button>
          <button type="button" class="btn-ghost" id="migrationStopBtn" disabled>
            Stop After Current Card
          </button>
        </div>

        <div class="storage-migration-preflight" id="migrationPreflight">
          Storage has not been tested yet.
        </div>

        <div class="storage-migration-result" id="migrationResult">
          ${initialStats.cardsWithLegacy
            ? `This process can be safely rerun. Already migrated cards are skipped automatically. Keep this browser tab open while it runs.`
            : `All currently loaded card images are already Storage URLs or external URLs.`}
        </div>
        <div class="hint storage-limit-note">Free-plan limits shown here: <strong>500 MB PostgreSQL database</strong> and <strong>1 GB file Storage</strong>. Usage is read from your Supabase project through an owner-only RPC; remaining capacity is calculated from those Free-plan limits.</div>
      </section>

      <section class="panel storage-migration-notes">
        <h3>What this improves</h3>
        <p>After migration, Supabase no longer has to send large Base64 image strings inside every card row. The public catalogue response becomes much smaller and should load substantially faster.</p>
        <p><strong>Note:</strong> PostgreSQL's reported allocated database size may not drop immediately after the migration because space reclamation is handled separately by PostgreSQL/Supabase. The row payload itself becomes smaller immediately.</p>
      </section>
    `;

    const refreshStorageBtn=appContext.$("migrationRefreshStorageBtn");
    const testBtn=appContext.$("migrationTestBtn");
    const startBtn=appContext.$("migrationStartBtn");
    const storageUsedEl=appContext.$("migrationStorageUsed");
    const storageLeftEl=appContext.$("migrationStorageLeft");
    const databaseUsedEl=appContext.$("migrationDatabaseUsed");
    const databaseLeftEl=appContext.$("migrationDatabaseLeft");
    const stopBtn=appContext.$("migrationStopBtn");
    const preflight=appContext.$("migrationPreflight");
    const progress=appContext.$("migrationProgressBar");
    const progressLabel=appContext.$("migrationProgressLabel");
    const progressNumbers=appContext.$("migrationProgressNumbers");
    const currentCard=appContext.$("migrationCurrentCard");
    const result=appContext.$("migrationResult");
    const cardsRemaining=appContext.$("migrationCardsRemaining");
    const imagesRemaining=appContext.$("migrationImagesRemaining");
    const estimatedSize=appContext.$("migrationEstimatedSize");
    const completedEl=appContext.$("migrationCompleted");

    let stopRequested=false;
    let running=false;

    async function refreshStorageUsage(){
      if(!appContext.isOwnerMode()) return;
      const old=refreshStorageBtn?.textContent;
      if(refreshStorageBtn){
        refreshStorageBtn.disabled=true;
        refreshStorageBtn.textContent="Refreshing…";
      }

      try{
        const usage=await appContext.fetchSupabaseCapacityUsage();
        if(!usage?.ok){
          storageUsedEl.textContent="Unavailable";
          storageLeftEl.textContent="Unavailable";
          databaseUsedEl.textContent="Unavailable";
          databaseLeftEl.textContent="Unavailable";

          const detail=usage?.error
            ? `Supabase capacity usage unavailable: ${usage.error}. Run supabase-owner-capacity-usage-migration.sql once in Supabase SQL Editor.`
            : "Supabase capacity usage unavailable.";
          storageUsedEl.title=detail;
          databaseUsedEl.title=detail;
          if(usage?.error) console.warn("Supabase capacity usage:",usage.error);
          return;
        }

        const storageUsed=usage.storageBytes;
        const storageLeft=appContext.capacityLeft(storageUsed,appContext.SUPABASE_FREE_STORAGE_LIMIT_BYTES);
        const databaseUsed=usage.databaseBytes;
        const databaseLeft=appContext.capacityLeft(databaseUsed,appContext.SUPABASE_FREE_DATABASE_LIMIT_BYTES);

        storageUsedEl.textContent=appContext.formatApproxBytes(storageUsed);
        storageLeftEl.textContent=appContext.formatApproxBytes(storageLeft);
        databaseUsedEl.textContent=appContext.formatApproxBytes(databaseUsed);
        databaseLeftEl.textContent=appContext.formatApproxBytes(databaseLeft);

        storageUsedEl.title=`${usage.storageFileCount} file${usage.storageFileCount===1?"":"s"} across all Supabase Storage buckets`;
        storageLeftEl.title=appContext.capacitySummaryText("File Storage",storageUsed,appContext.SUPABASE_FREE_STORAGE_LIMIT_BYTES);
        databaseUsedEl.title=appContext.capacitySummaryText("PostgreSQL database",databaseUsed,appContext.SUPABASE_FREE_DATABASE_LIMIT_BYTES);
        databaseLeftEl.title=databaseUsed>appContext.SUPABASE_FREE_DATABASE_LIMIT_BYTES
          ? "Free-plan database quota exceeded"
          : appContext.capacitySummaryText("PostgreSQL database",databaseUsed,appContext.SUPABASE_FREE_DATABASE_LIMIT_BYTES);
      }finally{
        if(refreshStorageBtn){
          refreshStorageBtn.disabled=false;
          refreshStorageBtn.textContent=old||"Refresh Supabase Usage";
        }
      }
    }

    function refreshStats(){
      const stats=appContext.legacyCardImageStats();
      cardsRemaining.textContent=String(stats.cardsWithLegacy);
      imagesRemaining.textContent=String(stats.legacyImages);
      estimatedSize.textContent=appContext.formatApproxBytes(stats.estimatedBytes);
      if(!stats.cardsWithLegacy && !running){
        startBtn.disabled=true;
        progressLabel.textContent="Migration complete";
      }
      return stats;
    }

    refreshStorageBtn.addEventListener("click",refreshStorageUsage);

    testBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("test card image Storage")) return;
      const old=testBtn.textContent;
      testBtn.disabled=true;
      testBtn.textContent="Testing…";
      preflight.classList.remove("ok","error");
      preflight.textContent="Testing upload, public URL generation and cleanup…";

      try{
        const check=await appContext.checkCardImageStorageReady();
        preflight.textContent=check.message;
        preflight.classList.add(check.ok?"ok":"error");
        if(check.ok) appContext.showToast("Card image Storage is ready");
      }catch(error){
        const message=String(error?.message||error||"Storage test failed");
        preflight.textContent=message;
        preflight.classList.add("error");
      }finally{
        testBtn.disabled=false;
        testBtn.textContent=old;
      }
    });

    stopBtn.addEventListener("click",()=>{
      if(!running) return;
      stopRequested=true;
      stopBtn.disabled=true;
      stopBtn.textContent="Stopping…";
      result.textContent="The current card will finish safely, then migration will stop.";
    });

    startBtn.addEventListener("click",async()=>{
      if(running || !appContext.requireOwner("start legacy image migration")) return;

      const targets=appContext.cards.filter(card=>appContext.getImages(card).some(appContext.isPendingCardImage));
      if(!targets.length){
        refreshStats();
        appContext.showToast("No legacy Base64 images remain");
        return;
      }

      const stats=appContext.legacyCardImageStats();
      const confirmation=
        `Migrate ${stats.legacyImages} legacy image${stats.legacyImages===1?"":"s"} across ${stats.cardsWithLegacy} card${stats.cardsWithLegacy===1?"":"s"} to Supabase Storage?\n\n`+
        `Approximate embedded image data: ${appContext.formatApproxBytes(stats.estimatedBytes)}.\n\n`+
        `Each card is updated only after its Storage uploads succeed.`;
      if(!confirm(confirmation)) return;

      startBtn.disabled=true;
      result.textContent="Checking Storage before migration…";
      const storageCheck=await appContext.checkCardImageStorageReady();

      if(!storageCheck.ok){
        preflight.textContent=storageCheck.message;
        preflight.classList.remove("ok");
        preflight.classList.add("error");
        result.textContent=`Migration did not start because the Storage preflight failed: ${storageCheck.message}`;
        startBtn.disabled=false;
        appContext.showToast("Storage setup must be fixed before migration");
        return;
      }

      preflight.textContent=storageCheck.message;
      preflight.classList.remove("error");
      preflight.classList.add("ok");

      running=true;
      stopRequested=false;
      stopBtn.disabled=false;
      stopBtn.textContent="Stop After Current Card";
      progress.max=Math.max(1,targets.length);
      progress.value=0;

      let completed=0;
      let failed=0;
      let migratedImages=0;
      const failureDetails=[];

      for(let i=0;i<targets.length;i++){
        if(stopRequested) break;

        const card=targets[i];
        const label=[card.card_code,card.name].filter(Boolean).join(" · ")||`Card ${i+1}`;
        currentCard.textContent=`Migrating ${i+1} of ${targets.length}: ${label}`;
        progressLabel.textContent="Uploading and verifying…";
        progressNumbers.textContent=`${i} / ${targets.length}`;

        const migration=await appContext.migrateLegacyImagesForCard(card,(done,total)=>{
          progressLabel.textContent=`${label} · image ${Math.min(done+1,total)} of ${total}`;
        });

        if(migration.ok){
          completed++;
          migratedImages+=Number(migration.migrated||0);
        }else{
          failed++;
          const failureMessage=String(migration.error||"Unknown migration failure").slice(0,240);
          failureDetails.push(`${label}: ${failureMessage}`);
          console.warn("Skipped migration card:",card.id,migration.error);
          result.textContent=`Latest failure: ${label} · ${failureMessage}`;
        }

        progress.value=i+1;
        progressNumbers.textContent=`${i+1} / ${targets.length}`;
        completedEl.textContent=String(completed);
        refreshStats();
        // Update owner-only database + file Storage usage periodically during migration.
        if((i+1)%5===0 || i===targets.length-1) await refreshStorageUsage();

        // Yield between cards so the UI remains responsive and mobile browsers
        // are less likely to terminate a long-running migration.
        await new Promise(resolve=>setTimeout(resolve,30));
      }

      running=false;
      stopBtn.disabled=true;
      stopBtn.textContent="Stop After Current Card";
      const remaining=refreshStats();

      if(stopRequested){
        progressLabel.textContent="Migration stopped safely";
        result.textContent=`Stopped after the current card · ${completed} cards migrated · ${failed} failed · ${remaining.cardsWithLegacy} remaining. You can resume anytime.`;
      }else if(failed){
        progressLabel.textContent="Migration finished with some failures";
        const firstFailures=failureDetails.slice(0,3).join(" | ");
        result.textContent=`${completed} cards / ${migratedImages} images migrated · ${failed} cards failed · ${remaining.cardsWithLegacy} cards remain. First error${failureDetails.length===1?"":"s"}: ${firstFailures}`;
      }else{
        progressLabel.textContent="Migration complete";
        currentCard.textContent="";
        result.textContent=`Successfully migrated ${completed} cards / ${migratedImages} images. Legacy Base64 images remaining: ${remaining.legacyImages}.`;
        appContext.showToast("Legacy card image migration complete");
      }

      startBtn.disabled=remaining.cardsWithLegacy===0;
    });

    refreshStorageUsage();
  }

  Object.assign(appContext,{switchCardWatermarkVariant,reapplyCardWatermarkVariants,reapplyAllCardsWatermarkVariants,switchAllCardsWatermarkVariant,reprocessCardImages,renderImageReprocessPage,legacyCardImageStats,formatApproxBytes,saveMigratedCardImageUrls,migrateLegacyImagesForCard,fetchSupabaseCapacityUsage,capacityPercent,capacityLeft,capacitySummaryText,checkCardImageStorageReady,renderLegacyImageMigrationPage});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.SUPABASE_FREE_DATABASE_LIMIT_BYTES = 500*1024*1024;

  appContext.SUPABASE_FREE_STORAGE_LIMIT_BYTES = 1024*1024*1024;
}
