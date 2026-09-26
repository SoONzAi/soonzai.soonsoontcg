/** V93 beta: features/owner/bulk-price. Shared dependencies are explicit on appContext. */
export function register(appContext){
function priceInputValue(value){
    if(value == null || value === "" || Number(value) === 0) return "";
    const n=Number(value);
    return Number.isFinite(n) ? String(n) : "";
  }

function normalizeBulkPriceValue(value){
    const raw=String(value ?? "").trim();
    if(raw==="") return null;
    const n=Number(raw);
    return Number.isFinite(n) && n>=0 ? n : NaN;
  }

function sameNullableNumber(a,b){
    const an=a==null||a===""||Number(a)===0 ? null : Number(a);
    const bn=b==null||b===""||Number(b)===0 ? null : Number(b);
    return an===bn;
  }

function renderBulkPricePage(fromInventoryTools=false){
    if(!appContext.requireOwner("open bulk price editor")) return;

    const editableCards=appContext.cards.filter(card=>
      appContext.normalizeFilterValue(card.availability||"Available")!=="sold" &&
      appContext.cardLifecycle(card)!=="archived"
    );

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Bulk Editing</div>
          <h2>Bulk Price Editor</h2>
          <p>Update MYR, USD and SGD listing prices quickly. Sold archive listings are excluded to preserve their historical listed prices.</p>
        </div>
      </div>

      <div class="bulk-price-summary">
        <div><strong>${editableCards.length}</strong><span>Active listings</span></div>
        <div><strong id="bulkPriceChangedCount">0</strong><span>Changed</span></div>
        <div><strong id="bulkPriceVisibleCount">${editableCards.length}</strong><span>Visible</span></div>
      </div>

      <div class="panel bulk-price-panel">
        <div class="bulk-price-toolbar">
          <div class="field bulk-price-search">
            <label for="bulkPriceSearch">Search</label>
            <input id="bulkPriceSearch" type="search" maxlength="100" placeholder="Name, code, game or series…">
          </div>
          <div class="field">
            <label for="bulkPriceStatus">Status</label>
            <select id="bulkPriceStatus">
              <option value="">All active</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="collection (nfs)">Collection (NFS)</option>
            </select>
          </div>
          <label class="quality-clean-toggle">
            <input type="checkbox" id="bulkPriceChangedOnly">
            <span>Changed only</span>
          </label>
          <button type="button" class="btn-ghost bulk-price-fx-refresh" id="bulkPriceRefreshFxBtn">
            Refresh FX Rates
          </button>
        </div>
        <div class="bulk-price-fx-status" id="bulkPriceFxStatus">
          Uses each listing's existing MYR price to recalculate USD and SGD. Nothing is saved until you press Save Price Changes.
        </div>

        <div class="bulk-price-table-wrap">
          <table class="bulk-price-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>MYR</th>
                <th>USD</th>
                <th>SGD</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="bulkPriceRows"></tbody>
          </table>
        </div>

        <div class="bulk-price-empty" id="bulkPriceEmpty" hidden>No listings match the current filters.</div>

        <div class="bulk-price-footer">
          <div class="bulk-price-save-status" id="bulkPriceSaveStatus">No unsaved changes.</div>
          <div class="bulk-price-footer-actions">
            <button type="button" class="btn-ghost" id="bulkPriceResetBtn" disabled>Undo All Changes</button>
            <button type="button" class="btn-primary" id="bulkPriceSaveBtn" disabled>Save Price Changes</button>
          </div>
        </div>
      </div>
    `;

    const search=appContext.$("bulkPriceSearch");
    const statusFilter=appContext.$("bulkPriceStatus");
    const changedOnly=appContext.$("bulkPriceChangedOnly");
    const rowsMount=appContext.$("bulkPriceRows");
    const empty=appContext.$("bulkPriceEmpty");
    const changedCount=appContext.$("bulkPriceChangedCount");
    const visibleCount=appContext.$("bulkPriceVisibleCount");
    const saveBtn=appContext.$("bulkPriceSaveBtn");
    const resetBtn=appContext.$("bulkPriceResetBtn");
    const saveStatus=appContext.$("bulkPriceSaveStatus");
    const refreshFxBtn=appContext.$("bulkPriceRefreshFxBtn");
    const fxStatus=appContext.$("bulkPriceFxStatus");

    const original=new Map(editableCards.map(card=>[
      String(card.id),
      {
        price_myr:card.price_myr==null?null:Number(card.price_myr),
        price_usd:(card.price_usd ?? card.price)==null?null:Number(card.price_usd ?? card.price),
        price_sgd:card.price_sgd==null?null:Number(card.price_sgd)
      }
    ]));

    const drafts=new Map(editableCards.map(card=>[
      String(card.id),
      {...original.get(String(card.id))}
    ]));

    function isChanged(id){
      const a=original.get(id);
      const b=drafts.get(id);
      if(!a||!b) return false;
      return !appContext.sameNullableNumber(a.price_myr,b.price_myr) ||
             !appContext.sameNullableNumber(a.price_usd,b.price_usd) ||
             !appContext.sameNullableNumber(a.price_sgd,b.price_sgd);
    }

    function changedIds(){
      return editableCards.map(c=>String(c.id)).filter(isChanged);
    }

    function refreshDraftFxFromMyr(rates){
      let updated=0;
      let skipped=0;

      editableCards.forEach(card=>{
        const id=String(card.id);
        const draft=drafts.get(id);
        if(!draft) return;

        const myr=Number(draft.price_myr);
        if(!Number.isFinite(myr) || myr<0 || draft.price_myr==null){
          skipped++;
          return;
        }

        const usd=appContext.roundConvertedCardPrice(myr*rates.usdPerMyr);
        const sgd=appContext.roundConvertedCardPrice(myr*rates.sgdPerMyr);
        if(usd==null || sgd==null){
          skipped++;
          return;
        }

        draft.price_usd=usd;
        draft.price_sgd=sgd;
        updated++;
      });

      return {updated,skipped};
    }

    function updateSummary(){
      const count=changedIds().length;
      changedCount.textContent=count;
      saveBtn.disabled=count===0;
      resetBtn.disabled=count===0;
      saveStatus.textContent=count
        ? `${count} listing${count===1?"":"s"} with unsaved price changes.`
        : "No unsaved changes.";
    }

    function cardMatches(card){
      const q=appContext.normalizeFilterValue(search.value);
      const status=appContext.normalizeFilterValue(statusFilter.value);
      const id=String(card.id);

      if(status && appContext.normalizeFilterValue(card.availability)!==status) return false;
      if(changedOnly.checked && !isChanged(id)) return false;

      if(q){
        const hay=[card.name,card.card_code,card.game,card.series,card.year]
          .map(v=>appContext.normalizeFilterValue(v)).join(" ");
        if(!hay.includes(q)) return false;
      }
      return true;
    }

    function renderRows(){
      const visible=editableCards.filter(cardMatches);
      visibleCount.textContent=visible.length;
      empty.hidden=visible.length>0;

      rowsMount.innerHTML=visible.map(card=>{
        const id=String(card.id);
        const draft=drafts.get(id);
        const image=appContext.getImages(card)[0]||"";
        return `
          <tr class="${isChanged(id)?"changed":""}" data-bulk-price-row="${appContext.escapeHtml(id)}">
            <td>
              <div class="bulk-price-card">
                <div class="bulk-price-thumb">${image?`<img src="${appContext.escapeHtml(image)}" alt="">`:"—"}</div>
                <div>
                  <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
                  <small>${appContext.escapeHtml([card.card_code,card.year,card.series].filter(Boolean).join(" · "))}</small>
                </div>
              </div>
            </td>
            <td><input class="bulk-price-input" data-bulk-field="price_myr" data-bulk-id="${appContext.escapeHtml(id)}" inputmode="decimal" type="number" min="0" step="0.01" value="${appContext.escapeHtml(appContext.priceInputValue(draft.price_myr))}" placeholder="—"></td>
            <td><input class="bulk-price-input" data-bulk-field="price_usd" data-bulk-id="${appContext.escapeHtml(id)}" inputmode="decimal" type="number" min="0" step="0.01" value="${appContext.escapeHtml(appContext.priceInputValue(draft.price_usd))}" placeholder="—"></td>
            <td><input class="bulk-price-input" data-bulk-field="price_sgd" data-bulk-id="${appContext.escapeHtml(id)}" inputmode="decimal" type="number" min="0" step="0.01" value="${appContext.escapeHtml(appContext.priceInputValue(draft.price_sgd))}" placeholder="—"></td>
            <td><span class="bulk-price-status">${appContext.escapeHtml(card.availability||"Available")}</span></td>
          </tr>
        `;
      }).join("");

      rowsMount.querySelectorAll("[data-bulk-field]").forEach(input=>{
        input.addEventListener("input",()=>{
          const id=String(input.dataset.bulkId||"");
          const field=String(input.dataset.bulkField||"");
          const value=appContext.normalizeBulkPriceValue(input.value);
          if(Number.isNaN(value)){
            input.setCustomValidity("Enter a valid non-negative price.");
            return;
          }
          input.setCustomValidity("");
          const draft=drafts.get(id);
          if(!draft || !["price_myr","price_usd","price_sgd"].includes(field)) return;
          draft[field]=value;

          const row=input.closest("[data-bulk-price-row]");
          if(row) row.classList.toggle("changed",isChanged(id));
          updateSummary();

          if(changedOnly.checked && !isChanged(id)) renderRows();
        });
      });

      updateSummary();
    }

    [search,statusFilter].forEach(el=>{
      el.addEventListener("input",renderRows);
      el.addEventListener("change",renderRows);
    });
    changedOnly.addEventListener("change",renderRows);

    refreshFxBtn?.addEventListener("click",async()=>{
      if(!appContext.requireOwner("refresh bulk FX rates")) return;

      const originalText=refreshFxBtn.textContent;
      refreshFxBtn.disabled=true;
      refreshFxBtn.textContent="Refreshing…";
      if(fxStatus) fxStatus.textContent="Fetching the latest exchange rate…";

      try{
        const rates=await appContext.fetchCurrentMyrFxRates(true);
        if(!rates){
          if(fxStatus) fxStatus.textContent="Could not load a live exchange rate. Existing draft prices were not changed.";
          appContext.showToast("Could not refresh FX rates");
          return;
        }

        const {updated,skipped}=refreshDraftFxFromMyr(rates);
        renderRows();

        const sourceState=rates.cacheState==="stale"
          ? "cached fallback"
          : (rates.cacheState==="fresh" ? "cached" : "latest");

        if(fxStatus){
          fxStatus.textContent=
            `Updated ${updated} listing${updated===1?"":"s"} from MYR · ${skipped} without MYR skipped · ${sourceState} rate · ${appContext.fxRateDateLabel(rates)}. Review changes, then press Save Price Changes.`;
        }

        appContext.showToast(
          updated
            ? `FX refreshed for ${updated} listing${updated===1?"":"s"}`
            : "No listings with MYR prices to update"
        );
      }catch(error){
        console.error("Bulk FX refresh error:",error);
        if(fxStatus) fxStatus.textContent="Could not refresh exchange rates. Existing draft prices were not changed.";
        appContext.showToast("Could not refresh FX rates");
      }finally{
        refreshFxBtn.disabled=false;
        refreshFxBtn.textContent=originalText;
      }
    });

    resetBtn.addEventListener("click",()=>{
      editableCards.forEach(card=>{
        const id=String(card.id);
        drafts.set(id,{...original.get(id)});
      });
      renderRows();
      if(fxStatus){
        fxStatus.textContent="Uses each listing's existing MYR price to recalculate USD and SGD. Nothing is saved until you press Save Price Changes.";
      }
      appContext.showToast("Unsaved price changes cleared");
    });

    saveBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("save bulk price changes")) return;

      const ids=changedIds();
      if(!ids.length) return;

      const invalid=Array.from(rowsMount.querySelectorAll(".bulk-price-input")).find(input=>!input.checkValidity());
      if(invalid){
        invalid.reportValidity();
        return;
      }

      const originalText=saveBtn.textContent;
      saveBtn.disabled=true;
      resetBtn.disabled=true;
      let savedCount=0;
      let failedCount=0;

      try{
        for(let i=0;i<ids.length;i++){
          const id=ids[i];
          const card=appContext.getCardById(id);
          const draft=drafts.get(id);
          if(!card||!draft) continue;

          saveBtn.textContent=`Saving ${i+1}/${ids.length}…`;

          const candidate={
            ...card,
            price_myr:draft.price_myr,
            price_usd:draft.price_usd,
            price:draft.price_usd,
            price_sgd:draft.price_sgd
          };

          const saved=await appContext.updateCardStorage(candidate);
          if(saved){
            const index=appContext.cards.findIndex(c=>String(c.id)===id);
            if(index>-1) appContext.cards[index]=saved;

            const newOriginal={
              price_myr:saved.price_myr==null?null:Number(saved.price_myr),
              price_usd:(saved.price_usd ?? saved.price)==null?null:Number(saved.price_usd ?? saved.price),
              price_sgd:saved.price_sgd==null?null:Number(saved.price_sgd)
            };
            original.set(id,newOriginal);
            drafts.set(id,{...newOriginal});
            savedCount++;
          }else{
            failedCount++;
          }
        }

        saveStatus.textContent=failedCount
          ? `${savedCount} saved · ${failedCount} failed. Review failed listings and try again.`
          : `${savedCount} price update${savedCount===1?"":"s"} saved successfully.`;

        appContext.showToast(
          failedCount
            ? `Bulk prices: ${savedCount} saved · ${failedCount} failed`
            : `Saved ${savedCount} price update${savedCount===1?"":"s"}`
        );
      }finally{
        saveBtn.textContent=originalText;
        renderRows();
      }
    });

    renderRows();
  }

  Object.assign(appContext,{priceInputValue,normalizeBulkPriceValue,sameNullableNumber,renderBulkPricePage});
}
