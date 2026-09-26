/** V93 beta: features/content/giveaway-pages. Shared dependencies are explicit on appContext. */
export function register(appContext){
function sortedPastGiveawayWinners(){
    return appContext.giveaways
      .filter(appContext.isPastGiveawayWinner)
      .slice()
      .sort((a,b)=>{
        const aOrder=Number.isFinite(Number(a.winner_sort_order))
          ? Number(a.winner_sort_order)
          : Number.POSITIVE_INFINITY;
        const bOrder=Number.isFinite(Number(b.winner_sort_order))
          ? Number(b.winner_sort_order)
          : Number.POSITIVE_INFINITY;

        if(aOrder!==bOrder) return aOrder-bOrder;

        return String(b.gave_away_date||b.winner_announced_at||b.created_at||"")
          .localeCompare(String(a.gave_away_date||a.winner_announced_at||a.created_at||""));
      });
  }

async function persistGiveawayWinnerOrder(orderedWinners){
    if(!appContext.requireOwner("reorder giveaway winners")) return false;

    if(appContext.giveawayWinnerSortOrderSupported===false){
      appContext.showToast("Run the giveaway winner-order migration first");
      return false;
    }

    const updates=orderedWinners.map((winner,index)=>
      appContext.supabaseClient
        .from("giveaways")
        .update({winner_sort_order:index})
        .eq("id",winner.id)
    );

    const results=await Promise.all(updates);
    const failed=results.find(result=>result.error);

    if(failed){
      if(appContext.optionalColumnUnavailable(failed.error,"winner_sort_order")){
        appContext.giveawayWinnerSortOrderSupported=false;
        appContext.showToast("Run the giveaway winner-order migration first");
      }else{
        console.error("Reorder giveaway winners error:",failed.error);
        appContext.showToast("Could not save winner order");
      }
      return false;
    }

    appContext.giveawayWinnerSortOrderSupported=true;

    // Keep the in-memory order immediately consistent.
    orderedWinners.forEach((winner,index)=>{
      const local=appContext.giveaways.find(g=>String(g.id)===String(winner.id));
      if(local) local.winner_sort_order=index;
    });

    return true;
  }

function currentWinnerOrderFromDom(){
    const container=appContext.$("pastWinnersGrid");
    if(!container) return [];

    const ids=[...container.querySelectorAll("[data-giveaway-winner-card]")]
      .map(card=>String(card.dataset.giveawayWinnerCard||""))
      .filter(Boolean);

    const byId=new Map(
      appContext.giveaways
        .filter(appContext.isPastGiveawayWinner)
        .map(g=>[String(g.id),g])
    );

    return ids.map(id=>byId.get(id)).filter(Boolean);
  }

async function saveGiveawayWinnerDomOrder(){
    const ordered=appContext.currentWinnerOrderFromDom();
    if(!ordered.length) return false;

    const ok=await appContext.persistGiveawayWinnerOrder(ordered);
    if(ok) appContext.showToast("Winner order updated");
    return ok;
  }

function setupGiveawayWinnerRearrangeMode(){
    if(!appContext.isOwnerMode()) return;

    const container=appContext.$("pastWinnersGrid");
    const toggleBtn=appContext.$("toggleWinnerRearrangeBtn");
    if(!container || !toggleBtn) return;

    let rearrangeMode=false;
    let draggedCard=null;
    let pointerId=null;
    let originalOrder="";
    let dragOffsetX=0;
    let dragOffsetY=0;
    let placeholder=null;

    const cards=()=>[...container.querySelectorAll("[data-giveaway-winner-card]")];

    function orderKey(){
      return cards()
        .map(card=>String(card.dataset.giveawayWinnerCard||""))
        .join("|");
    }

    function setMode(enabled){
      rearrangeMode=!!enabled;
      container.classList.toggle("giveaway-rearrange-mode",rearrangeMode);
      toggleBtn.classList.toggle("active",rearrangeMode);
      toggleBtn.setAttribute("aria-pressed",String(rearrangeMode));
      toggleBtn.textContent=rearrangeMode ? "Done Rearranging" : "Rearrange Winners";

      cards().forEach(card=>{
        card.classList.toggle("giveaway-reorder-enabled",rearrangeMode);
        card.setAttribute("aria-grabbed","false");
      });

      if(rearrangeMode){
        appContext.showToast("Rearrange mode on — drag any winner card");
      }
    }

    function cleanupDrag(){
      if(draggedCard){
        draggedCard.classList.remove("giveaway-winner-pointer-dragging");
        draggedCard.style.position="";
        draggedCard.style.left="";
        draggedCard.style.top="";
        draggedCard.style.width="";
        draggedCard.style.height="";
        draggedCard.style.zIndex="";
        draggedCard.style.pointerEvents="";
        draggedCard.style.margin="";
        draggedCard.setAttribute("aria-grabbed","false");
      }

      if(placeholder?.parentNode){
        placeholder.replaceWith(draggedCard);
      }

      draggedCard=null;
      placeholder=null;
      pointerId=null;
      container.classList.remove("giveaway-rearranging-active");
      document.body.classList.remove("giveaway-rearranging-body");
    }

    async function finishDrag(){
      if(!draggedCard) return;

      const card=draggedCard;

      if(placeholder?.parentNode){
        placeholder.replaceWith(card);
      }

      card.classList.remove("giveaway-winner-pointer-dragging");
      card.style.position="";
      card.style.left="";
      card.style.top="";
      card.style.width="";
      card.style.height="";
      card.style.zIndex="";
      card.style.pointerEvents="";
      card.style.margin="";
      card.setAttribute("aria-grabbed","false");

      container.classList.remove("giveaway-rearranging-active");
      document.body.classList.remove("giveaway-rearranging-body");

      const newOrder=orderKey();
      const changed=originalOrder && newOrder!==originalOrder;

      draggedCard=null;
      placeholder=null;
      pointerId=null;
      originalOrder="";

      if(changed){
        const ok=await appContext.saveGiveawayWinnerDomOrder();
        if(!ok){
          await appContext.loadGiveaways();
          appContext.renderGiveawayPage();
        }
      }
    }

    function findDropTarget(x,y){
      const candidates=cards().filter(card=>card!==draggedCard);
      if(!candidates.length) return null;

      let nearest=null;
      let nearestDistance=Infinity;

      for(const card of candidates){
        const rect=card.getBoundingClientRect();
        const cx=rect.left+rect.width/2;
        const cy=rect.top+rect.height/2;
        const distance=Math.hypot(x-cx,y-cy);

        if(distance<nearestDistance){
          nearestDistance=distance;
          nearest={card,rect,cx,cy};
        }
      }

      return nearest;
    }

    container.addEventListener("pointerdown",event=>{
      if(!rearrangeMode) return;
      if(event.button!==undefined && event.button!==0) return;

      const card=event.target?.closest?.("[data-giveaway-winner-card]");
      if(!card || !container.contains(card)) return;

      // In rearrange mode, the whole card is the drag surface.
      event.preventDefault();

      const rect=card.getBoundingClientRect();
      originalOrder=orderKey();
      draggedCard=card;
      pointerId=event.pointerId;
      dragOffsetX=event.clientX-rect.left;
      dragOffsetY=event.clientY-rect.top;

      placeholder=document.createElement("div");
      placeholder.className="giveaway-winner-placeholder";
      placeholder.style.width=`${rect.width}px`;
      placeholder.style.height=`${rect.height}px`;

      card.replaceWith(placeholder);
      document.body.appendChild(card);

      card.classList.add("giveaway-winner-pointer-dragging");
      card.setAttribute("aria-grabbed","true");
      card.style.position="fixed";
      card.style.left=`${rect.left}px`;
      card.style.top=`${rect.top}px`;
      card.style.width=`${rect.width}px`;
      card.style.height=`${rect.height}px`;
      card.style.zIndex="99999";
      card.style.pointerEvents="none";
      card.style.margin="0";

      container.classList.add("giveaway-rearranging-active");
      document.body.classList.add("giveaway-rearranging-body");

      try{
        container.setPointerCapture(pointerId);
      }catch{}
    });

    container.addEventListener("pointermove",event=>{
      if(!draggedCard || event.pointerId!==pointerId) return;

      event.preventDefault();

      draggedCard.style.left=`${event.clientX-dragOffsetX}px`;
      draggedCard.style.top=`${event.clientY-dragOffsetY}px`;

      const nearest=findDropTarget(event.clientX,event.clientY);
      if(!nearest || !placeholder) return;

      const {card,rect,cx,cy}=nearest;

      // Decide before/after using the dominant axis of the grid position.
      const horizontalBias=Math.abs(event.clientX-cx) > Math.abs(event.clientY-cy);
      const before=horizontalBias
        ? event.clientX<cx
        : event.clientY<cy;

      const reference=before ? card : card.nextSibling;

      if(reference!==placeholder){
        container.insertBefore(placeholder,reference);
      }
    });

    container.addEventListener("pointerup",event=>{
      if(!draggedCard || event.pointerId!==pointerId) return;
      event.preventDefault();
      finishDrag();
    });

    container.addEventListener("pointercancel",event=>{
      if(!draggedCard || event.pointerId!==pointerId) return;
      cleanupDrag();
      appContext.renderGiveawayPage();
    });

    toggleBtn.addEventListener("click",()=>{
      if(draggedCard) return;
      setMode(!rearrangeMode);
    });
  }

function giveawayPublicImages(g){
    const out=[];
    const add=value=>{
      const url=appContext.safeHttpUrl(value||"");
      if(url && !out.includes(url)) out.push(url);
    };
    if(Array.isArray(g?.images)) g.images.forEach(add);
    add(g?.image_url);
    return out.slice(0,appContext.GIVEAWAY_PHOTO_LIMIT);
  }

function giveawayGalleryHTML(g){
    const images=appContext.giveawayPublicImages(g);
    if(!images.length) return "";
    const id=appContext.escapeHtml(String(g.id||""));
    const alt=appContext.escapeHtml(appContext.giveawayDisplayTitle(g.card_name||g.title||"Giveaway"));

    return `
      <div class="giveaway-gallery"
           data-giveaway-gallery="${id}"
           data-giveaway-gallery-index="0">
        <div class="giveaway-gallery-stage">
          <img src="${appContext.escapeHtml(images[0])}"
               alt="${alt}"
               loading="lazy"
               decoding="async"
               data-giveaway-gallery-image>
          ${images.length>1 ? `
            <button type="button"
                    class="giveaway-gallery-nav giveaway-gallery-prev"
                    data-giveaway-gallery-step="-1"
                    aria-label="Previous giveaway photo">‹</button>
            <button type="button"
                    class="giveaway-gallery-nav giveaway-gallery-next"
                    data-giveaway-gallery-step="1"
                    aria-label="Next giveaway photo">›</button>
            <span class="giveaway-gallery-count" data-giveaway-gallery-count>1 / ${images.length}</span>
          ` : ""}
        </div>
        ${images.length>1 ? `
          <div class="giveaway-gallery-thumbs">
            ${images.map((url,index)=>`
              <button type="button"
                      class="giveaway-gallery-thumb ${index===0?"active":""}"
                      data-giveaway-gallery-go="${index}"
                      aria-label="Show giveaway photo ${index+1}">
                <img src="${appContext.escapeHtml(url)}" alt="">
              </button>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

function updateGiveawayGallery(gallery,index){
    if(!gallery) return;
    const id=String(gallery.dataset.giveawayGallery||"");
    const g=appContext.giveaways.find(item=>String(item.id)===id);
    const images=appContext.giveawayPublicImages(g);
    if(!images.length) return;

    let next=Number(index||0);
    next=(next%images.length+images.length)%images.length;
    gallery.dataset.giveawayGalleryIndex=String(next);

    const img=gallery.querySelector("[data-giveaway-gallery-image]");
    if(img) img.src=images[next];

    const count=gallery.querySelector("[data-giveaway-gallery-count]");
    if(count) count.textContent=`${next+1} / ${images.length}`;

    gallery.querySelectorAll("[data-giveaway-gallery-go]").forEach(btn=>{
      btn.classList.toggle("active",Number(btn.dataset.giveawayGalleryGo)===next);
    });
  }

function ensureGiveawayDetailsOverlay(){
    let overlay=appContext.$("giveawayDetailsOverlay");
    if(overlay) return overlay;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="giveawayDetailsOverlay" hidden aria-live="polite">
        <div class="modal card-details-modal giveaway-details-modal" role="dialog" aria-modal="true" aria-labelledby="giveawayDetailsTitle">
          <div class="giveaway-details-actions">
            <button type="button" class="btn-ghost" id="giveawayDetailsShareBtn">Share</button>
            <div class="giveaway-details-actions-right">
              <button type="button" class="btn-primary owner-only" id="giveawayDetailsEditBtn">Edit giveaway</button>
              <button type="button" class="details-close-btn" id="giveawayDetailsCloseBtn"><span aria-hidden="true">×</span> Close</button>
            </div>
          </div>
          <div id="giveawayDetailsMount"></div>
        </div>
      </div>
    `);

    overlay=appContext.$("giveawayDetailsOverlay");
    overlay.addEventListener("click",event=>{
      if(event.target===overlay) appContext.closeGiveawayDetails();
    });
    appContext.$("giveawayDetailsCloseBtn")?.addEventListener("click",appContext.closeGiveawayDetails);
    appContext.$("giveawayDetailsEditBtn")?.addEventListener("click",()=>{
      if(!appContext.requireOwner("edit giveaway")) return;
      const g=appContext.giveaways.find(item=>String(item.id)===String(appContext.giveawayDetailsId));
      if(!g) return;
      appContext.closeGiveawayDetails();
      appContext.openGiveawayForm(g);
    });
    appContext.$("giveawayDetailsShareBtn")?.addEventListener("click",async()=>{
      const g=appContext.giveaways.find(item=>String(item.id)===String(appContext.giveawayDetailsId));
      if(!g) return;
      const shareData={title:g.title||"Collect TCG Giveaway",text:g.card_name||g.title||"Collect TCG Giveaway",url:location.href};
      try{
        if(navigator.share) await navigator.share(shareData);
        else if(navigator.clipboard){ await navigator.clipboard.writeText(location.href); appContext.showToast("Giveaway link copied"); }
      }catch(error){ if(error?.name!=="AbortError") console.warn("Giveaway share failed",error); }
    });
    return overlay;
  }

function closeGiveawayDetails(){
    const overlay=appContext.$("giveawayDetailsOverlay");
    if(overlay) overlay.hidden=true;
    appContext.giveawayDetailsId="";
    appContext.giveawayDetailsImageIndex=0;
  }

function giveawayDetailRequirementsHTML(g){
    const rows=[];
    if(g.require_facebook) rows.push("Follow Collect TCG on Facebook");
    if(g.require_instagram) rows.push("Follow @collecttcg.mysg on Instagram");
    if(g.require_comment) rows.push("Comment on the giveaway post");
    if(g.require_website_code) rows.push("Find the Giveaway Code on this page");
    if(appContext.safeHttpUrl(g.entry_form_url)) rows.push("Submit the entry form");
    if(!rows.length) return "";
    return `<div class="detail-section"><h3>How to Enter</h3><div class="detail-slab-list">${rows.map((row,i)=>`<div class="detail-slab-row"><div><span class="detail-slab-number">Step ${i+1}</span><strong>${appContext.escapeHtml(row)}</strong></div></div>`).join("")}</div></div>`;
  }

function renderGiveawayDetailsGallery(g,index=0){
    const images=appContext.giveawayPublicImages(g);
    if(!images.length) return `<div class="detail-empty-image">No uploaded pictures</div>`;
    appContext.giveawayDetailsImageIndex=(Number(index)||0)%images.length;
    if(appContext.giveawayDetailsImageIndex<0) appContext.giveawayDetailsImageIndex+=images.length;
    const current=images[appContext.giveawayDetailsImageIndex];
    return `<div class="detail-slider" data-giveaway-detail-slider>
      <div class="detail-slider-stage">
        <img class="detail-slider-image" src="${appContext.escapeHtml(current)}" alt="${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.card_name||g.title))} image ${appContext.giveawayDetailsImageIndex+1}" decoding="async">
      </div>
      ${images.length>1 ? `
        <button type="button" class="detail-slider-btn prev" data-giveaway-detail-step="-1" aria-label="Previous image">‹</button>
        <button type="button" class="detail-slider-btn next" data-giveaway-detail-step="1" aria-label="Next image">›</button>
        <div class="detail-slider-count">${appContext.giveawayDetailsImageIndex+1} / ${images.length}</div>
        <div class="detail-slider-dots">${images.map((_,i)=>`<button type="button" class="detail-slider-dot ${i===appContext.giveawayDetailsImageIndex?"active":""}" data-giveaway-detail-go="${i}" aria-label="Image ${i+1}"></button>`).join("")}</div>
        <div class="detail-thumb-strip-wrap">
          <div class="detail-thumb-strip-head"><strong>More photos</strong><span>${images.length} photos · Tap a thumbnail</span></div>
          <div class="detail-thumb-strip">${images.map((src,i)=>`<button type="button" class="detail-thumb-strip-btn ${i===appContext.giveawayDetailsImageIndex?"active":""}" data-giveaway-detail-go="${i}"><img src="${appContext.escapeHtml(src)}" alt="" loading="lazy"></button>`).join("")}</div>
        </div>` : ""}
    </div>`;
  }

function openGiveawayDetails(g){
    if(!g || (!appContext.isOwnerMode() && !appContext.giveawayVisibleToCurrentViewer(g))) return;
    const overlay=appContext.ensureGiveawayDetailsOverlay();
    const mount=appContext.$("giveawayDetailsMount");
    appContext.giveawayDetailsId=String(g.id||"");
    appContext.giveawayDetailsImageIndex=0;
    const images=appContext.giveawayPublicImages(g);
    const status=appContext.normalizeFilterValue(g.status);
    const winner=appContext.isPastGiveawayWinner(g);

    mount.innerHTML=`
      <div class="detail-header">
        <div class="detail-title">
          <div class="eyebrow">Giveaway details</div>
          <h2 id="giveawayDetailsTitle">${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.title))}</h2>
          <div class="detail-meta">${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.card_name||"Collect TCG prize"))}</div>
        </div>
      </div>
      <div class="detail-layout">
        <div data-giveaway-detail-gallery-mount>${appContext.renderGiveawayDetailsGallery(g,0)}</div>
        <div class="detail-info">
          <div class="detail-header detail-header-desktop">
            <div class="detail-title">
              <div class="eyebrow">Card details</div>
              <h2>${appContext.escapeHtml(card.name).toUpperCase()}</h2>
              <div class="detail-meta">${appContext.escapeHtml(card.game || "—")}${card.set ? " · " + appContext.escapeHtml(card.set) : ""}</div>
            </div>
            ${!isNfsListing ? `
              <label class="global-currency-control detail-currency-control" title="Your preferred currency is saved on this device.">
                <span>Currency</span>
                <select id="detailsCurrencyPreference" aria-label="Preferred display currency">
                  <option value="USD" ${appContext.getPriceCurrencyPreference()==="USD"?"selected":""}>USD</option>
                  <option value="MYR" ${appContext.getPriceCurrencyPreference()==="MYR"?"selected":""}>MYR</option>
                  <option value="SGD" ${appContext.getPriceCurrencyPreference()==="SGD"?"selected":""}>SGD</option>
                </select>
              </label>
            ` : ""}
          </div>

          <div class="detail-summary-strip">
            <div class="detail-summary-card"><span>Status</span><strong>${appContext.escapeHtml(winner?"Gave Away":(status==="closed"?"Closed":"Active"))}</strong></div>
            <div class="detail-summary-card"><span>Photos</span><strong>${images.length}</strong></div>
            <div class="detail-summary-card"><span>${winner?"Winner":"Ends"}</span><strong>${appContext.escapeHtml(winner?(g.winner_name||"Winner announced"):(g.ends_at?appContext.giveawayDateLabel(g.ends_at):"No end date"))}</strong></div>
          </div>

          <div class="detail-info-section-title">Giveaway information</div>
          <div class="detail-grid details-info-grid">
            <div class="detail-item"><div class="detail-label">Prize</div><div class="detail-value">${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.card_name||"—"))}</div></div>
            ${g.giveaway_code ? `<div class="detail-item"><div class="detail-label">Giveaway Code</div><div class="detail-value">${appContext.escapeHtml(g.giveaway_code)}</div></div>`:""}
            ${winner && (g.gave_away_date||g.winner_announced_at) ? `<div class="detail-item"><div class="detail-label">Gave Away Date</div><div class="detail-value">${appContext.escapeHtml(appContext.giveawayWinnerDateLabel(g.gave_away_date||g.winner_announced_at))}</div></div>`:""}
          </div>

          ${appContext.giveawayDetailRequirementsHTML(g)}
          ${!winner && g.bonus_join_facebook_group ? `
            <div class="giveaway-detail-entry-actions">
              <a class="btn-ghost"
                 href="${appContext.escapeHtml(appContext.COLLECT_SOCIAL_LINKS.facebookGroup)}"
                 target="_blank"
                 rel="noopener noreferrer"
                 data-giveaway-growth-action="bonus_facebook_group_click"
                 data-giveaway-id="${appContext.escapeHtml(g.id)}">
                Join Facebook Group · Bonus +1 ↗
              </a>
            </div>
          ` : ""}
          ${String(g.how_to_enter||"").trim()?`<div class="giveaway-detail-entry"><h3>Additional instructions</h3><p>${appContext.escapeHtml(g.how_to_enter)}</p></div>`:""}
          ${String(g.details||"").trim()?`<div class="giveaway-detail-entry"><h3>Details</h3><p>${appContext.escapeHtml(g.details)}</p></div>`:""}
          ${appContext.safeHttpUrl(g.entry_form_url) && !winner ? `<div class="giveaway-detail-entry-actions"><a class="btn-primary" href="${appContext.escapeHtml(appContext.safeHttpUrl(g.entry_form_url))}" target="_blank" rel="noopener noreferrer">Enter Giveaway ↗</a></div>`:""}
          ${winner && appContext.safePublicProfileUrl(g.winner_profile_url) ? `<div class="giveaway-detail-entry-actions"><a class="btn-ghost" href="${appContext.escapeHtml(appContext.safePublicProfileUrl(g.winner_profile_url))}" target="_blank" rel="noopener noreferrer">View winner profile ↗</a></div>`:""}
        </div>
      </div>`;

    const rerenderGallery=next=>{
      const galleryMount=mount.querySelector("[data-giveaway-detail-gallery-mount]");
      if(!galleryMount) return;
      galleryMount.innerHTML=appContext.renderGiveawayDetailsGallery(g,next);
      wireGallery();
    };
    const wireGallery=()=>{
      mount.querySelectorAll("[data-giveaway-detail-step]").forEach(btn=>btn.addEventListener("click",()=>rerenderGallery(appContext.giveawayDetailsImageIndex+Number(btn.dataset.giveawayDetailStep||0))));
      mount.querySelectorAll("[data-giveaway-detail-go]").forEach(btn=>btn.addEventListener("click",()=>rerenderGallery(Number(btn.dataset.giveawayDetailGo||0))));
    };
    wireGallery();
    overlay.hidden=false;
    overlay.querySelector(".giveaway-details-modal")?.scrollTo?.(0,0);
    appContext.$("giveawayDetailsCloseBtn")?.focus({preventScroll:true});
  }

function renderGiveawayPage(){
    const currentGiveaways=appContext.giveaways.filter(g=>!appContext.isPastGiveawayWinner(g) && appContext.giveawayVisibleToCurrentViewer(g));
    const pastWinners=appContext.sortedPastGiveawayWinners().filter(g=>appContext.giveawayVisibleToCurrentViewer(g));

    const currentCardHTML=g=>`
      <article class="giveaway-card" data-giveaway-open="${appContext.escapeHtml(g.id)}" tabindex="0" role="button" aria-label="Open ${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.title))} giveaway details">
        ${appContext.giveawayGalleryHTML(g)}
        <div class="giveaway-body">
          <div class="giveaway-title">${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.title))}</div>
          <div class="giveaway-meta">${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.card_name))}</div>
          <div class="giveaway-status-row">
            <span class="giveaway-status ${appContext.normalizeFilterValue(g.status)==="closed" ? "closed" : ""}">
              ${appContext.escapeHtml(appContext.normalizeFilterValue(g.status)==="closed" ? "Closed" : "Active")}
            </span>
            ${appContext.isGiveawayHidden(g) ? `<span class="giveaway-hidden-badge owner-only">HIDDEN</span>` : ""}
          </div>

          ${appContext.giveawayGrowthFieldsSupported===true ? `
            <div class="giveaway-growth-entry">
              <div class="giveaway-growth-entry-head">
                <span>🎁</span>
                <div>
                  <h4>How to Enter</h4>
                  <p>Complete the required steps, then submit your entry.</p>
                </div>
              </div>

              <div class="giveaway-growth-steps">
                ${g.require_facebook ? `<div><b>1</b><span>Follow Collect TCG on Facebook</span></div>` : ""}
                ${g.require_instagram ? `<div><b>${g.require_facebook?2:1}</b><span>Follow @collecttcg.mysg on Instagram</span></div>` : ""}
                ${g.require_comment ? `<div><b>${(g.require_facebook?1:0)+(g.require_instagram?1:0)+1}</b><span>Comment on the giveaway post</span></div>` : ""}
                ${g.require_website_code ? `<div><b>${(g.require_facebook?1:0)+(g.require_instagram?1:0)+(g.require_comment?1:0)+1}</b><span>Find the Giveaway Code on this page</span></div>` : ""}
                ${appContext.safeHttpUrl(g.entry_form_url) ? `<div><b>${(g.require_facebook?1:0)+(g.require_instagram?1:0)+(g.require_comment?1:0)+(g.require_website_code?1:0)+1}</b><span>Submit your entry using the button below</span></div>` : ""}
              </div>

              ${g.require_comment ? `
                <a class="giveaway-action-link"
                   href="${appContext.escapeHtml(appContext.safeHttpUrl(g.facebook_post_url)||appContext.COLLECT_SOCIAL_LINKS.facebook)}"
                   target="_blank" rel="noopener noreferrer"
                   data-giveaway-growth-action="comment_click"
                   data-giveaway-id="${appContext.escapeHtml(g.id)}">
                  Open Giveaway Post to Comment ↗
                </a>
              ` : ""}

              ${g.require_website_code && g.giveaway_code ? `
                <div class="giveaway-code-box">
                  <small>Giveaway Code</small>
                  <strong>${appContext.escapeHtml(g.giveaway_code)}</strong>
                  <span>Enter this code in the entry form.</span>
                </div>
              ` : ""}

              ${appContext.safeHttpUrl(g.entry_form_url) ? `
                <a class="btn-primary giveaway-enter-btn"
                   href="${appContext.escapeHtml(appContext.safeHttpUrl(g.entry_form_url))}"
                   target="_blank"
                   rel="noopener noreferrer"
                   data-giveaway-growth-action="entry_click"
                   data-giveaway-id="${appContext.escapeHtml(g.id)}">
                  Enter Giveaway ↗
                </a>
              ` : ""}

              ${(g.bonus_join_facebook_group || g.bonus_share_facebook || g.bonus_tag_friends || g.bonus_share_instagram_story) ? `
                <div class="giveaway-bonus-actions">
                  <div class="giveaway-bonus-actions-head">
                    <strong>Extra Actions</strong>
                    <span>Optional bonus entries</span>
                  </div>
                  ${g.bonus_join_facebook_group ? `
                    <a href="${appContext.escapeHtml(appContext.COLLECT_SOCIAL_LINKS.facebookGroup)}"
                       target="_blank" rel="noopener noreferrer"
                       data-giveaway-growth-action="bonus_facebook_group_click"
                       data-giveaway-id="${appContext.escapeHtml(g.id)}">
                      <span>Join Collect TCG Facebook Group</span><b>+1</b>
                    </a>
                  ` : ""}
                  ${g.bonus_share_facebook ? `
                    <a href="${appContext.escapeHtml(appContext.safeHttpUrl(g.facebook_post_url)||appContext.COLLECT_SOCIAL_LINKS.facebook)}"
                       target="_blank" rel="noopener noreferrer"
                       data-giveaway-growth-action="bonus_facebook_share_click"
                       data-giveaway-id="${appContext.escapeHtml(g.id)}">
                      <span>Share Facebook post publicly</span><b>+1</b>
                    </a>
                  ` : ""}
                  ${g.bonus_tag_friends ? `
                    <a href="${appContext.escapeHtml(appContext.safeHttpUrl(g.facebook_post_url)||appContext.COLLECT_SOCIAL_LINKS.facebook)}"
                       target="_blank" rel="noopener noreferrer"
                       data-giveaway-growth-action="bonus_tag_friends_click"
                       data-giveaway-id="${appContext.escapeHtml(g.id)}">
                      <span>Tag 2 friends</span><b>+1</b>
                    </a>
                  ` : ""}
                  ${g.bonus_share_instagram_story ? `
                    <a href="${appContext.escapeHtml(appContext.safeHttpUrl(g.instagram_post_url)||appContext.COLLECT_SOCIAL_LINKS.instagram)}"
                       target="_blank" rel="noopener noreferrer"
                       data-giveaway-growth-action="bonus_instagram_story_click"
                       data-giveaway-id="${appContext.escapeHtml(g.id)}">
                      <span>Share IG Story + tag us</span><b>+1</b>
                    </a>
                  ` : ""}
                </div>
              ` : ""}

              <div class="giveaway-explore-title">Explore Collect TCG</div>
              <div class="giveaway-growth-links">
                <a href="${appContext.COLLECT_SOCIAL_LINKS.facebook}"
                   target="_blank" rel="noopener noreferrer"
                   data-giveaway-growth-action="facebook_click"
                   data-giveaway-id="${appContext.escapeHtml(g.id)}">Facebook</a>
                <a href="${appContext.COLLECT_SOCIAL_LINKS.instagram}"
                   target="_blank" rel="noopener noreferrer"
                   data-giveaway-growth-action="instagram_click"
                   data-giveaway-id="${appContext.escapeHtml(g.id)}">Instagram</a>
                <a href="#/inventory"
                   data-giveaway-growth-action="inventory_click"
                   data-giveaway-id="${appContext.escapeHtml(g.id)}">Inventory</a>
                <a href="#/collection"
                   data-giveaway-growth-action="collection_click"
                   data-giveaway-id="${appContext.escapeHtml(g.id)}">Collection</a>
              </div>
            </div>
          ` : ""}

          ${String(g.how_to_enter||"").trim() ? `
            <div class="giveaway-section giveaway-how-preview">
              <h4>${appContext.giveawayGrowthFieldsSupported===true ? "Additional entry instructions" : "How to enter"}</h4>
              <p class="giveaway-how-text"
                 id="giveawayHowText-${appContext.escapeHtml(g.id)}">${appContext.escapeHtml(g.how_to_enter)}</p>
              <button type="button"
                      class="giveaway-how-toggle"
                      data-giveaway-how-toggle="${appContext.escapeHtml(g.id)}"
                      aria-expanded="false"
                      aria-controls="giveawayHowText-${appContext.escapeHtml(g.id)}"
                      hidden>
                Read more
              </button>
            </div>
          ` : ""}

          ${g.ends_at ? `<div class="giveaway-section"><h4>Ends</h4><p>${appContext.escapeHtml(appContext.giveawayDateLabel(g.ends_at))}</p></div>` : ""}
          ${g.details ? `<div class="giveaway-section"><h4>Details</h4><p>${appContext.escapeHtml(g.details)}</p></div>` : ""}

          <div class="giveaway-owner-actions owner-only">
            <button type="button"
                    class="btn-ghost giveaway-mark-winner"
                    data-giveaway-mark-winner="${appContext.escapeHtml(g.id)}">
              Mark Gave Away
            </button>
            <button type="button"
                    class="btn-ghost"
                    data-giveaway-toggle-hidden="${appContext.escapeHtml(g.id)}">
              ${appContext.isGiveawayHidden(g) ? "Unhide" : "Hide"}
            </button>
            <button type="button" class="btn-ghost" data-giveaway-edit="${appContext.escapeHtml(g.id)}">Edit</button>
            <button type="button" class="btn-ghost" data-giveaway-delete="${appContext.escapeHtml(g.id)}" style="color:var(--danger)">Delete</button>
          </div>
        </div>
      </article>
    `;

    const winnerCardHTML=g=>`
      <article class="giveaway-card giveaway-winner-card"
               id="giveaway-winner-${appContext.escapeHtml(g.id)}"
               data-giveaway-open="${appContext.escapeHtml(g.id)}" tabindex="0" role="button" aria-label="Open ${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.title))} giveaway details"
               data-giveaway-winner-card="${appContext.escapeHtml(g.id)}">
        ${appContext.giveawayGalleryHTML(g)}
        <div class="giveaway-body">
          <div class="giveaway-winner-summary">
            <div class="giveaway-title">${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.title))}</div>
            <div class="giveaway-meta">${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.card_name))}</div>
            <span class="giveaway-status closed">Gave Away</span>
          </div>

          <div class="giveaway-winner-name">
            <span>Winner</span>
            <strong>${appContext.escapeHtml(g.winner_name || "Winner announced")}</strong>
            ${appContext.safePublicProfileUrl(g.winner_profile_url) ? `
              <a class="giveaway-winner-profile-link"
                 href="${appContext.escapeHtml(appContext.safePublicProfileUrl(g.winner_profile_url))}"
                 target="_blank"
                 rel="noopener noreferrer">
                View user profile ↗
              </a>
            ` : ""}
            ${(g.gave_away_date || g.winner_announced_at) ? `<div class="giveaway-winner-date">Gave Away ${appContext.escapeHtml(appContext.giveawayWinnerDateLabel(g.gave_away_date || g.winner_announced_at))}</div>` : ""}
          </div>

          ${g.details ? `<div class="giveaway-section"><h4>Giveaway details</h4><p>${appContext.escapeHtml(g.details)}</p></div>` : ""}

          <div class="giveaway-owner-actions owner-only">
            <button type="button" class="btn-ghost" data-giveaway-edit="${appContext.escapeHtml(g.id)}">Edit Winner</button>
            <button type="button" class="btn-ghost" data-giveaway-restore="${appContext.escapeHtml(g.id)}">Move Back to Current</button>
            <button type="button" class="btn-ghost" data-giveaway-delete="${appContext.escapeHtml(g.id)}" style="color:var(--danger)">Delete</button>
          </div>
        </div>
      </article>
    `;

    appContext.view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">Giveaways</div>
          <h2>Collect TCG Giveaways</h2>
          <p>Join our current giveaways and see previous winners.</p>
        </div>
        <button type="button" class="btn-primary owner-only" id="addGiveawayBtn">+ Add Giveaway</button>
      </div>

      <section class="giveaway-page-section">
        <div class="giveaway-page-section-head">
          <div>
            <h3>Current Giveaways</h3>
            <p>Giveaways that are active or waiting for a winner announcement.</p>
          </div>
          <span class="giveaway-section-count">${currentGiveaways.length}</span>
        </div>

        ${currentGiveaways.length
          ? `<div class="giveaway-grid">${currentGiveaways.map(currentCardHTML).join("")}</div>`
          : `<div class="giveaway-empty-section">No current giveaways right now. Check back again soon.</div>`}
      </section>

      <section class="giveaway-page-section">
        <div class="giveaway-page-section-head">
          <div>
            <h3>Past Winners</h3>
            <p>Previous giveaways that have been completed and awarded.</p>
          </div>
          <div class="giveaway-winner-section-actions">
            <button type="button"
                    class="btn-ghost owner-only"
                    id="toggleWinnerRearrangeBtn"
                    aria-pressed="false">
              Rearrange Winners
            </button>
            <span class="giveaway-section-count">${pastWinners.length}</span>
          </div>
        </div>

        ${pastWinners.length
          ? `<div class="giveaway-grid" id="pastWinnersGrid">${pastWinners.map(winnerCardHTML).join("")}</div>`
          : `<div class="giveaway-empty-section">Past giveaway winners will appear here.</div>`}
      </section>
    `;

    appContext.$("addGiveawayBtn")?.addEventListener("click",()=>appContext.openGiveawayForm());

    appContext.recordGiveawayPageViewOnce();

    appContext.view.querySelectorAll("[data-giveaway-open]").forEach(cardEl=>{
      const open=event=>{
        if(event?.target?.closest?.("a,button,input,select,textarea,label,[data-giveaway-gallery-step],[data-giveaway-gallery-go]")) return;
        const g=appContext.giveaways.find(item=>String(item.id)===String(cardEl.dataset.giveawayOpen||""));
        if(g) appContext.openGiveawayDetails(g);
      };
      cardEl.addEventListener("click",open);
      cardEl.addEventListener("keydown",event=>{
        if(event.key!=="Enter" && event.key!==" ") return;
        if(event.target!==cardEl) return;
        event.preventDefault();
        open(event);
      });
    });

    appContext.view.querySelectorAll("[data-giveaway-growth-action]").forEach(link=>{
      link.addEventListener("click",()=>{
        appContext.recordGiveawayEngagement(
          String(link.dataset.giveawayGrowthAction||""),
          String(link.dataset.giveawayId||"")
        ).catch(()=>{});
      });
    });

    appContext.view.querySelectorAll("[data-giveaway-how-toggle]").forEach(btn=>{
      const id=String(btn.dataset.giveawayHowToggle||"");
      const textEl=appContext.$(`giveawayHowText-${id}`);
      if(!textEl) return;

      requestAnimationFrame(()=>{
        const needsToggle=textEl.scrollHeight>textEl.clientHeight+1;
        btn.hidden=!needsToggle;
      });

      btn.addEventListener("click",()=>{
        const expanded=btn.getAttribute("aria-expanded")==="true";
        const next=!expanded;
        btn.setAttribute("aria-expanded",String(next));
        textEl.classList.toggle("expanded",next);
        btn.textContent=next ? "Show less" : "Read more";
      });
    });

    appContext.setupGiveawayWinnerRearrangeMode();

    const linkedWinnerId=String(appContext.currentHashParams().get("winner")||"").trim();
    if(linkedWinnerId){
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const target=document.getElementById(`giveaway-winner-${linkedWinnerId}`);
        if(!target) return;
        target.scrollIntoView({behavior:"smooth",block:"center"});
        target.classList.add("giveaway-linked-winner");
        setTimeout(()=>target.classList.remove("giveaway-linked-winner"),2600);
      }));
    }

    appContext.view.querySelectorAll(".giveaway-gallery").forEach(gallery=>{
      gallery.querySelectorAll("[data-giveaway-gallery-step]").forEach(btn=>{
        btn.addEventListener("click",event=>{
          event.preventDefault();
          event.stopPropagation();
          const current=Number(gallery.dataset.giveawayGalleryIndex||0);
          appContext.updateGiveawayGallery(gallery,current+Number(btn.dataset.giveawayGalleryStep||0));
        });
      });

      gallery.querySelectorAll("[data-giveaway-gallery-go]").forEach(btn=>{
        btn.addEventListener("click",event=>{
          event.preventDefault();
          event.stopPropagation();
          appContext.updateGiveawayGallery(gallery,Number(btn.dataset.giveawayGalleryGo||0));
        });
      });

      let touchStartX=null;
      let touchStartY=null;
      gallery.addEventListener("touchstart",event=>{
        if(event.touches.length!==1) return;
        touchStartX=event.touches[0].clientX;
        touchStartY=event.touches[0].clientY;
      },{passive:true});

      gallery.addEventListener("touchend",event=>{
        if(touchStartX==null || !event.changedTouches.length) return;
        const dx=event.changedTouches[0].clientX-touchStartX;
        const dy=event.changedTouches[0].clientY-touchStartY;
        touchStartX=null;
        touchStartY=null;
        if(Math.abs(dx)<42 || Math.abs(dx)<=Math.abs(dy)) return;
        const current=Number(gallery.dataset.giveawayGalleryIndex||0);
        appContext.updateGiveawayGallery(gallery,current+(dx<0?1:-1));
      },{passive:true});
    });

    appContext.view.querySelectorAll("[data-giveaway-edit]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        if(!appContext.requireOwner("edit giveaway")) return;
        const g=appContext.giveaways.find(x=>String(x.id)===String(btn.dataset.giveawayEdit||""));
        if(g) appContext.openGiveawayForm(g);
      });
    });

    appContext.view.querySelectorAll("[data-giveaway-toggle-hidden]").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        if(!appContext.requireOwner("hide giveaway")) return;

        const g=appContext.giveaways.find(
          x=>String(x.id)===String(btn.dataset.giveawayToggleHidden||"")
        );
        if(!g) return;

        if(appContext.giveawayHiddenSupported===false){
          appContext.showToast("Run the giveaway hide migration first");
          return;
        }

        const nextHidden=!appContext.isGiveawayHidden(g);
        const action=nextHidden ? "hide" : "unhide";

        if(!confirm(`${nextHidden ? "Hide" : "Unhide"} "${g.title}"${nextHidden ? " from public visitors" : ""}?`)){
          return;
        }

        const {error}=await appContext.saveGiveaway({is_hidden:nextHidden},g.id);

        if(error){
          console.error(`${action} giveaway error:`,error);
          if(appContext.optionalColumnUnavailable(error,"is_hidden")){
            appContext.giveawayHiddenSupported=false;
            appContext.showToast("Run the giveaway hide migration first");
          }else{
            appContext.showToast(`Could not ${action} giveaway`);
          }
          return;
        }

        await appContext.loadGiveaways();
        appContext.renderGiveawayPage();
        appContext.showToast(nextHidden ? "Giveaway hidden from visitors" : "Giveaway is public again");
      });
    });

    appContext.view.querySelectorAll("[data-giveaway-mark-winner]").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        if(!appContext.requireOwner("mark giveaway as gave away")) return;
        const g=appContext.giveaways.find(x=>String(x.id)===String(btn.dataset.giveawayMarkWinner||""));
        if(!g) return;

        const winnerName=prompt(
          `Winner display name for "${g.title}"?\n\nThis will be public on the Past Winners page.`,
          g.winner_name||""
        );
        if(winnerName===null) return;

        const clean=String(winnerName).trim();
        if(!clean){
          appContext.showToast("Winner display name is required");
          return;
        }

        if(!confirm(`Move "${g.title}" to Past Winners and show "${clean}" as the winner?`)) return;

        const {error}=await appContext.markGiveawayAsGaveAway(g,clean);
        if(error){
          console.error("Mark giveaway gave away error:",error);
          appContext.showToast("Could not move giveaway to Past Winners");
          return;
        }

        await appContext.loadGiveaways();
        appContext.renderGiveawayPage();
        appContext.showToast("Giveaway moved to Past Winners");
      });
    });

    appContext.view.querySelectorAll("[data-giveaway-restore]").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        if(!appContext.requireOwner("restore giveaway")) return;
        const g=appContext.giveaways.find(x=>String(x.id)===String(btn.dataset.giveawayRestore||""));
        if(!g) return;
        if(!confirm(`Move "${g.title}" back to Current Giveaways?`)) return;

        const {error}=await appContext.saveGiveaway({
          status:"closed",
          winner_name:null,
          winner_profile_url:null,
          winner_sort_order:null,
          gave_away_date:null,
          winner_announced_at:null
        },g.id);

        if(error){
          console.error("Restore giveaway error:",error);
          appContext.showToast("Could not restore giveaway");
          return;
        }

        await appContext.loadGiveaways();
        appContext.renderGiveawayPage();
        appContext.showToast("Giveaway moved back to Current Giveaways");
      });
    });

    appContext.view.querySelectorAll("[data-giveaway-delete]").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        if(!appContext.requireOwner("delete giveaway")) return;
        const id=String(btn.dataset.giveawayDelete||"");
        const g=appContext.giveaways.find(x=>String(x.id)===id);
        if(!g) return;
        if(!confirm(`Delete giveaway "${g.title}"?`)) return;

        const {error}=await appContext.deleteGiveaway(g.id);
        if(error){
          console.error(error);
          appContext.showToast("Could not delete giveaway");
          return;
        }

        await appContext.loadGiveaways();
        appContext.renderGiveawayPage();
        appContext.showToast("Giveaway deleted");
      });
    });
  }

function openGiveawayForm(g=null){
    if(!appContext.requireOwner()) return;
    appContext.$("giveawayFormTitle").textContent = g ? "Edit Giveaway" : "Add Giveaway";
    appContext.$("giveawayId").value = g ? g.id : "";
    appContext.$("giveawayTitle").value = g ? g.title : "";
    appContext.$("giveawayCardName").value = g ? g.card_name : "";
    const existingGiveawayPhotos=g ? appContext.giveawayPhotoSourcesFromRecord(g) : [];
    appContext.$("giveawayImage").value = existingGiveawayPhotos[0] || "";
    appContext.$("giveawayImageFile").value = "";
    appContext.resetGiveawayImageEditorState(existingGiveawayPhotos[0] || "",existingGiveawayPhotos);
    appContext.$("giveawayStatus").value = g ? g.status : "active";
    appContext.$("giveawayWinnerName").value = g ? (g.winner_name || "") : "";
    appContext.$("giveawayWinnerProfileUrl").value = g ? (g.winner_profile_url || "") : "";
    appContext.$("giveawayGaveAwayDate").value = g ? (g.gave_away_date || "") : "";
    appContext.syncGiveawayWinnerField();
    appContext.$("giveawayHowToEnter").value = g ? g.how_to_enter : "";
    appContext.$("giveawayDetails").value = g ? g.details : "";
    appContext.$("giveawayCode").value = g ? (g.giveaway_code || "") : "";
    appContext.$("giveawayEntryFormUrl").value = g ? (g.entry_form_url || "") : "";
    appContext.$("giveawayRequireFacebook").checked = g ? g.require_facebook !== false : true;
    appContext.$("giveawayRequireInstagram").checked = g ? g.require_instagram !== false : true;
    appContext.$("giveawayRequireComment").checked = g ? g.require_comment !== false : true;
    appContext.$("giveawayRequireWebsiteCode").checked = g ? g.require_website_code !== false : true;
    appContext.$("giveawayFacebookPostUrl").value = g ? (g.facebook_post_url || "") : "";
    appContext.$("giveawayInstagramPostUrl").value = g ? (g.instagram_post_url || "") : "";
    appContext.$("giveawayBonusFacebookGroup").checked = g ? g.bonus_join_facebook_group === true : false;
    appContext.$("giveawayBonusShareFacebook").checked = g ? g.bonus_share_facebook === true : false;
    appContext.$("giveawayBonusTagFriends").checked = g ? g.bonus_tag_friends === true : false;
    appContext.$("giveawayBonusInstagramStory").checked = g ? g.bonus_share_instagram_story === true : false;

    const facebookGroupBonusInput=appContext.$("giveawayBonusFacebookGroup");
    if(facebookGroupBonusInput){
      facebookGroupBonusInput.disabled=appContext.giveawayFacebookGroupBonusSupported===false;
      facebookGroupBonusInput.title=appContext.giveawayFacebookGroupBonusSupported===false
        ? "Run the V208 Facebook Group bonus migration first."
        : "";
    }

    const growthBlock=appContext.$(".giveaway-growth-owner-block");
    if(growthBlock){
      growthBlock.classList.toggle("giveaway-growth-unavailable",appContext.giveawayGrowthFieldsSupported===false);
      growthBlock.title=appContext.giveawayGrowthFieldsSupported===false
        ? "Run giveaway-growth-upgrade-migration.sql to save these settings."
        : "";
    }

    appContext.$("giveawayEndsAt").value = g && g.ends_at ? appContext.giveawayEndsIsoToInputValue(g.ends_at) : "";
    appContext.giveawayOverlay.hidden = false;
  }

function closeGiveawayForm(){
    appContext.giveawayOverlay.hidden = true;
    appContext.$("giveawayForm").reset();
    appContext.resetGiveawayImageEditorState("",[]);
  }

function syncGiveawayWinnerField(){
    const isWinner=appContext.$("giveawayStatus")?.value==="gave_away";
    const field=appContext.$("giveawayWinnerField");
    const input=appContext.$("giveawayWinnerName");
    if(field) field.hidden=!isWinner;
    if(input) input.required=isWinner;

    const gaveAwayDateInput=appContext.$("giveawayGaveAwayDate");
    if(gaveAwayDateInput){
      gaveAwayDateInput.disabled=!isWinner || appContext.giveawayGaveAwayDateSupported===false;
      if(isWinner && !gaveAwayDateInput.value){
        gaveAwayDateInput.value=new Date().toISOString().slice(0,10);
      }
    }

    const profileInput=appContext.$("giveawayWinnerProfileUrl");
    if(profileInput){
      profileInput.disabled=appContext.giveawayWinnerProfileUrlSupported===false;
      profileInput.title=appContext.giveawayWinnerProfileUrlSupported===false
        ? "Run the giveaway profile-link Supabase migration to enable this field."
        : "";
    }
  }

  Object.assign(appContext,{sortedPastGiveawayWinners,persistGiveawayWinnerOrder,currentWinnerOrderFromDom,saveGiveawayWinnerDomOrder,setupGiveawayWinnerRearrangeMode,giveawayPublicImages,giveawayGalleryHTML,updateGiveawayGallery,ensureGiveawayDetailsOverlay,closeGiveawayDetails,giveawayDetailRequirementsHTML,renderGiveawayDetailsGallery,openGiveawayDetails,renderGiveawayPage,openGiveawayForm,closeGiveawayForm,syncGiveawayWinnerField});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.giveawayDetailsId = "";

  appContext.giveawayDetailsImageIndex = 0;

  appContext.giveawayOverlay = appContext.$("giveawayOverlay");

appContext.$("resetQualifiedViewsConfirm")?.addEventListener("input",()=>{
    const input=appContext.$("resetQualifiedViewsConfirm");
    const confirmBtn=appContext.$("resetQualifiedViewsConfirmBtn");
    if(!input || !confirmBtn) return;
    confirmBtn.disabled=input.value!=="Reset";
  });

appContext.$("resetQualifiedViewsCancelBtn")?.addEventListener("click",appContext.closeResetQualifiedViewsModal);

appContext.$("resetQualifiedViewsOverlay")?.addEventListener("click",event=>{
    if(event.target===appContext.$("resetQualifiedViewsOverlay")){
      appContext.closeResetQualifiedViewsModal();
    }
  });

appContext.$("resetQualifiedViewsForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!appContext.requireOwner("reset qualified view counts")) return;

    const input=appContext.$("resetQualifiedViewsConfirm");
    const confirmBtn=appContext.$("resetQualifiedViewsConfirmBtn");

    if(!input || !confirmBtn || input.value!=="Reset"){
      appContext.showToast('Type "Reset" exactly to continue');
      return;
    }

    confirmBtn.disabled=true;
    confirmBtn.textContent="Resetting…";

    const ok=await appContext.resetQualifiedViewCounts();

    confirmBtn.textContent="Reset View Counts";

    if(ok){
      appContext.closeResetQualifiedViewsModal();
      await appContext.renderInsightsPage();
    }else{
      confirmBtn.disabled=input.value!=="Reset";
    }
  });

appContext.$("giveawayStatus")?.addEventListener("change",appContext.syncGiveawayWinnerField);

appContext.syncGiveawayWatermarkControls();

appContext.syncGiveawayPrivacyControls();

appContext.$("giveawayCancelBtn").addEventListener("click", appContext.closeGiveawayForm);

appContext.$("giveawayImageFile").addEventListener("change", ()=>{
    const files=Array.from(appContext.$("giveawayImageFile").files||[]);
    if(!files.length) return;

    const remaining=Math.max(0,appContext.GIVEAWAY_PHOTO_LIMIT-appContext.giveawayPhotoItems.length);
    if(!remaining){
      appContext.showToast(`Giveaway photos are limited to ${appContext.GIVEAWAY_PHOTO_LIMIT}`);
      appContext.$("giveawayImageFile").value="";
      return;
    }

    // Save edits to the CURRENT photo before appending anything. This must
    // happen before push(): when the giveaway has no photos yet, index 0 will
    // become the first new item, and committing afterward would overwrite that
    // new item's object URL with the old blank editor state.
    if(appContext.giveawayPhotoItems.length) appContext.commitGiveawayActiveEditorItem();

    const firstNewPhotoIndex=appContext.giveawayPhotoItems.length;
    const accepted=files.slice(0,remaining);
    accepted.forEach(file=>{
      const objectUrl=URL.createObjectURL(file);
      appContext.giveawayPhotoItems.push(appContext.newGiveawayPhotoItem(objectUrl,file));
    });

    if(files.length>remaining){
      appContext.showToast(`Added ${remaining} photo${remaining===1?"":"s"} · maximum ${appContext.GIVEAWAY_PHOTO_LIMIT}`);
    }

    appContext.$("giveawayImageFile").value="";

    // The prior item was already committed above. Load the first newly-added
    // photo without another commit, so its preview and editor controls remain
    // intact.
    appContext.loadGiveawayEditorItem(firstNewPhotoIndex,{commitCurrent:false});
  });

appContext.$("giveawayImagePreview")?.addEventListener("click",event=>{
    const selectBtn=event.target.closest("[data-giveaway-photo-select]");
    if(selectBtn){
      appContext.loadGiveawayEditorItem(Number(selectBtn.dataset.giveawayPhotoSelect||0));
      return;
    }

    const moveBtn=event.target.closest("[data-giveaway-photo-move]");
    if(moveBtn){
      appContext.commitGiveawayActiveEditorItem();
      const step=Number(moveBtn.dataset.giveawayPhotoMove||0);
      const from=appContext.giveawaySelectedPhotoIndex;
      const to=from+step;
      if(to<0 || to>=appContext.giveawayPhotoItems.length) return;
      [appContext.giveawayPhotoItems[from],appContext.giveawayPhotoItems[to]]=[appContext.giveawayPhotoItems[to],appContext.giveawayPhotoItems[from]];
      appContext.giveawaySelectedPhotoIndex=to;
      // Current state was committed before the swap; do not commit it again
      // into the item that now occupies the destination index.
      appContext.loadGiveawayEditorItem(to,{commitCurrent:false});
      return;
    }

    const removeBtn=event.target.closest("[data-giveaway-photo-remove]");
    if(removeBtn){
      const index=Number(removeBtn.dataset.giveawayPhotoRemove||0);
      // Preserve edits on the selected photo before the array indices change.
      appContext.commitGiveawayActiveEditorItem();
      const item=appContext.giveawayPhotoItems[index];
      if(item?.file && item.objectUrl){
        try{ URL.revokeObjectURL(item.objectUrl); }catch{}
      }
      appContext.giveawayPhotoItems.splice(index,1);
      appContext.giveawaySelectedPhotoIndex=Math.max(0,Math.min(index,appContext.giveawayPhotoItems.length-1));
      appContext.loadGiveawayEditorItem(appContext.giveawaySelectedPhotoIndex,{commitCurrent:false});
    }
  });

appContext.$("giveawayWatermarkOriginalBtn")?.addEventListener("click", ()=>appContext.setGiveawayImageWatermark("original"));

appContext.$("giveawayWatermarkApplyBtn")?.addEventListener("click", ()=>appContext.setGiveawayImageWatermark("full"));

appContext.$("giveawayWatermarkWebsiteBtn")?.addEventListener("click", ()=>appContext.setGiveawayImageWatermark("website"));

appContext.$("giveawayPrivacyOriginalBtn")?.addEventListener("click", ()=>appContext.setGiveawayImagePsaPrivacy(false));

appContext.$("giveawayPrivacyHideBtn")?.addEventListener("click", ()=>appContext.setGiveawayImagePsaPrivacy(true));

appContext.giveawayOverlay.addEventListener("click", e=>{
    if(e.target === appContext.giveawayOverlay) appContext.closeGiveawayForm();
  });

appContext.$("giveawayForm").addEventListener("submit", async e=>{
    e.preventDefault();
    if(!appContext.requireOwner()) return;

    const id = appContext.$("giveawayId").value || null;
    const endsValue = appContext.$("giveawayEndsAt").value;
    const gaveAwayDateValue = appContext.$("giveawayGaveAwayDate")?.value || "";

    if(!appContext.requireOwner()) return;

    appContext.commitGiveawayActiveEditorItem();

    if(appContext.giveawayPhotoItems.length>1 && appContext.giveawayImagesSupported===false){
      appContext.showToast("Multiple giveaway photos need the giveaway images migration in Supabase");
      return;
    }

    let giveawayImageUrl="";
    let giveawayImageUrls=[];
    const status=appContext.$("giveawayStatus").value;
    const existing=id ? appContext.giveaways.find(g=>String(g.id)===String(id)) : null;
    const transitioningToWinner=
      status==="gave_away" &&
      appContext.normalizeFilterValue(existing?.status)!=="gave_away";

    if(!appContext.giveawayPhotoItems.length){
      giveawayImageUrls=[];
      giveawayImageUrl="";
    }else{
      for(let index=0;index<appContext.giveawayPhotoItems.length;index++){
        const item=appContext.giveawayPhotoItems[index];
        let finalUrl="";

        const processed=
          item.watermarkMode==="website" && item.websiteWatermarkedSource
            ? item.websiteWatermarkedSource
            : item.watermarkMode==="full" && item.watermarkedSource
              ? item.watermarkedSource
              : item.privacyApplied && item.privacyMaskedSource
                ? item.privacyMaskedSource
                : item.cleanSource;

        const hasProcessed=Boolean(
          processed &&
          processed!==item.cleanSource &&
          (item.watermarkApplied || item.privacyApplied)
        );

        if(item.file){
          if(hasProcessed){
            appContext.showToast(`Uploading giveaway photo ${index+1}/${appContext.giveawayPhotoItems.length}…`);
            finalUrl=await appContext.uploadOwnerProcessedImage(
              processed,
              "giveaway-images",
              `Giveaway photo ${index+1}`
            );
          }else{
            appContext.showToast(`Uploading giveaway photo ${index+1}/${appContext.giveawayPhotoItems.length}…`);
            finalUrl=await appContext.uploadGiveawayImage(item.file,item.cleanSource,index+1);
          }
        }else if(hasProcessed){
          appContext.showToast(`Uploading processed giveaway photo ${index+1}/${appContext.giveawayPhotoItems.length}…`);
          finalUrl=await appContext.uploadOwnerProcessedImage(
            processed,
            "giveaway-images",
            `Giveaway photo ${index+1}`
          );
        }else{
          finalUrl=appContext.safeHttpUrl(item.cleanSource||"");
        }

        if(!finalUrl){
          appContext.showToast(`Could not save giveaway photo ${index+1}`);
          return;
        }

        giveawayImageUrls.push(finalUrl);
      }

      // The winner artwork is applied only to the cover image. Extra photos
      // remain available in the public gallery unchanged.
      const shouldCreateWinnerFrame=status==="gave_away" && (transitioningToWinner || appContext.giveawayPhotoItems[0]?.file);
      if(shouldCreateWinnerFrame && giveawayImageUrls[0]){
        try{
          appContext.showToast("Preparing winner cover image…");
          const framed=await appContext.renderGiveawayWinnerListingImage(giveawayImageUrls[0],0.94);
          const uploaded=await appContext.uploadOwnerProcessedImage(
            framed,
            "giveaway-images",
            "Winner listing image"
          );
          if(!uploaded) return;
          giveawayImageUrls[0]=uploaded;
        }catch(error){
          console.error("Could not create winner listing image:",error);
          appContext.showToast("Could not apply the winner frame");
          return;
        }
      }

      giveawayImageUrl=giveawayImageUrls[0]||"";
    }

    const winnerName=appContext.$("giveawayWinnerName").value.trim().slice(0,120);
    const winnerProfileRaw=appContext.$("giveawayWinnerProfileUrl").value.trim();
    const winnerProfileUrl=winnerProfileRaw ? appContext.safePublicProfileUrl(winnerProfileRaw) : "";

    if(winnerProfileRaw && !winnerProfileUrl){
      appContext.showToast("Please enter a valid http:// or https:// user profile link");
      appContext.$("giveawayWinnerProfileUrl").focus();
      return;
    }

    if(status==="gave_away" && !winnerName){
      appContext.showToast("Winner display name is required");
      appContext.$("giveawayWinnerName").focus();
      return;
    }

    const entryFormRaw=appContext.$("giveawayEntryFormUrl").value.trim();
    if(entryFormRaw && !appContext.safeHttpUrl(entryFormRaw)){
      appContext.showToast("Please enter a valid http:// or https:// Entry Form URL");
      appContext.$("giveawayEntryFormUrl").focus();
      return;
    }

    const facebookPostRaw=appContext.$("giveawayFacebookPostUrl").value.trim();
    if(facebookPostRaw && !appContext.safeHttpUrl(facebookPostRaw)){
      appContext.showToast("Please enter a valid Facebook Giveaway Post URL");
      appContext.$("giveawayFacebookPostUrl").focus();
      return;
    }

    const instagramPostRaw=appContext.$("giveawayInstagramPostUrl").value.trim();
    if(instagramPostRaw && !appContext.safeHttpUrl(instagramPostRaw)){
      appContext.showToast("Please enter a valid Instagram Giveaway Post URL");
      appContext.$("giveawayInstagramPostUrl").focus();
      return;
    }

    const giveawayEndsIso=endsValue ? appContext.giveawayEndsInputToIso(endsValue) : null;
    if(endsValue && !giveawayEndsIso){
      appContext.showToast("Please enter a valid giveaway end date/time");
      appContext.$("giveawayEndsAt").focus();
      return;
    }

    const payload = {
      title: appContext.$("giveawayTitle").value.trim(),
      card_name: appContext.$("giveawayCardName").value.trim(),
      image_url: giveawayImageUrl,
      images: giveawayImageUrls,
      status,
      ends_at: giveawayEndsIso,
      how_to_enter: appContext.$("giveawayHowToEnter").value.trim(),
      details: appContext.$("giveawayDetails").value.trim(),
      giveaway_code:String(appContext.$("giveawayCode").value||"").trim().toUpperCase().slice(0,40) || null,
      entry_form_url:appContext.safeHttpUrl(appContext.$("giveawayEntryFormUrl").value.trim()) || null,
      require_facebook:appContext.$("giveawayRequireFacebook").checked,
      require_instagram:appContext.$("giveawayRequireInstagram").checked,
      require_comment:appContext.$("giveawayRequireComment").checked,
      require_website_code:appContext.$("giveawayRequireWebsiteCode").checked,
      facebook_post_url:appContext.safeHttpUrl(facebookPostRaw) || null,
      instagram_post_url:appContext.safeHttpUrl(instagramPostRaw) || null,
      bonus_join_facebook_group:appContext.$("giveawayBonusFacebookGroup").checked,
      bonus_share_facebook:appContext.$("giveawayBonusShareFacebook").checked,
      bonus_tag_friends:appContext.$("giveawayBonusTagFriends").checked,
      bonus_share_instagram_story:appContext.$("giveawayBonusInstagramStory").checked,
      gave_away_date: status==="gave_away"
        ? (gaveAwayDateValue || existing?.gave_away_date || new Date().toISOString().slice(0,10))
        : null,
      winner_name: status==="gave_away" ? winnerName : null,
      winner_profile_url: status==="gave_away" ? (winnerProfileUrl || null) : null,
      winner_sort_order: status==="gave_away"
        ? (
            Number.isFinite(Number(existing?.winner_sort_order))
              ? Number(existing.winner_sort_order)
              : appContext.giveaways.filter(appContext.isPastGiveawayWinner).length
          )
        : null,
      winner_announced_at: status==="gave_away"
        ? (existing?.winner_announced_at || new Date().toISOString())
        : null
    };

    const { error } = await appContext.saveGiveaway(payload, id);
    if(error){
      console.error(error);
      appContext.showToast("Could not save giveaway");
      return;
    }

    appContext.closeGiveawayForm();
    await appContext.loadGiveaways();
    appContext.renderGiveawayPage();
    appContext.showToast(id ? "Giveaway updated" : "Giveaway added");
  });
}
