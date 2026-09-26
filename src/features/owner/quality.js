/** V93 beta: features/owner/quality. Shared dependencies are explicit on appContext. */
export function register(appContext){
function getCardDataQualityIssues(card){
    const issues=[];
    const images=appContext.getImages(card);
    const format=appContext.normalizeFilterValue(appContext.effectiveFormat(card));
    const grades=Array.isArray(card.grading)?card.grading.filter(g=>g&&g.company):[];
    const add=(key,label,group,severity="warning")=>issues.push({key,label,group,severity});

    if(!images.length) add("image","Missing image","media","critical");

    const isNfs=appContext.normalizeFilterValue(card.availability)==="collection (nfs)";
    const hasAnyPrice=
      appContext.hasListedPrice(card.price_myr) ||
      appContext.hasListedPrice(card.price_usd ?? card.price) ||
      appContext.hasListedPrice(card.price_sgd);

    if(!isNfs){
      if(!hasAnyPrice){
        add("price","No listed price","price","critical");
      }else{
        if(!appContext.hasListedPrice(card.price_myr)) add("price-myr","Missing MYR price","price");
        if(!appContext.hasListedPrice(card.price_usd ?? card.price)) add("price-usd","Missing USD price","price");
        if(!appContext.hasListedPrice(card.price_sgd)) add("price-sgd","Missing SGD price","price");
      }
    }

    if(!String(card.card_code||"").trim()) add("card-code","Missing card code","metadata");
    if(!String(card.year||"").trim()) add("year","Missing year","metadata");
    if(!String(card.series||"").trim()) add("series","Missing series","metadata");
    if(!String(card.condition||"").trim()) add("condition","Missing condition","metadata");
    if(!String(card.language||"").trim()) add("language","Missing language","metadata");

    if(format==="graded"&&!grades.length) add("grading-entry","Marked graded but no grading entry","grading","critical");
    if(format!=="graded"&&grades.length) add("grading-format","Has grading data but format is not graded","grading");
    if(grades.some(g=>!String(g.grade||"").trim())) add("grade-value","Grading entry missing grade","grading");

    if(appContext.normalizeFilterValue(card.availability)==="sold"&&appContext.soldAtSupported&&!card.sold_at){
      add("sold-date","Sold listing missing sold date","status");
    }
    return issues;
  }

function dataQualitySummary(cardsToCheck){
    const rows=cardsToCheck.map(card=>({card,issues:appContext.getCardDataQualityIssues(card)}));
    const withIssues=rows.filter(row=>row.issues.length);
    const countKey=key=>withIssues.filter(row=>row.issues.some(issue=>issue.key===key)).length;
    const countGroup=group=>withIssues.filter(row=>row.issues.some(issue=>issue.group===group)).length;
    return {
      rows,withIssues,clean:rows.length-withIssues.length,
      missingImages:countKey("image"),
      missingPrice:countKey("price"),
      priceIssues:countGroup("price"),
      metadataIssues:countGroup("metadata"),
      gradingIssues:countGroup("grading"),
      critical:withIssues.filter(row=>row.issues.some(issue=>issue.severity==="critical")).length
    };
  }

function renderDataQualityPage(){
    if(!appContext.requireOwner("open data quality checker")) return;

    const relevantCards=appContext.cards.filter(card=>
      appContext.normalizeFilterValue(card.availability||"")!=="sold" &&
      appContext.cardLifecycle(card)!=="archived"
    );
    const summary=appContext.dataQualitySummary(relevantCards);

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Owner Tool</div>
          <h2>Inventory Data Quality</h2>
          <p>Find incomplete or inconsistent active listings before they are shared with buyers.</p>
        </div>
      </div>

      <div class="quality-summary-grid">
        <button type="button" class="quality-summary-card active" data-quality-filter="all"><strong>${summary.withIssues.length}</strong><span>Listings with issues</span><small>${relevantCards.length} active listings checked</small></button>
        <button type="button" class="quality-summary-card" data-quality-filter="critical"><strong>${summary.critical}</strong><span>Critical</span><small>Image, price or grading conflicts</small></button>
        <button type="button" class="quality-summary-card" data-quality-filter="image"><strong>${summary.missingImages}</strong><span>Missing image</span><small>Listings without photos</small></button>
        <button type="button" class="quality-summary-card" data-quality-filter="price"><strong>${summary.priceIssues}</strong><span>Price issues</span><small>${summary.missingPrice} with no price at all</small></button>
        <button type="button" class="quality-summary-card" data-quality-filter="metadata"><strong>${summary.metadataIssues}</strong><span>Metadata issues</span><small>Code, year, series, condition or language</small></button>
        <button type="button" class="quality-summary-card" data-quality-filter="grading"><strong>${summary.gradingIssues}</strong><span>Grading issues</span><small>Format and grading mismatches</small></button>
      </div>

      <div class="panel quality-panel">
        <div class="quality-toolbar">
          <div class="field quality-search-field">
            <label for="qualitySearch">Search listings</label>
            <input id="qualitySearch" type="search" maxlength="100" placeholder="Name, card code or series…">
          </div>
          <label class="quality-clean-toggle">
            <input type="checkbox" id="qualityShowClean">
            <span>Show clean listings</span>
          </label>
        </div>

        <div class="quality-status-line" id="qualityStatusLine"></div>
        <div class="quality-list" id="qualityList"></div>
        <div class="quality-empty" id="qualityEmpty" hidden>
          <strong>No matching issues.</strong>
          <span>Your current filter did not find any listings that need attention.</span>
        </div>
      </div>
    `;

    const list=appContext.$("qualityList"), empty=appContext.$("qualityEmpty"), search=appContext.$("qualitySearch");
    const showClean=appContext.$("qualityShowClean"), status=appContext.$("qualityStatusLine");
    const requestedFilter=String(appContext.currentHashParams().get("filter")||"");
    let activeFilter=["all","critical","image","price","metadata","grading"].includes(requestedFilter)
      ? requestedFilter
      : "all";

    function rowMatchesFilter(row){
      if(!row.issues.length) return showClean.checked;
      if(activeFilter==="all") return true;
      if(activeFilter==="critical") return row.issues.some(i=>i.severity==="critical");
      if(activeFilter==="image") return row.issues.some(i=>i.key==="image");
      return row.issues.some(i=>i.group===activeFilter);
    }

    function renderRows(){
      const q=appContext.normalizeFilterValue(search.value);
      const visible=summary.rows.filter(row=>{
        if(!rowMatchesFilter(row)) return false;
        if(!q) return true;
        const c=row.card;
        return [c.name,c.card_code,c.series,c.year,c.game,c.language,c.era]
          .map(v=>appContext.normalizeFilterValue(v)).join(" ").includes(q);
      });

      const issueCount=visible.filter(row=>row.issues.length).length;
      status.textContent=`Showing ${visible.length} listing${visible.length===1?"":"s"} · ${issueCount} with issue${issueCount===1?"":"s"} · ${summary.clean} clean overall`;
      empty.hidden=visible.length>0;

      list.innerHTML=visible.map(row=>{
        const card=row.card, issues=row.issues, image=appContext.getImages(card)[0]||"";
        const issueHtml=issues.length
          ? issues.map(issue=>`<span class="quality-issue ${issue.severity==="critical"?"critical":""}">${appContext.escapeHtml(issue.label)}</span>`).join("")
          : `<span class="quality-clean-badge">Clean</span>`;

        return `
          <article class="quality-row ${issues.length?"has-issues":"is-clean"}">
            <div class="quality-row-image">${image?`<img src="${appContext.escapeHtml(image)}" alt="">`:`<span>No image</span>`}</div>
            <div class="quality-row-main">
              <div class="quality-row-title">
                <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
                <span>${appContext.escapeHtml(card.availability||"Available")}</span>
              </div>
              <div class="quality-row-meta">${appContext.escapeHtml([card.card_code,card.year,card.game,card.series].filter(Boolean).join(" · ")||"No listing metadata")}</div>
              <div class="quality-row-issues">${issueHtml}</div>
            </div>
            <div class="quality-row-actions">
              <button type="button" class="btn-ghost" data-quality-view="${appContext.escapeHtml(card.id)}">View</button>
              <button type="button" class="btn-primary" data-quality-edit="${appContext.escapeHtml(card.id)}">Edit</button>
            </div>
          </article>`;
      }).join("");

      list.querySelectorAll("[data-quality-view]").forEach(btn=>btn.addEventListener("click",()=>{
        const card=appContext.getCardById(btn.dataset.qualityView);
        if(card) appContext.openCardRoute(card.id);
      }));

      list.querySelectorAll("[data-quality-edit]").forEach(btn=>btn.addEventListener("click",()=>{
        const card=appContext.getCardById(btn.dataset.qualityEdit);
        if(card&&appContext.requireOwner("edit data-quality listing")) appContext.openEditModal(card);
      }));
    }

    document.querySelectorAll("[data-quality-filter]").forEach(btn=>btn.addEventListener("click",()=>{
      activeFilter=btn.dataset.qualityFilter||"all";
      document.querySelectorAll("[data-quality-filter]").forEach(other=>other.classList.toggle("active",other===btn));
      renderRows();
    }));

    search.addEventListener("input",renderRows);
    showClean.addEventListener("change",renderRows);

    document.querySelectorAll("[data-quality-filter]").forEach(btn=>{
      btn.classList.toggle("active",btn.dataset.qualityFilter===activeFilter);
    });

    renderRows();
  }

function cloneSafeGrading(card){
    return Array.isArray(card?.grading)
      ? card.grading.filter(g=>g&&g.company).map(g=>({
          company:g.company||"PSA",
          grade:String(g.grade||""),
          // A cloned slab may intentionally represent the same physical cert/reference.
          // Preserve the cert when available, but refresh POP fields independently later.
          cert:String(g.cert||"").trim(),
          pop_count:null,
          pop_higher:null,
          pop_updated_at:null
        }))
      : [];
  }

function makeCloneDraft(card, mode="details"){
    if(!card) return null;

    const includeImages = mode==="images" || mode==="safe-all";
    const includeGrading = mode==="grading" || mode==="safe-all";

    const copiedImages = includeImages ? appContext.getImages(card).slice() : [];

    const draft = {
      ...card,
      id:"",
      availability:"Available",
      lifecycle_status:"live",
      sold_at:null,
      created_at:null,
      updated_at:null,
      view_count:0,
      featured:false,
      qty:1,
      images:copiedImages,
      image:copiedImages[0] || "",
      grading:includeGrading ? appContext.cloneSafeGrading(card) : []
    };

    [
      "user_id","owner_id","created_by","updated_by",
      "deleted_at","reserved_at","sold_to","buyer_id"
    ].forEach(key=>delete draft[key]);

    return draft;
  }

function closeCloneOptions(){
    const overlay=appContext.$("cloneOptionsOverlay");
    if(overlay) overlay.hidden=true;
    appContext.cloneSourceCard=null;
  }

function openCloneOptions(card){
    if(!appContext.requireOwner("clone card")) return;
    appContext.cloneSourceCard=card;
    const overlay=appContext.$("cloneOptionsOverlay");
    if(overlay) overlay.hidden=false;
  }

function beginCloneCard(card, mode){
    if(!appContext.requireOwner("clone card")) return;
    const allowed=new Set(["details","images","grading","safe-all"]);
    const safeMode=allowed.has(mode) ? mode : "details";
    const draft=appContext.makeCloneDraft(card,safeMode);
    if(!draft) return;

    appContext.pendingCloneCard=draft;
    appContext.closeCloneOptions();
    appContext.closeDetailsModal(false);
    location.hash="#/add?clone=1";
  }

  Object.assign(appContext,{getCardDataQualityIssues,dataQualitySummary,renderDataQualityPage,cloneSafeGrading,makeCloneDraft,closeCloneOptions,openCloneOptions,beginCloneCard});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.pendingCloneCard = null;

  appContext.cloneSourceCard = null;
}
