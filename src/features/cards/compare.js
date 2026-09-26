/** V93 beta: features/cards/compare. Shared dependencies are explicit on appContext. */
export function register(appContext){
function isCompareSelected(id){
    return appContext.compareSelectedIds.has(String(id||""));
  }

function compareSelectedCards(){
    return [...appContext.compareSelectedIds]
      .map(id=>appContext.cards.find(card=>String(card.id)===id))
      .filter(Boolean)
      .slice(0,appContext.COMPARE_MAX);
  }

function updateCompareTray(){
    const tray=appContext.$("compareTray");
    if(!tray) return;
    const selected=appContext.compareSelectedCards();
    tray.hidden=selected.length===0;
    document.body.classList.toggle("compare-tray-open",selected.length>0);
    appContext.$("compareTrayCount").textContent=`${selected.length} card${selected.length===1?"":"s"} selected`;
    appContext.$("compareOpenBtn").disabled=selected.length<2;

    document.querySelectorAll(".compare-card-btn[data-compare-id]").forEach(btn=>{
      const active=appContext.isCompareSelected(btn.dataset.compareId);
      btn.classList.toggle("active",active);
      btn.setAttribute("aria-pressed",active?"true":"false");
      const label=btn.querySelector("span");
      if(label) label.textContent=active ? "Selected" : "Compare";
    });

    // Keep the visual card highlight synchronized with the real compare state.
    // Previously clearing/cancelling Compare emptied compareSelectedIds but left
    // stale .compare-selected classes on already-rendered card tiles.
    document.querySelectorAll(".grid .card[data-card-id]").forEach(cardEl=>{
      const active=appContext.isCompareSelected(cardEl.dataset.cardId);
      cardEl.classList.toggle("compare-selected",active);
    });
  }

function toggleCompareCard(id){
    const safe=String(id||"");
    if(!appContext.safeCardId(safe)) return false;

    if(appContext.compareSelectedIds.has(safe)){
      appContext.compareSelectedIds.delete(safe);
      appContext.updateCompareTray();
      return false;
    }

    if(appContext.compareSelectedIds.size>=appContext.COMPARE_MAX){
      appContext.showToast(`You can compare up to ${appContext.COMPARE_MAX} cards`);
      return false;
    }

    if(!appContext.cards.some(card=>String(card.id)===safe)) return false;
    appContext.compareSelectedIds.add(safe);
    appContext.updateCompareTray();
    return true;
  }

function compareGradeLabel(card){
    const grades=appContext.validGradingEntries(card);
    if(grades.length) return appContext.gradingSummaryLabel(card);
    if(appContext.effectiveFormat(card)==="Sealed") return "Sealed";
    return appContext.CONDITION_LABEL[card.condition]||card.condition||"—";
  }

function comparePriceText(card){
    if(appContext.normalizeFilterValue(card?.availability)==="collection (nfs)") return "Not for sale";
    const prices=appContext.orderedCardPrices(card);
    return prices.length
      ? prices.map(p=>appContext.formatCurrencyValue(p.currency,p.value)).join(" · ")
      : "Please inquire";
  }

function closeCompareModal({clearSelection=true}={}){
    appContext.$("compareOverlay").hidden=true;
    const restore=appContext.compareLastFocusedElement;
    appContext.compareLastFocusedElement=null;
    if(restore?.isConnected) requestAnimationFrame(()=>restore.focus());

    if(clearSelection){
      appContext.compareSelectedIds.clear();
      appContext.updateCompareTray();
    }
  }

function renderCompareModal(){
    const selected=appContext.compareSelectedCards();
    if(selected.length<2){
      appContext.showToast("Select at least 2 cards to compare");
      return;
    }

    const cardHead=card=>`
      <div class="compare-card-head">
        ${appContext.getImages(card)[0]
          ? `<img src="${appContext.escapeHtml(appContext.getImages(card)[0])}" alt="${appContext.escapeHtml(card.name)}" decoding="async" fetchpriority="high">`
          : `<div class="compare-card-no-image">No image</div>`}
        <strong>${appContext.escapeHtml(card.name)}</strong>
        <small>${appContext.escapeHtml(card.card_code||"")}</small>
        <button type="button" class="compare-remove" data-compare-remove="${appContext.escapeHtml(card.id)}">Remove</button>
      </div>
    `;

    const rows=[
      ["Price",card=>appContext.comparePriceText(card)],
      ["Grade / Condition",card=>appContext.compareGradeLabel(card)],
      ["Year",card=>card.year||"—"],
      ["Game",card=>card.game||"—"],
      ["Series",card=>card.series||"—"],
      ["Language",card=>card.language||"—"],
      ["Format",card=>appContext.effectiveFormat(card)||"—"],
      ["Availability",card=>card.availability||"Available"],
      ["Images",card=>String(appContext.getImages(card).length)]
    ];

    appContext.$("compareMount").innerHTML=`
      <table class="compare-table">
        <thead>
          <tr>
            <th>Card</th>
            ${selected.map(card=>`<th>${cardHead(card)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map(([label,getValue])=>`
            <tr>
              <th>${appContext.escapeHtml(label)}</th>
              ${selected.map(card=>`<td>${appContext.escapeHtml(getValue(card))}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    appContext.$("compareMount").querySelectorAll("[data-compare-remove]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        appContext.compareSelectedIds.delete(String(btn.dataset.compareRemove||""));
        appContext.updateCompareTray();
        const remaining=appContext.compareSelectedCards();
        if(remaining.length<2){
          appContext.closeCompareModal({clearSelection:true});
        }else{
          appContext.renderCompareModal();
        }
      });
    });

    appContext.compareLastFocusedElement=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    appContext.$("compareOverlay").hidden=false;
    requestAnimationFrame(()=>appContext.$("compareCloseBtn")?.focus());
  }

function handleCompareModalKeydown(event){
    const overlay=appContext.$("compareOverlay");
    if(!overlay || overlay.hidden) return;
    if(event.key==="Escape"){
      event.preventDefault();
      appContext.closeCompareModal({clearSelection:false});
      return;
    }
    if(event.key!=="Tab") return;
    const focusable=Array.from(overlay.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter(el=>!el.hidden && getComputedStyle(el).display!=="none");
    if(!focusable.length) return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey && document.activeElement===first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement===last){ event.preventDefault(); first.focus(); }
  }

  if(typeof document!=="undefined") document.addEventListener("keydown",handleCompareModalKeydown);
  Object.assign(appContext,{isCompareSelected,compareSelectedCards,updateCompareTray,toggleCompareCard,compareGradeLabel,comparePriceText,closeCompareModal,renderCompareModal,handleCompareModalKeydown});
}
