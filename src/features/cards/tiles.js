/** V93 beta: features/cards/tiles. Shared dependencies are explicit on appContext. */
export function register(appContext){
function relatedCardHTML(c){
    const image = appContext.getImages(c)[0] || "";
    return `
      <button type="button" class="related-card" data-related-card-id="${appContext.escapeHtml(c.id)}" data-discovery-source="related" aria-label="View ${appContext.escapeHtml(c.name)}">
        <div class="related-card-image-wrap">
          ${image ? `<img src="${appContext.escapeHtml(image)}" alt="${appContext.escapeHtml(c.name)}" loading="lazy" decoding="async" fetchpriority="low">` : `<div class="related-card-no-image">No image</div>`}
          ${appContext.statusCornerHTML(c)}
        </div>
        <div class="related-card-info">
          <div class="related-card-name">${appContext.escapeHtml(c.name)}</div>
          ${c.card_code ? `<div class="related-card-code">${appContext.escapeHtml(c.card_code)}</div>` : ""}
          <div class="related-card-meta">
            ${c.game ? `<span>${appContext.escapeHtml(c.game)}</span>` : ""}
            ${c.era ? `<span>${appContext.escapeHtml(c.era)}</span>` : ""}
          </div>
        </div>
      </button>
    `;
  }

function cardTileHTML(c, renderIndex=999){
    const color = appContext.RARITY_COLOR[c.rarity] || "var(--r-common)";
    const shimmer = appContext.SHIMMER_RARITIES.has(c.rarity);
    const format = appContext.effectiveFormat(c);
    const grades = appContext.validGradingEntries(c);
    const baseGradeText = grades.length
      ? appContext.gradingSummaryLabel(c)
      : (format === "Sealed" ? "Sealed" : (appContext.rawConditionShortLabel(c.condition) || "—"));
    const firstGradePop=appContext.gradingPopSummaryLabel(c);
    const gradeText=firstGradePop ? `${baseGradeText} · ${firstGradePop}` : baseGradeText;

    const gradeFilterText = grades.length
      ? (grades.length===1
          ? `${grades[0].company} ${grades[0].grade || ""}`.trim()
          : baseGradeText)
      : (format === "Sealed"
          ? "Sealed"
          : (appContext.rawConditionFilterLabel(c.condition) || gradeText));

    const seriesText = appContext.normalizeStoredLabel(c.series || "");
    return `
      <div class="card ${shimmer ? "shimmer" : ""} ${appContext.isCompareSelected(c.id) ? "compare-selected" : ""} ${appContext.normalizeFilterValue(c.availability)==="collection (nfs)" ? "nfs-collection-card" : ""}" style="--stripe:${appContext.normalizeFilterValue(c.availability)==="collection (nfs)" ? "#a855f7" : color}" data-shimmer="${shimmer}" data-card-id="${appContext.escapeHtml(c.id)}" tabindex="0" role="button" aria-label="View details for ${appContext.escapeHtml(c.name)}">
        ${appContext.cardThumbHTML(c, renderIndex)}
        <div class="card-body clean-card-body">
          <div class="card-actions owner-only quick-card-actions">
            <button type="button"
                    class="icon-btn quick-card-menu-toggle"
                    data-action="quick-menu"
                    data-id="${appContext.escapeHtml(c.id)}"
                    title="Owner actions"
                    aria-label="Owner actions for ${appContext.escapeHtml(c.name)}"
                    aria-expanded="false">⋯</button>
            <div class="quick-card-menu" data-quick-menu-for="${appContext.escapeHtml(c.id)}" hidden>
              <button type="button" data-action="edit" data-id="${appContext.escapeHtml(c.id)}">Edit</button>
              <button type="button" data-action="clone" data-id="${appContext.escapeHtml(c.id)}">Clone</button>
              <button type="button" data-action="fb-post" data-id="${appContext.escapeHtml(c.id)}">Generate FB Post</button>
              <div class="quick-card-menu-separator"></div>
              ${appContext.normalizeFilterValue(c.availability)!=="available" ? `<button type="button" data-action="availability" data-status="Available" data-id="${appContext.escapeHtml(c.id)}">Mark Available</button>` : ""}
              ${appContext.normalizeFilterValue(c.availability)!=="reserved" ? `<button type="button" data-action="availability" data-status="Reserved" data-id="${appContext.escapeHtml(c.id)}">Mark Reserved</button>` : ""}
              ${appContext.normalizeFilterValue(c.availability)!=="collection (nfs)" ? `<button type="button" data-action="availability" data-status="Collection (NFS)" data-id="${appContext.escapeHtml(c.id)}">Mark NFS</button>` : ""}
              ${appContext.normalizeFilterValue(c.availability)!=="sold" ? `<button type="button" class="quick-card-danger-soft" data-action="availability" data-status="Sold" data-id="${appContext.escapeHtml(c.id)}">Mark Sold</button>` : ""}
              ${appContext.lifecycleSupported ? `
                <div class="quick-card-menu-separator"></div>
                ${appContext.cardLifecycle(c)==="live"
                  ? `<button type="button" data-action="lifecycle" data-status="draft" data-id="${appContext.escapeHtml(c.id)}">Hide from visitors</button>`
                  : (appContext.cardLifecycle(c)==="draft"
                      ? `<button type="button" data-action="lifecycle" data-status="live" data-id="${appContext.escapeHtml(c.id)}">Unhide / Publish</button>`
                      : "")}
                <button type="button" class="quick-card-danger-soft" data-action="lifecycle" data-status="archived" data-id="${appContext.escapeHtml(c.id)}">Archive</button>
              ` : ""}
              <div class="quick-card-menu-separator"></div>
              <button type="button" class="quick-card-danger-hard" data-action="delete-listing" data-id="${appContext.escapeHtml(c.id)}">Delete Permanently</button>
            </div>
          </div>

          <div class="clean-card-main">
            <div class="clean-card-title-row">
              <div class="card-name clean-card-name">${appContext.escapeHtml(c.name).toUpperCase()}</div>
              ${appContext.isOwnerMode() && appContext.cardLifecycle(c)==="draft"
                ? `<span class="owner-hidden-listing-badge" title="Hidden from normal visitors">HIDDEN</span>`
                : ""}
              <div class="card-title-actions">
                <button type="button"
                  class="compare-card-btn ${appContext.isCompareSelected(c.id) ? "active" : ""}"
                  data-compare-id="${appContext.escapeHtml(c.id)}"
                  aria-pressed="${appContext.isCompareSelected(c.id) ? "true" : "false"}"
                  title="Compare ${appContext.escapeHtml(c.name)}">
                  ⇄ <span>${appContext.isCompareSelected(c.id) ? "Selected" : "Compare"}</span>
                </button>
                <button type="button"
                  class="favorite-btn title-favorite-btn ${appContext.isFavorite(c.id) ? "active" : ""}"
                  data-favorite-id="${appContext.escapeHtml(c.id)}"
                  title="${appContext.isFavorite(c.id) ? "Remove from favorites" : "Add to favorites"}"
                  aria-label="${appContext.isFavorite(c.id) ? "Remove from favorites" : "Add to favorites"}">${appContext.isFavorite(c.id) ? "♥" : "♡"}</button>
              </div>
            </div>
            <div class="clean-card-reference-toggle-row">
              ${(c.card_code || c.year) ? `<div class="clean-card-reference">${c.card_code ? `<span>${appContext.escapeHtml(c.card_code)}</span>` : ""}${c.card_code && c.year ? `<span class="clean-card-reference-dot">·</span>` : ""}${c.year ? `<span>${appContext.escapeHtml(c.year)}</span>` : ""}</div>` : `<span class="clean-card-reference-spacer" aria-hidden="true"></span>`}
              <button type="button"
                      class="card-overview-pill-toggle"
                      data-card-pill-toggle
                      aria-expanded="false"
                      title="Show card metadata">
                <span>Details</span><span class="pill-toggle-chevron" aria-hidden="true">▾</span>
              </button>
            </div>
            ${appContext.normalizeFilterValue(c.availability) === "sold" && c.sold_at ? `<div class="sold-archive-date">Sold ${appContext.escapeHtml(appContext.formatSoldDate(c.sold_at))}</div>` : ""}
            <div class="clean-card-subrow clean-all-pills card-overview-collapsible-pills" hidden>
              ${c.game ? `<button type="button" class="clean-meta-pill clean-game-pill filter-pill-btn ${appContext.selectedSetMatches(appContext.pillFilterState.game, c.game) && appContext.pillFilterState.game.size ? "pill-selected" : ""}" data-pill-filter="game" data-pill-value="${appContext.escapeHtml(String(c.game))}" title="Filter by ${appContext.escapeHtml(String(c.game))}">${appContext.escapeHtml(String(c.game))}</button>` : ""}
              ${(grades.length || format === "Raw" || format === "Sealed")
                ? `<button type="button" class="clean-grade-badge filter-pill-btn ${appContext.pillFilterState.grade.size && appContext.selectedSetMatches(appContext.pillFilterState.grade,gradeFilterText) ? "pill-selected" : ""}" data-pill-filter="grade" data-pill-value="${appContext.escapeHtml(gradeFilterText)}" title="Filter by ${appContext.escapeHtml(gradeFilterText)}">${appContext.escapeHtml(gradeText)}</button>`
                : `<span class="clean-grade-badge">${appContext.escapeHtml(gradeText)}</span>`}
              ${c.availability ? `<button type="button" class="clean-meta-pill clean-availability-pill filter-pill-btn ${appContext.selectedSetMatches(appContext.pillFilterState.availability, c.availability) && appContext.pillFilterState.availability.size ? "pill-selected" : ""}" data-pill-filter="availability" data-pill-value="${appContext.escapeHtml(appContext.canonicalAvailability(c.availability))}" title="Filter by ${appContext.escapeHtml(appContext.canonicalAvailability(c.availability))}">${appContext.escapeHtml(appContext.canonicalAvailability(c.availability))}</button>` : ""}
              ${c.language ? `<button type="button" class="clean-meta-pill clean-language-pill filter-pill-btn ${appContext.selectedSetMatches(appContext.pillFilterState.language, c.language) && appContext.pillFilterState.language.size ? "pill-selected" : ""}" data-pill-filter="language" data-pill-value="${appContext.escapeHtml(String(c.language).toUpperCase())}" title="Filter by ${appContext.escapeHtml(String(c.language).toUpperCase())}">${appContext.escapeHtml(String(c.language).toUpperCase())}</button>` : ""}
              ${c.era ? `<button type="button" class="clean-meta-pill clean-era-pill filter-pill-btn ${appContext.selectedSetMatches(appContext.pillFilterState.era, c.era) && appContext.pillFilterState.era.size ? "pill-selected" : ""}" data-pill-filter="era" data-pill-value="${appContext.escapeHtml(appContext.normalizeStoredLabel(c.era))}" title="Filter by ${appContext.escapeHtml(appContext.normalizeStoredLabel(c.era))}">${appContext.escapeHtml(appContext.normalizeStoredLabel(c.era))}</button>` : ""}
              ${seriesText ? `<button type="button" class="clean-meta-pill clean-series-pill filter-pill-btn ${appContext.selectedSetMatches(appContext.pillFilterState.series, seriesText) && appContext.pillFilterState.series.size ? "pill-selected" : ""}" data-pill-filter="series" data-pill-value="${appContext.escapeHtml(seriesText)}" title="Filter by ${appContext.escapeHtml(seriesText)}">${appContext.escapeHtml(seriesText)}</button>` : ""}
            </div>
          </div>

          ${appContext.cardPriceDisplayHTML(c)}
          ${appContext.highValueContactAlertHTML(c,true)}

          ${(() => {
            const displayNotes=appContext.normalizeFilterValue(c.availability)==="collection (nfs)"
              ? appContext.stripPriceNegotiabilityMarker(c.notes||"")
              : (c.notes||"");
            return displayNotes ? `<div class="notes clean-notes">${appContext.escapeHtml(displayNotes)}</div>` : "";
          })()}
          ${appContext.isOwnerMode() && appContext.normalizeFilterValue(c.availability)==="reserved"
            ? `<div class="owner-reserved-age" data-owner-reserved-age-card="${appContext.escapeHtml(c.id)}">Checking reserved age…</div>`
            : ""}
          ${appContext.isOwnerMode() ? `<div class="owner-only owner-private-analytics clean-owner-views"
               title="Qualified views · card kept open for at least 5 seconds">
            👁 ${appContext.freshQualifiedViewDisplay(c.id)}
          </div>` : ""}
        </div>
      </div>
    `;
  }

function wireShimmer(container){
    container.querySelectorAll('.card[data-shimmer="true"]').forEach(el=>{
      el.addEventListener("mousemove", (e)=>{
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", ((e.clientX - r.left)/r.width*100) + "%");
        el.style.setProperty("--my", ((e.clientY - r.top)/r.height*100) + "%");
      });
    });
  }

async function quickSetCardAvailability(card,status){
    if(!card || !appContext.requireOwner("change card availability")) return false;

    const allowed=new Set(["Available","Reserved","Sold","Collection (NFS)"]);
    if(!allowed.has(status)) return false;

    const current=appContext.normalizeFilterValue(card.availability||"");
    if(current===appContext.normalizeFilterValue(status)) return true;

    if(status==="Sold"){
      const ok=confirm(`Mark "${card.name}" as Sold?`);
      if(!ok) return false;

      // Preserve the card's buyer-interest state at the moment of sale.
      // This is best-effort and never blocks the inventory update.
      await appContext.captureSaleConversionSnapshot(card);
    }

    const candidate={...card,availability:status};

    // Let the database trigger stamp sold_at when supported. If moving out
    // of Sold, the existing cardToDb behavior omits sold_at and the DB trigger
    // can clear it without exposing any new public write path.
    if(status!=="Sold") candidate.sold_at=null;

    const saved=await appContext.updateCardStorage(candidate);
    if(!saved) return false;

    const index=appContext.getCardIndexById(card.id);
    if(index>-1) appContext.cards[index]=saved;
    appContext.invalidateOwnerReservedAgeCache();
    appContext.showToast(status==="Collection (NFS)" ? "Marked NFS" : `Marked ${status}`);
    appContext.router();
    return true;
  }

function closeQuickCardMenus(container,except=null){
    container.querySelectorAll(".quick-card-menu").forEach(menu=>{
      if(menu===except) return;
      menu.hidden=true;
      const id=menu.dataset.quickMenuFor;
      const toggle=id ? container.querySelector(`[data-action="quick-menu"][data-id="${CSS.escape(id)}"]`) : null;
      if(toggle) toggle.setAttribute("aria-expanded","false");
    });
  }

async function stepListingGallery(wrap,card,step){
    if(!wrap || !card || (!appContext.isOwnerMode() && !appContext.isLiveLifecycle(card))) return false;

    await appContext.ensureCardImagesLoaded(card);
    const images=appContext.getImages(card);
    const prevBtn=wrap.querySelector(".listing-gallery-arrow-prev");
    const nextBtn=wrap.querySelector(".listing-gallery-arrow-next");
    const counter=wrap.querySelector("[data-listing-gallery-counter]");
    const countBadge=wrap.querySelector("[data-listing-image-count]");

    if(countBadge){
      countBadge.textContent=`▧ ${images.length}`;
      countBadge.setAttribute("aria-label",`${images.length} photo${images.length===1?"":"s"}`);
    }

    if(images.length<=1){
      if(prevBtn) prevBtn.hidden=true;
      if(nextBtn) nextBtn.hidden=true;
      if(counter) counter.hidden=true;
      return false;
    }

    if(prevBtn) prevBtn.hidden=false;
    if(nextBtn) nextBtn.hidden=false;
    if(counter) counter.hidden=false;

    let index=Number(wrap.dataset.listingGalleryIndex||0);
    if(!Number.isFinite(index)) index=0;
    index=(index+Number(step||1)+images.length)%images.length;
    wrap.dataset.listingGalleryIndex=String(index);

    const img=wrap.querySelector(".thumb");
    if(img){
      img.classList.add("listing-image-switching");
      img.src=images[index];
      img.alt=`${card.name} photo ${index+1}`;
      const settle=()=>img.classList.remove("listing-image-switching");
      if(img.complete) requestAnimationFrame(settle);
      else img.addEventListener("load",settle,{once:true});
    }

    if(counter) counter.textContent=`${index+1} / ${images.length}`;

    const preload=new Image();
    preload.decoding="async";
    preload.src=images[(index+(step>=0?1:-1)+images.length)%images.length];

    // Deliberate overview interest: count once per card per browser session,
    // regardless of how many times the visitor continues switching images.
    appContext.recordOverviewPhotoInteraction(card.id).catch(()=>{});
    return true;
  }

function wireCardActions(container){
    const preloadFromTarget=target=>{
      const cardTile=target?.closest?.(".card[data-card-id]");
      if(!cardTile) return;
      const card=appContext.getCardById(cardTile.dataset.cardId||"");
      if(card) appContext.preloadCardDetailsMedia?.(card);
    };

    container.addEventListener("pointerover",e=>{
      if(e.pointerType && e.pointerType!=="mouse" && e.pointerType!=="pen") return;
      preloadFromTarget(e.target);
    },{passive:true});

    container.addEventListener("focusin",e=>{
      preloadFromTarget(e.target);
    });

    container.addEventListener("click", async (e)=>{
      const galleryBtn=e.target.closest("[data-listing-gallery-step][data-id]");
      if(galleryBtn){
        e.preventDefault();
        e.stopPropagation();
        const card=appContext.getCardById(galleryBtn.dataset.id||"");
        const wrap=galleryBtn.closest("[data-listing-gallery]");
        if(card&&wrap){
          await appContext.stepListingGallery(wrap,card,Number(galleryBtn.dataset.listingGalleryStep||1));
        }
        return;
      }

      const pillToggle=e.target.closest("[data-card-pill-toggle]");
      if(pillToggle){
        e.preventDefault();
        e.stopPropagation();
        const cardTile=pillToggle.closest(".card[data-card-id]");
        const pillRow=cardTile?.querySelector(".card-overview-collapsible-pills");
        if(pillRow){
          const open=pillToggle.getAttribute("aria-expanded")==="true";
          const nextOpen=!open;
          pillToggle.setAttribute("aria-expanded",nextOpen?"true":"false");
          pillToggle.title=nextOpen?"Hide card metadata":"Show card metadata";
          pillRow.hidden=!nextOpen;
        }
        return;
      }

      const compareBtn=e.target.closest(".compare-card-btn[data-compare-id]");
      if(compareBtn){
        e.stopPropagation();
        const id=String(compareBtn.dataset.compareId||"");
        const active=appContext.toggleCompareCard(id);
        compareBtn.classList.toggle("active",active);
        compareBtn.setAttribute("aria-pressed",active?"true":"false");
        const label=compareBtn.querySelector("span");
        if(label) label.textContent=active ? "Selected" : "Compare";
        compareBtn.closest(".card")?.classList.toggle("compare-selected",active);
        return;
      }

      const favoriteBtn = e.target.closest(".favorite-btn[data-favorite-id]");
      if(favoriteBtn){
        e.stopPropagation();
        const id = favoriteBtn.dataset.favoriteId;
        const active = appContext.toggleFavorite(id);
        favoriteBtn.classList.toggle("active", active);
        favoriteBtn.textContent = active ? "♥" : "♡";
        favoriteBtn.title = active ? "Remove from favorites" : "Add to favorites";
        favoriteBtn.setAttribute("aria-label", favoriteBtn.title);
        if(appContext.currentRoute() === "favorites" && !active){
          appContext.renderFavoritesPage();
        }
        return;
      }

      const filterPill = e.target.closest(".filter-pill-btn[data-pill-filter]");
      if(filterPill){
        e.stopPropagation();
        const type = filterPill.dataset.pillFilter;
        const value = filterPill.dataset.pillValue;
        const bucket = appContext.pillFilterState[type];

        if(bucket && value){
          if(bucket.has(value)) bucket.delete(value);
          else bucket.add(value);
        }

        appContext.activeQuickFilter = "all";
        appContext.updateListingUrlFromControls();

        const route = appContext.currentRoute();
        if(appContext.isInventoryRoute(route)){
          appContext.renderInventoryPage(route);
        }else{
          location.hash = "#/inventory";
        }
        return;
      }

      const highValueContact=e.target.closest("[data-high-value-contact]");
      if(highValueContact){
        e.preventDefault();
        e.stopPropagation();
        const cardTile=highValueContact.closest(".card[data-card-id]");
        const cardId=appContext.safeCardId(cardTile?.dataset?.cardId||"");
        if(cardId) appContext.recordCardEngagement(cardId,"contact_open","High Value CTA").catch(()=>{});
        appContext.goToRoute("contact");
        return;
      }

      const btn = e.target.closest("button[data-action]");
      if(btn){
        e.stopPropagation();

        const id=String(btn.dataset.id||"");
        const action=String(btn.dataset.action||"");

        if(action==="quick-menu"){
          if(!appContext.requireOwner("open card quick actions")) return;
          const menu=container.querySelector(`[data-quick-menu-for="${CSS.escape(id)}"]`);
          if(!menu) return;
          const opening=menu.hidden;
          appContext.closeQuickCardMenus(container,opening ? menu : null);
          menu.hidden=!opening;
          btn.setAttribute("aria-expanded",opening ? "true" : "false");
          return;
        }

        const card=appContext.getCardById(id);
        if(!card) return;

        appContext.closeQuickCardMenus(container);

        if(action==="edit"){
          if(!appContext.requireOwner("edit card")) return;
          appContext.openEditModal(card);
        }else if(action==="clone"){
          if(!appContext.requireOwner("clone card")) return;
          appContext.openCloneOptions(card);
        }else if(action==="fb-post"){
          if(!appContext.requireOwner("generate Facebook post")) return;

          // Stay in the same tab. Save the exact current listing URL + scroll
          // position first, then navigate to the Single Card Post Generator.
          // Browser Back will return to this exact listing state and restore
          // the previous scroll position.
          const returnHash=location.hash||"#/inventory";
          appContext.rememberReturnScroll(returnHash);

          location.hash=
            `#/fb-tools?mode=single&card=${encodeURIComponent(card.id)}`;
        }else if(action==="availability"){
          if(!appContext.requireOwner("change card availability")) return;
          const status=String(btn.dataset.status||"");
          await appContext.quickSetCardAvailability(card,status);
        }else if(action==="lifecycle"){
          if(!appContext.requireOwner("change listing lifecycle")) return;
          const status=String(btn.dataset.status||"");
          if(!["live","draft","archived"].includes(status)) return;

          const prompt=status==="archived"
            ? `Archive "${card.name}"?\n\nArchived listings remain recoverable in Owner tools and are hidden from visitors.`
            : (status==="draft"
                ? `Hide "${card.name}" from normal visitors?\n\nIt will remain visible to you in Owner Mode and can be edited or published later.`
                : `Unhide "${card.name}"?\n\nIt will become visible to normal visitors immediately.`);

          if(!appContext.confirmOwnerAction(prompt)) return;

          const ok=await appContext.setCardLifecycle(card,status);
          if(ok){
            appContext.showToast(
              status==="archived"
                ? "Listing archived"
                : (status==="draft" ? "Listing hidden from visitors" : "Listing published")
            );
            appContext.router();
          }
        }else if(action==="delete-listing"){
          const ok=await appContext.deleteListingPermanently(card);
          if(ok) appContext.router();
        }
        return;
      }

      const tile = e.target.closest(".card[data-card-id]");
      if(!tile) return;
      const card = appContext.getCardById(tile.dataset.cardId||"");
      if(card) appContext.openCardRoute(card.id,tile.dataset.discoverySource||"");
    });
  }

  Object.assign(appContext,{relatedCardHTML,cardTileHTML,wireShimmer,quickSetCardAvailability,closeQuickCardMenus,stepListingGallery,wireCardActions});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.listingGalleryTouchState = null;

appContext.view.addEventListener("touchstart",e=>{
    const cardTile=e.target.closest?.(".card[data-card-id]");
    if(cardTile){
      const card=appContext.getCardById(cardTile.dataset.cardId||"");
      if(card) appContext.preloadCardDetailsMedia?.(card);
    }

    const wrap=e.target.closest?.("[data-listing-gallery]");
    if(!wrap || e.touches.length!==1) return;
    const touch=e.touches[0];
    appContext.listingGalleryTouchState={wrap,x:touch.clientX,y:touch.clientY};
  },{passive:true});

appContext.view.addEventListener("touchend",async e=>{
    const state=appContext.listingGalleryTouchState;
    appContext.listingGalleryTouchState=null;
    if(!state || !e.changedTouches.length) return;

    const touch=e.changedTouches[0];
    const dx=touch.clientX-state.x;
    const dy=touch.clientY-state.y;

    // Only intercept a real horizontal swipe. Normal taps are intentionally
    // left untouched so Safari can emit the standard click event, which is
    // handled by the delegated card click listener above.
    if(Math.abs(dx)>=44 && Math.abs(dx)>Math.abs(dy)){
      const card=appContext.getCardById(state.wrap.dataset.listingGallery||"");
      if(!card) return;

      if(e.cancelable) e.preventDefault();
      e.stopPropagation();
      await appContext.stepListingGallery(state.wrap,card,dx<0?1:-1);
    }
  },{passive:false});

appContext.view.addEventListener("touchcancel",()=>{
    appContext.listingGalleryTouchState=null;
  },{passive:true});
}
