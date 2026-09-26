/** V93 beta: features/cards/pricing. Shared dependencies are explicit on appContext. */
export function register(appContext){
function hasListedPrice(value){
    if(value === null || value === undefined || value === "") return false;
    const n = Number(value);
    return Number.isFinite(n) && n > 0;
  }

function formatRoundedPrice(prefix,n){
    return prefix + Math.round(Number(n || 0)).toLocaleString("en-US");
  }

function fmtMoney(n){
    return appContext.formatRoundedPrice("USD ",n);
  }

function fmtMYR(n){
    return appContext.formatRoundedPrice("RM ",n);
  }

function fmtSGD(n){
    return appContext.formatRoundedPrice("SGD ",n);
  }

function defaultListingPerPage(){
    return window.matchMedia("(max-width:800px)").matches ? 20 : 40;
  }

function getSavedListingPerPage(){
    try{
      const value=Number(appContext.localStorage.getItem(appContext.LISTING_PER_PAGE_KEY));
      return appContext.LISTING_PER_PAGE_OPTIONS.includes(value) ? value : appContext.defaultListingPerPage();
    }catch{
      return appContext.defaultListingPerPage();
    }
  }

function setSavedListingPerPage(value){
    const number=Number(value);
    const safe=appContext.LISTING_PER_PAGE_OPTIONS.includes(number) ? number : appContext.defaultListingPerPage();
    appContext.listingPerPage=safe;
    try{ appContext.localStorage.setItem(appContext.LISTING_PER_PAGE_KEY,String(safe)); }catch{}
    return safe;
  }

function safeListingPage(value){
    const page=Math.floor(Number(value));
    return Number.isFinite(page) && page>=1 ? page : 1;
  }

function getPriceCurrencyPreference(){
    try{
      const value=String(appContext.localStorage.getItem(appContext.PRICE_CURRENCY_KEY)||"USD").toUpperCase();
      return ["USD","MYR","SGD"].includes(value) ? value : "USD";
    }catch{
      return "USD";
    }
  }

function setPriceCurrencyPreference(value){
    const safe=["USD","MYR","SGD"].includes(String(value||"").toUpperCase())
      ? String(value).toUpperCase()
      : "USD";
    try{ appContext.localStorage.setItem(appContext.PRICE_CURRENCY_KEY,safe); }catch{}
    return safe;
  }

function syncCurrencyEverywhere(currency=appContext.getPriceCurrencyPreference()){
    const safe=["USD","MYR","SGD"].includes(String(currency||"").toUpperCase())
      ? String(currency).toUpperCase()
      : appContext.getPriceCurrencyPreference();

    // Keep every currency selector in sync, even when it is behind an open modal.
    ["homeCurrencyPreference","currencyPreference","detailsCurrencyPreference","mobileFooterCurrencyPreference","mobileHeaderCurrencyPreference"].forEach(id=>{
      const el=appContext.$(id);
      if(el && el.value!==safe) el.value=safe;
    });

    const priceLabel=document.querySelector(".price-range-label");
    if(priceLabel) priceLabel.textContent=`Price (${safe})`;

    // Refresh every currently-rendered overview card in place. This includes
    // Inventory, Home sections and Recently Viewed, without rebuilding the page.
    document.querySelectorAll('.card[data-card-id]').forEach(tile=>{
      const card=appContext.getCardById(tile.dataset.cardId);
      if(!card) return;

      const current=tile.querySelector(".clean-price-block");
      const nextHtml=appContext.cardPriceDisplayHTML(card);

      if(current && nextHtml){
        const holder=document.createElement("div");
        holder.innerHTML=nextHtml.trim();
        const next=holder.firstElementChild;
        if(next) current.replaceWith(next);
      }else if(current && !nextHtml){
        current.remove();
      }
    });

    // If Compare is open, refresh its price order too.
    const compareOverlay=appContext.$("compareOverlay");
    if(compareOverlay && !compareOverlay.hidden && appContext.compareSelectedCards().length>=2){
      appContext.renderCompareModal();
    }

    window.dispatchEvent(new CustomEvent("collecttcg:pricecurrencychange",{
      detail:{currency:safe}
    }));
  }

function getInventoryViewMode(){
    try{
      return appContext.localStorage.getItem(appContext.INVENTORY_VIEW_KEY)==="compact" ? "compact" : "grid";
    }catch{
      return "grid";
    }
  }

function setInventoryViewMode(mode){
    const safe=mode==="compact" ? "compact" : "grid";
    try{ appContext.localStorage.setItem(appContext.INVENTORY_VIEW_KEY,safe); }catch{}
    return safe;
  }

function isMobileInventoryLayout(){
    return window.matchMedia("(max-width: 800px)").matches;
  }

function effectiveInventoryViewMode(){
    // The existing mobile inventory layout is already intentionally compact:
    // one horizontal card per row. Never apply the desktop compact-list
    // transformation on phones/tablets at or below 800px.
    return appContext.isMobileInventoryLayout() ? "grid" : appContext.getInventoryViewMode();
  }

function cardCurrencyValue(card,currency){
    if(currency==="MYR") return card?.price_myr;
    if(currency==="SGD") return card?.price_sgd;
    return card?.price_usd ?? card?.price;
  }

function formatCurrencyValue(currency,value){
    if(currency==="MYR") return appContext.fmtMYR(value);
    if(currency==="SGD") return appContext.fmtSGD(value);
    return appContext.fmtMoney(value);
  }

function orderedCardPrices(card){
    const preferred=appContext.getPriceCurrencyPreference();
    const order=[preferred,...["USD","MYR","SGD"].filter(c=>c!==preferred)];
    return order
      .map(currency=>({currency,value:appContext.cardCurrencyValue(card,currency)}))
      .filter(entry=>appContext.hasListedPrice(entry.value));
  }

function cardUsdListedPrice(card){
    const value=card?.price_usd ?? card?.price;
    const amount=Number(value);
    return Number.isFinite(amount) && amount>=0 ? amount : null;
  }

function isHighValueDirectContactCard(card){
    const status=appContext.normalizeFilterValue(card?.availability||"");
    if(status==="sold" || status==="collection (nfs)") return false;
    const usd=appContext.cardUsdListedPrice(card);
    return usd!==null && usd>=appContext.HIGH_VALUE_DIRECT_CONTACT_USD;
  }

function highValueContactAlertHTML(card,compact=false){
    if(!appContext.isHighValueDirectContactCard(card)) return "";
    return `
      <div class="high-value-contact-alert ${compact?"compact":""}" role="note">
        <strong>High-value listing · USD ${appContext.HIGH_VALUE_DIRECT_CONTACT_USD.toLocaleString()}+ · Contact us to arrange delivery</strong>
      </div>
    `;
  }

function cardPriceDisplayHTML(card){
    if(appContext.normalizeFilterValue(card?.availability)==="collection (nfs)"){
      return `<div class="clean-price-block nfs-price-display"><div class="clean-price-primary">NOT FOR SALE</div></div>`;
    }
    const prices=appContext.orderedCardPrices(card);
    if(!prices.length) return "";
    const [primary,...secondary]=prices;
    return `
      <div class="clean-price-block">
        <div class="clean-price-primary">${appContext.escapeHtml(appContext.formatCurrencyValue(primary.currency,primary.value))}</div>
        ${secondary.length ? `<div class="clean-price-secondary">${secondary.map(p=>appContext.escapeHtml(appContext.formatCurrencyValue(p.currency,p.value))).join(' <span>·</span> ')}</div>` : ""}
      </div>
    `;
  }

function detailPriceDisplayHTML(card){
    if(appContext.normalizeFilterValue(card?.availability)==="collection (nfs)"){
      return `<div class="detail-price-primary nfs-detail-price">NOT FOR SALE</div>`;
    }
    const prices=appContext.orderedCardPrices(card);
    if(!prices.length) return `<div class="detail-price-primary">Please inquire</div>`;
    const [primary,...secondary]=prices;
    return `
      <div class="detail-price-primary">${appContext.escapeHtml(appContext.formatCurrencyValue(primary.currency,primary.value))}</div>
      ${secondary.length ? `<div class="detail-price-secondary">${secondary.map(p=>`<span>${appContext.escapeHtml(appContext.formatCurrencyValue(p.currency,p.value))}</span>`).join("")}</div>` : ""}
    `;
  }

function escapeHtml(str){ const d = document.createElement("div"); d.textContent = str == null ? "" : str; return d.innerHTML; }

function uid(){ return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  Object.assign(appContext,{hasListedPrice,formatRoundedPrice,fmtMoney,fmtMYR,fmtSGD,defaultListingPerPage,getSavedListingPerPage,setSavedListingPerPage,safeListingPage,getPriceCurrencyPreference,setPriceCurrencyPreference,syncCurrencyEverywhere,getInventoryViewMode,setInventoryViewMode,isMobileInventoryLayout,effectiveInventoryViewMode,cardCurrencyValue,formatCurrencyValue,orderedCardPrices,cardUsdListedPrice,isHighValueDirectContactCard,highValueContactAlertHTML,cardPriceDisplayHTML,detailPriceDisplayHTML,escapeHtml,uid});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.PRICE_CURRENCY_KEY = "collect_tcg_price_currency_v1";

  appContext.INVENTORY_VIEW_KEY = "collect_tcg_inventory_view_v1";

  appContext.LISTING_PER_PAGE_KEY = "collect_tcg_listing_per_page_v1";

  appContext.LISTING_PER_PAGE_OPTIONS = Object.freeze([20,40,100]);

  appContext.listingCurrentPage = 1;

  appContext.listingPerPage = 20;

  appContext.HIGH_VALUE_DIRECT_CONTACT_USD = 6000;

  appContext.CARD_PUBLIC_COLUMNS_BASE = "id,name,card_code,year,game,language,era,availability,set_name,series,format,rarity,condition,quantity,price,price_usd,price_myr,price_sgd,notes,images,grading,created_at,updated_at";

  appContext.CARD_PUBLIC_COLUMNS_LIGHT = "id,name,card_code,year,game,language,era,availability,set_name,series,format,rarity,condition,quantity,price,price_usd,price_myr,price_sgd,notes,thumbnail_url,grading,created_at,updated_at";
}
