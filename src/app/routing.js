/** V93 beta: app/routing. Shared dependencies are explicit on appContext. */
export function register(appContext){
function safeListingBrowseHash(value){
    const hash=String(value||"").slice(0,1500);
    return /^#\/(inventory|collection|reserved|sold)(?:\?|$)/.test(hash) ? hash : "";
  }

function normalizeCardDiscoverySource(value){
    const source=String(value||"").trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");
    const allowed=new Set([
      "trending","recently-added","spotlight","related",
      "vintage","championship","sealed","search","inventory-filtered",
      "inventory","collection","reserved","sold","recently-viewed","favorites","home"
    ]);
    return allowed.has(source) ? source : "";
  }

function rememberCardDiscoverySource(cardId,source){
    const id=appContext.safeCardId(cardId);
    const normalized=appContext.normalizeCardDiscoverySource(source);
    if(!id || !normalized) return "";
    const payload={card_id:id,source:normalized,at:Date.now()};
    appContext.cardDiscoveryContext=payload;
    try{
      appContext.sessionStorage.setItem(appContext.CARD_DISCOVERY_CONTEXT_KEY,JSON.stringify(payload));
    }catch{}
    return normalized;
  }

function getCardDiscoverySource(cardId){
    const id=appContext.safeCardId(cardId);
    if(!id) return "";
    let payload=appContext.cardDiscoveryContext;
    if(!payload){
      try{payload=JSON.parse(appContext.sessionStorage.getItem(appContext.CARD_DISCOVERY_CONTEXT_KEY)||"null");}
      catch{payload=null;}
    }
    if(!payload || String(payload.card_id||"")!==id) return "";
    if(Date.now()-Number(payload.at||0)>30*60*1000) return "";
    return appContext.normalizeCardDiscoverySource(payload.source);
  }

function currentCardDiscoverySource(){
    const route=appContext.currentRoute();
    if(route==="home") return "home";
    if(route==="recent") return "recently-viewed";
    if(route==="favorites") return "favorites";
    if(!appContext.isInventoryRoute(route)) return "";

    const params=appContext.currentHashParams();
    const quick=appContext.normalizeCardDiscoverySource(params.get("quick")||"");
    if(["trending","vintage","championship","sealed"].includes(quick)) return quick;
    if(String(params.get("sort")||"").toLowerCase()==="newest") return "recently-added";
    if(String(params.get("q")||params.get("search")||"").trim()) return "search";
    if([...params.keys()].some(key=>!["sort","page"].includes(key))) return "inventory-filtered";
    return appContext.normalizeCardDiscoverySource(route);
  }

function clearFilteredResultsBrowseContext(){
    appContext.filteredResultsBrowseContext=null;
    try{appContext.sessionStorage.removeItem(appContext.FILTERED_RESULTS_BROWSE_KEY);}catch{}
  }

function captureFilteredResultsBrowseContext(list){
    const route=appContext.currentRoute();
    if(!appContext.isInventoryRoute(route)) return;

    const sourceHash=appContext.safeListingBrowseHash(location.hash||`#/${route}`);
    if(!sourceHash) return;

    const ids=[];
    const seen=new Set();
    (Array.isArray(list)?list:[]).forEach(card=>{
      const id=appContext.safeCardId(card?.id);
      if(!id || seen.has(id) || !appContext.isLiveLifecycle(card) || ids.length>=2000) return;
      seen.add(id);
      ids.push(id);
    });

    const context={source_hash:sourceHash,ids};
    appContext.filteredResultsBrowseContext=context;
    try{appContext.sessionStorage.setItem(appContext.FILTERED_RESULTS_BROWSE_KEY,JSON.stringify(context));}catch{}
  }

function getFilteredResultsBrowseContext(){
    let raw=appContext.filteredResultsBrowseContext;
    if(!raw){
      try{raw=JSON.parse(appContext.sessionStorage.getItem(appContext.FILTERED_RESULTS_BROWSE_KEY)||"null");}
      catch{raw=null;}
    }
    if(!raw || !appContext.safeListingBrowseHash(raw.source_hash) || !Array.isArray(raw.ids)) return null;

    const liveIds=new Set(appContext.cards.filter(appContext.isLiveLifecycle).map(card=>String(card.id)));
    const ids=[];
    const seen=new Set();
    raw.ids.slice(0,2000).forEach(value=>{
      const id=appContext.safeCardId(value);
      if(!id || seen.has(id) || !liveIds.has(id)) return;
      seen.add(id);
      ids.push(id);
    });

    if(!ids.length) return null;
    appContext.filteredResultsBrowseContext={source_hash:appContext.safeListingBrowseHash(raw.source_hash),ids};
    return appContext.filteredResultsBrowseContext;
  }

function getFilteredResultNavigation(cardId){
    const id=appContext.safeCardId(cardId);
    const context=id ? appContext.getFilteredResultsBrowseContext() : null;
    if(!context) return null;

    const index=context.ids.indexOf(id);
    if(index<0) return null;

    return {
      index,
      total:context.ids.length,
      previous:index>0 ? context.ids[index-1] : "",
      next:index<context.ids.length-1 ? context.ids[index+1] : "",
      source_hash:context.source_hash
    };
  }

function listingRouteFromHash(hash){
    const safeHash=appContext.safeListingBrowseHash(hash);
    if(!safeHash) return "";

    const raw=safeHash.replace(/^#\/?/,"");
    const route=raw.split("?")[0].trim();
    return appContext.isInventoryRoute(route) ? route : "";
  }

function currentListingDomScope(){
    const tools=appContext.view?.querySelector?.(".listing-filter-tools[data-listing-scope]");
    const scope=String(tools?.dataset?.listingScope||"");
    if(!appContext.isInventoryRoute(scope)) return "";
    return appContext.view.querySelector("#invGrid") ? scope : "";
  }

function canPreserveCurrentListing(hash){
    const safeHash=appContext.safeListingBrowseHash(hash);
    const route=appContext.listingRouteFromHash(safeHash);
    return !!safeHash && !!route && appContext.currentListingDomScope()===route;
  }

function canReusePreservedListing(hash){
    const safeHash=appContext.safeListingBrowseHash(hash);
    if(!safeHash || safeHash!==appContext.detailsPreservedListingHash) return false;

    const route=appContext.listingRouteFromHash(safeHash);
    return !!route && appContext.currentListingDomScope()===route;
  }

function setNavigationActiveRoute(route){
    const safeRoute=String(route||"");
    document.querySelectorAll("#mainnav a, #premiumDesktopNav a[data-route], #premiumDesktopMoreMenu a[data-route]").forEach(a=>{
      a.classList.toggle("active",a.dataset.route===safeRoute);
    });

    const moreToggle=appContext.$("mobileMoreToggle");
    if(moreToggle){
      moreToggle.classList.toggle(
        "active",
        appContext.shouldHighlightMore(safeRoute)
      );
    }

    const premiumMore=document.getElementById("premiumDesktopMore");
    if(premiumMore){
      premiumMore.classList.toggle("active",appContext.shouldHighlightMore(safeRoute));
    }

    const moreMenu=appContext.mobileMoreMenuEl;
    if(moreMenu){
      moreMenu.querySelectorAll("a").forEach(a=>{
        a.classList.toggle("active",a.dataset.route===safeRoute);
      });
    }
  }

function rememberReturnScroll(hash){
    const safeHash=String(hash||"").slice(0,1500);
    if(!safeHash || safeHash.includes("#/card/")) return;
    try{
      const shell=document.querySelector(".shell");
      appContext.sessionStorage.setItem(appContext.LISTING_SCROLL_STATE_KEY,JSON.stringify({
        hash:safeHash,
        y:Math.max(0,Math.round(window.scrollY||0)),
        x:Math.max(0,Math.round(window.scrollX||0)),
        shellY:shell ? Math.max(0,Math.round(shell.scrollTop||0)) : 0,
        shellX:shell ? Math.max(0,Math.round(shell.scrollLeft||0)) : 0
      }));
    }catch{}
  }

function restoreReturnScrollIfReady(){
    try{
      const parsed=JSON.parse(appContext.sessionStorage.getItem(appContext.LISTING_SCROLL_STATE_KEY)||"null");
      if(!parsed || parsed.hash!==location.hash) return;
      const y=Number(parsed.y||0);
      if(!Number.isFinite(y) || y<0) return;

      const coordinate=value=>{
        const number=Number(value||0);
        return Number.isFinite(number) && number>=0 ? number : 0;
      };
      appContext.sessionStorage.removeItem(appContext.LISTING_SCROLL_STATE_KEY);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        // Do not move a different page if the visitor navigated again meanwhile.
        if(location.hash!==parsed.hash) return;
        const shell=document.querySelector(".shell");
        // Older saved positions contain only window coordinates.
        if(shell && parsed.shellY!=null){
          shell.scrollTo({top:coordinate(parsed.shellY),left:coordinate(parsed.shellX),behavior:"auto"});
        }
        window.scrollTo({top:y,left:coordinate(parsed.x),behavior:"auto"});
      }));
    }catch{}
  }

function cardShareHash(cardId){
    return `#/card/${encodeURIComponent(cardId)}`;
  }

function captureInsightsDetailsReturnState(){
    const shell=document.querySelector(".shell");
    appContext.insightsDetailsReturnState={
      hash:String(location.hash||"#/insights").slice(0,1500),
      windowY:Math.max(0,Math.round(window.scrollY||0)),
      shellY:shell ? Math.max(0,Math.round(shell.scrollTop||0)) : 0
    };
  }

function restoreInsightsDetailsReturnState(){
    const state=appContext.insightsDetailsReturnState;
    appContext.insightsDetailsReturnState=null;
    if(!state) return;

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const shell=document.querySelector(".shell");

      if(shell){
        shell.scrollTo({
          top:state.shellY,
          left:0,
          behavior:"auto"
        });
      }

      window.scrollTo({
        top:state.windowY,
        left:0,
        behavior:"auto"
      });
    }));
  }

function openInsightsCardDetails(cardId){
    const id=appContext.safeCardId(cardId);
    if(!id || appContext.currentRoute()!=="insights") return;

    const card=appContext.getCardById(id);
    if(!card || (!appContext.isOwnerMode() && !appContext.isLiveLifecycle(card))) return;

    // Insights is intentionally kept rendered underneath Card Details.
    // Do not change location.hash to #/card/... for this entry point.
    appContext.detailsReturnHash=location.hash||"#/insights";
    appContext.detailsPreservedListingHash="";
    appContext.clearFilteredResultsBrowseContext();
    appContext.captureInsightsDetailsReturnState();
    appContext.openDetailsModal(card);
  }

async function openCardRoute(cardId,discoverySource=""){
    const id=appContext.safeCardId(cardId);
    if(!id) return;

    const route=appContext.currentRoute();
    const current=location.hash||"#/home";
    if(!route.startsWith("card/")){
      appContext.detailsReturnHash=current;
      appContext.rememberReturnScroll(current);

      appContext.detailsPreservedListingHash=appContext.canPreserveCurrentListing(current)
        ? appContext.safeListingBrowseHash(current)
        : "";

      if(!appContext.isInventoryRoute(route)){
        appContext.clearFilteredResultsBrowseContext();
      }
    }

    const card=appContext.getCardById(id);
    const source=appContext.normalizeCardDiscoverySource(discoverySource) || appContext.currentCardDiscoverySource();
    if(source) appContext.rememberCardDiscoverySource(id,source);

    if(card && appContext.isLiveLifecycle(card)){
      let clean=appContext.publishedSeoCardUrl(card);
      if(!clean){
        await appContext.loadSeoCardSlugMap();
        clean=appContext.publishedSeoCardUrl(card);
      }
      if(clean){
        try{
          appContext.sessionStorage.setItem(
            "collect_tcg_clean_card_return_v1",
            String(appContext.detailsReturnHash||current||"#/home").slice(0,1500)
          );
        }catch{}

        let pushedCleanUrl=false;
        try{
          const cleanUrl=new URL(clean,location.href);
          if(cleanUrl.origin===location.origin){
            const state=history.state && typeof history.state==="object"
              ? {...history.state}
              : {};
            state.collectTcgSpaCardId=id;
            state.collectTcgSpaCard=true;
            history.pushState(state,"",cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
            pushedCleanUrl=true;
          }
        }catch{}

        if(pushedCleanUrl){
          appContext.openDetailsModal(card);
          return;
        }

        const fallbackTarget=appContext.cardShareHash(id);
        if(location.hash===fallbackTarget){
          appContext.openDetailsModal(card);
        }else{
          location.hash=fallbackTarget;
        }
        return;
      }
    }

    const target=appContext.cardShareHash(id);
    if(location.hash===target){
      if(card && (appContext.isOwnerMode() || appContext.isLiveLifecycle(card))) appContext.openDetailsModal(card);
    }else{
      location.hash=target;
    }
  }

function getCollectionStats(){
    return appContext.cards.filter(appContext.isLiveLifecycle).reduce((acc, card)=>{
      const status = appContext.normalizeFilterValue(card && card.availability ? card.availability : "Available");
      const format = appContext.normalizeFilterValue(appContext.effectiveFormat(card));
      const era = appContext.normalizeFilterValue(card && card.era ? card.era : "");

      if(status === "sold") acc.sold += 1;
      else if(status === "reserved") acc.reserved += 1;
      else if(status === "collection (nfs)") acc.collection += 1;
      else acc.inventory += 1;

      if(format === "graded") acc.graded += 1;
      if(format === "sealed") acc.sealed += 1;
      if(era === "vintage") acc.vintage += 1;

      return acc;
    }, {inventory:0,collection:0,reserved:0,sold:0,graded:0,vintage:0,sealed:0});
  }

function updateStatusNavCounts(){
    const counts = appContext.cards.filter(appContext.isLiveLifecycle).reduce((acc, card)=>{
      const status = appContext.normalizeFilterValue(card && card.availability ? card.availability : "Available");
      if(status === "sold") acc.sold += 1;
      else if(status === "reserved") acc.reserved += 1;
      else if(status === "collection (nfs)") acc.collection += 1;
      else acc.inventory += 1;
      return acc;
    }, {inventory:0,collection:0,reserved:0,sold:0});

    const inventoryCount = appContext.$("inventoryNavCount");
    const collectionCount = appContext.$("collectionNavCount");
    const reservedCount = appContext.$("reservedNavCount");
    const soldCount = appContext.$("soldNavCount");

    if(inventoryCount) inventoryCount.textContent = counts.inventory.toLocaleString();
    if(collectionCount) collectionCount.textContent = counts.collection.toLocaleString();
    if(reservedCount) reservedCount.textContent = counts.reserved.toLocaleString();
    if(soldCount) soldCount.textContent = counts.sold.toLocaleString();
  }

function currentRoute(){
    const h = location.hash.replace(/^#\/?/, "");
    const hashRoute=(h.split("?")[0] || "").trim();
    if(hashRoute) return hashRoute;
    const spaCardId=appContext.safeCardId(
      history.state && typeof history.state==="object"
        ? history.state.collectTcgSpaCardId
        : ""
    );
    if(spaCardId) return `card/${spaCardId}`;

    const seoCardId=appContext.safeCardId(
      document.querySelector('meta[name="collect-tcg-card-id"]')?.content || ""
    );
    return seoCardId ? `card/${seoCardId}` : "home";
  }

function currentHashParams(){
    const raw = location.hash.replace(/^#\/?/, "");
    const qIndex = raw.indexOf("?");
    return new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : "");
  }

function scrollListingPageHeaderIntoView(){
    const heading=document.querySelector(".listing-page-head");
    if(!heading) return false;

    const shell=document.querySelector(".shell");
    const mobileShellScroll=
      window.matchMedia("(max-width:800px)").matches &&
      shell &&
      getComputedStyle(shell).overflowY!=="visible";

    if(mobileShellScroll){
      const shellRect=shell.getBoundingClientRect();
      const headingRect=heading.getBoundingClientRect();
      const target=shell.scrollTop + (headingRect.top-shellRect.top) - 6;
      shell.scrollTo({top:Math.max(0,target),left:0,behavior:"auto"});
    }else{
      const target=window.scrollY + heading.getBoundingClientRect().top - 6;
      window.scrollTo({top:Math.max(0,target),left:window.scrollX,behavior:"auto"});
    }
    return true;
  }

function consumeHomeViewAllScrollTarget(){
    let shouldScroll=false;
    try{
      shouldScroll=appContext.sessionStorage.getItem("collect_tcg_scroll_listing_header_once")==="1";
      if(shouldScroll) appContext.sessionStorage.removeItem("collect_tcg_scroll_listing_header_once");
    }catch{}
    if(!shouldScroll) return;

    // Wait for the destination route/cards to paint, then align to the page header.
    requestAnimationFrame(()=>{
      appContext.scrollListingPageHeaderIntoView();
      requestAnimationFrame(appContext.scrollListingPageHeaderIntoView);
    });
  }

function safeUrlFilterText(value, maxLength = 100){
    return String(value ?? "").trim().slice(0, maxLength);
  }

function safePriceFilterValue(value){
    const raw=String(value??"").trim();
    if(!raw) return "";
    const n=Number(raw);
    if(!Number.isFinite(n) || n<0) return "";
    return String(Math.min(n,1000000000000));
  }

function listingRouteForScope(scope = appContext.listingAvailabilityScope){
    return appContext.isInventoryRoute(scope) ? scope : "inventory";
  }

function updateListingUrlFromControls(){
    const route = appContext.listingRouteForScope();
    const params = new URLSearchParams();

    const put = (key, value, maxLength = 100)=>{
      const safe = appContext.safeUrlFilterText(value, maxLength);
      if(safe) params.set(key, safe);
    };

    put("q", appContext.$("search")?.value, 100);
    put("game", appContext.$("filterGame")?.value, 60);
    put("grade", appContext.$("filterGrade")?.value, 60);
    put("lang", appContext.$("filterLanguage")?.value, 24);
    put("era", appContext.$("filterEra")?.value, 40);
    if(route === "inventory") put("availability", appContext.$("filterAvailability")?.value, 40);
    put("series", appContext.$("filterSeries")?.value, 80);

    const pmin=appContext.safePriceFilterValue(appContext.$("filterPriceMin")?.value);
    const pmax=appContext.safePriceFilterValue(appContext.$("filterPriceMax")?.value);
    if(pmin) params.set("pmin",pmin);
    if(pmax) params.set("pmax",pmax);
    if(route!=="collection") params.set("pc",appContext.getPriceCurrencyPreference());

    const sort = appContext.safeUrlFilterText(appContext.$("sortBy")?.value, 24);
    const defaultSort = route === "sold"
      ? "recent-sold"
      : (route === "collection" ? "custom" : "name");
    if(sort && sort !== defaultSort) params.set("sort", sort);

    if(appContext.activeQuickFilter && appContext.activeQuickFilter !== "all"){
      params.set("quick", appContext.activeQuickFilter);
    }

    if(!["inventory","collection"].includes(route)){
      params.set("per",String(appContext.listingPerPage));
      if(appContext.listingCurrentPage>1) params.set("page",String(appContext.listingCurrentPage));
    }

    const pillKeys = {
      game:"pga",
      grade:"pg",
      language:"pl",
      era:"pe",
      availability:"pa",
      series:"ps"
    };
    Object.entries(pillKeys).forEach(([type,key])=>{
      Array.from(appContext.pillFilterState[type] || [])
        .slice(0,12)
        .forEach(value=>{
          const safe = appContext.safeUrlFilterText(value, 80);
          if(safe) params.append(key, safe);
        });
    });

    const query = params.toString();
    const nextHash = `#/${route}${query ? `?${query}` : ""}`;
    if(location.hash !== nextHash){
      history.replaceState(null, "", nextHash);
    }
  }

function router(){
    appContext.updateStatusNavCounts();
    const route=appContext.currentRoute();

    if(appContext.routeBase(route)==="psa-sync"){
      appContext.handleIncomingPsaPopSync();
      return;
    }

    // Central fail-closed route gate. This protects direct URLs/bookmarks as
    // well as clicks from desktop/mobile navigation.
    if(appContext.isOwnerOnlyRoute(route) && !appContext.isOwnerMode()){
      if(location.hash!=="#/inventory"){
        appContext.goToRoute("inventory");
        return;
      }
    }

    const isCardRoute=route.startsWith("card/");
    const listingRoutes=new Set(["inventory","collection","reserved","sold"]);
    const reusePreservedListingOnReturn=
      !isCardRoute &&
      listingRoutes.has(route) &&
      appContext.canReusePreservedListing(location.hash);

    if(!isCardRoute && !listingRoutes.has(route)){
      appContext.cleanupInventoryRenderListeners();
      appContext.detailsPreservedListingHash="";
    }

    // Browser Back must dismiss details on Home/Favorites as well as listings.
    if(!isCardRoute && !appContext.detailsOverlay.hidden){
      appContext.closeDetailsModal(false);
    }
    const routedCardCandidate = isCardRoute
      ? appContext.getCardById(decodeURIComponent(route.slice(5)))
      : null;
    const routedCard = routedCardCandidate && (appContext.isOwnerMode() || appContext.isLiveLifecycle(routedCardCandidate))
      ? routedCardCandidate
      : null;
    const cardStatus=routedCard ? appContext.normalizeFilterValue(routedCard.availability) : "";
    const cardParentRoute = cardStatus === "collection (nfs)"
      ? "collection"
      : (cardStatus === "reserved" ? "reserved" : (cardStatus === "sold" ? "sold" : "inventory"));

    const cardReturnRoute=appContext.routeBase(String(appContext.detailsReturnHash||"").replace(/^#\/?/,""));
    const cardActiveRoute=isCardRoute && cardReturnRoute==="home"
      ? "home"
      : cardParentRoute;

    document.querySelectorAll("#mainnav a, #premiumDesktopNav a[data-route], #premiumDesktopMoreMenu a[data-route]").forEach(a=>{
      a.classList.toggle("active", isCardRoute ? a.dataset.route === cardActiveRoute : a.dataset.route === route);
    });
    const moreToggle = appContext.$("mobileMoreToggle");
    if(moreToggle){
      moreToggle.classList.toggle(
        "active",
        appContext.shouldHighlightMore(route)
      );
    }
    const premiumMore = document.getElementById("premiumDesktopMore");
    if(premiumMore){
      premiumMore.classList.toggle("active", appContext.shouldHighlightMore(route));
    }
    const moreMenu = appContext.mobileMoreMenuEl;
    if(moreMenu){
      moreMenu.querySelectorAll("a").forEach(a=>{
        a.classList.toggle("active", a.dataset.route === route);
      });
    }
    if(isCardRoute){
      if(!appContext.detailsReturnHash){
        try{
          const savedReturn=String(appContext.sessionStorage.getItem("collect_tcg_clean_card_return_v1")||"").slice(0,1500);
          if(savedReturn && !savedReturn.includes("#/card/")) appContext.detailsReturnHash=savedReturn;
          appContext.sessionStorage.removeItem("collect_tcg_clean_card_return_v1");
        }catch{}
        if(!appContext.detailsReturnHash){
          const filteredContext=appContext.getFilteredResultsBrowseContext();
          if(filteredContext?.source_hash) appContext.detailsReturnHash=filteredContext.source_hash;
        }
      }
      const cardId = decodeURIComponent(route.slice(5));
      const candidate = appContext.cards.find(c=>c.id === cardId);
      const card = candidate && (appContext.isOwnerMode() || appContext.isLiveLifecycle(candidate)) ? candidate : null;
      const cardStatus=card ? appContext.normalizeFilterValue(card.availability) : "";
      const cardScope = cardStatus === "collection (nfs)"
        ? "collection"
        : (cardStatus === "reserved" ? "reserved" : (cardStatus === "sold" ? "sold" : "inventory"));

      const reuseExistingListing=
        !!appContext.detailsPreservedListingHash &&
        appContext.canReusePreservedListing(appContext.detailsPreservedListingHash);

      const returnRoute=appContext.routeBase(String(appContext.detailsReturnHash||"").replace(/^#\/?/,""));

      if(returnRoute==="home"){
        // Card opened from Home: keep Home rendered underneath the modal.
        // Closing Card Details will therefore reveal Home immediately, with
        // no Inventory page flash/background.
        appContext.renderHomePage();
      }else if(!reuseExistingListing){
        appContext.renderInventoryPage(cardScope);
      }

      if(card){
        appContext.openDetailsModal(card);
      }else{
        appContext.closeDetailsModal(false);
        appContext.showToast("Card not found");
      }
    }
    else if(route === "analytics-exclude") appContext.renderAnalyticsExclusionPairingPage();
    else if(route === "home") appContext.renderHomePage();
    else if(route === "inventory"){
      if(!reusePreservedListingOnReturn) appContext.renderInventoryPage("inventory");
    }
    else if(route === "collection"){
      if(!reusePreservedListingOnReturn) appContext.renderInventoryPage("collection");
    }
    else if(route === "reserved"){
      if(!reusePreservedListingOnReturn) appContext.renderInventoryPage("reserved");
    }
    else if(route === "sold"){
      if(!reusePreservedListingOnReturn) appContext.renderInventoryPage("sold");
    }
    else if(route === "recent") appContext.renderRecentlyViewedPage();
    else if(route === "favorites") appContext.renderFavoritesPage();
    else if(route === "by-game"){
      if(appContext.isOwnerMode()) appContext.renderByGamePage();
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "showcase") appContext.renderShowcasePage();
    else if(route === "giveaway") appContext.renderGiveawayPage();
    else if(route === "reviews") appContext.renderReviewsPage();
    else if(route === "insights"){ if(appContext.isOwnerMode()) appContext.renderInsightsPage(); else { appContext.goToRoute("inventory"); return; } }
    else if(route === "fb-tools"){
      if(appContext.isOwnerMode()) appContext.renderFacebookToolsPage();
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "fb-posts"){
      if(appContext.isOwnerMode()) { location.hash="#/fb-tools?mode=single"; return; }
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "fb-card-list"){
      if(appContext.isOwnerMode()) { location.hash="#/fb-tools?mode=list"; return; }
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "quality"){
      if(appContext.isOwnerMode()) appContext.renderDataQualityPage();
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "inventory-tools"){
      if(appContext.isOwnerMode()) appContext.renderInventoryToolsPage();
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "bulk-prices"){
      if(appContext.isOwnerMode()) { location.hash="#/inventory-tools?mode=bulk&sub=prices"; return; }
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "bulk-metadata"){
      if(appContext.isOwnerMode()) { location.hash="#/inventory-tools?mode=bulk&sub=metadata"; return; }
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "recent-edits"){
      if(appContext.isOwnerMode()) { location.hash="#/inventory-tools?mode=activity&sub=recent"; return; }
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "export"){
      if(appContext.isOwnerMode()) appContext.renderInventoryExportPage();
      else { appContext.goToRoute("inventory"); return; }
    }
    else if(route === "add"){
      if(appContext.isOwnerMode()) appContext.renderAddPage();
      else { location.hash = "#/inventory"; return; }
    }
    else if(route === "about") appContext.renderAboutPage();
    else if(route === "contact") appContext.renderContactPage();
    else appContext.renderInventoryPage();
    appContext.updateSidebarFooter();

    if(!isCardRoute && !reusePreservedListingOnReturn){
      appContext.view.classList.remove("view-enter");
      void appContext.view.offsetWidth;
      appContext.view.classList.add("view-enter");
    }

    appContext.restoreReturnScrollIfReady();

    if(reusePreservedListingOnReturn){
      appContext.detailsPreservedListingHash="";
    }
  }

function updateSidebarFooter(){
    // "Listings" means listing records, not inventory quantity.
    const count=appContext.$("sfCount");
    if(count) count.textContent=appContext.cards.filter(appContext.isLiveLifecycle).length.toLocaleString();
  }

  Object.assign(appContext,{safeListingBrowseHash,normalizeCardDiscoverySource,rememberCardDiscoverySource,getCardDiscoverySource,currentCardDiscoverySource,clearFilteredResultsBrowseContext,captureFilteredResultsBrowseContext,getFilteredResultsBrowseContext,getFilteredResultNavigation,listingRouteFromHash,currentListingDomScope,canPreserveCurrentListing,canReusePreservedListing,setNavigationActiveRoute,rememberReturnScroll,restoreReturnScrollIfReady,cardShareHash,captureInsightsDetailsReturnState,restoreInsightsDetailsReturnState,openInsightsCardDetails,openCardRoute,getCollectionStats,updateStatusNavCounts,currentRoute,currentHashParams,scrollListingPageHeaderIntoView,consumeHomeViewAllScrollTarget,safeUrlFilterText,safePriceFilterValue,listingRouteForScope,updateListingUrlFromControls,router,updateSidebarFooter});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.CARD_DISCOVERY_CONTEXT_KEY = "collect_tcg_card_discovery_context_v1";
  appContext.cardDiscoveryContext = null;
  appContext.insightsDetailsReturnState = null;

window.addEventListener("hashchange", appContext.router);
window.addEventListener("popstate", appContext.router);

  appContext.CARD_WATERMARK_LOGO = "./assets/watermark-logo.png";

  appContext.CARD_WATERMARK_URL = "https://collecttcg.github.io/Collect_TCG/#/inventory";

  appContext.CARD_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

  appContext.CARD_IMAGE_TYPES = new Set([
    "image/jpeg","image/png","image/webp","image/avif","image/heic","image/heif"
  ]);

  appContext.watermarkLogoPromise = null;
}
