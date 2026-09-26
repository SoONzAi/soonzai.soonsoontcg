/** V93 beta: features/owner/insights. Shared dependencies are explicit on appContext. */
export function register(appContext){
async function resetQualifiedViewCounts(){
    if(!appContext.requireOwner("reset qualified view counts")) return false;

    try{
      const {error}=await appContext.supabaseClient.rpc("reset_qualified_view_counts");

      if(error){
        console.error("Reset qualified views error:",error);

        const rawMessage=[
          error.message,
          error.details,
          error.hint,
          error.code
        ].filter(Boolean).join(" · ");
        const message=rawMessage.toLowerCase();

        if(
          message.includes("reset_qualified_view_counts") &&
          (message.includes("function") || message.includes("schema cache") || message.includes("pgrst202"))
        ){
          appContext.showToast("Reset RPC is not installed. Run the Views + Website Visits reset migration in Supabase.");
        }else if(
          message.includes("owner access required") ||
          message.includes("42501") ||
          message.includes("permission denied")
        ){
          appContext.showToast("Reset permission denied. Confirm Owner Mode login and run the reset migration.");
        }else if(message.includes("qualified view table not installed")){
          appContext.showToast("Qualified View analytics table is not installed.");
        }else{
          appContext.showToast(`Reset failed: ${rawMessage.slice(0,180) || "Unknown Supabase error"}`);
        }

        return false;
      }

      try{
        await appContext.supabaseClient.rpc("reset_giveaway_engagement");
      }catch{}

      appContext.qualifiedViewTotalsByCard?.clear?.();
      appContext.qualifiedViewTotalsBackendState="unknown";
      await appContext.refreshQualifiedViewTotals();
      appContext.showToast("Insights analytics reset");
      return true;
    }catch(error){
      console.error("Reset qualified views failed:",error);
      appContext.showToast(`Reset failed: ${String(error?.message||error||"Unknown error").slice(0,180)}`);
      return false;
    }
  }

function openResetQualifiedViewsModal(){
    if(!appContext.requireOwner("reset qualified view counts")) return;
    const overlay=appContext.$("resetQualifiedViewsOverlay");
    const input=appContext.$("resetQualifiedViewsConfirm");
    const confirmBtn=appContext.$("resetQualifiedViewsConfirmBtn");
    if(!overlay || !input || !confirmBtn) return;

    input.value="";
    confirmBtn.disabled=true;
    overlay.hidden=false;
    requestAnimationFrame(()=>input.focus());
  }

function closeResetQualifiedViewsModal(){
    const overlay=appContext.$("resetQualifiedViewsOverlay");
    const input=appContext.$("resetQualifiedViewsConfirm");
    const confirmBtn=appContext.$("resetQualifiedViewsConfirmBtn");
    if(overlay) overlay.hidden=true;
    if(input) input.value="";
    if(confirmBtn) confirmBtn.disabled=true;
  }

async function renderInsightsPage(){
    if(!appContext.isOwnerMode()){ appContext.goToRoute("inventory"); return; }

    appContext.view.innerHTML=`
      <div class="page-head insights-v4-page-head">
        <div>
          <div class="eyebrow">Owner analytics · V4</div>
          <h2>Insights</h2>
          <p>Simple buyer-interest analytics with clear recommendations, listing history and sale conversion data.</p>
        </div>
        <button type="button"
                class="btn-ghost insights-reset-views-btn owner-only"
                id="resetQualifiedViewsBtn">
          Reset View Counts
        </button>
      </div>

      <nav class="insights-v4-tabs" id="insightsTabs" aria-label="Insights sections">
        <button type="button" class="active" data-insights-tab="overview"><span>Overview</span><small>What is happening</small></button>
        <button type="button" data-insights-tab="recommendations"><span>Recommendations</span><small>What to do next</small></button>
        <button type="button" data-insights-tab="history"><span>Card History</span><small>Views, interest & price</small></button>
        <button type="button" data-insights-tab="sales"><span>Sales</span><small>What converts</small></button>
        <button type="button" data-insights-tab="health"><span>Health</span><small>Can I trust the data?</small></button>
      </nav>

      <section class="insights-v4-filterbar">
        <div>
          <label><span>Period</span>
            <select id="insightsRange">
              <option value="today">Today</option>
              <option value="7d" selected>Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Date</option>
            </select>
          </label>

          <div class="insights-range-custom" id="insightsCustom">
            <input type="date" id="insightsStart" aria-label="Start date">
            <input type="date" id="insightsEnd" aria-label="End date">
          </div>

          <label><span>Status</span>
            <select id="insightsStatus">
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Sold">Sold</option>
              <option value="Collection (NFS)">Collection (NFS)</option>
              <option value="Hidden">Hidden</option>
              <option value="Archived">Archived</option>
            </select>
          </label>

          <label><span>Game</span>
            <select id="insightsGame"><option value="">All Games</option></select>
          </label>
        </div>
      </section>

      <div class="insights-v4-loading" id="insightsLoading">Loading analytics…</div>

      <section class="insights-v4-tab-panel active" data-insights-panel="overview">
        <div id="insightsOverview"></div>
      </section>

      <section class="insights-v4-tab-panel" data-insights-panel="recommendations">
        <div id="insightsRecommendations"></div>
      </section>

      <section class="insights-v4-tab-panel" data-insights-panel="history">
        <div id="insightsHistory"></div>
      </section>

      <section class="insights-v4-tab-panel" data-insights-panel="sales">
        <div id="insightsSales"></div>
      </section>

      <section class="insights-v4-tab-panel" data-insights-panel="health">
        <div id="insightsHealth"></div>
      </section>
    `;

    const rangeSel=appContext.$("insightsRange");
    const custom=appContext.$("insightsCustom");
    const statusSel=appContext.$("insightsStatus");
    const gameSel=appContext.$("insightsGame");
    const startInput=appContext.$("insightsStart");
    const endInput=appContext.$("insightsEnd");
    const loading=appContext.$("insightsLoading");

    const seven=appContext.dateRangeForPreset("7d");
    startInput.value=seven.start.toISOString().slice(0,10);
    endInput.value=new Date().toISOString().slice(0,10);

    let state={
      start:null,end:null,rows:[],visible:[],series:[],websiteSeries:[],
      visitorCountries:[],visitorCountrySupported:false,
      visitorHours:[],visitorWeekdays:[],visitorAccessTimeSupported:false,
      visitorDevices:[],visitorDeviceSupported:false,
      visitorSources:[],visitorSourceSupported:false,
      searchInsights:[],searchInsightsSupported:false,
      returningVisitorInsights:null,returningVisitorSupported:false,
      sessionDurationInsights:null,sessionDurationSupported:false,
      engagedVisitSeries:[],engagedVisitSupported:false,
      overviewPhotoRows:[],overviewPhotoSupported:false,
      recentQualifiedViews:[],recentQualifiedViewsSupported:false,
      giveawayPerformance:null,giveawayPerformanceSupported:false,
      engagementSupported:false,saleSnapshotsSupported:false,saleSnapshots:[],
      editHistoryRows:[],editHistoryLoaded:false
    };
    let topCardPerformanceLimit="15";

    function activeTab(){
      return appContext.$("insightsTabs")?.querySelector("button.active")?.dataset.insightsTab||"overview";
    }

    appContext.$("resetQualifiedViewsBtn")?.addEventListener("click",appContext.openResetQualifiedViewsModal);

    function switchTab(tab){
      appContext.$("insightsTabs")?.querySelectorAll("[data-insights-tab]").forEach(btn=>{
        btn.classList.toggle("active",btn.dataset.insightsTab===tab);
      });
      appContext.view.querySelectorAll("[data-insights-panel]").forEach(panel=>{
        panel.classList.toggle("active",panel.dataset.insightsPanel===tab);
      });
      if(tab==="history") renderHistoryTab();
      if(tab==="health") renderHealthTab();
    }

    appContext.$("insightsTabs")?.addEventListener("click",e=>{
      const btn=e.target.closest("[data-insights-tab]");
      if(btn) switchTab(btn.dataset.insightsTab);
    });

    function cardDaysListed(card){
      const start=new Date(card?.created_at||"").getTime();
      if(!Number.isFinite(start)) return null;
      const sold=appContext.normalizeFilterValue(card?.availability)==="sold" && card?.sold_at
        ? new Date(card.sold_at).getTime()
        : Date.now();
      if(!Number.isFinite(sold)||sold<start) return null;
      return Math.max(0,Math.floor((sold-start)/(24*60*60*1000)));
    }

    function emptyEngagement(){
      return {
        favorite_adds:0,favorite_visitors:0,contact_opens:0,contact_visitors:0,
        platform_clicks:0,inquiry_copies:0,image_expands:0,shares:0,downloads:0,
        overview_photo_interactions:0,overview_photo_visitors:0,intent_visitors:0
      };
    }

    function contactIntentMetrics(row){
      return appContext.insightContactMetrics(row||{});
    }

    function contactIntentCount(row){
      return Number(contactIntentMetrics(row).intent_count||0);
    }

    function contactIntentStage(row){
      const metrics=contactIntentMetrics(row);
      if(metrics.strongest_stage==="platform") return "Platform clicked";
      if(metrics.strongest_stage==="copy") return "Inquiry copied";
      if(metrics.strongest_stage==="open") return "Contact options opened";
      return "No contact intent";
    }

    function recommendationFor(row){
      const card=row._card;
      if(!card || row._status!=="Available") return null;

      const unique=Number(row.unique_views||0);
      const fav=Number(row.favorite_adds||0);
      const contacts=row._contactIntent;
      const days=row._daysListed;
      const usd=appContext.cardUsdListedPrice(card)||0;

      if(unique>=8 && contacts===0){
        return {
          level:"high",type:"Review price / confidence",card,
          reason:`${unique} unique views but no contact intent`,
          action:"Check price against your market, improve description, or add stronger photos."
        };
      }
      if(contacts>=2 || (fav>=2 && unique>=3)){
        return {
          level:"good",type:"Strong demand",card,
          reason:`${fav} favorite${fav===1?"":"s"} · ${contacts} contact intent${contacts===1?"":"s"}`,
          action:"Avoid unnecessary discounting. Keep visible and respond quickly to inquiries."
        };
      }
      if(row._trend.className==="hot"){
        return {
          level:"good",type:"Promote now",card,
          reason:`Interest is rising ${row._trend.label}`,
          action:"Share the listing while momentum is increasing."
        };
      }
      if(usd>=appContext.HIGH_VALUE_DIRECT_CONTACT_USD && unique<2){
        return {
          level:"medium",type:"Low discoverability",card,
          reason:`${appContext.fmtMoney(usd)} listing with only ${unique} unique view${unique===1?"":"s"}`,
          action:"Improve discoverability, title keywords, or share a direct listing link."
        };
      }
      if(Number.isFinite(days) && days>=60 && unique<=1){
        return {
          level:"medium",type:"Stale inventory",card,
          reason:`${days} days listed with very little current interest`,
          action:"Refresh photos/title and reassess pricing."
        };
      }
      return null;
    }

    function syncGameOptions(rows){
      const selected=gameSel.value;
      const games=[...new Set(rows.map(row=>String(row.game||row._card?.game||"").trim()).filter(Boolean))]
        .sort((a,b)=>a.localeCompare(b));
      gameSel.innerHTML=`<option value="">All Games</option>`+
        games.map(game=>`<option value="${appContext.escapeHtml(game)}">${appContext.escapeHtml(game)}</option>`).join("");
      if(games.includes(selected)) gameSel.value=selected;
    }

    function busiestVisitorHour(rows){
      const ranked=(Array.isArray(rows)?rows:[])
        .slice()
        .sort((a,b)=>Number(b.visits||0)-Number(a.visits||0));
      return ranked[0]||null;
    }

    function busiestVisitorWeekday(rows){
      const ranked=(Array.isArray(rows)?rows:[])
        .slice()
        .sort((a,b)=>Number(b.visits||0)-Number(a.visits||0));
      return ranked[0]||null;
    }

    function renderVisitorHourBars(rows){
      const safe=Array.isArray(rows)?rows:[];
      if(!safe.length) return `<div class="hint">No hourly visit data for this period yet.</div>`;

      const max=Math.max(1,...safe.map(row=>Number(row.visits||0)));
      return `<div class="insights-hour-grid">
        ${safe.map(row=>{
          const visits=Math.max(0,Number(row.visits||0));
          const height=visits?Math.max(4,visits/max*100):0;
          const hour=Number(row.bucket_no||0);
          const compactLabel=hour%3===0 ? String(row.bucket_label||"") : "";
          return `<div class="insights-hour-cell" title="${appContext.escapeHtml(`${row.bucket_label||""} · ${visits} visit${visits===1?"":"s"}`)}">
            <div class="insights-hour-bar"><i style="height:${height}%"></i><b>${visits||""}</b></div>
            <span>${appContext.escapeHtml(compactLabel)}</span>
          </div>`;
        }).join("")}
      </div>`;
    }

    function renderVisitorWeekdayBars(rows){
      const safe=Array.isArray(rows)?rows:[];
      if(!safe.length) return `<div class="hint">No weekday visit data for this period yet.</div>`;

      const max=Math.max(1,...safe.map(row=>Number(row.visits||0)));
      return `<div class="insights-weekday-list">
        ${safe.map(row=>{
          const visits=Math.max(0,Number(row.visits||0));
          const width=visits?Math.max(3,visits/max*100):0;
          const short=String(row.bucket_label||"").slice(0,3);
          return `<div class="insights-weekday-row">
            <span>${appContext.escapeHtml(short)}</span>
            <i><b style="width:${width}%"></b></i>
            <strong>${visits.toLocaleString()}</strong>
          </div>`;
        }).join("")}
      </div>`;
    }

    function renderVisitorDeviceBreakdown(rows){
      const safe=(Array.isArray(rows)?rows:[])
        .map(row=>({
          device_type:String(row.device_type||"Other"),
          visits:Math.max(0,Number(row.visits||0))
        }))
        .filter(row=>row.visits>0);

      if(!safe.length){
        return `<div class="hint">No device data for this period yet.</div>`;
      }

      const preferred=["Mobile","Desktop","Tablet","Other"];
      safe.sort((a,b)=>{
        const ai=preferred.indexOf(a.device_type);
        const bi=preferred.indexOf(b.device_type);
        if(ai!==bi) return (ai<0?99:ai)-(bi<0?99:bi);
        return b.visits-a.visits;
      });

      const total=safe.reduce((sum,row)=>sum+row.visits,0)||1;

      return `<div class="insights-device-list">
        ${safe.map(row=>{
          const pct=row.visits/total*100;
          return `<div class="insights-device-row">
            <div class="insights-device-copy">
              <strong>${appContext.escapeHtml(row.device_type)}</strong>
              <span>${row.visits.toLocaleString()} visit${row.visits===1?"":"s"}</span>
            </div>
            <div class="insights-device-bar"><i style="width:${pct}%"></i></div>
            <strong class="insights-device-pct">${pct.toFixed(pct>=10?0:1)}%</strong>
          </div>`;
        }).join("")}
      </div>`;
    }

    function renderVisitorTrafficSources(rows){
      const safe=(Array.isArray(rows)?rows:[])
        .map(row=>({
          source_type:String(row.source_type||"Other"),
          visits:Math.max(0,Number(row.visits||0))
        }))
        .filter(row=>row.visits>0);

      if(!safe.length){
        return `<div class="hint">No traffic-source data for this period yet.</div>`;
      }

      const preferred=["Facebook","Instagram","Google","Carousell","Direct","Other"];
      safe.sort((a,b)=>{
        if(b.visits!==a.visits) return b.visits-a.visits;
        const ai=preferred.indexOf(a.source_type);
        const bi=preferred.indexOf(b.source_type);
        return (ai<0?99:ai)-(bi<0?99:bi);
      });

      const total=safe.reduce((sum,row)=>sum+row.visits,0)||1;

      return `<div class="insights-source-list">
        ${safe.map((row,index)=>{
          const pct=row.visits/total*100;
          return `<div class="insights-source-row">
            <span class="insights-source-rank">${index+1}</span>
            <div class="insights-source-copy">
              <strong>${appContext.escapeHtml(row.source_type)}</strong>
              <span>${row.visits.toLocaleString()} visit${row.visits===1?"":"s"}</span>
            </div>
            <div class="insights-source-bar"><i style="width:${pct}%"></i></div>
            <strong class="insights-source-pct">${pct.toFixed(pct>=10?0:1)}%</strong>
          </div>`;
        }).join("")}
      </div>`;
    }

    function renderSearchDemandInsights(rows){
      const safe=Array.isArray(rows)?rows:[];
      if(!safe.length) return `<div class="hint">No inventory searches for this period yet.</div>`;

      const top=safe.slice().sort((a,b)=>Number(b.searches||0)-Number(a.searches||0)).slice(0,10);
      const zero=safe.filter(r=>Number(r.zero_result_searches||0)>0)
        .sort((a,b)=>Number(b.zero_result_searches||0)-Number(a.zero_result_searches||0)).slice(0,10);
      const total=safe.reduce((n,r)=>n+Number(r.searches||0),0);
      const uniqueTerms=safe.length;
      const zeroTotal=safe.reduce((n,r)=>n+Number(r.zero_result_searches||0),0);

      const table=(list,zeroMode=false)=>`<div class="insights-search-table">
        ${list.map((r,i)=>`<div class="insights-search-row">
          <span>${i+1}</span>
          <strong>${appContext.escapeHtml(r.search_term||"")}</strong>
          <small>${zeroMode
            ? `${Number(r.zero_result_searches||0).toLocaleString()} zero-result`
            : `${Number(r.searches||0).toLocaleString()} searches · ${Number(r.unique_searchers||0).toLocaleString()} visitors`}</small>
        </div>`).join("") || `<div class="hint">${zeroMode?"No zero-result searches.":"No searches yet."}</div>`}
      </div>`;

      return `<div class="insights-search-summary">
          <article><span>Searches</span><strong>${total.toLocaleString()}</strong></article>
          <article><span>Unique terms</span><strong>${uniqueTerms.toLocaleString()}</strong></article>
          <article><span>Zero-result searches</span><strong>${zeroTotal.toLocaleString()}</strong></article>
        </div>
        <div class="insights-search-grid">
          <div><div class="insights-access-subhead"><strong>Top Searches</strong><span>What visitors look for</span></div>${table(top)}</div>
          <div><div class="insights-access-subhead"><strong>Unmet Demand</strong><span>Searches returning no cards</span></div>${table(zero,true)}</div>
        </div>`;
    }

    function engagedVisitDateLabel(value){
      const raw=String(value||"");
      const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[2]}/${match[3]}` : raw;
    }

    function websiteVisitDateKey(row){
      const raw=String(row?.bucket||row?.visit_date||row?.date||"");
      const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(match) return `${match[1]}-${match[2]}-${match[3]}`;

      const d=new Date(raw);
      if(!Number.isFinite(d.getTime())) return raw;
      return new Intl.DateTimeFormat("en-CA",{
        timeZone:"Asia/Kuala_Lumpur",
        year:"numeric",month:"2-digit",day:"2-digit"
      }).format(d);
    }

    function renderEngagedVisitsComparison(websiteRows,engagedRows){
      const siteMap=new Map(
        (Array.isArray(websiteRows)?websiteRows:[]).map(r=>[
          websiteVisitDateKey(r),
          Number(r.visits||0)
        ])
      );

      const engagedMap=new Map(
        (Array.isArray(engagedRows)?engagedRows:[]).map(r=>[
          String(r.visit_date||""),
          Number(r.engaged_visits||0)
        ])
      );

      const dates=[...new Set([...siteMap.keys(),...engagedMap.keys()])]
        .filter(Boolean)
        .sort();

      if(!dates.length) return `<div class="hint">No visit data for this period yet.</div>`;

      const rows=dates.map(date=>({
        date,
        visits:Number(siteMap.get(date)||0),
        engaged:Number(engagedMap.get(date)||0)
      }));

      const max=Math.max(1,...rows.map(r=>Math.max(r.visits,r.engaged)));

      return `<div class="engaged-visit-chart">
        ${rows.map(r=>{
          const visitWidth=r.visits?Math.max(2,r.visits/max*100):0;
          const engagedWidth=r.engaged?Math.max(2,r.engaged/max*100):0;
          const rate=r.visits?r.engaged/r.visits*100:0;

          return `<div class="engaged-visit-day">
            <div class="engaged-visit-date">${appContext.escapeHtml(engagedVisitDateLabel(r.date))}</div>
            <div class="engaged-visit-bars">
              <div class="engaged-visit-line">
                <span>Visits</span>
                <i><b class="engaged-visits-total" style="width:${visitWidth}%"></b></i>
                <strong>${r.visits.toLocaleString()}</strong>
              </div>
              <div class="engaged-visit-line">
                <span>Engaged</span>
                <i><b class="engaged-visits-active" style="width:${engagedWidth}%"></b></i>
                <strong>${r.engaged.toLocaleString()}</strong>
              </div>
            </div>
            <small>${rate.toFixed(rate>=10?0:1)}%</small>
          </div>`;
        }).join("")}
      </div>`;
    }

    function renderReturningVisitorInsights(row){
      if(!row) return `<div class="hint">No session analytics for this period yet.</div>`;

      const total=Math.max(0,Number(row.total_sessions||0));
      const newSessions=Math.max(0,Number(row.new_sessions||0));
      const returning=Math.max(0,Number(row.returning_sessions||0));
      const unique=Math.max(0,Number(row.unique_visitors||0));
      const avgViews=Math.max(0,Number(row.avg_qualified_views||0));
      const returnRate=total ? returning/total*100 : 0;

      const depthRows=[
        {label:"0 cards",value:Number(row.depth_0||0)},
        {label:"1 card",value:Number(row.depth_1||0)},
        {label:"2–4 cards",value:Number(row.depth_2_4||0)},
        {label:"5–9 cards",value:Number(row.depth_5_9||0)},
        {label:"10+ cards",value:Number(row.depth_10_plus||0)}
      ];
      const maxDepth=Math.max(1,...depthRows.map(item=>item.value));

      return `<div class="insights-return-summary">
          <article><span>Tracked sessions</span><strong>${total.toLocaleString()}</strong></article>
          <article><span>Unique visitors</span><strong>${unique.toLocaleString()}</strong></article>
          <article><span>Returning sessions</span><strong>${returning.toLocaleString()}</strong><small>${returnRate.toFixed(returnRate>=10?0:1)}% return rate</small></article>
          <article><span>Avg qualified views / session</span><strong>${avgViews.toFixed(avgViews>=10?1:2)}</strong></article>
        </div>

        <div class="insights-return-grid">
          <div>
            <div class="insights-access-subhead"><strong>New vs Returning</strong><span>Anonymous browser sessions</span></div>
            <div class="insights-return-split">
              <article><span>New</span><strong>${newSessions.toLocaleString()}</strong><i><b style="width:${total?newSessions/total*100:0}%"></b></i></article>
              <article><span>Returning</span><strong>${returning.toLocaleString()}</strong><i><b style="width:${total?returning/total*100:0}%"></b></i></article>
            </div>
          </div>

          <div>
            <div class="insights-access-subhead"><strong>Browsing Depth</strong><span>Qualified card views per session</span></div>
            <div class="insights-depth-list">
              ${depthRows.map(item=>{
                const pct=total?item.value/total*100:0;
                const width=item.value?Math.max(3,item.value/maxDepth*100):0;
                return `<div class="insights-depth-row">
                  <span>${appContext.escapeHtml(item.label)}</span>
                  <i><b style="width:${width}%"></b></i>
                  <strong>${item.value.toLocaleString()}</strong>
                  <small>${pct.toFixed(pct>=10?0:1)}%</small>
                </div>`;
              }).join("")}
            </div>
          </div>
        </div>`;
    }

    function renderSessionDurationInsights(row){
      if(!row) return `<div class="hint">No active-duration sessions in this period yet.</div>`;
      const total=Math.max(0,Number(row.total_sessions||0));
      const engaged2=Math.max(0,Number(row.engaged_2m||0));
      const engaged5=Math.max(0,Number(row.engaged_5m||0));
      const avg=Math.max(0,Number(row.avg_active_seconds||0));
      const longest=Math.max(0,Number(row.longest_active_seconds||0));
      const rate2=total?engaged2/total*100:0;
      const rate5=total?engaged5/total*100:0;
      const buckets=[
        {label:"Quick · <30s",value:Number(row.bucket_under_30||0)},
        {label:"Browsing · 30s–2m",value:Number(row.bucket_30_119||0)},
        {label:"Engaged · 2–5m",value:Number(row.bucket_120_299||0)},
        {label:"Highly engaged · 5m+",value:Number(row.bucket_300_plus||0)}
      ];
      return `<div class="insights-duration-summary">
          <article><span>2+ Minute Sessions</span><strong>${engaged2.toLocaleString()}</strong><small>${rate2.toFixed(rate2>=10?0:1)}% of tracked sessions</small></article>
          <article><span>5+ Minute Sessions</span><strong>${engaged5.toLocaleString()}</strong><small>${rate5.toFixed(rate5>=10?0:1)}% highly engaged</small></article>
          <article><span>Avg Active Time</span><strong>${appContext.escapeHtml(appContext.formatActiveDuration(avg))}</strong><small>Foreground time only</small></article>
          <article><span>Longest Session</span><strong>${appContext.escapeHtml(appContext.formatActiveDuration(longest))}</strong><small>Within selected period</small></article>
        </div>
        <div class="insights-duration-buckets">
          ${buckets.map(item=>{
            const pct=total?item.value/total*100:0;
            return `<div class="insights-duration-bucket"><span>${appContext.escapeHtml(item.label)}</span><strong>${item.value.toLocaleString()} · ${pct.toFixed(pct>=10?0:1)}%</strong><i><b style="width:${pct}%"></b></i></div>`;
          }).join("")}
        </div>`;
    }

    function renderOverview(){
      const rows=state.visible;
      const websiteVisits=state.websiteSeries.reduce((s,r)=>s+Number(r.visits||0),0);
      const qualifiedViews=rows.reduce((s,r)=>s+Number(r.views||0),0);
      const unique=rows.reduce((s,r)=>s+Number(r.unique_views||0),0);
      const favorites=rows.reduce((s,r)=>s+Number(r.favorite_adds||0),0);
      const contacts=rows.reduce((s,r)=>s+r._contactIntent,0);
      const top=rows.slice().sort((a,b)=>b._interestScore-a._interestScore)[0];
      const contactRate=unique?contacts/unique:0;

      const hottest=rows.slice().sort((a,b)=>b._trend.score-a._trend.score)[0];
      const mostFav=rows.slice().sort((a,b)=>Number(b.favorite_adds||0)-Number(a.favorite_adds||0))[0];
      const mostPhoto=rows.slice().sort((a,b)=>Number(b.overview_photo_interactions||0)-Number(a.overview_photo_interactions||0))[0];
      const mostContact=rows.slice().sort((a,b)=>b._contactIntent-a._contactIntent)[0];

      appContext.$("insightsOverview").innerHTML=`
        <div class="insights-v4-grid-2 insights-v4-traffic-primary">
          <section class="insights-v4-card">
            <div class="insights-v4-card-head table-head">
              <div>
                <h3>Qualified Card Views</h3>
                <span id="insightsQualifiedChartNote">Cards kept open for at least 2 seconds.</span>
              </div>
            </div>
            <div id="insightsChart" class="insights-chart insights-time-chart"></div>
          </section>

          <section class="insights-v4-card">
            <div class="insights-v4-card-head table-head">
              <div>
                <h3>Website Visits</h3>
                <span>Site sessions with Owner Mode excluded.</span>
              </div>
            </div>
            <div id="insightsWebsiteChart" class="insights-chart insights-time-chart"></div>
          </section>

          <section class="insights-v4-card insights-engaged-visits-card">
            <div class="insights-v4-card-head table-head">
              <div>
                <h3>Engaged Visits</h3>
                <span>Sessions with at least 1 Qualified Card View (2+ seconds).</span>
              </div>
            </div>

            ${!state.engagedVisitSupported
              ? `<div class="hint">Run <code>insights-engaged-visits-migration.sql</code> in Supabase to enable this metric.</div>`
              : (()=> {
                  const rawVisits=state.websiteSeries.reduce((sum,r)=>sum+Number(r.visits||0),0);
                  const engaged=state.engagedVisitSeries.reduce((sum,r)=>sum+Number(r.engaged_visits||0),0);
                  const rate=rawVisits?engaged/rawVisits*100:0;

                  return `<div class="insights-engaged-summary">
                    <article><span>Website Visits</span><strong>${rawVisits.toLocaleString()}</strong></article>
                    <article><span>Engaged Visits</span><strong>${engaged.toLocaleString()}</strong></article>
                    <article><span>Engagement Rate</span><strong>${rate.toFixed(rate>=10?0:1)}%</strong></article>
                  </div>
                  ${renderEngagedVisitsComparison(state.websiteSeries,state.engagedVisitSeries)}
                  <div class="hint insights-engaged-note">Raw Website Visits are unchanged. Engaged Visits help separate meaningful browsing from page loads that never produce a 2+ second card view.</div>`;
                })()}
          </section>

          <section class="insights-v4-card insights-duration-card">
            <div class="insights-v4-card-head table-head">
              <div>
                <h3>Session Duration</h3>
                <span>Active foreground time — background tabs and long idle gaps are not counted.</span>
              </div>
            </div>
            ${!state.sessionDurationSupported
              ? `<div class="hint">Run <code>insights-session-duration-migration.sql</code> in Supabase to enable active-time metrics.</div>`
              : renderSessionDurationInsights(state.sessionDurationInsights)}
            <div class="hint insights-engaged-note">A 2+ minute visit is a strong browsing signal; 5+ minutes is classified as highly engaged. This measures active visible-tab time rather than simply elapsed clock time. Active time is saved about every 10 seconds.</div>
          </section>
        </div>

        <section class="insights-v4-card insights-country-card">
          <div class="insights-v4-card-head table-head">
            <div>
              <h3>Visitor Countries</h3>
              <span>Country-level website traffic. IP addresses are not stored.</span>
            </div>
          </div>

          ${
            !state.visitorCountrySupported
              ? `<div class="hint">Country tracking is not installed yet. Deploy the visitor-country migration and Edge Function.</div>`
              : state.visitorCountries.length
                ? `<div class="insights-country-list">
                    ${(()=>{
                      const total=state.visitorCountries.reduce((sum,row)=>sum+Number(row.visits||0),0);
                      const max=Math.max(1,...state.visitorCountries.map(row=>Number(row.visits||0)));

                      return state.visitorCountries.slice(0,12).map(row=>{
                        const visits=Math.max(0,Number(row.visits||0));
                        const pct=total ? Math.round(visits/total*100) : 0;
                        const width=visits ? Math.max(3,visits/max*100) : 0;
                        const label=appContext.visitorCountryName(row.country_code);

                        return `<div class="insights-country-row">
                          <div class="insights-country-name">
                            <strong>${appContext.escapeHtml(label)}</strong>
                            <span>${appContext.escapeHtml(String(row.country_code||"").toUpperCase())}</span>
                          </div>
                          <div class="insights-country-bar"><i style="width:${width}%"></i></div>
                          <div class="insights-country-value">
                            <strong>${visits.toLocaleString()}</strong>
                            <span>${pct}%</span>
                          </div>
                        </div>`;
                      }).join("");
                    })()}
                  </div>`
                : `<div class="hint">No visitor-country data for this period yet.</div>`
          }
        </section>

        <section class="insights-v4-card insights-access-time-card">
          <div class="insights-v4-card-head table-head">
            <div>
              <h3>Visitor Access Time</h3>
              <span>Website visits by local Malaysia/Singapore time (GMT+8).</span>
            </div>
          </div>

          ${
            !state.visitorAccessTimeSupported
              ? `<div class="hint">Access-time analytics is not installed yet. Run <code>insights-access-time-migration.sql</code> in Supabase.</div>`
              : (state.visitorHours.some(row=>Number(row.visits||0)>0) || state.visitorWeekdays.some(row=>Number(row.visits||0)>0))
                ? `${(()=>{
                    const peakHour=busiestVisitorHour(state.visitorHours);
                    const peakDay=busiestVisitorWeekday(state.visitorWeekdays);
                    return `<div class="insights-access-summary">
                      <article>
                        <span>Busiest hour</span>
                        <strong>${appContext.escapeHtml(peakHour?.bucket_label||"—")}</strong>
                        <small>${Number(peakHour?.visits||0).toLocaleString()} visits</small>
                      </article>
                      <article>
                        <span>Busiest day</span>
                        <strong>${appContext.escapeHtml(peakDay?.bucket_label||"—")}</strong>
                        <small>${Number(peakDay?.visits||0).toLocaleString()} visits</small>
                      </article>
                    </div>
                    <div class="insights-access-grid">
                      <div>
                        <div class="insights-access-subhead"><strong>By hour</strong><span>00:00–23:00</span></div>
                        ${renderVisitorHourBars(state.visitorHours)}
                      </div>
                      <div>
                        <div class="insights-access-subhead"><strong>By day</strong><span>Sunday–Saturday</span></div>
                        ${renderVisitorWeekdayBars(state.visitorWeekdays)}
                      </div>
                    </div>`;
                  })()}`
                : `<div class="hint">No website visits for this period yet.</div>`
          }
        </section>

        <section class="insights-v4-card insights-device-card">
          <div class="insights-v4-card-head table-head">
            <div>
              <h3>Device Breakdown</h3>
              <span>Broad device category only. Full browser User-Agent strings are not stored.</span>
            </div>
          </div>

          ${
            !state.visitorDeviceSupported
              ? `<div class="hint">Device analytics is not installed yet. Run <code>insights-device-breakdown-migration.sql</code> in Supabase.</div>`
              : renderVisitorDeviceBreakdown(state.visitorDevices)
          }
        </section>

        <section class="insights-v4-card insights-source-card">
          <div class="insights-v4-card-head table-head">
            <div>
              <h3>Traffic Sources</h3>
              <span>Broad referrer categories only. Full incoming URLs are not stored.</span>
            </div>
          </div>

          ${
            !state.visitorSourceSupported
              ? `<div class="hint">Traffic-source analytics is not installed yet. Run <code>insights-traffic-sources-migration.sql</code> in Supabase.</div>`
              : renderVisitorTrafficSources(state.visitorSources)
          }
        </section>

        <section class="insights-v4-card insights-search-demand-card">
          <div class="insights-v4-card-head table-head">
            <div><h3>Search & Demand</h3><span>What visitors search for in your inventory, including searches that return no cards.</span></div>
          </div>
          ${!state.searchInsightsSupported
            ? `<div class="hint">Search analytics is not installed yet. Run <code>insights-search-demand-migration.sql</code> in Supabase.</div>`
            : renderSearchDemandInsights(state.searchInsights)}
        </section>

        <section class="insights-v4-card insights-returning-card">
          <div class="insights-v4-card-head table-head">
            <div>
              <h3>Returning Visitors & Browsing Depth</h3>
              <span>Anonymous session quality based on the existing visitor ID and 2+ second Qualified Views.</span>
            </div>
          </div>
          ${!state.returningVisitorSupported
            ? `<div class="hint">Session analytics is not installed yet. Run <code>insights-returning-visitors-browsing-depth-migration.sql</code> in Supabase.</div>`
            : renderReturningVisitorInsights(state.returningVisitorInsights)}
        </section>

        <div class="insights-v4-intro">
          <div><strong>At a Glance</strong><span>These are the numbers that matter most for the selected period.</span></div>
          <div class="insights-v4-quality-pill">✓ Owner activity excluded</div>
        </div>

        <div class="insights-v4-kpis">
          <article><span>Website Visits</span><strong>${websiteVisits.toLocaleString()}</strong><small>Site sessions</small></article>
          <article><span>Qualified Views</span><strong>${qualifiedViews.toLocaleString()}</strong><small>Card open 2+ seconds</small></article>
          <article><span>Favorites</span><strong>${favorites.toLocaleString()}</strong><small>Saved by visitors</small></article>
          <article><span>Contact Intent</span><strong>${contacts.toLocaleString()}</strong><small>Estimated buyer contact intent</small></article>
          <article><span>Contact Intent Rate</span><strong>${Math.round(contactRate*100)}%</strong><small>Contact intent ÷ unique views</small></article>
          <article class="highlight"><span>Strongest Interest</span><strong>${top?appContext.escapeHtml(top.name||top._card?.name||"—"):"—"}</strong><small>${top?`${top._interestScore} points`:"No activity"} · revised V184 weighting</small></article>
        </div>

        <div class="insights-v4-grid-2">
          <section class="insights-v4-card">
            <div class="insights-v4-card-head"><h3>Buyer Funnel</h3><span>From traffic to action</span></div>
            ${[
              ["Website visits",websiteVisits],
              ["Qualified card views",qualifiedViews],
              ["Favorites",favorites],
              ["Contact intent",contacts]
            ].map(([label,value],i,all)=>{
              const max=Math.max(1,...all.map(x=>x[1]));
              return `<div class="insights-v4-funnel-row">
                <span>${appContext.escapeHtml(label)}</span>
                <i><b style="width:${Math.max(value?5:0,value/max*100)}%"></b></i>
                <strong>${Number(value).toLocaleString()}</strong>
              </div>`;
            }).join("")}
          </section>

          <section class="insights-v4-card">
            <div class="insights-v4-card-head"><h3>Quick Winners</h3><span>What deserves attention</span></div>
            <div class="insights-v4-winner">
              <span>Fastest rising</span><strong>${hottest&&hottest._trend.score>0?appContext.escapeHtml(hottest.name||"—"):"No clear mover"}</strong>
              <small>${hottest&&hottest._trend.score>0?appContext.escapeHtml(hottest._trend.label):"—"}</small>
            </div>
            <div class="insights-v4-winner">
              <span>Most photo browsed</span><strong>${mostPhoto&&Number(mostPhoto.overview_photo_interactions||0)>0?appContext.escapeHtml(mostPhoto.name||mostPhoto._card?.name||"—"):"No photo interactions yet"}</strong>
              <small>${mostPhoto?`${Number(mostPhoto.overview_photo_interactions||0)} overview photo interaction${Number(mostPhoto.overview_photo_interactions||0)===1?"":"s"}`:"—"}</small>
            </div>
            <div class="insights-v4-winner">
              <span>Most favorited</span><strong>${mostFav&&Number(mostFav.favorite_adds||0)>0?appContext.escapeHtml(mostFav.name||"—"):"No favorites yet"}</strong>
              <small>${mostFav?`${Number(mostFav.favorite_adds||0)} favorites`:"—"}</small>
            </div>
            <div class="insights-v4-winner">
              <span>Most contact intent</span><strong>${mostContact&&mostContact._contactIntent>0?appContext.escapeHtml(mostContact.name||"—"):"No contact intent yet"}</strong>
              <small>${mostContact?`${mostContact._contactIntent} intent${mostContact._contactIntent===1?"":"s"} · ${contactIntentStage(mostContact)}`:"—"}</small>
            </div>
          </section>
        </div>

        <section class="insights-v4-card giveaway-performance-card">
          <div class="insights-v4-card-head">
            <div>
              <h3>Giveaway Performance</h3>
              <span>Measures whether giveaway visitors continue into your social pages, entry form and collection.</span>
            </div>
          </div>

          ${state.giveawayPerformanceSupported ? (()=>{
            const p=state.giveawayPerformance||{};
            const pageVisits=Math.max(0,Number(p.page_visits||0));
            const entryClicks=Math.max(0,Number(p.entry_clicks||0));
            const entryRate=pageVisits ? entryClicks/pageVisits*100 : 0;
            return `
              <div class="giveaway-performance-kpis">
                <article><span>Giveaway Page Visits</span><strong>${pageVisits.toLocaleString()}</strong></article>
                <article><span>Entry Clicks</span><strong>${entryClicks.toLocaleString()}</strong></article>
                <article><span>Entry Click Rate</span><strong>${entryRate.toFixed(1)}%</strong></article>
                <article><span>Unique Visitors</span><strong>${Number(p.unique_visitors||0).toLocaleString()}</strong></article>
              </div>
              <div class="giveaway-performance-actions">
                <div><span>Instagram</span><strong>${Number(p.instagram_clicks||0).toLocaleString()}</strong></div>
                <div><span>Facebook</span><strong>${Number(p.facebook_clicks||0).toLocaleString()}</strong></div>
                <div><span>Comment</span><strong>${Number(p.comment_clicks||0).toLocaleString()}</strong></div>
                <div><span>Inventory</span><strong>${Number(p.inventory_clicks||0).toLocaleString()}</strong></div>
                <div><span>Collection</span><strong>${Number(p.collection_clicks||0).toLocaleString()}</strong></div>
                <div><span>FB Share +1</span><strong>${Number(p.bonus_facebook_share_clicks||0).toLocaleString()}</strong></div>
                <div><span>Tag Friends +1</span><strong>${Number(p.bonus_tag_friends_clicks||0).toLocaleString()}</strong></div>
                <div><span>IG Story +1</span><strong>${Number(p.bonus_instagram_story_clicks||0).toLocaleString()}</strong></div>
              </div>
            `;
          })() : `<div class="hint">Run <code>giveaway-growth-upgrade-migration.sql</code> to enable Giveaway Performance analytics.</div>`}
        </section>

        <section class="insights-v4-card insights-recent-qualified-card">
          <div class="insights-v4-card-head table-head">
            <div>
              <h3>Recently Viewed Cards</h3>
              <span>Latest unique cards with a 2+ second Qualified Card View in this Insights period.</span>
            </div>
            ${state.recentQualifiedViewsSupported
              ? `<span class="insights-recent-qualified-count">${state.recentQualifiedViews.length} shown</span>`
              : ""}
          </div>

          ${
            !state.recentQualifiedViewsSupported
              ? `<div class="hint">Run <code>insights-recently-viewed-cards-migration.sql</code> in Supabase to enable this section.</div>`
              : state.recentQualifiedViews.length
                ? `<div class="insights-recent-qualified-list">
                    ${state.recentQualifiedViews.map(row=>{
                      const card=appContext.getCardById(row.card_id);
                      if(!card) return "";

                      const image=appContext.getImages(card)[0]||"";
                      const views=Math.max(0,Number(row.views_in_period||0));
                      const visitors=Math.max(0,Number(row.unique_visitors||0));
                      const meta=appContext.insightRecentCardMeta(card);

                      return `<button type="button"
                                      class="insights-recent-qualified-item"
                                      data-insights-open-card="${appContext.escapeHtml(card.id)}"
                                      aria-label="${appContext.escapeHtml(`Open details for ${card.name||"card"}`)}">
                        <span class="insights-recent-qualified-image">
                          ${image
                            ? `<img src="${appContext.escapeHtml(image)}" alt="" loading="lazy" decoding="async">`
                            : `<i aria-hidden="true">TCG</i>`}
                        </span>
                        <span class="insights-recent-qualified-copy">
                          <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
                          ${meta ? `<small>${appContext.escapeHtml(meta)}</small>` : ""}
                          <span>${appContext.escapeHtml(appContext.insightRecentViewTimeLabel(row.viewed_at))}</span>
                        </span>
                        <span class="insights-recent-qualified-stats">
                          <strong>${views.toLocaleString()}</strong>
                          <small>${views===1?"view":"views"} · ${visitors.toLocaleString()} ${visitors===1?"visitor":"visitors"}</small>
                        </span>
                      </button>`;
                    }).join("")}
                  </div>`
                : `<div class="hint">No Qualified Card Views match the selected period and filters yet.</div>`
          }
        </section>

        <section class="insights-v4-card">
          <div class="insights-v4-card-head table-head insights-top-card-head">
            <div><h3>Top Card Performance</h3><span>Photo interactions capture deliberate overview browsing; Detail Opens remain a secondary signal.</span></div>
            <label class="insights-top-card-limit">
              <span>Show</span>
              <select id="insightsTopCardLimit" aria-label="Number of Top Card Performance rows">
                ${["15","30","50","all"].map(value=>`<option value="${value}" ${topCardPerformanceLimit===value?"selected":""}>${value==="all"?"All":value}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="insights-table-wrap">
            <table class="insights-table insights-v4-table">
              <thead><tr><th>#</th><th>Card</th><th>Status</th><th>Photo</th><th>Detail</th><th>Fav</th><th>Contact intent</th><th>Score</th><th>Trend</th></tr></thead>
              <tbody>${(()=>{
                const ranked=rows.slice().sort((a,b)=>b._interestScore-a._interestScore);
                const shown=topCardPerformanceLimit==="all"
                  ? ranked
                  : ranked.slice(0,Math.max(1,Number(topCardPerformanceLimit)||15));
                return shown.map((row,i)=>`
                <tr>
                  <td>${i+1}</td>
                  <td class="insights-card-name">
                    <button type="button"
                            class="insights-card-link"
                            data-insights-open-card="${appContext.escapeHtml(row._card?.id||row.card_id||"")}"
                            aria-label="${appContext.escapeHtml(`Open details for ${row.name||row._card?.name||"card"}`)}">
                      <strong>${appContext.escapeHtml(row.name||row._card?.name||"")}</strong>
                    ${(()=>{
                      const card=row._card||{};
                      const details=[];
                      const format=appContext.normalizeFilterValue(card.format);
                      const condition=String(card.condition||"").trim();
                      const grades=appContext.validGradingEntries(card);

                      if(format==="sealed"){
                        details.push("Sealed");
                      }else if(grades.length){
                        const labels=[...new Set(grades.map(entry=>{
                          const company=String(entry?.company||"").trim().toUpperCase();
                          const grade=String(entry?.grade||"").trim();
                          return [company,grade].filter(Boolean).join(" ");
                        }).filter(Boolean))];
                        if(labels.length) details.push(labels.join(" · "));
                      }else if(condition){
                        details.push(condition);
                      }else if(format){
                        details.push(format.charAt(0).toUpperCase()+format.slice(1));
                      }

                      return details.length
                        ? `<small class="insights-card-grade-condition">${appContext.escapeHtml(details.join(" · "))}</small>`
                        : "";
                    })()}
                    </button>
                  </td>
                  <td><span class="insights-status-tag">${appContext.escapeHtml(row._status)}</span></td>
                  <td title="Overview photo interaction">${Number(row.overview_photo_interactions||0)}</td>
                  <td title="Unique Card Detail opens">${Number(row.unique_views||0)}</td>
                  <td>${Number(row.favorite_adds||0)}</td>
                  <td title="${appContext.escapeHtml(contactIntentStage(row))}">${row._contactIntent}</td><td><strong class="insights-v3-score">${row._interestScore}</strong></td>
                  <td><span class="trend-tag ${row._trend.className}">${appContext.escapeHtml(row._trend.label)}</span></td>
                </tr>`).join("") || `<tr><td colspan="9" class="hint">No activity for this period.</td></tr>`;
              })()}
              </tbody>
            </table>
          </div>
        </section>

      `;

      function insightsAxisConfig(rawMax){
        const value=Math.max(0,Math.ceil(Number(rawMax||0)));

        // Small integer counts need integer ticks only.
        if(value<=5){
          const axisMax=Math.max(1,value);
          const ticks=[];
          for(let n=axisMax;n>=0;n-=1){
            ticks.push({
              value:n,
              pct:(axisMax-n)/axisMax*100
            });
          }
          return {axisMax,ticks};
        }

        // Use a tighter "nice" scale so the tallest bar makes better use
        // of the chart height. Aim for roughly 10–18% headroom instead of
        // jumping from values like 51 straight to an axis max of 100.
        const target=value*1.14;
        const magnitude=Math.pow(10,Math.floor(Math.log10(target)));
        const normalized=target/magnitude;

        let nice;
        if(normalized<=1) nice=1;
        else if(normalized<=1.2) nice=1.2;
        else if(normalized<=1.5) nice=1.5;
        else if(normalized<=2) nice=2;
        else if(normalized<=2.5) nice=2.5;
        else if(normalized<=3) nice=3;
        else if(normalized<=4) nice=4;
        else if(normalized<=5) nice=5;
        else if(normalized<=6) nice=6;
        else if(normalized<=8) nice=8;
        else nice=10;

        const axisMax=Math.max(1,nice*magnitude);
        const tickCount=4;
        const ticks=Array.from({length:tickCount+1},(_,index)=>({
          value:Math.round(axisMax*(tickCount-index)/tickCount),
          pct:index/tickCount*100
        }));

        return {axisMax,ticks};
      }

      function renderClassicTrafficBars(id,series,key,site=false){
        const mount=appContext.$(id);
        if(!mount) return;

        const safeSeries=Array.isArray(series)?series:[];
        if(!safeSeries.length){
          const isQualifiedChart=id==="insightsChart";
          const filtered=!!(statusSel?.value || gameSel?.value);
          mount.innerHTML=`<div class="hint">${
            isQualifiedChart && filtered
              ? "No qualified views recorded for this filter yet."
              : "No data yet."
          }</div>`;
          return;
        }

        const rawMax=Math.max(0,...safeSeries.map(row=>Number(row[key]||0)));
        const {axisMax,ticks}=insightsAxisConfig(rawMax);

        mount.innerHTML=`
          <div class="insights-axis-chart">
            <div class="insights-y-axis" aria-hidden="true">
              ${ticks.map(tick=>`
                <span style="top:${tick.pct}%">${tick.value.toLocaleString()}</span>
              `).join("")}
            </div>

            <div class="insights-axis-plot">
              <div class="insights-y-grid" aria-hidden="true">
                ${ticks.map(tick=>`
                  <i style="top:${tick.pct}%"></i>
                `).join("")}
              </div>

              <div class="insights-axis-bars">
                ${safeSeries.map(row=>{
                  const value=Math.max(0,Number(row[key]||0));
                  const pct=axisMax ? value/axisMax*100 : 0;

                  // Keep only a small amount of headroom for value labels.
                  // The tighter y-axis above already prevents bars from touching
                  // the chart ceiling.
                  const visualPct=Math.max(value?2:0,pct*0.95);

                  const hoverLabel=String(row.label||row.bucket||"");
                  return `<div class="insights-bar-wrap" title="${appContext.escapeHtml(hoverLabel)}: ${value}">
                    <div class="insights-bar-stack">
                      <div class="insights-bar-value" style="bottom:calc(${visualPct}% + 5px)">${value.toLocaleString()}</div>
                      <div class="insights-bar ${site?"insights-bar-site":""}" style="height:${visualPct}%"></div>
                    </div>
                    <div class="insights-bar-label">${appContext.escapeHtml(String(row.label||row.bucket))}</div>
                  </div>`;
                }).join("")}
              </div>
            </div>
          </div>
        `;
      }

      renderClassicTrafficBars("insightsChart",state.series,"views");
      const websiteChartRows=(Array.isArray(state.websiteSeries) &&
        state.websiteSeries.some(row=>Number(row.visits||0)>0))
        ? state.websiteSeries
        : [];

      renderClassicTrafficBars("insightsWebsiteChart",websiteChartRows,"visits",true);

      const chartNote=appContext.$("insightsQualifiedChartNote");
      if(chartNote){
        const parts=[];
        if(statusSel.value) parts.push(statusSel.value);
        if(gameSel.value) parts.push(gameSel.value);

        if(!state.filteredSeriesSupported){
          chartNote.textContent="Run the V5 migration to enable fresh qualified-view analytics";
        }else if(parts.length){
          chartNote.textContent=state.series.length
            ? `Fresh filtered timeline · ${parts.join(" · ")}`
            : `No qualified views yet for ${parts.join(" · ")}`;
        }else{
          chartNote.textContent=state.series.length
            ? "Fresh qualified views · 2+ seconds"
            : "No qualified views recorded since the analytics reset";
        }
      }

      appContext.$("insightsOverview")?.querySelectorAll("[data-insights-open-card]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const cardId=String(btn.dataset.insightsOpenCard||"").trim();
          if(!cardId) return;
          appContext.openInsightsCardDetails(cardId);
        });
      });

      appContext.$("insightsTopCardLimit")?.addEventListener("change",e=>{
        const value=String(e.target.value||"15").toLowerCase();
        topCardPerformanceLimit=["15","30","50","all"].includes(value)?value:"15";
        renderOverview();
      });
    }

    function renderRecommendations(){
      const recs=state.visible.map(recommendationFor).filter(Boolean);
      const rank={high:3,medium:2,good:1};
      recs.sort((a,b)=>rank[b.level]-rank[a.level]);

      appContext.$("insightsRecommendations").innerHTML=`
        <div class="insights-v4-tab-title">
          <div><h3>Recommended Actions</h3><p>Use these as prompts to review a listing — not automatic pricing decisions.</p></div>
          <span>${recs.length} signals</span>
        </div>

        <div class="insights-v4-rec-summary">
          <article><strong>${recs.filter(r=>r.type==="Review price / confidence").length}</strong><span>Review price/confidence</span></article>
          <article><strong>${recs.filter(r=>r.type==="Promote now").length}</strong><span>Promote now</span></article>
          <article><strong>${recs.filter(r=>r.type==="Strong demand").length}</strong><span>Strong demand</span></article>
          <article><strong>${recs.filter(r=>r.type==="Stale inventory").length}</strong><span>Stale inventory</span></article>
        </div>

        <div class="insights-v4-rec-list">
          ${recs.length?recs.map(rec=>`
            <article class="insights-v4-rec ${rec.level}">
              <div class="insights-v4-rec-type">${appContext.escapeHtml(rec.type)}</div>
              <h4>${appContext.escapeHtml(rec.card.name)}</h4>
              <p>${appContext.escapeHtml(rec.reason)}</p>
              <div><strong>Suggested action</strong><span>${appContext.escapeHtml(rec.action)}</span></div>
              <button type="button" class="btn-ghost" data-insights-open-card="${appContext.escapeHtml(rec.card.id)}">Open card</button>
            </article>`).join(""):`<div class="insights-v4-good-empty"><strong>No major action signals.</strong><span>Nothing in the selected period currently stands out as needing review.</span></div>`}
        </div>
      `;

      appContext.$("insightsRecommendations").querySelectorAll("[data-insights-open-card]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const card=appContext.getCardById(btn.dataset.insightsOpenCard);
          if(card) appContext.openCardRoute(card.id);
        });
      });
    }

    async function renderHistoryTab(){
      const mount=appContext.$("insightsHistory");
      if(!mount) return;

      if(!state.editHistoryLoaded){
        mount.innerHTML=`<div class="insights-v4-loading-card">Loading card history…</div>`;
        state.editHistoryRows=appContext.editHistorySupported ? await appContext.fetchEditHistory() : [];
        state.editHistoryLoaded=true;
      }

      const candidates=appContext.cards
        .filter(card=>appContext.cardLifecycle(card)!=="archived")
        .slice()
        .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));

      const existing=mount.querySelector("#insightsHistoryCard")?.value||"";
      const selected=existing && candidates.some(c=>String(c.id)===existing)
        ? existing
        : String(candidates[0]?.id||"");

      mount.innerHTML=`
        <div class="insights-v4-tab-title">
          <div><h3>Card History</h3><p>Review listing changes together with current buyer-interest signals.</p></div>
        </div>

        <div class="insights-v4-history-picker">
          <label><span>Select card</span>
            <select id="insightsHistoryCard">
              ${candidates.map(card=>`<option value="${appContext.escapeHtml(card.id)}" ${String(card.id)===selected?"selected":""}>${appContext.escapeHtml(card.name)}${card.card_code?` · ${appContext.escapeHtml(card.card_code)}`:""}</option>`).join("")}
            </select>
          </label>
        </div>
        <div id="insightsHistoryDetail"></div>
      `;

      function drawCardHistory(){
        const id=appContext.$("insightsHistoryCard")?.value||"";
        const card=appContext.getCardById(id);
        const detail=appContext.$("insightsHistoryDetail");
        if(!detail||!card) return;

        const insight=state.rows.find(row=>String(row.card_id||row.id||"")===String(card.id));
        const history=state.editHistoryRows
          .filter(row=>String(row.card_id||"")===String(card.id))
          .slice()
          .sort((a,b)=>new Date(b.edited_at)-new Date(a.edited_at));

        const priceEvents=[];
        history.forEach(row=>{
          const before=row.before_data||{};
          const after=row.after_data||{};
          const currencies=[
            ["MYR","price_myr"],["USD","price_usd"],["SGD","price_sgd"]
          ];
          currencies.forEach(([label,key])=>{
            const bv=before[key];
            const av=after[key];
            if(String(bv??"")!==String(av??"") && (bv!=null || av!=null)){
              priceEvents.push({
                at:row.edited_at,
                text:`${label}: ${bv==null?"—":bv} → ${av==null?"—":av}`
              });
            }
          });
        });

        detail.innerHTML=`
          <div class="insights-v4-history-summary">
            <article><span>Current price</span><strong>${appContext.cardUsdListedPrice(card)!=null?appContext.fmtMoney(appContext.cardUsdListedPrice(card)):"—"}</strong></article>
            <article><span>Unique views</span><strong>${Number(insight?.unique_views||0)}</strong></article>
            <article><span>Favorites</span><strong>${Number(insight?.favorite_adds||0)}</strong></article>
            <article><span>Contact intent</span><strong>${insight?contactIntentCount(insight):0}</strong></article>
          </div>

          <div class="insights-v4-grid-2">
            <section class="insights-v4-card">
              <div class="insights-v4-card-head"><h3>Price Changes</h3><span>From owner edit history</span></div>
              <div class="insights-v4-timeline">
                ${priceEvents.length?priceEvents.slice(0,20).map(ev=>`
                  <div><i></i><span>${appContext.escapeHtml(appContext.formatOwnerTimestamp(ev.at))}</span><strong>${appContext.escapeHtml(ev.text)}</strong></div>`
                ).join(""):`<div class="hint">${appContext.editHistorySupported?"No recorded price changes in the recent history window.":"Edit History migration is not installed."}</div>`}
              </div>
            </section>

            <section class="insights-v4-card">
              <div class="insights-v4-card-head"><h3>Listing Activity</h3><span>Recent owner changes</span></div>
              <div class="insights-v4-timeline">
                ${history.length?history.slice(0,20).map(row=>`
                  <div><i></i><span>${appContext.escapeHtml(appContext.formatOwnerTimestamp(row.edited_at))}</span>
                    <strong>${appContext.escapeHtml(appContext.historyChangedFields(row).join(", ")||"Listing updated")}</strong></div>`
                ).join(""):`<div class="hint">No recent edit-history entries for this card.</div>`}
              </div>
            </section>
          </div>
        `;
      }

      appContext.$("insightsHistoryCard")?.addEventListener("change",drawCardHistory);
      drawCardHistory();
    }

    function renderSales(){
      const snapshots=state.saleSnapshots.slice().sort((a,b)=>new Date(b.sold_at)-new Date(a.sold_at));
      const soldCards=appContext.cards.filter(card=>appContext.normalizeFilterValue(card.availability)==="sold");
      const snapshotAvg=snapshots.length
        ? snapshots.reduce((s,r)=>s+Number(r.days_listed||0),0)/snapshots.length
        : null;

      const contactConverters=snapshots.filter(r=>Number(r.contact_actions||0)>0).length;
      const favoriteConverters=snapshots.filter(r=>Number(r.favorite_adds||0)>0).length;

      appContext.$("insightsSales").innerHTML=`
        <div class="insights-v4-tab-title">
          <div><h3>Sales & Conversion</h3><p>See what buyer activity existed at the moment a listing was marked Sold.</p></div>
        </div>

        ${state.saleSnapshotsSupported
          ? `<div class="insights-v4-backend-ok"><strong>Sale snapshots connected</strong><span>Future Mark Sold actions preserve the conversion state automatically.</span></div>`
          : `<div class="insights-v4-backend-needed"><strong>Install the V4 migration</strong><span>Run the supplied migration to begin preserving conversion snapshots when cards sell.</span></div>`}

        <div class="insights-v4-kpis compact">
          <article><span>Sold listings</span><strong>${soldCards.length}</strong><small>Currently marked Sold</small></article>
          <article><span>Snapshots captured</span><strong>${snapshots.length}</strong><small>Since V4 tracking</small></article>
          <article><span>Avg. days to sale</span><strong>${snapshotAvg==null?"—":Math.round(snapshotAvg)}</strong><small>Snapshot data</small></article>
          <article><span>Had contact intent</span><strong>${snapshots.length?Math.round(contactConverters/snapshots.length*100):0}%</strong><small>Before sale</small></article>
          <article><span>Had favorite</span><strong>${snapshots.length?Math.round(favoriteConverters/snapshots.length*100):0}%</strong><small>Before sale</small></article>
        </div>

        <section class="insights-v4-card">
          <div class="insights-v4-card-head"><h3>Recent Sale Snapshots</h3><span>V184+ snapshots store Contact Intent; older snapshots may contain the previous stacked contact-action count.</span></div>
          <div class="insights-table-wrap">
            <table class="insights-table insights-v4-table">
              <thead><tr><th>Sold</th><th>Card</th><th>Price</th><th>Days</th><th>Unique</th><th>Fav</th><th>Contact intent</th><th>Score</th></tr></thead>
              <tbody>${snapshots.length?snapshots.slice(0,50).map(row=>`
                <tr>
                  <td>${appContext.escapeHtml(new Date(row.sold_at).toLocaleDateString())}</td>
                  <td class="insights-card-name">${appContext.escapeHtml(row.card_name||"Card")}</td>
                  <td>${row.price_usd!=null?appContext.fmtMoney(row.price_usd):"—"}</td>
                  <td>${row.days_listed??"—"}</td>
                  <td>${row.unique_views||0}</td><td>${row.favorite_adds||0}</td>
                  <td>${row.contact_actions||0}</td><td><strong class="insights-v3-score">${row.interest_score||0}</strong></td>
                </tr>`).join(""):`<tr><td colspan="8" class="hint">No sale snapshots yet. New sales will appear here after the V4 migration is installed.</td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
      `;
    }

    function renderHealthTab(){
      const health=appContext.$("insightsHealth");
      if(!health) return;

      const checks=[
        {
          label:"Qualified card views",
          ok:state.rows!==null,
          note:"2-second qualification · no frontend repeat-view cooldown"
        },
        {
          label:"Website visits",
          ok:Array.isArray(state.websiteSeries),
          note:"One visit per browser session; Owner Mode excluded"
        },
        {
          label:"Engaged visits",
          ok:state.engagedVisitSupported,
          note:state.engagedVisitSupported
            ?"Session has at least one 2-second Qualified Card View"
            :"Run Engaged Visits migration"
        },
        {
          label:"Overview photo interest",
          ok:state.overviewPhotoSupported,
          note:state.overviewPhotoSupported
            ?"One deliberate image change per card per browser session"
            :"Run Overview Photo Interest migration"
        },
        {
          label:"Recently viewed cards",
          ok:state.recentQualifiedViewsSupported,
          note:state.recentQualifiedViewsSupported
            ?"Latest qualified-view timestamps available"
            :"Run Recently Viewed Cards migration"
        },
        {
          label:"Giveaway performance",
          ok:state.giveawayPerformanceSupported,
          note:state.giveawayPerformanceSupported
            ?"Giveaway page + CTA click funnel active"
            :"Run Giveaway Growth migration"
        },
        {
          label:"Buyer-intent events",
          ok:state.engagementSupported,
          note:state.engagementSupported?"Favorites, contacts, shares and image actions connected":"Run V4 migration"
        },
        {
          label:"Sale conversion snapshots",
          ok:state.saleSnapshotsSupported,
          note:state.saleSnapshotsSupported?"Future sales preserve conversion state":"Run V4 migration"
        },
        {
          label:"Listing edit history",
          ok:appContext.editHistorySupported,
          note:appContext.editHistorySupported?"Price/listing change history available":"Owner edit-history migration required"
        },
        {
          label:"Sold date tracking",
          ok:appContext.soldAtSupported,
          note:appContext.soldAtSupported?"sold_at available":"sold_at migration/trigger required"
        }
      ];

      const good=checks.filter(c=>c.ok).length;
      health.innerHTML=`
        <div class="insights-v4-tab-title">
          <div><h3>Analytics Health</h3><p>A quick confidence check before making decisions from the dashboard.</p></div>
          <span>${good}/${checks.length} healthy</span>
        </div>

        <div class="insights-v4-health-score ${good===checks.length?"all-good":""}">
          <strong>${Math.round(good/checks.length*100)}%</strong>
          <div><span>Analytics readiness</span><small>${good===checks.length?"All tracked systems are available.":"Some optional analytics components still need setup."}</small></div>
        </div>

        <div class="insights-v4-health-list">
          ${checks.map(check=>`
            <article class="${check.ok?"ok":"warn"}">
              <i>${check.ok?"✓":"!"}</i>
              <div><strong>${appContext.escapeHtml(check.label)}</strong><span>${appContext.escapeHtml(check.note)}</span></div>
            </article>`).join("")}
        </div>

        <section class="insights-v4-card health-notes">
          <h3>How to read the numbers</h3>
          <p><strong>Unique views</strong> are unique browser identifiers, not guaranteed unique people. A person using multiple devices or clearing site storage may count more than once.</p>
          <p><strong>Recommendations</strong> are signals for review, not automatic market valuations. They use activity on your own site and do not know external market prices.</p>
          <p><strong>Old analytics</strong> collected before the qualified-view update may contain more repeated opens than new data.</p>
        </section>

        <section class="insights-v4-card analytics-device-exclusion-card">
          <div class="insights-v4-card-head table-head">
            <div>
              <h3>Exclude My Mobile Browser / App</h3>
              <span>Pair the exact browser or installed website app you personally use.</span>
            </div>
          </div>

          <p class="hint">
            Generate a reusable 1-year QR code on this owner-authenticated desktop and scan it with your phone.
            The browser or installed web app that actually opens the scanned link will exclude itself automatically.
          </p>

          <div class="analytics-exclusion-actions">
            <button type="button" class="btn-primary" id="generateAnalyticsExclusionCodeBtn">Generate 1-Year QR</button>
          </div>

          <div class="analytics-pairing-code-output analytics-pairing-qr-output" id="analyticsPairingCodeOutput" hidden>
            <div class="analytics-qr-wrap">
              <div class="analytics-qr-canvas" id="analyticsExclusionQr" aria-label="Analytics exclusion QR code"></div>
            </div>
            <div class="analytics-qr-copy">
              <span>1-YEAR REUSABLE CODE</span>
              <strong id="analyticsGeneratedPairingCode">—</strong>
              <small>Scan with your phone. The browser/app that opens the link will be excluded from Insights.</small>
              <div class="analytics-qr-actions">
                <button type="button" class="btn-ghost" id="copyAnalyticsPairingCodeBtn">Copy Code</button>
                <button type="button" class="btn-ghost" id="copyAnalyticsExclusionUrlBtn">Copy QR Link</button>
              </div>
            </div>
          </div>

          <div class="analytics-exclusion-note">
            <strong>How long does the exclusion last?</strong>
            <span>The same pairing code can be reused across your browsers/PWAs for 1 year. After a browser/PWA is paired successfully, its exclusion stays indefinitely. Pair it again only if you clear its site data or reinstall/reset that app.</span>
          </div>
        </section>
      `;

      const exclusionGenerateBtn=appContext.$("generateAnalyticsExclusionCodeBtn");
      const exclusionOutput=appContext.$("analyticsPairingCodeOutput");
      const exclusionCode=appContext.$("analyticsGeneratedPairingCode");
      const exclusionQr=appContext.$("analyticsExclusionQr");
      const exclusionCopyBtn=appContext.$("copyAnalyticsPairingCodeBtn");
      const exclusionUrlCopyBtn=appContext.$("copyAnalyticsExclusionUrlBtn");
      let currentExclusionQrUrl="";

      exclusionGenerateBtn?.addEventListener("click",async()=>{
        const original=exclusionGenerateBtn.textContent;
        exclusionGenerateBtn.disabled=true;
        exclusionGenerateBtn.textContent="Generating…";

        try{
          const code=await appContext.createAnalyticsExclusionPairingCode();
          if(!code){
            appContext.showToast("Run the pairing-code migration first");
            return;
          }

          currentExclusionQrUrl=appContext.analyticsExclusionPairingUrl(code);
          exclusionCode.textContent=code;
          exclusionOutput.hidden=false;

          if(exclusionQr){
            exclusionQr.innerHTML="";
            if(typeof QRCode==="function"){
              new QRCode(exclusionQr,{
                text:currentExclusionQrUrl,
                width:220,
                height:220,
                colorDark:"#111111",
                colorLight:"#ffffff",
                correctLevel:QRCode.CorrectLevel.M
              });
            }else{
              exclusionQr.innerHTML=`<div class="hint">QR library could not load. Use Copy QR Link instead.</div>`;
            }
          }

          appContext.showToast("1-year exclusion QR created");
        }finally{
          exclusionGenerateBtn.disabled=false;
          exclusionGenerateBtn.textContent=original;
        }
      });

      exclusionCopyBtn?.addEventListener("click",()=>{
        const code=String(exclusionCode?.textContent||"").trim();
        if(!code || code==="—") return;
        appContext.copyPlainText(code,"Pairing code copied");
      });

      exclusionUrlCopyBtn?.addEventListener("click",()=>{
        if(!currentExclusionQrUrl) return;
        appContext.copyPlainText(currentExclusionQrUrl,"QR exclusion link copied");
      });
    }

    async function refresh(){
      loading.hidden=false;

      let startDate,endDate;
      if(rangeSel.value==="custom"){
        startDate=startInput.value?new Date(startInput.value+"T00:00:00"):new Date();
        endDate=endInput.value?new Date(endInput.value+"T23:59:59.999"):new Date();
      }else{
        ({start:startDate,end:endDate}=appContext.dateRangeForPreset(rangeSel.value));
      }

      if(endDate<startDate){
        loading.textContent="End date must be on or after the start date.";
        return;
      }

      const previousRange=appContext.previousInsightsRange(startDate,endDate,rangeSel.value);

      const selectedStatus=statusSel.value;
      const selectedGame=gameSel.value;

      const [views,series,siteSeries,countryResult,accessTimeResult,deviceResult,sourceResult,searchResult,returningResult,sessionDurationResult,engagedVisitResult,overviewPhotoResult,recentQualifiedResult,giveawayPerformanceResult,previous,engagement,saleSnapshots,filteredSeriesResult]=await Promise.all([
        appContext.fetchInsights(startDate,endDate),
        appContext.fetchViewSeries(startDate,endDate),
        appContext.fetchWebsiteVisitSeries(startDate,endDate),
        appContext.fetchWebsiteVisitCountries(startDate,endDate),
        appContext.fetchWebsiteVisitAccessTime(startDate,endDate),
        appContext.fetchWebsiteVisitDevices(startDate,endDate),
        appContext.fetchWebsiteVisitSources(startDate,endDate),
        appContext.fetchInventorySearchInsights(startDate,endDate),
        appContext.fetchReturningVisitorInsights(startDate,endDate),
        appContext.fetchSessionDurationInsights(startDate,endDate),
        appContext.fetchEngagedVisitSeries(startDate,endDate),
        appContext.fetchOverviewPhotoInsights(startDate,endDate),
        appContext.fetchRecentQualifiedCardViews(startDate,endDate,selectedStatus,selectedGame,20),
        appContext.fetchGiveawayPerformance(startDate,endDate),
        previousRange?appContext.fetchInsights(previousRange.start,previousRange.end,{silent:true}):Promise.resolve([]),
        appContext.fetchCardEngagementInsights(startDate,endDate),
        appContext.fetchSaleConversionSnapshots(),
        appContext.fetchFilteredQualifiedViewSeries(startDate,endDate,selectedStatus,selectedGame)
      ]);

      const engagementMap=new Map(engagement.rows.map(row=>[String(row.card_id||""),row]));
      const overviewPhotoMap=new Map(
        (overviewPhotoResult.rows||[]).map(row=>[String(row.card_id||""),row])
      );
      const previousMap=new Map(previous.map(row=>[appContext.insightRowKey(row),row]));

      let rows=views.map(row=>{
        const card=appContext.insightCardForRow(row);
        const id=String(row.card_id||card?.id||"");
        const e=engagementMap.get(id)||emptyEngagement();
        const photo=overviewPhotoMap.get(id)||{};
        const combined={
          ...row,
          ...e,
          overview_photo_interactions:Number(photo.photo_interactions||0),
          overview_photo_visitors:Number(photo.unique_visitors||0)
        };
        return {
          ...combined,
          _card:card,
          _status:appContext.insightStatusLabel(row),
          _trend:previousRange
            ? appContext.insightTrendMeta(row,previousMap.get(appContext.insightRowKey(row)))
            : {className:"",label:"—",score:0,current:Number(row.unique_views||0),previous:0,pct:null},
          _contactIntent:contactIntentCount(combined),
          _interestScore:appContext.insightInterestScore(combined),
          _daysListed:cardDaysListed(card)
        };
      });

      // Engagement-only cards may have actions but no qualified view row yet.
      engagement.rows.forEach(e=>{
        if(rows.some(row=>String(row.card_id||row._card?.id||"")===String(e.card_id||""))) return;
        const card=appContext.getCardById(e.card_id);
        if(!card) return;
        const photo=overviewPhotoMap.get(String(e.card_id||""))||{};
        const combined={
          card_id:e.card_id,name:card.name,game:card.game,views:0,unique_views:0,...e,
          overview_photo_interactions:Number(photo.photo_interactions||0),
          overview_photo_visitors:Number(photo.unique_visitors||0)
        };
        rows.push({
          ...combined,
          _card:card,_status:appContext.insightStatusLabel(combined),
          _trend:{className:"",label:"—",score:0,current:0,previous:0,pct:null},
          _contactIntent:contactIntentCount(combined),
          _interestScore:appContext.insightInterestScore(combined),
          _daysListed:cardDaysListed(card)
        });
      });

      // Cards can have deliberate overview-photo activity without a Detail Open
      // or another engagement event, so include those cards too.
      (overviewPhotoResult.rows||[]).forEach(photo=>{
        const id=String(photo.card_id||"");
        if(!id || rows.some(row=>String(row.card_id||row._card?.id||"")===id)) return;
        const card=appContext.getCardById(id);
        if(!card) return;

        const combined={
          card_id:id,name:card.name,game:card.game,views:0,unique_views:0,
          ...emptyEngagement(),
          overview_photo_interactions:Number(photo.photo_interactions||0),
          overview_photo_visitors:Number(photo.unique_visitors||0)
        };

        rows.push({
          ...combined,
          _card:card,_status:appContext.insightStatusLabel(combined),
          _trend:{className:"",label:"—",score:0,current:0,previous:0,pct:null},
          _contactIntent:0,
          _interestScore:appContext.insightInterestScore(combined),
          _daysListed:cardDaysListed(card)
        });
      });

      syncGameOptions(rows);

      state={
        ...state,
        start:startDate,end:endDate,rows,
        // Fresh-start analytics: use only the V5 per-card qualified-view
        // timeline. Legacy historical series is intentionally not mixed in.
        series:filteredSeriesResult.supported ? filteredSeriesResult.rows : [],
        seriesFiltered:filteredSeriesResult.supported,
        seriesUsingHistoricalFallback:false,
        filteredSeriesSupported:filteredSeriesResult.supported,
        // Website Visits has its own MY/SG (UTC+8) daily buckets.
        // Do not align it to Qualified View buckets, because that can shift
        // local 9/4 visits into a 9/3 UTC bucket.
        websiteSeries:Array.isArray(siteSeries) ? siteSeries : [],
        visitorCountries:countryResult.supported && Array.isArray(countryResult.rows)
          ? countryResult.rows
          : [],
        visitorCountrySupported:countryResult.supported,
        visitorHours:accessTimeResult.supported && Array.isArray(accessTimeResult.hours)
          ? accessTimeResult.hours
          : [],
        visitorWeekdays:accessTimeResult.supported && Array.isArray(accessTimeResult.weekdays)
          ? accessTimeResult.weekdays
          : [],
        visitorAccessTimeSupported:accessTimeResult.supported,
        visitorDevices:deviceResult.supported && Array.isArray(deviceResult.rows)
          ? deviceResult.rows
          : [],
        visitorDeviceSupported:deviceResult.supported,
        visitorSources:sourceResult.supported && Array.isArray(sourceResult.rows)
          ? sourceResult.rows
          : [],
        visitorSourceSupported:sourceResult.supported,
        searchInsights:searchResult.supported && Array.isArray(searchResult.rows) ? searchResult.rows : [],
        searchInsightsSupported:searchResult.supported,
        returningVisitorInsights:returningResult.supported ? returningResult.row : null,
        returningVisitorSupported:returningResult.supported,
        sessionDurationInsights:sessionDurationResult.supported ? sessionDurationResult.row : null,
        sessionDurationSupported:sessionDurationResult.supported,
        engagedVisitSeries:engagedVisitResult.supported && Array.isArray(engagedVisitResult.rows)
          ? engagedVisitResult.rows
          : [],
        engagedVisitSupported:engagedVisitResult.supported,
        overviewPhotoRows:overviewPhotoResult.supported && Array.isArray(overviewPhotoResult.rows)
          ? overviewPhotoResult.rows
          : [],
        overviewPhotoSupported:overviewPhotoResult.supported,
        recentQualifiedViews:recentQualifiedResult.supported && Array.isArray(recentQualifiedResult.rows)
          ? recentQualifiedResult.rows
          : [],
        recentQualifiedViewsSupported:recentQualifiedResult.supported,
        giveawayPerformance:giveawayPerformanceResult.supported ? giveawayPerformanceResult.row : null,
        giveawayPerformanceSupported:giveawayPerformanceResult.supported,
        engagementSupported:engagement.supported,
        saleSnapshotsSupported:saleSnapshots.supported,
        saleSnapshots:saleSnapshots.rows
      };

      state.visible=rows.filter(row=>{
        if(selectedStatus && row._status!==selectedStatus) return false;
        if(selectedGame && String(row.game||row._card?.game||"")!==selectedGame) return false;
        return true;
      });

      loading.hidden=true;
      renderOverview();
      renderRecommendations();
      renderSales();
      if(activeTab()==="history") renderHistoryTab();
      if(activeTab()==="health") renderHealthTab();
    }

    rangeSel.addEventListener("change",()=>{
      custom.classList.toggle("show",rangeSel.value==="custom");
      refresh();
    });
    statusSel.addEventListener("change",refresh);
    gameSel.addEventListener("change",refresh);
    startInput.addEventListener("change",()=>{if(rangeSel.value==="custom")refresh();});
    endInput.addEventListener("change",()=>{if(rangeSel.value==="custom")refresh();});

    refresh();
  }

  Object.assign(appContext,{resetQualifiedViewCounts,openResetQualifiedViewsModal,closeResetQualifiedViewsModal,renderInsightsPage});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.REVIEW_TEXT_MIN = 10;

  appContext.REVIEW_TEXT_MAX = 500;

  appContext.REVIEW_NAME_MAX = 60;

  appContext.REVIEW_ITEM_MAX = 120;

  appContext.REVIEW_COUNTRIES = Object.freeze([
    ["AF","Afghanistan"],
    ["AL","Albania"],
    ["DZ","Algeria"],
    ["AD","Andorra"],
    ["AO","Angola"],
    ["AG","Antigua and Barbuda"],
    ["AR","Argentina"],
    ["AM","Armenia"],
    ["AU","Australia"],
    ["AT","Austria"],
    ["AZ","Azerbaijan"],
    ["BS","Bahamas"],
    ["BH","Bahrain"],
    ["BD","Bangladesh"],
    ["BB","Barbados"],
    ["BY","Belarus"],
    ["BE","Belgium"],
    ["BZ","Belize"],
    ["BJ","Benin"],
    ["BT","Bhutan"],
    ["BO","Bolivia"],
    ["BA","Bosnia and Herzegovina"],
    ["BW","Botswana"],
    ["BR","Brazil"],
    ["BN","Brunei"],
    ["BG","Bulgaria"],
    ["BF","Burkina Faso"],
    ["BI","Burundi"],
    ["CV","Cabo Verde"],
    ["KH","Cambodia"],
    ["CM","Cameroon"],
    ["CA","Canada"],
    ["CF","Central African Republic"],
    ["TD","Chad"],
    ["CL","Chile"],
    ["CN","China"],
    ["CO","Colombia"],
    ["KM","Comoros"],
    ["CG","Congo"],
    ["CD","Congo, Democratic Republic of the"],
    ["CR","Costa Rica"],
    ["CI","Côte d’Ivoire"],
    ["HR","Croatia"],
    ["CU","Cuba"],
    ["CY","Cyprus"],
    ["CZ","Czechia"],
    ["DK","Denmark"],
    ["DJ","Djibouti"],
    ["DM","Dominica"],
    ["DO","Dominican Republic"],
    ["EC","Ecuador"],
    ["EG","Egypt"],
    ["SV","El Salvador"],
    ["GQ","Equatorial Guinea"],
    ["ER","Eritrea"],
    ["EE","Estonia"],
    ["SZ","Eswatini"],
    ["ET","Ethiopia"],
    ["FJ","Fiji"],
    ["FI","Finland"],
    ["FR","France"],
    ["GA","Gabon"],
    ["GM","Gambia"],
    ["GE","Georgia"],
    ["DE","Germany"],
    ["GH","Ghana"],
    ["GR","Greece"],
    ["GD","Grenada"],
    ["GT","Guatemala"],
    ["GN","Guinea"],
    ["GW","Guinea-Bissau"],
    ["GY","Guyana"],
    ["HT","Haiti"],
    ["HN","Honduras"],
    ["HK","Hong Kong"],
    ["HU","Hungary"],
    ["IS","Iceland"],
    ["IN","India"],
    ["ID","Indonesia"],
    ["IR","Iran"],
    ["IQ","Iraq"],
    ["IE","Ireland"],
    ["IL","Israel"],
    ["IT","Italy"],
    ["JM","Jamaica"],
    ["JP","Japan"],
    ["JO","Jordan"],
    ["KZ","Kazakhstan"],
    ["KE","Kenya"],
    ["KI","Kiribati"],
    ["KP","North Korea"],
    ["KR","South Korea"],
    ["KW","Kuwait"],
    ["KG","Kyrgyzstan"],
    ["LA","Laos"],
    ["LV","Latvia"],
    ["LB","Lebanon"],
    ["LS","Lesotho"],
    ["LR","Liberia"],
    ["LY","Libya"],
    ["LI","Liechtenstein"],
    ["LT","Lithuania"],
    ["LU","Luxembourg"],
    ["MO","Macau"],
    ["MG","Madagascar"],
    ["MW","Malawi"],
    ["MY","Malaysia"],
    ["MV","Maldives"],
    ["ML","Mali"],
    ["MT","Malta"],
    ["MH","Marshall Islands"],
    ["MR","Mauritania"],
    ["MU","Mauritius"],
    ["MX","Mexico"],
    ["FM","Micronesia"],
    ["MD","Moldova"],
    ["MC","Monaco"],
    ["MN","Mongolia"],
    ["ME","Montenegro"],
    ["MA","Morocco"],
    ["MZ","Mozambique"],
    ["MM","Myanmar"],
    ["NA","Namibia"],
    ["NR","Nauru"],
    ["NP","Nepal"],
    ["NL","Netherlands"],
    ["NZ","New Zealand"],
    ["NI","Nicaragua"],
    ["NE","Niger"],
    ["NG","Nigeria"],
    ["MK","North Macedonia"],
    ["NO","Norway"],
    ["OM","Oman"],
    ["PK","Pakistan"],
    ["PW","Palau"],
    ["PS","Palestine"],
    ["PA","Panama"],
    ["PG","Papua New Guinea"],
    ["PY","Paraguay"],
    ["PE","Peru"],
    ["PH","Philippines"],
    ["PL","Poland"],
    ["PT","Portugal"],
    ["QA","Qatar"],
    ["RO","Romania"],
    ["RU","Russia"],
    ["RW","Rwanda"],
    ["KN","Saint Kitts and Nevis"],
    ["LC","Saint Lucia"],
    ["VC","Saint Vincent and the Grenadines"],
    ["WS","Samoa"],
    ["SM","San Marino"],
    ["ST","São Tomé and Príncipe"],
    ["SA","Saudi Arabia"],
    ["SN","Senegal"],
    ["RS","Serbia"],
    ["SC","Seychelles"],
    ["SL","Sierra Leone"],
    ["SG","Singapore"],
    ["SK","Slovakia"],
    ["SI","Slovenia"],
    ["SB","Solomon Islands"],
    ["SO","Somalia"],
    ["ZA","South Africa"],
    ["SS","South Sudan"],
    ["ES","Spain"],
    ["LK","Sri Lanka"],
    ["SD","Sudan"],
    ["SR","Suriname"],
    ["SE","Sweden"],
    ["CH","Switzerland"],
    ["SY","Syria"],
    ["TW","Taiwan"],
    ["TJ","Tajikistan"],
    ["TZ","Tanzania"],
    ["TH","Thailand"],
    ["TL","Timor-Leste"],
    ["TG","Togo"],
    ["TO","Tonga"],
    ["TT","Trinidad and Tobago"],
    ["TN","Tunisia"],
    ["TR","Türkiye"],
    ["TM","Turkmenistan"],
    ["TV","Tuvalu"],
    ["UG","Uganda"],
    ["UA","Ukraine"],
    ["AE","United Arab Emirates"],
    ["GB","United Kingdom"],
    ["US","United States"],
    ["UY","Uruguay"],
    ["UZ","Uzbekistan"],
    ["VU","Vanuatu"],
    ["VA","Vatican City"],
    ["VE","Venezuela"],
    ["VN","Vietnam"],
    ["YE","Yemen"],
    ["ZM","Zambia"],
    ["ZW","Zimbabwe"],
    ["Other","Other"]
  ]);

  appContext.publicReviews = [];

  appContext.ownerReviewSubmissions = [];

  appContext.reviewBackendState = "unknown";
}
