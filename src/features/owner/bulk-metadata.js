/** V93 beta: features/owner/bulk-metadata. Shared dependencies are explicit on appContext. */
export function register(appContext){
function bulkMetadataCleanString(value,maxLen=120){
    return String(value ?? "").trim().slice(0,maxLen);
  }

async function updateCardMetadataFields(card,changes){
    if(!appContext.requireOwner("apply bulk metadata changes")) return null;
    if(!card?.id || !changes || typeof changes!=="object") return null;

    const allowedFields=new Set([
      "game","series","era","language","format","condition","availability"
    ]);
    const payload={};

    for(const [field,value] of Object.entries(changes)){
      if(!allowedFields.has(field)) continue;

      if(field==="game"){
        payload.game=appContext.bulkMetadataCleanString(value,120);
      }else if(field==="series"){
        payload.series=appContext.normalizeStoredLabel(appContext.bulkMetadataCleanString(value,80));
      }else if(field==="era"){
        payload.era=appContext.normalizeStoredLabel(value);
      }else if(field==="language"){
        payload.language=appContext.bulkMetadataCleanString(value,20);
      }else if(field==="format"){
        payload.format=appContext.normalizeStoredLabel(value);
      }else if(field==="condition"){
        payload.condition=appContext.bulkMetadataCleanString(value,20);
      }else if(field==="availability"){
        payload.availability=appContext.canonicalAvailability(value);

        // Keep sold-date behavior consistent without exposing a sold-date
        // editor in Bulk Metadata.
        if(appContext.soldAtSupported){
          if(payload.availability==="Sold"){
            payload.sold_at=card.sold_at || new Date().toISOString();
          }else{
            payload.sold_at=null;
          }
        }
      }
    }

    if(!Object.keys(payload).length) return null;

    try{
      let result=await appContext.supabaseClient
        .from("cards")
        .update(payload)
        .eq("id",card.id)
        .select(appContext.cardMutationReturnColumns())
        .single();

      if(result.error &&
         Object.prototype.hasOwnProperty.call(payload,"sold_at") &&
         appContext.optionalColumnUnavailable(result.error,"sold_at")){
        delete payload.sold_at;
        appContext.soldAtSupported=false;

        result=await appContext.supabaseClient
          .from("cards")
          .update(payload)
          .eq("id",card.id)
          .select(appContext.cardMutationReturnColumns())
          .single();
      }

      if(result.error){
        console.error("Bulk metadata update error:",{
          card_id:card.id,
          fields:Object.keys(payload),
          error:result.error
        });
        return null;
      }

      const mergedSource={
        ...card,
        ...changes,
        ...(Object.prototype.hasOwnProperty.call(payload,"sold_at")
          ? {sold_at:payload.sold_at}
          : {})
      };

      return appContext.mergeOwnerOnlyCardFields(appContext.dbToCard(result.data),mergedSource);
    }catch(error){
      console.error("Bulk metadata update request failed:",error);
      return null;
    }
  }

function bulkMetadataFieldLabel(field){
    return ({
      game:"Game",
      series:"Series",
      era:"Era",
      language:"Language",
      format:"Format",
      condition:"Condition",
      availability:"Availability"
    })[field] || field;
  }

function bulkMetadataValueOptions(field){
    if(field==="game") return appContext.GAME_CHOICES.slice();
    if(field==="era") return appContext.ERA_OPTIONS.slice();
    if(field==="language") return appContext.LANGUAGE_OPTIONS.slice();
    if(field==="format") return ["Raw","Graded","Sealed"];
    if(field==="condition") return Object.keys(appContext.CONDITION_LABEL);
    if(field==="availability") return ["Available","Reserved","Sold","Collection (NFS)"];
    return [];
  }

function renderBulkMetadataPage(fromInventoryTools=false){
    if(!appContext.requireOwner("open bulk metadata editor")) return;

    const eligibleCards=appContext.cards.filter(card=>
      appContext.normalizeFilterValue(card.availability||"Available")!=="sold" &&
      appContext.cardLifecycle(card)!=="archived"
    );
    const byId=new Map(eligibleCards.map(card=>[String(card.id),card]));
    const selectedIds=new Set();

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Bulk Editing</div>
          <h2>Bulk Metadata Editor</h2>
          <p>Select active listings, choose the fields to change, preview the update, then apply it securely.</p>
        </div>
      </div>

      <div class="bulk-meta-summary">
        <div><strong id="bulkMetaSelectedCount">0</strong><span>Selected</span></div>
        <div><strong>${eligibleCards.length}</strong><span>Eligible</span></div>
        <div><strong id="bulkMetaFieldCount">0</strong><span>Fields to update</span></div>
      </div>

      <div class="bulk-meta-layout">
        <section class="panel bulk-meta-picker-panel">
          <div class="fb-card-list-control-heading">
            <h3>1 · Select Listings</h3>
            <span id="bulkMetaPickerCount">${eligibleCards.length} shown</span>
          </div>

          <div class="bulk-meta-filters">
            <div class="field">
              <label for="bulkMetaSearch">Search</label>
              <input id="bulkMetaSearch" type="search" maxlength="100" placeholder="Name, code, game or series…">
            </div>
            <div class="field">
              <label for="bulkMetaGameFilter">Game</label>
              <select id="bulkMetaGameFilter">
                <option value="">All games</option>
                ${[...new Set(eligibleCards.map(c=>String(c.game||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="bulkMetaEraFilter">Era</label>
              <select id="bulkMetaEraFilter">
                <option value="">All eras</option>
                ${[...new Set(eligibleCards.map(c=>String(c.era||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="bulkMetaFormatFilter">Format</label>
              <select id="bulkMetaFormatFilter">
                <option value="">All formats</option>
                <option value="graded">Graded</option>
                <option value="raw">Raw</option>
                <option value="sealed">Sealed</option>
              </select>
            </div>

            <div class="field">
              <label for="bulkMetaLanguageFilter">Language</label>
              <select id="bulkMetaLanguageFilter">
                <option value="">All languages</option>
                ${[...new Set(eligibleCards.map(c=>String(c.language||"").trim()).filter(Boolean))]
                  .sort((a,b)=>a.localeCompare(b))
                  .map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>

            <div class="field">
              <label for="bulkMetaAvailabilityFilter">Availability</label>
              <select id="bulkMetaAvailabilityFilter">
                <option value="">All availability</option>
                ${["Available","Reserved","Collection (NFS)"]
                  .filter(v=>eligibleCards.some(c=>appContext.normalizeFilterValue(c.availability||"Available")===appContext.normalizeFilterValue(v)))
                  .map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>

            <div class="field">
              <label for="bulkMetaGradeFilter">Grade / Condition</label>
              <select id="bulkMetaGradeFilter">
                <option value="">All grades / conditions</option>
                ${(()=>{
                  const values=new Set();
                  eligibleCards.forEach(card=>{
                    (Array.isArray(card.grading)?card.grading:[]).forEach(g=>{
                      if(!g?.company || !String(g.grade??"").trim()) return;
                      values.add(`${String(g.company).trim().toUpperCase()} ${String(g.grade).trim()}`);
                    });
                    const format=appContext.effectiveFormat(card);
                    if(format==="Raw"){
                      const label=appContext.CONDITION_LABEL[card.condition]||card.condition||"";
                      if(label && appContext.normalizeFilterValue(label)!=="not applicable") values.add(label);
                    }else if(format==="Sealed"){
                      values.add("Sealed");
                    }
                  });
                  return Array.from(values).sort((a,b)=>{
                    const gradeA=parseFloat(String(a).split(" ").pop());
                    const gradeB=parseFloat(String(b).split(" ").pop());
                    const isGradeA=/^(PSA|BGS|CGC|SGC|TAG|ACE|ARS|OTHER)\b/i.test(a);
                    const isGradeB=/^(PSA|BGS|CGC|SGC|TAG|ACE|ARS|OTHER)\b/i.test(b);
                    if(isGradeA!==isGradeB) return isGradeA?-1:1;
                    if(isGradeA && isGradeB){
                      const companyA=String(a).split(" ")[0];
                      const companyB=String(b).split(" ")[0];
                      if(companyA!==companyB) return companyA.localeCompare(companyB);
                      if(Number.isFinite(gradeA)&&Number.isFinite(gradeB)) return gradeB-gradeA;
                    }
                    return a.localeCompare(b);
                  }).map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("");
                })()}
              </select>
            </div>

            <div class="field">
              <label for="bulkMetaSeriesFilter">Series</label>
              <select id="bulkMetaSeriesFilter">
                <option value="">All series</option>
                ${[...new Set(eligibleCards.map(c=>String(c.series||"").trim()).filter(Boolean))]
                  .sort((a,b)=>a.localeCompare(b))
                  .map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="fb-card-list-bulk-actions">
            <button type="button" class="btn-ghost" id="bulkMetaSelectAllBtn">Select All</button>
            <button type="button" class="btn-ghost" id="bulkMetaClearAllBtn">Clear All</button>
            <button type="button" class="btn-ghost" id="bulkMetaSelectFilteredBtn">Select Filtered</button>
            <button type="button" class="btn-ghost" id="bulkMetaClearFilteredBtn">Clear Filtered</button>
          </div>

          <div class="bulk-meta-picker" id="bulkMetaPicker"></div>
          <div class="bulk-meta-empty" id="bulkMetaPickerEmpty" hidden>No listings match the current filters.</div>
        </section>

        <section class="panel bulk-meta-editor-panel">
          <div class="eyebrow">2 · Choose Fields</div>
          <h3>Metadata Changes</h3>
          <p class="bulk-meta-help">Only enabled fields below will be changed. Public metadata and private owner information can be updated independently.</p>

          <div class="bulk-meta-fields">
            ${["game","series","era","language","format","condition","availability"].map(field=>{
              const label=appContext.bulkMetadataFieldLabel(field);
              const options=appContext.bulkMetadataValueOptions(field);
              const input=field==="series"
                ? `<input type="text" id="bulkMetaValue_${field}" maxlength="80" placeholder="Enter new series">`
                : `<select id="bulkMetaValue_${field}">
                     <option value="">Choose ${appContext.escapeHtml(label.toLowerCase())}…</option>
                     ${options.map(v=>`<option value="${appContext.escapeHtml(v)}">${
                       appContext.escapeHtml(field==="condition" ? (appContext.CONDITION_LABEL[v]||v) : v)
                     }</option>`).join("")}
                   </select>`;
              return `
                <div class="bulk-meta-field-row">
                  <label class="bulk-meta-enable">
                    <input type="checkbox" data-bulk-meta-enable="${field}">
                    <span>${appContext.escapeHtml(label)}</span>
                  </label>
                  <div class="bulk-meta-value">${input}</div>
                </div>
              `;
            }).join("")}
          </div>

          <div class="bulk-private-section" id="bulkPrivateSection">
            <div class="bulk-private-head">
              <div>
                <strong>Private owner information</strong>
                <span>Owner-only tags and notes stored separately from the public listing.</span>
              </div>
              ${appContext.ownerPrivateSupported
                ? `<span class="owner-private-ready">Owner only</span>`
                : `<span class="bulk-private-migration">Migration required</span>`}
            </div>

            <div class="bulk-private-fields">
              <div class="bulk-private-field" id="bulkPrivateTagsField" aria-disabled="true">
                <div class="bulk-private-field-top">
                  <label class="bulk-meta-enable">
                    <input type="checkbox" id="bulkPrivateTagsEnable" ${appContext.ownerPrivateSupported?"":"disabled"}>
                    <span>Private owner tags</span>
                  </label>
                </div>
                <div class="bulk-private-field-controls">
                  <select id="bulkPrivateTagsMode" disabled>
                    <option value="add">Add tags</option>
                    <option value="replace">Replace tags</option>
                    <option value="remove">Remove tags</option>
                    <option value="clear">Clear all tags</option>
                  </select>
                  <input type="text" id="bulkPrivateTagsValue" maxlength="500" placeholder="e.g. Regrade, Priority Sale" disabled>
                </div>
              </div>

              <div class="bulk-private-field" id="bulkPrivateNotesField" aria-disabled="true">
                <div class="bulk-private-field-top">
                  <label class="bulk-meta-enable">
                    <input type="checkbox" id="bulkPrivateNotesEnable" ${appContext.ownerPrivateSupported?"":"disabled"}>
                    <span>Private owner notes</span>
                  </label>
                </div>
                <div class="bulk-private-field-controls">
                  <select id="bulkPrivateNotesMode" disabled>
                    <option value="replace">Replace notes</option>
                    <option value="append">Append to notes</option>
                    <option value="clear">Clear notes</option>
                  </select>
                  <textarea id="bulkPrivateNotesValue" maxlength="2000" placeholder="Internal notes only" disabled></textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="bulk-meta-warning">
            Images, prices, quantities, grading certificate numbers, IDs, timestamps, sold dates and view counts cannot be changed here. Private owner information remains protected by owner-only RLS.
          </div>

          <div class="bulk-meta-preview" id="bulkMetaPreview">
            Select listings and at least one field to see a preview.
          </div>

          <div class="bulk-meta-actions">
            <button type="button" class="btn-primary" id="bulkMetaApplyBtn" disabled>Apply Changes</button>
          </div>
          <div class="hint" id="bulkMetaStatus"></div>
        </section>
      </div>
    `;

    const search=appContext.$("bulkMetaSearch");
    const gameFilter=appContext.$("bulkMetaGameFilter");
    const eraFilter=appContext.$("bulkMetaEraFilter");
    const formatFilter=appContext.$("bulkMetaFormatFilter");
    const languageFilter=appContext.$("bulkMetaLanguageFilter");
    const availabilityFilter=appContext.$("bulkMetaAvailabilityFilter");
    const gradeFilter=appContext.$("bulkMetaGradeFilter");
    const seriesFilter=appContext.$("bulkMetaSeriesFilter");
    const picker=appContext.$("bulkMetaPicker");
    const pickerEmpty=appContext.$("bulkMetaPickerEmpty");
    const pickerCount=appContext.$("bulkMetaPickerCount");
    const selectedCount=appContext.$("bulkMetaSelectedCount");
    const fieldCount=appContext.$("bulkMetaFieldCount");
    const preview=appContext.$("bulkMetaPreview");
    const applyBtn=appContext.$("bulkMetaApplyBtn");
    const status=appContext.$("bulkMetaStatus");
    const privateTagsEnable=appContext.$("bulkPrivateTagsEnable");
    const privateTagsMode=appContext.$("bulkPrivateTagsMode");
    const privateTagsValue=appContext.$("bulkPrivateTagsValue");
    const privateTagsField=appContext.$("bulkPrivateTagsField");
    const privateNotesEnable=appContext.$("bulkPrivateNotesEnable");
    const privateNotesMode=appContext.$("bulkPrivateNotesMode");
    const privateNotesValue=appContext.$("bulkPrivateNotesValue");
    const privateNotesField=appContext.$("bulkPrivateNotesField");

    function visibleCards(){
      const q=appContext.normalizeFilterValue(search.value);
      const game=appContext.normalizeFilterValue(gameFilter.value);
      const era=appContext.normalizeFilterValue(eraFilter.value);
      const format=appContext.normalizeFilterValue(formatFilter.value);
      const language=appContext.normalizeFilterValue(languageFilter.value);
      const availability=appContext.normalizeFilterValue(availabilityFilter.value);
      const grade=appContext.normalizeFilterValue(gradeFilter.value);
      const series=appContext.normalizeFilterValue(seriesFilter.value);

      return eligibleCards.filter(card=>{
        if(game && appContext.normalizeFilterValue(card.game)!==game) return false;
        if(era && appContext.normalizeFilterValue(card.era)!==era) return false;
        if(format && appContext.normalizeFilterValue(appContext.effectiveFormat(card))!==format) return false;
        if(language && appContext.normalizeFilterValue(card.language)!==language) return false;
        if(availability && appContext.normalizeFilterValue(card.availability||"Available")!==availability) return false;
        if(series && appContext.normalizeFilterValue(card.series)!==series) return false;

        if(grade){
          const values=[];
          (Array.isArray(card.grading)?card.grading:[]).forEach(g=>{
            if(g?.company && String(g.grade??"").trim()){
              values.push(`${String(g.company).trim().toUpperCase()} ${String(g.grade).trim()}`);
            }
          });
          const cardFormat=appContext.effectiveFormat(card);
          if(cardFormat==="Raw"){
            values.push(appContext.CONDITION_LABEL[card.condition]||card.condition||"");
          }else if(cardFormat==="Sealed"){
            values.push("Sealed");
          }

          if(!values.some(value=>appContext.normalizeFilterValue(value)===grade)) return false;
        }

        if(q){
          const hay=[card.name,card.card_code,card.game,card.series,card.year,card.language,card.language_details]
            .map(v=>appContext.normalizeFilterValue(v)).join(" ");
          if(!hay.includes(q)) return false;
        }
        return true;
      });
    }

    function selectedCards(){
      return [...selectedIds].map(id=>byId.get(id)).filter(Boolean);
    }

    function enabledChanges(){
      const changes={};

      document.querySelectorAll("[data-bulk-meta-enable]").forEach(box=>{
        if(!box.checked) return;
        const field=String(box.dataset.bulkMetaEnable||"");
        const input=appContext.$(`bulkMetaValue_${field}`);
        if(!input) return;

        const raw=appContext.bulkMetadataCleanString(input.value, field==="series" ? 80 : 120);
        if(!raw) return;

        changes[field]=raw;
      });

      return changes;
    }

    function enabledPrivateChanges(){
      const changes={};

      if(privateTagsEnable?.checked){
        const mode=String(privateTagsMode?.value||"add");
        const tags=appContext.sanitizeOwnerTags(privateTagsValue?.value||"");
        changes.tags={mode,tags};
      }

      if(privateNotesEnable?.checked){
        const mode=String(privateNotesMode?.value||"replace");
        const notes=appContext.sanitizeOwnerPrivateNotes(privateNotesValue?.value||"");
        changes.notes={mode,notes};
      }

      return changes;
    }

    function validatePrivateChanges(changes){
      if(!Object.keys(changes).length) return "";
      if(!appContext.ownerPrivateSupported) return "Private owner information migration is required.";

      if(changes.tags){
        if(!["add","replace","remove","clear"].includes(changes.tags.mode)) return "Invalid private tag operation.";
        if(changes.tags.mode!=="clear" && !changes.tags.tags.length) return "Enter at least one private owner tag.";
      }

      if(changes.notes){
        if(!["replace","append","clear"].includes(changes.notes.mode)) return "Invalid private notes operation.";
        if(changes.notes.mode!=="clear" && !changes.notes.notes) return "Enter private owner notes.";
      }

      return "";
    }

    async function fetchSelectedPrivateMeta(cardIds){
      const ids=cardIds.map(appContext.safeCardId).filter(Boolean);
      const map=new Map(ids.map(id=>[id,{tags:[],notes:""}]));
      if(!ids.length || !appContext.ownerPrivateSupported) return map;

      for(let start=0;start<ids.length;start+=100){
        const chunk=ids.slice(start,start+100);
        const {data,error}=await appContext.supabaseClient
          .from("card_owner_private")
          .select("card_id,tags,notes")
          .in("card_id",chunk);
        if(error) throw error;
        (data||[]).forEach(row=>{
          const id=appContext.safeCardId(row.card_id);
          if(!id) return;
          map.set(id,{
            tags:appContext.sanitizeOwnerTags(row.tags||[]),
            notes:appContext.sanitizeOwnerPrivateNotes(row.notes||"")
          });
        });
      }
      return map;
    }

    function applyPrivateChangeToMeta(current,changes){
      let tags=appContext.sanitizeOwnerTags(current?.tags||[]);
      let notes=appContext.sanitizeOwnerPrivateNotes(current?.notes||"");

      if(changes.tags){
        const incoming=appContext.sanitizeOwnerTags(changes.tags.tags||[]);
        if(changes.tags.mode==="clear") tags=[];
        else if(changes.tags.mode==="replace") tags=incoming;
        else if(changes.tags.mode==="add") tags=appContext.sanitizeOwnerTags([...tags,...incoming]);
        else if(changes.tags.mode==="remove"){
          const remove=new Set(incoming.map(tag=>tag.toLowerCase()));
          tags=tags.filter(tag=>!remove.has(tag.toLowerCase()));
        }
      }

      if(changes.notes){
        const incoming=appContext.sanitizeOwnerPrivateNotes(changes.notes.notes||"");
        if(changes.notes.mode==="clear") notes="";
        else if(changes.notes.mode==="replace") notes=incoming;
        else if(changes.notes.mode==="append"){
          notes=appContext.sanitizeOwnerPrivateNotes([notes,incoming].filter(Boolean).join("\n"));
        }
      }

      return {tags,notes};
    }

    async function savePrivateMetaRows(rows){
      if(!rows.length) return true;
      const payload=rows.map(row=>({
        card_id:appContext.safeCardId(row.card_id),
        tags:appContext.sanitizeOwnerTags(row.tags||[]),
        notes:appContext.sanitizeOwnerPrivateNotes(row.notes||"")
      })).filter(row=>row.card_id);

      if(!payload.length) throw new Error("No valid card IDs were available for the private bulk update.");

      for(let start=0;start<payload.length;start+=100){
        const chunk=payload.slice(start,start+100);
        const {error}=await appContext.supabaseClient
          .from("card_owner_private")
          .upsert(chunk,{onConflict:"card_id"});
        if(error) throw error;
      }
      return true;
    }

    function syncPrivateFieldState(){
      const tagsOn=Boolean(privateTagsEnable?.checked && appContext.ownerPrivateSupported);
      const notesOn=Boolean(privateNotesEnable?.checked && appContext.ownerPrivateSupported);

      if(privateTagsMode) privateTagsMode.disabled=!tagsOn;
      if(privateTagsValue) privateTagsValue.disabled=!tagsOn || privateTagsMode?.value==="clear";
      privateTagsField?.setAttribute("aria-disabled",tagsOn?"false":"true");

      if(privateNotesMode) privateNotesMode.disabled=!notesOn;
      if(privateNotesValue) privateNotesValue.disabled=!notesOn || privateNotesMode?.value==="clear";
      privateNotesField?.setAttribute("aria-disabled",notesOn?"false":"true");
    }

    function validateChanges(changes){
      for(const [field,value] of Object.entries(changes)){
        if(!["game","series","era","language","format","condition","availability"].includes(field)){
          return `Unsupported field: ${field}`;
        }

        if(field!=="series"){
          const allowed=appContext.bulkMetadataValueOptions(field);
          if(!allowed.includes(value)) return `Invalid ${appContext.bulkMetadataFieldLabel(field)} value`;
        }
      }
      return "";
    }

    function updateSummary(){
      syncPrivateFieldState();
      const changes=enabledChanges();
      const privateChanges=enabledPrivateChanges();
      const fields=Object.keys(changes);
      const privateFields=Object.keys(privateChanges);
      const selected=selectedCards();
      const totalFields=fields.length+privateFields.length;

      selectedCount.textContent=selected.length;
      fieldCount.textContent=totalFields;

      const err=validateChanges(changes) || validatePrivateChanges(privateChanges);
      applyBtn.disabled=selected.length===0 || totalFields===0 || !!err;

      if(err){
        preview.textContent=err;
        return;
      }

      if(!selected.length || !totalFields){
        preview.textContent="Select listings and at least one field to see a preview.";
        return;
      }

      const details=fields.map(field=>
        `${appContext.bulkMetadataFieldLabel(field)} → ${changes[field]}`
      );

      if(privateChanges.tags){
        const label={add:"Add tags",replace:"Replace tags",remove:"Remove tags",clear:"Clear tags"}[privateChanges.tags.mode];
        details.push(`Private: ${label}${privateChanges.tags.mode==="clear"?"":` → ${privateChanges.tags.tags.join(", ")}`}`);
      }
      if(privateChanges.notes){
        const label={replace:"Replace notes",append:"Append notes",clear:"Clear notes"}[privateChanges.notes.mode];
        details.push(`Private: ${label}`);
      }

      preview.innerHTML=`
        <strong>${selected.length} listing${selected.length===1?"":"s"} will be updated.</strong>
        <span>${appContext.escapeHtml(details.join(" · "))}</span>
      `;
    }

    function renderPicker(){
      const visible=visibleCards();
      pickerCount.textContent=`${visible.length} shown`;
      pickerEmpty.hidden=visible.length>0;

      picker.innerHTML=visible.map(card=>{
        const id=String(card.id);
        const image=appContext.getImages(card)[0]||"";
        return `
          <label class="bulk-meta-card ${selectedIds.has(id)?"selected":""}">
            <input type="checkbox" data-bulk-meta-id="${appContext.escapeHtml(id)}" ${selectedIds.has(id)?"checked":""}>
            <span class="bulk-meta-thumb">${image?`<img src="${appContext.escapeHtml(image)}" alt="">`:"—"}</span>
            <span class="bulk-meta-copy">
              <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
              <small>${appContext.escapeHtml([card.card_code,card.year,card.series,card.language].filter(Boolean).join(" · "))}</small>
            </span>
            <span class="bulk-meta-status-badge">${appContext.escapeHtml(card.availability||"Available")}</span>
          </label>
        `;
      }).join("");

      picker.querySelectorAll("[data-bulk-meta-id]").forEach(box=>{
        box.addEventListener("change",()=>{
          const id=String(box.dataset.bulkMetaId||"");
          if(box.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          box.closest(".bulk-meta-card")?.classList.toggle("selected",box.checked);
          updateSummary();
        });
      });

      updateSummary();
    }

    function setVisibleSelection(select){
      visibleCards().forEach(card=>{
        const id=String(card.id);
        if(select) selectedIds.add(id);
        else selectedIds.delete(id);
      });
      renderPicker();
    }

    [
      search,gameFilter,eraFilter,formatFilter,
      languageFilter,availabilityFilter,gradeFilter,seriesFilter
    ].forEach(el=>{
      el.addEventListener("input",renderPicker);
      el.addEventListener("change",renderPicker);
    });

    appContext.$("bulkMetaSelectAllBtn").addEventListener("click",()=>{
      eligibleCards.forEach(card=>selectedIds.add(String(card.id)));
      renderPicker();
    });

    appContext.$("bulkMetaClearAllBtn").addEventListener("click",()=>{
      selectedIds.clear();
      renderPicker();
    });

    appContext.$("bulkMetaSelectFilteredBtn").addEventListener("click",()=>setVisibleSelection(true));
    appContext.$("bulkMetaClearFilteredBtn").addEventListener("click",()=>setVisibleSelection(false));

    document.querySelectorAll("[data-bulk-meta-enable]").forEach(box=>{
      box.addEventListener("change",updateSummary);
    });

    // Private owner fields are separate from the public metadata checkboxes,
    // so wire them explicitly. Without this, checking Private owner tags/notes
    // does not enable the controls or refresh the Apply button state.
    [privateTagsEnable,privateTagsMode,privateTagsValue,privateNotesEnable,privateNotesMode,privateNotesValue]
      .filter(Boolean)
      .forEach(el=>{
        el.addEventListener("input",updateSummary);
        el.addEventListener("change",updateSummary);
      });

    ["game","series","era","language","format","condition","availability"].forEach(field=>{
      const input=appContext.$(`bulkMetaValue_${field}`);
      if(!input) return;
      input.addEventListener("input",updateSummary);
      input.addEventListener("change",updateSummary);
    });

    applyBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("apply bulk metadata changes")) return;

      const selected=selectedCards();
      const changes=enabledChanges();
      const privateChanges=enabledPrivateChanges();
      const fields=Object.keys(changes);
      const privateFields=Object.keys(privateChanges);
      const totalFields=fields.length+privateFields.length;
      const err=validateChanges(changes) || validatePrivateChanges(privateChanges);

      if(err){
        status.textContent=err;
        appContext.showToast(err);
        return;
      }
      if(!selected.length){
        status.textContent="Select at least one listing first.";
        appContext.showToast("Select at least one listing");
        return;
      }
      if(!totalFields){
        status.textContent="Enable at least one field to update.";
        appContext.showToast("Choose at least one field to update");
        return;
      }

      const includesSold=changes.availability==="Sold";
      const privateLabel=privateFields.length ? ` including ${privateFields.length} private owner field${privateFields.length===1?"":"s"}` : "";
      const confirmText=includesSold
        ? `Apply ${totalFields} field change${totalFields===1?"":"s"} to ${selected.length} listings${privateLabel}? Some listings will be marked Sold.`
        : `Apply ${totalFields} field change${totalFields===1?"":"s"} to ${selected.length} listings${privateLabel}?`;

      if(!confirm(confirmText)) return;

      const originalText=applyBtn.textContent;
      applyBtn.disabled=true;
      let savedCount=0;
      let failedCount=0;

      try{
        let privateMap=new Map();
        if(privateFields.length){
          applyBtn.textContent="Loading private data…";
          try{
            privateMap=await fetchSelectedPrivateMeta(selected.map(card=>card.id));
          }catch(error){
            console.error("Bulk private metadata read error:",error);
            appContext.showToast("Could not load private owner information");
            status.textContent="Private owner information could not be loaded. No changes were applied.";
            return;
          }
        }

        const privateRows=[];

        for(let i=0;i<selected.length;i++){
          const card=selected[i];
          applyBtn.textContent=`Saving ${i+1}/${selected.length}…`;
          let cardOk=true;

          if(fields.length){
            const saved=await appContext.updateCardMetadataFields(card,changes);
            if(saved){
              const index=appContext.getCardIndexById(card.id);
              if(index>-1) appContext.cards[index]=saved;
              byId.set(String(card.id),saved);
            }else{
              cardOk=false;
            }
          }

          if(privateFields.length){
            const id=appContext.safeCardId(card.id);
            const current=privateMap.get(id)||{tags:[],notes:""};
            const next=applyPrivateChangeToMeta(current,privateChanges);
            privateRows.push({card_id:id,...next});
          }

          if(cardOk) savedCount++;
          else{
            failedCount++;
            status.textContent=`Could not update ${card.name||card.card_code||"a listing"}. Continuing with the remaining selections…`;
          }
        }

        if(privateFields.length){
          applyBtn.textContent="Saving private owner information…";
          status.textContent=`Saving private owner information for ${privateRows.length} listing${privateRows.length===1?"":"s"}…`;
          try{
            await savePrivateMetaRows(privateRows);
          }catch(error){
            console.error("Bulk private metadata save error:",error);
            const detail=String(error?.message||error?.details||error?.hint||"").trim();
            appContext.showToast(detail ? `Private owner save failed: ${detail.slice(0,120)}` : "Could not save private owner information");
            status.textContent=detail
              ? `Private owner information failed to save: ${detail}`
              : "Public changes may have saved, but private owner information failed to save.";
            return;
          }
        }

        status.textContent=failedCount
          ? `${savedCount} saved · ${failedCount} failed.`
          : `${savedCount} listing${savedCount===1?"":"s"} updated successfully.`;

        appContext.showToast(
          failedCount
            ? `Bulk edit: ${savedCount} saved · ${failedCount} failed`
            : `Updated ${savedCount} listing${savedCount===1?"":"s"}`
        );

        selectedIds.clear();
        renderPicker();
      }finally{
        applyBtn.textContent=originalText;
        updateSummary();
      }
    });

    renderPicker();
  }

  Object.assign(appContext,{bulkMetadataCleanString,updateCardMetadataFields,bulkMetadataFieldLabel,bulkMetadataValueOptions,renderBulkMetadataPage});
}
