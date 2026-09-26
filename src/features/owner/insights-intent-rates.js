/** 2026-09-17-v16: separate contact views from intent, surface conversion rates, and keep DOM observation bounded. */
export function register(appContext){
  const originalFetchInsights=appContext.fetchInsights;
  const originalFetchCardEngagementInsights=appContext.fetchCardEngagementInsights;
  const originalRenderInsightsPage=appContext.renderInsightsPage;

  let currentViewRows=[];
  let currentEngagementRows=[];
  let observer=null;
  let observedRoot=null;
  let scheduledFrame=0;

  function insightsOverview(){
    return typeof appContext.$==="function" ? appContext.$("insightsOverview") : null;
  }

  function scheduleEnhancement(){
    if(scheduledFrame) return;
    const run=()=>{
      scheduledFrame=0;
      applyEnhancement();
    };
    if(typeof requestAnimationFrame==="function") scheduledFrame=requestAnimationFrame(run);
    else scheduledFrame=setTimeout(run,0);
  }

  if(typeof originalFetchInsights==="function"){
    appContext.fetchInsights=async function(start,end,options){
      const rows=await originalFetchInsights.call(appContext,start,end,options);
      if(!options?.silent && insightsOverview()){
        currentViewRows=Array.isArray(rows)?rows:[];
        scheduleEnhancement();
      }
      return rows;
    };
  }

  if(typeof originalFetchCardEngagementInsights==="function"){
    appContext.fetchCardEngagementInsights=async function(start,end){
      const result=await originalFetchCardEngagementInsights.call(appContext,start,end);
      if(insightsOverview()){
        currentEngagementRows=Array.isArray(result?.rows)?result.rows:[];
        scheduleEnhancement();
      }
      return result;
    };
  }

  function mergeCurrentRows(){
    const map=new Map();
    const add=row=>{
      const key=appContext.insightRowKey?.(row) || String(row?.card_id||row?.id||"");
      if(!key) return;
      map.set(key,{...(map.get(key)||{}),...(row||{})});
    };
    currentViewRows.forEach(add);
    currentEngagementRows.forEach(add);
    return [...map.values()];
  }

  function contactViewedCount(row){
    const visitors=Math.max(0,Number(row?.contact_visitors||0));
    const opens=Math.max(0,Number(row?.contact_opens||0));
    return visitors>0 ? visitors : opens;
  }

  function rateText(numerator,denominator){
    const n=Math.max(0,Number(numerator||0));
    const d=Math.max(0,Number(denominator||0));
    return d>0 ? `${Math.round((n/d)*100)}%` : "—";
  }

  function stageLabel(metrics){
    if(metrics?.strongest_stage==="platform") return "Platform clicked";
    if(metrics?.strongest_stage==="copy") return "Inquiry copied";
    if(metrics?.strongest_stage==="open") return "Contact viewed only";
    return "No contact intent";
  }

  function currentMetrics(){
    const status=String(appContext.$?.("insightsStatus")?.value||"");
    const game=String(appContext.$?.("insightsGame")?.value||"");
    const rows=mergeCurrentRows().filter(row=>{
      const card=appContext.insightCardForRow?.(row)||null;
      const rowStatus=appContext.insightStatusLabel?.(row)||"Unknown";
      const rowGame=String(row?.game||card?.game||"");
      if(status && rowStatus!==status) return false;
      if(game && rowGame!==game) return false;
      return true;
    });

    const byCardId=new Map();
    let uniqueViews=0;
    let favorites=0;
    let contactViewed=0;
    let inquiryCopies=0;
    let platformClicks=0;
    let contactIntent=0;

    rows.forEach(row=>{
      const metrics=appContext.insightContactMetrics?.(row)||{};
      const unique=Math.max(0,Number(row?.unique_views||0));
      const fav=Math.max(0,Number(row?.favorite_adds||0));
      const viewed=contactViewedCount(row);
      const copies=Math.max(0,Number(row?.inquiry_copies||0));
      const clicks=Math.max(0,Number(row?.platform_clicks||0));
      const intent=Math.max(0,Number(metrics.intent_count||0));
      const card=appContext.insightCardForRow?.(row)||null;
      const cardId=appContext.safeCardId?.(row?.card_id||row?.id||card?.id||"") || "";

      uniqueViews+=unique;
      favorites+=fav;
      contactViewed+=viewed;
      inquiryCopies+=copies;
      platformClicks+=clicks;
      contactIntent+=intent;

      if(cardId){
        byCardId.set(cardId,{row,metrics,unique,fav,viewed,copies,clicks,intent});
      }
    });

    return {
      uniqueViews,favorites,contactViewed,inquiryCopies,platformClicks,contactIntent,byCardId,
      favoriteRate:rateText(favorites,uniqueViews),
      contactViewRate:rateText(contactViewed,uniqueViews),
      intentRate:rateText(contactIntent,uniqueViews),
      contactToIntentRate:rateText(contactIntent,contactViewed)
    };
  }

  function findKpiArticle(kpis,label){
    return [...kpis.querySelectorAll(":scope > article")].find(article=>
      String(article.querySelector("span")?.textContent||"").trim()===label
    )||null;
  }

  function setArticleContent(article,label,value,detail){
    if(!article) return;
    const html=`<span>${appContext.escapeHtml(label)}</span><strong>${appContext.escapeHtml(value)}</strong><small>${appContext.escapeHtml(detail)}</small>`;
    if(article.innerHTML!==html) article.innerHTML=html;
  }

  function upsertKpi(kpis,key,label,value,detail,beforeLabel=""){
    let article=kpis.querySelector(`[data-insights-v13-kpi="${key}"]`);
    if(!article){
      article=document.createElement("article");
      article.dataset.insightsV13Kpi=key;
      const before=beforeLabel?findKpiArticle(kpis,beforeLabel):null;
      if(before) kpis.insertBefore(article,before);
      else kpis.appendChild(article);
    }
    setArticleContent(article,label,value,detail);
  }

  function updateKpis(overview,metrics){
    const kpis=overview.querySelector(".insights-v4-kpis");
    if(!kpis) return;

    const intentArticle=findKpiArticle(kpis,"Contact Intent");
    if(intentArticle){
      const small=intentArticle.querySelector("small");
      if(small) small.textContent="Inquiry copied or contact platform clicked";
    }
    const intentRateArticle=findKpiArticle(kpis,"Contact Intent Rate");
    if(intentRateArticle){
      const small=intentRateArticle.querySelector("small");
      if(small) small.textContent="Contact intent ÷ unique card views";
    }

    upsertKpi(
      kpis,"contact-viewed","Contact Viewed",metrics.contactViewed.toLocaleString(),
      `${metrics.contactViewRate} of unique card views · soft signal only`,"Contact Intent"
    );
    upsertKpi(
      kpis,"favorite-rate","Favorite Rate",metrics.favoriteRate,
      "Favorites ÷ unique card views","Contact Viewed"
    );
    upsertKpi(
      kpis,"contact-to-intent","Contact View → Intent",metrics.contactToIntentRate,
      "Contact intent ÷ contact viewed"
    );
  }

  function updateFunnel(overview,metrics){
    const kpis=overview.querySelector(".insights-v4-kpis");
    if(!kpis) return;
    let funnel=overview.querySelector("[data-insights-v13-contact-funnel]");
    if(!funnel){
      funnel=document.createElement("section");
      funnel.className="insights-v4-card";
      funnel.dataset.insightsV13ContactFunnel="1";
      kpis.insertAdjacentElement("afterend",funnel);
    }

    const html=`
      <div class="insights-v4-card-head">
        <div><h3>Buyer Contact Funnel</h3><span>Contact Viewed is a soft signal and does not count as Contact Intent.</span></div>
      </div>
      <div class="insights-v4-kpis">
        <article><span>Unique Card Views</span><strong>${metrics.uniqueViews.toLocaleString()}</strong><small>Per-card unique detail views</small></article>
        <article><span>Contact Viewed</span><strong>${metrics.contactViewed.toLocaleString()}</strong><small>${metrics.contactViewRate} of unique views</small></article>
        <article><span>Inquiry Copied</span><strong>${metrics.inquiryCopies.toLocaleString()}</strong><small>Explicit inquiry action</small></article>
        <article><span>Platform Clicked</span><strong>${metrics.platformClicks.toLocaleString()}</strong><small>Outbound Instagram / Facebook / Carousell action</small></article>
      </div>`;
    if(funnel.innerHTML!==html) funnel.innerHTML=html;
  }

  function updateTopCardsTable(overview,metrics){
    const table=[...overview.querySelectorAll("table.insights-v4-table")].find(candidate=>{
      const headers=[...candidate.querySelectorAll("thead th")].map(th=>String(th.textContent||"").trim());
      return headers[0]==="#" && headers.some(text=>text==="Contact intent" || text==="Intent · rate");
    });
    if(!table) return;

    const headers=[...table.querySelectorAll("thead th")];
    const favIndex=headers.findIndex(th=>["Fav","Fav · rate"].includes(String(th.textContent||"").trim()));
    const intentIndex=headers.findIndex(th=>["Contact intent","Intent · rate"].includes(String(th.textContent||"").trim()));
    if(favIndex>=0) headers[favIndex].textContent="Fav · rate";
    if(intentIndex>=0) headers[intentIndex].textContent="Intent · rate";

    table.querySelectorAll("tbody tr").forEach(tr=>{
      const cardButton=tr.querySelector("[data-insights-open-card]");
      const cardId=appContext.safeCardId?.(cardButton?.dataset?.insightsOpenCard||"") || "";
      const rowMetrics=cardId?metrics.byCardId.get(cardId):null;
      if(!rowMetrics) return;

      const cells=[...tr.children];
      if(favIndex>=0 && cells[favIndex]){
        cells[favIndex].textContent=`${rowMetrics.fav} · ${rateText(rowMetrics.fav,rowMetrics.unique)}`;
        cells[favIndex].title="Favorites · favorite rate from unique card views";
      }
      if(intentIndex>=0 && cells[intentIndex]){
        cells[intentIndex].textContent=`${rowMetrics.intent} · ${rateText(rowMetrics.intent,rowMetrics.unique)}`;
        cells[intentIndex].title=`${stageLabel(rowMetrics.metrics)} · Contact viewed ${rowMetrics.viewed} · Viewed → intent ${rateText(rowMetrics.intent,rowMetrics.viewed)}`;
      }
    });
  }

  function applyEnhancement(){
    const overview=insightsOverview();
    if(!overview) return;
    const metrics=currentMetrics();

    if(observer) observer.disconnect();
    try{
      updateKpis(overview,metrics);
      updateFunnel(overview,metrics);
      updateTopCardsTable(overview,metrics);
    }finally{
      if(observer && overview.isConnected){
        observedRoot=overview;
        observer.observe(overview,{childList:true});
      }
    }
  }

  function installObserver(){
    if(typeof MutationObserver!=="function") return;
    const root=insightsOverview();
    if(!root) return;
    if(observer) observer.disconnect();
    observedRoot=root;
    observer=new MutationObserver(records=>{
      if(!observedRoot?.isConnected) return;
      if(records.some(record=>record.target===observedRoot)) scheduleEnhancement();
    });
    observer.observe(root,{childList:true});
  }

  if(typeof originalRenderInsightsPage==="function"){
    appContext.renderInsightsPage=async function(...args){
      const result=await originalRenderInsightsPage.apply(appContext,args);
      installObserver();
      scheduleEnhancement();
      return result;
    };
  }
}
