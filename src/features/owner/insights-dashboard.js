/** 2026-09-17-v18: decision-first Insights with era, price and market demand. */
export function register(appContext){
  const originalRenderInsightsPage=appContext.renderInsightsPage;
  const originalFetchInsights=appContext.fetchInsights;
  const originalFetchCardEngagementInsights=appContext.fetchCardEngagementInsights;
  const originalFetchWebsiteVisitSeries=appContext.fetchWebsiteVisitSeries;
  const originalFetchWebsiteVisitCountries=appContext.fetchWebsiteVisitCountries;
  const originalFetchWebsiteVisitSources=appContext.fetchWebsiteVisitSources;
  const originalFetchCountryCardViewInsights=appContext.fetchCountryCardViewInsights;
  const originalFetchDiscoverySourceSummary=appContext.fetchDiscoverySourceSummary;

  let currentViewRows=[];
  let currentEngagementRows=[];
  let websiteSeries=[];
  let countryRows=[];
  let sourceRows=[];
  let countryCardRows=[];
  let countryCardSupported=null;
  let discoveryRows=[];
  let discoverySupported=null;
  let countryDemandRequest=0;
  let discoveryRequest=0;
  let observer=null;
  let observedRoot=null;
  let scheduledFrame=0;

  function ensureStylesheet(){
    if(document.getElementById("insights-dashboard-v14-styles")) return;
    const link=document.createElement("link");
    link.id="insights-dashboard-v14-styles";
    link.rel="stylesheet";
    link.href="./src/styles/27-insights-dashboard.css?v=2026-09-17-v19";
    document.head.appendChild(link);
  }

  ensureStylesheet();

  function overview(){
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
      if(!options?.silent && overview()){
        currentViewRows=Array.isArray(rows)?rows:[];
        if(typeof originalFetchCountryCardViewInsights==="function"){
          const request=++countryDemandRequest;
          Promise.resolve(originalFetchCountryCardViewInsights.call(appContext,start,end))
            .then(result=>{
              if(request!==countryDemandRequest) return;
              countryCardSupported=result?.supported===true;
              countryCardRows=Array.isArray(result?.rows)?result.rows:[];
              scheduleEnhancement();
            })
            .catch(()=>{
              if(request!==countryDemandRequest) return;
              countryCardSupported=false;
              countryCardRows=[];
              scheduleEnhancement();
            });
        }
        if(typeof originalFetchDiscoverySourceSummary==="function"){
          const request=++discoveryRequest;
          Promise.resolve(originalFetchDiscoverySourceSummary.call(appContext,start,end))
            .then(result=>{
              if(request!==discoveryRequest) return;
              discoverySupported=result?.supported===true;
              discoveryRows=Array.isArray(result?.rows)?result.rows:[];
              scheduleEnhancement();
            })
            .catch(()=>{
              if(request!==discoveryRequest) return;
              discoverySupported=false;
              discoveryRows=[];
              scheduleEnhancement();
            });
        }
        scheduleEnhancement();
      }
      return rows;
    };
  }

  if(typeof originalFetchCardEngagementInsights==="function"){
    appContext.fetchCardEngagementInsights=async function(start,end){
      const result=await originalFetchCardEngagementInsights.call(appContext,start,end);
      if(overview()){
        currentEngagementRows=Array.isArray(result?.rows)?result.rows:[];
        scheduleEnhancement();
      }
      return result;
    };
  }

  if(typeof originalFetchWebsiteVisitSeries==="function"){
    appContext.fetchWebsiteVisitSeries=async function(...args){
      const rows=await originalFetchWebsiteVisitSeries.apply(appContext,args);
      if(overview()){
        websiteSeries=Array.isArray(rows)?rows:[];
        scheduleEnhancement();
      }
      return rows;
    };
  }

  if(typeof originalFetchWebsiteVisitCountries==="function"){
    appContext.fetchWebsiteVisitCountries=async function(...args){
      const result=await originalFetchWebsiteVisitCountries.apply(appContext,args);
      if(overview()){
        countryRows=Array.isArray(result?.rows)?result.rows:[];
        scheduleEnhancement();
      }
      return result;
    };
  }

  if(typeof originalFetchWebsiteVisitSources==="function"){
    appContext.fetchWebsiteVisitSources=async function(...args){
      const result=await originalFetchWebsiteVisitSources.apply(appContext,args);
      if(overview()){
        sourceRows=Array.isArray(result?.rows)?result.rows:[];
        scheduleEnhancement();
      }
      return result;
    };
  }

  function rowKey(row){
    return appContext.insightRowKey?.(row) || String(row?.card_id||row?.id||"");
  }

  function mergeRows(){
    const map=new Map();
    const add=row=>{
      const key=rowKey(row);
      if(!key) return;
      map.set(key,{...(map.get(key)||{}),...(row||{})});
    };
    currentViewRows.forEach(add);
    currentEngagementRows.forEach(add);
    return [...map.values()];
  }

  function selectedFilters(){
    return {
      status:String(appContext.$?.("insightsStatus")?.value||""),
      game:String(appContext.$?.("insightsGame")?.value||"")
    };
  }

  function filteredRows(){
    const {status,game}=selectedFilters();
    return mergeRows().filter(row=>{
      const card=appContext.insightCardForRow?.(row)||null;
      const rowStatus=appContext.insightStatusLabel?.(row)||String(card?.availability||"Unknown");
      const rowGame=String(row?.game||card?.game||"");
      if(status && rowStatus!==status) return false;
      if(game && rowGame!==game) return false;
      return true;
    });
  }

  function inventoryCards(){
    const {status,game}=selectedFilters();
    return (Array.isArray(appContext.cards)?appContext.cards:[]).filter(card=>{
      if(appContext.cardLifecycle?.(card)==="archived") return false;
      if(status && String(card?.availability||"")!==status) return false;
      if(game && String(card?.game||"")!==game) return false;
      return true;
    });
  }

  function contactViewed(row){
    const visitors=Math.max(0,Number(row?.contact_visitors||0));
    const opens=Math.max(0,Number(row?.contact_opens||0));
    return visitors>0 ? visitors : opens;
  }

  function contactIntent(row){
    const metrics=appContext.insightContactMetrics?.(row)||{};
    return Math.max(0,Number(metrics.intent_count||0));
  }

  function percentage(numerator,denominator,digits=0){
    const n=Math.max(0,Number(numerator||0));
    const d=Math.max(0,Number(denominator||0));
    if(!d) return "—";
    return `${(n/d*100).toFixed(digits)}%`;
  }

  function languageName(card){
    return String(card?.language||"").trim() || "Unspecified";
  }

  function eraName(card){
    return String(card?.era||"").trim() || "Unspecified";
  }

  function priceBand(card){
    const usd=Number(appContext.cardUsdListedPrice?.(card));
    if(!Number.isFinite(usd)) return "No price";
    if(usd<500) return "Under $500";
    if(usd<2000) return "$500–1,999";
    if(usd<5000) return "$2,000–4,999";
    return "$5,000+";
  }

  function groupDemand(rows,cards,keyFor){
    const groups=new Map();
    const ensure=key=>{
      const label=String(key||"Unspecified");
      if(!groups.has(label)) groups.set(label,{label,inventory:0,views:0,favorites:0,contactViewed:0,intent:0});
      return groups.get(label);
    };

    cards.forEach(card=>ensure(keyFor(card)).inventory+=1);
    rows.forEach(row=>{
      const card=appContext.insightCardForRow?.(row)||null;
      if(!card) return;
      const group=ensure(keyFor(card));
      group.views+=Math.max(0,Number(row?.unique_views||0));
      group.favorites+=Math.max(0,Number(row?.favorite_adds||0));
      group.contactViewed+=contactViewed(row);
      group.intent+=contactIntent(row);
    });

    const totalViews=[...groups.values()].reduce((sum,item)=>sum+item.views,0);
    const totalInventory=[...groups.values()].reduce((sum,item)=>sum+item.inventory,0);
    return [...groups.values()].map(item=>({
      ...item,
      demandShare:totalViews ? item.views/totalViews*100 : 0,
      inventoryShare:totalInventory ? item.inventory/totalInventory*100 : 0,
      intentRate:item.views ? item.intent/item.views*100 : 0
    }));
  }

  function filteredCountryCardRows(){
    const {status,game}=selectedFilters();
    return countryCardRows.filter(row=>{
      const card=appContext.insightCardForRow?.(row)||null;
      if(!card) return false;
      if(status && String(card?.availability||"")!==status) return false;
      if(game && String(card?.game||"")!==game) return false;
      return true;
    });
  }

  function marketDemandRows(){
    const groups=new Map();
    filteredCountryCardRows().forEach(row=>{
      const card=appContext.insightCardForRow?.(row)||null;
      if(!card) return;
      const code=String(row?.country_code||"XX").trim().toUpperCase()||"XX";
      if(!groups.has(code)){
        groups.set(code,{countryCode:code,views:0,eras:new Map(),cards:new Map()});
      }
      const group=groups.get(code);
      const views=Math.max(0,Number(row?.views||0));
      group.views+=views;
      const era=eraName(card);
      group.eras.set(era,(group.eras.get(era)||0)+views);
      const id=String(card?.id||row?.card_id||"");
      const existing=group.cards.get(id)||{card,views:0};
      existing.views+=views;
      group.cards.set(id,existing);
    });

    const result=[...groups.values()].map(group=>{
      const topEra=[...group.eras.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))[0]||["—",0];
      const topCard=[...group.cards.values()].sort((a,b)=>b.views-a.views || String(a.card?.name||"").localeCompare(String(b.card?.name||"")))[0]||null;
      return {...group,topEra:topEra[0],topEraViews:topEra[1],topCard};
    });

    const known=result.filter(item=>item.countryCode!=="XX");
    const source=known.length?known:result;
    return source.sort((a,b)=>b.views-a.views || a.countryCode.localeCompare(b.countryCode));
  }

  function rowCard(row){
    return appContext.insightCardForRow?.(row)||null;
  }

  function uniqueRowCards(rows){
    const seen=new Set();
    return rows.filter(row=>{
      const card=rowCard(row);
      const id=String(card?.id||row?.card_id||row?.id||"");
      if(!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function opportunityRows(rows){
    const safe=uniqueRowCards(rows);
    const picks=[];
    const used=new Set();

    function add(type,row,detail,tone){
      if(!row) return;
      const card=rowCard(row);
      const id=String(card?.id||"");
      if(!id || used.has(id)) return;
      used.add(id);
      picks.push({type,row,card,detail,tone});
    }

    const strongest=safe
      .filter(row=>contactIntent(row)>0)
      .sort((a,b)=>contactIntent(b)-contactIntent(a) || Number(b.unique_views||0)-Number(a.unique_views||0))[0];
    if(strongest){
      add("Strong buyer intent",strongest,
        `${contactIntent(strongest)} intent · ${Number(strongest.unique_views||0)} unique views`,"good");
    }

    const attention=safe
      .filter(row=>Number(row.unique_views||0)>=3 && contactIntent(row)===0)
      .sort((a,b)=>Number(b.unique_views||0)-Number(a.unique_views||0))[0];
    if(attention){
      add("Views without intent",attention,
        `${Number(attention.unique_views||0)} unique views · consider price, trust signals or listing quality`,"watch");
    }

    const savedWithoutIntent=safe
      .filter(row=>Number(row.favorite_adds||0)>=1 && contactIntent(row)===0)
      .sort((a,b)=>
        Number(b.favorite_adds||0)-Number(a.favorite_adds||0) ||
        Number(b.unique_views||0)-Number(a.unique_views||0)
      )[0];
    if(savedWithoutIntent){
      add("Saved without contact",savedWithoutIntent,
        `${Number(savedWithoutIntent.favorite_adds||0)} favorite adds · ${Number(savedWithoutIntent.unique_views||0)} unique views · review price or trust signals`,"watch");
    }

    const hidden=safe
      .filter(row=>Number(row.unique_views||0)<=6 && (Number(row.favorite_adds||0)>=1 || contactIntent(row)>=1))
      .sort((a,b)=>{
        const scoreA=contactIntent(a)*4+Number(a.favorite_adds||0)*2-Number(a.unique_views||0)*0.1;
        const scoreB=contactIntent(b)*4+Number(b.favorite_adds||0)*2-Number(b.unique_views||0)*0.1;
        return scoreB-scoreA;
      })[0];
    if(hidden){
      add("Low exposure, strong signal",hidden,
        `${Number(hidden.unique_views||0)} unique views · ${Number(hidden.favorite_adds||0)} favorites · ${contactIntent(hidden)} intent`,"focus");
    }

    if(picks.length<3){
      safe.slice().sort((a,b)=>Number(b._interestScore||0)-Number(a._interestScore||0)).forEach(row=>{
        if(picks.length>=3) return;
        add("Worth watching",row,
          `${Number(row.unique_views||0)} unique views · interest score ${Number(row._interestScore||0)}`,"neutral");
      });
    }

    return picks.slice(0,3);
  }

  function topRow(rows,key="visits"){
    return (Array.isArray(rows)?rows:[]).slice().sort((a,b)=>Number(b?.[key]||0)-Number(a?.[key]||0))[0]||null;
  }

  function metrics(){
    const rows=filteredRows();
    const cards=inventoryCards();
    const uniqueViews=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.unique_views||0)),0);
    const qualifiedViews=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.views||0)),0);
    const favorites=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.favorite_adds||0)),0);
    const viewed=rows.reduce((sum,row)=>sum+contactViewed(row),0);
    const intent=rows.reduce((sum,row)=>sum+contactIntent(row),0);
    const visits=websiteSeries.reduce((sum,row)=>sum+Math.max(0,Number(row.visits||0)),0);

    const language=groupDemand(rows,cards,languageName)
      .sort((a,b)=>b.views-a.views || b.intent-a.intent || b.inventory-a.inventory);
    const eras=groupDemand(rows,cards,eraName)
      .sort((a,b)=>b.views-a.views || b.intent-a.intent || b.inventory-a.inventory);
    const prices=groupDemand(rows,cards,priceBand)
      .sort((a,b)=>{
        const order=["Under $500","$500–1,999","$2,000–4,999","$5,000+","No price"];
        return order.indexOf(a.label)-order.indexOf(b.label);
      });
    const games=groupDemand(rows,cards,card=>String(card?.game||"Unspecified"))
      .sort((a,b)=>b.views-a.views || b.intent-a.intent);

    const strongest=rows.slice().sort((a,b)=>
      Number(b._interestScore||0)-Number(a._interestScore||0) ||
      contactIntent(b)-contactIntent(a)
    )[0]||null;

    return {
      rows,cards,visits,uniqueViews,qualifiedViews,favorites,viewed,intent,language,eras,prices,games,strongest,
      markets:marketDemandRows(),countryCardSupported,
      favoriteRate:percentage(favorites,uniqueViews),
      intentRate:percentage(intent,uniqueViews),
      contactToIntent:percentage(intent,viewed),
      opportunities:opportunityRows(rows),
      topCountry:topRow(countryRows,"visits"),
      topSource:topRow(sourceRows,"visits")
    };
  }

  function salesSignal(row){
    const views=Math.max(0,Number(row?.unique_views||0));
    const saves=Math.max(0,Number(row?.favorite_adds||0));
    const viewed=contactViewed(row);
    const intent=contactIntent(row);
    if(intent>=2) return {label:"High intent",tone:"good"};
    if(intent>=1) return {label:"Buyer intent",tone:"good"};
    if(saves>=1 && intent===0) return {label:"Saved, no contact",tone:"watch"};
    if(views>=3 && intent===0) return {label:"Views, no intent",tone:"watch"};
    if((saves>=1 || intent>=1) && views<=6) return {label:"Low exposure",tone:"focus"};
    if(viewed>0 && intent===0) return {label:"Contact viewed",tone:"neutral"};
    return {label:"Watching",tone:"neutral"};
  }

  function cardPerformanceRows(rows){
    return uniqueRowCards(rows).map(row=>{
      const card=rowCard(row);
      const views=Math.max(0,Number(row?.unique_views||0));
      const saves=Math.max(0,Number(row?.favorite_adds||0));
      const viewed=contactViewed(row);
      const intent=contactIntent(row);
      return {row,card,views,saves,viewed,intent,intentRate:views?intent/views*100:0,signal:salesSignal(row)};
    });
  }

  function cardPerformanceHtml(rows){
    const items=cardPerformanceRows(rows);
    if(!items.length) return `<div class="insights-v14-empty">No card activity for this selection yet.</div>`;
    return `<section class="insights-v20-performance" data-insights-v20-performance>
      <div class="insights-v20-performance-tools">
        <div>
          <span>Owner sales intelligence</span>
          <h4>Card performance</h4>
          <p>Compare views, saves and buyer intent. Select a column to sort the current filtered cards.</p>
        </div>
        <div class="insights-v20-performance-controls">
          <label>
            <span>Sort by</span>
            <select data-insights-v20-sort>
              <option value="views">Most viewed</option>
              <option value="saves">Most saved</option>
              <option value="intent">Most buyer intent</option>
              <option value="rate">Highest intent rate</option>
              <option value="attention">Needs attention</option>
            </select>
          </label>
          <div class="insights-v20-pagination" data-insights-v20-pagination hidden>
            <button type="button" data-insights-v20-page="prev">Previous</button>
            <span data-insights-v20-page-status></span>
            <button type="button" data-insights-v20-page="next">Next</button>
          </div>
        </div>
      </div>
      <div class="insights-v20-table-wrap">
        <table class="insights-v20-table">
          <thead><tr><th>Card</th><th>Views</th><th>Saves</th><th>Contact viewed</th><th>Buyer intent</th><th>Intent rate</th><th>Signal</th></tr></thead>
          <tbody data-insights-v20-performance-body></tbody>
        </table>
      </div>
    </section>`;
  }

  function performanceSort(items,mode){
    const copy=items.slice();
    if(mode==="saves") return copy.sort((a,b)=>b.saves-a.saves || b.views-a.views);
    if(mode==="intent") return copy.sort((a,b)=>b.intent-a.intent || b.views-a.views);
    if(mode==="rate") return copy.sort((a,b)=>b.intentRate-a.intentRate || b.intent-a.intent || b.views-a.views);
    if(mode==="attention") return copy.sort((a,b)=>{
      const score=item=>(item.intent===0 ? item.saves*5+item.views : 0);
      return score(b)-score(a) || b.saves-a.saves || b.views-a.views;
    });
    return copy.sort((a,b)=>b.views-a.views || b.intent-a.intent || b.saves-a.saves);
  }

  function renderPerformanceRows(mount,rows,mode="views",page=1){
    const body=mount?.querySelector("[data-insights-v20-performance-body]");
    if(!body) return {page:1,pages:1};
    const items=performanceSort(cardPerformanceRows(rows),mode);
    const pageSize=10;
    const pages=Math.max(1,Math.ceil(items.length/pageSize));
    const safePage=Math.min(Math.max(1,Number(page)||1),pages);
    const visible=items.slice((safePage-1)*pageSize,safePage*pageSize);
    body.innerHTML=visible.map(item=>`<tr>
      <td><button type="button" data-insights-v14-open-card="${appContext.escapeHtml(item.card?.id||"")}"><strong>${appContext.escapeHtml(item.card?.name||item.row?.name||"Untitled card")}</strong><small>${appContext.escapeHtml(String(item.card?.game||item.row?.game||""))}</small></button></td>
      <td>${item.views.toLocaleString()}</td>
      <td>${item.saves.toLocaleString()}</td>
      <td>${item.viewed.toLocaleString()}</td>
      <td>${item.intent.toLocaleString()}</td>
      <td>${item.views ? item.intentRate.toFixed(item.intentRate>=10?0:1)+"%" : "—"}</td>
      <td><span class="insights-v20-signal ${item.signal.tone}">${appContext.escapeHtml(item.signal.label)}</span></td>
    </tr>`).join("");
    const pager=mount.querySelector("[data-insights-v20-pagination]");
    const status=mount.querySelector("[data-insights-v20-page-status]");
    const prev=mount.querySelector('[data-insights-v20-page="prev"]');
    const next=mount.querySelector('[data-insights-v20-page="next"]');
    if(pager) pager.hidden=items.length<=pageSize;
    if(status) status.textContent=`Page ${safePage} of ${pages}`;
    if(prev) prev.disabled=safePage<=1;
    if(next) next.disabled=safePage>=pages;
    return {page:safePage,pages};
  }

  function demandBars(items,{inventoryGap=false,limit=5}={}){
    const safe=items.filter(item=>item.views>0 || item.inventory>0).slice(0,limit);
    if(!safe.length) return `<div class="insights-v14-empty">No demand data for this selection yet.</div>`;
    const max=Math.max(1,...safe.map(item=>item.views));
    return `<div class="insights-v14-demand-list">
      ${safe.map(item=>{
        const width=item.views?Math.max(4,item.views/max*100):0;
        const gap=item.demandShare-item.inventoryShare;
        return `<div class="insights-v14-demand-row">
          <div class="insights-v14-demand-label">
            <strong>${appContext.escapeHtml(item.label)}</strong>
            <span>${item.views.toLocaleString()} unique views · ${item.intent.toLocaleString()} intent</span>
          </div>
          <div class="insights-v14-demand-track"><i style="width:${width}%"></i></div>
          <div class="insights-v14-demand-meta">
            ${inventoryGap
              ? `<strong>${Math.round(item.demandShare)}% demand</strong><span>${Math.round(item.inventoryShare)}% inventory · <b class="${gap>=3?"positive":gap<=-3?"negative":""}">${gap>0?"+":""}${Math.round(gap)} pp</b></span>`
              : `<strong>${percentage(item.intent,item.views)}</strong><span>intent rate</span>`}
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function marketDemandHtml(markets,supported){
    if(supported===false){
      return `<div class="insights-v14-empty"><strong>Country × Card data is ready in the UI.</strong><br>Run <code>2026-09-17-v18-COUNTRY-CARD-DEMAND.sql</code> in Supabase to enable this panel.</div>`;
    }
    if(!markets.length){
      return `<div class="insights-v14-empty">No country-attributed card views for this selection yet.</div>`;
    }
    return `<div class="insights-v18-market-list">
      ${markets.slice(0,6).map(item=>{
        const countryName=appContext.visitorCountryName?.(item.countryCode)||item.countryCode;
        const topCard=item.topCard?.card||null;
        return `<article class="insights-v18-market-row">
          <div class="insights-v18-market-country">
            <span>${appContext.escapeHtml(item.countryCode)}</span>
            <div><strong>${appContext.escapeHtml(countryName)}</strong><small>${item.views.toLocaleString()} qualified card views</small></div>
          </div>
          <div class="insights-v18-market-signal">
            <span>Top era</span><strong>${appContext.escapeHtml(item.topEra)}</strong><small>${Number(item.topEraViews||0).toLocaleString()} views</small>
          </div>
          <div class="insights-v18-market-signal">
            <span>Top card</span>
            ${topCard
              ? `<button type="button" data-insights-v14-open-card="${appContext.escapeHtml(topCard.id)}">${appContext.escapeHtml(topCard.name||"Untitled card")}</button><small>${Number(item.topCard.views||0).toLocaleString()} views</small>`
              : `<strong>—</strong><small>No card data</small>`}
          </div>
        </article>`;
      }).join("")}
    </div>`;
  }

  function discoverySourceLabel(source){
    const labels={
      "trending":"Trending",
      "recently-added":"Recently Added",
      "spotlight":"Collector Spotlight",
      "related":"Related Cards",
      "vintage":"Vintage",
      "championship":"Championship",
      "sealed":"Sealed",
      "search":"Search",
      "inventory-filtered":"Filtered Inventory",
      "inventory":"Inventory",
      "collection":"Collection",
      "reserved":"Reserved",
      "sold":"Sold",
      "recently-viewed":"Recently Viewed",
      "favorites":"Favorites",
      "home":"Home"
    };
    return labels[String(source||"")]||String(source||"Other");
  }

  function discoverySummaryHtml(){
    if(discoverySupported===false){
      return `<div class="insights-v14-empty">Discovery attribution is not available yet. Run <code>2026-09-24-v08-DISCOVERY-SUMMARY.sql</code> after the Phase 2B1 migration.</div>`;
    }
    if(!discoveryRows.length){
      return `<div class="insights-v14-empty">No attributed Qualified Views in this period yet. With low traffic, let this accumulate naturally.</div>`;
    }
    const rows=discoveryRows.slice(0,6);
    const max=Math.max(1,...rows.map(row=>Number(row.unique_visitors||0)));
    return `<div class="insights-v14-demand-list">
      ${rows.map(row=>{
        const unique=Math.max(0,Number(row.unique_visitors||0));
        const views=Math.max(0,Number(row.qualified_views||0));
        const cards=Math.max(0,Number(row.unique_cards||0));
        const width=unique ? Math.max(4,unique/max*100) : 0;
        return `<div class="insights-v14-demand-row">
          <div class="insights-v14-demand-label">
            <strong>${appContext.escapeHtml(discoverySourceLabel(row.discovery_source))}</strong>
            <span>${unique.toLocaleString()} unique collector${unique===1?"":"s"} · ${views.toLocaleString()} qualified view${views===1?"":"s"}</span>
          </div>
          <div class="insights-v14-demand-track"><i style="width:${width}%"></i></div>
          <div class="insights-v14-demand-meta">
            <strong>${cards.toLocaleString()}</strong><span>card${cards===1?"":"s"} discovered</span>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function audienceCard(label,value,detail){
    return `<article><span>${appContext.escapeHtml(label)}</span><strong>${appContext.escapeHtml(value||"—")}</strong><small>${appContext.escapeHtml(detail||"")}</small></article>`;
  }

  function bindCardOpenButtons(root){
    root?.querySelectorAll("[data-insights-v14-open-card]").forEach(btn=>{
      if(btn.dataset.insightsV20Bound==="1") return;
      btn.dataset.insightsV20Bound="1";
      btn.addEventListener("click",()=>{
        const id=String(btn.dataset.insightsV14OpenCard||"");
        if(!id) return;
        if(typeof appContext.openInsightsCardDetails==="function") appContext.openInsightsCardDetails(id);
        else if(typeof appContext.openCardRoute==="function") appContext.openCardRoute(id);
      });
    });
  }

  function renderDashboard(mount){
    const m=metrics();
    const rangeText=String(appContext.$?.("insightsRange")?.selectedOptions?.[0]?.textContent||"Selected period").trim();
    const {status,game}=selectedFilters();
    const context=[rangeText,status||"All statuses",game||"All games"].join(" · ");
    const country=m.topCountry
      ? appContext.visitorCountryName?.(m.topCountry.country_code)||String(m.topCountry.country_code||"Other")
      : "—";
    const source=m.topSource ? String(m.topSource.source_type||m.topSource.source||"Other") : "—";
    const topGame=m.games[0]?.label||"—";
    const strongestCard=rowCard(m.strongest);

    mount.innerHTML=`
      <div class="insights-v14-hero">
        <div>
          <span>Decision dashboard</span>
          <h3>Demand at a glance</h3>
          <p>Buyer signals first. Detailed traffic diagnostics are available below when you need them.</p>
        </div>
        <div class="insights-v14-context">${appContext.escapeHtml(context)}</div>
      </div>

      <div class="insights-v14-kpis">
        <article>
          <span>Website visits</span>
          <strong>${m.visits.toLocaleString()}</strong>
          <small>Sessions in selected period</small>
        </article>
        <article>
          <span>Unique card views</span>
          <strong>${m.uniqueViews.toLocaleString()}</strong>
          <small>${m.qualifiedViews.toLocaleString()} total qualified views</small>
        </article>
        <article>
          <span>Contact intent rate</span>
          <strong>${m.intentRate}</strong>
          <small>${m.intent.toLocaleString()} intent from ${m.uniqueViews.toLocaleString()} unique card views</small>
        </article>
        <article>
          <span>Contact → intent</span>
          <strong>${m.contactToIntent}</strong>
          <small>${m.viewed.toLocaleString()} contact views · ${m.intent.toLocaleString()} intent</small>
        </article>
      </div>

      <div class="insights-v14-signal-strip">
        ${audienceCard("Top country",country,m.topCountry?`${Number(m.topCountry.visits||0).toLocaleString()} visits`:"No country data")}
        ${audienceCard("Top traffic source",source,m.topSource?`${Number(m.topSource.visits||0).toLocaleString()} visits`:"No source data")}
        ${audienceCard("Most viewed game",topGame,m.games[0]?`${m.games[0].views.toLocaleString()} unique views`:"No game demand yet")}
        ${audienceCard("Strongest card",strongestCard?.name||"—",m.strongest?`Interest score ${Number(m.strongest._interestScore||0)}`:"No activity")}
      </div>

      <div class="insights-v14-grid">
        <section class="insights-v14-panel">
          <div class="insights-v14-panel-head">
            <div><span>Demand balance</span><h4>Card era</h4></div>
            <p>See whether Vintage, Championship, Modern and your other stored eras outperform their share of inventory.</p>
          </div>
          ${demandBars(m.eras,{inventoryGap:true,limit:6})}
          <details class="insights-v18-secondary">
            <summary>Compare by card language</summary>
            <div>${demandBars(m.language,{inventoryGap:true,limit:6})}</div>
          </details>
        </section>

        <section class="insights-v14-panel insights-v18-price-panel">
          <div class="insights-v14-panel-head">
            <div><span>Buyer quality</span><h4>Price bands</h4></div>
            <p>Which price ranges attract views and convert into contact intent.</p>
          </div>
          ${demandBars(m.prices,{inventoryGap:false,limit:5})}
        </section>
      </div>

      <section class="insights-v14-panel">
        <div class="insights-v14-panel-head">
          <div><span>Discovery</span><h4>Where card interest starts</h4></div>
          <p>Qualified Views by discovery surface. Use this as directional context while traffic is still small.</p>
        </div>
        ${discoverySummaryHtml()}
      </section>

      ${cardPerformanceHtml(m.rows)}

      <section class="insights-v14-panel insights-v18-market-panel">
        <div class="insights-v14-panel-head">
          <div><span>Market demand</span><h4>Card views by country</h4></div>
          <p>For each market, see the card era and individual card attracting the most qualified views.</p>
        </div>
        ${marketDemandHtml(m.markets,m.countryCardSupported)}
      </section>

      <section class="insights-v14-opportunities">
        <div class="insights-v14-panel-head">
          <div><span>Actionable signals</span><h4>Opportunities</h4></div>
          <p>Only the strongest signals are shown here. Use the Recommendations tab for the full list.</p>
        </div>
        <div class="insights-v14-opportunity-grid">
          ${m.opportunities.length ? m.opportunities.map(item=>`
            <button type="button" class="insights-v14-opportunity ${item.tone}" data-insights-v14-open-card="${appContext.escapeHtml(item.card.id)}">
              <span>${appContext.escapeHtml(item.type)}</span>
              <strong>${appContext.escapeHtml(item.card.name||"Untitled card")}</strong>
              <small>${appContext.escapeHtml(item.detail)}</small>
            </button>`).join("") : `<div class="insights-v14-empty">No strong opportunity signals for this selection yet.</div>`}
        </div>
      </section>

      <div class="insights-v14-note">
        Market demand is aggregated from anonymous qualified card views and country events. Individual visitor histories are never shown.
      </div>`;

    const performance=mount.querySelector("[data-insights-v20-performance]");
    if(performance){
      const sort=performance.querySelector("[data-insights-v20-sort]");
      let page=1;
      const refresh=()=>{
        const result=renderPerformanceRows(performance,m.rows,String(sort?.value||"views"),page);
        page=result.page;
        bindCardOpenButtons(performance);
      };
      if(sort) sort.addEventListener("change",()=>{ page=1; refresh(); });
      performance.querySelectorAll("[data-insights-v20-page]").forEach(btn=>btn.addEventListener("click",()=>{
        page+=btn.dataset.insightsV20Page==="next"?1:-1;
        refresh();
      }));
      refresh();
    }

    bindCardOpenButtons(mount);
  }

  function detailsShell(){
    const wrap=document.createElement("div");
    wrap.className="insights-v14-details";
    wrap.innerHTML=`
      <div class="insights-v14-detail-heading">
        <div><span>Deep dive</span><h3>Detailed analytics</h3></div>
        <p>Open only the area you need. This keeps the main dashboard readable.</p>
      </div>
      <details>
        <summary><span>Traffic & conversion</span><small>Charts, session quality, funnels and conversion detail</small></summary>
        <div class="insights-v14-detail-body" data-insights-v14-group="traffic"></div>
      </details>
      <details>
        <summary><span>Audience</span><small>Countries, access time, devices, sources and returning visitors</small></summary>
        <div class="insights-v14-detail-body" data-insights-v14-group="audience"></div>
      </details>
      <details>
        <summary><span>Discovery & campaigns</span><small>Search demand, giveaways and recently viewed cards</small></summary>
        <div class="insights-v14-detail-body" data-insights-v14-group="discovery"></div>
      </details>
      <details>
        <summary><span>Card performance table</span><small>Full per-card analytics when you need the raw comparison</small></summary>
        <div class="insights-v14-detail-body" data-insights-v14-group="cards"></div>
      </details>`;
    return wrap;
  }

  function classifyNode(node){
    const text=String(node?.textContent||"").toLowerCase();
    if(node?.classList?.contains("insights-v4-intro")) return "hide";
    if(text.includes("top card performance")) return "cards";
    if(
      text.includes("visitor countries") ||
      text.includes("visitor access time") ||
      text.includes("device breakdown") ||
      text.includes("traffic sources") ||
      text.includes("returning visitors")
    ) return "audience";
    if(
      text.includes("search & demand") ||
      text.includes("giveaway performance") ||
      text.includes("recently viewed cards")
    ) return "discovery";
    return "traffic";
  }

  function organizeOverview(root,dashboard,details){
    const groups={
      traffic:details.querySelector('[data-insights-v14-group="traffic"]'),
      audience:details.querySelector('[data-insights-v14-group="audience"]'),
      discovery:details.querySelector('[data-insights-v14-group="discovery"]'),
      cards:details.querySelector('[data-insights-v14-group="cards"]')
    };

    [...root.children].forEach(node=>{
      if(node===dashboard || node===details) return;
      const group=classifyNode(node);
      if(group==="hide"){
        node.hidden=true;
        groups.traffic?.appendChild(node);
        return;
      }
      groups[group]?.appendChild(node);
    });
  }

  function polishStaticChrome(){
    const head=appContext.view?.querySelector(".insights-v4-page-head");
    if(head){
      const eyebrow=head.querySelector(".eyebrow");
      const title=head.querySelector("h2");
      const copy=head.querySelector("p");
      if(eyebrow) eyebrow.textContent="Owner analytics";
      if(title) title.textContent="Insights";
      if(copy) copy.textContent="See demand, buyer intent and opportunities first. Open deeper diagnostics only when needed.";
    }

    const labels={
      overview:"Dashboard",
      recommendations:"Opportunities",
      history:"Card History",
      sales:"Sales",
      health:"Data Health"
    };
    appContext.$?.("insightsTabs")?.querySelectorAll("[data-insights-tab]").forEach(btn=>{
      const span=btn.querySelector("span");
      const small=btn.querySelector("small");
      if(span && labels[btn.dataset.insightsTab]) span.textContent=labels[btn.dataset.insightsTab];
      if(small) small.hidden=true;
    });
  }

  function applyEnhancement(){
    const root=overview();
    if(!root) return;

    if(observer) observer.disconnect();
    try{
      polishStaticChrome();
      root.classList.add("insights-v14-clean");

      let dashboard=root.querySelector(":scope > .insights-v14-dashboard");
      if(!dashboard){
        dashboard=document.createElement("section");
        dashboard.className="insights-v14-dashboard";
        root.prepend(dashboard);
      }
      renderDashboard(dashboard);

      let details=root.querySelector(":scope > .insights-v14-details");
      if(!details){
        details=detailsShell();
        dashboard.insertAdjacentElement("afterend",details);
      }
      organizeOverview(root,dashboard,details);
    }finally{
      if(observer && root.isConnected){
        observedRoot=root;
        observer.observe(root,{childList:true});
      }
    }
  }

  function installObserver(){
    if(typeof MutationObserver!=="function") return;
    const root=overview();
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
