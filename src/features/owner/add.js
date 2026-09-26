/** V93 beta: features/owner/add. Shared dependencies are explicit on appContext. */
export function register(appContext){
function renderAddPage(){
    if(!appContext.requireOwner("open add card")) return;
    const cloneDraft = appContext.pendingCloneCard;
    appContext.pendingCloneCard = null;
    appContext.view.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">${cloneDraft ? "Clone Listing" : "New listing"}</div><h2>${cloneDraft ? "Clone card" : "Add a card"}</h2><p>${cloneDraft ? "Review the copied details and add new photos before saving." : "List a new card in your inventory."}</p></div></div>
      ${cloneDraft ? `<div class="clone-card-notice"><strong>Cloning safely</strong><span>Review every field before saving. PSA certificate numbers are copied when available, while POP data, sold information, timestamps and view count are cleared.</span></div>` : ""}
      <form class="form-card" id="addForm">
        ${appContext.fieldsTemplate("add")}
        <div class="modal-actions">
          <a href="#/inventory" class="btn-ghost" style="text-decoration:none; display:inline-flex; align-items:center;">Cancel</a>
          <button type="submit" class="btn-primary">${cloneDraft ? "Save cloned card" : "Save card"}</button>
        </div>
      </form>
    `;
    const formState = {
      images: cloneDraft ? appContext.getImages(cloneDraft).slice() : [],
      imageCleanSources: cloneDraft ? appContext.getImages(cloneDraft).slice() : [],
      imageWatermarkedSources: cloneDraft ? Array(appContext.getImages(cloneDraft).length).fill(null) : [],
      imageVariantKeys: cloneDraft ? Array.from({length:appContext.getImages(cloneDraft).length},()=>appContext.newCardImageVariantKey()) : [],
      imageWatermarkStates: cloneDraft ? Array(appContext.getImages(cloneDraft).length).fill(false) : [],
      watermarkEnabled: false,
      grading: cloneDraft && Array.isArray(cloneDraft.grading) ? cloneDraft.grading.map(g=>({...g})) : [],
      processingImages: 0
    };
    appContext.wireGameCombobox("add");
    if(cloneDraft) appContext.populateFields("add", cloneDraft);
    appContext.wireSoldDateField("add");
    appContext.wireAvailabilityPriceState("add");
    appContext.wireImageControls("add", formState);
    appContext.wireGradingControls("add", formState);
    appContext.$("addForm").addEventListener("submit", async (e)=>{
      e.preventDefault();

      if(formState.processingImages){
        appContext.showToast("Please wait for image processing to finish.");
        return;
      }

      const form = appContext.$("addForm");
      if(!form.checkValidity()){
        const field=appContext.reportFirstInvalidField(form);
        appContext.showToast(field ? `Please complete: ${field}` : "Please complete the required fields.");
        return;
      }

      await appContext.ensureMyrConversionBeforeSave("add");

      if(!form.checkValidity()){
        const field=appContext.reportFirstInvalidField(form);
        appContext.showToast(field ? `Please complete: ${field}` : "Please complete the required fields.");
        return;
      }

      if(!appContext.requireOwner()) return;

      const submitBtn=form.querySelector('button[type="submit"]');
      const originalSubmitText=submitBtn?.textContent||"Save card";
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
        preparedImages=await appContext.prepareCardImagesForStorage(formState,(done,total)=>{
          if(submitBtn) submitBtn.textContent=`Uploading images ${done}/${total}…`;
        });
        formState.images=preparedImages.images;

        const data = appContext.collectFields("add", null, formState);
        if(!data.name || !data.game){
          throw new Error("Card name and game are required.");
        }

        if(submitBtn) submitBtn.textContent="Saving card…";
        saveAttempted=true;
        const saved=await appContext.createCardStorage(data);
        if(!saved){
          if(submitBtn){
            submitBtn.disabled=false;
            submitBtn.textContent=originalSubmitText;
            submitBtn.removeAttribute("aria-busy");
          }
          appContext.showToast("Card was not saved. Please refresh and try again.");
          return;
        }

        cardSaved=true;

        let imageVariantsSaved=true;
        if(preparedImages.variantRecords?.length){
          postSaveStep="saving reversible watermark information";
          const variantResult=await appContext.saveOwnerCardImageVariants(saved.id,preparedImages.variantRecords);
          imageVariantsSaved=variantResult.ok;
        }

        postSaveStep="updating the inventory";
        appContext.cards.push(saved);

        let privateMetaSaved=true;
        if(appContext.ownerPrivateSupported && (data._owner_tags.length || data._owner_notes)){
          postSaveStep="saving private owner information";
          privateMetaSaved=await appContext.saveOwnerPrivateMeta(
            saved.id,
            data._owner_tags,
            data._owner_notes
          );
        }

        const privateGradingSaved=saved._private_grading_saved!==false;
        delete saved._private_grading_saved;

        if(appContext.hasPsaCert(data) && !privateGradingSaved){
          appContext.showToast("Card added · grading certificate was not saved because private grading storage is unavailable");
        }else if(appContext.hasPsaCert(data)){
          appContext.showToast(privateMetaSaved
            ? "Card added · use the PSA browser helper to sync POP"
            : "Card added · private notes/tags were not saved");
        }else{
          appContext.showToast(!imageVariantsSaved
            ? "Card added · reversible watermark metadata was not saved"
            : (privateMetaSaved
                ? "Card added · images stored in Supabase Storage"
                : "Card added · images stored in Supabase Storage · private notes/tags were not saved"));
        }

        postSaveStep="opening the updated inventory";
        appContext.goToRoute("inventory");
      }catch(error){
        console.error("Add card submit error:",error);
        if(saveAttempted){
          appContext.showToast(cardSaved
            ? `Card added · ${postSaveStep||"a final update"} could not finish. Photos were retained. Refresh the inventory to confirm the listing.`
            : "Save could not be confirmed. Photos were retained. Refresh the inventory before trying again.");
          return;
        }
        if(!saveAttempted && preparedImages?.uploadedPaths?.length){
          await appContext.removeCardStoragePaths(preparedImages.uploadedPaths);
          formState.images=preparedImages.originalImages;
        }

        const message=String(error?.message||"");
        appContext.showToast(
          /card-images|card image upload|processed image|permission denied/i.test(message)
            ? appContext.cardImageStorageErrorText(error)
            : (message==="Card name and game are required."
                ? message
                : appContext.cardWriteErrorText(error,"create"))
        );
      }finally{
        if(submitBtn && document.body.contains(submitBtn)){
          submitBtn.disabled=false;
          submitBtn.textContent=originalSubmitText;
          submitBtn.removeAttribute("aria-busy");
        }
      }
    });
  }

  Object.assign(appContext,{renderAddPage});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.detailsOverlay = appContext.$("detailsOverlay");

  appContext.detailsMount = appContext.$("detailsMount");

  appContext.detailsCardId = null;

  appContext.detailsImageIndex = 0;

  appContext.detailsLastFocusedElement = null;
}
