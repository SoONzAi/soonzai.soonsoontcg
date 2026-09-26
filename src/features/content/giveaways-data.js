/** V93 beta: features/content/giveaways-data. Shared dependencies are explicit on appContext. */
export function register(appContext){
function giveawayFromDb(row){
    return {
      id: row.id,
      title: row.title || "",
      card_name: row.card_name || "",
      image_url: row.image_url || "",
      images: (() => {
        const out=[];
        const add=value=>{
          const url=appContext.safeHttpUrl(value||"");
          if(url && !out.includes(url)) out.push(url);
        };
        if(Array.isArray(row.images)) row.images.forEach(add);
        add(row.image_url);
        return out.slice(0,10);
      })(),
      status: row.status || "active",
      ends_at: row.ends_at || null,
      how_to_enter: row.how_to_enter || "",
      details: row.details || "",
      winner_name: row.winner_name || "",
      winner_profile_url: row.winner_profile_url || "",
      winner_sort_order: Number.isFinite(Number(row.winner_sort_order))
        ? Number(row.winner_sort_order)
        : null,
      is_hidden: row.is_hidden === true,
      giveaway_code: String(row.giveaway_code || "").trim(),
      entry_form_url: appContext.safeHttpUrl(row.entry_form_url || ""),
      require_facebook: row.require_facebook !== false,
      require_instagram: row.require_instagram !== false,
      require_comment: row.require_comment !== false,
      require_website_code: row.require_website_code !== false,
      facebook_post_url: appContext.safeHttpUrl(row.facebook_post_url || ""),
      instagram_post_url: appContext.safeHttpUrl(row.instagram_post_url || ""),
      bonus_join_facebook_group: row.bonus_join_facebook_group === true,
      bonus_share_facebook: row.bonus_share_facebook === true,
      bonus_tag_friends: row.bonus_tag_friends === true,
      bonus_share_instagram_story: row.bonus_share_instagram_story === true,
      gave_away_date: String(row.gave_away_date || "").slice(0,10),
      winner_announced_at: row.winner_announced_at || null,
      created_at: row.created_at || null
    };
  }

function collectSocialLinksHtml(extraClass=""){
    return `
      <div class="collect-social-links ${appContext.escapeHtml(extraClass)}" aria-label="Collect TCG social links">
        <a href="${appContext.COLLECT_SOCIAL_LINKS.instagram}" target="_blank" rel="noopener noreferrer" class="collect-social-icon" aria-label="Instagram" title="Instagram"><span aria-hidden="true">◎</span><small>IG</small></a>
        <a href="${appContext.COLLECT_SOCIAL_LINKS.facebook}" target="_blank" rel="noopener noreferrer" class="collect-social-icon" aria-label="Facebook" title="Facebook"><span aria-hidden="true">f</span><small>FB</small></a>
        <a href="${appContext.COLLECT_SOCIAL_LINKS.carousellMY}" target="_blank" rel="noopener noreferrer" class="collect-social-icon" aria-label="Carousell Malaysia" title="Carousell Malaysia"><span aria-hidden="true">C</span><small>MY</small></a>
        <a href="${appContext.COLLECT_SOCIAL_LINKS.carousellSG}" target="_blank" rel="noopener noreferrer" class="collect-social-icon" aria-label="Carousell Singapore" title="Carousell Singapore"><span aria-hidden="true">C</span><small>SG</small></a>
      </div>
    `;
  }

function collectSocialPostLines(){
    return [
      "SOCIALS",
      `Instagram: ${appContext.COLLECT_SOCIAL_LINKS.instagram}`,
      `Facebook: ${appContext.COLLECT_SOCIAL_LINKS.facebook}`,
      `Carousell Malaysia: ${appContext.COLLECT_SOCIAL_LINKS.carousellMY}`,
      `Carousell Singapore: ${appContext.COLLECT_SOCIAL_LINKS.carousellSG}`
    ];
  }

function safePublicProfileUrl(value){
    const raw=String(value||"").trim();
    if(!raw) return "";
    try{
      const url=new URL(raw);
      if(url.protocol!=="https:" && url.protocol!=="http:") return "";
      return url.href;
    }catch{
      return "";
    }
  }

async function recordGiveawayEngagement(eventType,giveawayId=""){
    try{
      if(appContext.isOwnerMode() || appContext.isAnalyticsExcludedDevice()) return false;
      const visitorId=appContext.getVisitorId();
      if(!visitorId) return false;

      const {error}=await appContext.supabaseClient.rpc("record_giveaway_engagement",{
        p_visitor_id:visitorId,
        p_giveaway_id:String(giveawayId||""),
        p_event_type:String(eventType||"")
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("record_giveaway_engagement") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.giveawayGrowthAnalyticsSupported=false;
        }
        return false;
      }

      appContext.giveawayGrowthAnalyticsSupported=true;
      return true;
    }catch{
      return false;
    }
  }

function recordGiveawayPageViewOnce(){
    if(appContext.isOwnerMode() || appContext.isAnalyticsExcludedDevice()) return;
    try{
      if(appContext.sessionStorage.getItem(appContext.GIVEAWAY_PAGE_VIEW_SESSION_KEY)==="1") return;
      appContext.sessionStorage.setItem(appContext.GIVEAWAY_PAGE_VIEW_SESSION_KEY,"1");
    }catch{}
    appContext.recordGiveawayEngagement("page_view").catch(()=>{});
  }

async function fetchGiveawayPerformance(start,end){
    try{
      const {data,error}=await appContext.supabaseClient.rpc("get_giveaway_performance",{
        p_start:start.toISOString(),
        p_end:end.toISOString()
      });

      if(error){
        const message=`${error.message||""} ${error.details||""}`.toLowerCase();
        if(
          message.includes("get_giveaway_performance") ||
          message.includes("function") ||
          message.includes("schema cache")
        ){
          appContext.giveawayGrowthAnalyticsSupported=false;
        }
        return {supported:false,row:null};
      }

      appContext.giveawayGrowthAnalyticsSupported=true;
      const row=Array.isArray(data) ? (data[0]||null) : (data||null);
      return {supported:true,row};
    }catch{
      return {supported:false,row:null};
    }
  }

async function loadGiveaways(){
    const columnSets=[
      {
        columns:appContext.GIVEAWAY_PUBLIC_COLUMNS_MULTI,
        profile:true,
        sort:true,
        hidden:true,
        growth:true,
        bonus:true,
        facebookGroupBonus:true,
        gaveAwayDate:true,
        images:true
      },
      {
        columns:appContext.GIVEAWAY_PUBLIC_COLUMNS,
        profile:true,
        sort:true,
        hidden:true,
        growth:true,
        bonus:true,
        facebookGroupBonus:true,
        gaveAwayDate:true,
        images:false
      },
      {
        columns:appContext.GIVEAWAY_PUBLIC_COLUMNS_PRE_FB_GROUP_BONUS,
        profile:true,
        sort:true,
        hidden:true,
        growth:true,
        bonus:true,
        facebookGroupBonus:false,
        gaveAwayDate:true,
        images:false
      },
      {
        columns:appContext.GIVEAWAY_PUBLIC_COLUMNS_PRE_GAVE_AWAY_DATE,
        profile:true,
        sort:true,
        hidden:true,
        growth:true,
        bonus:true,
        facebookGroupBonus:false,
        gaveAwayDate:false
      },
      {
        columns:appContext.GIVEAWAY_PUBLIC_COLUMNS_PRE_BONUS,
        profile:true,
        sort:true,
        hidden:true,
        growth:true,
        bonus:false,
        facebookGroupBonus:false
      },
      {
        columns:appContext.GIVEAWAY_PUBLIC_COLUMNS_PRE_GROWTH,
        profile:true,
        sort:true,
        hidden:true,
        growth:false
      },
      {
        columns:"id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_profile_url,winner_sort_order,winner_announced_at,created_at",
        profile:true,
        sort:true,
        hidden:false
      },
      {
        columns:appContext.GIVEAWAY_PUBLIC_COLUMNS_PROFILE,
        profile:true,
        sort:false,
        hidden:false
      },
      {
        columns:"id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_sort_order,winner_announced_at,created_at",
        profile:false,
        sort:true,
        hidden:false
      },
      {
        columns:appContext.GIVEAWAY_PUBLIC_COLUMNS_BASE,
        profile:false,
        sort:false,
        hidden:false
      }
    ];

    let data=null;
    let error=null;
    let selected=null;

    for(const option of columnSets){
      const result=await appContext.supabaseClient
        .from("giveaways")
        .select(option.columns)
        .order("created_at",{ascending:false});

      data=result.data;
      error=result.error;

      if(!error){
        selected=option;
        break;
      }

      const optionalMissing=
        appContext.optionalColumnUnavailable(error,"winner_profile_url") ||
        appContext.optionalColumnUnavailable(error,"winner_sort_order") ||
        appContext.optionalColumnUnavailable(error,"is_hidden") ||
        appContext.optionalColumnUnavailable(error,"giveaway_code") ||
        appContext.optionalColumnUnavailable(error,"entry_form_url") ||
        appContext.optionalColumnUnavailable(error,"require_facebook") ||
        appContext.optionalColumnUnavailable(error,"require_instagram") ||
        appContext.optionalColumnUnavailable(error,"require_comment") ||
        appContext.optionalColumnUnavailable(error,"require_website_code") ||
        appContext.optionalColumnUnavailable(error,"facebook_post_url") ||
        appContext.optionalColumnUnavailable(error,"instagram_post_url") ||
        appContext.optionalColumnUnavailable(error,"bonus_join_facebook_group") ||
        appContext.optionalColumnUnavailable(error,"bonus_share_facebook") ||
        appContext.optionalColumnUnavailable(error,"bonus_tag_friends") ||
        appContext.optionalColumnUnavailable(error,"bonus_share_instagram_story") ||
        appContext.optionalColumnUnavailable(error,"gave_away_date") ||
        appContext.optionalColumnUnavailable(error,"images");

      if(!optionalMissing) break;
    }

    if(error){
      console.error("Load giveaways error:", error);
      appContext.giveaways = [];
      return false;
    }

    appContext.giveawayWinnerProfileUrlSupported=!!selected?.profile;
    appContext.giveawayWinnerSortOrderSupported=!!selected?.sort;
    appContext.giveawayHiddenSupported=!!selected?.hidden;
    appContext.giveawayGrowthFieldsSupported=!!selected?.growth;
    appContext.giveawayBonusFieldsSupported=!!selected?.bonus;
    appContext.giveawayFacebookGroupBonusSupported=!!selected?.facebookGroupBonus;
    appContext.giveawayGaveAwayDateSupported=!!selected?.gaveAwayDate;
    appContext.giveawayImagesSupported=!!selected?.images;

    appContext.giveaways = (data || []).map(appContext.giveawayFromDb);
    return true;
  }

async function saveGiveaway(payload, id){
    if(!appContext.requireOwner()) return { data:null, error:new Error("Owner login required") };

    async function runWrite(writePayload,columns){
      if(id){
        return await appContext.supabaseClient
          .from("giveaways")
          .update(writePayload)
          .eq("id", id)
          .select(columns)
          .single();
      }
      return await appContext.supabaseClient
        .from("giveaways")
        .insert(writePayload)
        .select(columns)
        .single();
    }

    function currentColumns(){
      const cols=[
        "id","title","card_name","image_url",
        ...(appContext.giveawayImagesSupported!==false ? ["images"] : []),
        "status","ends_at",
        "how_to_enter","details","winner_name"
      ];

      if(appContext.giveawayWinnerProfileUrlSupported!==false) cols.push("winner_profile_url");
      if(appContext.giveawayWinnerSortOrderSupported!==false) cols.push("winner_sort_order");
      if(appContext.giveawayHiddenSupported!==false) cols.push("is_hidden");
      if(appContext.giveawayGrowthFieldsSupported!==false){
        cols.push(
          "giveaway_code","entry_form_url","require_facebook",
          "require_instagram","require_website_code"
        );
      }
      if(appContext.giveawayBonusFieldsSupported!==false){
        cols.push(
          "require_comment","facebook_post_url","instagram_post_url",
          "bonus_share_facebook","bonus_tag_friends","bonus_share_instagram_story"
        );
        if(appContext.giveawayFacebookGroupBonusSupported!==false){
          cols.push("bonus_join_facebook_group");
        }
      }
      if(appContext.giveawayGaveAwayDateSupported!==false) cols.push("gave_away_date");

      cols.push("winner_announced_at","created_at");
      return cols.join(",");
    }

    let writePayload={...payload};

    if(appContext.giveawayWinnerProfileUrlSupported===false) delete writePayload.winner_profile_url;
    if(appContext.giveawayWinnerSortOrderSupported===false) delete writePayload.winner_sort_order;
    if(appContext.giveawayHiddenSupported===false) delete writePayload.is_hidden;
    if(appContext.giveawayGrowthFieldsSupported===false){
      delete writePayload.giveaway_code;
      delete writePayload.entry_form_url;
      delete writePayload.require_facebook;
      delete writePayload.require_instagram;
      delete writePayload.require_website_code;
    }
    if(appContext.giveawayBonusFieldsSupported===false){
      delete writePayload.require_comment;
      delete writePayload.facebook_post_url;
      delete writePayload.instagram_post_url;
      delete writePayload.bonus_join_facebook_group;
      delete writePayload.bonus_share_facebook;
      delete writePayload.bonus_tag_friends;
      delete writePayload.bonus_share_instagram_story;
    }
    if(appContext.giveawayFacebookGroupBonusSupported===false){
      delete writePayload.bonus_join_facebook_group;
    }
    if(appContext.giveawayGaveAwayDateSupported===false) delete writePayload.gave_away_date;
    if(appContext.giveawayImagesSupported===false) delete writePayload.images;

    let result=await runWrite(writePayload,currentColumns());

    const optionalFields=[
      ["is_hidden","giveawayHiddenSupported"],
      ["winner_sort_order","giveawayWinnerSortOrderSupported"],
      ["winner_profile_url","giveawayWinnerProfileUrlSupported"],
      ["giveaway_code","giveawayGrowthFieldsSupported"],
      ["entry_form_url","giveawayGrowthFieldsSupported"],
      ["require_facebook","giveawayGrowthFieldsSupported"],
      ["require_instagram","giveawayGrowthFieldsSupported"],
      ["require_website_code","giveawayGrowthFieldsSupported"],
      ["require_comment","giveawayBonusFieldsSupported"],
      ["facebook_post_url","giveawayBonusFieldsSupported"],
      ["instagram_post_url","giveawayBonusFieldsSupported"],
      ["bonus_join_facebook_group","giveawayFacebookGroupBonusSupported"],
      ["bonus_share_facebook","giveawayBonusFieldsSupported"],
      ["bonus_tag_friends","giveawayBonusFieldsSupported"],
      ["bonus_share_instagram_story","giveawayBonusFieldsSupported"],
      ["gave_away_date","giveawayGaveAwayDateSupported"],
      ["images","giveawayImagesSupported"]
    ];

    for(const [column,stateName] of optionalFields){
      if(
        result.error &&
        Object.prototype.hasOwnProperty.call(writePayload,column) &&
        appContext.optionalColumnUnavailable(result.error,column)
      ){
        if(stateName==="giveawayHiddenSupported") appContext.giveawayHiddenSupported=false;
        if(stateName==="giveawayWinnerSortOrderSupported") appContext.giveawayWinnerSortOrderSupported=false;
        if(stateName==="giveawayWinnerProfileUrlSupported") appContext.giveawayWinnerProfileUrlSupported=false;
        if(stateName==="giveawayGrowthFieldsSupported") appContext.giveawayGrowthFieldsSupported=false;
        if(stateName==="giveawayBonusFieldsSupported") appContext.giveawayBonusFieldsSupported=false;
        if(stateName==="giveawayFacebookGroupBonusSupported") appContext.giveawayFacebookGroupBonusSupported=false;
        if(stateName==="giveawayGaveAwayDateSupported") appContext.giveawayGaveAwayDateSupported=false;
        if(stateName==="giveawayImagesSupported") appContext.giveawayImagesSupported=false;

        writePayload={...writePayload};
        if(stateName==="giveawayGrowthFieldsSupported"){
          delete writePayload.giveaway_code;
          delete writePayload.entry_form_url;
          delete writePayload.require_facebook;
          delete writePayload.require_instagram;
          delete writePayload.require_website_code;
        }else if(stateName==="giveawayBonusFieldsSupported"){
          delete writePayload.require_comment;
          delete writePayload.facebook_post_url;
          delete writePayload.instagram_post_url;
          delete writePayload.bonus_join_facebook_group;
          delete writePayload.bonus_share_facebook;
          delete writePayload.bonus_tag_friends;
          delete writePayload.bonus_share_instagram_story;
        }else{
          delete writePayload[column];
        }
        result=await runWrite(writePayload,currentColumns());
      }
    }

    if(!result.error){
      if(Object.prototype.hasOwnProperty.call(writePayload,"winner_profile_url")){
        appContext.giveawayWinnerProfileUrlSupported=true;
      }
      if(Object.prototype.hasOwnProperty.call(writePayload,"winner_sort_order")){
        appContext.giveawayWinnerSortOrderSupported=true;
      }
      if(Object.prototype.hasOwnProperty.call(writePayload,"is_hidden")){
        appContext.giveawayHiddenSupported=true;
      }
      if(
        Object.prototype.hasOwnProperty.call(writePayload,"giveaway_code") ||
        Object.prototype.hasOwnProperty.call(writePayload,"entry_form_url")
      ){
        appContext.giveawayGrowthFieldsSupported=true;
      }
      if(
        Object.prototype.hasOwnProperty.call(writePayload,"require_comment") ||
        Object.prototype.hasOwnProperty.call(writePayload,"facebook_post_url") ||
        Object.prototype.hasOwnProperty.call(writePayload,"instagram_post_url")
      ){
        appContext.giveawayBonusFieldsSupported=true;
      }
      if(Object.prototype.hasOwnProperty.call(writePayload,"bonus_join_facebook_group")){
        appContext.giveawayFacebookGroupBonusSupported=true;
      }
      if(Object.prototype.hasOwnProperty.call(writePayload,"gave_away_date")){
        appContext.giveawayGaveAwayDateSupported=true;
      }
      if(Object.prototype.hasOwnProperty.call(writePayload,"images")){
        appContext.giveawayImagesSupported=true;
      }
    }

    return result;
  }

async function deleteGiveaway(id){
    if(!appContext.requireOwner()) return { data:null, error:new Error("Owner login required") };
    return await appContext.supabaseClient
      .from("giveaways")
      .delete()
      .eq("id", id);
  }

function isPastGiveawayWinner(g){
    return appContext.normalizeFilterValue(g?.status)==="gave_away";
  }

function isGiveawayHidden(g){
    return g?.is_hidden === true;
  }

function giveawayVisibleToCurrentViewer(g){
    return appContext.isOwnerMode() || !appContext.isGiveawayHidden(g);
  }

function giveawayWinnerDateLabel(value){
    if(!value) return "";
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined,{
      year:"numeric",
      month:"short",
      day:"numeric"
    });
  }

async function markGiveawayAsGaveAway(g,winnerName){
    if(!appContext.requireOwner("mark giveaway as gave away")){
      return {data:null,error:new Error("Owner login required")};
    }

    const cleanWinner=String(winnerName||"").trim().slice(0,120);
    if(!cleanWinner){
      return {data:null,error:new Error("Winner display name is required")};
    }

    const currentWinnerCount=appContext.giveaways.filter(appContext.isPastGiveawayWinner).length;
    const payload={
      status:"gave_away",
      winner_name:cleanWinner,
      winner_sort_order:currentWinnerCount,
      gave_away_date:new Date().toISOString().slice(0,10),
      winner_announced_at:new Date().toISOString()
    };

    const currentImages=appContext.giveawayPhotoSourcesFromRecord(g);
    const currentImage=currentImages[0]||appContext.safeHttpUrl(g?.image_url||"");
    if(currentImage){
      try{
        appContext.showToast("Preparing winner listing image…");
        const framed=await appContext.renderGiveawayWinnerListingImage(currentImage,0.94);
        const uploaded=await appContext.uploadOwnerProcessedImage(
          framed,
          "giveaway-images",
          "Winner listing image"
        );
        if(!uploaded){
          return {data:null,error:new Error("Could not upload winner listing image")};
        }
        payload.image_url=uploaded;
        if(appContext.giveawayImagesSupported!==false){
          payload.images=[uploaded,...currentImages.slice(1)].slice(0,appContext.GIVEAWAY_PHOTO_LIMIT);
        }
      }catch(error){
        console.error("Could not create winner listing frame:",error);
        return {data:null,error:new Error("Could not create winner listing image")};
      }
    }

    return await appContext.saveGiveaway(payload,g.id);
  }

  Object.assign(appContext,{giveawayFromDb,collectSocialLinksHtml,collectSocialPostLines,safePublicProfileUrl,recordGiveawayEngagement,recordGiveawayPageViewOnce,fetchGiveawayPerformance,loadGiveaways,saveGiveaway,deleteGiveaway,isPastGiveawayWinner,isGiveawayHidden,giveawayVisibleToCurrentViewer,giveawayWinnerDateLabel,markGiveawayAsGaveAway});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.COLLECT_SOCIAL_LINKS = Object.freeze({
    instagram:"https://www.instagram.com/collecttcg.mysg/",
    facebook:"https://www.facebook.com/profile.php?id=61590041416102",
    facebookGroup:"https://www.facebook.com/groups/1765445114770379",
    carousellMY:"https://www.carousell.com.my/u/collect_tcg_my_sg/",
    carousellSG:"https://www.carousell.sg/u/collect_tcg_sg/"
  });

  appContext.GIVEAWAY_PAGE_VIEW_SESSION_KEY = "collect_tcg_giveaway_page_view_v1";
}
