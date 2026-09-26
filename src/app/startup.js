/** V93 beta: app/startup. Shared dependencies are explicit on appContext. */
export function register(appContext){
function renderAppLoadingState(force=false){
    if(!appContext.view || (!force && appContext.view.children.length)) return;

    appContext.view.innerHTML=`
      <div class="catalogue-load-state" role="status" aria-live="polite">
        <div class="catalogue-load-spinner" aria-hidden="true"></div>
        <strong>Loading collection…</strong>
        <span>Fetching the latest listings.</span>
      </div>
    `;
  }

function renderCatalogueLoadError(){
    if(!appContext.view) return;

    appContext.view.innerHTML=`
      <div class="catalogue-load-state catalogue-load-error" role="alert">
        <div class="empty-icon">!</div>
        <strong>Inventory temporarily unavailable</strong>
        <span>We could not load the catalogue. Your local favorites and settings were not changed.</span>
        <button type="button" class="btn-primary" data-retry-catalogue>Retry</button>
      </div>
    `;
  }

async function reloadCatalogueFromUi(){
    appContext.renderAppLoadingState(true);

    const [cardsResult]=await Promise.all([
      appContext.loadCards(),
      appContext.loadGiveaways(),
      appContext.loadShowcases()
    ]);

    if(!cardsResult){
      appContext.renderCatalogueLoadError();
      return false;
    }

    appContext.router();
    return true;
  }

async function startApp(){
    appContext.renderAppLoadingState();

    // A Card Overview → Post Generator new-tab launch carries only a random
    // handoff nonce in the URL. Before owner-route gating runs, securely obtain
    // the already-authenticated Supabase session from the same-origin opener.
    // Access/refresh tokens are passed only through same-origin postMessage and
    // are never placed in the URL.
    const ownerPostHandoffRequested=
      appContext.currentRoute()==="fb-tools" && !!appContext.currentOwnerPostHandoffNonce();

    let ownerPostHandoffSucceeded=false;
    if(ownerPostHandoffRequested){
      ownerPostHandoffSucceeded=await appContext.receiveOwnerPostGeneratorHandoff();
    }

    // Successful handoff already populated ownerSession/ownerVerified.
    // If the cross-tab handoff could not run, fall back to the normal Supabase
    // persisted-session lookup while preserving the fb-tools hash.
    if(!ownerPostHandoffSucceeded){
      await appContext.refreshOwnerSession();
    }

    // Restore/check persistent personal-device exclusion before any analytics
    // event can be recorded, then consume any supplied exclusion link/QR.
    // This grants no Owner Mode permissions.
    await appContext.consumeAnalyticsExclusionLinkIfPresent();
    await appContext.consumeAnalyticsExclusionQrIfPresent();

    // Record an anonymous session before the normal Website Visit so
    // later Qualified Views can contribute to Browsing Depth.
    if(!appContext.isOwnerMode() && !appContext.isAnalyticsExcludedDevice()){
      await appContext.recordAnalyticsSession();
      appContext.startSessionDurationTracking();
      appContext.recordWebsiteVisit();
    }

    const initialRoute=appContext.currentRoute();
    const directCardEntry=String(initialRoute||"").startsWith("card/");

    // Direct SEO/shared card entries only need the card catalogue before the
    // requested Card Details can render. Giveaways/showcases are unrelated to
    // that first paint, so load them afterward instead of extending the card's
    // loading screen.
    let cardsLoaded=false;
    if(directCardEntry){
      cardsLoaded=await appContext.loadCards();
    }else{
      [cardsLoaded]=await Promise.all([
        appContext.loadCards(),
        appContext.loadGiveaways(),
        appContext.loadShowcases()
      ]);
    }

    if(!cardsLoaded){
      appContext.renderCatalogueLoadError();
      appContext.updateSidebarFooter();
      return;
    }

    // If this was a secure Post Generator handoff, owner mode must still be
    // established here before the first owner-only route render.
    if(ownerPostHandoffSucceeded && !appContext.isOwnerMode()){
      console.warn("Owner Post Generator handoff lost owner state before routing.");
      appContext.showToast("Could not open Post Generator as owner");
      return;
    }

    // Single initial route render. loadCards no longer calls router internally.
    appContext.router();

    if(directCardEntry){
      Promise.allSettled([
        appContext.loadGiveaways(),
        appContext.loadShowcases()
      ]).catch(()=>{});
    }
  }

async function removeLegacyAppRefreshCaches(){
    try{
      if("serviceWorker" in navigator){
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration=>registration.unregister()));
      }
    }catch(error){
      console.warn("Could not unregister legacy service worker:",error);
    }

    try{
      if("caches" in window){
        const keys=await caches.keys();
        await Promise.all(keys.map(key=>caches.delete(key)));
      }
    }catch(error){
      console.warn("Could not clear legacy app caches:",error);
    }
  }

  Object.assign(appContext,{renderAppLoadingState,renderCatalogueLoadError,reloadCatalogueFromUi,startApp,removeLegacyAppRefreshCaches});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.siteLogo = document.querySelector(".shop-logo");

if(appContext.siteLogo){
    appContext.siteLogo.addEventListener("error", ()=>{
      appContext.siteLogo.style.display = "none";
      const logoLink = appContext.siteLogo.closest(".logo-click-target");
      if(logoLink) logoLink.style.display = "none";
    }, { once:true });
  }

appContext.view.addEventListener("click",e=>{
    if(e.target.closest("[data-retry-catalogue]")){
      appContext.reloadCatalogueFromUi();
    }
  });

  appContext.deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault();
    appContext.deferredInstallPrompt=e;
    try{
      if(appContext.localStorage.getItem("collect_tcg_pwa_dismissed_v1")!=="1"){
        appContext.$("pwaInstallBanner").hidden=false;
      }
    }catch{
      appContext.$("pwaInstallBanner").hidden=false;
    }
  });

appContext.$("pwaInstallDismiss")?.addEventListener("click",()=>{
    appContext.$("pwaInstallBanner").hidden=true;
    try{appContext.localStorage.setItem("collect_tcg_pwa_dismissed_v1","1");}catch{}
  });

appContext.$("pwaInstallBtn")?.addEventListener("click",async()=>{
    if(!appContext.deferredInstallPrompt){
      appContext.showToast("Use your browser's Add to Home Screen option");
      return;
    }
    appContext.deferredInstallPrompt.prompt();
    try{await appContext.deferredInstallPrompt.userChoice;}catch{}
    appContext.deferredInstallPrompt=null;
    appContext.$("pwaInstallBanner").hidden=true;
  });

window.addEventListener("appinstalled",()=>{
    appContext.deferredInstallPrompt=null;
    appContext.$("pwaInstallBanner").hidden=true;
  });

appContext.setupCardImageRecovery();

appContext.setupMobileMoreMenu();

appContext.setupMobilePullToRefresh();

appContext.removeLegacyAppRefreshCaches().finally(()=>appContext.startApp());
}
