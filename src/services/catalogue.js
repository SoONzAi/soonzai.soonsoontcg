/** V93 beta: services/catalogue. Shared dependencies are explicit on appContext. */
export function register(appContext){
function cardMutationReturnColumns(){
    return appContext.cardPublicColumns(appContext.CARD_PUBLIC_COLUMNS_BASE)
      + (appContext.soldAtSupported ? ",sold_at" : "")
      + (appContext.lifecycleSupported ? ",lifecycle_status" : "");
  }

function cardPublicColumns(columns){
    return `${columns}${appContext.languageDetailsSupported===false ? "" : ",language_details"}`;
  }

function mergeOwnerOnlyCardFields(saved,source){
    if(!saved || !source) return saved;
    saved.cost=source.cost==null ? null : Number(source.cost);
    saved.language_details=String(source.language_details||"").trim();
    const sourceGrades=Array.isArray(source.grading)?source.grading:[];
    saved.grading=(Array.isArray(saved.grading)?saved.grading:[]).map((grade,index)=>({
      ...grade,
      cert:sourceGrades[index]?.cert||""
    }));
    return saved;
  }

function dbToCard(row){
    return {
      id: row.id,
      name: (row.name || "").toUpperCase(),
      card_code: row.card_code || "",
      year: row.year == null ? "" : String(row.year),
      game: row.game === "One Piece" ? "One Piece Card Game" : (row.game || ""),
      language: row.language || "",
      language_details: String(row.language_details||"").trim(),
      era: appContext.normalizeStoredLabel(row.era || ""),
      availability: appContext.canonicalAvailability(row.availability || "Available"),
      set: row.set_name || "",
      series: appContext.normalizeStoredLabel(row.series || ""),
      format: appContext.normalizeStoredLabel(row.format || ""),
      rarity: row.rarity || "Common",
      condition: row.condition || "NM",
      qty: Number(row.quantity || 0),
      price: row.price_usd != null ? Number(row.price_usd) : (row.price != null ? Number(row.price) : null),
      price_usd: row.price_usd != null ? Number(row.price_usd) : null,
      price_myr: row.price_myr != null ? Number(row.price_myr) : null,
      price_sgd: row.price_sgd != null ? Number(row.price_sgd) : null,
      cost: row.cost == null ? null : Number(row.cost),
      notes: row.notes || "",
      price_negotiability: appContext.priceNegotiabilityFromNotes(row.notes || ""),
      images: Array.isArray(row.images)
        ? row.images
        : (appContext.safeHttpUrl(row.thumbnail_url||"") ? [appContext.safeHttpUrl(row.thumbnail_url)] : []),
      image: Array.isArray(row.images) && row.images.length
        ? row.images[0]
        : (appContext.safeHttpUrl(row.thumbnail_url||"") || null),
      thumbnail_url: appContext.safeHttpUrl(row.thumbnail_url||"") || (Array.isArray(row.images) && row.images.length ? appContext.safeHttpUrl(row.images[0]) : ""),
      _images_loaded: Array.isArray(row.images),
      grading: (() => {
        const publicGrades = Array.isArray(row.grading) ? row.grading : [];
        const privateGrades = Array.isArray(row.grading_private) ? row.grading_private : [];
        return publicGrades.map((g,i)=>({
          ...g,
          cert: (privateGrades[i] && privateGrades[i].cert) ? privateGrades[i].cert : ""
        }));
      })(),
      view_count: Number(row.view_count || 0),
      sold_at: row.sold_at || null,
      lifecycle_status: appContext.LIFECYCLE_OPTIONS.includes(String(row.lifecycle_status||"").toLowerCase())
        ? String(row.lifecycle_status).toLowerCase()
        : "live",
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

function cardToDb(card){
    return {
      name: (card.name || "").toUpperCase(),
      card_code: (card.card_code || "").trim().toUpperCase(),
      year: appContext.normalizeYearValue(card.year) || null,
      game: card.game,
      language: card.language || "",
      ...(appContext.languageDetailsSupported!==false ? {
        language_details: String(card.language_details||"").trim().slice(0,120)
      } : {}),
      era: appContext.normalizeStoredLabel(card.era || ""),
      availability: appContext.canonicalAvailability(card.availability || "Available"),
      set_name: card.set || "",
      series: appContext.normalizeStoredLabel(card.series || ""),
      format: appContext.normalizeStoredLabel(card.format || ""),
      rarity: card.rarity || "Common",
      condition: card.condition || "NM",
      quantity: Number(card.qty || 0),
      price: card.price_usd == null ? null : Number(card.price_usd), // legacy compatibility
      price_usd: card.price_usd == null ? null : Number(card.price_usd),
      price_myr: card.price_myr == null ? null : Number(card.price_myr),
      price_sgd: card.price_sgd == null ? null : Number(card.price_sgd),
      cost: card.cost == null ? null : Number(card.cost),
      notes: card.notes || "",
      images: Array.isArray(card.images) ? card.images : [],
      grading: Array.isArray(card.grading) ? card.grading.map(g=>({
        company: g.company || "",
        grade: g.grade || "",
        pop_count: g.pop_count == null ? null : Number(g.pop_count),
        pop_higher: g.pop_higher == null ? null : Number(g.pop_higher),
        pop_updated_at: g.pop_updated_at || null
      })) : [],
      grading_private: Array.isArray(card.grading) ? card.grading.map(g=>({
        company: g.company || "",
        grade: g.grade || "",
        cert: g.cert || ""
      })) : [],
      ...(appContext.lifecycleSupported ? {
        lifecycle_status: ["live","draft","archived"].includes(String(card.lifecycle_status||"").toLowerCase())
          ? String(card.lifecycle_status).toLowerCase()
          : "live"
      } : {}),
      ...(appContext.soldAtSupported &&
          appContext.normalizeFilterValue(card.availability || "") === "sold" &&
          card.sold_at
        ? { sold_at: card.sold_at }
        : {})
    };
  }

function optionalColumnUnavailable(error,column){
    const message=`${error?.message||""} ${error?.details||""} ${error?.hint||""}`.toLowerCase();
    const target=String(column||"").toLowerCase();
    return !!target && (
      message.includes(target) ||
      message.includes("permission denied") ||
      message.includes("column") ||
      message.includes("schema cache")
    );
  }

async function fetchPublicCards(){
    // Language details is a newer optional column. Retry without it (and the
    // other established optional columns) so an unapplied migration never
    // blocks the public catalogue.
    let light=true;
    let includeLanguageDetails=appContext.languageDetailsSupported!==false;
    let includeSoldAt=true;
    let result;

    for(let attempt=0;attempt<4;attempt++){
      const base=light ? appContext.CARD_PUBLIC_COLUMNS_LIGHT : appContext.CARD_PUBLIC_COLUMNS_BASE;
      const columns=`${base}${includeLanguageDetails ? ",language_details" : ""}${includeSoldAt ? ",sold_at" : ""}`;
      result=await appContext.supabaseClient
        .from("cards")
        .select(columns)
        .order("created_at",{ascending:true});
      if(!result.error) break;

      if(includeLanguageDetails && appContext.optionalColumnUnavailable(result.error,"language_details")){
        includeLanguageDetails=false;
        appContext.languageDetailsSupported=false;
        continue;
      }
      if(includeSoldAt && appContext.optionalColumnUnavailable(result.error,"sold_at")){
        includeSoldAt=false;
        appContext.soldAtSupported=false;
        continue;
      }
      if(light && appContext.optionalColumnUnavailable(result.error,"thumbnail_url")){
        light=false;
        appContext.thumbnailUrlSupported=false;
        continue;
      }
      break;
    }

    if(!result?.error){
      appContext.thumbnailUrlSupported=light;
      appContext.soldAtSupported=includeSoldAt;
      appContext.languageDetailsSupported=includeLanguageDetails;
    }
    return result;
  }

async function ensureCardImagesLoaded(card){
    if(!card || card._images_loaded!==false) return card;
    const id=appContext.safeCardId(card.id);
    if(!id) return card;

    const pending=appContext.cardImageLoadPromises.get(id);
    if(pending) return pending;

    const request=(async()=>{
      try{
        const {data,error}=await appContext.supabaseClient
          .from("cards")
          .select("images")
          .eq("id",id)
          .single();

        if(error){
          console.warn("Could not lazy-load full card images:",error);
          return card;
        }

        const full=Array.isArray(data?.images) ? data.images.filter(v=>appContext.safeHttpUrl(v)||appContext.isPendingCardImage(v)) : [];
        card.images=full;
        card.image=full[0]||card.thumbnail_url||null;
        card._images_loaded=true;
        return card;
      }catch(error){
        console.warn("Could not lazy-load full card images:",error);
        return card;
      }finally{
        appContext.cardImageLoadPromises.delete(id);
      }
    })();

    appContext.cardImageLoadPromises.set(id,request);
    return request;
  }

async function preloadCardDetailsMedia(card){
    if(!card || !appContext.safeCardId(card.id)) return false;
    const id=String(card.id);
    if(appContext.cardDetailMediaPreloaded.has(id)) return true;

    try{
      await appContext.ensureCardImagesLoaded(card);
      const first=(Array.isArray(card.images) && card.images.length)
        ? card.images[0]
        : (card.image||card.thumbnail_url||"");
      if(!first) return false;

      const preload=new Image();
      preload.decoding="async";
      preload.src=first;
      appContext.cardDetailMediaPreloaded.add(id);
      return true;
    }catch{
      return false;
    }
  }

async function probeOwnerCardCapabilities(){
    if(!appContext.isOwnerMode()){
      appContext.lifecycleSupported=false;
      appContext.ownerPrivateSupported=false;
      appContext.cardImageVariantsSupported=false;
      appContext.editHistorySupported=false;
      return;
    }

    const [lifecycleProbe,languageDetailsProbe,privateProbe,imageVariantsProbe,historyProbe]=await Promise.all([
      appContext.supabaseClient.from("cards").select("lifecycle_status").limit(1),
      appContext.supabaseClient.from("cards").select("language_details").limit(1),
      appContext.supabaseClient.from("card_owner_private").select("card_id").limit(1),
      appContext.supabaseClient.from("card_image_variants").select("card_id,image_key").limit(1),
      appContext.supabaseClient.from("card_edit_history").select("id").limit(1)
    ]);

    appContext.lifecycleSupported=!lifecycleProbe.error;
    appContext.languageDetailsSupported=!languageDetailsProbe.error;
    appContext.ownerPrivateSupported=!privateProbe.error;
    appContext.cardImageVariantsSupported=!imageVariantsProbe.error;
    appContext.editHistorySupported=!historyProbe.error;
  }

async function loadCards(){
    let data=null;
    let error=null;

    if(appContext.isOwnerMode()){
      await appContext.probeOwnerCardCapabilities();

      const ownerResult=await appContext.supabaseClient.rpc("get_owner_cards");
      if(!ownerResult.error){
        data=ownerResult.data;

        const first=Array.isArray(data) && data.length ? data[0] : null;
        if(first && Object.prototype.hasOwnProperty.call(first,"sold_at")){
          appContext.soldAtSupported=true;
        }
        if(first && Object.prototype.hasOwnProperty.call(first,"language_details")){
          appContext.languageDetailsSupported=true;
        }
      }else{
        // Fail closed for owner-only reads, but keep the public catalogue usable.
        console.error("Secure owner card read failed:",ownerResult.error);
        appContext.clearOwnerOnlyClientState();
        appContext.applyOwnerMode();

        const publicResult=await appContext.fetchPublicCards();
        data=publicResult.data;
        error=publicResult.error;

        if(!error){
          appContext.showToast("Owner data access unavailable · showing public inventory");
        }
      }
    }else{
      appContext.lifecycleSupported=false;
      appContext.languageDetailsSupported=null;
      appContext.ownerPrivateSupported=false;
      appContext.cardImageVariantsSupported=false;
      appContext.editHistorySupported=false;

      const publicResult=await appContext.fetchPublicCards();
      data=publicResult.data;
      error=publicResult.error;
    }

    if(error){
      console.error("Load cards error:",error);

      // Do not destroy a catalogue that is already on screen because a later
      // refresh/login transition encountered a temporary network error.
      if(!appContext.cards.length) appContext.cards=[];
      return false;
    }

    appContext.cards=(data||[]).map(appContext.dbToCard);

    // Collection custom order is stored separately so the existing Cards
    // schema and secure owner-card RPC do not need to change.
    await Promise.all([
      appContext.loadCollectionCardOrder(),
      appContext.loadCollectionGameOrder(),
      appContext.loadInventoryCardOrder(),
      appContext.loadInventoryGameOrder()
    ]);

    // The eye counter shown to Owner Mode is now sourced from the fresh
    // qualified-view analytics table, not the legacy cards.view_count field.
    if(appContext.isOwnerMode()){
      await appContext.refreshQualifiedViewTotals();
    }else{
      appContext.qualifiedViewTotalsByCard.clear();
      appContext.qualifiedViewTotalsBackendState="unknown";
    }

    return true;
  }

function sanitizeOwnerTags(value){
    const raw=Array.isArray(value) ? value : String(value||"").split(/[,\n]/);
    const out=[];
    const seen=new Set();
    raw.forEach(item=>{
      const tag=String(item||"").trim().slice(0,40);
      const key=tag.toLowerCase();
      if(!tag || seen.has(key) || out.length>=12) return;
      seen.add(key);
      out.push(tag);
    });
    return out;
  }

function sanitizeOwnerPrivateNotes(value){
    return String(value||"").trim().slice(0,2000);
  }

async function fetchOwnerPrivateMeta(cardId){
    if(!appContext.requireOwner("read private card metadata")) return {tags:[],notes:""};
    const id=appContext.safeCardId(cardId);
    if(!id || !appContext.ownerPrivateSupported) return {tags:[],notes:""};

    const {data,error}=await appContext.supabaseClient
      .from("card_owner_private")
      .select("tags,notes")
      .eq("card_id",id)
      .maybeSingle();

    if(error){
      console.error("Private metadata read error:",error);
      return {tags:[],notes:""};
    }

    return {
      tags:appContext.sanitizeOwnerTags(data?.tags||[]),
      notes:appContext.sanitizeOwnerPrivateNotes(data?.notes||"")
    };
  }

function newCardImageVariantKey(){
    return (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,14)}`)
      .replace(/[^a-zA-Z0-9-]/g,"")
      .slice(0,80);
  }

async function fetchOwnerCardImageVariants(cardId){
    if(!appContext.requireOwner("read reversible image variants")) return [];
    if(!appContext.cardImageVariantsSupported) return [];

    const id=appContext.safeCardId(cardId);
    if(!id) return [];

    const {data,error}=await appContext.supabaseClient
      .from("card_image_variants")
      .select("card_id,image_key,original_url,watermarked_url,active_variant")
      .eq("card_id",id);

    if(error){
      console.error("Image variant read error:",error);
      return [];
    }

    return (data||[]).map(row=>({
      image_key:String(row.image_key||"").slice(0,80),
      original_url:appContext.safeHttpUrl(row.original_url)||"",
      watermarked_url:appContext.safeHttpUrl(row.watermarked_url)||"",
      active_variant:row.active_variant==="watermarked" ? "watermarked" : "original"
    })).filter(row=>row.image_key && row.original_url);
  }

async function saveOwnerCardImageVariants(cardId,variantRecords){
    if(!appContext.requireOwner("save reversible image variants")){
      return {ok:false,staleUrls:[]};
    }
    if(!appContext.cardImageVariantsSupported){
      return {ok:false,staleUrls:[]};
    }

    const id=appContext.safeCardId(cardId);
    if(!id) return {ok:false,staleUrls:[]};

    const variants=(variantRecords||[]).map(v=>({
      card_id:id,
      image_key:String(v.image_key||appContext.newCardImageVariantKey()).slice(0,80),
      original_url:appContext.safeHttpUrl(v.original_url)||"",
      watermarked_url:appContext.safeHttpUrl(v.watermarked_url)||null,
      active_variant:v.active_variant==="watermarked" ? "watermarked" : "original",
      updated_at:new Date().toISOString()
    })).filter(v=>v.image_key && v.original_url);

    const {data:existing,error:readError}=await appContext.supabaseClient
      .from("card_image_variants")
      .select("image_key,original_url,watermarked_url")
      .eq("card_id",id);

    if(readError){
      console.error("Image variant pre-save read error:",readError);
      return {ok:false,staleUrls:[]};
    }

    if(variants.length){
      const {error:upsertError}=await appContext.supabaseClient
        .from("card_image_variants")
        .upsert(variants,{onConflict:"card_id,image_key"});

      if(upsertError){
        console.error("Image variant upsert error:",upsertError);
        return {ok:false,staleUrls:[]};
      }
    }

    const keepKeys=new Set(variants.map(v=>v.image_key));
    const stale=(existing||[]).filter(row=>!keepKeys.has(String(row.image_key||"")));
    if(stale.length){
      const staleKeys=stale.map(row=>String(row.image_key||"")).filter(Boolean);
      const {error:deleteError}=await appContext.supabaseClient
        .from("card_image_variants")
        .delete()
        .eq("card_id",id)
        .in("image_key",staleKeys);

      if(deleteError){
        console.warn("Could not delete stale image variant rows:",deleteError);
      }
    }

    return {
      ok:true,
      staleUrls:stale.flatMap(row=>[
        appContext.safeHttpUrl(row.original_url)||"",
        appContext.safeHttpUrl(row.watermarked_url)||""
      ]).filter(Boolean)
    };
  }

async function saveOwnerPrivateMeta(cardId,tags,notes){
    if(!appContext.requireOwner("save private card metadata")) return false;
    const id=appContext.safeCardId(cardId);
    if(!id) return false;

    if(!appContext.ownerPrivateSupported){
      appContext.showToast("Private metadata migration is required");
      return false;
    }

    const payload={
      card_id:id,
      tags:appContext.sanitizeOwnerTags(tags),
      notes:appContext.sanitizeOwnerPrivateNotes(notes)
    };

    const {error}=await appContext.supabaseClient
      .from("card_owner_private")
      .upsert(payload,{onConflict:"card_id"});

    if(error){
      console.error("Private metadata save error:",error);
      appContext.showToast("Could not save private owner notes/tags");
      return false;
    }
    return true;
  }

async function setCardLifecycle(card,status){
    if(!card || !appContext.requireOwner("change listing lifecycle")) return false;
    if(!appContext.lifecycleSupported){
      appContext.showToast("Lifecycle migration is required");
      return false;
    }

    const safeStatus=appContext.LIFECYCLE_OPTIONS.includes(status) ? status : "";
    if(!safeStatus) return false;

    const candidate={...card,lifecycle_status:safeStatus};
    const saved=await appContext.updateCardStorage(candidate);
    if(!saved) return false;

    appContext.replaceCardInMemory(saved);
    return true;
  }

async function deleteListingPermanently(card){
    if(!card || !appContext.requireOwner("delete listing permanently")) return false;

    const id=appContext.safeCardId(card.id);
    if(!id){
      appContext.showToast("Invalid listing ID");
      return false;
    }

    const confirmed=appContext.confirmOwnerAction(
      `Permanently delete "${card.name}"?\n\n` +
      `This is different from Archive. The listing will be removed from the database and cannot be restored from this website.`
    );
    if(!confirmed) return false;

    const confirmedAgain=appContext.confirmOwnerAction(
      `Final confirmation:\n\nDelete "${card.name}" permanently?`
    );
    if(!confirmedAgain) return false;

    // Capture owned Storage files before deleting the database row so we can
    // clean them up after the database confirms the listing was removed.
    const storageUrls=new Set();

    try{
      const fullCardResult=await appContext.supabaseClient
        .from("cards")
        .select("images,thumbnail_url")
        .eq("id",id)
        .maybeSingle();

      if(!fullCardResult.error && fullCardResult.data){
        (Array.isArray(fullCardResult.data.images) ? fullCardResult.data.images : [])
          .forEach(url=>storageUrls.add(url));
        if(fullCardResult.data.thumbnail_url) storageUrls.add(fullCardResult.data.thumbnail_url);
      }

      if(appContext.cardImageVariantsSupported){
        const variantResult=await appContext.supabaseClient
          .from("card_image_variants")
          .select("original_url,watermarked_url")
          .eq("card_id",id);

        if(!variantResult.error){
          (variantResult.data||[]).forEach(row=>{
            if(row.original_url) storageUrls.add(row.original_url);
            if(row.watermarked_url) storageUrls.add(row.watermarked_url);
          });
        }
      }
    }catch(error){
      console.warn("Could not inspect listing images before deletion:",error);
    }

    const {data,error}=await appContext.supabaseClient
      .from("cards")
      .delete()
      .eq("id",id)
      .select("id");

    if(error){
      console.error("Permanent listing delete error:",error);
      const message=`${error.message||""} ${error.details||""}`.toLowerCase();

      if(message.includes("foreign key") || message.includes("violates foreign key")){
        appContext.showToast("Delete blocked by related database records. Archive is still available.");
      }else if(message.includes("row-level security") || message.includes("permission")){
        appContext.showToast("Supabase rejected delete permission. Check owner DELETE policy.");
      }else{
        appContext.showToast("Could not permanently delete listing");
      }
      return false;
    }

    if(!Array.isArray(data) || !data.some(row=>String(row.id)===id)){
      console.warn("Delete returned no matching row. RLS may have blocked the deletion.");
      appContext.showToast("Listing was not deleted. Check Supabase DELETE policy.");
      return false;
    }

    // Remove stale local references immediately.
    appContext.cards=appContext.cards.filter(c=>String(c.id)!==id);
    appContext.invalidateCardLookup();
    appContext.compareSelectedIds.delete(id);
    appContext.updateCompareTray();

    const favorites=appContext.getFavoriteIds();
    if(favorites.delete(id)) appContext.saveFavoriteIds(favorites);

    try{
      const recent=appContext.getRecentlyViewedEntries().filter(entry=>entry.id!==id);
      appContext.localStorage.setItem(appContext.RECENTLY_VIEWED_KEY,JSON.stringify(recent));
    }catch{}

    // Database deletion is authoritative. Storage cleanup is best-effort and
    // never causes a deleted listing to reappear if an old file cannot be removed.
    const storagePaths=[...storageUrls]
      .map(appContext.cardStoragePathFromUrl)
      .filter(Boolean);

    if(storagePaths.length){
      const storageOk=await appContext.removeCardStoragePaths(storagePaths);
      if(!storageOk) console.warn("Listing deleted, but one or more Storage files could not be removed.");
    }

    if(String(appContext.detailsCardId||"")===id){
      appContext.closeDetailsModal(false);
    }

    appContext.showToast("Listing permanently deleted");
    appContext.updateSidebarFooter();
    return true;
  }

function errorText(error,fallback="Something went wrong"){
    const raw=String(error?.message||error?.error||error?.details||"").trim();
    return raw || fallback;
  }

function cardWriteErrorText(error,action="save"){
    const raw=`${error?.message||""} ${error?.details||""} ${error?.hint||""}`.trim();
    const message=raw.toLowerCase();

    if(message.includes("row-level security") || message.includes("42501") || message.includes("permission")){
      return "Owner permission was rejected by Supabase. Please log out, log in again, and retry.";
    }
    if(message.includes("availability") || message.includes("cards_availability_check")){
      return "The selected availability is not accepted by the current database schema.";
    }
    if(message.includes("language") && (message.includes("check") || message.includes("constraint"))){
      return "The selected Language is not accepted by the current database schema. Run 2026-09-15-v13-EXTEND-LANGUAGE-OPTIONS.sql in Supabase, then retry.";
    }
    if(message.includes("grading_private")){
      return "Private grading storage is unavailable. Please run the private grading migration.";
    }
    if(message.includes("lifecycle_status")){
      return "Listing visibility storage is unavailable. Please run the lifecycle migration.";
    }
    if(message.includes("duplicate") || message.includes("unique")){
      return "A card with the same unique database value already exists.";
    }
    if(message.includes("failed to fetch") || message.includes("network") || message.includes("fetch")){
      return "Network error while saving. Please check the connection and retry.";
    }

    const detail=raw ? ` · ${raw.slice(0,140)}` : "";
    return action==="create"
      ? `Could not save card${detail}`
      : `Could not update card${detail}`;
  }

function optionalCardWriteColumnUnavailable(error,column){
    const raw=`${error?.message||""} ${error?.details||""} ${error?.hint||""}`.toLowerCase();
    const target=String(column||"").toLowerCase();
    if(!target) return false;

    return (
      raw.includes(target) &&
      (
        raw.includes("column") ||
        raw.includes("schema cache") ||
        raw.includes("does not exist") ||
        raw.includes("could not find")
      )
    );
  }

async function createCardStorage(card){
    if(!appContext.requireOwner("createCard")) return null;

    // Let the existing Supabase schema generate cards.id using its UUID
    // default. Only request the new ID back; rebuilding the client card from
    // local validated form data avoids depending on broad RETURNING access.
    let payload=appContext.cardToDb(card);

    async function insertCurrentPayload(){
      return appContext.supabaseClient
        .from("cards")
        .insert(payload)
        .select("id")
        .single();
    }

    try{
      let result=await insertCurrentPayload();

      // Optional/newer columns must not make normal card creation unusable on
      // a database that has not received every later migration yet.
      const optionalColumns=[
        ["sold_at",()=>{ appContext.soldAtSupported=false; }],
        ["language_details",()=>{ appContext.languageDetailsSupported=false; }],
        ["lifecycle_status",()=>{ appContext.lifecycleSupported=false; }],
        ["grading_private",()=>{}]
      ];

      for(const [column,onRemove] of optionalColumns){
        if(!result.error) break;
        if(!Object.prototype.hasOwnProperty.call(payload,column)) continue;
        if(!appContext.optionalCardWriteColumnUnavailable(result.error,column)) continue;

        payload={...payload};
        delete payload[column];
        onRemove();
        result=await insertCurrentPayload();
      }

      if(result.error){
        console.error("Create card error:",result.error);
        appContext.showToast(appContext.cardWriteErrorText(result.error,"create"));
        return null;
      }

      const newId=String(result.data?.id||"").trim();
      if(!newId){
        console.error("Create card returned no ID:",result.data);
        appContext.showToast("Card may have been saved, but Supabase did not return its ID. Refresh the inventory before trying again.");
        return null;
      }

      const now=new Date().toISOString();
      return {
        ...card,
        id:newId,
        sold_at:Object.prototype.hasOwnProperty.call(payload,"sold_at") ? card.sold_at : null,
        lifecycle_status:Object.prototype.hasOwnProperty.call(payload,"lifecycle_status")
          ? appContext.cardLifecycle(card)
          : "live",
        created_at:card.created_at||now,
        updated_at:now,
        _private_grading_saved:Object.prototype.hasOwnProperty.call(payload,"grading_private")
      };
    }catch(error){
      console.error("Create card request failed:",error);
      appContext.showToast(appContext.cardWriteErrorText(error,"create"));
      return null;
    }
  }

async function updateCardStorage(card){
    if(!appContext.requireOwner("updateCard")) return null;

    let payload=appContext.cardToDb(card);

    async function updateCurrentPayload(){
      return appContext.supabaseClient
        .from("cards")
        .update(payload)
        .eq("id",card.id)
        .select("id")
        .maybeSingle();
    }

    try{
      let result=await updateCurrentPayload();

      const optionalColumns=[
        ["sold_at",()=>{ appContext.soldAtSupported=false; }],
        ["language_details",()=>{ appContext.languageDetailsSupported=false; }]
      ];
      for(const [column,onRemove] of optionalColumns){
        if(!result.error) break;
        if(!Object.prototype.hasOwnProperty.call(payload,column)) continue;
        if(!appContext.optionalCardWriteColumnUnavailable(result.error,column)) continue;
        payload={...payload};
        delete payload[column];
        onRemove();
        result=await updateCurrentPayload();
      }

      if(result.error){
        console.error("Update card error:",result.error);
        appContext.showToast(appContext.cardWriteErrorText(result.error,"update"));
        return null;
      }

      if(!result.data?.id){
        console.error("Update card returned no matching row:",card.id);
        appContext.showToast("Supabase did not confirm this card update. Please log out, log in again, and retry.");
        return null;
      }

      // A successful update does not need to request the whole row back. That
      // extra REST select can fail independently after a schema change even
      // when the write itself is valid, which used to block every edit.
      return {
        ...card,
        name:(card.name||"").toUpperCase(),
        card_code:(card.card_code||"").trim().toUpperCase(),
        language_details:Object.prototype.hasOwnProperty.call(payload,"language_details")
          ? String(card.language_details||"").trim()
          : "",
        sold_at:Object.prototype.hasOwnProperty.call(payload,"sold_at")
          ? (card.sold_at||null)
          : null,
        lifecycle_status:Object.prototype.hasOwnProperty.call(payload,"lifecycle_status")
          ? appContext.cardLifecycle(card)
          : (card.lifecycle_status||"live"),
        updated_at:new Date().toISOString()
      };
    }catch(error){
      console.error("Update card request failed:",error);
      appContext.showToast(appContext.cardWriteErrorText(error,"update"));
      return null;
    }
  }

  Object.assign(appContext,{cardMutationReturnColumns,cardPublicColumns,mergeOwnerOnlyCardFields,dbToCard,cardToDb,optionalColumnUnavailable,fetchPublicCards,ensureCardImagesLoaded,preloadCardDetailsMedia,probeOwnerCardCapabilities,loadCards,sanitizeOwnerTags,sanitizeOwnerPrivateNotes,fetchOwnerPrivateMeta,newCardImageVariantKey,fetchOwnerCardImageVariants,saveOwnerCardImageVariants,saveOwnerPrivateMeta,setCardLifecycle,deleteListingPermanently,errorText,cardWriteErrorText,optionalCardWriteColumnUnavailable,createCardStorage,updateCardStorage});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.cardImageLoadPromises = new Map();
  appContext.cardDetailMediaPreloaded = new Set();

  appContext.EMPTY_ICON = `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="8" width="30" height="42" rx="5" transform="rotate(-8 12 8)" stroke="#2E3038" stroke-width="2"/>
    <rect x="20" y="13" width="30" height="42" rx="5" fill="#1A1C22" stroke="#4A4D57" stroke-width="2"/>
    <circle cx="35" cy="34" r="7" stroke="#5FD4C4" stroke-width="1.6"/>
  </svg>`;

  appContext.GIVEAWAY_PUBLIC_COLUMNS_BASE = "id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_announced_at,created_at";

  appContext.GIVEAWAY_PUBLIC_COLUMNS_PROFILE = "id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_profile_url,winner_announced_at,created_at";

  appContext.GIVEAWAY_PUBLIC_COLUMNS_MULTI = "id,title,card_name,image_url,images,status,ends_at,how_to_enter,details,winner_name,winner_profile_url,winner_sort_order,is_hidden,giveaway_code,entry_form_url,require_facebook,require_instagram,require_comment,require_website_code,facebook_post_url,instagram_post_url,bonus_join_facebook_group,bonus_share_facebook,bonus_tag_friends,bonus_share_instagram_story,gave_away_date,winner_announced_at,created_at";

  appContext.GIVEAWAY_PUBLIC_COLUMNS = "id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_profile_url,winner_sort_order,is_hidden,giveaway_code,entry_form_url,require_facebook,require_instagram,require_comment,require_website_code,facebook_post_url,instagram_post_url,bonus_join_facebook_group,bonus_share_facebook,bonus_tag_friends,bonus_share_instagram_story,gave_away_date,winner_announced_at,created_at";

  appContext.GIVEAWAY_PUBLIC_COLUMNS_PRE_FB_GROUP_BONUS = "id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_profile_url,winner_sort_order,is_hidden,giveaway_code,entry_form_url,require_facebook,require_instagram,require_comment,require_website_code,facebook_post_url,instagram_post_url,bonus_share_facebook,bonus_tag_friends,bonus_share_instagram_story,gave_away_date,winner_announced_at,created_at";

  appContext.GIVEAWAY_PUBLIC_COLUMNS_PRE_GAVE_AWAY_DATE = "id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_profile_url,winner_sort_order,is_hidden,giveaway_code,entry_form_url,require_facebook,require_instagram,require_comment,require_website_code,facebook_post_url,instagram_post_url,bonus_share_facebook,bonus_tag_friends,bonus_share_instagram_story,winner_announced_at,created_at";

  appContext.GIVEAWAY_PUBLIC_COLUMNS_PRE_BONUS = "id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_profile_url,winner_sort_order,is_hidden,giveaway_code,entry_form_url,require_facebook,require_instagram,require_website_code,winner_announced_at,created_at";

  appContext.GIVEAWAY_PUBLIC_COLUMNS_PRE_GROWTH = "id,title,card_name,image_url,status,ends_at,how_to_enter,details,winner_name,winner_profile_url,winner_sort_order,is_hidden,winner_announced_at,created_at";

  appContext.giveawayWinnerProfileUrlSupported = "unknown";

  appContext.giveawayWinnerSortOrderSupported = "unknown";

  appContext.giveawayHiddenSupported = "unknown";

  appContext.giveawayGrowthFieldsSupported = "unknown";

  appContext.giveawayBonusFieldsSupported = "unknown";

  appContext.giveawayFacebookGroupBonusSupported = "unknown";

  appContext.giveawayGaveAwayDateSupported = "unknown";

  appContext.giveawayImagesSupported = "unknown";

  appContext.giveawayGrowthAnalyticsSupported = "unknown";

  appContext.SHOWCASE_PUBLIC_COLUMNS = "id,title,category,series,video_url,thumbnail_url,description,featured,sort_order,created_at";
}
