/** V93 beta: features/inventory/ordering. Shared dependencies are explicit on appContext. */
export function register(appContext){
function orderRpcUnavailable(error,rpcName){
    const message=`${error.message||""} ${error.details||""}`.toLowerCase();
    return message.includes(rpcName) || message.includes("function") || message.includes("schema cache");
  }

function normalizeOrderGroups(groups){
    return (groups||[]).map(group=>({
      key:appContext.normalizeFilterValue(group?.key||"") || "__other__",
      label:String(group?.label||"").trim() || "Other"
    })).filter(group=>group.key);
  }

async function loadCollectionGameOrder(){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_collection_game_order");
      if(error){
        if(appContext.orderRpcUnavailable(error,"get_collection_game_order")) appContext.collectionGameOrderSupported=false;
        appContext.collectionGameOrderByKey.clear();
        return false;
      }

      appContext.collectionGameOrderByKey.clear();
      (Array.isArray(data)?data:[]).forEach(row=>{
        const key=appContext.normalizeFilterValue(row?.game_key||"") || "__other__";
        const order=Number(row?.sort_order);
        if(key && Number.isFinite(order)) appContext.collectionGameOrderByKey.set(key,order);
      });
      appContext.collectionGameOrderSupported=true;
      return true;
    }catch(error){
      console.warn("Collection game order unavailable:",error);
      appContext.collectionGameOrderSupported=false;
      appContext.collectionGameOrderByKey.clear();
      return false;
    }
  }

function collectionCustomGameOrderValue(gameKey){
    const key=appContext.normalizeFilterValue(gameKey||"") || "__other__";
    const value=appContext.collectionGameOrderByKey.get(key);
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

async function saveCollectionGameOrder(groups){
    if(!appContext.requireCollectionOrderOwner("save Collection game order")) return false;

    const clean=appContext.normalizeOrderGroups(groups);

    if(!clean.length){
      appContext.showToast("No Collection game categories to save");
      return false;
    }

    try{
      const {data,error}=await appContext.supabaseClient.rpc("set_collection_game_order",{
        p_game_keys:clean.map(group=>group.key),
        p_game_labels:clean.map(group=>group.label)
      });

      if(error){
        console.error("Collection game-order save error:",error);
        if(appContext.orderRpcUnavailable(error,"set_collection_game_order")){
          appContext.collectionGameOrderSupported=false;
          appContext.showToast("Run the Collection Game Order SQL migration first");
        }else{
          appContext.showToast("Could not save Collection game order");
        }
        return false;
      }

      appContext.collectionGameOrderByKey.clear();
      clean.forEach((group,index)=>appContext.collectionGameOrderByKey.set(group.key,index+1));
      appContext.collectionGameOrderSupported=true;
      return Number(data||0)>=0;
    }catch(error){
      console.error("Collection game-order save failed:",error);
      appContext.showToast("Could not save Collection game order");
      return false;
    }
  }

async function loadCollectionCardOrder(){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_collection_card_order");
      if(error){
        if(appContext.orderRpcUnavailable(error,"get_collection_card_order")) appContext.collectionCardOrderSupported=false;
        appContext.collectionCardOrderById.clear();
        return false;
      }

      appContext.collectionCardOrderById.clear();
      (Array.isArray(data)?data:[]).forEach(row=>{
        const id=appContext.safeCardId(row?.card_id||"");
        const order=Number(row?.sort_order);
        if(id && Number.isFinite(order)) appContext.collectionCardOrderById.set(id,order);
      });
      appContext.collectionCardOrderSupported=true;
      return true;
    }catch(error){
      console.warn("Collection custom order unavailable:",error);
      appContext.collectionCardOrderSupported=false;
      appContext.collectionCardOrderById.clear();
      return false;
    }
  }

function collectionCustomOrderValue(card){
    const id=appContext.safeCardId(card?.id||"");
    const value=id ? appContext.collectionCardOrderById.get(id) : null;
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

async function saveCollectionCardOrder(cardIds){
    if(!appContext.requireCollectionOrderOwner("save Collection card order")) return false;

    const ids=(cardIds||[]).map(id=>appContext.safeCardId(id)).filter(Boolean);
    if(!ids.length){
      appContext.showToast("No Collection cards to reorder");
      return false;
    }

    try{
      const {data,error}=await appContext.supabaseClient.rpc("set_collection_card_order",{p_card_ids:ids});
      if(error){
        console.error("Collection order save error:",error);
        if(appContext.orderRpcUnavailable(error,"set_collection_card_order")){
          appContext.collectionCardOrderSupported=false;
          appContext.showToast("Run the Collection Custom Order SQL migration first");
        }else{
          appContext.showToast("Could not save Collection card order");
        }
        return false;
      }

      appContext.collectionCardOrderById.clear();
      ids.forEach((id,index)=>appContext.collectionCardOrderById.set(id,index+1));
      appContext.collectionCardOrderSupported=true;
      return Number(data||0)>=0;
    }catch(error){
      console.error("Collection order save failed:",error);
      appContext.showToast("Could not save Collection card order");
      return false;
    }
  }

async function loadInventoryGameOrder(){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_inventory_game_order");
      if(error){
        if(appContext.orderRpcUnavailable(error,"get_inventory_game_order"))
          appContext.inventoryGameOrderSupported=false;
        appContext.inventoryGameOrderByKey.clear();
        return false;
      }
      appContext.inventoryGameOrderByKey.clear();
      (Array.isArray(data)?data:[]).forEach(row=>{
        const key=appContext.normalizeFilterValue(row?.game_key||"") || "__other__";
        const order=Number(row?.sort_order);
        if(key && Number.isFinite(order)) appContext.inventoryGameOrderByKey.set(key,order);
      });
      appContext.inventoryGameOrderSupported=true;
      return true;
    }catch(error){
      console.warn("Inventory game order unavailable:",error);
      appContext.inventoryGameOrderSupported=false;
      appContext.inventoryGameOrderByKey.clear();
      return false;
    }
  }

function inventoryCustomGameOrderValue(gameKey){
    const key=appContext.normalizeFilterValue(gameKey||"") || "__other__";
    const value=appContext.inventoryGameOrderByKey.get(key);
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

async function saveInventoryGameOrder(groups){
    if(!appContext.requireCollectionOrderOwner("save Inventory game order")) return false;
    const clean=appContext.normalizeOrderGroups(groups);
    if(!clean.length){ appContext.showToast("No Inventory game categories to save"); return false; }
    try{
      const {data,error}=await appContext.supabaseClient.rpc("set_inventory_game_order",{
        p_game_keys:clean.map(group=>group.key),
        p_game_labels:clean.map(group=>group.label)
      });
      if(error){
        console.error("Inventory game-order save error:",error);
        if(appContext.orderRpcUnavailable(error,"set_inventory_game_order")){
          appContext.inventoryGameOrderSupported=false;
          appContext.showToast("Run the Inventory Custom Order SQL migration first");
        }else appContext.showToast("Could not save Inventory game order");
        return false;
      }
      appContext.inventoryGameOrderByKey.clear();
      clean.forEach((group,index)=>appContext.inventoryGameOrderByKey.set(group.key,index+1));
      appContext.inventoryGameOrderSupported=true;
      return Number(data||0)>=0;
    }catch(error){
      console.error("Inventory game-order save failed:",error);
      appContext.showToast("Could not save Inventory game order");
      return false;
    }
  }

async function loadInventoryCardOrder(){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_inventory_card_order");
      if(error){
        if(appContext.orderRpcUnavailable(error,"get_inventory_card_order"))
          appContext.inventoryCardOrderSupported=false;
        appContext.inventoryCardOrderById.clear();
        return false;
      }
      appContext.inventoryCardOrderById.clear();
      (Array.isArray(data)?data:[]).forEach(row=>{
        const id=appContext.safeCardId(row?.card_id||"");
        const order=Number(row?.sort_order);
        if(id && Number.isFinite(order)) appContext.inventoryCardOrderById.set(id,order);
      });
      appContext.inventoryCardOrderSupported=true;
      return true;
    }catch(error){
      console.warn("Inventory custom order unavailable:",error);
      appContext.inventoryCardOrderSupported=false;
      appContext.inventoryCardOrderById.clear();
      return false;
    }
  }

function inventoryCustomOrderValue(card){
    const id=appContext.safeCardId(card?.id||"");
    const value=id ? appContext.inventoryCardOrderById.get(id) : null;
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

async function saveInventoryCardOrder(cardIds){
    if(!appContext.requireCollectionOrderOwner("save Inventory card order")) return false;
    const ids=(cardIds||[]).map(id=>appContext.safeCardId(id)).filter(Boolean);
    if(!ids.length){ appContext.showToast("No Inventory cards to reorder"); return false; }
    try{
      const {data,error}=await appContext.supabaseClient.rpc("set_inventory_card_order",{p_card_ids:ids});
      if(error){
        console.error("Inventory order save error:",error);
        if(appContext.orderRpcUnavailable(error,"set_inventory_card_order")){
          appContext.inventoryCardOrderSupported=false;
          appContext.showToast("Run the Inventory Custom Order SQL migration first");
        }else appContext.showToast("Could not save Inventory card order");
        return false;
      }
      appContext.inventoryCardOrderById.clear();
      ids.forEach((id,index)=>appContext.inventoryCardOrderById.set(id,index+1));
      appContext.inventoryCardOrderSupported=true;
      return Number(data||0)>=0;
    }catch(error){
      console.error("Inventory order save failed:",error);
      appContext.showToast("Could not save Inventory card order");
      return false;
    }
  }

function runWhenIdle(callback,timeout=1200){
    if("requestIdleCallback" in window){
      return requestIdleCallback(callback,{timeout});
    }
    return setTimeout(callback,80);
  }

  Object.assign(appContext,{orderRpcUnavailable,normalizeOrderGroups,loadCollectionGameOrder,collectionCustomGameOrderValue,saveCollectionGameOrder,loadCollectionCardOrder,collectionCustomOrderValue,saveCollectionCardOrder,loadInventoryGameOrder,inventoryCustomGameOrderValue,saveInventoryGameOrder,loadInventoryCardOrder,inventoryCustomOrderValue,saveInventoryCardOrder,runWhenIdle});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.soldAtSupported = false;

  appContext.languageDetailsSupported = null;

  appContext.lifecycleSupported = false;

  appContext.ownerPrivateSupported = false;

  appContext.cardImageVariantsSupported = false;

  appContext.thumbnailUrlSupported = false;

  appContext.editHistorySupported = false;

  appContext.giveaways = [];

  appContext.showcases = [];

  appContext.activeShowcaseCategory = "All";

  appContext.insightsCache = null;

  appContext.$ = (id) => document.getElementById(id);

  appContext.view = appContext.$("view");

  appContext.toastEl = appContext.$("toast");

  appContext.mainNavEl = appContext.$("mainnav");

  appContext.mobileMoreMenuEl = appContext.$("mobileMoreMenu");

  appContext.detailsMoreMenuEl = appContext.$("detailsMoreMenu");

  appContext.supabaseClient = runtime.createClient();

  appContext.ownerSession = null;

  appContext.ownerVerified = false;

  appContext.inventoryRenderController = null;

  appContext.inventoryStickyObserver = null;

  appContext.detailsPreservedListingHash = "";
}
