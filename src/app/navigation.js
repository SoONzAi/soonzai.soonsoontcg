/** V93 beta: app/navigation. Shared dependencies are explicit on appContext. */
export function register(appContext){
function routeBase(route){
    return String(route||"").split("?")[0].trim().toLowerCase();
  }

function shouldHighlightMore(route){
    const base=appContext.routeBase(route);
    const premiumDesktop=window.matchMedia("(min-width:1180px)").matches;

    // V118 premium desktop has a deliberately small primary navigation.
    // Highlight More only for destinations that really live there at this width.
    if(premiumDesktop){
      return new Set([
        "reserved",
        "showcase",
        "favorites",
        "reviews",
        "about",
        "recent",
        "contact",
        "by-game",
        "insights",
        "fb-tools",
        "quality",
        "inventory-tools",
        "export",
        "add"
      ]).has(base);
    }

    // Routes that genuinely live under More on the standard desktop/mobile header.
    const alwaysMore=new Set([
      "recent",
      "about",
      "contact",
      "by-game",
      "insights",
      "fb-tools",
      "quality",
      "inventory-tools",
      "export",
      "add"
    ]);

    if(alwaysMore.has(base)) return true;

    if(
      window.matchMedia("(max-width:800px)").matches &&
      ["reserved","showcase","giveaway","favorites"].includes(base)
    ){
      return true;
    }

    return false;
  }

function isInventoryRoute(route){
    return appContext.INVENTORY_ROUTES.has(appContext.routeBase(route));
  }

function goToRoute(route){
    const next=String(route||"inventory").replace(/^#\/?/,"");
    location.hash=`#/${next}`;
  }

function goToRouteFromHomeTop(route){
    try{
      appContext.sessionStorage.removeItem(appContext.LISTING_SCROLL_STATE_KEY);
    }catch{}

    appContext.goToRoute(route);

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      window.scrollTo({top:0,left:0,behavior:"auto"});
      const shell=document.querySelector(".shell");
      if(shell) shell.scrollTo({top:0,left:0,behavior:"auto"});
    }));
  }

function refreshCurrentListingRoute(){
    const route=appContext.currentRoute();
    if(appContext.isInventoryRoute(route)){
      appContext.renderInventoryPage(route);
      return true;
    }
    return false;
  }

function isOwnerOnlyRoute(route){
    return appContext.OWNER_ONLY_ROUTES.has(appContext.routeBase(route));
  }

  Object.assign(appContext,{routeBase,shouldHighlightMore,isInventoryRoute,goToRoute,goToRouteFromHomeTop,refreshCurrentListingRoute,isOwnerOnlyRoute});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.OWNER_POST_HANDOFF_MESSAGE = "collect-tcg-beta-owner-post-handoff-v93";
  const premiumMore=document.getElementById("premiumDesktopMore");
  const premiumMoreMenu=document.getElementById("premiumDesktopMoreMenu");
  if(premiumMore && premiumMoreMenu){
    premiumMoreMenu.addEventListener("click",event=>{
      if(event.target.closest("a")) premiumMore.removeAttribute("open");
    });
    document.addEventListener("click",event=>{
      if(premiumMore.open && !premiumMore.contains(event.target)) premiumMore.removeAttribute("open");
    });
  }

}
