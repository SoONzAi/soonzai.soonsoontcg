/** V93 beta: features/owner/forms. Shared dependencies are explicit on appContext. */
export function register(appContext){
function wireGameCombobox(p){
    const input = appContext.$(p + "Game");
    const toggle = appContext.$(p + "GameToggle");
    const menu = appContext.$(p + "GameMenu");
    if(!input || !toggle || !menu) return;

    function renderOptions(){
      menu.innerHTML = appContext.GAME_CHOICES.map(choice =>
        `<button type="button" class="combo-option" data-value="${appContext.escapeHtml(choice)}">${appContext.escapeHtml(choice)}</button>`
      ).join("");
    }

    function openMenu(){
      renderOptions();
      menu.hidden = false;
    }

    function closeMenu(){ menu.hidden = true; }

    toggle.addEventListener("click", e=>{
      e.stopPropagation();
      if(menu.hidden) openMenu();
      else closeMenu();
    });

    // Clicking/focusing the field never removes the ability to use the dropdown.
    input.addEventListener("keydown", e=>{
      if(e.key === "ArrowDown" && menu.hidden){
        e.preventDefault();
        openMenu();
        const first = menu.querySelector(".combo-option");
        if(first) first.focus();
      }
    });

    menu.addEventListener("click", e=>{
      const option = e.target.closest(".combo-option");
      if(!option) return;
      input.value = option.dataset.value || "";
      closeMenu();
      input.focus();
      input.dispatchEvent(new Event("change", {bubbles:true}));
    });

    menu.addEventListener("keydown", e=>{
      const options = Array.from(menu.querySelectorAll(".combo-option"));
      const i = options.indexOf(document.activeElement);
      if(e.key === "ArrowDown"){
        e.preventDefault();
        (options[i + 1] || options[0])?.focus();
      }else if(e.key === "ArrowUp"){
        e.preventDefault();
        (options[i - 1] || options[options.length - 1])?.focus();
      }else if(e.key === "Escape"){
        closeMenu();
        input.focus();
      }
    });

    document.addEventListener("click", e=>{
      const combo = appContext.$(p + "GameCombo");
      if(combo && !combo.contains(e.target)) closeMenu();
    });
  }

function normalizeYearValue(value){
    const raw=String(value??"").trim();
    if(!raw) return "";

    const single=raw.match(/^(\d{4})$/);
    if(single) return single[1];

    const range=raw.match(/^(\d{4})\s*[-–—]\s*(\d{4})$/);
    if(range){
      const start=Number(range[1]);
      const end=Number(range[2]);
      if(start<=end) return `${range[1]}-${range[2]}`;
    }

    return raw.slice(0,20);
  }

function isValidYearValue(value){
    const normalized=appContext.normalizeYearValue(value);
    if(!normalized) return true;
    if(/^\d{4}$/.test(normalized)) return true;
    const match=normalized.match(/^(\d{4})-(\d{4})$/);
    return !!match && Number(match[1])<=Number(match[2]);
  }

function normalizePriceNegotiability(value){
    const normalized=String(value||"").trim().toLowerCase();
    if(normalized==="negotiable") return "Negotiable";
    if(normalized==="non-negotiable" || normalized==="non negotiable") return "Non-negotiable";
    return "";
  }

function priceNegotiabilityFromNotes(notes){
    const source=String(notes||"");
    const match=source.match(appContext.PRICE_NEGOTIABILITY_MARKER_RE);
    if(match) return appContext.normalizePriceNegotiability(match[1]);

    // Backward compatibility with earlier free-text notes already used by
    // the Facebook Card List generator.
    if(/\bnon[- ]?negotiable\b/i.test(source)) return "Non-negotiable";
    if(/\bnegotiable\b/i.test(source)) return "Negotiable";
    return "";
  }

function stripPriceNegotiabilityMarker(notes){
    return String(notes||"")
      .replace(appContext.PRICE_NEGOTIABILITY_MARKER_RE,"\n")
      .replace(/\n{3,}/g,"\n\n")
      .trim();
  }

function notesWithPriceNegotiability(notes,term){
    const clean=appContext.stripPriceNegotiabilityMarker(notes);
    const normalized=appContext.normalizePriceNegotiability(term);
    if(!normalized) return clean;

    const marker=`Price terms: ${normalized}`;
    return clean ? `${clean}\n\n${marker}` : marker;
  }

function fieldsTemplate(p){
    return `
      <div class="image-field">
        <div class="image-gallery-preview" id="${p}ImageGalleryPreview"></div>
        <div class="image-controls">
<div class="owner-only image-watermark-all-actions" id="${p}WatermarkAllActions">
            <div>
              <strong>All photos on this card</strong>
              <span>Choose logo + website, website only, or original for every photo in this Add/Edit form.</span>
            </div>
            <div class="image-watermark-all-buttons">
              <button type="button" class="btn-ghost" id="${p}WatermarkAllPhotos">Logo + website all photos</button>
              <button type="button" class="btn-ghost" id="${p}WebsiteOnlyAllPhotos">Website only all photos</button>
              <button type="button" class="btn-ghost" id="${p}OriginalAllPhotos">Use originals for all photos</button>
            </div>
            <div class="image-watermark-all-status" id="${p}WatermarkAllStatus" hidden></div>
          </div>

          <div class="owner-only psa-image-privacy-control">
            <label class="psa-image-privacy-toggle">
              <input type="checkbox" id="${p}PsaPrivacyAuto">
              <span>
                <strong>Auto-hide PSA info on new photos</strong>
                <small>Add two fixed black rectangles over the PSA barcode / certificate-number areas when a new photo is added.</small>
              </span>
            </label>
            <div class="hint">Designed for your standard PSA slab photo framing. You can also apply or undo it per photo before saving.</div>
          </div>

          <input type="file" id="${p}ImageFile" accept="image/jpeg,image/png,image/webp" multiple>
          <div class="image-url-row">
            <input type="text" id="${p}ImageUrl" placeholder="Paste an image URL, then click Add URL">
            <button type="button" class="btn-ghost" id="${p}AddImageUrl">Add URL</button>
          </div>
          <div class="image-gallery-note">
            Add multiple pictures as clean originals. Use <strong>Watermark all photos</strong> or the individual photo controls if you want the logo applied.
            Images are uploaded to the <strong>card-images</strong> Supabase Storage bucket only when you press Save.
            The clean original and the watermarked version are saved separately in owner-protected metadata, while only the selected version is shown publicly.
            You can save a card with the watermark, edit it later, choose <strong>Original</strong>, and save again without re-uploading the photo.
            Images that were already permanently watermarked before this reversible system was installed cannot be restored unless you upload the original clean file once.
            Use <strong>Hide PSA info</strong> on a photo to place two fixed black privacy rectangles over the PSA barcode / certificate-number areas. <strong>Undo hide</strong> is available during the current Add/Edit session until Save. Use ↺ / ↻ on any photo to rotate it 90° left or right. Rotation updates the clean original for this listing, and if that photo is currently watermarked the watermark is regenerated in the correct orientation. Drag pictures to change their order; the first picture is the listing thumbnail.
          </div>
        </div>
      </div>
      <div class="field">
        <label for="${p}Name">Card name</label>
        <input type="text" id="${p}Name" required placeholder="e.g. Charizard ex">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="${p}CardCode">Card code</label>
          <input type="text" id="${p}CardCode" placeholder="e.g. C01, OP01-001, M-001" autocomplete="off">
        </div>
        <div class="field">
          <label for="${p}Year">Year / Year Range</label>
          <input type="text" id="${p}Year" maxlength="20" inputmode="numeric" placeholder="e.g. 2005 or 2005-2008">
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="${p}Game">Game</label>
          <div class="combo" id="${p}GameCombo">
            <input type="text" id="${p}Game" required placeholder="e.g. Pokémon" autocomplete="off">
            <button type="button" class="combo-toggle" id="${p}GameToggle" aria-label="Show game choices">⌄</button>
            <div class="combo-menu" id="${p}GameMenu" hidden></div>
          </div>
        </div>
        <div class="field">
          <label for="${p}Language">Language</label>
          <select id="${p}Language" required>
            <option value="">Select language</option>
            ${appContext.LANGUAGE_OPTIONS.map(v=>`<option value="${v}">${v}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field">
        <label for="${p}LanguageDetails">Language details <span class="muted">(optional)</span></label>
        <input type="text" id="${p}LanguageDetails" maxlength="120" placeholder="e.g. JP × 2 · ENG × 1">
        <div class="hint">Use this only for a mixed-language lot or product. Keep Language as one filter value, such as Mixed / Multiple languages.</div>
        ${appContext.languageDetailsSupported===false ? `<div class="hint">Run <code>2026-09-15-v10-LANGUAGE-DETAILS.sql</code> in Supabase before saving this field.</div>` : ""}
      </div>
      <div class="field-row">
        <div class="field">
          <label for="${p}Series">Series / Collection</label>
          <input type="text" id="${p}Series" placeholder="e.g. Hyper Battle, Visual Adventure, Championship">
        </div>
        <div class="field">
          <label for="${p}Era">Era</label>
          <select id="${p}Era" required>
            <option value="">Select era</option>
            ${appContext.ERA_OPTIONS.map(v=>`<option value="${v}">${v}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field owner-lifecycle-field">
          <label for="${p}LifecycleStatus">Listing visibility</label>
          <select id="${p}LifecycleStatus" ${appContext.lifecycleSupported ? "" : "disabled"}>
            <option value="live">Live — visible to visitors</option>
            <option value="draft">Draft — owner only</option>
            <option value="archived">Archived — owner only</option>
          </select>
          <div class="hint">${appContext.lifecycleSupported
            ? "Draft and archived listings are protected by database RLS and are not returned to normal visitors."
            : "Run the lifecycle migration before using Draft or Archive."}</div>
        </div>
        <div class="field">
          <label for="${p}Availability">Availability</label>
          <select id="${p}Availability" required>
            ${appContext.AVAILABILITY_OPTIONS.map(v=>`<option value="${v}">${v}</option>`).join("")}
          </select>
        </div>
        <div class="field sold-date-field" id="${p}SoldDateField" hidden>
          <label for="${p}SoldDate">Sold date <span class="field-optional">(optional)</span></label>
          <input type="date" id="${p}SoldDate">
          <div class="hint sold-date-hint">Used only for the public Sold archive. No buyer information is stored.</div>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="${p}Format">Format</label>
          <select id="${p}Format">
            <option value="Raw">Raw Card</option>
            <option value="Graded">Graded / Slab</option>
            <option value="Sealed">Sealed</option>
          </select>
        </div>
        <div class="field">
          <label for="${p}Condition">Condition</label>
          <select id="${p}Condition">
            <option value="NM">Near Mint</option><option value="M">Mint</option><option value="LP">Lightly Played</option>
            <option value="MP">Moderately Played</option><option value="HP">Heavily Played</option><option value="DMG">Damaged</option><option value="SEALED">Sealed</option><option value="NA">Not Applicable</option>
          </select>
          <div class="hint">Automatically set to Sealed when Format is Sealed, or Not Applicable when grading information is present.</div>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="${p}PriceMYR">Price (MYR) <span class="field-required-note">required*</span></label>
          <input type="number" id="${p}PriceMYR" min="0" step="0.01" inputmode="decimal" placeholder="Enter MYR price">
        </div>
        <div class="field">
          <label for="${p}PriceUSD">Price (USD) <span class="field-optional">(auto from MYR · rounded)</span></label>
          <input type="number" id="${p}PriceUSD" min="0" step="0.01" inputmode="decimal" placeholder="Auto converted">
        </div>
        <div class="field">
          <label for="${p}PriceSGD">Price (SGD) <span class="field-optional">(auto from MYR · rounded)</span></label>
          <input type="number" id="${p}PriceSGD" min="0" step="0.01" inputmode="decimal" placeholder="Auto converted">
        </div>
      </div>
      <div class="fx-auto-rate" id="${p}FxRateStatus" aria-live="polite">
        <span id="${p}FxRateText">Loading today's exchange rate…</span>
        <button type="button" class="btn-ghost fx-refresh-rate-btn" id="${p}FxRefreshRate">Refresh rate</button>
      </div>
      <div class="field">
        <label for="${p}PriceNegotiability">Pricing terms</label>
        <select id="${p}PriceNegotiability" required>
          ${appContext.PRICE_NEGOTIABILITY_OPTIONS.map(v=>`<option value="${v}">${v}</option>`).join("")}
        </select>
        <div class="hint">Choose whether the listed price is negotiable or non-negotiable. This is public listing information.</div>
      </div>

      <div class="grading-section">
        <div class="grading-head">
          <h3>Grading / Condition</h3>
          <button type="button" class="btn-ghost" id="${p}AddGrade">+ Add grading</button>
        </div>
        <div class="hint" style="margin-bottom:10px;">Use Raw condition for ungraded cards, or add one or more grading entries for PSA, BGS, TAG, ACE, ARS, etc.</div>
        <div id="${p}GradingRows"></div>
      </div>
      <div class="field">
        <label for="${p}Notes">Public listing notes</label>
        <textarea id="${p}Notes" placeholder="Details that buyers may see. Do not put private buyer or internal information here."></textarea>
      </div>
      <div class="owner-private-fields">
        <div class="owner-private-fields-head">
          <div>
            <strong>Private owner information</strong>
            <span>Stored separately and protected by owner-only RLS.</span>
          </div>
          ${appContext.ownerPrivateSupported ? `<span class="owner-private-ready">Owner only</span>` : `<span class="owner-private-warning">Migration required</span>`}
        </div>
        <div class="field">
          <label for="${p}OwnerTags">Private owner tags</label>
          <input type="text" id="${p}OwnerTags" maxlength="500" placeholder="e.g. Regrade, Priority Sale, Hold">
          <div class="hint">Up to 12 tags. These are never included in public card data.</div>
        </div>
        <div class="field">
          <label for="${p}OwnerNotes">Private owner notes</label>
          <textarea id="${p}OwnerNotes" maxlength="2000" placeholder="Internal notes only"></textarea>
        </div>
      </div>
    `;
  }

function wireImageControls(p, formState){
    if(!appContext.requireOwner("manage card images")) return;

    const fileInput = appContext.$(p + "ImageFile");
    const urlInput = appContext.$(p + "ImageUrl");
    const addUrlBtn = appContext.$(p + "AddImageUrl");
    const preview = appContext.$(p + "ImageGalleryPreview");
    const watermarkAllBtn=appContext.$(p+"WatermarkAllPhotos");
    const websiteOnlyAllBtn=appContext.$(p+"WebsiteOnlyAllPhotos");
    const originalAllBtn=appContext.$(p+"OriginalAllPhotos");
    const watermarkAllStatus=appContext.$(p+"WatermarkAllStatus");
    const psaPrivacyAuto=appContext.$(p+"PsaPrivacyAuto");

    formState.watermarkEnabled=Boolean(formState.watermarkEnabled);
    formState.psaPrivacyAuto=Boolean(formState.psaPrivacyAuto);
    formState.imageCleanSources=Array.isArray(formState.imageCleanSources)
      ? formState.imageCleanSources.slice(0,formState.images.length)
      : Array(formState.images.length).fill(null);
    while(formState.imageCleanSources.length<formState.images.length){
      formState.imageCleanSources.push(null);
    }
    formState.imageWatermarkedSources=Array.isArray(formState.imageWatermarkedSources)
      ? formState.imageWatermarkedSources.slice(0,formState.images.length)
      : Array(formState.images.length).fill(null);
    while(formState.imageWatermarkedSources.length<formState.images.length){
      formState.imageWatermarkedSources.push(null);
    }

    formState.imageVariantKeys=Array.isArray(formState.imageVariantKeys)
      ? formState.imageVariantKeys.slice(0,formState.images.length)
      : Array.from({length:formState.images.length},()=>appContext.newCardImageVariantKey());
    while(formState.imageVariantKeys.length<formState.images.length){
      formState.imageVariantKeys.push(appContext.newCardImageVariantKey());
    }

    formState.imageWatermarkStates=Array.isArray(formState.imageWatermarkStates)
      ? formState.imageWatermarkStates.slice(0,formState.images.length)
      : Array(formState.images.length).fill(false);
    while(formState.imageWatermarkStates.length<formState.images.length){
      formState.imageWatermarkStates.push(false);
    }

    formState.imageWatermarkModes=Array.isArray(formState.imageWatermarkModes)
      ? formState.imageWatermarkModes.slice(0,formState.images.length)
      : formState.imageWatermarkStates.map(state=>state ? "full" : "original");
    while(formState.imageWatermarkModes.length<formState.images.length){
      const i=formState.imageWatermarkModes.length;
      formState.imageWatermarkModes.push(formState.imageWatermarkStates[i] ? "full" : "original");
    }

    // Temporary, edit-session-only undo source for PSA privacy masks.
    // After Save, the masked photo becomes the saved clean revision.
    formState.imagePrivacyUndoSources=Array.isArray(formState.imagePrivacyUndoSources)
      ? formState.imagePrivacyUndoSources.slice(0,formState.images.length)
      : Array(formState.images.length).fill(null);
    while(formState.imagePrivacyUndoSources.length<formState.images.length){
      formState.imagePrivacyUndoSources.push(null);
    }

    if(psaPrivacyAuto){
      psaPrivacyAuto.checked=formState.psaPrivacyAuto;
      psaPrivacyAuto.addEventListener("change",()=>{
        formState.psaPrivacyAuto=psaPrivacyAuto.checked;
      });
    }

    let dragIndex = null;
    let pointerDragIndex = null;


    function moveParallelArray(array,from,to){
      if(!Array.isArray(array)) return;
      const [value]=array.splice(from,1);
      array.splice(to,0,value);
    }

    function moveImage(from, to){
      if(from === to || from == null || to == null) return;
      if(from < 0 || to < 0 || from >= formState.images.length || to >= formState.images.length) return;

      moveParallelArray(formState.images,from,to);
      moveParallelArray(formState.imageCleanSources,from,to);
      moveParallelArray(formState.imageWatermarkedSources,from,to);
      moveParallelArray(formState.imageVariantKeys,from,to);
      moveParallelArray(formState.imageWatermarkStates,from,to);
      moveParallelArray(formState.imageWatermarkModes,from,to);
      moveParallelArray(formState.imagePrivacyUndoSources,from,to);
      refreshPreview();
    }

    function removeImageAt(index){
      formState.images.splice(index,1);
      formState.imageCleanSources.splice(index,1);
      formState.imageWatermarkedSources.splice(index,1);
      formState.imageVariantKeys.splice(index,1);
      formState.imageWatermarkStates.splice(index,1);
      formState.imageWatermarkModes.splice(index,1);
      formState.imagePrivacyUndoSources.splice(index,1);
      refreshPreview();
    }

    function clearDragState(){
      preview.querySelectorAll(".image-preview-box").forEach(box=>{
        box.classList.remove("dragging","drag-over");
      });
    }

    async function setImageWatermark(index,mode,silent=false){
      if(!appContext.requireOwner("change image watermark")) return;
      if(!appContext.cardImageVariantsSupported){
        appContext.showToast("Run the reversible watermark migration first");
        return;
      }
      if(index<0 || index>=formState.images.length) return;

      const normalizedMode=
        mode==="website" ? "website" :
        (mode===true || mode==="full") ? "full" :
        "original";

      let cleanSource=formState.imageCleanSources[index];
      if(!cleanSource){
        cleanSource=formState.images[index];
        formState.imageCleanSources[index]=cleanSource;
      }

      formState.processingImages=Number(formState.processingImages||0)+1;
      refreshPreview();

      try{
        if(normalizedMode==="original"){
          formState.images[index]=cleanSource;
          formState.imageWatermarkStates[index]=false;
          formState.imageWatermarkModes[index]="original";
          if(!silent) appContext.showToast("Original version selected");
        }else{
          const rendered=normalizedMode==="website"
            ? await appContext.applyWebsiteWatermarkToCardImageSource(cleanSource,1800,0.94)
            : await appContext.applyWatermarkToCardImageSource(cleanSource,1800,0.94);

          formState.imageWatermarkedSources[index]=rendered;
          formState.images[index]=rendered;
          formState.imageWatermarkStates[index]=true;
          formState.imageWatermarkModes[index]=normalizedMode;

          if(!silent){
            appContext.showToast(
              normalizedMode==="website"
                ? "Website-only watermark selected"
                : "Logo + website watermark selected"
            );
          }
        }
      }catch(error){
        console.warn("Could not change image watermark:",error);
        if(!silent) appContext.showToast("Could not switch the watermark for this photo.");
      }finally{
        formState.processingImages=Math.max(0,Number(formState.processingImages||0)-1);
        refreshPreview();
      }
    }

    async function setImagePsaPrivacy(index,apply){
      if(!appContext.requireOwner("edit PSA image privacy")) return;
      if(index<0 || index>=formState.images.length) return;

      let cleanSource=formState.imageCleanSources[index] || formState.images[index];
      if(!cleanSource) return;

      const wasWatermarked=formState.imageWatermarkStates[index]===true;
      const watermarkMode=formState.imageWatermarkModes[index]==="website" ? "website" : "full";

      if(!apply && !formState.imagePrivacyUndoSources[index]){
        appContext.showToast("No unsaved PSA privacy edit to undo");
        return;
      }

      formState.processingImages=Number(formState.processingImages||0)+1;
      refreshPreview();

      try{
        let nextClean;

        if(apply){
          if(!formState.imagePrivacyUndoSources[index]){
            formState.imagePrivacyUndoSources[index]=cleanSource;
          }
          nextClean=await appContext.applyPsaPrivacyMaskToCardImageSource(cleanSource,0.94);
        }else{
          nextClean=formState.imagePrivacyUndoSources[index];
          formState.imagePrivacyUndoSources[index]=null;
        }

        formState.imageVariantKeys[index]=appContext.newCardImageVariantKey();
        formState.imageCleanSources[index]=nextClean;
        formState.imageWatermarkedSources[index]=null;

        if(wasWatermarked){
          const refreshed=watermarkMode==="website"
            ? await appContext.applyWebsiteWatermarkToCardImageSource(nextClean,1800,0.94)
            : await appContext.applyWatermarkToCardImageSource(nextClean,1800,0.94);
          formState.imageWatermarkedSources[index]=refreshed;
          formState.images[index]=refreshed;
          formState.imageWatermarkStates[index]=true;
          formState.imageWatermarkModes[index]=watermarkMode;
        }else{
          formState.images[index]=nextClean;
          formState.imageWatermarkStates[index]=false;
          formState.imageWatermarkModes[index]="original";
        }

        appContext.showToast(apply ? "PSA barcode and certificate areas hidden" : "PSA privacy edit undone");
      }catch(error){
        console.warn("Could not change PSA image privacy:",error);
        appContext.showToast("Could not apply PSA privacy mask");
      }finally{
        formState.processingImages=Math.max(0,Number(formState.processingImages||0)-1);
        refreshPreview();
      }
    }

    async function rotateImageAt(index,quarterTurns){
      if(!appContext.requireOwner("rotate card image")) return;
      if(index<0 || index>=formState.images.length) return;

      // Rotation always starts from the clean/original source. If this is an
      // older image without reversible metadata yet, the current image becomes
      // the clean base for this edit session.
      let cleanSource=formState.imageCleanSources[index] || formState.images[index];
      if(!cleanSource) return;

      const wasWatermarked=formState.imageWatermarkStates[index]===true;
      const watermarkMode=formState.imageWatermarkModes[index]==="website" ? "website" : "full";

      formState.processingImages=Number(formState.processingImages||0)+1;
      refreshPreview();

      try{
        const rotatedClean=await appContext.rotateCardImageSource(cleanSource,quarterTurns,0.94);

        // A rotation creates a new image revision. Use a fresh variant key so
        // old stored original/watermarked files can be cleaned after Save.
        formState.imageVariantKeys[index]=appContext.newCardImageVariantKey();
        formState.imageCleanSources[index]=rotatedClean;
        formState.imageWatermarkedSources[index]=null;

        if(wasWatermarked){
          const rotatedWatermarked=watermarkMode==="website"
            ? await appContext.applyWebsiteWatermarkToCardImageSource(rotatedClean,1800,0.94)
            : await appContext.applyWatermarkToCardImageSource(rotatedClean,1800,0.94);
          formState.imageWatermarkedSources[index]=rotatedWatermarked;
          formState.images[index]=rotatedWatermarked;
          formState.imageWatermarkStates[index]=true;
          formState.imageWatermarkModes[index]=watermarkMode;
        }else{
          formState.images[index]=rotatedClean;
          formState.imageWatermarkStates[index]=false;
          formState.imageWatermarkModes[index]="original";
        }

        appContext.showToast(quarterTurns<0 ? "Photo rotated left" : "Photo rotated right");
      }catch(error){
        console.warn("Could not rotate card image:",error);
        appContext.showToast("Could not rotate this photo");
      }finally{
        formState.processingImages=Math.max(0,Number(formState.processingImages||0)-1);
        refreshPreview();
      }
    }

    async function setAllImagesWatermark(mode){
      if(!appContext.requireOwner("change all photos on this card")) return;
      if(!appContext.cardImageVariantsSupported){
        appContext.showToast("Run the reversible watermark migration first");
        return;
      }
      if(!formState.images.length){
        appContext.showToast("No photos on this card");
        return;
      }

      const normalizedMode=
        mode==="website" ? "website" :
        (mode===true || mode==="full") ? "full" :
        "original";

      const count=formState.images.length;
      const prompt=
        normalizedMode==="full"
          ? `Apply logo + website watermark to all ${count} photo${count===1?"":"s"}?`
          : normalizedMode==="website"
            ? `Apply only the website watermark to all ${count} photo${count===1?"":"s"}?`
            : `Switch all ${count} photo${count===1?"":"s"} back to original?`;

      if(!confirm(prompt)) return;

      watermarkAllBtn.disabled=true;
      websiteOnlyAllBtn.disabled=true;
      originalAllBtn.disabled=true;
      fileInput.disabled=true;
      addUrlBtn.disabled=true;

      if(watermarkAllStatus){
        watermarkAllStatus.hidden=false;
        watermarkAllStatus.textContent="Starting…";
      }

      let changed=0;
      let failed=0;

      try{
        for(let i=0;i<formState.images.length;i++){
          if(watermarkAllStatus){
            watermarkAllStatus.textContent=`Processing photo ${i+1} / ${formState.images.length}…`;
          }
          const before=formState.images[i];
          try{
            await setImageWatermark(i,normalizedMode,true);
            if(formState.images[i]!==before) changed++;
          }catch(error){
            failed++;
            console.warn("Per-card bulk watermark photo failed:",i,error);
          }
        }

        refreshPreview();

        if(watermarkAllStatus){
          watermarkAllStatus.textContent=
            `Finished · ${changed} changed${failed ? ` · ${failed} failed` : ""}`;
        }

        appContext.showToast(
          failed
            ? `${changed} photo${changed===1?"":"s"} changed · ${failed} failed`
            : `${changed} photo${changed===1?"":"s"} changed`
        );
      }finally{
        watermarkAllBtn.disabled=false;
        websiteOnlyAllBtn.disabled=false;
        originalAllBtn.disabled=false;
        fileInput.disabled=false;
        addUrlBtn.disabled=false;
      }
    }

    watermarkAllBtn?.addEventListener("click",()=>setAllImagesWatermark("full"));
    websiteOnlyAllBtn?.addEventListener("click",()=>setAllImagesWatermark("website"));
    originalAllBtn?.addEventListener("click",()=>setAllImagesWatermark("original"));

    function refreshPreview(){
      preview.innerHTML = "";
      if(!formState.images.length){
        const empty = document.createElement("div");
        empty.className = "image-preview-box";
        empty.textContent = "No images";
        preview.appendChild(empty);
        return;
      }

      formState.images.forEach((image, index)=>{
        const box = document.createElement("div");
        const state=formState.imageWatermarkStates[index]===true;
        const watermarkMode=state
          ? (formState.imageWatermarkModes[index]==="website" ? "website" : "full")
          : "original";
        const cleanAvailable=Boolean(formState.imageCleanSources[index]);

        box.className = "image-preview-box";
        box.dataset.imageIndex = String(index);
        box.draggable = true;
        box.innerHTML = `
          <img src="${appContext.escapeHtml(image)}" alt="Image ${index+1}" draggable="false">
          <span class="image-drag-handle" title="Drag to reorder">☰</span>
          <span class="image-number">${index+1}</span>

          <div class="owner-only image-preview-watermark-actions">
            <span class="image-watermark-state ${
              state ? "with-mark" : "without-mark"
            }">${
              watermarkMode==="website"
                ? "Website only"
                : watermarkMode==="full"
                  ? "Logo + website"
                  : "Original"
            }</span>

            <button type="button"
                    class="image-preview-watermark-btn"
                    data-preview-watermark="full"
                    title="Apply the Collect TCG logo + website watermark">
              Logo + website
            </button>

            <button type="button"
                    class="image-preview-watermark-btn"
                    data-preview-watermark="website"
                    title="Apply only the website banner watermark">
              Website only
            </button>

            <button type="button"
                    class="image-preview-watermark-btn"
                    data-preview-watermark="original"
                    ${cleanAvailable ? "" : "disabled"}
                    title="${cleanAvailable ? "Switch back to the saved original photo" : "No original source is available"}">
              Original
            </button>

            <span class="image-preview-action-divider" aria-hidden="true"></span>

            <button type="button"
                    class="image-preview-privacy-btn"
                    data-preview-privacy="on"
                    title="Add two black rectangles over the PSA barcode and certificate number areas">
              Hide PSA info
            </button>

            <button type="button"
                    class="image-preview-privacy-btn"
                    data-preview-privacy="off"
                    ${formState.imagePrivacyUndoSources[index] ? "" : "disabled"}
                    title="${formState.imagePrivacyUndoSources[index] ? "Undo the PSA privacy edit before saving" : "No unsaved PSA privacy edit to undo"}">
              Undo hide
            </button>

            <span class="image-preview-action-divider" aria-hidden="true"></span>

            <button type="button"
                    class="image-preview-rotate-btn"
                    data-preview-rotate="-1"
                    title="Rotate photo 90° left"
                    aria-label="Rotate photo 90 degrees left">
              ↺
            </button>

            <button type="button"
                    class="image-preview-rotate-btn"
                    data-preview-rotate="1"
                    title="Rotate photo 90° right"
                    aria-label="Rotate photo 90 degrees right">
              ↻
            </button>
          </div>

          <button type="button" class="image-remove" title="Remove image">×</button>`;

        box.querySelector(".image-remove").addEventListener("pointerdown", e=>e.stopPropagation());
        box.querySelector(".image-remove").addEventListener("click", e=>{
          e.stopPropagation();
          removeImageAt(index);
        });

        box.querySelectorAll("[data-preview-watermark]").forEach(btn=>{
          btn.addEventListener("pointerdown",e=>e.stopPropagation());
          btn.addEventListener("click",async e=>{
            e.stopPropagation();
            if(btn.disabled) return;
            await setImageWatermark(index,btn.dataset.previewWatermark||"original");
          });
        });

        box.querySelectorAll("[data-preview-privacy]").forEach(btn=>{
          btn.addEventListener("pointerdown",e=>e.stopPropagation());
          btn.addEventListener("click",async e=>{
            e.stopPropagation();
            if(btn.disabled || Number(formState.processingImages||0)>0) return;
            await setImagePsaPrivacy(index,btn.dataset.previewPrivacy==="on");
          });
        });

        box.querySelectorAll("[data-preview-rotate]").forEach(btn=>{
          btn.addEventListener("pointerdown",e=>e.stopPropagation());
          btn.addEventListener("click",async e=>{
            e.stopPropagation();
            if(btn.disabled || Number(formState.processingImages||0)>0) return;
            const direction=Number(btn.dataset.previewRotate);
            await rotateImageAt(index,direction<0 ? -1 : 1);
          });
        });

        // Desktop HTML5 drag and drop.
        box.addEventListener("dragstart", e=>{
          if(e.target.closest("button")){e.preventDefault();return;}
          dragIndex = index;
          box.classList.add("dragging");
          if(e.dataTransfer){
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(index));
          }
        });

        box.addEventListener("dragover", e=>{
          e.preventDefault();
          if(dragIndex == null || dragIndex === index) return;
          box.classList.add("drag-over");
          if(e.dataTransfer) e.dataTransfer.dropEffect = "move";
        });

        box.addEventListener("dragleave", ()=>box.classList.remove("drag-over"));

        box.addEventListener("drop", e=>{
          e.preventDefault();
          const from = dragIndex != null
            ? dragIndex
            : Number(e.dataTransfer?.getData("text/plain"));
          clearDragState();
          dragIndex = null;
          moveImage(from, index);
        });

        box.addEventListener("dragend", ()=>{
          dragIndex = null;
          clearDragState();
        });

        // Pointer-based reordering also works on touch screens.
        box.addEventListener("pointerdown", e=>{
          if(e.button !== undefined && e.button !== 0) return;
          if(e.target.closest("button")) return;
          pointerDragIndex = index;
          box.classList.add("dragging");
          try{ box.setPointerCapture(e.pointerId); }catch(_){}
        });

        box.addEventListener("pointermove", e=>{
          if(pointerDragIndex == null) return;
          const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".image-preview-box[data-image-index]");
          preview.querySelectorAll(".image-preview-box").forEach(b=>b.classList.remove("drag-over"));
          if(target && target !== box) target.classList.add("drag-over");
        });

        box.addEventListener("pointerup", e=>{
          if(pointerDragIndex == null) return;
          const from = pointerDragIndex;
          const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".image-preview-box[data-image-index]");
          const to = target ? Number(target.dataset.imageIndex) : from;
          pointerDragIndex = null;
          clearDragState();
          try{ box.releasePointerCapture(e.pointerId); }catch(_){}
          if(Number.isInteger(to)) moveImage(from, to);
        });

        box.addEventListener("pointercancel", ()=>{
          pointerDragIndex = null;
          clearDragState();
        });

        preview.appendChild(box);
      });
    }

    fileInput.addEventListener("change", async ()=>{
      if(!appContext.requireOwner("add card image")) return;

      const files = Array.from(fileInput.files || []);
      if(!files.length) return;

      formState.processingImages = Number(formState.processingImages || 0) + files.length;
      fileInput.disabled = true;

      try{
        let added=0;
        for(const file of files){
          // Always keep a clean, high-quality version client-side during this
          // Add/Edit session so the owner can switch watermark on/off.
          const originalClean=await appContext.resizeImageFile(file,1800,0.94,false);
          const autoHide=Boolean(psaPrivacyAuto?.checked);
          const clean=autoHide
            ? await appContext.applyPsaPrivacyMaskToCardImageSource(originalClean,0.94)
            : originalClean;
          const finalImage=clean;

          formState.images.push(finalImage);
          formState.imageCleanSources.push(clean);
          formState.imageWatermarkedSources.push(null);
          formState.imageVariantKeys.push(appContext.newCardImageVariantKey());
          formState.imageWatermarkStates.push(false);
          formState.imageWatermarkModes.push("original");
          formState.imagePrivacyUndoSources.push(autoHide ? originalClean : null);
          added++;
        }

        fileInput.value = "";
        refreshPreview();

        appContext.showToast(`${files.length===1 ? "Image" : `${files.length} images`} added as original`);
      }catch(e){
        console.warn("Card image processing failed:", e);
        appContext.showToast(
          String(e?.message || "").includes("too large")
            ? "Image is too large. Maximum size is 20 MB."
            : String(e?.message || "").includes("unsupported")
              ? "That image format is not supported by this browser."
              : "Could not process the image."
        );
      }finally{
        formState.processingImages = Math.max(0, Number(formState.processingImages || 0) - files.length);
        fileInput.disabled = false;
      }
    });

    async function addUrl(){
      if(!appContext.requireOwner("add card image URL")) return;

      const val = urlInput.value.trim();
      if(!val) return;

      formState.processingImages = Number(formState.processingImages || 0) + 1;
      addUrlBtn.disabled = true;
      const originalText = addUrlBtn.textContent;
      addUrlBtn.textContent = "Processing…";

      try{
        const originalClean=await appContext.processCardImageUrl(val,1800,0.94,false);
        const autoHide=Boolean(psaPrivacyAuto?.checked);
        const clean=autoHide
          ? await appContext.applyPsaPrivacyMaskToCardImageSource(originalClean,0.94)
          : originalClean;
        const finalImage=clean;

        formState.images.push(finalImage);
        formState.imageCleanSources.push(clean);
        formState.imageWatermarkedSources.push(null);
        formState.imageVariantKeys.push(appContext.newCardImageVariantKey());
        formState.imageWatermarkStates.push(false);
        formState.imageWatermarkModes.push("original");
        formState.imagePrivacyUndoSources.push(autoHide ? originalClean : null);
        urlInput.value = "";
        refreshPreview();

        appContext.showToast("Image added as original");
      }catch(err){
        console.warn("Could not process image URL:", err);
        appContext.showToast("Could not process that URL. Upload the image file instead.");
      }finally{
        formState.processingImages = Math.max(0, Number(formState.processingImages || 0) - 1);
        addUrlBtn.disabled = false;
        addUrlBtn.textContent = originalText;
      }
    }

    addUrlBtn.addEventListener("click", ()=>{ addUrl(); });
    urlInput.addEventListener("keydown", e=>{
      if(e.key === "Enter"){
        e.preventDefault();
        addUrl();
      }
    });

    refreshPreview();
  }

function gradingRowHTML(p, grade, index, total=1){
    const g = grade || {company:"PSA", grade:"10", cert:"", pop_count:null, pop_higher:null, pop_updated_at:null};
    const hasPop = g.pop_count != null && g.pop_count !== "";
    const updated = g.pop_updated_at ? new Date(g.pop_updated_at).toLocaleString() : "";
    return `<div class="grading-row" data-grade-index="${index}">
      <div class="grading-slab-label">${appContext.escapeHtml(appContext.slabLabel(index,total))}</div>
      <div class="field">
        <label>Company</label>
        <select class="${p}GradeCompany">
          ${appContext.GRADING_COMPANIES.map(c=>`<option ${c===g.company?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Grade</label>
        <select class="${p}GradeValue">
          ${appContext.GRADE_OPTIONS.map(v=>`<option ${v===String(g.grade)?"selected":""}>${v}</option>`).join("")}
        </select>
      </div>
      <div class="field cert-field">
        <label>${g.company === "PSA" ? "PSA Cert No. / URL" : "Cert. No."} <span class="owner-only-field-note">(owner only)</span></label>
        <input class="${p}GradeCert" type="text" value="${appContext.escapeHtml(g.cert || "")}" placeholder="${g.company === "PSA" ? "156757773 or PSA cert URL" : "Certificate number"}">
        <div class="pop-owner-status">
          ${g.company === "PSA"
            ? (hasPop
                ? `<strong>${appContext.escapeHtml(appContext.gradePopDetailLabel(g))}</strong>${updated ? ` · updated ${appContext.escapeHtml(updated)}` : ""}`
                : `PSA POP has not been synced yet. Use <strong>Inventory Tools → Bulk Edit → PSA POP</strong> to update it.`)
            : `POP updates are managed from Inventory Tools → Bulk Edit → PSA POP.`}
          ${g.company === "PSA" && g.cert
            ? `<div class="psa-pop-owner-actions">
                <a href="${appContext.escapeHtml(appContext.psaCertUrl(g.cert))}" target="_blank" rel="noopener">Open PSA ↗</a>
              </div>`
            : ""}
        </div>
      </div>
      <button type="button" class="grading-remove" title="Remove grading">×</button>
    </div>`;
  }

function wireGradingControls(p, formState){
    const mount = appContext.$(p + "GradingRows");
    const addBtn = appContext.$(p + "AddGrade");
    const condition = appContext.$(p + "Condition");
    const format = appContext.$(p + "Format");
    const year = appContext.$(p + "Year");

    if(year){
      const validateYear=()=>{
        year.setCustomValidity(
          appContext.isValidYearValue(year.value)
            ? ""
            : "Enter a year like 2005 or a range like 2005-2008."
        );
      };

      year.addEventListener("input",validateYear);
      year.addEventListener("change",()=>{
        const normalized=appContext.normalizeYearValue(year.value);
        if(appContext.isValidYearValue(normalized)) year.value=normalized;
        validateYear();
      });
      validateYear();
    }

    function syncGradedCondition(){
      if(!condition) return;

      const hasGrade=Array.isArray(formState.grading) &&
        formState.grading.some(g=>
          g &&
          String(g.company||"").trim() &&
          String(g.grade??"").trim()
        );

      const isSealed=String(format?.value||"").trim().toLowerCase()==="sealed";

      if(hasGrade){
        condition.value="NA";
        condition.disabled=true;
        condition.setAttribute("aria-disabled","true");
        condition.title="Condition is automatically Not Applicable for graded cards.";
      }else if(isSealed){
        condition.value="SEALED";
        condition.disabled=true;
        condition.setAttribute("aria-disabled","true");
        condition.title="Condition is automatically set to Sealed when Format is Sealed.";
      }else{
        if(condition.value==="SEALED"){
          condition.value="NM";
        }
        condition.disabled=false;
        condition.removeAttribute("aria-disabled");
        condition.title="";
      }
    }

    function refresh(){
      mount.innerHTML = formState.grading.map((g,i)=>appContext.gradingRowHTML(p,g,i,formState.grading.length)).join("");
      mount.querySelectorAll(".grading-row").forEach((row, i)=>{
        row.querySelector("." + p + "GradeCompany").addEventListener("change", e=>{
          formState.grading[i].company=e.target.value;
          syncGradedCondition();
        });
        row.querySelector("." + p + "GradeValue").addEventListener("change", e=>{
          formState.grading[i].grade=e.target.value;
          syncGradedCondition();
        });
        const certInput=row.querySelector("." + p + "GradeCert");
        certInput.addEventListener("input", e=>{
          formState.grading[i].cert=e.target.value.trim();
        });
        certInput.addEventListener("blur", e=>{
          if(String(formState.grading[i].company||"").toUpperCase()!=="PSA") return;
          const normalized=appContext.normalizePsaCertInput(e.target.value);
          formState.grading[i].cert=normalized;
          e.target.value=normalized;
        });
        row.querySelector(".grading-remove").addEventListener("click", ()=>{
          formState.grading.splice(i,1);
          refresh();
        });
      });
      syncGradedCondition();
    }

    addBtn.addEventListener("click", ()=>{
      formState.grading.push({company:"PSA", grade:"10", cert:"", pop_count:null, pop_higher:null, pop_updated_at:null});
      refresh();
    });

    format?.addEventListener("change",()=>{
      syncGradedCondition();
    });

    refresh();
  }

function validMyrFxRates(value){
    if(!value || typeof value!=="object") return false;

    const usd=Number(value.usdPerMyr);
    const sgd=Number(value.sgdPerMyr);
    const fetchedAt=Number(value.fetchedAt);

    return Number.isFinite(usd) && usd>0.05 && usd<1 &&
           Number.isFinite(sgd) && sgd>0.1 && sgd<1 &&
           Number.isFinite(fetchedAt) && fetchedAt>0;
  }

function readCachedMyrFxRates(maxAge=appContext.FX_RATE_CACHE_TTL_MS){
    try{
      const parsed=JSON.parse(appContext.localStorage.getItem(appContext.FX_RATE_CACHE_KEY)||"null");
      if(!appContext.validMyrFxRates(parsed)) return null;
      if(Date.now()-parsed.fetchedAt>maxAge) return null;
      return parsed;
    }catch{
      return null;
    }
  }

function saveCachedMyrFxRates(rates){
    if(!appContext.validMyrFxRates(rates)) return;
    try{
      appContext.localStorage.setItem(appContext.FX_RATE_CACHE_KEY,JSON.stringify(rates));
    }catch{}
  }

async function fetchCurrentMyrFxRates(force=false){
    if(!force){
      const cached=appContext.readCachedMyrFxRates();
      if(cached) return {...cached,cacheState:"fresh"};
    }

    if(appContext.fxRateFetchPromise) return appContext.fxRateFetchPromise;

    appContext.fxRateFetchPromise=(async()=>{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);

      try{
        const response=await appContext.fetch(appContext.FX_RATE_ENDPOINT,{
          method:"GET",
          mode:"cors",
          credentials:"omit",
          cache:"no-store",
          referrerPolicy:"no-referrer",
          signal:controller.signal
        });

        if(!response.ok) throw new Error(`FX HTTP ${response.status}`);

        const data=await response.json();
        if(data?.result && data.result!=="success"){
          throw new Error("FX provider returned an error");
        }

        const myrPerUsd=Number(data?.rates?.MYR);
        const sgdPerUsd=Number(data?.rates?.SGD);

        if(!Number.isFinite(myrPerUsd) || myrPerUsd<=0 ||
           !Number.isFinite(sgdPerUsd) || sgdPerUsd<=0){
          throw new Error("FX rates missing");
        }

        const rates={
          usdPerMyr:1/myrPerUsd,
          sgdPerMyr:sgdPerUsd/myrPerUsd,
          fetchedAt:Date.now(),
          providerUpdatedAt:String(
            data?.time_last_update_utc ||
            data?.time_last_update_unix ||
            ""
          ).slice(0,100),
          source:"ExchangeRate-API daily reference"
        };

        if(!appContext.validMyrFxRates(rates)){
          throw new Error("FX rates outside expected range");
        }

        appContext.saveCachedMyrFxRates(rates);
        return {...rates,cacheState:"live"};
      }catch(error){
        console.warn("Live FX rate unavailable:",error);

        const stale=appContext.readCachedMyrFxRates(appContext.FX_RATE_STALE_FALLBACK_MS);
        if(stale) return {...stale,cacheState:"stale"};

        return null;
      }finally{
        clearTimeout(timeout);
      }
    })().finally(()=>{
      appContext.fxRateFetchPromise=null;
    });

    return appContext.fxRateFetchPromise;
  }

function fxRateDateLabel(rates){
    if(!rates) return "";
    const timestamp=Number(rates.fetchedAt||0);
    if(!timestamp) return "";

    try{
      return new Date(timestamp).toLocaleString([],{
        month:"short",
        day:"numeric",
        hour:"numeric",
        minute:"2-digit"
      });
    }catch{
      return "";
    }
  }

function roundConvertedCardPrice(rawAmount){
    const raw=Number(rawAmount);
    if(!Number.isFinite(raw) || raw<0) return null;
    if(raw===0) return 0;

    // Hard rule: NEVER round below the live converted amount.
    let rounded=Math.ceil(raw/appContext.FX_PRICE_ROUND_STEP)*appContext.FX_PRICE_ROUND_STEP;

    // Clean-hundred presentation rule may only move the price UP.
    // Example: 181 -> 200. But 212 can never become 200.
    const nextHundred=Math.ceil(raw/100)*100;
    if(nextHundred>0 &&
       nextHundred>=raw &&
       (nextHundred-raw)<=appContext.FX_CLEAN_HUNDRED_TOLERANCE){
      rounded=nextHundred;
    }

    return rounded;
  }

function convertedPriceValue(amount,rate){
    const raw=Number(amount)*Number(rate);
    const rounded=appContext.roundConvertedCardPrice(raw);
    return rounded==null ? "" : String(rounded);
  }

function applyMyrConversionToFields(p,rates){
    const myr=appContext.$(p+"PriceMYR");
    const usd=appContext.$(p+"PriceUSD");
    const sgd=appContext.$(p+"PriceSGD");
    if(!myr || !usd || !sgd || !rates) return false;

    const myrValue=Number(myr.value);
    if(!Number.isFinite(myrValue) || myrValue<0 || myr.value.trim()===""){
      if(usd.dataset.fxAuto==="1") usd.value="";
      if(sgd.dataset.fxAuto==="1") sgd.value="";
      return false;
    }

    usd.value=appContext.convertedPriceValue(myrValue,rates.usdPerMyr);
    sgd.value=appContext.convertedPriceValue(myrValue,rates.sgdPerMyr);
    usd.dataset.fxAuto="1";
    sgd.dataset.fxAuto="1";
    return true;
  }

function updateFxRateStatus(p,rates,message=""){
    const mount=appContext.$(p+"FxRateStatus");
    const text=appContext.$(p+"FxRateText");
    if(!mount || !text) return;

    mount.classList.toggle("fx-rate-error",!rates);

    if(message){
      text.textContent=message;
      return;
    }

    if(!rates){
      text.textContent="Live conversion unavailable. Enter MYR; USD/SGD can be entered manually.";
      return;
    }

    const sourceState=rates.cacheState==="stale"
      ? "cached fallback"
      : (rates.cacheState==="fresh" ? "cached today" : "latest");

    text.textContent=
      `1 MYR ≈ USD ${Number(rates.usdPerMyr).toFixed(4)} · SGD ${Number(rates.sgdPerMyr).toFixed(4)} · auto prices never round down; round up to 50, or up to the next 100 when within ${appContext.FX_CLEAN_HUNDRED_TOLERANCE} · ${sourceState} · ${appContext.fxRateDateLabel(rates)}`;
  }

function wireAutoCurrencyConversion(p){
    const myr=appContext.$(p+"PriceMYR");
    const usd=appContext.$(p+"PriceUSD");
    const sgd=appContext.$(p+"PriceSGD");
    const refresh=appContext.$(p+"FxRefreshRate");
    if(!myr || !usd || !sgd) return;

    let currentRates=null;
    let myrTouched=false;
    let manualUsd=false;
    let manualSgd=false;

    const applyCurrentRates=()=>{
      if(!currentRates || myr.value.trim()==="") return false;
      return appContext.applyMyrConversionToFields(p,currentRates);
    };

    const loadRates=async(force=false,{applyExisting=true}={})=>{
      if(refresh){
        refresh.disabled=true;
        refresh.textContent=force ? "Refreshing…" : "Loading…";
      }

      appContext.updateFxRateStatus(p,currentRates,"Loading today's exchange rate…");
      const rates=await appContext.fetchCurrentMyrFxRates(force);
      currentRates=rates;
      appContext.updateFxRateStatus(p,rates);

      // Existing MYR is checked when Add/Edit opens. This changes only
      // unsaved form values and never writes until the owner presses Save.
      if(rates && applyExisting && myr.value.trim()!=="" && !manualUsd && !manualSgd){
        appContext.applyMyrConversionToFields(p,rates);
      }else if(rates && myrTouched && myr.value.trim()!==""){
        appContext.applyMyrConversionToFields(p,rates);
      }

      if(refresh){
        refresh.disabled=false;
        refresh.textContent="Refresh rate";
      }
      return rates;
    };

    myr.addEventListener("input",()=>{
      myrTouched=true;
      manualUsd=false;
      manualSgd=false;

      if(myr.value.trim()===""){
        if(usd.dataset.fxAuto==="1") usd.value="";
        if(sgd.dataset.fxAuto==="1") sgd.value="";
        return;
      }

      if(currentRates) applyCurrentRates();
    });

    myr.addEventListener("change",async()=>{
      myrTouched=true;
      manualUsd=false;
      manualSgd=false;
      if(!currentRates) currentRates=await loadRates(false,{applyExisting:false});
      if(currentRates) applyCurrentRates();
    });

    usd.addEventListener("input",()=>{
      manualUsd=true;
      usd.dataset.fxAuto="0";
    });

    sgd.addEventListener("input",()=>{
      manualSgd=true;
      sgd.dataset.fxAuto="0";
    });

    refresh?.addEventListener("click",async()=>{
      manualUsd=false;
      manualSgd=false;
      currentRates=await loadRates(true,{applyExisting:false});
      if(currentRates && myr.value.trim()!==""){
        myrTouched=true;
        applyCurrentRates();
      }
    });

    loadRates(false,{applyExisting:true});
  }

async function ensureMyrConversionBeforeSave(p){
    const myr=appContext.$(p+"PriceMYR");
    const usd=appContext.$(p+"PriceUSD");
    const sgd=appContext.$(p+"PriceSGD");
    if(!myr || !usd || !sgd || myr.value.trim()==="") return true;

    // If both converted fields already contain values, do not overwrite a
    // deliberate manual adjustment just before saving.
    if(usd.value.trim()!=="" && sgd.value.trim()!=="") return true;

    const rates=await appContext.fetchCurrentMyrFxRates(false);
    if(!rates){
      appContext.updateFxRateStatus(p,null);
      return true;
    }

    appContext.applyMyrConversionToFields(p,rates);
    appContext.updateFxRateStatus(p,rates);
    return true;
  }

function wireAvailabilityPriceState(p){
    const availability=appContext.$(p+"Availability");
    const usd=appContext.$(p+"PriceUSD");
    const myr=appContext.$(p+"PriceMYR");
    const sgd=appContext.$(p+"PriceSGD");
    if(!availability) return;

    let hint=appContext.$(p+"NfsPriceHint");
    if(!hint && myr?.closest(".field-row")){
      hint=document.createElement("div");
      hint.id=p+"NfsPriceHint";
      hint.className="nfs-price-hint";
      hint.hidden=true;
      hint.textContent="Collection (NFS) can be saved without a price. If you enter MYR anyway, USD and SGD will still be converted automatically.";
      myr.closest(".field-row").insertAdjacentElement("afterend",hint);
    }

    const sync=()=>{
      const isNfs=appContext.normalizeFilterValue(availability.value)==="collection (nfs)";

      if(myr){
        myr.required=!isNfs;
        myr.closest(".field")?.classList.toggle("nfs-optional-price",isNfs);
      }

      [usd,sgd].forEach(input=>{
        if(!input) return;
        input.required=false;
        input.closest(".field")?.classList.toggle("nfs-optional-price",isNfs);
      });

      const requiredNote=myr?.closest(".field")?.querySelector(".field-required-note");
      if(requiredNote){
        requiredNote.textContent=isNfs ? "optional for NFS" : "required*";
        requiredNote.classList.toggle("is-optional",isNfs);
      }

      if(hint) hint.hidden=!isNfs;
    };

    availability.addEventListener("change",sync);
    sync();
    appContext.wireAutoCurrencyConversion(p);
  }

function invalidFieldLabel(form,input){
    if(!input) return "a required field";
    const id=String(input.id||"");
    if(id){
      const label=form.querySelector(`label[for="${CSS.escape(id)}"]`);
      if(label){
        return String(label.textContent||"")
          .replace(/\(optional\)/gi,"")
          .replace(/\s+/g," ")
          .trim() || "a required field";
      }
    }
    return input.getAttribute("aria-label") || input.name || "a required field";
  }

function reportFirstInvalidField(form){
    const invalid=Array.from(form.querySelectorAll("input,select,textarea"))
      .find(el=>!el.disabled && !el.checkValidity());
    if(!invalid) return "";
    invalid.reportValidity();
    try{ invalid.scrollIntoView({behavior:"smooth",block:"center"}); }catch{}
    return appContext.invalidFieldLabel(form,invalid);
  }

function wireSoldDateField(p){
    const availability = appContext.$(p + "Availability");
    const field = appContext.$(p + "SoldDateField");
    const input = appContext.$(p + "SoldDate");
    if(!availability || !field || !input) return;

    const sync = ()=>{
      const isSold = appContext.normalizeFilterValue(availability.value) === "sold";
      field.hidden = !(appContext.soldAtSupported && isSold);

      if(appContext.soldAtSupported && isSold && !input.value){
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2,"0");
        const d = String(now.getDate()).padStart(2,"0");
        input.value = `${y}-${m}-${d}`;
      }
    };

    availability.addEventListener("change", sync);
    sync();
  }

function wireAutoCapitalization(p){
    const seriesInput = appContext.$(p + "Series");
    if(seriesInput && !seriesInput.dataset.autoCapsWired){
      seriesInput.dataset.autoCapsWired = "1";
      seriesInput.addEventListener("blur", ()=>{
        seriesInput.value = appContext.normalizeStoredLabel(seriesInput.value);
      });
    }
  }

function populateFields(p, card){
    appContext.wireAutoCapitalization(p);
    appContext.$(p + "Name").value = card ? card.name : "";
    appContext.$(p + "CardCode").value = card ? (card.card_code || "") : "";
    appContext.$(p + "Year").value = card && card.year ? card.year : "";
    appContext.$(p + "Game").value = card ? card.game : "";
    appContext.$(p + "Language").value = card ? (card.language || "") : "";
    appContext.$(p + "LanguageDetails").value = card ? (card.language_details || "") : "";
    appContext.$(p + "Series").value = card ? (card.series || "") : "";
    appContext.$(p + "Era").value = card ? (card.era || "") : "";
    if(appContext.$(p + "LifecycleStatus")){
      appContext.$(p + "LifecycleStatus").value = card ? appContext.cardLifecycle(card) : "live";
    }
    appContext.$(p + "Availability").value = appContext.canonicalAvailability(card ? (card.availability || "Available") : "Available");
    if(appContext.$(p + "SoldDate")) appContext.$(p + "SoldDate").value = card ? appContext.soldDateInputValue(card.sold_at) : "";
    appContext.$(p + "Format").value = card ? (card.format || (Array.isArray(card.grading) && card.grading.length ? "Graded" : (card.condition === "SEALED" ? "Sealed" : "Raw"))) : "Raw";
    appContext.$(p + "Condition").value = card ? card.condition : "NM";
    appContext.$(p + "PriceUSD").value = card && card.price_usd != null ? card.price_usd : "";
    appContext.$(p + "PriceMYR").value = card && card.price_myr != null ? card.price_myr : "";
    appContext.$(p + "PriceSGD").value = card && card.price_sgd != null ? card.price_sgd : "";
    appContext.$(p + "PriceNegotiability").value = card
      ? (appContext.priceNegotiabilityFromNotes(card.notes)||"Negotiable")
      : "Negotiable";
    appContext.$(p + "Notes").value = card ? appContext.stripPriceNegotiabilityMarker(card.notes || "") : "";
  }

function collectFields(p, id, formState){
    return {
      id: id || appContext.uid(),
      name: appContext.$(p + "Name").value.trim().toUpperCase(),
      card_code: appContext.$(p + "CardCode").value.trim().toUpperCase(),
      year: appContext.normalizeYearValue(appContext.$(p + "Year").value),
      game: appContext.$(p + "Game").value.trim(),
      language: appContext.$(p + "Language").value,
      language_details: appContext.$(p + "LanguageDetails").value.trim().slice(0,120),
      series: appContext.normalizeStoredLabel(appContext.$(p + "Series").value),
      era: appContext.$(p + "Era").value,
      lifecycle_status: appContext.lifecycleSupported && appContext.$(p + "LifecycleStatus")
        ? String(appContext.$(p + "LifecycleStatus").value||"live").toLowerCase()
        : "live",
      availability: appContext.canonicalAvailability(appContext.$(p + "Availability").value),
      sold_at: appContext.soldAtSupported && appContext.normalizeFilterValue(appContext.$(p + "Availability").value) === "sold"
        ? appContext.soldDateToIso(appContext.$(p + "SoldDate")?.value)
        : null,
      format: appContext.$(p + "Format").value,
      rarity: "Common",
      condition: String(appContext.$(p + "Format").value||"").toLowerCase()==="sealed" &&
                 !(Array.isArray(formState.grading) && formState.grading.some(g=>g&&String(g.company||"").trim()&&String(g.grade??"").trim()))
        ? "SEALED"
        : appContext.$(p + "Condition").value,
      qty: 1,
      price: appContext.$(p + "PriceUSD").value.trim() === "" ? null : Math.max(0, parseFloat(appContext.$(p + "PriceUSD").value)),
      price_usd: appContext.$(p + "PriceUSD").value.trim() === "" ? null : Math.max(0, parseFloat(appContext.$(p + "PriceUSD").value)),
      price_myr: appContext.$(p + "PriceMYR").value.trim() === "" ? null : Math.max(0, parseFloat(appContext.$(p + "PriceMYR").value)),
      price_sgd: appContext.$(p + "PriceSGD").value.trim() === "" ? null : Math.max(0, parseFloat(appContext.$(p + "PriceSGD").value)),
      cost: null,
      price_negotiability: appContext.normalizePriceNegotiability(appContext.$(p + "PriceNegotiability")?.value || "Negotiable"),
      notes: appContext.notesWithPriceNegotiability(
        appContext.$(p + "Notes").value.trim(),
        appContext.$(p + "PriceNegotiability")?.value || "Negotiable"
      ),
      images: formState.images.slice(),
      image: formState.images[0] || null, // keeps compatibility with older code/data
      grading: formState.grading.map(g=>({
        company: g.company,
        grade: g.grade,
        cert: String(g.company||"").toUpperCase()==="PSA"
          ? appContext.normalizePsaCertInput(g.cert || "")
          : (g.cert || ""),
        pop_count: g.pop_count == null ? null : Number(g.pop_count),
        pop_higher: g.pop_higher == null ? null : Number(g.pop_higher),
        pop_updated_at: g.pop_updated_at || null
      })),
      _owner_tags: appContext.sanitizeOwnerTags(appContext.$(p + "OwnerTags")?.value || ""),
      _owner_notes: appContext.sanitizeOwnerPrivateNotes(appContext.$(p + "OwnerNotes")?.value || "")
    };
  }

  Object.assign(appContext,{wireGameCombobox,normalizeYearValue,isValidYearValue,normalizePriceNegotiability,priceNegotiabilityFromNotes,stripPriceNegotiabilityMarker,notesWithPriceNegotiability,fieldsTemplate,wireImageControls,gradingRowHTML,wireGradingControls,validMyrFxRates,readCachedMyrFxRates,saveCachedMyrFxRates,fetchCurrentMyrFxRates,fxRateDateLabel,roundConvertedCardPrice,convertedPriceValue,applyMyrConversionToFields,updateFxRateStatus,wireAutoCurrencyConversion,ensureMyrConversionBeforeSave,wireAvailabilityPriceState,invalidFieldLabel,reportFirstInvalidField,wireSoldDateField,wireAutoCapitalization,populateFields,collectFields});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.PRICE_NEGOTIABILITY_OPTIONS = ["Negotiable","Non-negotiable"];

  appContext.PRICE_NEGOTIABILITY_MARKER_RE = /(?:^|\n)\s*Price terms:\s*(Negotiable|Non-negotiable)\s*(?=\n|$)/i;

  appContext.GRADING_COMPANIES = ["PSA","BGS","TAG","ACE","ARS","CGC","SGC","Other"];

  appContext.GRADE_OPTIONS = [
    "10","9.5","9","8.5","8","7.5","7","6.5","6","5.5","5","4.5","4","3.5","3","2.5","2","1.5","1"
  ];

  appContext.FX_RATE_CACHE_KEY = "collect_tcg_myr_fx_rates_v1";

  appContext.FX_RATE_CACHE_TTL_MS = 12*60*60*1000;

  appContext.FX_RATE_STALE_FALLBACK_MS = 7*24*60*60*1000;

  appContext.FX_RATE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";

  appContext.fxRateFetchPromise = null;

  appContext.FX_PRICE_ROUND_STEP = 50;

  appContext.FX_CLEAN_HUNDRED_TOLERANCE = 20;
}
