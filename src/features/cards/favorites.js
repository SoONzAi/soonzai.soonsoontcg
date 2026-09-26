/** V93 beta: features/cards/favorites. Shared dependencies are explicit on appContext. */
export function register(appContext){
function getRecentlyViewedEntries(){
    try{
      const parsed=JSON.parse(appContext.localStorage.getItem(appContext.RECENTLY_VIEWED_KEY)||"[]");
      if(!Array.isArray(parsed)) return [];

      const seen=new Set();
      const entries=[];
      for(const raw of parsed){
        const id=appContext.safeCardId(typeof raw==="string" ? raw : raw?.id);
        if(!id || seen.has(id)) continue;
        seen.add(id);

        const viewedAt=typeof raw==="object" && raw
          ? Number(raw.viewed_at||0)
          : 0;

        entries.push({
          id,
          viewed_at:Number.isFinite(viewedAt) && viewedAt>0 ? viewedAt : 0
        });
        if(entries.length>=appContext.RECENTLY_VIEWED_LIMIT) break;
      }
      return entries;
    }catch{
      return [];
    }
  }

function rememberRecentlyViewed(cardId){
    const id=appContext.safeCardId(cardId);
    if(!id) return;
    try{
      const entries=appContext.getRecentlyViewedEntries().filter(entry=>entry.id!==id);
      entries.unshift({id,viewed_at:Date.now()});
      appContext.localStorage.setItem(
        appContext.RECENTLY_VIEWED_KEY,
        JSON.stringify(entries.slice(0,appContext.RECENTLY_VIEWED_LIMIT))
      );
    }catch{}
  }

function getRecentlyViewedCards(){
    const lookup=appContext.ensureCardLookup();
    return appContext.getRecentlyViewedEntries()
      .map(entry=>lookup.get(entry.id))
      .filter(card=>card && appContext.isLiveLifecycle(card));
  }

function getRecentlyViewedCardEntries(){
    const lookup=appContext.ensureCardLookup();
    return appContext.getRecentlyViewedEntries()
      .map(entry=>({card:lookup.get(entry.id),viewed_at:entry.viewed_at}))
      .filter(entry=>entry.card && appContext.isLiveLifecycle(entry.card));
  }

function recentViewedTimeLabel(timestamp){
    const ts=Number(timestamp||0);
    if(!ts) return "Viewed previously";

    const date=new Date(ts);
    if(!Number.isFinite(date.getTime())) return "Viewed previously";

    const now=new Date();
    const sameDay=
      date.getFullYear()===now.getFullYear() &&
      date.getMonth()===now.getMonth() &&
      date.getDate()===now.getDate();

    if(sameDay){
      return `Viewed today · ${date.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`;
    }

    const yesterday=new Date(now);
    yesterday.setDate(now.getDate()-1);
    const wasYesterday=
      date.getFullYear()===yesterday.getFullYear() &&
      date.getMonth()===yesterday.getMonth() &&
      date.getDate()===yesterday.getDate();

    if(wasYesterday) return "Viewed yesterday";

    return `Viewed ${date.toLocaleDateString([], {month:"short",day:"numeric"})}`;
  }

function getFavoriteIds(){
    try{
      const stored=appContext.localStorage.getItem(appContext.FAVORITES_KEY)||"[]";
      if(stored===appContext.favoriteCacheRaw) return new Set(appContext.favoriteCacheSet);
      const raw=JSON.parse(stored);
      if(!Array.isArray(raw)) return new Set();

      const ids=[];
      const seen=new Set();
      raw.slice(0,500).forEach(value=>{
        const id=appContext.safeCardId(value);
        if(!id || seen.has(id)) return;
        seen.add(id);
        ids.push(id);
      });
      appContext.favoriteCacheRaw=stored;
      appContext.favoriteCacheSet=new Set(ids);
      return new Set(appContext.favoriteCacheSet);
    }catch{
      appContext.favoriteCacheRaw=null;
      appContext.favoriteCacheSet=new Set();
      return new Set();
    }
  }

function saveFavoriteIds(set){
    try{
      const ids=[];
      const seen=new Set();
      Array.from(set||[]).slice(0,500).forEach(value=>{
        const id=appContext.safeCardId(value);
        if(!id || seen.has(id)) return;
        seen.add(id);
        ids.push(id);
      });
      const stored=JSON.stringify(ids);
      appContext.localStorage.setItem(appContext.FAVORITES_KEY,stored);
      appContext.favoriteCacheRaw=stored;
      appContext.favoriteCacheSet=new Set(ids);
      return true;
    }catch{
      return false;
    }
  }

function isFavorite(cardId){
    return appContext.getFavoriteIds().has(cardId);
  }

function toggleFavorite(cardId){
    const set=appContext.getFavoriteIds();
    const wasFavorite=set.has(cardId);
    if(wasFavorite) set.delete(cardId);
    else set.add(cardId);
    appContext.saveFavoriteIds(set);

    const active=set.has(cardId);
    // Fire-and-forget: favorites must remain instant even if analytics is down.
    appContext.recordCardEngagement(cardId,active ? "favorite_add" : "favorite_remove").catch(()=>{});
    return active;
  }

function favoriteCards(){
    const ids = appContext.getFavoriteIds();
    return appContext.cards.filter(c=>appContext.isLiveLifecycle(c) && ids.has(c.id));
  }

async function copyInquiryList(){
    const list = appContext.favoriteCards();
    if(!list.length){
      appContext.showToast("No favorites yet");
      return;
    }

    const text = [
      "Hi, I'm interested in these cards:",
      "",
      ...list.map(c=>{
        const code = c.card_code ? `${c.card_code} — ` : "";
        const year = c.year ? ` (${c.year})` : "";
        return `${code}${c.name}${year}`;
      })
    ].join("\n");

    const copied=await appContext.copyTextToClipboard(text);
    appContext.showToast(copied ? "Inquiry list copied" : "Could not copy inquiry list");
  }

  Object.assign(appContext,{getRecentlyViewedEntries,rememberRecentlyViewed,getRecentlyViewedCards,getRecentlyViewedCardEntries,recentViewedTimeLabel,getFavoriteIds,saveFavoriteIds,isFavorite,toggleFavorite,favoriteCards,copyInquiryList});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.FAVORITES_KEY = "collect-tcg-favorites";

  appContext.favoriteCacheRaw = null;

  appContext.favoriteCacheSet = new Set();

  appContext.cards = [];

  appContext.collectionCardOrderById = new Map();

  appContext.collectionGameOrderByKey = new Map();

  appContext.collectionCardOrderSupported = "unknown";

  appContext.collectionGameOrderSupported = "unknown";

  appContext.inventoryCardOrderById = new Map();

  appContext.inventoryGameOrderByKey = new Map();

  appContext.inventoryCardOrderSupported = "unknown";

  appContext.inventoryGameOrderSupported = "unknown";
}
