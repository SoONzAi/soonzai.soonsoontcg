/** V93 beta: features/inventory/page. Shared dependencies are explicit on appContext. */
export function register(appContext){
function syncQuickFilterUI(){
    const wrap = appContext.$("quickFilters");
    if(!wrap) return;
    wrap.querySelectorAll(".quick-filter").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.quick === appContext.activeQuickFilter);
    });

    const activeLabel=appContext.$("desktopQuickFiltersActive");
    if(activeLabel){
      const labels={
        all:"All",
        graded:"Slabs",
        raw:"Raw",
        sealed:"Sealed",
        championship:"Championship",
        vintage:"Vintage",
        trending:"Trending"
      };
      activeLabel.textContent=labels[appContext.activeQuickFilter] || "All";
    }
  }

function inventoryQuickFiltersHTML(){
    return [
      ["all","All","All"],
      ["graded","Slabs","Slabs"],
      ["raw","Raw","Raw"],
      ["sealed","Sealed","Sealed"],
      ["championship","Championship","Champ"],
      ["vintage","Vintage","Vintage"],
      ["trending","🔥 Trending","Trending"]
    ].map(([value,desktopLabel,mobileLabel])=>
      `<button type="button" class="quick-filter" data-quick="${value}"><span class="quick-filter-label-desktop">${desktopLabel}</span><span class="quick-filter-label-mobile">${mobileLabel}</span></button>`
    ).join("");
  }

function inventoryPageHTML(scopeMeta,scope){
    const isCollection=scope==="collection";
    const compact=appContext.effectiveInventoryViewMode()==="compact";
    const mobileSortOptions=appContext.inventorySortOptions(scope);

    return `
      <div class="page-head listing-page-head">
        <div class="listing-page-title-copy">
          <div class="eyebrow">${appContext.escapeHtml(scopeMeta.eyebrow)}</div>
          <h2>${appContext.escapeHtml(scopeMeta.title)}</h2>
          <p>${appContext.escapeHtml(scopeMeta.description)}</p>
        </div>
      </div>

      ${["inventory","collection"].includes(scope) ? `
        <section class="inventory-game-browser" id="inventoryGameBrowser" aria-label="Browse ${isCollection ? "Collection" : "Inventory"} by game"></section>
      ` : ""}

      <!-- Desktop/mobile top controls only. Keep the filter drawer OUTSIDE
           this flex container so desktop layout cannot treat the drawer as
           another toolbar item. -->
      <div class="inventory-filter-tools listing-filter-tools" data-listing-scope="${appContext.escapeHtml(scope)}">
        <div class="desktop-category-filter-block">
          <button type="button"
                  class="desktop-quick-filters-toggle"
                  id="desktopQuickFiltersToggle"
                  aria-expanded="false"
                  aria-controls="quickFilters">
            <span class="desktop-quick-filters-toggle-title">Categories</span>
            <span class="desktop-quick-filters-active" id="desktopQuickFiltersActive">All</span>
            <span class="desktop-quick-filters-chevron" aria-hidden="true">▾</span>
          </button>
          <div class="quick-filters desktop-quick-filters-collapsible" id="quickFilters">${appContext.inventoryQuickFiltersHTML()}</div>
        </div>

        <div class="inventory-toolbar-context">
          <span class="inventory-result-count" aria-live="polite"><strong id="inventoryResultCount">0</strong> results</span>
          ${appContext.getRecentlyViewedCards().length ? `<a href="#/recent" class="inventory-recent-link">Recently Viewed</a>` : ""}
        </div>

        <div class="inventory-display-tools ${isCollection ? "collection-display-tools" : ""}">
          ${!isCollection && scope!=="inventory" ? `
            <label class="listing-per-page-control" title="Choose how many listings are shown on each page.">
              <span>Show</span>
              <select id="listingPerPageSelect" aria-label="Listings per page">
                ${appContext.LISTING_PER_PAGE_OPTIONS.map(value=>`
                  <option value="${value}" ${appContext.listingPerPage===value?"selected":""}>${value}</option>
                `).join("")}
              </select>
              <span>per page</span>
            </label>
          ` : ""}

          <button type="button"
                  class="view-mode-toggle desktop-compact-view-toggle"
                  id="compactViewToggle"
                  aria-pressed="${compact?"true":"false"}">
            ${compact?"▦ Grid View":"☷ Compact View"}
          </button>

          ${isCollection && appContext.canManageCollectionOrder() ? `
            <button type="button"
                    class="btn-ghost collection-rearrange-btn"
                    id="collectionRearrangeBtn"
                    title="Drag Collection cards into your preferred default order">
              ⇅ Rearrange Cards
            </button>
            <button type="button"
                    class="btn-ghost collection-export-collage-btn owner-only"
                    id="collectionExportCollageBtn"
                    title="Download a high-resolution collage using the first image of each Collection card">
              ⬇ Export Collage
            </button>
          ` : ""}
          ${scope==="inventory" && appContext.canManageCollectionOrder() ? `
            <button type="button"
                    class="btn-ghost collection-rearrange-btn"
                    id="inventoryRearrangeBtn"
                    title="Rearrange Inventory game categories and cards">
              ⇅ Rearrange Inventory
            </button>
            <button type="button"
                    class="btn-ghost collection-export-collage-btn owner-only"
                    id="inventoryExportCollageBtn"
                    title="Download a high-resolution collage using Inventory listing cover images">
              ⬇ Export Collage
            </button>
          ` : ""}
          ${scope==="inventory" && appContext.isOwnerMode() ? `
            <button type="button"
                    class="btn-ghost collection-export-collage-btn owner-only inventory-qr-download-btn"
                    id="inventoryQrDownloadBtn"
                    title="Download the full Inventory QR image">
              ⬇ Inventory QR
            </button>
          ` : ""}

          <button type="button" class="copy-filter-link-btn" id="copyFilterLinkBtn" title="Copy a link to these filters">
            <span class="copy-filter-link-desktop">Copy Filtered Link</span>
            <span class="copy-filter-link-mobile">Copy Filter Link</span>
          </button>
        </div>
      </div>

      <div class="desktop-filter-toggle-row" id="desktopFilterToggleRow">
        <div class="desktop-filter-toggle-actions">
          <div class="desktop-inline-search">
            <input type="search"
                   id="desktopInventorySearch"
                   maxlength="100"
                   autocomplete="off"
                   placeholder="Search name, code, year or series…"
                   aria-label="Search listings">
            <button type="button"
                    class="desktop-inline-search-clear"
                    id="desktopInventorySearchClear"
                    aria-label="Clear search"
                    hidden>×</button>
          </div>

          <button type="button"
                  class="desktop-filter-toggle-btn"
                  id="desktopFilterToggleBtn"
                  aria-expanded="false"
                  aria-controls="filterDrawerShell">
            <span class="desktop-filter-toggle-icon" aria-hidden="true">⌕</span>
            <span>Filters</span>
            <span class="filter-count-badge" id="desktopFilterCountBadge" hidden>0</span>
            <span class="desktop-filter-toggle-summary" id="desktopFilterSummary">No active filters</span>
            <span class="desktop-filter-toggle-chevron" aria-hidden="true">⌄</span>
          </button>

          ${!isCollection ? `
            <label class="desktop-listing-currency-control" title="Choose which stored currency is shown first. No currency conversion is performed.">
              <span>Currency</span>
              <select id="currencyPreference" aria-label="Preferred display currency">
                <option value="USD" ${appContext.getPriceCurrencyPreference()==="USD"?"selected":""}>USD</option>
                <option value="MYR" ${appContext.getPriceCurrencyPreference()==="MYR"?"selected":""}>MYR</option>
                <option value="SGD" ${appContext.getPriceCurrencyPreference()==="SGD"?"selected":""}>SGD</option>
              </select>
            </label>
          ` : ""}
        </div>
        <a href="#/add" class="btn-primary owner-only desktop-filter-add-card">+ Add card</a>
      </div>

      ${["collection","inventory"].includes(scope) && appContext.isMobileOwnerBlocked() && appContext.canManageCollectionOrder() ? `
        <div class="collection-mobile-owner-bar owner-auth-only">
          <button type="button"
                  class="btn-ghost collection-mobile-owner-btn"
                  id="${scope==="collection" ? "collectionMobileOwnerBtn" : "inventoryMobileOwnerBtn"}">
            ⇅ Rearrange ${scope==="collection" ? "Collection" : "Inventory"}
          </button>
          <button type="button"
                  class="btn-ghost collection-mobile-owner-btn"
                  id="${scope==="collection" ? "collectionMobileCollageBtn" : "inventoryMobileCollageBtn"}"
                  title="Download a high-resolution collage using ${scope==="collection" ? "Collection" : "Inventory"} listing cover images">
            ⬇ Export Collage
          </button>
          <button type="button"
                  class="btn-ghost collection-mobile-owner-logout"
                  id="${scope==="collection" ? "collectionMobileOwnerLogoutBtn" : "inventoryMobileOwnerLogoutBtn"}"
                  title="Disable mobile rearrange access">
            Log out
          </button>
        </div>
      ` : ""}

      <div class="mobile-search-filter-row ${!isCollection ? "has-mobile-currency" : ""}">
        <div class="mobile-inventory-search" id="mobileInventorySearchWrap">
          <span class="mobile-inventory-search-icon" aria-hidden="true">⌕</span>
          <input type="search"
                 id="mobileInventorySearch"
                 maxlength="100"
                 autocomplete="off"
                 placeholder="Search cards…"
                 aria-autocomplete="list"
                 aria-controls="mobileSearchSuggestions">
          <button type="button" class="mobile-inventory-search-clear" id="mobileInventorySearchClear" aria-label="Clear search" hidden>×</button>
          <div class="search-suggestions mobile-search-suggestions" id="mobileSearchSuggestions" role="listbox" hidden></div>
        </div>

        <button type="button"
                class="mobile-filter-open-btn mobile-search-filter-btn"
                id="mobileFilterOpenBtn"
                aria-expanded="false">
          Filters <span class="filter-count-badge" id="mobileFilterCountBadge" hidden>0</span>
        </button>

        ${!isCollection ? `
          <label class="mobile-page-currency-control mobile-inline-currency" title="Choose which stored currency is shown first. No currency conversion is performed.">
            <span>Currency</span>
            <select id="mobileHeaderCurrencyPreference" aria-label="Preferred display currency">
              <option value="USD" ${appContext.getPriceCurrencyPreference()==="USD"?"selected":""}>USD</option>
              <option value="MYR" ${appContext.getPriceCurrencyPreference()==="MYR"?"selected":""}>MYR</option>
              <option value="SGD" ${appContext.getPriceCurrencyPreference()==="SGD"?"selected":""}>SGD</option>
            </select>
          </label>
        ` : ""}
      </div>

      <div class="mobile-filter-backdrop" id="mobileFilterBackdrop" hidden></div>

      <div class="mobile-sort-backdrop" id="mobileSortBackdrop" hidden></div>
      <section class="mobile-sort-sheet" id="mobileSortSheet" aria-label="Sort cards" aria-modal="true" role="dialog" hidden>
        <div class="mobile-sort-sheet-handle" aria-hidden="true"></div>
        <div class="mobile-sort-sheet-head">
          <div>
            <strong>Sort cards</strong>
            <span>Choose how listings are ordered</span>
          </div>
          <button type="button" class="btn-ghost mobile-sort-close-btn" id="mobileSortCloseBtn">Done</button>
        </div>
        <div class="mobile-sort-options" id="mobileSortOptions">
          ${mobileSortOptions.map(option=>{
            const displayLabel=String(option.label||"").replace(/^Sort:\s*/i,"");
            return `<button type="button" class="mobile-sort-option" data-mobile-sort-value="${appContext.escapeHtml(option.value)}" data-mobile-sort-label="${appContext.escapeHtml(option.label)}" role="radio" aria-checked="false">
              <span>${appContext.escapeHtml(displayLabel)}</span>
              <span class="mobile-sort-check" aria-hidden="true">✓</span>
            </button>`;
          }).join("")}
        </div>
      </section>

      <section class="filter-drawer-shell desktop-collapsed" id="filterDrawerShell" aria-label="Inventory filters">
        <div class="filter-drawer-head">
          <div>
            <strong>Filters</strong>
            <span id="filterActiveSummary">No active filters</span>
          </div>
          <div>
            <button type="button" class="btn-ghost clear-all-filters-btn" id="clearAllFiltersBtn">Clear All</button>
            <button type="button" class="btn-ghost mobile-filter-close-btn" id="mobileFilterCloseBtn">Done</button>
          </div>
        </div>

        <div class="filter-row">
          <div class="inventory-search-wrap">
            <input type="search"
                   id="search"
                   maxlength="100"
                   autocomplete="off"
                   placeholder="Search name, code, year or series…"
                   aria-autocomplete="list"
                   aria-controls="searchSuggestions">
            <div class="search-suggestions" id="searchSuggestions" role="listbox" hidden></div>
          </div>

          <div class="overview-select" id="filterGameWrap">
            <button type="button" class="overview-select-btn" id="filterGameBtn"><span>All Games</span><i></i></button>
            <div class="overview-select-menu" id="filterGameMenu" hidden></div>
            <input type="hidden" id="filterGame" value="">
          </div>

          <div class="overview-select" id="filterGradeWrap">
            <button type="button" class="overview-select-btn" id="filterGradeBtn"><span>All Grades / Conditions</span><i></i></button>
            <div class="overview-select-menu" id="filterGradeMenu" hidden></div>
            <input type="hidden" id="filterGrade" value="">
          </div>

          <div class="overview-select" id="filterLanguageWrap">
            <button type="button" class="overview-select-btn" id="filterLanguageBtn"><span>All Languages</span><i></i></button>
            <div class="overview-select-menu" id="filterLanguageMenu" hidden></div>
            <input type="hidden" id="filterLanguage" value="">
          </div>

          <div class="overview-select" id="filterEraWrap">
            <button type="button" class="overview-select-btn" id="filterEraBtn"><span>All Eras</span><i></i></button>
            <div class="overview-select-menu" id="filterEraMenu" hidden></div>
            <input type="hidden" id="filterEra" value="">
          </div>

          <input type="hidden" id="filterAvailability" value="">

          <div class="overview-select" id="filterSeriesWrap">
            <button type="button" class="overview-select-btn" id="filterSeriesBtn"><span>All Series</span><i></i></button>
            <div class="overview-select-menu" id="filterSeriesMenu" hidden></div>
            <input type="hidden" id="filterSeries" value="">
          </div>

          <div class="overview-select" id="sortByWrap">
            <button type="button" class="overview-select-btn" id="sortByBtn">
              <span>${scope==="sold" ? "Sort: Recently Sold" : "Sort: Newest Added"}</span><i></i>
            </button>
            <div class="overview-select-menu" id="sortByMenu" hidden></div>
            <input type="hidden" id="sortBy" value="${scope==="sold" ? "recent-sold" : "newest"}">
          </div>

          ${!isCollection ? `
            <div class="price-range-filter">
              <span class="price-range-label">Price (${appContext.getPriceCurrencyPreference()})</span>
              <input type="number" id="filterPriceMin" min="0" step="1" inputmode="decimal" placeholder="Min">
              <span>–</span>
              <input type="number" id="filterPriceMax" min="0" step="1" inputmode="decimal" placeholder="Max">
            </div>
          ` : ""}

          ${!isCollection && scope!=="inventory" ? `
            <label class="mobile-cards-per-page-control" for="mobileListingPerPageSelect">
              <span>
                <strong>Cards per page</strong>
                <small>Choose how many listings to load on each page</small>
              </span>
              <select id="mobileListingPerPageSelect" aria-label="Cards per page">
                ${appContext.LISTING_PER_PAGE_OPTIONS.map(value=>`
                  <option value="${value}" ${appContext.listingPerPage===value?"selected":""}>${value}</option>
                `).join("")}
              </select>
            </label>
          ` : ""}

          <a href="#/add" class="btn-primary owner-only" style="display:inline-block;">+ Add card</a>
        </div>

        <div class="grade-shortcuts" id="gradeShortcuts" hidden></div>

        <div class="filter-drawer-footer">
          <span id="mobileFilterFooterResultCount" hidden>0</span>
          <button type="button" class="btn-primary filter-drawer-apply" id="mobileFilterApplyBtn">Show Results</button>
        </div>
      </section>

      <!-- Active filters belong between the controls that created them and
           the result/pagination area they affect. -->
      <div class="pill-filter-summary active-filter-result-bridge" id="pillFilterSummary" hidden></div>

      <span id="inventoryMobileCompactResultCount" hidden>0</span>
      ${!["inventory","collection"].includes(scope) ? `
        <div class="listing-pagination-shell listing-pagination-top" id="listingPaginationTop" hidden></div>
      ` : ""}

      <div id="invGrid" aria-busy="true">${appContext.inventorySkeletonHTML(8)}</div>

      ${!["inventory","collection"].includes(scope) ? `
        <div class="listing-pagination-shell listing-pagination-bottom" id="listingPaginationBottom" hidden></div>
        <div class="listing-pagination-viewport-guard" id="listingPaginationViewportGuard" aria-hidden="true"></div>
      ` : ""}

      <div class="sticky-mobile-results-bar" id="stickyMobileResultsBar" aria-label="Results controls">
        <div class="sticky-mobile-results-count">
          <strong id="stickyMobileResultCount">0</strong>
          <span>Cards</span>
        </div>

        <button type="button" class="sticky-mobile-results-action" id="stickyMobileSortBtn" aria-expanded="false">
          <span>Sort</span>
          <small id="stickyMobileSortLabel">Newest Added</small>
        </button>

        <button type="button" class="sticky-mobile-results-action" id="stickyMobileFilterBtn" aria-expanded="false">
          <span>Filters</span>
          <strong class="sticky-mobile-filter-count" id="stickyMobileFilterCount">0</strong>
        </button>
      </div>
    `;
  }

function inventoryFilterOptions(scopedCards){
    const games=Array.from(new Set(scopedCards.map(c=>c.game).filter(Boolean))).sort();
    const languages=appContext.LANGUAGE_OPTIONS.filter(lang=>scopedCards.some(c=>c.language===lang));
    const eras=appContext.ERA_OPTIONS.filter(era=>scopedCards.some(c=>c.era===era));
    const series=Array.from(new Set(scopedCards.map(c=>c.series).filter(Boolean))).sort();

    const slabGradeOptions=Array.from(new Set(
      scopedCards
        .flatMap(c=>Array.isArray(c.grading)?c.grading:[])
        .filter(g=>g && g.company && String(g.grade??"").trim())
        .map(g=>`${String(g.company).trim().toUpperCase()} ${String(g.grade).trim()}`)
    )).sort((a,b)=>{
      const [companyA,...gradeA]=a.split(" ");
      const [companyB,...gradeB]=b.split(" ");
      if(companyA!==companyB) return companyA.localeCompare(companyB);

      const numberA=parseFloat(gradeA.join(" "));
      const numberB=parseFloat(gradeB.join(" "));
      if(Number.isFinite(numberA) && Number.isFinite(numberB)) return numberB-numberA;
      return a.localeCompare(b);
    });

    const rawConditionOrder=[
      "Mint","Near Mint","Lightly Played","Moderately Played",
      "Heavily Played","Damaged","Not Applicable"
    ];

    const rawConditionOptions=rawConditionOrder.filter(label=>
      scopedCards.some(card=>
        appContext.effectiveFormat(card)==="Raw" &&
        (appContext.CONDITION_LABEL[card.condition]||card.condition||"")===label
      )
    );

    const sealedOptions=scopedCards.some(card=>appContext.effectiveFormat(card)==="Sealed")
      ? ["Sealed"]
      : [];

    const gradeOptions=[...slabGradeOptions,...rawConditionOptions,...sealedOptions];

    // Grade shortcuts are grouped logically instead of mixing slab grades
    // with raw conditions. Order:
    //   PSA (highest to lowest) -> BGS -> CGC -> other graders
    //   -> Raw conditions (best to worst) -> Sealed.
    const graderPriority=["PSA","BGS","CGC"];

    const slabShortcutValues=slabGradeOptions.slice().sort((a,b)=>{
      const [companyA,...gradePartsA]=String(a).split(" ");
      const [companyB,...gradePartsB]=String(b).split(" ");

      const companyRankA=graderPriority.includes(companyA)
        ? graderPriority.indexOf(companyA)
        : graderPriority.length;
      const companyRankB=graderPriority.includes(companyB)
        ? graderPriority.indexOf(companyB)
        : graderPriority.length;

      if(companyRankA!==companyRankB) return companyRankA-companyRankB;

      if(companyRankA===graderPriority.length && companyA!==companyB){
        return companyA.localeCompare(companyB);
      }

      const numberA=parseFloat(gradePartsA.join(" "));
      const numberB=parseFloat(gradePartsB.join(" "));
      if(Number.isFinite(numberA) && Number.isFinite(numberB)) return numberB-numberA;
      if(Number.isFinite(numberA)) return -1;
      if(Number.isFinite(numberB)) return 1;
      return String(a).localeCompare(String(b));
    });

    const shortcutValues=[
      ...slabShortcutValues,
      ...rawConditionOptions,
      ...sealedOptions
    ].filter(value=>appContext.normalizeFilterValue(value)!=="not applicable").slice(0,10);

    return {games,languages,eras,series,gradeOptions,shortcutValues};
  }

function inventorySortOptions(scope){
    return [
      ...(scope==="sold" ? [{value:"recent-sold",label:"Sort: Recently Sold"}] : []),
      ...(["collection","inventory"].includes(scope) ? [{value:"custom",label:"Custom Order"}] : []),
      {value:"name",label:"Name: A → Z"},
      {value:"name-desc",label:"Name: Z → A"},
      {value:"newest",label:"Newest Added"},
      {value:"oldest",label:"Oldest Added"},
      {value:"year-new",label:"Year: Newest → Oldest"},
      {value:"year-old",label:"Year: Oldest → Newest"},
      {value:"grade-high",label:"Grade: High → Low"},
      {value:"grade-low",label:"Grade: Low → High"},
      ...(scope!=="collection" ? [
        {value:"price-low",label:"Price: Lowest → Highest"},
        {value:"price-high",label:"Price: Highest → Lowest"}
      ] : [])
    ];
  }

function inventoryScopeEmptyText(scope){
    if(scope==="collection") return "There are currently no Collection / NFS cards.";
    if(scope==="reserved") return "There are currently no reserved cards.";
    if(scope==="sold") return "There are currently no sold cards.";
    return "There are currently no available cards.";
  }

function inventorySkeletonHTML(count=8){
    const safeCount=Math.max(4,Math.min(12,Number(count)||8));
    return `<div class="inventory-skeleton-grid" aria-hidden="true">${
      Array.from({length:safeCount},()=>`
        <div class="inventory-skeleton-card">
          <div class="inventory-skeleton-image"></div>
          <div class="inventory-skeleton-body">
            <div class="inventory-skeleton-line"></div>
            <div class="inventory-skeleton-line medium"></div>
            <div class="inventory-skeleton-line short"></div>
          </div>
        </div>
      `).join("")
    }</div>`;
  }

function inventoryNoResultsHTML({scope,activeCount,hasSearch,hasPrice,noScopeCards}){
    return `
      <div class="empty-state inventory-no-results">
        <div class="empty-icon">${activeCount ? "⌕" : "◇"}</div>
        <h3>${noScopeCards ? appContext.escapeHtml(appContext.inventoryScopeEmptyText(scope)) : "No cards match these filters"}</h3>
        <p>${activeCount
          ? "No match yet. Remove one filter, adjust your search, or reset everything to browse the full selection."
          : "There are no listings to show in this section right now."}</p>
        <div class="no-results-actions">
          ${hasSearch ? `<button type="button" class="btn-ghost" data-empty-clear-search>Clear Search</button>` : ""}
          ${hasPrice ? `<button type="button" class="btn-ghost" data-empty-clear-price>Remove Price Range</button>` : ""}
          ${activeCount ? `<button type="button" class="btn-primary" data-empty-clear-all>Clear All Filters</button>` : ""}
          ${scope!=="collection"
            ? `<a href="#/collection" class="btn-ghost">Browse Inventory / NFS</a>`
            : `<a href="#/inventory" class="btn-ghost">Browse Available Cards</a>`}
        </div>
      </div>
    `;
  }

function renderInventoryPage(scope = "inventory"){
    appContext.cleanupInventoryRenderListeners();
    appContext.inventoryRenderController=new AbortController();
    const inventorySignal=appContext.inventoryRenderController.signal;

    appContext.updateStatusNavCounts();
    appContext.listingAvailabilityScope = appContext.isInventoryRoute(scope) ? scope : "inventory";

    const listingParams=appContext.currentHashParams();
    if(["inventory","collection"].includes(appContext.listingAvailabilityScope)){
      // Grouped catalogue views are one continuous collapsible page.
      // Old per/page URL values are intentionally ignored.
      appContext.listingPerPage=appContext.getSavedListingPerPage();
      appContext.listingCurrentPage=1;
    }else{
      const requestedPer=Number(listingParams.get("per"));
      appContext.listingPerPage=appContext.LISTING_PER_PAGE_OPTIONS.includes(requestedPer)
        ? requestedPer
        : appContext.getSavedListingPerPage();
      appContext.listingCurrentPage=appContext.safeListingPage(listingParams.get("page"));
    }

    const scopeMeta = appContext.listingScopeMeta(appContext.listingAvailabilityScope);
    const requestedQuick=appContext.safeUrlFilterText(listingParams.get("quick"),24);
    appContext.activeQuickFilter=["all","new","graded","raw","sealed","championship","vintage","trending"].includes(requestedQuick)
      ? requestedQuick
      : "all";
    appContext.view.innerHTML=appContext.inventoryPageHTML(scopeMeta,appContext.listingAvailabilityScope);

    // Desktop filter panel: compact by default, expandable in-place.
    // Mobile keeps using the existing bottom-sheet controls and ignores this class.
    const desktopFilterToggleBtn=appContext.$("desktopFilterToggleBtn");
    const desktopFilterShell=appContext.$("filterDrawerShell");
    const desktopFilterMq=window.matchMedia("(min-width:801px)");

    function setDesktopFiltersExpanded(expanded){
      if(!desktopFilterShell || !desktopFilterToggleBtn) return;
      const shouldExpand=Boolean(expanded);
      desktopFilterShell.classList.toggle("desktop-collapsed",!shouldExpand);
      desktopFilterToggleBtn.setAttribute("aria-expanded",shouldExpand?"true":"false");
    }

    if(desktopFilterToggleBtn && desktopFilterShell){
      setDesktopFiltersExpanded(false);
      desktopFilterToggleBtn.addEventListener("click",()=>{
        if(!desktopFilterMq.matches) return;
        setDesktopFiltersExpanded(desktopFilterToggleBtn.getAttribute("aria-expanded")!=="true");
      },{signal:inventorySignal});
    }

    const scopedCards=appContext.cards.filter(c=>appContext.cardMatchesListingScope(c,appContext.listingAvailabilityScope));
    const {
      games,
      languages,
      eras,
      series,
      gradeOptions,
      shortcutValues
    }=appContext.inventoryFilterOptions(scopedCards);

    // families above one continuous grid. Collection/NFS deliberately keeps its
    // existing expandable catalogue groups and owner ordering controls.
    function inventoryGameFamily(card){
      const game=collectionGameLabel(card);
      const normalized=appContext.normalizeFilterValue(game);
      if(normalized.startsWith("one piece") || normalized==="weekly jump") return {key:"one-piece",label:"One Piece"};
      return {key:collectionGameKey(game),label:game};
    }

    function inventoryGameFamilies(){
      const groups=new Map();
      scopedCards.forEach(card=>{
        const family=inventoryGameFamily(card);
        if(!groups.has(family.key)) groups.set(family.key,{...family,cards:[],gameValues:new Set()});
        const group=groups.get(family.key);
        group.cards.push(card);
        group.gameValues.add(collectionGameLabel(card));
      });
      return Array.from(groups.values()).sort((a,b)=>{
        if(a.key==="one-piece") return -1;
        if(b.key==="one-piece") return 1;
        if(a.cards.length!==b.cards.length) return b.cards.length-a.cards.length;
        return a.label.localeCompare(b.label,undefined,{sensitivity:"base",numeric:true});
      });
    }

    function inventoryFamilyHasSelection(family){
      const selected=Array.from(appContext.pillFilterState.game||[]).map(appContext.normalizeFilterValue);
      const values=Array.from(family.gameValues).map(appContext.normalizeFilterValue);
      return selected.length>0 && values.length>0 && selected.every(value=>values.includes(value));
    }

    function inventoryFamilyIsFullyActive(family){
      const selected=Array.from(appContext.pillFilterState.game||[]).map(appContext.normalizeFilterValue);
      const values=Array.from(family.gameValues).map(appContext.normalizeFilterValue);
      return values.length>0 && selected.length===values.length && values.every(value=>selected.includes(value));
    }

    const inventoryGameLogos={
      "one-piece":{src:"https://cdn.brandfetch.io/id2IG2FqNi/w/562/h/145/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1781714425600",alt:"One Piece Card Game",className:"inventory-game-logo-one-piece"},
      "hunter x hunter hyper battle":{src:"https://upload.wikimedia.org/wikipedia/commons/1/1f/Hunter_%C3%97_Hunter_logo.png",alt:"Hunter × Hunter",className:"inventory-game-logo-hunter"},
      "pokémon":{src:"https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg",alt:"Pokémon Trading Card Game",className:"inventory-game-logo-pokemon"},
      "pokemon":{src:"https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg",alt:"Pokémon Trading Card Game",className:"inventory-game-logo-pokemon"},
      "zatch bell!":{src:"https://raw.githubusercontent.com/collecttcg/Collect_TCG_Beta/main/beta/assets/zatch-bell-card-battle-logo.webp",alt:"Zatch Bell! The Card Battle",className:"inventory-game-logo-zatch"}
    };

    function inventoryGameBrowserHTML(){
      const families=inventoryGameFamilies();
      const selectedFamily=families.find(inventoryFamilyHasSelection);
      const allActive=!selectedFamily && !(appContext.pillFilterState.game?.size);
      const browserLabel=appContext.listingAvailabilityScope==="collection" ? "Collection" : "Inventory";
      const allTile=`<button type="button" class="inventory-game-tile ${allActive ? "active" : ""}" data-inventory-game-family="all" aria-pressed="${allActive ? "true" : "false"}"><span class="inventory-game-art inventory-game-art-all" aria-hidden="true"><span>ALL</span></span><span class="inventory-game-tile-copy"><strong>All ${browserLabel}</strong><small>${scopedCards.length.toLocaleString()} ${scopedCards.length===1?"card":"cards"}</small></span></button>`;
      const familyTiles=families.map(family=>{
        const active=inventoryFamilyHasSelection(family);
        const logo=inventoryGameLogos[family.key];
        const image=appContext.safeHttpUrl(appContext.getImages(family.cards[0])[0]||"");
        return `<button type="button" class="inventory-game-tile ${active ? "active" : ""}" data-inventory-game-family="${appContext.escapeHtml(family.key)}" aria-pressed="${active ? "true" : "false"}"><span class="inventory-game-art ${logo ? "has-game-logo" : ""}" aria-hidden="true">${logo ? `<img class="inventory-game-logo ${appContext.escapeHtml(logo.className||"")}" src="${appContext.escapeHtml(logo.src)}" alt="${appContext.escapeHtml(logo.alt)}" loading="lazy" decoding="async">` : (image ? `<img src="${appContext.escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : `<span>${appContext.escapeHtml(family.label.slice(0,3).toUpperCase())}</span>`)}</span><span class="inventory-game-tile-copy"><strong>${appContext.escapeHtml(family.label)}</strong><small>${family.cards.length.toLocaleString()} ${family.cards.length===1?"card":"cards"}</small></span></button>`;
      }).join("");
      const onePiece=families.find(family=>family.key==="one-piece");
      const seriesTiles=selectedFamily?.key==="one-piece" && onePiece ? `<div class="inventory-game-series" aria-label="One Piece series"><span class="inventory-game-series-label">One Piece series</span><button type="button" class="inventory-game-series-chip ${inventoryFamilyIsFullyActive(onePiece) ? "active" : ""}" data-inventory-game-series="all">All One Piece</button>${Array.from(onePiece.gameValues).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base",numeric:true})).map(value=>{const active=appContext.pillFilterState.game?.size===1 && appContext.selectedSetMatches(appContext.pillFilterState.game,value);return `<button type="button" class="inventory-game-series-chip ${active ? "active" : ""}" data-inventory-game-series="${appContext.escapeHtml(value)}">${appContext.escapeHtml(value)}</button>`;}).join("")}</div>` : "";
      return `<div class="inventory-game-browser-head"><div><span class="eyebrow">Browse the vault</span><h3>${appContext.listingAvailabilityScope==="collection" ? "Browse Collection by game" : "Shop by game"}</h3></div><span>Choose a game to refine the grid</span></div><div class="inventory-game-tiles">${allTile}${familyTiles}</div>${seriesTiles}`;
    }

    function syncInventoryGameBrowser(){
      const mount=appContext.$("inventoryGameBrowser");
      if(!mount || !["inventory","collection"].includes(appContext.listingAvailabilityScope)) return;
      const families=inventoryGameFamilies();
      const previousTiles=mount.querySelector(".inventory-game-tiles");
      const previousSeries=mount.querySelector(".inventory-game-series");
      const gameTilesScrollLeft=previousTiles ? previousTiles.scrollLeft : 0;
      const gameSeriesScrollLeft=previousSeries ? previousSeries.scrollLeft : 0;
      mount.innerHTML=inventoryGameBrowserHTML();
      const gameTiles=mount.querySelector(".inventory-game-tiles");
      const gameSeries=mount.querySelector(".inventory-game-series");
      if(gameTiles && gameTilesScrollLeft) requestAnimationFrame(()=>{gameTiles.scrollLeft=gameTilesScrollLeft;});
      if(gameSeries && gameSeriesScrollLeft) requestAnimationFrame(()=>{gameSeries.scrollLeft=gameSeriesScrollLeft;});
      mount.querySelectorAll("[data-inventory-game-family]").forEach(button=>button.addEventListener("click",()=>{
        const key=button.dataset.inventoryGameFamily;
        const bucket=appContext.pillFilterState.game;
        const family=families.find(item=>item.key===key);
        if(key==="all" || (family && inventoryFamilyHasSelection(family))) bucket.clear();
        else if(family){bucket.clear();family.gameValues.forEach(value=>bucket.add(value));}
        appContext.pillFilterState.series.clear();
        appContext.updateListingUrlFromControls();
        draw();
      },{signal:inventorySignal}));
      mount.querySelectorAll("[data-inventory-game-series]").forEach(button=>button.addEventListener("click",()=>{
        const viewportTop=window.scrollY;
        const value=button.dataset.inventoryGameSeries;
        const bucket=appContext.pillFilterState.game;
        const onePiece=families.find(item=>item.key==="one-piece");
        if(!onePiece) return;
        if(value==="all"){bucket.clear();onePiece.gameValues.forEach(game=>bucket.add(game));}
        else if(bucket.size===1 && appContext.selectedSetMatches(bucket,value)) bucket.clear();
        else {bucket.clear();bucket.add(value);}
        appContext.pillFilterState.series.clear();
        appContext.updateListingUrlFromControls();
        draw();
        requestAnimationFrame(()=>{window.scrollTo({top:viewportTop,left:window.scrollX,behavior:"auto"});});
      },{signal:inventorySignal}));
    }

    function closeAllOverviewFilterMenus(except=null){
      document.querySelectorAll(".filter-drawer-shell .overview-select-menu").forEach(m=>{
        if(m===except) return;
        m.hidden=true;
        m.closest(".overview-select")?.classList.remove("menu-open");
      });
    }

    function setupOverviewSelect(id, options){
      const hidden = appContext.$(id);
      const btn = appContext.$(id + "Btn");
      const menu = appContext.$(id + "Menu");
      const wrap = appContext.$(id + "Wrap");

      menu.innerHTML = options.map(o =>
        `<button type="button" class="overview-select-option" data-value="${appContext.escapeHtml(o.value)}">${appContext.escapeHtml(o.label)}</button>`
      ).join("");

      btn.addEventListener("click", e=>{
        e.stopPropagation();
        const opening=menu.hidden;
        closeAllOverviewFilterMenus(opening?menu:null);
        menu.hidden=!opening;
        wrap.classList.toggle("menu-open",opening);
        if(opening){
          // In-flow mobile dropdowns expand naturally inside the filter sheet.
          // No automatic scrolling: avoid the layout jumping when a menu opens.
        }
      });

      menu.addEventListener("click", e=>{
        const option = e.target.closest(".overview-select-option");
        if(!option) return;
        hidden.value = option.dataset.value;
        btn.querySelector("span").textContent = option.textContent;

        const pillTypeByFilter = {
          filterGrade:"grade",
          filterLanguage:"language",
          filterEra:"era",
          filterAvailability:"availability",
          filterSeries:"series"
        };
        const pillType = pillTypeByFilter[id];
        if(pillType) appContext.pillFilterState[pillType].clear();

        menu.hidden = true;
        wrap.classList.remove("menu-open");
        hidden.dispatchEvent(new Event("change", {bubbles:true}));
      });

      document.addEventListener("click",e=>{
        if(!wrap.contains(e.target) && !menu.contains(e.target)){
          menu.hidden=true;
          wrap.classList.remove("menu-open");
        }
      },{signal:inventorySignal});
    }

    window.addEventListener("resize",()=>closeAllOverviewFilterMenus(),{signal:inventorySignal});
    window.visualViewport?.addEventListener("resize",()=>closeAllOverviewFilterMenus(),{signal:inventorySignal});

    setupOverviewSelect("filterGame", [
      {value:"",label:"All Games"},
      ...games.map(g=>({value:g,label:g}))
    ]);
    setupOverviewSelect("filterGrade", [
      {value:"",label:"All Grades / Conditions"},
      ...gradeOptions.map(value=>({value,label:value}))
    ]);
    const gradeShortcuts=appContext.$("gradeShortcuts");
    if(gradeShortcuts && shortcutValues.length){
      gradeShortcuts.hidden=false;
      gradeShortcuts.innerHTML=`
        <span class="grade-shortcuts-label">Grade shortcuts</span>
        ${shortcutValues.map(value=>`<button type="button" data-grade-shortcut="${appContext.escapeHtml(value)}">${appContext.escapeHtml(value)}</button>`).join("")}
      `;
      gradeShortcuts.querySelectorAll("[data-grade-shortcut]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const value=String(btn.dataset.gradeShortcut||"");
          appContext.$("filterGrade").value=value;
          appContext.$("filterGradeBtn").querySelector("span").textContent=value;
          appContext.pillFilterState.grade.clear();
          appContext.$("filterGrade").dispatchEvent(new Event("change",{bubbles:true}));
          gradeShortcuts.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===btn));
        });
      });
    }
    setupOverviewSelect("filterLanguage", [
      {value:"",label:"All Languages"},
      ...languages.map(l=>({value:l,label:l}))
    ]);
    setupOverviewSelect("filterEra", [
      {value:"",label:"All Eras"},
      ...eras.map(e=>({value:e,label:e}))
    ]);
    setupOverviewSelect("filterSeries", [
      {value:"",label:"All Series"},
      ...series.map(s=>({value:s,label:s}))
    ]);
    setupOverviewSelect("sortBy",appContext.inventorySortOptions(appContext.listingAvailabilityScope));

    function restoreListingFiltersFromUrl(){
      const params = appContext.currentHashParams();

      // URL input is untrusted. Only accept values that exist in the
      // current public catalogue/options, plus whitelisted sort/quick values.
      const valid = {
        game:new Set(games.map(appContext.normalizeFilterValue)),
        grade:new Set(gradeOptions.map(appContext.normalizeFilterValue)),
        language:new Set(languages.map(appContext.normalizeFilterValue)),
        era:new Set(eras.map(appContext.normalizeFilterValue)),
        availability:new Set(appContext.AVAILABILITY_OPTIONS.map(appContext.normalizeFilterValue)),
        series:new Set(series.map(appContext.normalizeFilterValue))
      };

      const setSelect = (id, key, validSet, fallbackLabel)=>{
        const hidden = appContext.$(id);
        const btn = appContext.$(id + "Btn");
        if(!hidden) return;

        const raw = appContext.safeUrlFilterText(params.get(key), 100);
        const accepted = raw && validSet.has(appContext.normalizeFilterValue(raw)) ? raw : "";
        hidden.value = accepted;

        if(btn){
          const option = Array.from(appContext.$(id + "Menu")?.querySelectorAll(".overview-select-option") || [])
            .find(el=>appContext.normalizeFilterValue(el.dataset.value) === appContext.normalizeFilterValue(accepted));
          btn.querySelector("span").textContent = option ? option.textContent : fallbackLabel;
        }
      };

      appContext.$("search").value = appContext.safeUrlFilterText(params.get("q"), 100);

      if(appContext.listingAvailabilityScope!=="collection"){
        const urlCurrency=String(params.get("pc")||"").toUpperCase();
        if(["USD","MYR","SGD"].includes(urlCurrency)){
          appContext.setPriceCurrencyPreference(urlCurrency);
          if(appContext.$("currencyPreference")) appContext.$("currencyPreference").value=urlCurrency;
          const priceLabel=document.querySelector(".price-range-label");
          if(priceLabel) priceLabel.textContent=`Price (${urlCurrency})`;
        }
        if(appContext.$("filterPriceMin")) appContext.$("filterPriceMin").value=appContext.safePriceFilterValue(params.get("pmin"));
        if(appContext.$("filterPriceMax")) appContext.$("filterPriceMax").value=appContext.safePriceFilterValue(params.get("pmax"));
      }

      setSelect("filterGame","game",valid.game,"All Games");
      setSelect("filterGrade","grade",valid.grade,"All Grades / Conditions");
      setSelect("filterLanguage","lang",valid.language,"All Languages");
      setSelect("filterEra","era",valid.era,"All Eras");
      setSelect("filterSeries","series",valid.series,"All Series");

      if(appContext.$("filterAvailability")) appContext.$("filterAvailability").value="";

      const allowedSort=new Set(
        appContext.listingAvailabilityScope==="sold"
          ? ["recent-sold","name","name-desc","newest","oldest","year-new","year-old","grade-high","grade-low","price-low","price-high"]
          : (appContext.listingAvailabilityScope==="collection"
              ? ["custom","name","name-desc","newest","oldest","year-new","year-old","grade-high","grade-low"]
              : (appContext.listingAvailabilityScope==="inventory"
                  ? ["custom","name","name-desc","newest","oldest","year-new","year-old","grade-high","grade-low","price-low","price-high"]
                  : ["name","name-desc","newest","oldest","year-new","year-old","grade-high","grade-low","price-low","price-high"]))
      );
      const defaultSort = appContext.listingAvailabilityScope === "sold"
        ? "recent-sold"
        : (["inventory","collection"].includes(appContext.listingAvailabilityScope)
            ? "custom"
            : "name");
      const sort = appContext.safeUrlFilterText(params.get("sort"), 24);
      appContext.$("sortBy").value = allowedSort.has(sort) ? sort : defaultSort;
      const sortLabel = {
        "recent-sold":"Sort: Recently Sold",
        custom:"Custom Order",
        name:"Name: A → Z",
        "name-desc":"Name: Z → A",
        newest:"Newest Added",
        oldest:"Oldest Added",
        "year-new":"Year: Newest → Oldest",
        "year-old":"Year: Oldest → Newest",
        "grade-high":"Grade: High → Low",
        "grade-low":"Grade: Low → High",
        "price-low":"Price: Lowest → Highest",
        "price-high":"Price: Highest → Lowest"
      }[appContext.$("sortBy").value];
      appContext.$("sortByBtn").querySelector("span").textContent = sortLabel;

      const allowedQuick = new Set(["all","new","graded","raw","sealed","championship","vintage","trending"]);
      const quick = appContext.safeUrlFilterText(params.get("quick"), 24);
      appContext.activeQuickFilter = allowedQuick.has(quick) ? quick : "all";

      // Clear old in-memory pill state before restoring this URL.
      Object.values(appContext.pillFilterState).forEach(set=>set.clear());

      const pillConfig = [
        ["game","pga",valid.game],
        ["grade","pg",valid.grade],
        ["language","pl",valid.language],
        ["era","pe",valid.era],
        ["availability","pa",valid.availability],
        ["series","ps",valid.series]
      ];

      pillConfig.forEach(([type,key,validSet])=>{
        params.getAll(key)
          .slice(0,12)
          .map(v=>appContext.safeUrlFilterText(v,80))
          .filter(v=>v && validSet.has(appContext.normalizeFilterValue(v)))
          .forEach(v=>appContext.pillFilterState[type].add(v));
      });

      // Reserved/Sold pages are already status-scoped; an availability pill
      // from a copied Inventory URL must not override that scope.
      if(appContext.listingAvailabilityScope !== "inventory"){
        appContext.pillFilterState.availability.clear();
      }
    }

    restoreListingFiltersFromUrl();
    syncInventoryGameBrowser();

    // Desktop search stays visible beside the collapsed Filters button.
    // The existing #search field remains the single source of truth for
    // filtering/URL state; this compact desktop input mirrors it.
    const desktopInventorySearch=appContext.$("desktopInventorySearch");
    const desktopInventorySearchClear=appContext.$("desktopInventorySearchClear");

    function syncDesktopSearchFromMain(){
      if(!desktopInventorySearch) return;
      const value=String(appContext.$("search")?.value||"").slice(0,100);
      if(desktopInventorySearch.value!==value) desktopInventorySearch.value=value;
      if(desktopInventorySearchClear) desktopInventorySearchClear.hidden=!value;
    }

    function commitDesktopSearchToMain(){
      if(!desktopInventorySearch || !appContext.$("search")) return;
      const value=desktopInventorySearch.value.slice(0,100);
      appContext.$("search").value=value;
      if(desktopInventorySearchClear) desktopInventorySearchClear.hidden=!value;
      appContext.$("search").dispatchEvent(new Event("input",{bubbles:true}));
    }

    syncDesktopSearchFromMain();
    desktopInventorySearch?.addEventListener("input",commitDesktopSearchToMain,{signal:inventorySignal});
    desktopInventorySearch?.addEventListener("search",commitDesktopSearchToMain,{signal:inventorySignal});
    desktopInventorySearch?.addEventListener("keydown",e=>{
      if(e.key==="Enter"){
        commitDesktopSearchToMain();
        desktopInventorySearch.blur();
      }else if(e.key==="Escape" && desktopInventorySearch.value){
        desktopInventorySearch.value="";
        commitDesktopSearchToMain();
      }
    },{signal:inventorySignal});
    desktopInventorySearchClear?.addEventListener("click",()=>{
      if(!desktopInventorySearch) return;
      desktopInventorySearch.value="";
      commitDesktopSearchToMain();
      desktopInventorySearch.focus();
    },{signal:inventorySignal});

    const perPageSelect=appContext.$("listingPerPageSelect");
    if(perPageSelect) perPageSelect.value=String(appContext.listingPerPage);

    function activeInventoryFilterCount(){
      let count=0;
      if(String(appContext.$("search")?.value||"").trim()) count++;

      ["filterGame","filterGrade","filterLanguage","filterEra","filterAvailability","filterSeries"]
        .forEach(id=>{ if(String(appContext.$(id)?.value||"").trim()) count++; });

      if(appContext.safePriceFilterValue(appContext.$("filterPriceMin")?.value) || appContext.safePriceFilterValue(appContext.$("filterPriceMax")?.value)) count++;
      if(appContext.activeQuickFilter && appContext.activeQuickFilter!=="all") count++;

      Object.values(appContext.pillFilterState).forEach(set=>{ count+=set.size; });
      return count;
    }

    function currentMobileSortLabel(){
      const value=String(appContext.$("sortBy")?.value||"");
      const labels={
        "recent-sold":"Recent",
        custom:"Custom",
        name:"Name A–Z",
        "name-desc":"Name Z–A",
        newest:"Newest",
        oldest:"Oldest",
        "year-new":"Year ↓",
        "year-old":"Year ↑",
        "grade-high":"Grade ↓",
        "grade-low":"Grade ↑",
        "price-low":"Price ↑",
        "price-high":"Price ↓"
      };
      return labels[value]||"Sort";
    }

    function syncMobileSortSheetSelection(){
      const selected=String(appContext.$("sortBy")?.value||"");
      appContext.$("mobileSortOptions")?.querySelectorAll("[data-mobile-sort-value]").forEach(btn=>{
        const active=String(btn.dataset.mobileSortValue||"")===selected;
        btn.classList.toggle("active",active);
        btn.setAttribute("aria-checked",active?"true":"false");
      });
    }

    function updateActiveFilterIndicators(){
      const count=activeInventoryFilterCount();
      const badge=appContext.$("mobileFilterCountBadge");
      if(badge){
        badge.textContent=String(count);
        badge.hidden=count===0;
      }

      const stickyCount=appContext.$("stickyMobileFilterCount");
      if(stickyCount) stickyCount.textContent=String(count);

      const sortLabel=appContext.$("stickyMobileSortLabel");
      if(sortLabel) sortLabel.textContent=currentMobileSortLabel();
      syncMobileSortSheetSelection();

      const summary=appContext.$("filterActiveSummary");
      if(summary) summary.textContent=count ? `${count} active filter${count===1?"":"s"}` : "No active filters";

      const desktopBadge=appContext.$("desktopFilterCountBadge");
      if(desktopBadge){
        desktopBadge.textContent=String(count);
        desktopBadge.hidden=count===0;
      }
      const desktopSummary=appContext.$("desktopFilterSummary");
      if(desktopSummary){
        desktopSummary.textContent=count ? `${count} active filter${count===1?"":"s"}` : "No active filters";
      }

      const sticky=appContext.$("stickyMobileFilterBtn");
      if(sticky) sticky.classList.toggle("has-active-filters",count>0);
    }

    function wireNoResultsRecovery(grid){
      grid.querySelector("[data-empty-clear-all]")?.addEventListener("click",clearAllInventoryFilters);

      grid.querySelector("[data-empty-clear-price]")?.addEventListener("click",()=>{
        if(appContext.$("filterPriceMin")) appContext.$("filterPriceMin").value="";
        if(appContext.$("filterPriceMax")) appContext.$("filterPriceMax").value="";
        appContext.updateListingUrlFromControls();
        draw();
      });

      grid.querySelector("[data-empty-clear-search]")?.addEventListener("click",()=>{
        if(appContext.$("search")) appContext.$("search").value="";
        appContext.updateListingUrlFromControls();
        draw();
      });
    }

    const FAVORITE_DISCOVERY_KEY="collect_tcg_favorite_hint_seen_v1";

    function maybeShowFavoriteDiscoveryHint(grid){
      if(!grid || appContext.isOwnerMode()) return;
      try{
        if(appContext.localStorage.getItem(FAVORITE_DISCOVERY_KEY)==="1") return;
      }catch{}

      const btn=grid.querySelector(".title-favorite-btn");
      if(!btn) return;

      const hint=document.createElement("div");
      hint.className="favorite-discovery-hint";
      hint.innerHTML="<strong>♡ Save cards</strong><br>Tap the heart to keep cards in Favorites.";
      document.body.appendChild(hint);

      const place=()=>{
        const rect=btn.getBoundingClientRect();
        const width=Math.min(210,window.innerWidth-24);
        hint.style.maxWidth=width+"px";
        const left=Math.min(
          window.innerWidth-width-12,
          Math.max(12,rect.left-6)
        );
        const top=Math.min(
          window.innerHeight-90,
          Math.max(12,rect.bottom+8)
        );
        hint.style.left=left+"px";
        hint.style.top=top+"px";
      };
      place();

      let dismissed=false;
      const dismiss=()=>{
        if(dismissed) return;
        dismissed=true;
        hint.remove();
        try{appContext.localStorage.setItem(FAVORITE_DISCOVERY_KEY,"1");}catch{}
        document.removeEventListener("pointerdown",dismiss,true);
      };
      setTimeout(()=>document.addEventListener("pointerdown",dismiss,true),100);
      setTimeout(dismiss,4500);
      window.addEventListener("resize",place,{once:true});
    }

    let inventoryDrawGeneration=0;

    // Collection-only display state. Every game starts expanded.
    // This lives inside renderInventoryPage so Inventory/Sold/Reserved
    // and every other page remain completely unaffected.
    const collectionCollapsedGames=new Set();
    let collectionRearrangeMode=false;
    let collectionRearrangeDirty=false;

    function collectionGameLabel(card){
      const raw=String(card?.game||"").trim();
      return raw || "Other";
    }

    function collectionGameKey(label){
      const normalized=appContext.normalizeFilterValue(label);
      return normalized || "__other__";
    }

    function groupedCollectionHTML(list,compact){
      const groups=new Map();

      list.forEach((card,index)=>{
        const label=collectionGameLabel(card);
        const key=collectionGameKey(label);
        if(!groups.has(key)){
          groups.set(key,{key,label,cards:[]});
        }
        groups.get(key).cards.push({card,index});
      });

      const ordered=Array.from(groups.values()).sort((a,b)=>{
        const ao=appContext.collectionCustomGameOrderValue(a.key);
        const bo=appContext.collectionCustomGameOrderValue(b.key);
        if(ao!==bo) return ao-bo;

        // New/unordered games fall back to alphabetical order, with Other last.
        const aOther=a.key==="__other__";
        const bOther=b.key==="__other__";
        if(aOther!==bOther) return aOther ? 1 : -1;
        return a.label.localeCompare(b.label,undefined,{sensitivity:"base",numeric:true});
      });

      return ordered.map(group=>{
        const collapsed=collectionCollapsedGames.has(group.key);

        const cardsHtml=group.cards.map(({card,index})=>{
          let html=appContext.cardTileHTML(card,index);

          html=html.replace(
            '<div class="card ',
            `<div class="card collection-game-card ${collectionRearrangeMode ? "collection-rearrange-card " : ""}`
          );

          html=html.replace(
            ' data-shimmer=',
            ` data-collection-game-key="${appContext.escapeHtml(group.key)}"${collapsed ? " hidden" : ""}${collectionRearrangeMode ? ' draggable="true"' : ""} data-shimmer=`
          );

          if(collectionRearrangeMode){
            html=html.replace(
              /(<div class="card collection-game-card[^>]*>)/,
              `$1<span class="collection-drag-handle" aria-hidden="true">⋮⋮</span>`
            );
          }

          return html;
        }).join("");

        return `
          <button type="button"
                  class="collection-game-group-header ${collapsed ? "collapsed" : ""} ${collectionRearrangeMode ? "rearranging collection-game-draggable" : ""}"
                  data-collection-game-toggle="${appContext.escapeHtml(group.key)}"
                  data-collection-game-label="${appContext.escapeHtml(group.label)}"
                  aria-expanded="${collapsed ? "false" : "true"}"
                  ${collectionRearrangeMode ? 'draggable="true"' : ""}>
            <span class="collection-game-group-main">
              ${collectionRearrangeMode ? `<span class="collection-game-drag-handle" aria-hidden="true">☰</span>` : ""}
              <span class="collection-game-chevron" aria-hidden="true">⌄</span>
              <strong>${appContext.escapeHtml(group.label)}</strong>
              <span class="collection-game-count">${group.cards.length.toLocaleString()} ${group.cards.length===1 ? "card" : "cards"}</span>
            </span>
          </button>
          ${cardsHtml}
        `;
      }).join("");
    }

    function groupedInventoryHTML(list,compact){
      const groups=new Map();
      list.forEach((card,index)=>{
        const label=collectionGameLabel(card);
        const key=collectionGameKey(label);
        if(!groups.has(key)) groups.set(key,{key,label,cards:[]});
        groups.get(key).cards.push({card,index});
      });

      const ordered=Array.from(groups.values()).sort((a,b)=>{
        const ao=appContext.inventoryCustomGameOrderValue(a.key);
        const bo=appContext.inventoryCustomGameOrderValue(b.key);
        if(ao!==bo) return ao-bo;
        const aOther=a.key==="__other__";
        const bOther=b.key==="__other__";
        if(aOther!==bOther) return aOther ? 1 : -1;
        return a.label.localeCompare(b.label,undefined,{sensitivity:"base",numeric:true});
      });

      return ordered.map(group=>{
        const collapsed=collectionCollapsedGames.has(group.key);
        const cardsHtml=group.cards.map(({card,index})=>{
          let html=appContext.cardTileHTML(card,index);
          html=html.replace(
            '<div class="card ',
            `<div class="card collection-game-card ${collectionRearrangeMode ? "collection-rearrange-card " : ""}`
          );
          html=html.replace(
            ' data-shimmer=',
            ` data-collection-game-key="${appContext.escapeHtml(group.key)}"${collapsed ? " hidden" : ""}${collectionRearrangeMode ? ' draggable="true"' : ""} data-shimmer=`
          );
          if(collectionRearrangeMode){
            html=html.replace(
              /(<div class="card collection-game-card[^>]*>)/,
              `$1<span class="collection-drag-handle" aria-hidden="true">⋮⋮</span>`
            );
          }
          return html;
        }).join("");

        return `
          <button type="button"
                  class="collection-game-group-header ${collapsed ? "collapsed" : ""} ${collectionRearrangeMode ? "rearranging collection-game-draggable" : ""}"
                  data-collection-game-toggle="${appContext.escapeHtml(group.key)}"
                  data-collection-game-label="${appContext.escapeHtml(group.label)}"
                  aria-expanded="${collapsed ? "false" : "true"}"
                  ${collectionRearrangeMode ? 'draggable="true"' : ""}>
            <span class="collection-game-group-main">
              ${collectionRearrangeMode ? `<span class="collection-game-drag-handle" aria-hidden="true">☰</span>` : ""}
              <span class="collection-game-chevron" aria-hidden="true">⌄</span>
              <strong>${appContext.escapeHtml(group.label)}</strong>
              <span class="collection-game-count">${group.cards.length.toLocaleString()} ${group.cards.length===1 ? "card" : "cards"}</span>
            </span>
          </button>
          ${cardsHtml}
        `;
      }).join("");
    }

    let paginationFilterSignature=null;
    let paginationFirstDraw=true;

    function currentPaginationFilterSignature(){
      const pillState={};
      Object.entries(appContext.pillFilterState).forEach(([key,set])=>{
        pillState[key]=Array.from(set||[]).map(appContext.normalizeFilterValue).sort();
      });

      return JSON.stringify({
        q:String(appContext.$("search")?.value||"").trim(),
        game:appContext.$("filterGame")?.value||"",
        grade:appContext.$("filterGrade")?.value||"",
        language:appContext.$("filterLanguage")?.value||"",
        era:appContext.$("filterEra")?.value||"",
        availability:appContext.$("filterAvailability")?.value||"",
        series:appContext.$("filterSeries")?.value||"",
        pmin:appContext.safePriceFilterValue(appContext.$("filterPriceMin")?.value),
        pmax:appContext.safePriceFilterValue(appContext.$("filterPriceMax")?.value),
        sort:appContext.$("sortBy")?.value||"",
        quick:appContext.activeQuickFilter||"all",
        pills:pillState
      });
    }

    function paginationPageItems(current,total){
      if(total<=7) return Array.from({length:total},(_,i)=>i+1);

      const pages=new Set([1,total,current-1,current,current+1]);
      if(current<=4){
        [2,3,4,5].forEach(page=>pages.add(page));
      }
      if(current>=total-3){
        [total-4,total-3,total-2,total-1].forEach(page=>pages.add(page));
      }

      const sorted=Array.from(pages)
        .filter(page=>page>=1 && page<=total)
        .sort((a,b)=>a-b);

      const items=[];
      sorted.forEach((page,index)=>{
        if(index && page-sorted[index-1]>1) items.push("ellipsis");
        items.push(page);
      });
      return items;
    }

    function paginationHTML(totalItems){
      const totalPages=Math.max(1,Math.ceil(totalItems/appContext.listingPerPage));
      const start=totalItems ? ((appContext.listingCurrentPage-1)*appContext.listingPerPage)+1 : 0;
      const end=totalItems ? Math.min(appContext.listingCurrentPage*appContext.listingPerPage,totalItems) : 0;

      const pages=paginationPageItems(appContext.listingCurrentPage,totalPages);
      return `
        <nav class="listing-pagination" aria-label="Listing pages">
          <div class="listing-pagination-summary">
            <strong>Showing ${start.toLocaleString()}–${end.toLocaleString()}</strong>
            of ${totalItems.toLocaleString()} listings
            · Page ${appContext.listingCurrentPage.toLocaleString()} of ${totalPages.toLocaleString()}
          </div>
          <div class="listing-pagination-pages">
            <button type="button"
                    class="listing-page-btn"
                    data-page-direction="prev"
                    aria-label="Previous page"
                    ${appContext.listingCurrentPage<=1?"disabled":""}>‹</button>

            ${pages.map(page=>page==="ellipsis"
              ? `<span class="listing-page-ellipsis" aria-hidden="true">…</span>`
              : `<button type="button"
                         class="listing-page-btn ${page===appContext.listingCurrentPage?"active":""}"
                         data-listing-page="${page}"
                         ${page===appContext.listingCurrentPage?'aria-current="page"':""}>${page}</button>`
            ).join("")}

            <button type="button"
                    class="listing-page-btn"
                    data-page-direction="next"
                    aria-label="Next page"
                    ${appContext.listingCurrentPage>=totalPages?"disabled":""}>›</button>
          </div>
        </nav>
      `;
    }

    function renderPagination(totalItems){
      const totalPages=Math.max(1,Math.ceil(totalItems/appContext.listingPerPage));
      appContext.listingCurrentPage=Math.min(Math.max(1,appContext.listingCurrentPage),totalPages);

      ["listingPaginationTop","listingPaginationBottom"].forEach(id=>{
        const mount=appContext.$(id);
        if(!mount) return;
        mount.hidden=totalItems<=appContext.listingPerPage;
        mount.innerHTML=totalItems>appContext.listingPerPage ? paginationHTML(totalItems) : "";
      });
    }

    function scrollToListingStart(){
      const target=appContext.$("listingPaginationTop") || appContext.$("invGrid");
      if(!target) return;
      requestAnimationFrame(()=>{
        try{ target.scrollIntoView({behavior:"smooth",block:"start"}); }
        catch{ target.scrollIntoView(); }
      });
    }

    function draw(){
      const drawGeneration=++inventoryDrawGeneration;
      const grid=appContext.$("invGrid");

      const nextFilterSignature=currentPaginationFilterSignature();
      if(paginationFirstDraw){
        paginationFirstDraw=false;
        paginationFilterSignature=nextFilterSignature;
      }else if(nextFilterSignature!==paginationFilterSignature){
        paginationFilterSignature=nextFilterSignature;
        if(appContext.listingCurrentPage!==1){
          appContext.listingCurrentPage=1;
          appContext.updateListingUrlFromControls();
        }
      }

      updateActiveFilterIndicators();
      syncPillFilterSummary();
      syncInventoryGameBrowser();
      if(grid) grid.setAttribute("aria-busy","false");

      if(appContext.cards.length===0){
        appContext.captureFilteredResultsBrowseContext([]);
        const mobileResultCount=appContext.$("stickyMobileResultCount");
        if(mobileResultCount) mobileResultCount.textContent="0";
        const desktopResultCount=appContext.$("inventoryResultCount");
        if(desktopResultCount) desktopResultCount.textContent="0";
        const compactMobileResultCount=appContext.$("inventoryMobileCompactResultCount");
        if(compactMobileResultCount) compactMobileResultCount.textContent="0";
        const footerResultCount=appContext.$("mobileFilterFooterResultCount");
        if(footerResultCount) footerResultCount.textContent="0";
        renderPagination(0);
        ["listingPaginationTop","listingPaginationBottom"].forEach(id=>{ const el=appContext.$(id); if(el) el.hidden=true; });
        grid.className="";
        grid.innerHTML=`<div class="empty-state">${appContext.EMPTY_ICON}<h2>No listings yet</h2><p>The catalogue is currently empty.</p></div>`;
        return;
      }

      if(appContext.activeQuickFilter==="trending" && appContext.trending7dBackendState!=="available"){
        appContext.captureFilteredResultsBrowseContext([]);
        const desktopResultCount=appContext.$("inventoryResultCount");
        if(desktopResultCount) desktopResultCount.textContent="0";
        const compactMobileResultCount=appContext.$("inventoryMobileCompactResultCount");
        if(compactMobileResultCount) compactMobileResultCount.textContent="0";
        renderPagination(0);
        ["listingPaginationTop","listingPaginationBottom"].forEach(id=>{ const el=appContext.$(id); if(el) el.hidden=true; });
        grid.className="";
        if(appContext.trending7dBackendState==="error"){
          grid.setAttribute("aria-busy","false");
          grid.innerHTML=`<div class="empty-state inventory-no-results"><div class="empty-icon">↗</div><h3>Trending is temporarily unavailable</h3><p>We could not load the shared 7-day Trending leaderboard. Please try again shortly.</p></div>`;
        }else{
          grid.setAttribute("aria-busy","true");
          grid.innerHTML=`<div class="empty-state inventory-no-results"><div class="empty-icon">↻</div><h3>Loading 7-day Trending…</h3><p>Ranking cards by unique qualified collector interest from the last 7 days.</p></div>`;
        }
        return;
      }

      const list=appContext.getFiltered();
      appContext.captureFilteredResultsBrowseContext(list);
      const mobileResultCount=appContext.$("stickyMobileResultCount");
      if(mobileResultCount) mobileResultCount.textContent=String(list.length);
      const desktopResultCount=appContext.$("inventoryResultCount");
      if(desktopResultCount) desktopResultCount.textContent=list.length.toLocaleString();
      const compactMobileResultCount=appContext.$("inventoryMobileCompactResultCount");
      if(compactMobileResultCount) compactMobileResultCount.textContent=list.length.toLocaleString();
      const footerResultCount=appContext.$("mobileFilterFooterResultCount");
      if(footerResultCount) footerResultCount.textContent=list.length.toLocaleString();
      if(list.length===0 && appContext.activeQuickFilter==="trending"){
        renderPagination(0);
        ["listingPaginationTop","listingPaginationBottom"].forEach(id=>{ const el=appContext.$(id); if(el) el.hidden=true; });
        grid.className="";
        grid.innerHTML=`<div class="empty-state inventory-no-results"><div class="empty-icon">↗</div><h3>No trending cards in the last 7 days</h3><p>No matching listing received a qualified view during the rolling 7-day window.</p></div>`;
        return;
      }

      if(list.length===0){
        const activeCount=activeInventoryFilterCount();
        const hasSearch=!!String(appContext.$("search")?.value||"").trim();
        const hasPrice=!!(appContext.safePriceFilterValue(appContext.$("filterPriceMin")?.value)||appContext.safePriceFilterValue(appContext.$("filterPriceMax")?.value));

        const noScopeCards=scopedCards.length===0;

        renderPagination(0);
        ["listingPaginationTop","listingPaginationBottom"].forEach(id=>{ const el=appContext.$(id); if(el) el.hidden=true; });
        grid.className="";
        grid.innerHTML=appContext.inventoryNoResultsHTML({
          scope:appContext.listingAvailabilityScope,
          activeCount,
          hasSearch,
          hasPrice,
          noScopeCards
        });
        wireNoResultsRecovery(grid);
        return;
      }

      grid.className=appContext.effectiveInventoryViewMode()==="compact" ? "grid compact-list" : "grid";
      if(["inventory","sold"].includes(appContext.listingAvailabilityScope)){
        grid.classList.add("gold-card-stripes");
      }

      if(["collection","inventory"].includes(appContext.listingAvailabilityScope)){
        // Grouped catalogue views remain continuous so one Game category is
        // never split across pagination pages.
        appContext.listingCurrentPage=1;
        ["listingPaginationTop","listingPaginationBottom"].forEach(id=>{
          const mount=appContext.$(id);
          if(!mount) return;
          mount.hidden=true;
          mount.innerHTML="";
        });

        const groupedView=collectionRearrangeMode;
        if(groupedView){
          grid.classList.add("collection-game-grouped");
          grid.innerHTML=appContext.listingAvailabilityScope==="collection"
            ? groupedCollectionHTML(list,appContext.effectiveInventoryViewMode()==="compact")
            : groupedInventoryHTML(list,appContext.effectiveInventoryViewMode()==="compact");
        }else{
          grid.innerHTML=list.map(appContext.cardTileHTML).join("");
        }
      }else{
        const totalPages=Math.max(1,Math.ceil(list.length/appContext.listingPerPage));
        const clampedPage=Math.min(Math.max(1,appContext.listingCurrentPage),totalPages);
        if(clampedPage!==appContext.listingCurrentPage){
          appContext.listingCurrentPage=clampedPage;
          appContext.updateListingUrlFromControls();
        }

        renderPagination(list.length);

        const pageStart=(appContext.listingCurrentPage-1)*appContext.listingPerPage;
        const pageEnd=Math.min(pageStart+appContext.listingPerPage,list.length);
        const pageCards=list.slice(pageStart,pageEnd);

        grid.innerHTML=pageCards
          .map((card,index)=>appContext.cardTileHTML(card,index))
          .join("");
      }

      appContext.wireShimmer(grid);
      requestAnimationFrame(()=>maybeShowFavoriteDiscoveryHint(grid));

      appContext.updateCompareTray();
      if(appContext.isOwnerMode() && appContext.listingAvailabilityScope==="reserved"){
        appContext.refreshOwnerReservedAgeUI(false);
      }
    }

    function collectionRearrangeCardIdsFromDom(){
      return Array.from(
        appContext.$("invGrid")?.querySelectorAll(".collection-game-card[data-card-id]") || []
      ).map(card=>appContext.safeCardId(card.dataset.cardId||"")).filter(Boolean);
    }

    function collectionRearrangeGamesFromDom(){
      return Array.from(
        appContext.$("invGrid")?.querySelectorAll(".collection-game-group-header[data-collection-game-toggle]") || []
      ).map(header=>({
        key:String(header.dataset.collectionGameToggle||""),
        label:String(header.dataset.collectionGameLabel||"").trim() || "Other"
      })).filter(group=>group.key);
    }

    function collectionHasActiveFiltersForRearrange(){
      if(String(appContext.$("search")?.value||"").trim()) return true;
      if(appContext.activeQuickFilter && appContext.activeQuickFilter!=="all") return true;
      if(["filterGame","filterGrade","filterLanguage","filterEra","filterSeries"]
        .some(id=>String(appContext.$(id)?.value||"").trim())) return true;
      return Object.values(appContext.pillFilterState).some(set=>set?.size);
    }

    function syncCollectionRearrangeButton(){
      const buttons=[
        appContext.$("collectionRearrangeBtn"),
        appContext.$("collectionMobileOwnerBtn"),
        appContext.$("inventoryRearrangeBtn"),
        appContext.$("inventoryMobileOwnerBtn")
      ].filter(Boolean);
      const label=appContext.listingAvailabilityScope==="inventory" ? "Inventory" : "Collection";

      buttons.forEach(button=>{
        if(collectionRearrangeMode){
          button.textContent="✓ Save Order";
          button.classList.add("active");
          button.title=collectionRearrangeDirty
            ? `Save this new ${label} order`
            : `Save ${label} order`;
        }else{
          button.textContent=appContext.isMobileOwnerBlocked()
            ? `⇅ Rearrange ${label}`
            : (label==="Inventory" ? "⇅ Rearrange Inventory" : "⇅ Rearrange Cards");
          button.classList.remove("active");
          button.title="Rearrange Game categories and cards";
        }
      });
    }

    function enterCollectionRearrangeMode(){
      if(!appContext.requireCollectionOrderOwner("rearrange Collection cards")) return;
      if(!["collection","inventory"].includes(appContext.listingAvailabilityScope)) return;

      if(appContext.collectionCardOrderSupported===false){
        appContext.showToast("Run the Collection Custom Order SQL migration first");
        return;
      }
      if(appContext.collectionGameOrderSupported===false){
        appContext.showToast("Run the Collection Game Order SQL migration first");
        return;
      }

      if(collectionHasActiveFiltersForRearrange()){
        appContext.showToast("Clear Collection filters before rearranging");
        return;
      }

      if(appContext.$("sortBy")?.value!=="custom"){
        appContext.$("sortBy").value="custom";
        const label=appContext.$("sortByBtn")?.querySelector("span");
        if(label) label.textContent="Custom Order";
      }

      collectionCollapsedGames.clear();
      collectionRearrangeMode=true;
      collectionRearrangeDirty=false;
      draw();
      syncCollectionRearrangeButton();
      document.body.classList.add("collection-rearrange-mode");
      appContext.showToast(`Drag ${appContext.listingAvailabilityScope==="inventory" ? "Inventory" : "Collection"} game headers and cards, then Save Order`);
    }

    async function finishCollectionRearrangeMode(save){
      if(!collectionRearrangeMode) return;

      if(!save){
        collectionRearrangeMode=false;
        collectionRearrangeDirty=false;
        document.body.classList.remove("collection-rearrange-mode");
        draw();
        syncCollectionRearrangeButton();
        appContext.showToast("Rearrange cancelled");
        return;
      }

      const ids=collectionRearrangeCardIdsFromDom();
      const groups=collectionRearrangeGamesFromDom();
      const isInventoryOrder=appContext.listingAvailabilityScope==="inventory";
      const buttons=[
        appContext.$(isInventoryOrder ? "inventoryRearrangeBtn" : "collectionRearrangeBtn"),
        appContext.$(isInventoryOrder ? "inventoryMobileOwnerBtn" : "collectionMobileOwnerBtn")
      ].filter(Boolean);
      buttons.forEach(button=>{ button.disabled=true; button.textContent="Saving…"; });

      const [cardsOk,gamesOk]=await Promise.all([
        isInventoryOrder ? appContext.saveInventoryCardOrder(ids) : appContext.saveCollectionCardOrder(ids),
        isInventoryOrder ? appContext.saveInventoryGameOrder(groups) : appContext.saveCollectionGameOrder(groups)
      ]);

      buttons.forEach(button=>{ button.disabled=false; });
      if(!cardsOk || !gamesOk){
        syncCollectionRearrangeButton();
        return;
      }

      collectionRearrangeMode=false;
      collectionRearrangeDirty=false;
      document.body.classList.remove("collection-rearrange-mode");
      if(appContext.$("sortBy")) appContext.$("sortBy").value="custom";
      draw();
      syncCollectionRearrangeButton();
      appContext.updateListingUrlFromControls();
      appContext.showToast(`${isInventoryOrder ? "Inventory" : "Collection"} order saved`);
    }

    const handleCollectionRearrangeButton=async()=>{
      if(!appContext.canManageCollectionOrder()){
        await appContext.openOwnerAccess();
        return;
      }
      if(collectionRearrangeMode) await finishCollectionRearrangeMode(true);
      else enterCollectionRearrangeMode();
    };

    appContext.$("collectionRearrangeBtn")?.addEventListener("click",handleCollectionRearrangeButton);
    appContext.$("collectionMobileOwnerBtn")?.addEventListener("click",handleCollectionRearrangeButton);
    appContext.$("inventoryRearrangeBtn")?.addEventListener("click",handleCollectionRearrangeButton);
    appContext.$("inventoryMobileOwnerBtn")?.addEventListener("click",handleCollectionRearrangeButton);
    appContext.$("collectionExportCollageBtn")?.addEventListener("click",appContext.openCollectionCollageSettingsModal);
    appContext.$("collectionMobileCollageBtn")?.addEventListener("click",appContext.openCollectionCollageSettingsModal);
    appContext.$("inventoryExportCollageBtn")?.addEventListener("click",appContext.openCollectionCollageSettingsModal);
    appContext.$("inventoryMobileCollageBtn")?.addEventListener("click",appContext.openCollectionCollageSettingsModal);
    appContext.$("inventoryQrDownloadBtn")?.addEventListener("click",appContext.downloadInventoryQrImage);
    [appContext.$("collectionMobileOwnerLogoutBtn"),appContext.$("inventoryMobileOwnerLogoutBtn")].filter(Boolean).forEach(btn=>{
      btn.addEventListener("click",async()=>{
        if(collectionRearrangeMode) await finishCollectionRearrangeMode(false);
        await appContext.openOwnerAccess();
      });
    });

    let collectionDraggedGameHeader=null;
    let collectionGameDragMoved=false;
    let collectionSuppressNextGameClick=false;

    function collectionGameBlockNodes(header){
      const nodes=[];
      let node=header;
      while(node){
        if(node!==header && node.classList?.contains("collection-game-group-header")) break;
        nodes.push(node);
        node=node.nextElementSibling;
      }
      return nodes;
    }

    function moveCollectionGameBlock(sourceHeader,targetHeader,before){
      if(!sourceHeader || !targetHeader || sourceHeader===targetHeader) return;

      const grid=appContext.$("invGrid");
      if(!grid) return;

      const sourceNodes=collectionGameBlockNodes(sourceHeader);
      if(!sourceNodes.length) return;

      const sourceSet=new Set(sourceNodes);
      if(sourceSet.has(targetHeader)) return;

      // Detach the whole category first so header + its cards move together.
      const fragment=document.createDocumentFragment();
      sourceNodes.forEach(node=>fragment.appendChild(node));

      if(before){
        grid.insertBefore(fragment,targetHeader);
      }else{
        const targetNodes=collectionGameBlockNodes(targetHeader);
        const last=targetNodes[targetNodes.length-1];
        grid.insertBefore(fragment,last?.nextSibling||null);
      }

      collectionRearrangeDirty=true;
      syncCollectionRearrangeButton();
    }

    appContext.$("invGrid")?.addEventListener("dragstart",event=>{
      if(!collectionRearrangeMode || !["collection","inventory"].includes(appContext.listingAvailabilityScope)) return;

      const header=event.target.closest(".collection-game-group-header[data-collection-game-toggle]");
      if(!header) return;

      collectionDraggedGameHeader=header;
      collectionGameDragMoved=false;
      header.classList.add("collection-game-dragging");
      try{
        event.dataTransfer.effectAllowed="move";
        event.dataTransfer.setData("text/plain",`game:${header.dataset.collectionGameToggle||""}`);
      }catch{}
    },{signal:inventorySignal});

    appContext.$("invGrid")?.addEventListener("dragover",event=>{
      if(!collectionRearrangeMode || !collectionDraggedGameHeader) return;

      const targetHeader=event.target.closest(".collection-game-group-header[data-collection-game-toggle]");
      if(!targetHeader || targetHeader===collectionDraggedGameHeader) return;

      event.preventDefault();
      event.stopPropagation();
      try{event.dataTransfer.dropEffect="move";}catch{}

      appContext.$("invGrid")?.querySelectorAll(".collection-game-drag-over")
        .forEach(el=>el.classList.remove("collection-game-drag-over"));
      targetHeader.classList.add("collection-game-drag-over");

      const rect=targetHeader.getBoundingClientRect();
      const before=event.clientY < rect.top+rect.height/2;
      moveCollectionGameBlock(collectionDraggedGameHeader,targetHeader,before);
      collectionGameDragMoved=true;
    },{signal:inventorySignal});

    let collectionDraggedCard=null;

    appContext.$("invGrid")?.addEventListener("dragstart",event=>{
      if(!collectionRearrangeMode || !["collection","inventory"].includes(appContext.listingAvailabilityScope)) return;
      if(event.target.closest(".collection-game-group-header")) return;
      const card=event.target.closest(".collection-game-card[data-card-id]");
      if(!card) return;

      collectionDraggedCard=card;
      card.classList.add("collection-dragging");
      try{
        event.dataTransfer.effectAllowed="move";
        event.dataTransfer.setData("text/plain",String(card.dataset.cardId||""));
      }catch{}
    },{signal:inventorySignal});

    appContext.$("invGrid")?.addEventListener("dragend",()=>{
      collectionDraggedCard?.classList.remove("collection-dragging");
      collectionDraggedGameHeader?.classList.remove("collection-game-dragging");

      if(collectionDraggedGameHeader && collectionGameDragMoved){
        collectionSuppressNextGameClick=true;
        setTimeout(()=>{ collectionSuppressNextGameClick=false; },120);
      }

      collectionDraggedCard=null;
      collectionDraggedGameHeader=null;
      collectionGameDragMoved=false;
      appContext.$("invGrid")?.querySelectorAll(".collection-drag-over,.collection-game-drag-over")
        .forEach(el=>{
          el.classList.remove("collection-drag-over");
          el.classList.remove("collection-game-drag-over");
        });
    },{signal:inventorySignal});

    appContext.$("invGrid")?.addEventListener("dragover",event=>{
      if(!collectionRearrangeMode || collectionDraggedGameHeader || !collectionDraggedCard) return;

      const target=event.target.closest(".collection-game-card[data-card-id]");
      if(!target || target===collectionDraggedCard) return;

      if(
        String(target.dataset.collectionGameKey||"") !==
        String(collectionDraggedCard.dataset.collectionGameKey||"")
      ) return;

      event.preventDefault();
      try{event.dataTransfer.dropEffect="move";}catch{}

      appContext.$("invGrid")?.querySelectorAll(".collection-drag-over")
        .forEach(el=>el.classList.remove("collection-drag-over"));
      target.classList.add("collection-drag-over");

      const rect=target.getBoundingClientRect();
      const before=event.clientY < rect.top+rect.height/2;
      const parent=target.parentNode;
      if(before) parent.insertBefore(collectionDraggedCard,target);
      else parent.insertBefore(collectionDraggedCard,target.nextSibling);

      collectionRearrangeDirty=true;
      syncCollectionRearrangeButton();
    },{signal:inventorySignal});

    let collectionPointerDrag=null;

    function clearCollectionPointerDrag(){
      if(!collectionPointerDrag) return;
      collectionPointerDrag.element?.classList.remove(
        "collection-touch-dragging",
        "collection-game-dragging",
        "collection-dragging"
      );
      appContext.$("invGrid")?.querySelectorAll(".collection-touch-target")
        .forEach(el=>el.classList.remove("collection-touch-target"));
      collectionPointerDrag=null;
      document.body.classList.remove("collection-touch-drag-active");
    }

    appContext.$("invGrid")?.addEventListener("pointerdown",event=>{
      if(!collectionRearrangeMode || !appContext.isMobileOwnerBlocked()) return;
      if(event.pointerType==="mouse") return;

      const gameHandle=event.target.closest(".collection-game-drag-handle");
      const cardHandle=event.target.closest(".collection-drag-handle");
      if(!gameHandle && !cardHandle) return;

      const element=gameHandle
        ? gameHandle.closest(".collection-game-group-header")
        : cardHandle.closest(".collection-game-card[data-card-id]");
      if(!element) return;

      event.preventDefault();
      event.stopPropagation();

      collectionPointerDrag={
        pointerId:event.pointerId,
        type:gameHandle ? "game" : "card",
        element,
        gameKey:String(
          gameHandle
            ? element.dataset.collectionGameToggle||""
            : element.dataset.collectionGameKey||""
        )
      };

      element.classList.add("collection-touch-dragging");
      document.body.classList.add("collection-touch-drag-active");
      try{ event.target.setPointerCapture(event.pointerId); }catch{}
    },{signal:inventorySignal});

    appContext.$("invGrid")?.addEventListener("pointermove",event=>{
      const state=collectionPointerDrag;
      if(!state || event.pointerId!==state.pointerId) return;

      event.preventDefault();

      // elementFromPoint may return the dragged element itself. Temporarily
      // hide its pointer hit-testing while we inspect what is underneath.
      state.element.style.pointerEvents="none";
      const under=document.elementFromPoint(event.clientX,event.clientY);
      state.element.style.pointerEvents="";

      if(!under) return;

      if(state.type==="game"){
        const target=under.closest?.(".collection-game-group-header[data-collection-game-toggle]");
        if(!target || target===state.element) return;

        appContext.$("invGrid")?.querySelectorAll(".collection-touch-target")
          .forEach(el=>el.classList.remove("collection-touch-target"));
        target.classList.add("collection-touch-target");

        const rect=target.getBoundingClientRect();
        moveCollectionGameBlock(
          state.element,
          target,
          event.clientY < rect.top+rect.height/2
        );
        return;
      }

      const target=under.closest?.(".collection-game-card[data-card-id]");
      if(!target || target===state.element) return;
      if(String(target.dataset.collectionGameKey||"")!==state.gameKey) return;

      appContext.$("invGrid")?.querySelectorAll(".collection-touch-target")
        .forEach(el=>el.classList.remove("collection-touch-target"));
      target.classList.add("collection-touch-target");

      const rect=target.getBoundingClientRect();
      const parent=target.parentNode;
      if(event.clientY < rect.top+rect.height/2){
        parent.insertBefore(state.element,target);
      }else{
        parent.insertBefore(state.element,target.nextSibling);
      }

      collectionRearrangeDirty=true;
      syncCollectionRearrangeButton();
    },{signal:inventorySignal});

    ["pointerup","pointercancel"].forEach(type=>{
      appContext.$("invGrid")?.addEventListener(type,event=>{
        if(!collectionPointerDrag || event.pointerId!==collectionPointerDrag.pointerId) return;
        clearCollectionPointerDrag();
      },{signal:inventorySignal});
    });

    document.addEventListener("keydown",event=>{
      if(!collectionRearrangeMode || event.key!=="Escape") return;
      event.preventDefault();
      finishCollectionRearrangeMode(false);
    },{signal:inventorySignal});

    appContext.$("invGrid")?.addEventListener("click",event=>{
      if(!["collection","inventory"].includes(appContext.listingAvailabilityScope)) return;

      const header=event.target.closest("[data-collection-game-toggle]");
      if(header){
        event.preventDefault();
        event.stopPropagation();

        if(collectionSuppressNextGameClick){
          collectionSuppressNextGameClick=false;
          return;
        }

        const key=String(header.dataset.collectionGameToggle||"");
        if(!key) return;

        const collapse=!collectionCollapsedGames.has(key);
        if(collapse) collectionCollapsedGames.add(key);
        else collectionCollapsedGames.delete(key);

        header.classList.toggle("collapsed",collapse);
        header.setAttribute("aria-expanded",collapse ? "false" : "true");

        appContext.$("invGrid")?.querySelectorAll(".collection-game-card").forEach(card=>{
          if(String(card.dataset.collectionGameKey||"")===key){
            card.hidden=collapse;
            if(collapse) card.setAttribute("hidden","");
            else card.removeAttribute("hidden");
          }
        });
        return;
      }

      if(collectionRearrangeMode){
        // In rearrange mode, normal card actions/details are disabled,
        // but Game headers above remain usable for collapse/expand.
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    },{signal:inventorySignal});

    const searchSuggestions=appContext.$("searchSuggestions");
    let suggestionIndex=-1;

    const RECENT_SEARCHES_KEY="collect_tcg_recent_inventory_searches_v1";

    function getRecentSearches(){
      try{
        const parsed=JSON.parse(appContext.localStorage.getItem(RECENT_SEARCHES_KEY)||"[]");
        return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0,5) : [];
      }catch{ return []; }
    }

    function rememberSearchQuery(value){
      const clean=String(value||"").trim().replace(/\s+/g," ").slice(0,100);
      if(clean.length<2) return;
      const normalized=appContext.normalizeSearchText(clean);
      const next=[clean,...getRecentSearches().filter(item=>appContext.normalizeSearchText(item)!==normalized)].slice(0,5);
      try{ appContext.localStorage.setItem(RECENT_SEARCHES_KEY,JSON.stringify(next)); }catch{}
    }

    function getSearchSuggestions(query){
      const raw=String(query||"").trim();
      const q=appContext.normalizeSearchText(raw);

      if(!q){
        return getRecentSearches().map(text=>({text,type:"Recent search",query:text}));
      }

      const options=[];
      const seen=new Set();
      const add=(text,type,queryValue=text,score=0)=>{
        const label=String(text||"").trim();
        const value=String(queryValue||label).trim();
        if(!label || !value) return;
        const key=`${type}:${appContext.normalizeSearchText(label)}`;
        if(seen.has(key)) return;
        seen.add(key);
        options.push({text:label,type,query:value,score});
      };

      const matchedCards=scopedCards
        .filter(card=>appContext.cardMatchesSmartSearch(card,raw))
        .map(card=>({card,score:appContext.cardSearchScore(card,raw)}))
        .sort((a,b)=>b.score-a.score || String(a.card.name||"").localeCompare(String(b.card.name||"")))
        .slice(0,5);

      matchedCards.forEach(({card,score})=>{
        const ref=[card.card_code,card.year].filter(Boolean).join(" · ");
        add(card.name,ref ? `Card · ${ref}` : "Card",card.card_code||card.name,1000+score);
      });

      const tokens=appContext.smartSearchTokens(raw);
      const valueMatches=value=>{
        const normalized=appContext.normalizeSearchText(value);
        const compact=normalized.replace(/\s+/g,"");
        return tokens.every(token=>normalized.includes(token) || compact.includes(token.replace(/\s+/g,"")));
      };

      scopedCards.forEach(card=>{
        const entities=[
          [card.card_code,"Card code"],
          [card.series,"Series"],
          [card.game,"Game"],
          [card.year,"Year"],
          [card.language,"Language"]
        ];
        (Array.isArray(card.grading)?card.grading:[]).forEach(g=>{
          if(g?.company) entities.push([`${g.company} ${g.grade||""}`.trim(),"Grade"]);
        });
        entities.forEach(([value,type])=>{
          if(value && valueMatches(value)) add(value,type,value,100);
        });
      });

      return options.sort((a,b)=>b.score-a.score).slice(0,10);
    }

    const mobileSearch=appContext.$("mobileInventorySearch");
    const mobileSearchSuggestions=appContext.$("mobileSearchSuggestions");
    const mobileSearchClear=appContext.$("mobileInventorySearchClear");

    function syncMobileSearchFromMain(){
      if(!mobileSearch) return;
      mobileSearch.value=appContext.$("search")?.value||"";
      if(mobileSearchClear) mobileSearchClear.hidden=!mobileSearch.value;
    }

    function renderMobileSearchSuggestions(){
      if(!mobileSearch || !mobileSearchSuggestions) return;
      const suggestions=getSearchSuggestions(mobileSearch.value);
      mobileSearchSuggestions.hidden=suggestions.length===0;
      mobileSearchSuggestions.innerHTML=suggestions.map(item=>`
        <button type="button" role="option" data-mobile-search-suggestion="${appContext.escapeHtml(item.query||item.text)}">
          <span>${appContext.escapeHtml(item.text)}</span>
          <small>${appContext.escapeHtml(item.type)}</small>
        </button>
      `).join("");

      mobileSearchSuggestions.querySelectorAll("[data-mobile-search-suggestion]").forEach(btn=>{
        btn.addEventListener("mousedown",e=>e.preventDefault());
        btn.addEventListener("click",()=>{
          const value=String(btn.dataset.mobileSearchSuggestion||"").slice(0,100);
          mobileSearch.value=value;
          if(appContext.$("search")) appContext.$("search").value=value;
          mobileSearchSuggestions.hidden=true;
          rememberSearchQuery(value);
          if(mobileSearchClear) mobileSearchClear.hidden=!value;
          appContext.$("search")?.dispatchEvent(new Event("input",{bubbles:true}));
        });
      });
    }

    syncMobileSearchFromMain();

    mobileSearch?.addEventListener("input",()=>{
      const value=mobileSearch.value.slice(0,100);
      if(appContext.$("search")) appContext.$("search").value=value;
      if(mobileSearchClear) mobileSearchClear.hidden=!value;
      renderMobileSearchSuggestions();
      appContext.$("search")?.dispatchEvent(new Event("input",{bubbles:true}));
    });

    mobileSearch?.addEventListener("focus",renderMobileSearchSuggestions);

    function dismissMobileSearchSuggestions(){
      if(mobileSearchSuggestions) mobileSearchSuggestions.hidden=true;
    }

    mobileSearch?.addEventListener("keydown",e=>{
      if(e.key==="Enter" || e.key==="Search"){
        dismissMobileSearchSuggestions();
        mobileSearch.blur();
      }else if(e.key==="Escape"){
        dismissMobileSearchSuggestions();
        mobileSearch.blur();
      }
    });

    // iPhone/Android keyboards can use a Done/Search/tick action that does
    // not always arrive as a normal Enter keydown. The native "search" event
    // on <input type="search"> covers that keyboard action.
    mobileSearch?.addEventListener("search",()=>{
      rememberSearchQuery(mobileSearch.value);
      dismissMobileSearchSuggestions();
      mobileSearch.blur();
    });

    // Some mobile keyboards commit through change/blur instead of keydown.
    mobileSearch?.addEventListener("change",dismissMobileSearchSuggestions);
    mobileSearch?.addEventListener("blur",()=>{
      // Delay slightly so tapping a visible suggestion still gets its click.
      setTimeout(dismissMobileSearchSuggestions,80);
    });

    mobileSearchClear?.addEventListener("click",()=>{
      mobileSearch.value="";
      if(appContext.$("search")) appContext.$("search").value="";
      mobileSearchClear.hidden=true;
      if(mobileSearchSuggestions) mobileSearchSuggestions.hidden=true;
      appContext.$("search")?.dispatchEvent(new Event("input",{bubbles:true}));
      mobileSearch.focus();
    });

    function renderSearchSuggestions(){
      if(!searchSuggestions) return;
      const suggestions=getSearchSuggestions(appContext.$("search").value);
      suggestionIndex=-1;
      searchSuggestions.hidden=suggestions.length===0;
      searchSuggestions.innerHTML=suggestions.map((item,i)=>`
        <button type="button" role="option" data-search-suggestion="${appContext.escapeHtml(item.query||item.text)}" data-suggestion-index="${i}">
          <span>${appContext.escapeHtml(item.text)}</span>
          <small>${appContext.escapeHtml(item.type)}</small>
        </button>
      `).join("");

      searchSuggestions.querySelectorAll("[data-search-suggestion]").forEach(btn=>{
        btn.addEventListener("mousedown",e=>e.preventDefault());
        btn.addEventListener("click",()=>{
          appContext.$("search").value=String(btn.dataset.searchSuggestion||"").slice(0,100);
          searchSuggestions.hidden=true;
          rememberSearchQuery(appContext.$("search").value);
          appContext.$("search").dispatchEvent(new Event("input",{bubbles:true}));
        });
      });
    }

    appContext.$("search").addEventListener("focus",renderSearchSuggestions);
    appContext.$("search").addEventListener("input",()=>{
      renderSearchSuggestions();
      syncMobileSearchFromMain();
      syncDesktopSearchFromMain();
      appContext.scheduleInventorySearchAnalytics();
    });
    appContext.$("search").addEventListener("keydown",e=>{
      if(e.key==="Enter"){
        if(searchSuggestions && !searchSuggestions.hidden && suggestionIndex>=0){
          const items=Array.from(searchSuggestions.querySelectorAll("[data-search-suggestion]"));
          if(items[suggestionIndex]){
            e.preventDefault();
            items[suggestionIndex].click();
            searchSuggestions.hidden=true;
            return;
          }
        }

        // Enter with no highlighted suggestion keeps the typed query but
        // dismisses the dropdown so the results are unobstructed.
        if(searchSuggestions) searchSuggestions.hidden=true;
        suggestionIndex=-1;
        rememberSearchQuery(appContext.$("search").value);
        appContext.$("search").blur();
        return;
      }

      if(!searchSuggestions || searchSuggestions.hidden) return;
      const items=Array.from(searchSuggestions.querySelectorAll("[data-search-suggestion]"));
      if(!items.length) return;

      if(e.key==="ArrowDown" || e.key==="ArrowUp"){
        e.preventDefault();
        suggestionIndex=e.key==="ArrowDown"
          ? (suggestionIndex+1)%items.length
          : (suggestionIndex-1+items.length)%items.length;
        items.forEach((item,i)=>item.classList.toggle("active",i===suggestionIndex));
      }else if(e.key==="Escape"){
        searchSuggestions.hidden=true;
        suggestionIndex=-1;
      }
    });

    document.addEventListener("click",e=>{
      if(!e.target.closest(".inventory-search-wrap") && searchSuggestions){
        searchSuggestions.hidden=true;
      }
      if(!e.target.closest(".mobile-inventory-search") && mobileSearchSuggestions){
        mobileSearchSuggestions.hidden=true;
      }
    },{signal:inventorySignal});

    function changeListingPerPage(value){
      appContext.listingPerPage=appContext.setSavedListingPerPage(Number(value));
      appContext.listingCurrentPage=1;

      // Keep desktop and mobile controls synchronized. The desktop control is
      // hidden on phones but still exists in the page markup.
      ["listingPerPageSelect","mobileListingPerPageSelect"].forEach(id=>{
        const select=appContext.$(id);
        if(select && Number(select.value)!==appContext.listingPerPage){
          select.value=String(appContext.listingPerPage);
        }
      });

      appContext.updateListingUrlFromControls();
      draw();
    }

    appContext.$("listingPerPageSelect")?.addEventListener("change",e=>{
      changeListingPerPage(e.target.value);
    });

    appContext.$("mobileListingPerPageSelect")?.addEventListener("change",e=>{
      changeListingPerPage(e.target.value);
    });

    const handlePaginationClick=e=>{
      const button=e.target.closest(".listing-page-btn");
      if(!button || button.disabled) return;

      const list=appContext.getFiltered();
      const totalPages=Math.max(1,Math.ceil(list.length/appContext.listingPerPage));
      let nextPage=appContext.listingCurrentPage;

      if(button.dataset.pageDirection==="prev"){
        nextPage=Math.max(1,appContext.listingCurrentPage-1);
      }else if(button.dataset.pageDirection==="next"){
        nextPage=Math.min(totalPages,appContext.listingCurrentPage+1);
      }else if(button.dataset.listingPage){
        nextPage=appContext.safeListingPage(button.dataset.listingPage);
      }

      nextPage=Math.min(Math.max(1,nextPage),totalPages);
      if(nextPage===appContext.listingCurrentPage) return;

      const fromBottom=!!button.closest("#listingPaginationBottom");
      try{button.blur();}catch{}

      appContext.listingCurrentPage=nextPage;
      appContext.updateListingUrlFromControls();
      draw();

      if(fromBottom){
        const scrollToNewListingTop=()=>{
          const heading=document.querySelector(".listing-page-head");
          if(!heading) return;

          const shell=document.querySelector(".shell");
          const mobileShellScroll=
            window.matchMedia("(max-width:800px)").matches &&
            shell &&
            getComputedStyle(shell).overflowY!=="visible";

          if(mobileShellScroll){
            // Mobile uses .shell as the real scrolling viewport.
            const shellRect=shell.getBoundingClientRect();
            const headingRect=heading.getBoundingClientRect();
            const target=
              shell.scrollTop +
              (headingRect.top-shellRect.top) -
              6;

            shell.scrollTo({
              top:Math.max(0,target),
              left:0,
              behavior:"auto"
            });
          }else{
            // Desktop/laptop use the normal document viewport.
            const target=
              window.scrollY +
              heading.getBoundingClientRect().top -
              6;

            window.scrollTo({
              top:Math.max(0,target),
              left:window.scrollX,
              behavior:"auto"
            });
          }
        };

        // draw() updates the listing synchronously, but run once immediately
        // and once after layout paint for image/font/mobile viewport settling.
        scrollToNewListingTop();
        requestAnimationFrame(scrollToNewListingTop);
      }
    };

    appContext.$("listingPaginationTop")?.addEventListener("click",handlePaginationClick);
    appContext.$("listingPaginationBottom")?.addEventListener("click",handlePaginationClick);

    appContext.$("compactViewToggle")?.addEventListener("click",()=>{
      if(appContext.isMobileInventoryLayout()) return;
      const next=appContext.getInventoryViewMode()==="compact" ? "grid" : "compact";
      appContext.setInventoryViewMode(next);
      const compact=next==="compact";
      appContext.$("compactViewToggle").setAttribute("aria-pressed",compact?"true":"false");
      appContext.$("compactViewToggle").textContent=compact ? "▦ Grid View" : "☷ Compact View";
      draw();
    });

    let lastMobileInventoryLayout=appContext.isMobileInventoryLayout();
    const inventoryLayoutResizeHandler=()=>{
      const mobileNow=appContext.isMobileInventoryLayout();
      if(mobileNow===lastMobileInventoryLayout) return;
      lastMobileInventoryLayout=mobileNow;

      const toggle=appContext.$("compactViewToggle");
      if(toggle){
        const compact=appContext.effectiveInventoryViewMode()==="compact";
        toggle.setAttribute("aria-pressed",compact?"true":"false");
        toggle.textContent=compact ? "▦ Grid View" : "☷ Compact View";
      }
      draw();
    };
    window.addEventListener("resize",inventoryLayoutResizeHandler,{
      passive:true,
      signal:inventorySignal
    });

    function closeMobileSortSheet(){
      const sheet=appContext.$("mobileSortSheet");
      const backdrop=appContext.$("mobileSortBackdrop");
      if(sheet) sheet.hidden=true;
      if(backdrop) backdrop.hidden=true;
      appContext.$("stickyMobileSortBtn")?.setAttribute("aria-expanded","false");
      document.body.classList.remove("mobile-sort-open");
    }

    function closeMobileFilterDrawer(){
      const shell=appContext.$("filterDrawerShell");
      const backdrop=appContext.$("mobileFilterBackdrop");
      shell?.classList.remove("open");
      if(backdrop) backdrop.hidden=true;
      appContext.$("mobileFilterOpenBtn")?.setAttribute("aria-expanded","false");
      appContext.$("stickyMobileFilterBtn")?.setAttribute("aria-expanded","false");
      document.body.classList.remove("mobile-filter-open");
    }

    function openMobileFilterDrawer(){
      closeMobileSortSheet();
      const shell=appContext.$("filterDrawerShell");
      const backdrop=appContext.$("mobileFilterBackdrop");
      shell?.classList.add("open");
      if(backdrop) backdrop.hidden=false;
      appContext.$("mobileFilterOpenBtn")?.setAttribute("aria-expanded","true");
      appContext.$("stickyMobileFilterBtn")?.setAttribute("aria-expanded","true");
      document.body.classList.add("mobile-filter-open");
    }

    function openMobileSortSheet(){
      closeMobileFilterDrawer();
      const sheet=appContext.$("mobileSortSheet");
      const backdrop=appContext.$("mobileSortBackdrop");
      syncMobileSortSheetSelection();
      if(sheet) sheet.hidden=false;
      if(backdrop) backdrop.hidden=false;
      appContext.$("stickyMobileSortBtn")?.setAttribute("aria-expanded","true");
      document.body.classList.add("mobile-sort-open");
    }

    appContext.$("mobileSortOptions")?.addEventListener("click",event=>{
      const option=event.target.closest("[data-mobile-sort-value]");
      if(!option) return;
      const value=String(option.dataset.mobileSortValue||"");
      const label=String(option.dataset.mobileSortLabel||option.textContent||"").trim();
      const hidden=appContext.$("sortBy");
      const desktopLabel=appContext.$("sortByBtn")?.querySelector("span");
      if(hidden) hidden.value=value;
      if(desktopLabel) desktopLabel.textContent=label;
      syncMobileSortSheetSelection();
      hidden?.dispatchEvent(new Event("change",{bubbles:true}));
      closeMobileSortSheet();
    });

    appContext.$("mobileFilterOpenBtn")?.addEventListener("click",openMobileFilterDrawer);
    appContext.$("stickyMobileFilterBtn")?.addEventListener("click",openMobileFilterDrawer);
    appContext.$("stickyMobileSortBtn")?.addEventListener("click",openMobileSortSheet);
    appContext.$("mobileFilterCloseBtn")?.addEventListener("click",closeMobileFilterDrawer);
    appContext.$("mobileFilterApplyBtn")?.addEventListener("click",closeMobileFilterDrawer);
    appContext.$("mobileFilterBackdrop")?.addEventListener("click",closeMobileFilterDrawer);
    appContext.$("mobileSortCloseBtn")?.addEventListener("click",closeMobileSortSheet);
    appContext.$("mobileSortBackdrop")?.addEventListener("click",closeMobileSortSheet);
    document.addEventListener("keydown",event=>{
      if(event.key!=="Escape") return;
      closeMobileSortSheet();
    },{signal:inventorySignal});

    appContext.consumeHomeViewAllScrollTarget();

    function clearAllInventoryFilters(){
      appContext.$("search").value="";
      if(appContext.$("mobileInventorySearch")) appContext.$("mobileInventorySearch").value="";
      if(appContext.$("mobileInventorySearchClear")) appContext.$("mobileInventorySearchClear").hidden=true;
      if(appContext.$("mobileSearchSuggestions")) appContext.$("mobileSearchSuggestions").hidden=true;
      ["filterGame","filterGrade","filterLanguage","filterEra","filterAvailability","filterSeries"].forEach(id=>{
        const el=appContext.$(id);
        if(el) el.value="";
      });
      if(appContext.$("filterPriceMin")) appContext.$("filterPriceMin").value="";
      if(appContext.$("filterPriceMax")) appContext.$("filterPriceMax").value="";

      const defaults={
        filterGame:"All Games",
        filterGrade:"All Grades / Conditions",
        filterLanguage:"All Languages",
        filterEra:"All Eras",
        filterAvailability:"All Availability",
        filterSeries:"All Series"
      };
      Object.entries(defaults).forEach(([id,label])=>{
        const btn=appContext.$(id+"Btn");
        if(btn) btn.querySelector("span").textContent=label;
      });

      const defaultSort=appContext.listingAvailabilityScope==="sold"
        ? "recent-sold"
        : (["inventory","collection"].includes(appContext.listingAvailabilityScope)
            ? "custom"
            : "name");
      appContext.$("sortBy").value=defaultSort;
      appContext.$("sortByBtn").querySelector("span").textContent=
        defaultSort==="recent-sold"
          ? "Sort: Recently Sold"
          : (defaultSort==="newest"
              ? "Newest Added"
              : (defaultSort==="custom" ? "Custom Order" : "Name: A → Z"));

      appContext.activeQuickFilter="all";
      Object.values(appContext.pillFilterState).forEach(set=>set.clear());
      appContext.$("gradeShortcuts")?.querySelectorAll("button").forEach(btn=>btn.classList.remove("active"));
      appContext.syncQuickFilterUI();
      appContext.updateListingUrlFromControls();
      syncPillFilterSummary();
      draw();
      closeMobileFilterDrawer();
      appContext.showToast("Filters cleared");
    }

    appContext.$("clearAllFiltersBtn")?.addEventListener("click",clearAllInventoryFilters);

    ["search","filterGame","filterGrade","filterLanguage","filterEra","filterAvailability","filterSeries","filterPriceMin","filterPriceMax","sortBy"].forEach(id=>{
      const el = appContext.$(id);
      if(!el) return;

      el.addEventListener("input", ()=>{
        if(collectionRearrangeMode && ["collection","inventory"].includes(appContext.listingAvailabilityScope)) return;
        appContext.updateListingUrlFromControls();
        draw();
      });
      el.addEventListener("change", ()=>{
        if(collectionRearrangeMode && ["collection","inventory"].includes(appContext.listingAvailabilityScope)) return;
        appContext.updateListingUrlFromControls();
        draw();
      });
    });

    appContext.$("currencyPreference")?.addEventListener("change",e=>{
      const currency=appContext.setPriceCurrencyPreference(e.target.value);
      appContext.syncCurrencyEverywhere(currency);
      const priceLabel=document.querySelector(".price-range-label");
      if(priceLabel) priceLabel.textContent=`Price (${currency})`;
      appContext.updateListingUrlFromControls();
      draw();
      appContext.showToast(`${currency} prices shown first`);
    },{signal:inventorySignal});

    const desktopQuickFiltersToggle=appContext.$("desktopQuickFiltersToggle");
    const desktopQuickFilters=appContext.$("quickFilters");

    const setDesktopQuickFiltersExpanded=(expanded)=>{
      if(!desktopQuickFilters || !desktopQuickFiltersToggle) return;

      // Mobile keeps the existing always-visible category pills.
      if(window.matchMedia("(max-width:800px)").matches){
        desktopQuickFilters.hidden=false;
        desktopQuickFilters.classList.remove("is-expanded");
        desktopQuickFiltersToggle.classList.remove("is-expanded");
        desktopQuickFiltersToggle.setAttribute("aria-expanded","true");
        return;
      }

      const open=Boolean(expanded);
      desktopQuickFilters.hidden=!open;
      desktopQuickFilters.classList.toggle("is-expanded",open);
      desktopQuickFiltersToggle.classList.toggle("is-expanded",open);
      desktopQuickFiltersToggle.setAttribute("aria-expanded",open ? "true" : "false");
    };

    // v43: top category filters stay visible on desktop.
    setDesktopQuickFiltersExpanded(true);

    desktopQuickFiltersToggle?.addEventListener("click",()=>{
      const currentlyOpen=desktopQuickFiltersToggle.getAttribute("aria-expanded")==="true";
      setDesktopQuickFiltersExpanded(!currentlyOpen);
    });

    appContext.$("quickFilters").querySelectorAll(".quick-filter").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        if(collectionRearrangeMode && ["collection","inventory"].includes(appContext.listingAvailabilityScope)) return;
        appContext.activeQuickFilter = btn.dataset.quick;
        appContext.syncQuickFilterUI();
        appContext.updateListingUrlFromControls();

        if(appContext.activeQuickFilter==="trending"){
          const load=appContext.refreshTrending7dPerformance();
          draw();
          await load;
          if(appContext.activeQuickFilter==="trending") draw();
          return;
        }

        draw();
      });
    });

    appContext.$("copyFilterLinkBtn")?.addEventListener("click", async ()=>{
      appContext.updateListingUrlFromControls();
      const url = location.href;
      try{
        await navigator.clipboard.writeText(url);
        appContext.showToast("Filtered link copied");
      }catch{
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly","");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
        appContext.showToast("Filtered link copied");
      }
    });

    function syncPillFilterSummary(){
      const mount=appContext.$("pillFilterSummary");
      if(!mount) return;

      const selections=[];
      const addControl=(id,label,value,resetLabel)=>{
        const text=String(value||"").trim();
        if(text) selections.push({kind:"control",id,label,value:text,resetLabel});
      };

      if(appContext.activeQuickFilter && appContext.activeQuickFilter!=="all"){
        const quickLabels={
          graded:"Slabs",
          raw:"Raw",
          sealed:"Sealed",
          championship:"Championship",
          vintage:"Vintage",
          trending:"Trending"
        };
        selections.push({
          kind:"quick",
          id:"quick",
          label:"Category",
          value:quickLabels[appContext.activeQuickFilter]||appContext.activeQuickFilter
        });
      }

      addControl("search","Search",appContext.$("search")?.value,"");
      addControl("filterGame","Game",appContext.$("filterGame")?.value,"All Games");
      addControl("filterGrade","Grade / Condition",appContext.$("filterGrade")?.value,"All Grades / Conditions");
      addControl("filterLanguage","Language",appContext.$("filterLanguage")?.value,"All Languages");
      addControl("filterEra","Era",appContext.$("filterEra")?.value,"All Eras");
      addControl("filterSeries","Series",appContext.$("filterSeries")?.value,"All Series");

      const pmin=appContext.safePriceFilterValue(appContext.$("filterPriceMin")?.value);
      const pmax=appContext.safePriceFilterValue(appContext.$("filterPriceMax")?.value);
      if(pmin||pmax){
        selections.push({
          kind:"price",
          id:"price",
          label:`Price (${appContext.getPriceCurrencyPreference()})`,
          value:pmin&&pmax ? `${pmin}–${pmax}` : (pmin ? `≥ ${pmin}` : `≤ ${pmax}`)
        });
      }

      Object.entries(appContext.pillFilterState).forEach(([type,set])=>{
        Array.from(set).forEach(value=>selections.push({
          kind:"pill",
          id:type,
          label:type==="grade" ? "Grade / Condition" : appContext.normalizeStoredLabel(type),
          value
        }));
      });

      mount.hidden=selections.length===0;
      mount.innerHTML=selections.length ? `
        <span class="pill-filter-summary-label">Active filters</span>
        ${selections.map((item,index)=>`
          <button type="button"
                  class="active-pill-filter"
                  data-active-filter-index="${index}"
                  title="Remove ${appContext.escapeHtml(item.label)} filter">
            ${appContext.escapeHtml(item.label)}: ${appContext.escapeHtml(item.value)} <span>×</span>
          </button>
        `).join("")}
        <button type="button" class="clear-pill-filters" id="clearPillFilters">Clear all</button>
      ` : "";

      mount.querySelectorAll("[data-active-filter-index]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const item=selections[Number(btn.dataset.activeFilterIndex)];
          if(!item) return;

          if(item.kind==="pill"){
            appContext.pillFilterState[item.id]?.delete(item.value);
          }else if(item.kind==="quick"){
            appContext.activeQuickFilter="all";
            appContext.syncQuickFilterUI();
          }else if(item.kind==="price"){
            if(appContext.$("filterPriceMin")) appContext.$("filterPriceMin").value="";
            if(appContext.$("filterPriceMax")) appContext.$("filterPriceMax").value="";
          }else{
            const el=appContext.$(item.id);
            if(el) el.value="";
            const controlBtn=appContext.$(item.id+"Btn");
            if(controlBtn && item.resetLabel){
              const span=controlBtn.querySelector("span");
              if(span) span.textContent=item.resetLabel;
            }
          }

          appContext.updateListingUrlFromControls();
          draw();
        });
      });

      appContext.$("clearPillFilters")?.addEventListener("click",clearAllInventoryFilters);

      // Keep dropdown labels informative while multi-select card pills are active.
      const maps=[
        ["game","filterGame","Games"],
        ["grade","filterGrade","Grades / Conditions"],
        ["language","filterLanguage","Languages"],
        ["era","filterEra","Eras"],
        ["availability","filterAvailability","Availability"],
        ["series","filterSeries","Series"]
      ];
      maps.forEach(([type,id,plural])=>{
        const set=appContext.pillFilterState[type];
        const btn=appContext.$(id+"Btn");
        if(!btn || !set?.size) return;
        const span=btn.querySelector("span");
        if(span) span.textContent=set.size===1 ? Array.from(set)[0] : `${set.size} ${plural}`;
      });
    }

    syncPillFilterSummary();
    appContext.syncQuickFilterUI();
    requestAnimationFrame(()=>{
      if(appContext.activeQuickFilter==="trending"){
        const load=appContext.refreshTrending7dPerformance();
        draw();
        load.then(()=>{
          if(appContext.activeQuickFilter==="trending") draw();
        });
      }else{
        draw();
      }
    });
    appContext.setupInventoryStickyBarVisibility();

    appContext.$("invGrid").addEventListener("keydown", e=>{
      if(e.key !== "Enter" && e.key !== " ") return;
      const tile = e.target.closest(".card[data-card-id]");
      if(!tile) return;
      e.preventDefault();
      const card = appContext.getCardById(tile.dataset.cardId||"");
      if(card) appContext.openCardRoute(card.id);
    });
  }

function renderByGamePage(){
    appContext.view.innerHTML = `<div class="page-head"><div><div class="eyebrow">Organize</div><h2>By Game</h2><p>Collect TCG MY & SG inventory, organized by game.</p></div></div><div id="byGameMount"></div>`;
    const mount = appContext.$("byGameMount");
    if(appContext.cards.length === 0){
      mount.innerHTML = `<div class="empty-state">${appContext.EMPTY_ICON}<h2>Nothing to group yet</h2><p>Add a few cards and they'll be sorted here by game.</p><a href="#/add" class="btn-primary" style="display:inline-block;">+ Add a card</a></div>`;
      return;
    }
    const byGame = {};
    appContext.cards.forEach(c=>{ (byGame[c.game] = byGame[c.game] || []).push(c); });
    const games = Object.keys(byGame).sort();
    mount.innerHTML = games.map(g=>{
      const list = byGame[g].slice().sort((a,b)=>a.name.localeCompare(b.name));
      return `
        <div class="game-group">
          <div class="game-group-head"><h3>${appContext.escapeHtml(g)}</h3><span class="count">${list.length} listing${list.length===1?"":"s"}</span><hr></div>
          <div class="grid">${list.map(appContext.cardTileHTML).join("")}</div>
        </div>
      `;
    }).join("");
    appContext.wireShimmer(mount);
  }

  Object.assign(appContext,{syncQuickFilterUI,inventoryQuickFiltersHTML,inventoryPageHTML,inventoryFilterOptions,inventorySortOptions,inventoryScopeEmptyText,inventorySkeletonHTML,inventoryNoResultsHTML,renderInventoryPage,renderByGamePage});
}
