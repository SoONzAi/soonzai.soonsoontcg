/** V93 beta: features/owner/lifecycle. Shared dependencies are explicit on appContext. */
export function register(appContext){
function lifecycleCardRowHTML(card,status){
    const image=appContext.getImages(card)[0]||"";
    const meta=[card.card_code,card.year,card.game,card.series].filter(Boolean).join(" · ");
    return `
      <article class="lifecycle-row">
        <div class="lifecycle-thumb">
          ${image ? `<img src="${appContext.escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : "—"}
        </div>
        <div class="lifecycle-main">
          <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
          <span>${appContext.escapeHtml(meta)}</span>
          <small>${status==="draft" ? "Owner-only draft" : "Archived and hidden from visitors"}</small>
        </div>
        <div class="lifecycle-actions">
          <button type="button" class="btn-ghost" data-life-edit="${appContext.escapeHtml(card.id)}">Edit</button>
          ${status==="draft"
            ? `<button type="button" class="btn-primary" data-life-publish="${appContext.escapeHtml(card.id)}">Publish</button>
               <button type="button" class="btn-ghost" data-life-archive="${appContext.escapeHtml(card.id)}">Archive</button>`
            : `<button type="button" class="btn-primary" data-life-restore="${appContext.escapeHtml(card.id)}">Restore to Draft</button>`}
        </div>
      </article>
    `;
  }

function renderLifecycleManagerPage(){
    if(!appContext.requireOwner("open lifecycle manager")) return;

    if(!appContext.lifecycleSupported){
      appContext.view.innerHTML=`
        <div class="page-head">
          <div><div class="eyebrow">Inventory Tools · Lifecycle</div><h2>Drafts & Archive</h2>
          <p>Secure draft/archive support requires the supplied Supabase migration.</p></div>
        </div>
        <div class="panel lifecycle-migration-needed">
          <strong>Migration required</strong>
          <span>Do not simulate drafts only in the browser. Database RLS must hide draft and archived rows from non-owners.</span>
        </div>`;
      return;
    }

    const drafts=appContext.cards.filter(c=>appContext.cardLifecycle(c)==="draft");
    const archived=appContext.cards.filter(c=>appContext.cardLifecycle(c)==="archived");

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Lifecycle</div>
          <h2>Drafts & Archive</h2>
          <p>Drafts and archived listings are owner-only and protected by database RLS.</p>
        </div>
      </div>

      <div class="lifecycle-stats">
        <div><strong>${drafts.length}</strong><span>Drafts</span></div>
        <div><strong>${archived.length}</strong><span>Archived</span></div>
      </div>

      <section class="panel lifecycle-section">
        <div class="lifecycle-section-head"><h3>Draft Listings</h3><span>Publish only after review.</span></div>
        <div class="lifecycle-list">${drafts.length ? drafts.map(c=>appContext.lifecycleCardRowHTML(c,"draft")).join("") : `<div class="hint">No drafts.</div>`}</div>
      </section>

      <section class="panel lifecycle-section">
        <div class="lifecycle-section-head"><h3>Archive</h3><span>Restore to Draft before publishing again.</span></div>
        <div class="lifecycle-list">${archived.length ? archived.map(c=>appContext.lifecycleCardRowHTML(c,"archived")).join("") : `<div class="hint">Nothing archived.</div>`}</div>
      </section>
    `;

    appContext.view.querySelectorAll("[data-life-edit]").forEach(btn=>btn.addEventListener("click",()=>{
      const card=appContext.getCardById(btn.dataset.lifeEdit);
      if(card) appContext.openEditModal(card);
    }));

    appContext.view.querySelectorAll("[data-life-publish]").forEach(btn=>btn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("publish draft")) return;
      const card=appContext.getCardById(btn.dataset.lifePublish);
      if(!card) return;
      if(!confirm(`Publish "${card.name}"? It will become visible to normal visitors immediately.`)) return;
      if(await appContext.setCardLifecycle(card,"live")){
        appContext.showToast("Draft published");
        appContext.renderInventoryToolsPage();
      }
    }));

    appContext.view.querySelectorAll("[data-life-archive]").forEach(btn=>btn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("archive draft")) return;
      const card=appContext.getCardById(btn.dataset.lifeArchive);
      if(!card) return;
      if(!confirm(`Archive "${card.name}"?`)) return;
      if(await appContext.setCardLifecycle(card,"archived")){
        appContext.showToast("Draft archived");
        appContext.renderInventoryToolsPage();
      }
    }));

    appContext.view.querySelectorAll("[data-life-restore]").forEach(btn=>btn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("restore archived listing")) return;
      const card=appContext.getCardById(btn.dataset.lifeRestore);
      if(!card) return;
      if(await appContext.setCardLifecycle(card,"draft")){
        appContext.showToast("Restored to Draft");
        appContext.renderInventoryToolsPage();
      }
    }));
  }

function duplicateGradeKey(card){
    const grades=Array.isArray(card.grading)?card.grading.filter(g=>g&&g.company):[];
    if(grades.length){
      return `${String(grades[0].company).trim().toUpperCase()} ${String(grades[0].grade||"").trim()}`.trim();
    }
    return `${appContext.effectiveFormat(card)} ${card.condition||""}`.trim();
  }

function duplicateFingerprint(card){
    const code=appContext.normalizeFilterValue(card.card_code||"");
    const name=appContext.normalizeFilterValue(card.name||"");
    const series=appContext.normalizeFilterValue(card.series||"");
    const lang=appContext.normalizeFilterValue(card.language||"");
    const grade=appContext.normalizeFilterValue(appContext.duplicateGradeKey(card));
    const year=String(card.year||"").trim();

    if(code) return `code|${code}|${lang}|${grade}|${year}`;
    if(name) return `name|${name}|${series}|${lang}|${grade}|${year}`;
    return "";
  }

function findDuplicateGroups(){
    const buckets=new Map();
    appContext.cards
      .filter(c=>appContext.cardLifecycle(c)!=="archived")
      .forEach(card=>{
        const key=appContext.duplicateFingerprint(card);
        if(!key) return;
        if(!buckets.has(key)) buckets.set(key,[]);
        buckets.get(key).push(card);
      });

    return [...buckets.values()]
      .filter(group=>group.length>1)
      .sort((a,b)=>b.length-a.length || String(a[0]?.name||"").localeCompare(String(b[0]?.name||"")));
  }

function renderDuplicateDetectorPage(){
    if(!appContext.requireOwner("open duplicate detector")) return;

    const groups=appContext.findDuplicateGroups();
    const cardsInGroups=groups.reduce((sum,g)=>sum+g.length,0);

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Quality</div>
          <h2>Duplicate Card Detector</h2>
          <p>Flags likely duplicates using card code/name, language, grade/condition and year. It never deletes or merges automatically.</p>
        </div>
      </div>

      <div class="duplicate-summary">
        <div><strong>${groups.length}</strong><span>Possible duplicate groups</span></div>
        <div><strong>${cardsInGroups}</strong><span>Listings to review</span></div>
      </div>

      <div class="duplicate-groups">
        ${groups.length ? groups.map((group,index)=>`
          <section class="panel duplicate-group">
            <div class="duplicate-group-head">
              <strong>Group ${index+1}</strong>
              <span>${appContext.escapeHtml(group[0]?.card_code || group[0]?.name || "Possible duplicate")}</span>
            </div>
            ${group.map(card=>`
              <div class="duplicate-row">
                <div>
                  <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
                  <span>${appContext.escapeHtml([card.card_code,appContext.duplicateGradeKey(card),card.language,card.year,appContext.cardLifecycle(card)].filter(Boolean).join(" · "))}</span>
                </div>
                <div class="duplicate-actions">
                  <button type="button" class="btn-ghost" data-duplicate-view="${appContext.escapeHtml(card.id)}">View</button>
                  <button type="button" class="btn-primary" data-duplicate-edit="${appContext.escapeHtml(card.id)}">Edit</button>
                </div>
              </div>
            `).join("")}
          </section>
        `).join("") : `<div class="panel"><div class="hint">No likely duplicates found.</div></div>`}
      </div>
    `;

    appContext.view.querySelectorAll("[data-duplicate-view]").forEach(btn=>btn.addEventListener("click",()=>{
      const card=appContext.getCardById(btn.dataset.duplicateView);
      if(card) appContext.openCardRoute(card.id);
    }));
    appContext.view.querySelectorAll("[data-duplicate-edit]").forEach(btn=>btn.addEventListener("click",()=>{
      const card=appContext.getCardById(btn.dataset.duplicateEdit);
      if(card) appContext.openEditModal(card);
    }));
  }

function historyChangedFields(entry){
    const before=entry?.before_data||{};
    const after=entry?.after_data||{};
    const keys=new Set([...Object.keys(before),...Object.keys(after)]);
    const ignored=new Set(["updated_at"]);
    return [...keys]
      .filter(key=>!ignored.has(key))
      .filter(key=>JSON.stringify(before[key]??null)!==JSON.stringify(after[key]??null))
      .slice(0,12);
  }

function historyCardLabel(entry){
    const data=entry?.after_data||entry?.before_data||{};
    return data.name || appContext.getCardById(entry.card_id)?.name || "Card";
  }

async function fetchEditHistory(){
    if(!appContext.requireOwner("read edit history") || !appContext.editHistorySupported) return [];
    const {data,error}=await appContext.supabaseClient
      .from("card_edit_history")
      .select("id,card_id,action,edited_at,editor_id,before_data,after_data")
      .order("edited_at",{ascending:false})
      .limit(100);
    if(error){
      console.error("Edit history error:",error);
      return [];
    }
    return Array.isArray(data)?data:[];
  }

async function undoHistoryEntry(entry){
    if(!appContext.requireOwner("undo recent edit")) return false;
    if(!entry) return false;

    if(entry.action==="private_update"){
      const before=entry.before_data||{};
      return appContext.saveOwnerPrivateMeta(
        entry.card_id,
        Array.isArray(before.tags)?before.tags:[],
        String(before.notes||"")
      );
    }

    if(entry.action==="card_update"){
      const before=entry.before_data||{};
      if(!before.id || String(before.id)!==String(entry.card_id)) return false;
      const candidate=appContext.dbToCard(before);
      const saved=await appContext.updateCardStorage(candidate);
      if(!saved) return false;
      const index=appContext.cards.findIndex(c=>String(c.id)===String(saved.id));
      if(index>-1) appContext.cards[index]=saved;
      return true;
    }

    return false;
  }

async function renderEditHistoryPage(){
    if(!appContext.requireOwner("open edit history")) return;

    if(!appContext.editHistorySupported){
      appContext.view.innerHTML=`
        <div class="page-head">
          <div><div class="eyebrow">Inventory Tools · Activity</div><h2>Edit History</h2>
          <p>History and undo require the supplied owner-history migration.</p></div>
        </div>
        <div class="panel lifecycle-migration-needed"><strong>Migration required</strong><span>The history table is owner-only and protected by RLS.</span></div>`;
      return;
    }

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Activity</div>
          <h2>Edit History</h2>
          <p>Up to 100 recent changes. Undo is deliberately restricted to the latest change of the same type for each card.</p>
        </div>
      </div>
      <div class="panel history-loading">Loading edit history…</div>
    `;

    const rows=await appContext.fetchEditHistory();
    const latestByKey=new Map();
    rows.forEach(row=>{
      const key=`${row.card_id}|${row.action}`;
      if(!latestByKey.has(key)) latestByKey.set(key,row.id);
    });

    const loading=appContext.view.querySelector(".history-loading");
    if(!loading) return;

    const holder=document.createElement("div");
    holder.className="history-list";
    holder.innerHTML=rows.length ? rows.map(row=>{
      const fields=appContext.historyChangedFields(row);
      const latest=latestByKey.get(`${row.card_id}|${row.action}`)===row.id;
      return `
        <article class="history-row">
          <div class="history-main">
            <strong>${appContext.escapeHtml(appContext.historyCardLabel(row))}</strong>
            <span>${row.action==="private_update" ? "Private tags/notes" : "Card listing"} · ${appContext.escapeHtml(appContext.formatOwnerTimestamp(row.edited_at))}</span>
            <small>${fields.length ? `Changed: ${appContext.escapeHtml(fields.join(", "))}` : "Change recorded"}</small>
          </div>
          <div class="history-actions">
            <button type="button" class="btn-ghost" data-history-view="${appContext.escapeHtml(row.card_id||"")}">View</button>
            <button type="button" class="btn-primary" data-history-undo="${row.id}" ${latest ? "" : "disabled"}>${latest ? "Undo" : "Older change"}</button>
          </div>
        </article>
      `;
    }).join("") : `<div class="panel"><div class="hint">No edit history yet.</div></div>`;

    loading.replaceWith(holder);

    holder.querySelectorAll("[data-history-view]").forEach(btn=>btn.addEventListener("click",()=>{
      const card=appContext.getCardById(btn.dataset.historyView);
      if(card) appContext.openCardRoute(card.id);
      else appContext.showToast("Card is no longer loaded");
    }));

    holder.querySelectorAll("[data-history-undo]:not([disabled])").forEach(btn=>btn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("undo recent edit")) return;
      const entry=rows.find(row=>String(row.id)===String(btn.dataset.historyUndo));
      if(!entry) return;
      if(!confirm(`Undo the latest ${entry.action==="private_update" ? "private metadata" : "listing"} change for "${appContext.historyCardLabel(entry)}"?`)) return;
      btn.disabled=true;
      btn.textContent="Undoing…";
      const ok=await appContext.undoHistoryEntry(entry);
      if(ok){
        appContext.showToast("Change undone");
        appContext.renderInventoryToolsPage();
      }else{
        btn.disabled=false;
        btn.textContent="Undo";
      }
    }));
  }

function imageHealthSourceType(src){
    const raw=String(src||"").trim();
    if(!raw) return "missing";
    if(raw.startsWith("data:image/")) return "embedded";
    try{
      const u=new URL(raw,location.href);
      return u.origin===location.origin ? "same-origin" : "external";
    }catch{
      return "invalid-url";
    }
  }

function checkImageHealthSource(src,timeoutMs=8000){
    return new Promise(resolve=>{
      const raw=String(src||"").trim();
      if(!raw){
        resolve({ok:false,width:0,height:0,reason:"Missing image URL"});
        return;
      }

      let done=false;
      const finish=result=>{
        if(done) return;
        done=true;
        clearTimeout(timer);
        resolve(result);
      };

      const img=new Image();
      img.referrerPolicy="no-referrer";
      img.decoding="async";

      img.onload=()=>{
        const width=Number(img.naturalWidth||0);
        const height=Number(img.naturalHeight||0);
        finish({ok:true,width,height,reason:""});
      };
      img.onerror=()=>finish({ok:false,width:0,height:0,reason:"Image failed to load"});

      const timer=setTimeout(()=>finish({
        ok:false,width:0,height:0,reason:"Image check timed out"
      }),timeoutMs);

      img.src=raw;
    });
  }

function imageHealthIssuesForCard(card,checks){
    const images=appContext.getImages(card);
    const issues=[];

    if(!images.length){
      issues.push({key:"missing",label:"No images",severity:"critical"});
      return issues;
    }

    if(images.length===1){
      issues.push({key:"single",label:"Only 1 image",severity:"warning"});
    }

    checks.forEach((check,index)=>{
      if(!check.ok){
        issues.push({
          key:"broken",
          label:`Image ${index+1}: ${check.reason||"Failed"}`,
          severity:"critical"
        });
        return;
      }

      const minSide=Math.min(check.width||0,check.height||0);
      const maxSide=Math.max(check.width||0,check.height||0);

      if(minSide>0 && minSide<500){
        issues.push({
          key:"small",
          label:`Image ${index+1}: small (${check.width}×${check.height})`,
          severity:"warning"
        });
      }else if(maxSide>0 && maxSide<800){
        issues.push({
          key:"small",
          label:`Image ${index+1}: low resolution (${check.width}×${check.height})`,
          severity:"warning"
        });
      }

      const sourceType=appContext.imageHealthSourceType(images[index]);
      if(sourceType==="external"){
        issues.push({
          key:"external",
          label:`Image ${index+1}: external source`,
          severity:"info"
        });
      }else if(sourceType==="invalid-url"){
        issues.push({
          key:"broken",
          label:`Image ${index+1}: invalid URL`,
          severity:"critical"
        });
      }
    });

    return issues;
  }

function renderImageHealthPage(fromInventoryTools=false){
    if(!appContext.requireOwner("open image health checker")) return;

    const activeCards=appContext.cards.filter(card=>
      appContext.normalizeFilterValue(card.availability||"Available")!=="sold" &&
      appContext.cardLifecycle(card)!=="archived"
    );

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Image Audit</div>
          <h2>Image Health Checker</h2>
          <p>Check active listings for missing, broken, single-photo, low-resolution or externally hosted images.</p>
        </div>
      </div>

      <div class="image-health-summary">
        <button type="button" class="image-health-summary-card active" data-image-health-filter="issues">
          <strong id="imageHealthIssuesCount">—</strong>
          <span>Listings with issues</span>
        </button>
        <button type="button" class="image-health-summary-card" data-image-health-filter="broken">
          <strong id="imageHealthBrokenCount">—</strong>
          <span>Broken images</span>
        </button>
        <button type="button" class="image-health-summary-card" data-image-health-filter="single">
          <strong id="imageHealthSingleCount">—</strong>
          <span>Only one image</span>
        </button>
        <button type="button" class="image-health-summary-card" data-image-health-filter="small">
          <strong id="imageHealthSmallCount">—</strong>
          <span>Low resolution</span>
        </button>
        <button type="button" class="image-health-summary-card" data-image-health-filter="external">
          <strong id="imageHealthExternalCount">—</strong>
          <span>External source</span>
        </button>
      </div>

      <div class="panel image-health-panel">
        <div class="image-health-toolbar">
          <div class="field">
            <label for="imageHealthSearch">Search</label>
            <input id="imageHealthSearch" type="search" maxlength="100" placeholder="Name, code, game or series…">
          </div>
          <button type="button" class="btn-primary" id="imageHealthRunBtn">Run Image Check</button>
        </div>

        <div class="image-health-note">
          <strong>Watermark note</strong>
          <span>Browser security prevents reliable pixel-level watermark detection for many external images. External images are flagged for manual review instead of being incorrectly labeled as unwatermarked.</span>
        </div>

        <div class="image-health-progress" id="imageHealthProgress">Ready to scan ${activeCards.length} active listing${activeCards.length===1?"":"s"}.</div>
        <div class="image-health-list" id="imageHealthList"></div>
        <div class="image-health-empty" id="imageHealthEmpty" hidden>No matching image issues.</div>
      </div>
    `;

    const results=new Map();
    const search=appContext.$("imageHealthSearch");
    const runBtn=appContext.$("imageHealthRunBtn");
    const progress=appContext.$("imageHealthProgress");
    const list=appContext.$("imageHealthList");
    const empty=appContext.$("imageHealthEmpty");
    const requestedFilter=String(appContext.currentHashParams().get("filter")||"");
    let activeFilter=["issues","broken","single","small","external"].includes(requestedFilter)
      ? requestedFilter
      : "issues";
    let scanComplete=false;

    function summaryCount(key){
      let count=0;
      results.forEach(result=>{
        if(key==="issues" && result.issues.length) count++;
        else if(result.issues.some(issue=>issue.key===key)) count++;
      });
      return count;
    }

    function updateSummary(){
      appContext.$("imageHealthIssuesCount").textContent=scanComplete ? summaryCount("issues") : "—";
      appContext.$("imageHealthBrokenCount").textContent=scanComplete ? summaryCount("broken") : "—";
      appContext.$("imageHealthSingleCount").textContent=scanComplete ? summaryCount("single") : "—";
      appContext.$("imageHealthSmallCount").textContent=scanComplete ? summaryCount("small") : "—";
      appContext.$("imageHealthExternalCount").textContent=scanComplete ? summaryCount("external") : "—";
    }

    function matchesFilter(result){
      if(!scanComplete) return false;
      if(activeFilter==="issues") return result.issues.length>0;
      return result.issues.some(issue=>issue.key===activeFilter);
    }

    function renderResults(){
      if(!scanComplete){
        list.innerHTML="";
        empty.hidden=true;
        return;
      }

      const q=appContext.normalizeFilterValue(search.value);
      const visible=activeCards.map(card=>results.get(String(card.id))).filter(Boolean).filter(result=>{
        if(!matchesFilter(result)) return false;
        if(!q) return true;
        const c=result.card;
        return [c.name,c.card_code,c.game,c.series,c.year,c.language]
          .map(v=>appContext.normalizeFilterValue(v)).join(" ").includes(q);
      });

      empty.hidden=visible.length>0;
      list.innerHTML=visible.map(result=>{
        const card=result.card;
        const images=appContext.getImages(card);
        const first=images[0]||"";
        const issueMarkup=result.issues.map(issue=>`
          <span class="image-health-issue ${issue.severity}">
            ${appContext.escapeHtml(issue.label)}
          </span>
        `).join("");

        const dimensionMarkup=result.checks.length
          ? result.checks.map((check,i)=>check.ok
              ? `<span>${i+1}: ${check.width}×${check.height}</span>`
              : `<span>${i+1}: unavailable</span>`
            ).join("")
          : `<span>No image dimensions</span>`;

        return `
          <article class="image-health-row">
            <div class="image-health-thumb">${first?`<img src="${appContext.escapeHtml(first)}" alt="">`:"—"}</div>
            <div class="image-health-main">
              <div class="image-health-title">
                <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
                <span>${appContext.escapeHtml(card.availability||"Available")}</span>
              </div>
              <div class="image-health-meta">${appContext.escapeHtml([card.card_code,card.year,card.game,card.series].filter(Boolean).join(" · "))}</div>
              <div class="image-health-dimensions">${dimensionMarkup}</div>
              <div class="image-health-issues">${issueMarkup}</div>
            </div>
            <div class="image-health-actions">
              <button type="button" class="btn-ghost" data-image-health-view="${appContext.escapeHtml(card.id)}">View</button>
              <button type="button" class="btn-primary" data-image-health-edit="${appContext.escapeHtml(card.id)}">Edit Images</button>
            </div>
          </article>
        `;
      }).join("");

      list.querySelectorAll("[data-image-health-view]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const card=appContext.getCardById(btn.dataset.imageHealthView);
          if(card) appContext.openCardRoute(card.id);
        });
      });

      list.querySelectorAll("[data-image-health-edit]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          if(!appContext.requireOwner("edit image health listing")) return;
          const card=appContext.getCardById(btn.dataset.imageHealthEdit);
          if(card) appContext.openEditModal(card);
        });
      });
    }

    async function runScan(){
      if(!appContext.requireOwner("run image health check")) return;

      runBtn.disabled=true;
      runBtn.textContent="Checking…";
      results.clear();
      scanComplete=false;
      updateSummary();
      renderResults();

      let checkedImages=0;
      const totalImages=activeCards.reduce((sum,card)=>sum+appContext.getImages(card).length,0);

      try{
        for(let i=0;i<activeCards.length;i++){
          const card=activeCards[i];
          const images=appContext.getImages(card);
          const checks=[];

          for(const src of images){
            const check=await appContext.checkImageHealthSource(src);
            checks.push(check);
            checkedImages++;
            progress.textContent=`Checking listing ${i+1}/${activeCards.length} · image ${checkedImages}/${Math.max(totalImages,checkedImages)}`;
          }

          const issues=appContext.imageHealthIssuesForCard(card,checks);
          results.set(String(card.id),{card,checks,issues});
        }

        scanComplete=true;
        updateSummary();
        renderResults();

        const issueCount=summaryCount("issues");
        appContext.saveStoredImageHealthSummary({
          issues:issueCount,
          broken:summaryCount("broken"),
          single:summaryCount("single"),
          small:summaryCount("small"),
          external:summaryCount("external")
        });
        progress.textContent=`Scan complete · ${activeCards.length} listings · ${issueCount} with image issues.`;
        appContext.showToast(`Image check complete · ${issueCount} listing${issueCount===1?"":"s"} need review`);
      }finally{
        runBtn.disabled=false;
        runBtn.textContent="Run Image Check";
      }
    }

    document.querySelectorAll("[data-image-health-filter]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        activeFilter=String(btn.dataset.imageHealthFilter||"issues");
        document.querySelectorAll("[data-image-health-filter]").forEach(other=>{
          other.classList.toggle("active",other===btn);
        });
        renderResults();
      });
    });

    search.addEventListener("input",renderResults);
    runBtn.addEventListener("click",runScan);

    document.querySelectorAll("[data-image-health-filter]").forEach(btn=>{
      btn.classList.toggle("active",btn.dataset.imageHealthFilter===activeFilter);
    });

    updateSummary();
  }

  Object.assign(appContext,{lifecycleCardRowHTML,renderLifecycleManagerPage,duplicateGradeKey,duplicateFingerprint,findDuplicateGroups,renderDuplicateDetectorPage,historyChangedFields,historyCardLabel,fetchEditHistory,undoHistoryEntry,renderEditHistoryPage,imageHealthSourceType,checkImageHealthSource,imageHealthIssuesForCard,renderImageHealthPage});
}
