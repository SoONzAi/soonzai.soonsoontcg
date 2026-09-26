/** V93 beta: features/cards/repository. Shared dependencies are explicit on appContext. */
export function register(appContext){
function ensureCardLookup(){
    if(appContext.cardLookupVersion===appContext.cards.length && appContext.cardLookupMap.size===appContext.cards.length) return appContext.cardLookupMap;
    appContext.cardLookupMap=new Map(appContext.cards.map(card=>[String(card.id),card]));
    appContext.cardLookupVersion=appContext.cards.length;
    return appContext.cardLookupMap;
  }

function invalidateCardLookup(){
    appContext.cardLookupVersion=-1;
  }

function getCardById(id){
    const target=String(id||"");
    if(!target) return null;
    return appContext.ensureCardLookup().get(target) || null;
  }

function getCardIndexById(id){
    const target=String(id||"");
    if(!target) return -1;
    for(let i=0;i<appContext.cards.length;i++){
      if(String(appContext.cards[i].id)===target) return i;
    }
    return -1;
  }

function getDetailsCard(){
    return appContext.detailsCardId ? appContext.getCardById(appContext.detailsCardId) : null;
  }

function replaceCardInMemory(card){
    if(!card) return false;
    const index=appContext.getCardIndexById(card.id);
    if(index<0) return false;
    appContext.cards[index]=card;
    appContext.invalidateCardLookup();
    return true;
  }

function cleanupInventoryRenderListeners(){
    if(appContext.inventoryRenderController){
      appContext.inventoryRenderController.abort();
      appContext.inventoryRenderController=null;
    }
    if(appContext.inventoryStickyObserver){
      appContext.inventoryStickyObserver.disconnect();
      appContext.inventoryStickyObserver=null;
    }
  }

function setupInventoryStickyBarVisibility(){
    const bar=appContext.$("stickyMobileResultsBar");
    const controls=document.querySelector(".listing-filter-tools");
    if(!bar || !controls) return;

    const setVisible=visible=>bar.classList.toggle("is-visible",!!visible);

    if(!window.matchMedia("(max-width: 800px)").matches){
      setVisible(false);
      return;
    }

    if(!("IntersectionObserver" in window)){
      setVisible(true);
      return;
    }

    appContext.inventoryStickyObserver=new IntersectionObserver(entries=>{
      const entry=entries[0];
      setVisible(!!entry && !entry.isIntersecting);
    },{
      root:null,
      threshold:0,
      rootMargin:"-8px 0px 0px 0px"
    });

    appContext.inventoryStickyObserver.observe(controls);
  }

  Object.assign(appContext,{ensureCardLookup,invalidateCardLookup,getCardById,getCardIndexById,getDetailsCard,replaceCardInMemory,cleanupInventoryRenderListeners,setupInventoryStickyBarVisibility});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.OWNER_ONLY_ROUTES = new Set([
    "insights",
    "fb-tools",
    "fb-posts",
    "fb-card-list",
    "quality",
    "inventory-tools",
    "bulk-prices",
    "bulk-metadata",
    "recent-edits",
    "export",
    "add",
    "by-game"
  ]);

  appContext.INVENTORY_ROUTES = new Set(["inventory","collection","reserved","sold"]);
}
