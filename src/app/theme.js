/** V93 beta: app/theme. Shared dependencies are explicit on appContext. */
export function register(appContext){
function applyTheme(theme){
    const light = theme === "light";
    document.body.classList.toggle("light-mode", light);
    const btn = appContext.$("themeToggle");
    if(btn) btn.textContent = light ? "☾ Dark mode" : "☀ Light mode";
    const mobileBtn = appContext.$("mobileHeaderThemeToggle");
    if(mobileBtn){
      const icon=mobileBtn.querySelector(".ic");
      const label=mobileBtn.querySelector(".mobile-theme-label");
      if(icon) icon.textContent = light ? "☾" : "☀";
      if(label) label.textContent = light ? "Dark mode" : "Light mode";
      mobileBtn.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
      mobileBtn.title = light ? "Dark mode" : "Light mode";
    }
  }

function loadTheme(){
    // Dark is the default unless the visitor explicitly chose light.
    const saved = appContext.localStorage.getItem(appContext.THEME_KEY);
    appContext.applyTheme(saved === "light" ? "light" : "dark");
  }

function setupMobileMoreMenu(){
    const toggle = appContext.$("mobileMoreToggle");
    const menu = appContext.mobileMoreMenuEl;
    if(!toggle || !menu) return;

    const closeMenu = ()=>{
      menu.hidden = true;
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded","false");
    };

    toggle.addEventListener("click", e=>{
      e.stopPropagation();
      const willOpen = menu.hidden;
      if(willOpen){
        menu.hidden = false;
        toggle.classList.add("open");
        toggle.setAttribute("aria-expanded","true");
      }else{
        closeMenu();
      }
    });

    menu.addEventListener("click", e=>{
      if(e.target.closest("a, .mobile-more-theme-toggle")) closeMenu();
    });

    document.addEventListener("click", e=>{
      if(!menu.hidden && !menu.contains(e.target) && !toggle.contains(e.target)){
        closeMenu();
      }
    });

    window.addEventListener("resize", ()=>{
      // Keep the shared More menu usable on both desktop and mobile.
      // Close only if its toggle is no longer visible after a responsive layout change.
      if(getComputedStyle(toggle).display === "none") closeMenu();

      toggle.classList.toggle(
        "active",
        appContext.shouldHighlightMore(appContext.currentRoute())
      );
    });
  }

function setupMobilePullToRefresh(){
    const shell=document.querySelector(".shell");
    const indicator=appContext.$("pullRefreshIndicator");
    const label=appContext.$("pullRefreshText");
    if(!shell || !indicator || !label) return;

    const threshold=72;
    const maxOffset=104;

    let startX=0;
    let startY=0;
    let pulling=false;
    let directionLocked=false;
    let refreshing=false;
    let ready=false;

    const isMobile=()=>window.matchMedia("(max-width: 800px)").matches;

    const modalIsOpen=id=>{
      const el=appContext.$(id);
      return !!el && !el.hidden;
    };

    const canStart=target=>{
      if(!isMobile() || refreshing || shell.scrollTop>0) return false;
      if(modalIsOpen("detailsOverlay") ||
         modalIsOpen("modalOverlay") ||
         modalIsOpen("compareOverlay") ||
         modalIsOpen("imageLightbox") ||
         modalIsOpen("videoOverlay")) return false;
      if(document.body.classList.contains("mobile-filter-open")) return false;

      // Do not steal gestures from horizontal carousels/scrollers.
      if(target?.closest?.(
        ".quick-filters,.showcase-category-bar,.details-secondary-actions,.detail-slider"
      )) return false;

      return true;
    };

    const resetVisual=()=>{
      indicator.classList.remove("is-pulling","is-ready");
      indicator.style.setProperty("--pull-offset","0px");
      indicator.style.setProperty("--pull-progress","0");
      indicator.setAttribute("aria-hidden",refreshing ? "false" : "true");
      if(!refreshing) label.textContent="Pull to refresh";
      ready=false;
    };

    const performRefresh=async()=>{
      if(refreshing) return;
      refreshing=true;
      pulling=false;
      ready=false;

      indicator.classList.remove("is-pulling","is-ready");
      indicator.classList.add("is-refreshing");
      indicator.style.setProperty("--pull-offset","58px");
      indicator.setAttribute("aria-hidden","false");
      label.textContent="Refreshing…";

      // Mobile pull-to-refresh used to fire three independent Supabase reloads
      // (cards, giveaways, and showcases). A transient failure in any auxiliary
      // request could incorrectly report that the whole collection failed.
      // Reload the current document instead: the hash route is preserved, app
      // startup performs the canonical data load, and browser refresh behavior
      // is consistent regardless of which screen the visitor is viewing.
      try{
        await new Promise(resolve=>setTimeout(resolve,120));
        window.location.reload();
      }catch(error){
        console.error("Page refresh error:",error);
        // Very old/embedded browsers may reject reload(). Fall back to assigning
        // the exact current URL, which also preserves the current hash route.
        window.location.href=window.location.href;
      }
    };

    shell.addEventListener("touchstart",e=>{
      if(e.touches.length!==1 || !canStart(e.target)) return;

      const touch=e.touches[0];
      startX=touch.clientX;
      startY=touch.clientY;
      pulling=true;
      directionLocked=false;
      ready=false;
    },{passive:true});

    shell.addEventListener("touchmove",e=>{
      if(!pulling || refreshing || e.touches.length!==1) return;

      const touch=e.touches[0];
      const dx=touch.clientX-startX;
      const dy=touch.clientY-startY;

      if(!directionLocked && (Math.abs(dx)>8 || Math.abs(dy)>8)){
        directionLocked=true;

        if(Math.abs(dx)>Math.abs(dy)){
          pulling=false;
          resetVisual();
          return;
        }
      }

      if(dy<=0 || shell.scrollTop>0){
        resetVisual();
        return;
      }

      // The app uses its own bounded .shell scroller on mobile, so this
      // custom gesture provides predictable pull-to-refresh across iOS/Android.
      if(e.cancelable) e.preventDefault();

      const damped=Math.min(maxOffset,dy*.55);
      const progress=Math.min(1,damped/threshold);
      ready=damped>=threshold;

      indicator.classList.add("is-pulling");
      indicator.classList.toggle("is-ready",ready);
      indicator.setAttribute("aria-hidden","false");
      indicator.style.setProperty("--pull-offset",`${Math.max(10,damped)}px`);
      indicator.style.setProperty("--pull-progress",String(progress));
      label.textContent=ready ? "Release to refresh" : "Pull to refresh";
    },{passive:false});

    const finishPull=()=>{
      if(!pulling || refreshing) return;

      const shouldRefresh=ready;
      pulling=false;
      directionLocked=false;

      if(shouldRefresh){
        performRefresh();
      }else{
        resetVisual();
      }
    };

    shell.addEventListener("touchend",finishPull,{passive:true});
    shell.addEventListener("touchcancel",()=>{
      pulling=false;
      directionLocked=false;
      resetVisual();
    },{passive:true});

    window.addEventListener("resize",()=>{
      if(!isMobile() && !refreshing){
        pulling=false;
        directionLocked=false;
        resetVisual();
      }
    },{passive:true});
  }

  Object.assign(appContext,{applyTheme,loadTheme,setupMobileMoreMenu,setupMobilePullToRefresh});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
appContext.$("themeToggle").addEventListener("click", ()=>{
    const next = document.body.classList.contains("light-mode") ? "dark" : "light";
    appContext.localStorage.setItem(appContext.THEME_KEY, next);
    appContext.applyTheme(next);
  });

appContext.$("mobileHeaderThemeToggle")?.addEventListener("click", ()=>{
    const next = document.body.classList.contains("light-mode") ? "dark" : "light";
    appContext.localStorage.setItem(appContext.THEME_KEY, next);
    appContext.applyTheme(next);
  });

appContext.$("mobileFooterCurrencyPreference")?.addEventListener("change",e=>{
    const currency=appContext.setPriceCurrencyPreference(e.target.value);
    appContext.syncCurrencyEverywhere(currency);

    // If an inventory-style listing is currently rendered, rebuild it so
    // price order and any currency-sensitive labels update immediately.
    const route=appContext.currentRoute();
    if(appContext.isInventoryRoute(route) && appContext.$("invGrid")){
      const priceLabel=document.querySelector(".price-range-label");
      if(priceLabel) priceLabel.textContent=`Price (${currency})`;
      appContext.updateListingUrlFromControls();
      draw();
    }

    appContext.showToast(`${currency} prices shown first`);
  });

appContext.view.addEventListener("change",e=>{
    const select=e.target.closest?.("#mobileHeaderCurrencyPreference");
    if(!select) return;
    const currency=appContext.setPriceCurrencyPreference(select.value);
    appContext.syncCurrencyEverywhere(currency);
    const route=appContext.currentRoute();
    if(appContext.isInventoryRoute(route) && appContext.$("invGrid")){
      const priceLabel=document.querySelector(".price-range-label");
      if(priceLabel) priceLabel.textContent=`Price (${currency})`;
      appContext.updateListingUrlFromControls();
      draw();
    }
    appContext.showToast(`${currency} prices shown first`);
  });

appContext.loadTheme();
}
