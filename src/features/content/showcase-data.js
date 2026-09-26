/** V93 beta: features/content/showcase-data. Shared dependencies are explicit on appContext. */
export function register(appContext){
function showcaseFromDb(row){
    return {
      id: row.id,
      title: row.title || "",
      category: row.category || "Collection Showcase",
      series: row.series || "",
      video_url: row.video_url || "",
      thumbnail_url: row.thumbnail_url || "",
      description: row.description || "",
      featured: !!row.featured,
      sort_order: Number(row.sort_order || 0),
      created_at: row.created_at || ""
    };
  }

async function loadShowcases(){
    const {data,error}=await appContext.supabaseClient
      .from("showcases")
      .select(appContext.SHOWCASE_PUBLIC_COLUMNS)
      .order("sort_order",{ascending:true})
      .order("created_at",{ascending:false});

    if(error){
      console.error("Load showcases error:", error);
      appContext.showcases = [];
      return false;
    }
    appContext.showcases = (data || []).map(appContext.showcaseFromDb);
    return true;
  }

async function saveShowcase(payload, id){
    if(!appContext.requireOwner("saveShowcase")) return { data:null, error:new Error("Owner login required") };
    if(id){
      return await appContext.supabaseClient
        .from("showcases")
        .update(payload)
        .eq("id", id)
        .select(appContext.SHOWCASE_PUBLIC_COLUMNS)
        .single();
    }
    return await appContext.supabaseClient
      .from("showcases")
      .insert(payload)
      .select(appContext.SHOWCASE_PUBLIC_COLUMNS)
      .single();
  }

async function deleteShowcase(id){
    if(!appContext.requireOwner("deleteShowcase")) return { data:null, error:new Error("Owner login required") };
    return await appContext.supabaseClient
      .from("showcases")
      .delete()
      .eq("id", id);
  }

  Object.assign(appContext,{showcaseFromDb,loadShowcases,saveShowcase,deleteShowcase});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.VISITOR_ID_KEY = "collect-tcg-visitor-id";

  appContext.ANALYTICS_EXCLUDED_DEVICE_KEY = "collect_tcg_analytics_excluded_device_v1";

  appContext.ANALYTICS_EXCLUDED_DEVICE_COOKIE = "collect_tcg_analytics_excluded_v1";

  appContext.ANALYTICS_EXCLUSION_COOKIE_MAX_AGE = 60*60*24*365*10;
}
