/** V93 beta: features/owner/editor. Shared dependencies are explicit on appContext. */
export function register(appContext){
function captureEditReturnScroll(){
    const shell=document.querySelector(".shell");
    const useShell=
      window.matchMedia("(max-width:800px)").matches &&
      shell &&
      getComputedStyle(shell).overflowY!=="visible";

    appContext.editReturnScrollState={
      hash:location.hash||"#/inventory",
      windowY:Math.max(0,Math.round(window.scrollY||0)),
      shellY:useShell ? Math.max(0,Math.round(shell.scrollTop||0)) : null
    };
  }

function restoreEditReturnScroll(){
    const state=appContext.editReturnScrollState;
    if(!state) return;

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const shell=document.querySelector(".shell");

      if(state.shellY!=null && shell){
        shell.scrollTo({top:state.shellY,left:0,behavior:"auto"});
      }else{
        window.scrollTo({top:state.windowY,left:0,behavior:"auto"});
      }
    }));
  }

function resetEditSubmitButton(){
    const submitBtn=appContext.editForm.querySelector('button[type="submit"]');
    if(!submitBtn) return;
    submitBtn.disabled=false;
    submitBtn.textContent="Save changes";
    submitBtn.removeAttribute("aria-busy");
  }

async function openEditModal(card){
    if(!appContext.requireOwner()) return;
    appContext.captureEditReturnScroll();
    appContext.resetEditSubmitButton();
    const [privateMeta,storedImageVariants]=await Promise.all([
      appContext.fetchOwnerPrivateMeta(card.id),
      appContext.fetchOwnerCardImageVariants(card.id)
    ]);
    appContext.$("editId").value = card.id;
    appContext.$("editFieldsMount").innerHTML = appContext.fieldsTemplate("edit");
    appContext.populateFields("edit", card);
    if(appContext.$("editOwnerTags")) appContext.$("editOwnerTags").value=privateMeta.tags.join(", ");
    if(appContext.$("editOwnerNotes")) appContext.$("editOwnerNotes").value=privateMeta.notes;
    const currentImages=appContext.getImages(card).slice();
    const mappedVariants=currentImages.map(image=>{
      const stored=storedImageVariants.find(v=>
        v.original_url===image || v.watermarked_url===image
      );

      if(stored){
        return {
          key:stored.image_key,
          original:stored.original_url,
          watermarked:stored.watermarked_url||null,
          active:stored.watermarked_url===image ? true : false
        };
      }

      // Legacy image: current file becomes the clean base for future
      // reversible watermark switching.
      return {
        key:appContext.newCardImageVariantKey(),
        original:image,
        watermarked:null,
        active:false
      };
    });

    appContext.editFormState = {
      images: currentImages,
      originalImages: currentImages.slice(),
      imageCleanSources: mappedVariants.map(v=>v.original),
      imageWatermarkedSources: mappedVariants.map(v=>v.watermarked),
      imageVariantKeys: mappedVariants.map(v=>v.key),
      imageWatermarkStates: mappedVariants.map(v=>v.active),
      watermarkEnabled:false,
      processingImages: 0,
      grading: Array.isArray(card.grading) ? card.grading.map(g=>({
        company:g.company || "PSA",
        grade:String(g.grade || "10"),
        cert:g.cert || "",
        pop_count:g.pop_count == null ? null : Number(g.pop_count),
        pop_higher:g.pop_higher == null ? null : Number(g.pop_higher),
        pop_updated_at:g.pop_updated_at || null
      })) : []
    };
    appContext.wireGameCombobox("edit");
    appContext.wireSoldDateField("edit");
    appContext.wireAvailabilityPriceState("edit");
    appContext.wireImageControls("edit", appContext.editFormState);
    appContext.wireGradingControls("edit", appContext.editFormState);
    appContext.overlay.hidden = false;
  }

function closeEditModal({restoreScroll=true}={}){
    appContext.overlay.hidden=true;
    appContext.editForm.reset();
    appContext.resetEditSubmitButton();

    if(restoreScroll){
      appContext.restoreEditReturnScroll();
    }
  }

  Object.assign(appContext,{captureEditReturnScroll,restoreEditReturnScroll,resetEditSubmitButton,openEditModal,closeEditModal});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
appContext.$("cancelBtn").addEventListener("click", appContext.closeEditModal);

appContext.overlay.addEventListener("click", (e)=>{ if(e.target === appContext.overlay) appContext.closeEditModal(); });

document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && !appContext.overlay.hidden) appContext.closeEditModal(); });

appContext.editForm.addEventListener("submit", async (e)=>{
    e.preventDefault();

    if(appContext.editFormState.processingImages){
      appContext.showToast("Please wait for image processing to finish.");
      return;
    }

    if(!appContext.editForm.checkValidity()){
      const field=appContext.reportFirstInvalidField(appContext.editForm);
      appContext.showToast(field ? `Please complete: ${field}` : "Please complete the required fields.");
      return;
    }

    await appContext.ensureMyrConversionBeforeSave("edit");
    if(!appContext.requireOwner()) return;

    const id = appContext.$("editId").value;
    const submitBtn=appContext.editForm.querySelector('button[type="submit"]');
    let preparedImages=null;
    let saveAttempted=false;
    let cardSaved=false;
    let postSaveStep="";

    if(submitBtn){
      submitBtn.disabled=true;
      submitBtn.textContent="Saving…";
      submitBtn.setAttribute("aria-busy","true");
    }

    try{
      preparedImages=await appContext.prepareCardImagesForStorage(appContext.editFormState,(done,total)=>{
        if(submitBtn) submitBtn.textContent=`Uploading images ${done}/${total}…`;
      });
      appContext.editFormState.images=preparedImages.images;

      const data = appContext.collectFields("edit", id, appContext.editFormState);
      if(!data.name || !data.game){
        throw new Error("Card name and game are required.");
      }

      if(submitBtn) submitBtn.textContent="Saving card…";
      saveAttempted=true;
      const saved=await appContext.updateCardStorage(data);
      if(!saved){
        appContext.resetEditSubmitButton();
        appContext.showToast("Card was not saved. Please refresh and try again.");
        return;
      }

      cardSaved=true;

      let variantResult={ok:true,staleUrls:[]};
      postSaveStep="saving reversible watermark information";
      try{
        variantResult=await appContext.saveOwnerCardImageVariants(id,preparedImages.variantRecords||[]);
      }catch(error){
        console.warn("Reversible watermark metadata was not saved:",error);
        variantResult={ok:false,staleUrls:[]};
      }
      const protectedVariantUrls=(preparedImages.variantRecords||[]).flatMap(v=>[
        v.original_url,
        v.watermarked_url
      ]).filter(Boolean);

      // Keep the in-memory card lookup in sync immediately after save.
      postSaveStep="updating the inventory";
      // Directly assigning cards[idx] left cardLookupMap pointing at the old
      // card object, so reopening Edit could show the previous cert until reload.
      appContext.replaceCardInMemory(saved);
      appContext.invalidateOwnerReservedAgeCache();

      // Do not delete the inactive original/watermarked counterpart. Both
      // versions are intentionally preserved so the owner can switch later.
      let cleanupSaved=true;
      postSaveStep="checking removed photo files";
      try{
        cleanupSaved=await appContext.cleanupRemovedCardStorageImages(
          appContext.editFormState.originalImages || [],
          appContext.getImages(saved),
          protectedVariantUrls
        );
      }catch(error){
        console.warn("Removed photo cleanup was skipped; files were retained:",error);
        cleanupSaved=false;
      }

      // Variants belonging to photos removed from the card can now be cleaned.
      if(variantResult.ok && variantResult.staleUrls?.length){
        const protectedPaths=new Set(protectedVariantUrls.map(appContext.cardStoragePathFromUrl).filter(Boolean));
        const stalePaths=variantResult.staleUrls
          .map(appContext.cardStoragePathFromUrl)
          .filter(path=>path && !protectedPaths.has(path));
        if(stalePaths.length){
          postSaveStep="checking removed watermark files";
          try{
            cleanupSaved=(await appContext.removeCardStoragePaths(stalePaths)) && cleanupSaved;
          }catch(error){
            console.warn("Removed watermark file cleanup was skipped; files were retained:",error);
            cleanupSaved=false;
          }
        }
      }

      let privateMetaSaved=true;
      if(appContext.ownerPrivateSupported){
        postSaveStep="saving private owner information";
        privateMetaSaved=await appContext.saveOwnerPrivateMeta(id,data._owner_tags,data._owner_notes);
      }

      if(!variantResult.ok && preparedImages.variantRecords?.length){
        appContext.showToast("Card updated · reversible watermark metadata was not saved");
      }else if(!privateMetaSaved){
        appContext.showToast("Card updated · private notes/tags were not saved");
      }else if(!cleanupSaved){
        appContext.showToast("Card updated · removed photo cleanup was skipped; files were retained safely");
      }else if(appContext.hasPsaCert(data)){
        appContext.showToast("Card updated · use the PSA browser helper to sync POP");
      }else{
        appContext.showToast("Card updated · images stored in Supabase Storage");
      }

      // Saving re-renders the listing through router(). Preserve the exact
      // position first so the card grid does not jump back toward the top.
      const editScroll=appContext.editReturnScrollState;
      if(editScroll){
        try{
          appContext.sessionStorage.setItem(appContext.LISTING_SCROLL_STATE_KEY,JSON.stringify({
            hash:location.hash||editScroll.hash||"#/inventory",
            y:Math.max(0,Number(editScroll.windowY||0))
          }));
        }catch{}
      }

      appContext.closeEditModal({restoreScroll:false});
      postSaveStep="opening the updated inventory";
      appContext.router();

      // Mobile listings can use the shell as their scroll container, which
      // LISTING_SCROLL_STATE_KEY does not cover.
      if(editScroll?.shellY!=null){
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          const shell=document.querySelector(".shell");
          if(shell){
            shell.scrollTo({top:editScroll.shellY,left:0,behavior:"auto"});
          }
          appContext.editReturnScrollState=null;
        }));
      }else{
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          appContext.editReturnScrollState=null;
        }));
      }
    }catch(error){
      console.error("Edit save flow error:",error);
      if(saveAttempted){
        appContext.showToast(cardSaved
          ? `Card updated · ${postSaveStep||"a final update"} could not finish. Photos were retained. Refresh the inventory to confirm the listing.`
          : "Save could not be confirmed. Photos were retained. Refresh the inventory before trying again.");
        appContext.resetEditSubmitButton();
        return;
      }
      if(!saveAttempted && preparedImages?.uploadedPaths?.length){
        await appContext.removeCardStoragePaths(preparedImages.uploadedPaths);
        appContext.editFormState.images=preparedImages.originalImages;
      }
      appContext.resetEditSubmitButton();

      const message=String(error?.message||"");
      appContext.showToast(
        /card-images|card image upload|processed image|permission denied/i.test(message)
          ? appContext.cardImageStorageErrorText(error)
          : (message==="Card name and game are required."
              ? message
              : "Card was not fully saved. Please try again.")
      );
    }
  });

appContext.wireCardActions(appContext.view);

document.addEventListener("keydown", e=>{
    if(e.ctrlKey && e.shiftKey && !e.altKey && e.key.toLowerCase() === "l"){
      e.preventDefault();
      appContext.openOwnerAccess();
    }
  });

appContext.supabaseClient.auth.onAuthStateChange((_event,session)=>{
    const previousUserId=appContext.ownerSession?.user?.id||"";
    const wasOwner=appContext.isOwnerMode();

    appContext.ownerSession=session;

    if(appContext.isMobileOwnerBlocked()){
      if(!session){
        appContext.ownerVerified=false;
        appContext.applyOwnerMode();
        if(appContext.currentRoute()==="collection") appContext.router();
        return;
      }

      appContext.ownerVerified=false;
      appContext.applyOwnerMode();

      // Verify the mobile session only for Collection ordering. Other owner
      // routes/actions remain blocked because isOwnerMode() is still false.
      setTimeout(async()=>{
        if(appContext.ownerSession?.access_token!==session.access_token) return;
        const verified=await appContext.verifyOwnerSession(session);
        if(appContext.ownerSession?.access_token!==session.access_token) return;
        appContext.ownerVerified=verified;
        appContext.applyOwnerMode();
        if(appContext.currentRoute()==="collection") appContext.router();
      },0);
      return;
    }

    if(!session){
      appContext.clearOwnerOnlyClientState();
      appContext.applyOwnerMode();
      return;
    }

    if(session.user?.id!==previousUserId){
      appContext.ownerVerified=false;
    }
    appContext.applyOwnerMode();

    // Verify outside the auth callback so the auth client is not re-entered.
    setTimeout(async()=>{
      if(appContext.ownerSession?.access_token!==session.access_token) return;

      const verified=await appContext.verifyOwnerSession(session);
      if(appContext.ownerSession?.access_token!==session.access_token) return;

      appContext.ownerVerified=verified;
      if(!verified){
        appContext.clearOwnerOnlyClientState();

        const ownerOnlyRoutes=new Set([
          "by-game","insights","fb-tools","fb-posts","fb-card-list",
          "quality","inventory-tools","bulk-prices","bulk-metadata",
          "recent-edits","export","add"
        ]);
        if(ownerOnlyRoutes.has(appContext.currentRoute())){
          appContext.goToRoute("inventory");
        }
      }

      appContext.applyOwnerMode();

      if(wasOwner && !verified){
        appContext.showToast("Owner authorization could not be verified");
      }
    },0);
  });

  appContext.THEME_KEY = "collect-tcg-theme";
}
