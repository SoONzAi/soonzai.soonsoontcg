/** V93 beta: services/analytics. Shared dependencies are explicit on appContext. */
export function register(appContext){
function analyticsExclusionCookieValue(){
    try{
      const prefix=`${appContext.ANALYTICS_EXCLUDED_DEVICE_COOKIE}=`;
      const parts=String(document.cookie||"").split(";");

      for(const part of parts){
        const item=part.trim();
        if(item.startsWith(prefix)){
          return decodeURIComponent(item.slice(prefix.length));
        }
      }
    }catch{}
    return "";
  }

function hasAnalyticsExclusionLocalStorage(){
    try{
      return appContext.localStorage.getItem(appContext.ANALYTICS_EXCLUDED_DEVICE_KEY)==="1";
    }catch{
      return false;
    }
  }

function hasAnalyticsExclusionCookie(){
    return appContext.analyticsExclusionCookieValue()==="1";
  }

function isAnalyticsExcludedDevice(){
    // Either persistent mechanism is enough. This makes the exclusion much
    // more resilient to browser/PWA storage-context quirks and normal restarts.
    return appContext.hasAnalyticsExclusionLocalStorage() || appContext.hasAnalyticsExclusionCookie();
  }

function setAnalyticsExcludedDevice(excluded){
    let localSaved=false;
    let cookieSaved=false;

    try{
      if(excluded){
        appContext.localStorage.setItem(appContext.ANALYTICS_EXCLUDED_DEVICE_KEY,"1");
        localSaved=appContext.localStorage.getItem(appContext.ANALYTICS_EXCLUDED_DEVICE_KEY)==="1";
      }else{
        appContext.localStorage.removeItem(appContext.ANALYTICS_EXCLUDED_DEVICE_KEY);
        localSaved=appContext.localStorage.getItem(appContext.ANALYTICS_EXCLUDED_DEVICE_KEY)!=="1";
      }
    }catch{}

    try{
      if(excluded){
        document.cookie=
          `${appContext.ANALYTICS_EXCLUDED_DEVICE_COOKIE}=1; Max-Age=${appContext.ANALYTICS_EXCLUSION_COOKIE_MAX_AGE}; Path=/; SameSite=Lax; Secure`;
        cookieSaved=appContext.analyticsExclusionCookieValue()==="1";
      }else{
        document.cookie=
          `${appContext.ANALYTICS_EXCLUDED_DEVICE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
        cookieSaved=appContext.analyticsExclusionCookieValue()!=="1";
      }
    }catch{}

    return excluded
      ? (localSaved || cookieSaved)
      : (localSaved && cookieSaved);
  }

function analyticsExclusionTokenFromUrl(){
    try{
      const hash=String(location.hash||"");
      const query=hash.includes("?") ? hash.slice(hash.indexOf("?")+1) : "";
      return String(new URLSearchParams(query).get("analytics_exclude")||"").trim();
    }catch{
      return "";
    }
  }

function removeAnalyticsExclusionTokenFromUrl(){
    try{
      const hash=String(location.hash||"#/home");
      const [route,query=""]=hash.split("?");
      const params=new URLSearchParams(query);
      params.delete("analytics_exclude");
      const nextQuery=params.toString();
      history.replaceState(null,"",`${location.pathname}${location.search}${route}${nextQuery?`?${nextQuery}`:""}`);
    }catch{}
  }

async function consumeAnalyticsExclusionLinkIfPresent(){
    const token=appContext.analyticsExclusionTokenFromUrl();
    if(!token) return appContext.isAnalyticsExcludedDevice();

    try{
      const {data,error}=await appContext.supabaseClient.rpc("consume_analytics_exclusion_token",{
        p_token:token
      });

      if(error || data!==true){
        console.warn("Analytics exclusion link could not be validated:",error||"invalid token");
        appContext.removeAnalyticsExclusionTokenFromUrl();
        return appContext.isAnalyticsExcludedDevice();
      }

      appContext.setAnalyticsExcludedDevice(true);
      appContext.removeAnalyticsExclusionTokenFromUrl();
      return true;
    }catch(error){
      console.warn("Analytics exclusion link could not be validated:",error);
      appContext.removeAnalyticsExclusionTokenFromUrl();
      return appContext.isAnalyticsExcludedDevice();
    }
  }

function newAnalyticsExclusionToken(){
    const parts=[];
    for(let i=0;i<4;i++){
      parts.push(
        crypto?.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${i}`
      );
    }
    return parts.join(".");
  }

function newAnalyticsExclusionPairingCode(){
    const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes=new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
  }

function analyticsExclusionPairingUrl(code){
    const clean=String(code||"").trim().toUpperCase();
    if(!clean) return "";
    return `${location.origin}${location.pathname}#/analytics-exclude?code=${encodeURIComponent(clean)}`;
  }

function analyticsPairingCodeFromUrl(){
    try{
      if(appContext.currentRoute()!=="analytics-exclude") return "";
      return String(appContext.currentHashParams().get("code")||"").trim().toUpperCase();
    }catch{
      return "";
    }
  }

function removeAnalyticsPairingCodeFromUrl(){
    try{
      if(appContext.currentRoute()!=="analytics-exclude") return;
      const params=appContext.currentHashParams();
      params.delete("code");
      const query=params.toString();
      history.replaceState(
        null,
        "",
        `${location.pathname}${location.search}#/analytics-exclude${query?`?${query}`:""}`
      );
    }catch{}
  }

async function consumeAnalyticsExclusionQrIfPresent(){
    const code=appContext.analyticsPairingCodeFromUrl();
    if(!code) return appContext.isAnalyticsExcludedDevice();

    const ok=await appContext.consumeAnalyticsExclusionPairingCode(code);
    appContext.removeAnalyticsPairingCodeFromUrl();

    if(ok){
      try{ appContext.sessionStorage.removeItem(appContext.WEBSITE_VISIT_SESSION_KEY); }catch{}
      return appContext.isAnalyticsExcludedDevice();
    }

    return appContext.isAnalyticsExcludedDevice();
  }

async function createAnalyticsExclusionPairingCode(){
    if(!appContext.requireOwner("generate analytics exclusion pairing code")) return "";

    const code=appContext.newAnalyticsExclusionPairingCode();

    try{
      const {data,error}=await appContext.supabaseClient.rpc("create_analytics_exclusion_code",{
        p_code:code
      });

      if(error || data!==true){
        console.warn("Could not generate analytics exclusion pairing code:",error);
        return "";
      }

      return code;
    }catch(error){
      console.warn("Could not generate analytics exclusion pairing code:",error);
      return "";
    }
  }

async function consumeAnalyticsExclusionPairingCode(code){
    const clean=String(code||"").trim().toUpperCase();
    if(!clean) return false;

    try{
      const {data,error}=await appContext.supabaseClient.rpc("consume_analytics_exclusion_code",{
        p_code:clean
      });

      if(error || data!==true){
        if(error) console.warn("Analytics exclusion pairing failed:",error);
        return false;
      }

      return appContext.setAnalyticsExcludedDevice(true);
    }catch(error){
      console.warn("Analytics exclusion pairing failed:",error);
      return false;
    }
  }

async function createAnalyticsExclusionLink(){
    if(!appContext.requireOwner("generate analytics exclusion link")) return "";

    const token=appContext.newAnalyticsExclusionToken();
    try{
      const {data,error}=await appContext.supabaseClient.rpc("create_analytics_exclusion_token",{
        p_token:token
      });

      if(error || data!==true){
        console.warn("Could not generate analytics exclusion link:",error);
        return "";
      }

      return `${location.origin}${location.pathname}#/home?analytics_exclude=${encodeURIComponent(token)}`;
    }catch(error){
      console.warn("Could not generate analytics exclusion link:",error);
      return "";
    }
  }

function analyticsUserAgent(){
    try{
      return String(typeof navigator!=="undefined" ? navigator.userAgent||"" : "").toLowerCase();
    }catch{
      return "";
    }
  }

function isKnownAutomatedSocialFetcher(){
    // Exclude explicit social fetchers plus common browser-automation/search
    // crawler identities. Normal Facebook/Instagram in-app browsers are not
    // blocked here; they are handled by the human-interaction gate below.
    const ua=appContext.analyticsUserAgent();

    try{
      if(typeof navigator!=="undefined" && navigator.webdriver===true) return true;
    }catch{}

    if(!ua) return false;

    return [
      "facebookexternalhit",
      "facebookcatalog",
      "facebot",
      "facebookbot",
      "meta-externalagent",
      "meta-externalfetcher",
      "meta-webindexer",
      "meta-externalads",
      "headlesschrome",
      "phantomjs",
      "selenium",
      "playwright",
      "puppeteer",
      "googlebot",
      "bingbot",
      "bingpreview",
      "duckduckbot",
      "baiduspider",
      "yandexbot",
      "slurp",
      "applebot",
      "petalbot",
      "twitterbot",
      "linkedinbot",
      "pinterestbot",
      "slackbot",
      "discordbot",
      "telegrambot",
      "crawler",
      "spider",
      "previewbot",
      "linkpreview"
    ].some(token=>ua.includes(token));
  }

function isFacebookInstagramAnalyticsSession(){
    try{
      const source=appContext.currentVisitorTrafficSource();
      if(source==="Facebook" || source==="Instagram") return true;
    }catch{}

    const ua=appContext.analyticsUserAgent();
    if([
      "fban/",
      "fbav/",
      "fb_iab",
      "fbios",
      "fb4a",
      "messengerforios",
      "instagram"
    ].some(token=>ua.includes(token))){
      return true;
    }

    try{
      const params=new URLSearchParams(String(location.search||""));
      if(params.has("fbclid") || params.has("igshid")) return true;
    }catch{}

    return false;
  }

function socialAnalyticsNeedsHumanInteraction(){
    return appContext.isFacebookInstagramAnalyticsSession() &&
      !appContext.analyticsHumanInteractionObserved;
  }

function isBuyerAnalyticsBlocked(){
    return appContext.isOwnerAuthenticated() ||
      appContext.isAnalyticsExcludedDevice() ||
      appContext.isKnownAutomatedSocialFetcher() ||
      appContext.socialAnalyticsNeedsHumanInteraction();
  }

async function resumeDeferredSocialAnalytics(){
    if(!appContext.isFacebookInstagramAnalyticsSession()) return false;
    if(!appContext.analyticsHumanInteractionObserved) return false;
    if(appContext.isOwnerAuthenticated() || appContext.isAnalyticsExcludedDevice() || appContext.isKnownAutomatedSocialFetcher()) return false;
    if(!appContext.analyticsDeferredSocialStartupAttempted) return false;
    if(appContext.analyticsDeferredSocialResumeStarted) return true;

    appContext.analyticsDeferredSocialResumeStarted=true;

    try{
      await appContext.recordAnalyticsSession();
      appContext.startSessionDurationTracking();
      await appContext.recordWebsiteVisit();

      // If the social link opened a card before human proof was available,
      // start its normal 2-second qualification window now.
      const cardId=appContext.safeCardId(appContext.detailsCardId||"");
      if(cardId && !appContext.detailsOverlay?.hidden && Array.isArray(appContext.cards)){
        const card=appContext.cards.find(row=>String(row?.id||"")===cardId);
        if(card) appContext.recordCardViewEvent(card);
      }

      return true;
    }catch(error){
      console.warn("Deferred social analytics could not resume:",error);
      return false;
    }
  }

function noteHumanAnalyticsInteraction(event){
    if(event && event.isTrusted===false) return false;

    try{
      if(typeof document!=="undefined" && (document.hidden || (document.visibilityState && document.visibilityState!=="visible"))){
        return false;
      }
    }catch{}

    if(appContext.analyticsHumanInteractionObserved) return true;

    appContext.analyticsHumanInteractionObserved=true;
    try{
      appContext.sessionStorage.setItem(appContext.ANALYTICS_HUMAN_INTERACTION_SESSION_KEY,"1");
    }catch{}

    if(appContext.analyticsDeferredSocialStartupAttempted){
      Promise.resolve().then(()=>appContext.resumeDeferredSocialAnalytics());
    }

    return true;
  }

function setupSocialAnalyticsHumanInteractionGate(){
    if(!appContext.isFacebookInstagramAnalyticsSession()) return false;
    if(appContext.analyticsHumanInteractionObserved) return true;
    if(typeof window==="undefined" || appContext.analyticsHumanInteractionHandlersInstalled) return false;

    appContext.analyticsHumanInteractionHandlersInstalled=true;
    const options={capture:true,passive:true};
    const types=["pointerdown","touchstart","mousedown","click","keydown","wheel"];

    const handler=event=>{
      if(!appContext.noteHumanAnalyticsInteraction(event)) return;
      for(const type of types){
        try{window.removeEventListener(type,handler,options);}catch{}
      }
      appContext.analyticsHumanInteractionHandlersInstalled=false;
    };

    for(const type of types){
      window.addEventListener(type,handler,options);
    }

    return true;
  }

function getVisitorId(){
    let id = appContext.localStorage.getItem(appContext.VISITOR_ID_KEY);
    if(!id){
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() :
        "v_" + Date.now().toString(36) + Math.random().toString(36).slice(2);
      appContext.localStorage.setItem(appContext.VISITOR_ID_KEY, id);
    }
    return id;
  }

function cancelPendingCardViewQualification(){
    appContext.cardViewQualificationToken+=1;
  }

async function sendQualifiedCardViewEvent(card,token){
    try{
      const cardId=appContext.safeCardId(card?.id);
      if(!cardId) return false;

      // Owner/testing activity and explicitly excluded personal browsers
      // must never inflate buyer-facing analytics.
      if(appContext.isBuyerAnalyticsBlocked()) return false;

      // A qualified view requires the same card to still be open, visible and
      // in the foreground after the engagement delay.
      if(token!==appContext.cardViewQualificationToken) return false;
      if(appContext.detailsOverlay?.hidden) return false;
      if(String(appContext.detailsCardId||"")!==cardId) return false;
      if(document.visibilityState && document.visibilityState!=="visible") return false;

      const visitorId=appContext.getVisitorId();
      const {error}=await appContext.supabaseClient.functions.invoke("record-card-view",{
        body:{
          card_id:cardId,
          visitor_id:visitorId
        }
      });

      if(error){
        console.error("Record qualified view event error:",error);
        return false;
      }

      // Mirror the qualified view into the owner analytics event table when V5
      // is installed. This makes the timeline filterable by current Status/Game.
      // Failure here never affects the public card-view experience.
      try{
        await appContext.supabaseClient.rpc("record_qualified_card_view_event",{
          p_card_id:cardId,
          p_visitor_id:visitorId
        });
      }catch{}

      // Discovery attribution is recorded only after the same 2-second
      // Qualified View succeeds. This keeps accidental taps and Owner/testing
      // activity out of the discovery history.
      appContext.recordQualifiedViewDiscoveryAttribution(cardId,visitorId).catch(()=>{});

      // A successfully recorded Qualified View contributes one step to
      // this anonymous session's browsing depth.
      appContext.incrementAnalyticsSessionQualifiedView().catch(()=>{});
      return true;
    }catch(error){
      console.error("Record qualified view event error:",error);
      return false;
    }
  }

function recordCardViewEvent(card){
    // The existing analytics backend continues to store card-view events,
    // but the frontend submits only meaningful buyer views:
    // 2+ seconds open and Owner Mode excluded. No frontend repeat-view cooldown.
    appContext.cancelPendingCardViewQualification();
    if(appContext.isBuyerAnalyticsBlocked()) return false;

    const token=appContext.cardViewQualificationToken;
    window.setTimeout(()=>{
      appContext.sendQualifiedCardViewEvent(card,token);
    },appContext.CARD_VIEW_QUALIFY_MS);

    return true;
  }

async function recordQualifiedViewDiscoveryAttribution(cardId,visitorId){
    try{
      if(appContext.discoveryAttributionBackendState==="unavailable") return false;

      const id=appContext.safeCardId(cardId);
      const source=id ? appContext.getCardDiscoverySource?.(id) || "" : "";
      const visitor=String(visitorId||"").trim().slice(0,120);
      if(!id || !source || !visitor) return false;

      const {data,error}=await appContext.supabaseClient.rpc("record_card_discovery_view",{
        p_card_id:id,
        p_visitor_id:visitor,
        p_source:source
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("record_card_discovery_view") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.discoveryAttributionBackendState="unavailable";
          return false;
        }
        appContext.discoveryAttributionBackendState="error";
        console.warn("Discovery attribution unavailable:",error);
        return false;
      }

      appContext.discoveryAttributionBackendState="available";
      return data!==false;
    }catch(error){
      appContext.discoveryAttributionBackendState="error";
      console.warn("Discovery attribution unavailable:",error);
      return false;
    }
  }

function engagementDedupeWindowMs(eventType){
    if(eventType==="favorite_add" || eventType==="favorite_remove") return 10*60*1000;
    if(eventType==="contact_open" || eventType==="contact_platform" || eventType==="inquiry_copy") return 5*60*1000;
    return 30*60*1000;
  }

function readEngagementDedupe(){
    try{
      const parsed=JSON.parse(appContext.sessionStorage.getItem(appContext.CARD_ENGAGEMENT_DEDUPE_KEY)||"{}");
      return parsed && typeof parsed==="object" && !Array.isArray(parsed) ? parsed : {};
    }catch{
      return {};
    }
  }

function shouldSkipEngagementEvent(cardId,eventType,platform=""){
    const key=[String(cardId||""),eventType,String(platform||"")].join("|");
    const map=appContext.readEngagementDedupe();
    const previous=Number(map[key]||0);
    const now=Date.now();
    if(previous && now-previous<appContext.engagementDedupeWindowMs(eventType)) return true;

    map[key]=now;
    try{
      const compact=Object.entries(map)
        .filter(([,ts])=>Number.isFinite(Number(ts)) && now-Number(ts)<24*60*60*1000)
        .sort((a,b)=>Number(b[1])-Number(a[1]))
        .slice(0,300);
      appContext.sessionStorage.setItem(appContext.CARD_ENGAGEMENT_DEDUPE_KEY,JSON.stringify(Object.fromEntries(compact)));
    }catch{}
    return false;
  }

async function recordCardEngagement(cardId,eventType,platform=""){
    try{
      if(appContext.isBuyerAnalyticsBlocked()) return false;

      const id=appContext.safeCardId(cardId);
      const type=String(eventType||"").trim().toLowerCase();
      const platformText=String(platform||"").trim().slice(0,80);

      if(!id || !appContext.CARD_ENGAGEMENT_EVENT_TYPES.has(type)) return false;
      if(appContext.shouldSkipEngagementEvent(id,type,platformText)) return true;
      if(appContext.engagementTrackingBackendState==="unavailable") return false;

      const {data,error}=await appContext.supabaseClient.rpc("record_card_engagement",{
        p_card_id:id,
        p_visitor_id:appContext.getVisitorId(),
        p_event_type:type,
        p_platform:platformText || null
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("record_card_engagement") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.engagementTrackingBackendState="unavailable";
        }
        console.warn("Buyer-intent tracking unavailable:",error);
        return false;
      }

      appContext.engagementTrackingBackendState="available";
      return data!==false;
    }catch(error){
      console.warn("Buyer-intent tracking unavailable:",error);
      return false;
    }
  }

function readOverviewPhotoInteractionDedupe(){
    try{
      const parsed=JSON.parse(appContext.sessionStorage.getItem(appContext.OVERVIEW_PHOTO_INTERACTION_KEY)||"{}");
      return parsed && typeof parsed==="object" && !Array.isArray(parsed) ? parsed : {};
    }catch{
      return {};
    }
  }

function overviewPhotoInteractionAlreadyRecorded(cardId){
    const id=appContext.safeCardId(cardId);
    if(!id) return true;
    const map=appContext.readOverviewPhotoInteractionDedupe();
    return map[id]===true;
  }

function markOverviewPhotoInteractionRecorded(cardId){
    const id=appContext.safeCardId(cardId);
    if(!id) return;
    const map=appContext.readOverviewPhotoInteractionDedupe();
    map[id]=true;
    try{ appContext.sessionStorage.setItem(appContext.OVERVIEW_PHOTO_INTERACTION_KEY,JSON.stringify(map)); }catch{}
  }

async function recordOverviewPhotoInteraction(cardId){
    try{
      if(appContext.isBuyerAnalyticsBlocked()) return false;

      const id=appContext.safeCardId(cardId);
      if(!id || appContext.overviewPhotoInteractionAlreadyRecorded(id)) return false;
      if(appContext.overviewPhotoTrackingBackendState==="unavailable") return false;

      const sessionId=appContext.getAnalyticsSessionId();
      const visitorId=appContext.getVisitorId();
      if(!sessionId || !visitorId) return false;

      const {data,error}=await appContext.supabaseClient.rpc("record_card_overview_photo_interaction",{
        p_card_id:id,
        p_visitor_id:visitorId,
        p_session_id:sessionId
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("record_card_overview_photo_interaction") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.overviewPhotoTrackingBackendState="unavailable";
        }
        console.warn("Overview photo interaction tracking unavailable:",error);
        return false;
      }

      appContext.overviewPhotoTrackingBackendState="available";
      appContext.markOverviewPhotoInteractionRecorded(id);
      return data!==false;
    }catch(error){
      console.warn("Overview photo interaction tracking unavailable:",error);
      return false;
    }
  }

async function fetchOverviewPhotoInsights(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_card_overview_photo_insights",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("get_card_overview_photo_insights") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.overviewPhotoTrackingBackendState="unavailable";
        }
        console.warn("Overview photo insights unavailable:",error);
        return {supported:false,rows:[]};
      }

      appContext.overviewPhotoTrackingBackendState="available";
      return {supported:true,rows:Array.isArray(data)?data:[]};
    }catch(error){
      console.warn("Overview photo insights unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

async function fetchCardEngagementInsights(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_card_engagement_insights",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("get_card_engagement_insights") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.engagementTrackingBackendState="unavailable";
        }
        console.warn("Buyer-intent insights unavailable:",error);
        return {supported:false,rows:[]};
      }

      appContext.engagementTrackingBackendState="available";
      return {supported:true,rows:Array.isArray(data)?data:[]};
    }catch(error){
      console.warn("Buyer-intent insights unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

async function fetchOwnerCardConversionSummary(cardId,{force=false}={}){
    const id=appContext.safeCardId(cardId);
    if(!id || !appContext.isOwnerMode()) return null;

    const cached=appContext.ownerCardConversionSummaryCache.get(id);
    if(!force && cached && Date.now()-cached.cached_at<60*1000){
      return cached.value;
    }

    try{
      const start=new Date("2000-01-01T00:00:00");
      const end=new Date();
      const [viewRows,engagementResult]=await Promise.all([
        appContext.fetchInsights(start,end,{silent:true}),
        appContext.fetchCardEngagementInsights(start,end)
      ]);

      const viewRow=(Array.isArray(viewRows)?viewRows:[]).find(row=>
        String(row.card_id||row.id||"")===id
      )||{};
      const engagement=(Array.isArray(engagementResult?.rows)?engagementResult.rows:[]).find(row=>
        String(row.card_id||"")===id
      )||{};
      const contact=appContext.insightContactMetrics?.(engagement)||{};
      const uniqueViews=Math.max(0,Number(viewRow.unique_views||0));
      const intent=Math.max(0,Number(contact.intent_count||0));
      const value={
        card_id:id,
        qualified_views:Math.max(0,Number(viewRow.views||0)),
        unique_views:uniqueViews,
        favorite_adds:Math.max(0,Number(engagement.favorite_adds||0)),
        contact_opens:Math.max(0,Number(contact.contact_opens||0)),
        inquiry_copies:Math.max(0,Number(contact.inquiry_copies||0)),
        platform_clicks:Math.max(0,Number(contact.platform_clicks||0)),
        intent_count:intent,
        intent_rate:uniqueViews>0 ? intent/uniqueViews*100 : 0
      };

      appContext.ownerCardConversionSummaryCache.set(id,{cached_at:Date.now(),value});
      return value;
    }catch(error){
      console.warn("Owner card conversion summary unavailable:",error);
      return null;
    }
  }

function freshQualifiedViewCount(cardId){
    const id=String(cardId||"");
    if(!id) return 0;
    return Math.max(0,Number(appContext.qualifiedViewTotalsByCard.get(id)||0));
  }

function freshQualifiedViewDisplay(cardId){
    if(appContext.qualifiedViewTotalsBackendState==="unavailable" || appContext.qualifiedViewTotalsBackendState==="error"){
      return "—";
    }
    return appContext.freshQualifiedViewCount(cardId).toLocaleString();
  }

async function refreshQualifiedViewTotals(){
    if(!appContext.isOwnerMode()){
      appContext.qualifiedViewTotalsByCard.clear();
      appContext.qualifiedViewTotalsBackendState="unknown";
      return false;
    }

    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_qualified_card_view_totals");

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("get_qualified_card_view_totals") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.qualifiedViewTotalsBackendState="unavailable";
        }else{
          console.warn("Qualified view totals unavailable:",error);
          appContext.qualifiedViewTotalsBackendState="error";
        }
        appContext.qualifiedViewTotalsByCard.clear();
        return false;
      }

      appContext.qualifiedViewTotalsByCard.clear();
      (Array.isArray(data)?data:[]).forEach(row=>{
        const id=String(row.card_id||"");
        if(id) appContext.qualifiedViewTotalsByCard.set(id,Math.max(0,Number(row.qualified_views||0)));
      });

      appContext.qualifiedViewTotalsBackendState="available";
      return true;
    }catch(error){
      console.warn("Qualified view totals unavailable:",error);
      appContext.qualifiedViewTotalsByCard.clear();
      appContext.qualifiedViewTotalsBackendState="error";
      return false;
    }
  }

async function saveSaleConversionSnapshot(snapshot){
    try{
      if(!appContext.isOwnerMode() || !snapshot?.card_id) return false;
      if(appContext.saleSnapshotBackendState==="unavailable") return false;

      const {data,error}=await appContext.supabaseClient.rpc("save_card_sale_snapshot",{
        p_card_id:String(snapshot.card_id),
        p_card_name:String(snapshot.card_name||"").slice(0,240),
        p_price_usd:snapshot.price_usd==null ? null : Number(snapshot.price_usd),
        p_price_myr:snapshot.price_myr==null ? null : Number(snapshot.price_myr),
        p_price_sgd:snapshot.price_sgd==null ? null : Number(snapshot.price_sgd),
        p_days_listed:snapshot.days_listed==null ? null : Number(snapshot.days_listed),
        p_qualified_views:Number(snapshot.qualified_views||0),
        p_unique_views:Number(snapshot.unique_views||0),
        p_favorite_adds:Number(snapshot.favorite_adds||0),
        p_contact_actions:Number(snapshot.contact_actions||0),
        p_shares:Number(snapshot.shares||0),
        p_interest_score:Number(snapshot.interest_score||0)
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(message.includes("save_card_sale_snapshot")||message.includes("function")||message.includes("schema cache")){
          appContext.saleSnapshotBackendState="unavailable";
        }
        console.warn("Sale conversion snapshot unavailable:",error);
        return false;
      }

      appContext.saleSnapshotBackendState="available";
      return data!==false;
    }catch(error){
      console.warn("Sale conversion snapshot unavailable:",error);
      return false;
    }
  }

async function fetchSaleConversionSnapshots(){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_card_sale_snapshots");
      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(message.includes("get_card_sale_snapshots")||message.includes("function")||message.includes("schema cache")){
          appContext.saleSnapshotBackendState="unavailable";
        }
        console.warn("Sale snapshots unavailable:",error);
        return {supported:false,rows:[]};
      }
      appContext.saleSnapshotBackendState="available";
      return {supported:true,rows:Array.isArray(data)?data:[]};
    }catch(error){
      console.warn("Sale snapshots unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

function insightContactMetrics(values){
    const contactOpens=Math.max(0,Number(values?.contact_opens||0));
    const contactVisitors=Math.max(0,Number(values?.contact_visitors||0));
    const inquiryCopies=Math.max(0,Number(values?.inquiry_copies||0));
    const platformClicks=Math.max(0,Number(values?.platform_clicks||0));

    // Prefer unique visitors when the backend supplies them. For older/fallback
    // rows, use the strongest observed funnel count instead of summing every
    // step. This prevents one buyer from looking like three separate contacts.
    const intentCount=Math.max(
      contactVisitors,
      contactVisitors>0 ? 0 : contactOpens,
      inquiryCopies,
      platformClicks
    );

    let strongestStage="none";
    if(platformClicks>0) strongestStage="platform";
    else if(inquiryCopies>0) strongestStage="copy";
    else if(contactOpens>0 || contactVisitors>0) strongestStage="open";

    // Revised funnel weighting:
    // open = 1, explicit inquiry copy = 3, contact-platform click = 6.
    // Contact contribution is capped at 8 points per estimated contact intent.
    // This preserves strong intent without stacking the same funnel excessively.
    const rawContactScore=
      Math.min(contactOpens || contactVisitors, intentCount)*1 +
      inquiryCopies*3 +
      platformClicks*6;
    const contactScore=Math.min(rawContactScore,intentCount*8);

    return {
      intent_count:intentCount,
      strongest_stage:strongestStage,
      contact_score:contactScore,
      contact_opens:contactOpens,
      contact_visitors:contactVisitors,
      inquiry_copies:inquiryCopies,
      platform_clicks:platformClicks
    };
  }

function insightInterestScore(values){
    const contact=insightContactMetrics(values);
    return Math.round(
      Number(values?.overview_photo_interactions||0) +
      Number(values?.unique_views||0) +
      Number(values?.image_expands||0) +
      Number(values?.favorite_adds||0)*3 +
      Number(values?.shares||0)*4 +
      contact.contact_score
    );
  }

async function captureSaleConversionSnapshot(card){
    if(!card || !appContext.isOwnerMode()) return false;

    try{
      const createdAt=new Date(card.created_at||"");
      const start=Number.isNaN(createdAt.getTime())
        ? new Date("2000-01-01T00:00:00")
        : createdAt;
      const end=new Date();

      const [viewRows,engagementResult]=await Promise.all([
        appContext.fetchInsights(start,end,{silent:true}),
        appContext.fetchCardEngagementInsights(start,end)
      ]);

      const viewRow=viewRows.find(row=>
        String(row.card_id||row.id||"")===String(card.id)
      ) || {};

      const engagement=engagementResult.rows.find(row=>
        String(row.card_id||"")===String(card.id)
      ) || {};

      const createdMs=start.getTime();
      const daysListed=Number.isFinite(createdMs)
        ? Math.max(0,Math.floor((Date.now()-createdMs)/(24*60*60*1000)))
        : null;

      const contactIntent=appContext.insightContactMetrics(engagement);

      return appContext.saveSaleConversionSnapshot({
        card_id:card.id,
        card_name:card.name,
        price_usd:card.price_usd ?? card.price ?? null,
        price_myr:card.price_myr ?? null,
        price_sgd:card.price_sgd ?? null,
        days_listed:daysListed,
        qualified_views:Number(viewRow.views||0),
        unique_views:Number(viewRow.unique_views||0),
        favorite_adds:Number(engagement.favorite_adds||0),
        contact_actions:contactIntent.intent_count,
        shares:Number(engagement.shares||0),
        interest_score:appContext.insightInterestScore({
          unique_views:Number(viewRow.unique_views||0),
          image_expands:Number(engagement.image_expands||0),
          favorite_adds:Number(engagement.favorite_adds||0),
          shares:Number(engagement.shares||0),
          contact_opens:Number(engagement.contact_opens||0),
          inquiry_copies:Number(engagement.inquiry_copies||0),
          platform_clicks:Number(engagement.platform_clicks||0)
        })
      });
    }catch(error){
      console.warn("Could not capture sale conversion snapshot:",error);
      return false;
    }
  }

function getAnalyticsSessionId(){
    try{
      let id=appContext.sessionStorage.getItem(appContext.ANALYTICS_SESSION_ID_KEY);
      if(id) return id;
      id=crypto?.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      appContext.sessionStorage.setItem(appContext.ANALYTICS_SESSION_ID_KEY,id);
      return id;
    }catch{
      return "";
    }
  }

async function recordAnalyticsSession(){
    if(appContext.isBuyerAnalyticsBlocked()){
      if(appContext.socialAnalyticsNeedsHumanInteraction()){
        appContext.analyticsDeferredSocialStartupAttempted=true;
      }
      return false;
    }
    const sessionId=appContext.getAnalyticsSessionId();
    const visitorId=appContext.getVisitorId();
    if(!sessionId || !visitorId) return false;

    try{
      const {error}=await appContext.supabaseClient.rpc("record_site_analytics_session",{
        p_session_id:sessionId,
        p_visitor_id:visitorId
      });
      if(error){
        console.warn("Session analytics unavailable:",error);
        return false;
      }
      return true;
    }catch(error){
      console.warn("Session analytics unavailable:",error);
      return false;
    }
  }

async function incrementAnalyticsSessionQualifiedView(){
    if(appContext.isBuyerAnalyticsBlocked()) return false;
    const sessionId=appContext.getAnalyticsSessionId();
    if(!sessionId) return false;

    try{
      const {error}=await appContext.supabaseClient.rpc("increment_site_session_qualified_view",{
        p_session_id:sessionId
      });
      if(error){
        console.warn("Browsing-depth analytics unavailable:",error);
        return false;
      }
      return true;
    }catch(error){
      console.warn("Browsing-depth analytics unavailable:",error);
      return false;
    }
  }

function sessionDurationPayload(seconds){
    const sessionId=appContext.getAnalyticsSessionId();
    const visitorId=appContext.getVisitorId();
    const safeSeconds=Math.max(0,Math.min(60,Math.round(Number(seconds)||0)));
    if(!sessionId || !visitorId || safeSeconds<1) return null;
    return {
      p_session_id:sessionId,
      p_visitor_id:visitorId,
      p_active_seconds:safeSeconds
    };
  }

async function recordSessionActiveSeconds(seconds,{allowHidden=false}={}){
    if(appContext.isBuyerAnalyticsBlocked() || (!allowHidden && document.hidden)) return false;
    if(appContext.sessionDurationBackendState==="unavailable") return false;
    const payload=appContext.sessionDurationPayload(seconds);
    if(!payload) return false;
    try{
      const {error}=await appContext.supabaseClient.rpc("record_site_session_active_time",payload);
      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(message.includes("record_site_session_active_time") || message.includes("function") || message.includes("schema cache")){
          appContext.sessionDurationBackendState="unavailable";
        }else{
          console.warn("Session duration analytics unavailable:",error);
        }
        return false;
      }
      appContext.sessionDurationBackendState="available";
      return true;
    }catch(error){
      console.warn("Session duration analytics unavailable:",error);
      return false;
    }
  }

function beaconSessionActiveSeconds(seconds){
    if(appContext.isBuyerAnalyticsBlocked() || appContext.sessionDurationBackendState==="unavailable") return false;
    const payload=appContext.sessionDurationPayload(seconds);
    if(!payload) return false;

    const base=String(window.COLLECT_TCG_SUPABASE_URL||"").replace(/\/$/,"");
    const key=String(window.COLLECT_TCG_SUPABASE_KEY||"");
    if(!base || !key) return false;

    // Supabase's API gateway accepts the publishable apikey on the request URL.
    // That lets sendBeacon authenticate the unload-time RPC even though the
    // Beacon API does not allow custom request headers.
    const endpoint=`${base}/rest/v1/rpc/record_site_session_active_time?apikey=${encodeURIComponent(key)}`;
    const body=JSON.stringify(payload);

    if(typeof navigator.sendBeacon==="function"){
      try{
        const queued=navigator.sendBeacon(
          endpoint,
          new Blob([body],{type:"application/json"})
        );
        if(queued) return true;
      }catch(error){
        console.warn("Session duration beacon could not be queued:",error);
      }
    }

    // keepalive is the fallback for browsers that reject/disable Beacon.
    try{
      appContext.fetch(endpoint,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":key,
          "Authorization":`Bearer ${key}`
        },
        body,
        keepalive:true,
        credentials:"omit"
      }).catch(error=>console.warn("Session duration keepalive flush failed:",error));
      return true;
    }catch(error){
      console.warn("Session duration final flush failed:",error);
      return false;
    }
  }

function sessionDurationHeartbeatTick({flushVisibleTime=false,useBeacon=false}={}){
    const now=Date.now();
    if(!appContext.sessionDurationLastTick){
      appContext.sessionDurationLastTick=now;
      return;
    }
    const elapsed=Math.round((now-appContext.sessionDurationLastTick)/1000);
    appContext.sessionDurationLastTick=now;
    if(elapsed<=0) return;

    // Normal heartbeats only count while the tab is visible. When visibility
    // has just changed to hidden/pagehide, flushVisibleTime records the time
    // accumulated immediately BEFORE the browser hid the page.
    if(document.hidden && !flushVisibleTime) return;
    const seconds=Math.min(20,elapsed);
    if(flushVisibleTime && useBeacon){
      appContext.beaconSessionActiveSeconds(seconds);
    }else{
      appContext.recordSessionActiveSeconds(seconds,{allowHidden:flushVisibleTime});
    }
  }

function startSessionDurationTracking(){
    if(appContext.isBuyerAnalyticsBlocked()) return;
    if(appContext.sessionDurationHeartbeatTimer) clearInterval(appContext.sessionDurationHeartbeatTimer);
    appContext.sessionDurationLastTick=Date.now();
    appContext.sessionDurationHeartbeatTimer=setInterval(appContext.sessionDurationHeartbeatTick,appContext.SESSION_DURATION_HEARTBEAT_MS);
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden){
        appContext.sessionDurationHeartbeatTick({flushVisibleTime:true,useBeacon:true});
      }else{
        appContext.sessionDurationLastTick=Date.now();
      }
    },{passive:true});
    window.addEventListener("pagehide",()=>appContext.sessionDurationHeartbeatTick({flushVisibleTime:true,useBeacon:true}),{passive:true});
  }

function formatActiveDuration(seconds){
    const total=Math.max(0,Math.round(Number(seconds)||0));
    const minutes=Math.floor(total/60);
    const secs=total%60;
    if(minutes<1) return `${secs}s`;
    if(minutes<60) return `${minutes}m ${String(secs).padStart(2,"0")}s`;
    const hours=Math.floor(minutes/60);
    const rem=minutes%60;
    return `${hours}h ${rem}m`;
  }

function normalizedInventorySearchTerm(value){
    return String(value||"").trim().replace(/\s+/g," ").slice(0,100);
  }

function scheduleInventorySearchAnalytics(){
    clearTimeout(appContext.inventorySearchAnalyticsTimer);
    appContext.inventorySearchAnalyticsTimer=setTimeout(async()=>{
      if(appContext.isBuyerAnalyticsBlocked()) return;

      const term=appContext.normalizedInventorySearchTerm(appContext.$("search")?.value);
      if(term.length<2) return;

      const key=term.toLowerCase();
      if(key===appContext.lastRecordedInventorySearch) return;

      // getFiltered() reflects the same filters/results currently visible.
      const resultCount=typeof appContext.getFiltered==="function" ? appContext.getFiltered().length : 0;
      const visitorId=appContext.getVisitorId();
      if(!visitorId) return;

      try{
        const {error}=await appContext.supabaseClient.rpc("record_inventory_search",{
          p_visitor_id:visitorId,
          p_search_term:term,
          p_result_count:resultCount
        });
        if(!error) appContext.lastRecordedInventorySearch=key;
        else console.warn("Search analytics unavailable:",error);
      }catch(error){
        console.warn("Search analytics unavailable:",error);
      }
    },900);
  }

function currentVisitorTrafficSource(){
    const ref=String(document.referrer||"").trim().toLowerCase();

    if(!ref) return "Direct";

    try{
      const host=new URL(ref).hostname.toLowerCase();

      if(host===location.hostname) return "Direct";
      if(host.includes("facebook.com") || host.includes("fb.com") || host.includes("l.facebook.com")) return "Facebook";
      if(host.includes("instagram.com") || host.includes("l.instagram.com")) return "Instagram";
      if(host.includes("google.")) return "Google";
      if(host.includes("carousell.")) return "Carousell";
      return "Other";
    }catch{
      return "Other";
    }
  }

function currentVisitorDeviceType(){
    const ua=String(navigator.userAgent||"");
    const platform=String(navigator.platform||"");
    const touchPoints=Number(navigator.maxTouchPoints||0);

    // Modern iPadOS often reports itself as Macintosh.
    if(/iPad|Tablet|PlayBook|Silk/i.test(ua) || (platform==="MacIntel" && touchPoints>1)){
      return "Tablet";
    }

    if(
      /Mobi|Android|iPhone|iPod|Windows Phone|IEMobile|Opera Mini/i.test(ua)
    ){
      return "Mobile";
    }

    return "Desktop";
  }

async function recordWebsiteVisit(){
    // Owner activity and explicitly excluded personal browsers should not
    // inflate buyer-facing traffic analytics.
    if(appContext.isBuyerAnalyticsBlocked()) return false;

    try{
      if(appContext.sessionStorage.getItem(appContext.WEBSITE_VISIT_SESSION_KEY)==="1") return true;

      const visitorId=appContext.getVisitorId();
      const {error}=await appContext.supabaseClient.rpc("record_site_visit",{
        p_visitor_id:visitorId
      });

      if(error){
        // Migration may not have been installed yet. Fail quietly for visitors.
        console.warn("Website visit tracking unavailable:",error);
        return false;
      }

      if(appContext.isAnalyticsExcludedDevice()) return false;

      // Country tracking is deliberately separate from the normal visit counter.
      // If geolocation fails, Website Visits still works normally.
      try{
        const {error:countryError}=await appContext.supabaseClient.functions.invoke("record-visitor-country",{
          body:{visitor_id:visitorId}
        });
        if(countryError){
          console.warn("Visitor country tracking unavailable:",countryError);
        }
      }catch(countryError){
        console.warn("Visitor country tracking unavailable:",countryError);
      }

      // Device tracking stores only a broad category, never the full User-Agent.
      // Failure here must not affect the normal Website Visit counter.
      try{
        const {error:deviceError}=await appContext.supabaseClient.rpc("record_site_visit_device",{
          p_visitor_id:visitorId,
          p_device_type:appContext.currentVisitorDeviceType()
        });
        if(deviceError){
          console.warn("Visitor device tracking unavailable:",deviceError);
        }
      }catch(deviceError){
        console.warn("Visitor device tracking unavailable:",deviceError);
      }

      // Traffic-source tracking stores only a broad category, never the full referrer URL.
      if(appContext.isAnalyticsExcludedDevice()) return false;
      try{
        const {error:sourceError}=await appContext.supabaseClient.rpc("record_site_visit_source",{
          p_visitor_id:visitorId,
          p_source_type:appContext.currentVisitorTrafficSource()
        });
        if(sourceError){
          console.warn("Visitor traffic-source tracking unavailable:",sourceError);
        }
      }catch(sourceError){
        console.warn("Visitor traffic-source tracking unavailable:",sourceError);
      }

      appContext.sessionStorage.setItem(appContext.WEBSITE_VISIT_SESSION_KEY,"1");
      return true;
    }catch(error){
      console.warn("Website visit tracking unavailable:",error);
      return false;
    }
  }

async function fetchWebsiteVisitSeries(start,end){
    const {data,error}=await appContext.supabaseClient.rpc("get_site_visit_series_my_sg",{
      p_start:start.toISOString(),
      p_end:end.toISOString()
    });

    if(error){
      const message=`${error.message||""} ${error.details||""}`.toLowerCase();

      if(
        message.includes("get_site_visit_series_my_sg") ||
        message.includes("function") ||
        message.includes("schema cache")
      ){
        console.warn("MY/SG website visit timezone RPC is not installed yet:",error);
      }else{
        console.warn("Website visit insights unavailable:",error);
      }

      return [];
    }

    return Array.isArray(data) ? data : [];
  }

async function fetchWebsiteVisitCountries(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_site_visit_country_totals",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_site_visit_country_totals") ||
          message.includes("function") ||
          message.includes("schema cache");

        if(!unavailable){
          console.warn("Visitor country insights unavailable:",error);
        }

        return {supported:false,rows:[]};
      }

      return {
        supported:true,
        rows:Array.isArray(data)?data:[]
      };
    }catch(error){
      console.warn("Visitor country insights unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

async function fetchCountryCardViewInsights(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_country_card_view_insights",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_country_card_view_insights") ||
          message.includes("function") ||
          message.includes("schema cache");

        if(!unavailable){
          console.warn("Country card-demand insights unavailable:",error);
        }

        return {supported:false,rows:[]};
      }

      return {
        supported:true,
        rows:Array.isArray(data)?data:[]
      };
    }catch(error){
      console.warn("Country card-demand insights unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

async function fetchWebsiteVisitAccessTime(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_site_visit_access_time_my_sg",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_site_visit_access_time_my_sg") ||
          message.includes("function") ||
          message.includes("schema cache");

        if(!unavailable){
          console.warn("Visitor access-time insights unavailable:",error);
        }

        return {supported:false,hours:[],weekdays:[]};
      }

      const rows=Array.isArray(data)?data:[];
      return {
        supported:true,
        hours:rows
          .filter(row=>row.bucket_type==="hour")
          .sort((a,b)=>Number(a.bucket_no)-Number(b.bucket_no)),
        weekdays:rows
          .filter(row=>row.bucket_type==="weekday")
          .sort((a,b)=>Number(a.bucket_no)-Number(b.bucket_no))
      };
    }catch(error){
      console.warn("Visitor access-time insights unavailable:",error);
      return {supported:false,hours:[],weekdays:[]};
    }
  }

async function fetchDiscoverySourceSummary(start,end){
    try{
      if(!appContext.isOwnerAuthenticated?.()) return {supported:false,rows:[]};

      const {data,error}=await appContext.supabaseClient.rpc("get_card_discovery_summary",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_card_discovery_summary") ||
          message.includes("function") ||
          message.includes("schema cache");

        if(!unavailable){
          console.warn("Discovery source summary unavailable:",error);
        }
        return {supported:false,rows:[]};
      }

      return {supported:true,rows:Array.isArray(data)?data:[]};
    }catch(error){
      console.warn("Discovery source summary unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

async function fetchWebsiteVisitDevices(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_site_visit_device_totals",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_site_visit_device_totals") ||
          message.includes("function") ||
          message.includes("schema cache");

        if(!unavailable){
          console.warn("Visitor device insights unavailable:",error);
        }

        return {supported:false,rows:[]};
      }

      return {
        supported:true,
        rows:Array.isArray(data)?data:[]
      };
    }catch(error){
      console.warn("Visitor device insights unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

async function fetchWebsiteVisitSources(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_site_visit_source_totals",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_site_visit_source_totals") ||
          message.includes("function") ||
          message.includes("schema cache");

        if(!unavailable){
          console.warn("Visitor traffic-source insights unavailable:",error);
        }

        return {supported:false,rows:[]};
      }

      return {
        supported:true,
        rows:Array.isArray(data)?data:[]
      };
    }catch(error){
      console.warn("Visitor traffic-source insights unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

async function fetchInventorySearchInsights(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_inventory_search_insights",{
        p_start:start.toISOString(),p_end:end.toISOString()
      });
      if(error) return {supported:false,rows:[]};
      return {supported:true,rows:Array.isArray(data)?data:[]};
    }catch(error){
      console.warn("Search insights unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

async function fetchReturningVisitorInsights(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_returning_visitor_insights",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_returning_visitor_insights") ||
          message.includes("function") ||
          message.includes("schema cache");
        if(!unavailable) console.warn("Returning visitor insights unavailable:",error);
        return {supported:false,row:null};
      }

      const row=Array.isArray(data)?data[0]:data;
      return {supported:true,row:row||null};
    }catch(error){
      console.warn("Returning visitor insights unavailable:",error);
      return {supported:false,row:null};
    }
  }

async function fetchSessionDurationInsights(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_site_session_duration_insights",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });
      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=message.includes("get_site_session_duration_insights") || message.includes("function") || message.includes("schema cache");
        if(!unavailable) console.warn("Session duration insights unavailable:",error);
        return {supported:false,row:null};
      }
      const row=Array.isArray(data)?data[0]:data;
      return {supported:true,row:row||null};
    }catch(error){
      console.warn("Session duration insights unavailable:",error);
      return {supported:false,row:null};
    }
  }

async function fetchEngagedVisitSeries(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_engaged_visit_series_my_sg",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_engaged_visit_series_my_sg") ||
          message.includes("function") ||
          message.includes("schema cache");
        if(!unavailable) console.warn("Engaged visit series unavailable:",error);
        return {supported:false,rows:[]};
      }

      return {supported:true,rows:Array.isArray(data)?data:[]};
    }catch(error){
      console.warn("Engaged visit series unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

function visitorCountryName(code){
    const safe=String(code||"").trim().toUpperCase();
    if(!safe || safe==="XX") return "Unknown";

    try{
      if(typeof Intl.DisplayNames==="function"){
        const names=new Intl.DisplayNames(["en"],{type:"region"});
        return names.of(safe)||safe;
      }
    }catch{}

    return safe;
  }

function dateRangeForPreset(preset){
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    if(preset === "today"){
      start.setHours(0,0,0,0);
    }else if(preset === "7d"){
      start.setDate(start.getDate() - 6);
      start.setHours(0,0,0,0);
    }else if(preset === "30d"){
      start.setDate(start.getDate() - 29);
      start.setHours(0,0,0,0);
    }else if(preset === "month"){
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }else if(preset === "all"){
      start = new Date("2000-01-01T00:00:00");
    }
    return { start, end };
  }

async function fetchInsights(start,end,{silent=false}={}){
    const {data,error}=await appContext.supabaseClient.rpc("get_card_insights",{
      p_start:start.toISOString(),
      p_end:end.toISOString()
    });
    if(error){
      console.error("Insights error:",error);
      if(!silent) appContext.showToast("Could not load insights");
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

async function fetchViewSeries(start, end){
    const { data, error } = await appContext.supabaseClient.rpc("get_card_view_series", {
      p_start: start.toISOString(),
      p_end: end.toISOString()
    });
    if(error){
      console.error("Series error:", error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }

async function fetchRecentQualifiedCardViews(start,end,status="",game="",limit=20){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_recent_qualified_card_views",{
        p_start:start.toISOString(),
        p_end:end.toISOString(),
        p_status:status || null,
        p_game:game || null,
        p_limit:Math.max(1,Math.min(50,Number(limit)||20))
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("get_recent_qualified_card_views") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.recentQualifiedViewsBackendState="unavailable";
        }else{
          appContext.recentQualifiedViewsBackendState="error";
          console.warn("Recently viewed Insights unavailable:",error);
        }
        return {supported:false,rows:[]};
      }

      appContext.recentQualifiedViewsBackendState="available";
      return {supported:true,rows:Array.isArray(data)?data:[]};
    }catch(error){
      console.warn("Recently viewed Insights unavailable:",error);
      appContext.recentQualifiedViewsBackendState="error";
      return {supported:false,rows:[]};
    }
  }

function insightRecentViewTimeLabel(value){
    const time=new Date(value||"").getTime();
    if(!Number.isFinite(time)) return "Unknown time";

    const delta=Math.max(0,Date.now()-time);
    const minute=60*1000;
    const hour=60*minute;
    const day=24*hour;

    if(delta<minute) return "Just now";
    if(delta<hour){
      const n=Math.max(1,Math.floor(delta/minute));
      return `${n} min ago`;
    }
    if(delta<day){
      const n=Math.max(1,Math.floor(delta/hour));
      return `${n} hr${n===1?"":"s"} ago`;
    }
    if(delta<7*day){
      const n=Math.max(1,Math.floor(delta/day));
      return `${n} day${n===1?"":"s"} ago`;
    }

    try{
      return new Date(time).toLocaleString("en-MY",{
        day:"2-digit",
        month:"short",
        year:"numeric",
        hour:"2-digit",
        minute:"2-digit"
      });
    }catch{
      return new Date(time).toLocaleString();
    }
  }

function insightRecentCardMeta(card){
    if(!card) return "";
    const pieces=[];

    const grades=appContext.validGradingEntries(card);
    if(grades.length){
      const labels=[...new Set(grades.map(entry=>{
        const company=String(entry?.company||"").trim().toUpperCase();
        const grade=String(entry?.grade??"").trim();
        return [company,grade].filter(Boolean).join(" ");
      }).filter(Boolean))];
      if(labels.length) pieces.push(labels.join(" · "));
    }else if(appContext.normalizeFilterValue(card.format)==="sealed"){
      pieces.push("Sealed");
    }else if(String(card.condition||"").trim()){
      pieces.push(String(card.condition).trim());
    }

    if(card.card_code) pieces.push(String(card.card_code).trim());
    return pieces.join(" · ");
  }

async function fetchFilteredQualifiedViewSeries(start,end,status="",game=""){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_filtered_qualified_card_view_series",{
        p_start:start.toISOString(),
        p_end:end.toISOString(),
        p_status:status || null,
        p_game:game || null
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        const unavailable=
          message.includes("get_filtered_qualified_card_view_series") ||
          message.includes("function") ||
          message.includes("schema cache");
        if(!unavailable) console.warn("Filtered qualified view series error:",error);
        return {supported:false,rows:[]};
      }

      return {supported:true,rows:Array.isArray(data)?data:[]};
    }catch(error){
      console.warn("Filtered qualified view series unavailable:",error);
      return {supported:false,rows:[]};
    }
  }

function alignWebsiteVisitSeriesToCardSeries(cardSeries, websiteSeries){
    const cards=Array.isArray(cardSeries) ? cardSeries : [];
    const visits=Array.isArray(websiteSeries) ? websiteSeries : [];

    // If Website Visits has no rows, keep the graph empty.
    // Do not borrow date buckets from the Qualified Views timeline.
    if(!visits.length) return [];
    if(!cards.length) return visits;

    const parseBucket=value=>{
      const t=new Date(String(value||"")).getTime();
      return Number.isFinite(t) ? t : null;
    };

    const visitRows=visits
      .map(row=>({
        ...row,
        _time:parseBucket(row.bucket),
        _visits:Number(row.visits||0)
      }))
      .filter(row=>row._time!=null)
      .sort((a,b)=>a._time-b._time);

    return cards.map((row,index)=>{
      const start=parseBucket(row.bucket);
      const next=index+1<cards.length ? parseBucket(cards[index+1].bucket) : null;

      if(start!=null){
        const total=visitRows.reduce((sum,visit)=>{
          if(visit._time < start) return sum;
          if(next!=null && visit._time >= next) return sum;
          return sum+visit._visits;
        },0);

        return {
          bucket:row.bucket,
          label:row.label || row.bucket,
          visits:total
        };
      }

      const fallback=visits[index]||{};
      return {
        bucket:row.bucket,
        label:row.label || row.bucket,
        visits:Number(fallback.visits||0)
      };
    });
  }

function insightRowKey(row){
    const id=appContext.safeCardId(row?.card_id || row?.id || "");
    if(id) return `id:${id}`;
    return `name:${appContext.normalizeFilterValue(row?.name)}|${appContext.normalizeFilterValue(row?.game)}`;
  }

function insightCardForRow(row){
    const id=appContext.safeCardId(row?.card_id || row?.id || "");
    if(id){
      const direct=appContext.getCardById(id);
      if(direct) return direct;
    }

    const name=appContext.normalizeFilterValue(row?.name);
    const game=appContext.normalizeFilterValue(row?.game);
    return appContext.cards.find(card=>
      appContext.normalizeFilterValue(card?.name)===name &&
      (!game || appContext.normalizeFilterValue(card?.game)===game)
    ) || null;
  }

function insightStatusLabel(row){
    const card=appContext.insightCardForRow(row);
    if(!card) return "Unknown";

    const lifecycle=appContext.cardLifecycle(card);
    if(lifecycle==="draft") return "Hidden";
    if(lifecycle==="archived") return "Archived";

    const availability=appContext.canonicalAvailability(card.availability);
    return availability==="Collection (NFS)" ? "Collection (NFS)" : availability;
  }

function previousInsightsRange(start,end,preset){
    if(preset==="all") return null;

    const startMs=start.getTime();
    const endMs=end.getTime();
    if(!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs<=startMs) return null;

    const span=endMs-startMs;
    const previousEnd=new Date(startMs-1);
    const previousStart=new Date(previousEnd.getTime()-span);
    return {start:previousStart,end:previousEnd};
  }

function insightTrendMeta(row,previousRow){
    const current=Math.max(0,Number(row?.unique_views||0));
    const previous=Math.max(0,Number(previousRow?.unique_views||0));
    const delta=current-previous;

    if(previous===0){
      if(current>=3) return {className:"hot",label:"New ↑",score:1000+current,current,previous,pct:null};
      if(current>0) return {className:"",label:"New",score:100+current,current,previous,pct:null};
      return {className:"low",label:"No interest",score:-100,current,previous,pct:null};
    }

    const pct=(delta/previous)*100;

    if(current>=3 && delta>=2 && pct>=50){
      return {className:"hot",label:`+${Math.round(pct)}% ↑`,score:pct,current,previous,pct};
    }
    if(delta>=1 && pct>=20){
      return {className:"rising",label:`+${Math.round(pct)}%`,score:pct,current,previous,pct};
    }
    if(delta<=-1 && pct<=-30){
      return {className:"low",label:`${Math.round(pct)}% ↓`,score:pct,current,previous,pct};
    }

    const prefix=pct>0 ? "+" : "";
    return {
      className:"",
      label:Math.abs(pct)<10 ? "Stable" : `${prefix}${Math.round(pct)}%`,
      score:pct,
      current,
      previous,
      pct
    };
  }

  Object.assign(appContext,{analyticsExclusionCookieValue,analyticsUserAgent,isKnownAutomatedSocialFetcher,isFacebookInstagramAnalyticsSession,socialAnalyticsNeedsHumanInteraction,isBuyerAnalyticsBlocked,resumeDeferredSocialAnalytics,noteHumanAnalyticsInteraction,setupSocialAnalyticsHumanInteractionGate,hasAnalyticsExclusionLocalStorage,hasAnalyticsExclusionCookie,isAnalyticsExcludedDevice,setAnalyticsExcludedDevice,analyticsExclusionTokenFromUrl,removeAnalyticsExclusionTokenFromUrl,consumeAnalyticsExclusionLinkIfPresent,newAnalyticsExclusionToken,newAnalyticsExclusionPairingCode,analyticsExclusionPairingUrl,analyticsPairingCodeFromUrl,removeAnalyticsPairingCodeFromUrl,consumeAnalyticsExclusionQrIfPresent,createAnalyticsExclusionPairingCode,consumeAnalyticsExclusionPairingCode,createAnalyticsExclusionLink,getVisitorId,cancelPendingCardViewQualification,sendQualifiedCardViewEvent,recordCardViewEvent,recordQualifiedViewDiscoveryAttribution,engagementDedupeWindowMs,readEngagementDedupe,shouldSkipEngagementEvent,recordCardEngagement,readOverviewPhotoInteractionDedupe,overviewPhotoInteractionAlreadyRecorded,markOverviewPhotoInteractionRecorded,recordOverviewPhotoInteraction,fetchOverviewPhotoInsights,fetchCardEngagementInsights,fetchOwnerCardConversionSummary,freshQualifiedViewCount,freshQualifiedViewDisplay,refreshQualifiedViewTotals,saveSaleConversionSnapshot,fetchSaleConversionSnapshots,insightContactMetrics,insightInterestScore,captureSaleConversionSnapshot,getAnalyticsSessionId,recordAnalyticsSession,incrementAnalyticsSessionQualifiedView,sessionDurationPayload,recordSessionActiveSeconds,beaconSessionActiveSeconds,sessionDurationHeartbeatTick,startSessionDurationTracking,formatActiveDuration,normalizedInventorySearchTerm,scheduleInventorySearchAnalytics,currentVisitorTrafficSource,currentVisitorDeviceType,recordWebsiteVisit,fetchWebsiteVisitSeries,fetchWebsiteVisitCountries,fetchCountryCardViewInsights,fetchWebsiteVisitAccessTime,fetchDiscoverySourceSummary,fetchWebsiteVisitDevices,fetchWebsiteVisitSources,fetchInventorySearchInsights,fetchReturningVisitorInsights,fetchSessionDurationInsights,fetchEngagedVisitSeries,visitorCountryName,dateRangeForPreset,fetchInsights,fetchViewSeries,fetchRecentQualifiedCardViews,insightRecentViewTimeLabel,insightRecentCardMeta,fetchFilteredQualifiedViewSeries,alignWebsiteVisitSeriesToCardSeries,insightRowKey,insightCardForRow,insightStatusLabel,previousInsightsRange,insightTrendMeta});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.CARD_VIEW_QUALIFY_MS = 2000;

  appContext.cardViewQualificationToken = 0;

  appContext.discoveryAttributionBackendState = "unknown";

  appContext.CARD_ENGAGEMENT_EVENT_TYPES = new Set([
    "favorite_add",
    "favorite_remove",
    "contact_open",
    "contact_platform",
    "inquiry_copy",
    "image_expand",
    "share",
    "download"
  ]);

  appContext.CARD_ENGAGEMENT_DEDUPE_KEY = "collect_tcg_engagement_dedupe_fresh_v1";

  appContext.engagementTrackingBackendState = "unknown";

  appContext.OVERVIEW_PHOTO_INTERACTION_KEY = "collect_tcg_overview_photo_interest_v1";

  appContext.overviewPhotoTrackingBackendState = "unknown";

  appContext.qualifiedViewTotalsBackendState = "unknown";

  appContext.qualifiedViewTotalsByCard = new Map();

  appContext.ownerCardConversionSummaryCache = new Map();

  appContext.saleSnapshotBackendState = "unknown";

window.collectTrackEngagement=(eventType,cardId,platform="")=>
    appContext.recordCardEngagement(cardId,eventType,platform);

window.collectCurrentDetailsCardId=()=>appContext.safeCardId(appContext.detailsCardId||"");

  appContext.WEBSITE_VISIT_SESSION_KEY = "collect_tcg_website_visit_recorded_fresh_v1";

  appContext.ANALYTICS_HUMAN_INTERACTION_SESSION_KEY = "collect_tcg_human_interaction_v1";

  appContext.analyticsHumanInteractionObserved = false;
  try{
    appContext.analyticsHumanInteractionObserved=
      appContext.sessionStorage.getItem(appContext.ANALYTICS_HUMAN_INTERACTION_SESSION_KEY)==="1";
  }catch{}

  appContext.analyticsDeferredSocialStartupAttempted = false;

  appContext.analyticsDeferredSocialResumeStarted = false;

  appContext.analyticsHumanInteractionHandlersInstalled = false;

  appContext.setupSocialAnalyticsHumanInteractionGate();

  appContext.ANALYTICS_SESSION_ID_KEY = "collect_tcg_analytics_session_id_v1";

  appContext.SESSION_DURATION_HEARTBEAT_MS = 10000;

  appContext.sessionDurationHeartbeatTimer = null;

  appContext.sessionDurationLastTick = 0;

  appContext.sessionDurationBackendState = "unknown";

  appContext.inventorySearchAnalyticsTimer = null;

  appContext.lastRecordedInventorySearch = "";

  appContext.recentQualifiedViewsBackendState = "unknown";
}
