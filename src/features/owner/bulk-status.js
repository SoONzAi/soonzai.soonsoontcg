/** V93 beta: features/owner/bulk-status. Shared dependencies are explicit on appContext. */
export function register(appContext){
function renderBulkStatusPage(){
    if(!appContext.requireOwner("open bulk status editor")) return;

    const eligibleCards=appContext.cards.filter(card=>
      appContext.isLiveLifecycle(card) &&
      appContext.cardLifecycle(card)!=="archived"
    );
    const byId=new Map(eligibleCards.map(card=>[String(card.id),card]));
    const selectedIds=new Set();

    const games=[...new Set(
      eligibleCards.map(c=>String(c.game||"").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    const languages=[...new Set(
      eligibleCards.map(c=>String(c.language||"").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    const series=[...new Set(
      eligibleCards.map(c=>String(c.series||"").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Bulk Editing</div>
          <h2>Bulk Status Editor</h2>
          <p>Select listings, choose a new availability status, preview the change, then apply it securely.</p>
        </div>
      </div>

      <div class="bulk-status-summary">
        <div><strong id="bulkStatusSelectedCount">0</strong><span>Selected</span></div>
        <div><strong>${eligibleCards.length}</strong><span>Eligible</span></div>
        <div><strong id="bulkStatusTargetCount">0</strong><span>Will change</span></div>
      </div>

      <div class="bulk-status-layout">
        <section class="panel bulk-status-picker-panel">
          <div class="fb-card-list-control-heading">
            <h3>1 · Select Listings</h3>
            <span id="bulkStatusPickerCount">${eligibleCards.length} shown</span>
          </div>

          <div class="bulk-status-filters">
            <div class="field">
              <label for="bulkStatusSearch">Search</label>
              <input id="bulkStatusSearch" type="search" maxlength="100" placeholder="Name, code, game or series…">
            </div>

            <div class="field">
              <label for="bulkStatusGameFilter">Game</label>
              <select id="bulkStatusGameFilter">
                <option value="">All games</option>
                ${games.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>

            <div class="field">
              <label for="bulkStatusCurrentFilter">Current status</label>
              <select id="bulkStatusCurrentFilter">
                <option value="">All statuses</option>
                ${appContext.AVAILABILITY_OPTIONS.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>

            <div class="field">
              <label for="bulkStatusFormatFilter">Format</label>
              <select id="bulkStatusFormatFilter">
                <option value="">All formats</option>
                <option value="graded">Graded</option>
                <option value="raw">Raw</option>
                <option value="sealed">Sealed</option>
              </select>
            </div>

            <div class="field">
              <label for="bulkStatusLanguageFilter">Language</label>
              <select id="bulkStatusLanguageFilter">
                <option value="">All languages</option>
                ${languages.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>

            <div class="field">
              <label for="bulkStatusSeriesFilter">Series</label>
              <select id="bulkStatusSeriesFilter">
                <option value="">All series</option>
                ${series.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="fb-card-list-bulk-actions">
            <button type="button" class="btn-ghost" id="bulkStatusSelectAllBtn">Select All</button>
            <button type="button" class="btn-ghost" id="bulkStatusClearAllBtn">Clear All</button>
            <button type="button" class="btn-ghost" id="bulkStatusSelectFilteredBtn">Select Filtered</button>
            <button type="button" class="btn-ghost" id="bulkStatusClearFilteredBtn">Clear Filtered</button>
          </div>

          <div class="bulk-status-picker" id="bulkStatusPicker"></div>
          <div class="bulk-status-empty" id="bulkStatusPickerEmpty" hidden>No listings match the current filters.</div>
        </section>

        <section class="panel bulk-status-editor-panel">
          <div class="eyebrow">2 · Choose Status</div>
          <h3>New Availability</h3>
          <p class="bulk-meta-help">Only availability is changed. Images, prices, grading, private notes and other metadata stay untouched.</p>

          <div class="field">
            <label for="bulkStatusTarget">Set selected listings to</label>
            <select id="bulkStatusTarget">
              <option value="">Choose status…</option>
              ${appContext.AVAILABILITY_OPTIONS.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
            </select>
          </div>

          <div class="bulk-meta-warning">
            Marking listings <strong>Sold</strong> may stamp the sold date. Moving a sold listing back to another status clears its sold date when supported.
          </div>

          <div class="bulk-meta-preview" id="bulkStatusPreview">
            Select listings and choose a status to see a preview.
          </div>

          <div class="bulk-meta-actions">
            <button type="button" class="btn-primary" id="bulkStatusApplyBtn" disabled>Apply Status</button>
          </div>
          <div class="hint" id="bulkStatusProgress"></div>
        </section>
      </div>
    `;

    const search=appContext.$("bulkStatusSearch");
    const gameFilter=appContext.$("bulkStatusGameFilter");
    const currentFilter=appContext.$("bulkStatusCurrentFilter");
    const formatFilter=appContext.$("bulkStatusFormatFilter");
    const languageFilter=appContext.$("bulkStatusLanguageFilter");
    const seriesFilter=appContext.$("bulkStatusSeriesFilter");
    const target=appContext.$("bulkStatusTarget");
    const picker=appContext.$("bulkStatusPicker");
    const empty=appContext.$("bulkStatusPickerEmpty");
    const pickerCount=appContext.$("bulkStatusPickerCount");
    const selectedCount=appContext.$("bulkStatusSelectedCount");
    const targetCount=appContext.$("bulkStatusTargetCount");
    const preview=appContext.$("bulkStatusPreview");
    const applyBtn=appContext.$("bulkStatusApplyBtn");
    const progress=appContext.$("bulkStatusProgress");

    function visibleCards(){
      const q=appContext.normalizeFilterValue(search.value);
      const game=appContext.normalizeFilterValue(gameFilter.value);
      const status=appContext.normalizeFilterValue(currentFilter.value);
      const format=appContext.normalizeFilterValue(formatFilter.value);
      const language=appContext.normalizeFilterValue(languageFilter.value);
      const selectedSeries=appContext.normalizeFilterValue(seriesFilter.value);

      return eligibleCards.filter(card=>{
        if(game && appContext.normalizeFilterValue(card.game)!==game) return false;
        if(status && appContext.normalizeFilterValue(card.availability||"Available")!==status) return false;
        if(format && appContext.normalizeFilterValue(appContext.effectiveFormat(card))!==format) return false;
        if(language && appContext.normalizeFilterValue(card.language)!==language) return false;
        if(selectedSeries && appContext.normalizeFilterValue(card.series)!==selectedSeries) return false;

        if(q){
          const hay=[
            card.name,card.card_code,card.game,card.series,
            card.year,card.language,card.language_details,card.availability
          ].map(v=>appContext.normalizeFilterValue(v)).join(" ");
          if(!hay.includes(q)) return false;
        }
        return true;
      });
    }

    function selectedCards(){
      return [...selectedIds].map(id=>byId.get(id)).filter(Boolean);
    }

    function cardsThatWillChange(){
      const status=appContext.canonicalAvailability(target.value||"");
      if(!appContext.AVAILABILITY_OPTIONS.includes(status)) return [];
      return selectedCards().filter(card=>
        appContext.normalizeFilterValue(card.availability||"Available")!==appContext.normalizeFilterValue(status)
      );
    }

    function updateSummary(){
      const selected=selectedCards();
      const newStatus=appContext.canonicalAvailability(target.value||"");
      const validTarget=appContext.AVAILABILITY_OPTIONS.includes(newStatus);
      const changing=validTarget ? cardsThatWillChange() : [];

      selectedCount.textContent=String(selected.length);
      targetCount.textContent=String(changing.length);
      applyBtn.disabled=selected.length===0 || !validTarget || changing.length===0;

      if(!selected.length){
        preview.textContent="Select at least one listing.";
        return;
      }
      if(!validTarget){
        preview.textContent=`${selected.length} listing${selected.length===1?"":"s"} selected. Choose a new status.`;
        return;
      }
      if(!changing.length){
        preview.innerHTML=`<strong>No changes needed.</strong><span>Every selected listing is already ${appContext.escapeHtml(newStatus)}.</span>`;
        return;
      }

      const unchanged=selected.length-changing.length;
      preview.innerHTML=`
        <strong>${changing.length} listing${changing.length===1?"":"s"} will be set to ${appContext.escapeHtml(newStatus)}.</strong>
        <span>${unchanged ? `${unchanged} already ${appContext.escapeHtml(newStatus)} and will be skipped.` : "Every selected listing will change."}</span>
      `;
    }

    function renderPicker(){
      const visible=visibleCards();
      pickerCount.textContent=`${visible.length} shown`;
      empty.hidden=visible.length>0;

      picker.innerHTML=visible.map(card=>{
        const id=String(card.id);
        const image=appContext.getImages(card)[0]||"";
        const checked=selectedIds.has(id);
        return `
          <label class="bulk-meta-card ${checked?"selected":""}">
            <input type="checkbox" data-bulk-status-id="${appContext.escapeHtml(id)}" ${checked?"checked":""}>
            <span class="bulk-meta-thumb">${image?`<img src="${appContext.escapeHtml(image)}" alt="">`:"—"}</span>
            <span class="bulk-meta-copy">
              <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
              <small>${appContext.escapeHtml([card.card_code,card.year,card.game,card.series].filter(Boolean).join(" · "))}</small>
            </span>
            <span class="bulk-meta-status-badge">${appContext.escapeHtml(appContext.canonicalAvailability(card.availability||"Available"))}</span>
          </label>
        `;
      }).join("");

      picker.querySelectorAll("[data-bulk-status-id]").forEach(box=>{
        box.addEventListener("change",()=>{
          const id=String(box.dataset.bulkStatusId||"");
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
      search,gameFilter,currentFilter,formatFilter,languageFilter,seriesFilter
    ].forEach(el=>{
      el.addEventListener("input",renderPicker);
      el.addEventListener("change",renderPicker);
    });

    target.addEventListener("change",updateSummary);

    appContext.$("bulkStatusSelectAllBtn").addEventListener("click",()=>{
      eligibleCards.forEach(card=>selectedIds.add(String(card.id)));
      renderPicker();
    });

    appContext.$("bulkStatusClearAllBtn").addEventListener("click",()=>{
      selectedIds.clear();
      renderPicker();
    });

    appContext.$("bulkStatusSelectFilteredBtn").addEventListener("click",()=>setVisibleSelection(true));
    appContext.$("bulkStatusClearFilteredBtn").addEventListener("click",()=>setVisibleSelection(false));

    [privateTagsEnable,privateTagsMode,privateTagsValue,privateNotesEnable,privateNotesMode,privateNotesValue]
      .filter(Boolean)
      .forEach(el=>{
        el.addEventListener("input",updateSummary);
        el.addEventListener("change",updateSummary);
      });
    syncPrivateFieldState();

    applyBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("apply bulk status changes")) return;

      const newStatus=appContext.canonicalAvailability(target.value||"");
      if(!appContext.AVAILABILITY_OPTIONS.includes(newStatus)){
        appContext.showToast("Choose a valid status");
        return;
      }

      const selected=cardsThatWillChange();
      if(!selected.length){
        appContext.showToast("No selected listings need this status change");
        return;
      }

      const soldWarning=newStatus==="Sold"
        ? "\n\nSelected listings will be marked Sold."
        : "";
      if(!confirm(
        `Set ${selected.length} listing${selected.length===1?"":"s"} to ${newStatus}?${soldWarning}`
      )) return;

      const originalText=applyBtn.textContent;
      applyBtn.disabled=true;
      status.textContent="Preparing bulk update…";
      let savedCount=0;
      let failedCount=0;

      try{
        for(let i=0;i<selected.length;i++){
          const card=selected[i];
          applyBtn.textContent=`Saving ${i+1}/${selected.length}…`;
          progress.textContent=`Updating ${card.name||card.card_code||"listing"}…`;

          // Reuse the field-only secure updater from Bulk Metadata.
          // This changes availability only and never resends images/private
          // grading/prices or other unrelated card fields.
          const saved=await appContext.updateCardMetadataFields(card,{availability:newStatus});

          if(saved){
            const index=appContext.getCardIndexById(card.id);
            if(index>-1) appContext.cards[index]=saved;
            byId.set(String(card.id),saved);
            savedCount++;
          }else{
            failedCount++;
          }
        }

        appContext.invalidateOwnerReservedAgeCache();

        progress.textContent=failedCount
          ? `${savedCount} saved · ${failedCount} failed.`
          : `${savedCount} listing${savedCount===1?"":"s"} updated successfully.`;

        appContext.showToast(
          failedCount
            ? `Bulk status: ${savedCount} saved · ${failedCount} failed`
            : `Updated ${savedCount} listing${savedCount===1?"":"s"}`
        );

        // Keep failed items selected so the owner can retry them.
        const failedIds=new Set();
        if(failedCount){
          selected.forEach(card=>{
            const latest=byId.get(String(card.id));
            if(appContext.normalizeFilterValue(latest?.availability||"")!==appContext.normalizeFilterValue(newStatus)){
              failedIds.add(String(card.id));
            }
          });
        }
        selectedIds.clear();
        failedIds.forEach(id=>selectedIds.add(id));

        renderPicker();
      }finally{
        applyBtn.textContent=originalText;
        updateSummary();
      }
    });

    renderPicker();
  }

function gradingEntries(card){
    if(Array.isArray(card?.grading)) return card.grading;
    if(Array.isArray(card?.grades)) return card.grades;
    return [];
  }

function isSlabGradingEntry(entry){
    if(!entry || typeof entry!=="object") return false;

    const company=String(entry.company||entry.grader||"").trim();
    const grade=String(entry.grade||entry.value||"").trim();

    return Boolean(company || grade);
  }

function missingCertificateEntries(card){
    return appContext.gradingEntries(card)
      .map((entry,index)=>({entry,index}))
      .filter(({entry})=>{
        if(!appContext.isSlabGradingEntry(entry)) return false;

        const cert=String(entry.cert || entry.certificate || "").trim();
        return !cert;
      });
  }

function cardsMissingCertificates(){
    return appContext.cards
      .map(card=>({
        card,
        missing:appContext.missingCertificateEntries(card)
      }))
      .filter(item=>item.missing.length>0);
  }

function renderBulkMissingCertsPage(){
    if(!appContext.requireOwner("open missing certificate check")) return;

    const rows=appContext.cardsMissingCertificates();

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Bulk Editing</div>
          <h2>Missing Certificates</h2>
          <p>Find graded or slabbed cards that are missing a certificate number.</p>
        </div>
      </div>

      <div class="missing-cert-summary">
        <article>
          <span>Missing cert</span>
          <strong>${rows.length.toLocaleString()}</strong>
          <small>Graded / slabbed cards</small>
        </article>
      </div>

      <section class="panel inventory-tool-panel">
        <div class="inventory-tool-head">
          <div>
            <h3>Certificate Check</h3>
            <p class="muted">
              A card appears here when a grading company or grade is saved but
              its certificate number is empty.
            </p>
          </div>
        </div>

        ${
          rows.length
            ? `<div class="inventory-tool-list missing-cert-list">
                ${rows.map(({card,missing})=>{
                  const title=appContext.escapeHtml(card.name || card.title || card.card_code || "Untitled card");
                  const code=appContext.escapeHtml(card.card_code || card.code || "");
                  const image=appContext.getImages(card)[0] || "";

                  const graders=missing.map(({entry,index})=>{
                    const company=appContext.escapeHtml(
                      String(entry.company||entry.grader||"Unknown grader").trim() || "Unknown grader"
                    );
                    const grade=appContext.escapeHtml(
                      String(entry.grade||entry.value||"").trim()
                    );

                    return `<span class="missing-cert-pill">Slab ${index+1} · ${company}${grade ? ` ${grade}` : ""}</span>`;
                  }).join("");

                  return `
                    <article class="missing-cert-row"
                             data-card-id="${appContext.escapeHtml(String(card.id))}">
                      <div class="missing-cert-thumb">
                        ${
                          image
                            ? `<img src="${appContext.escapeHtml(image)}" alt="${title}">`
                            : `<div class="missing-cert-no-image">No image</div>`
                        }
                      </div>

                      <div class="missing-cert-main">
                        <div class="missing-cert-title">${title}</div>
                        ${code ? `<div class="muted missing-cert-code">${code}</div>` : ""}
                        <div class="missing-cert-graders">${graders}</div>
                      </div>

                      <div class="missing-cert-actions">
                        <button type="button"
                                class="btn-primary"
                                data-missing-cert-edit="${appContext.escapeHtml(String(card.id))}">
                          Edit Card
                        </button>
                      </div>
                    </article>
                  `;
                }).join("")}
              </div>`
            : `<div class="empty compact inventory-empty-state">
                <p><strong>No missing certificates found.</strong></p>
                <p>All graded/slabbed cards currently have certificate numbers saved.</p>
              </div>`
        }
      </section>
    `;

    appContext.view.querySelectorAll("[data-missing-cert-edit]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const id=String(btn.dataset.missingCertEdit||"");
        const card=appContext.cards.find(c=>String(c.id)===id);
        if(card) appContext.openEditModal(card);
      });
    });
  }

function renderBulkPsaPopPage(){
    if(!appContext.requireOwner("open PSA POP bulk updater")) return;

    const entries=appContext.psaPopEntries();
    const normalDue=entries.filter(entry=>appContext.psaPopEntryIsDue(entry));
    const withPop=entries.filter(entry=>entry.pop!=null && entry.pop!=="");
    const never=entries.filter(entry=>entry.pop==null || entry.pop==="");

    // Recovery queue is deliberately separate from the normal Due calculation.
    // It tracks failures/remaining work from the most recent bulk run even when
    // those cards already had POP values before the run.
    const retryResult=appContext.readPsaBulkRetryResult?.()||null;

    let previousResult=null;
    try{
      previousResult=JSON.parse(appContext.sessionStorage.getItem(appContext.PSA_BULK_RESULT_KEY)||"null");
    }catch{}

    const activeState=appContext.readPsaBulkState();

    const recoveryCertQueue=activeState
      ? activeState.certs.slice(Math.max(0,Number(activeState.index||0)))
      : (Array.isArray(retryResult?.failed)
          ? retryResult.failed.map(item=>appContext.normalizePsaCertInput(item?.cert||"")).filter(Boolean)
          : []);

    // Preserve repeated cert occurrences so V186's "every listing" behavior is
    // also respected when retrying failed/remaining work.
    const entryPools=new Map();
    entries.forEach(entry=>{
      const cert=appContext.normalizePsaCertInput(entry?.cert||"");
      if(!cert) return;
      if(!entryPools.has(cert)) entryPools.set(cert,[]);
      entryPools.get(cert).push(entry);
    });
    const poolIndexes=new Map();
    const recoveryEntries=recoveryCertQueue.map(cert=>{
      const normalized=appContext.normalizePsaCertInput(cert||"");
      const pool=entryPools.get(normalized)||[];
      if(!pool.length) return null;
      const index=Number(poolIndexes.get(normalized)||0);
      const entry=pool[Math.min(index,pool.length-1)];
      poolIndexes.set(normalized,index+1);
      return entry;
    }).filter(Boolean);

    // V188: one Due collection is the single source of truth for the count,
    // visible Due state, and the Update Due action. It includes normal due/stale
    // listings plus failed/interrupted items from the latest bulk run.
    const due=[...normalDue];
    recoveryEntries.forEach(entry=>{
      if(entry && !due.includes(entry)) due.push(entry);
    });
    const dueSet=new Set(due);

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Bulk Editing</div>
          <h2>PSA POP Updates</h2>
          <p>Refresh PSA Population and Pop Higher from the public PSA cert pages using your Tampermonkey browser helper.</p>
        </div>
      </div>

      ${previousResult ? `
        <div class="psa-bulk-result ${previousResult.failed?.length?"warn":"ok"}">
          <strong>Last bulk update finished</strong>
          <span>${Number(previousResult.completed||0).toLocaleString()} updated${previousResult.failed?.length ? ` · ${previousResult.failed.length} failed` : ""}</span>
        </div>
      ` : ""}

      <div class="psa-bulk-stats">
        <article><span>PSA listings</span><strong>${entries.length.toLocaleString()}</strong><small>Every eligible listing will be processed</small></article>
        <article><span>Due now</span><strong>${due.length.toLocaleString()}</strong><small>${due.length.toLocaleString()} listing${due.length===1?"":"s"} to process</small></article>
        <article><span>With POP</span><strong>${withPop.length.toLocaleString()}</strong><small>Current saved population</small></article>
        <article><span>Never synced</span><strong>${never.length.toLocaleString()}</strong><small>No POP saved yet</small></article>
      </div>

      <section class="panel psa-bulk-panel">
        <div class="psa-bulk-actions">
          <button type="button" class="btn-primary" id="psaBulkDueBtn" data-psa-bulk-action="due" aria-label="Update due PSA POPs" ${due.length?"":"disabled"}>
            Update Due PSA POPs (${due.length})
          </button>
          <button type="button" class="btn-ghost" id="psaBulkAllBtn" data-psa-bulk-action="all" aria-label="Update all PSA POPs" ${entries.length?"":"disabled"}>
            Update All PSA POPs (${entries.length})
          </button>
        </div>

        <div class="psa-bulk-note">
          <strong>PSA refresh workflow</strong>
          <span><b>Update Due PSA POPs</b> includes listings whose POP refresh is 3+ days old, plus failed or interrupted items from the latest bulk run, so you can resume after PSA rate limits.</span>
        </div>

        ${activeState ? `
          <div class="psa-bulk-progress">
            <strong>Bulk update in progress</strong>
            <span>${Math.min(Number(activeState.index||0),activeState.certs.length)} / ${activeState.certs.length}</span>
          </div>
        ` : ""}

        <div class="psa-bulk-list">
          ${entries.length ? entries.map((entry,index)=>{
            const dueNow=dueSet.has(entry);
            const updatedMs=appContext.psaPopEntryUpdatedMs(entry);
            const updated=updatedMs ? new Date(updatedMs).toLocaleString() : "Never";
            const pop=entry.pop!=null && entry.pop!=="" && Number.isFinite(Number(entry.pop))
              ? Number(entry.pop).toLocaleString()
              : "—";
            const higher=entry.higher!=null && entry.higher!=="" && Number.isFinite(Number(entry.higher))
              ? Number(entry.higher).toLocaleString()
              : "—";

            return `
              <article>
                <div>
                  <strong>${appContext.escapeHtml(entry.cardName)}</strong>
                  <span>${appContext.escapeHtml(entry.cardCode||"No code")}${entry.slabCount>1 ? ` · Slab ${entry.slabNumber} of ${entry.slabCount}` : ""} · Cert ${appContext.escapeHtml(entry.cert)}</span>
                </div>
                <div class="psa-bulk-values">
                  <span>POP <b>${appContext.escapeHtml(pop)}</b></span>
                  <span>Higher <b>${appContext.escapeHtml(higher)}</b></span>
                  <button type="button"
                          class="psa-row-refresh ${dueNow?"due":"fresh"}"
                          data-psa-row-refresh="${appContext.escapeHtml(entry.cert)}"
                          data-psa-row-index="${index}"
                          title="Refresh this PSA certificate now"
                          aria-label="Refresh PSA POP for cert ${appContext.escapeHtml(entry.cert)}">
                    ${dueNow?"Due":"Fresh"}
                  </button>
                </div>
                <small>Updated: ${appContext.escapeHtml(updated)}</small>
              </article>`;
          }).join("") : `
            <div class="empty compact">
              <p>No PSA graded cards with certificate numbers were found.</p>
            </div>`}
        </div>
      </section>
    `;

    const psaBulkPanel=appContext.view.querySelector(".psa-bulk-panel");

    psaBulkPanel?.addEventListener("click",event=>{
      const button=event.target.closest("button");
      if(!button || button.disabled) return;

      if(button.matches("[data-psa-row-refresh]")){
        event.preventDefault();

        const cert=appContext.normalizePsaCertInput(button.dataset.psaRowRefresh||"");
        const rowIndex=Number(button.dataset.psaRowIndex);
        const entry=Number.isInteger(rowIndex) ? entries[rowIndex] : null;

        if(!cert || !entry || appContext.normalizePsaCertInput(entry.cert)!==cert){
          appContext.showToast("Unable to identify this PSA certificate");
          return;
        }

        button.disabled=true;
        appContext.showToast(`Refreshing PSA cert ${cert}…`);

        // Use exactly the same queue + return path as bulk refresh,
        // with a queue containing only this one slab.
        requestAnimationFrame(()=>{
          appContext.startBulkPsaPopSync([entry],"Single PSA POP");
        });
        return;
      }

      if(button.id==="psaBulkDueBtn"){
        event.preventDefault();

        if(!due.length){
          appContext.showToast("No PSA POPs are due for refresh");
          return;
        }

        const ok=confirm(
          `Update ${due.length} due listing${due.length===1?"":"s"} now?\n\n` +
          `${due.length} PSA listing${due.length===1?"":"s"} will be processed. This includes due/stale listings plus failed or interrupted items from the latest bulk run.`
        );
        if(!ok) return;

        button.disabled=true;
        appContext.showToast(`Starting PSA POP refresh · ${due.length} listing${due.length===1?"":"s"}…`);

        requestAnimationFrame(()=>{
          appContext.startBulkPsaPopSync(due,"Daily PSA POP");
        });
        return;
      }

      if(button.id==="psaBulkAllBtn"){
        event.preventDefault();

        if(!entries.length){
          appContext.showToast("No PSA certificates found");
          return;
        }

        const ok=confirm(
          `Update all ${entries.length} PSA POP record${entries.length===1?"":"s"} now?\n\n` +
          `This may take a while because PSA pages are opened one at a time.`
        );
        if(!ok) return;

        button.disabled=true;
        appContext.showToast(`Starting PSA POP refresh for all ${entries.length} cert${entries.length===1?"":"s"}…`);

        requestAnimationFrame(()=>{
          appContext.startBulkPsaPopSync(entries,"All PSA POP");
        });
      }
    });
  }

function renderInventoryToolsPage(){
    if(!appContext.requireOwner("open inventory tools")) return;

    const mode=appContext.currentInventoryToolMode();
    const submode=appContext.currentInventoryToolSubmode(mode);

    if(submode==="metadata") appContext.renderBulkMetadataPage(true);
    else if(submode==="status") appContext.renderBulkStatusPage();
    else if(submode==="psa") appContext.renderBulkPsaPopPage();
    else if(submode==="missing-certs") appContext.renderBulkMissingCertsPage();
    else if(submode==="health") appContext.renderSupabaseHealthPage();
    else if(submode==="storage-audit") appContext.renderStorageAuditPage();
    else if(submode==="storage-optimizer") appContext.renderStorageOptimizerPage();
    else if(submode==="backup") appContext.renderInventoryExportPage();
    else if(submode==="recent") appContext.renderRecentlyEditedOwnerPage(true);
    else if(submode==="history") appContext.renderEditHistoryPage();
    else if(submode==="audit") appContext.renderCatalogueAuditPage();
    else if(submode==="images") appContext.renderImageHealthPage(true);
    else if(submode==="duplicates") appContext.renderDuplicateDetectorPage();
    else if(submode==="reprocess") appContext.renderImageReprocessPage();
    else if(submode==="lifecycle") appContext.renderLifecycleManagerPage();
    else if(submode==="migration") appContext.renderLegacyImageMigrationPage();
    else appContext.renderBulkPricePage(true);

    const pageHead=appContext.view.querySelector(".page-head");
    if(pageHead){
      pageHead.insertAdjacentHTML("afterend",appContext.inventoryToolsSwitcher(mode,submode)+appContext.ownerAlertsDashboardHTML());
      appContext.refreshOwnerReservedAgeUI(false);
    }
  }

function catalogueAuditIssues(card){
    const issues=[];
    const images=appContext.getImages(card);
    const status=appContext.normalizeFilterValue(card.availability||"");
    const format=appContext.normalizeFilterValue(appContext.effectiveFormat(card));
    const grades=Array.isArray(card.grading)?card.grading.filter(Boolean):[];

    if(!images.length) issues.push({key:"image",label:"Missing image",critical:true});
    if(!String(card.card_code||"").trim()) issues.push({key:"code",label:"Missing card code",critical:false});
    if(!String(card.year||"").trim()) issues.push({key:"year",label:"Missing year",critical:false});
    else if(!appContext.isValidYearValue(card.year)) issues.push({key:"year-invalid",label:"Invalid year / range",critical:true});
    if(!String(card.game||"").trim()) issues.push({key:"game",label:"Missing game",critical:true});
    if(!String(card.series||"").trim()) issues.push({key:"series",label:"Missing series",critical:false});
    if(status==="available" && !appContext.hasListedPrice(card.price_myr)) issues.push({key:"myr",label:"Available · missing MYR price",critical:true});
    if(format==="graded"){
      if(!grades.length || !String(grades[0]?.company||"").trim()) issues.push({key:"grade-company",label:"Graded · missing company",critical:true});
      if(!String(grades[0]?.grade||"").trim()) issues.push({key:"grade",label:"Graded · missing grade",critical:true});
      if(appContext.isOwnerMode() && grades.length && !String(grades[0]?.cert||"").trim()) issues.push({key:"cert",label:"Graded · missing certificate",critical:false});
    }
    if(images.some(appContext.isPendingCardImage)) issues.push({key:"legacy",label:"Legacy Base64 image",critical:true});
    if(images.some(img=>!appContext.isPendingCardImage(img) && !appContext.safeHttpUrl(img))) issues.push({key:"image-url",label:"Invalid image URL",critical:true});
    return issues;
  }

function renderCatalogueAuditPage(){
    if(!appContext.requireOwner("open catalogue audit")) return;
    const rows=appContext.cards.map(card=>({card,issues:appContext.catalogueAuditIssues(card)}));
    const withIssues=rows.filter(row=>row.issues.length);
    const countFor=key=>rows.filter(row=>row.issues.some(issue=>issue.key===key)).length;
    const critical=rows.filter(row=>row.issues.some(issue=>issue.critical)).length;

    appContext.view.innerHTML=`
      <div class="page-head"><div><div class="eyebrow">Inventory Tools · Quality</div><h2>Catalogue Audit</h2><p>Find incomplete or risky listings before buyers see them.</p></div></div>
      <div class="catalogue-audit-summary">
        <button type="button" data-audit-filter="all"><strong>${withIssues.length}</strong><span>Listings with issues</span></button>
        <button type="button" data-audit-filter="critical"><strong>${critical}</strong><span>Critical</span></button>
        <button type="button" data-audit-filter="image"><strong>${countFor("image")}</strong><span>Missing image</span></button>
        <button type="button" data-audit-filter="code"><strong>${countFor("code")}</strong><span>Missing code</span></button>
        <button type="button" data-audit-filter="year"><strong>${countFor("year")+countFor("year-invalid")}</strong><span>Year issues</span></button>
        <button type="button" data-audit-filter="myr"><strong>${countFor("myr")}</strong><span>Missing MYR</span></button>
      </div>
      <section class="panel catalogue-audit-panel">
        <div class="catalogue-audit-toolbar"><input id="catalogueAuditSearch" type="search" placeholder="Search card name, code, series…" autocomplete="off"><span id="catalogueAuditCount"></span></div>
        <div id="catalogueAuditList" class="catalogue-audit-list"></div>
      </section>`;

    let activeFilter="all";
    const render=()=>{
      const q=String(appContext.$("catalogueAuditSearch")?.value||"").trim().toLowerCase();
      const visible=rows.filter(row=>{
        if(!row.issues.length) return false;
        if(activeFilter==="critical" && !row.issues.some(i=>i.critical)) return false;
        if(!["all","critical"].includes(activeFilter) && !row.issues.some(i=>i.key===activeFilter || (activeFilter==="year"&&i.key==="year-invalid"))) return false;
        if(q){
          const hay=[row.card.name,row.card.card_code,row.card.series,row.card.game,row.card.year].join(" ").toLowerCase();
          if(!hay.includes(q)) return false;
        }
        return true;
      });
      appContext.$("catalogueAuditCount").textContent=`${visible.length} listing${visible.length===1?"":"s"}`;
      appContext.$("catalogueAuditList").innerHTML=visible.length?visible.map(({card,issues})=>`
        <div class="catalogue-audit-row">
          <div class="catalogue-audit-thumb">${appContext.getImages(card)[0]?`<img src="${appContext.escapeHtml(appContext.getImages(card)[0])}" alt="" loading="lazy" decoding="async">`:`<span>No image</span>`}</div>
          <div class="catalogue-audit-copy"><strong>${appContext.escapeHtml(card.name)}</strong><small>${appContext.escapeHtml([card.card_code,card.series,card.year].filter(Boolean).join(" · "))}</small><div>${issues.map(issue=>`<span class="catalogue-audit-chip ${issue.critical?"critical":""}">${appContext.escapeHtml(issue.label)}</span>`).join("")}</div></div>
          <button type="button" class="btn-ghost" data-audit-edit="${appContext.escapeHtml(card.id)}">Edit</button>
        </div>`).join(""):`<div class="quality-empty"><strong>No matching issues</strong><span>Your catalogue looks clean for this filter.</span></div>`;
      appContext.$("catalogueAuditList").querySelectorAll("[data-audit-edit]").forEach(btn=>btn.addEventListener("click",()=>{
        const card=appContext.getCardById(btn.dataset.auditEdit||"");
        if(card) appContext.openEditModal(card);
      }));
    };
    appContext.view.querySelectorAll("[data-audit-filter]").forEach(btn=>btn.addEventListener("click",()=>{activeFilter=String(btn.dataset.auditFilter||"all");render();}));
    appContext.$("catalogueAuditSearch")?.addEventListener("input",render);
    render();
  }

  Object.assign(appContext,{renderBulkStatusPage,gradingEntries,isSlabGradingEntry,missingCertificateEntries,cardsMissingCertificates,renderBulkMissingCertsPage,renderBulkPsaPopPage,renderInventoryToolsPage,catalogueAuditIssues,renderCatalogueAuditPage});
}
