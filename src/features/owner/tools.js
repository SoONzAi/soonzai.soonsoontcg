/** V93 beta: features/owner/tools. Shared dependencies are explicit on appContext. */
export function register(appContext){
const SUPABASE_PRO_DATABASE_LIMIT_BYTES=8*1024*1024*1024;
const SUPABASE_PRO_STORAGE_LIMIT_BYTES=100*1024*1024*1024;
function currentInventoryToolMode(){
    const mode=appContext.currentHashParams().get("mode");
    const aliases={
      prices:"bulk",
      metadata:"bulk",
      recent:"activity",
      history:"activity",
      images:"quality",
      duplicates:"quality",
      lifecycle:"lifecycle",
      migration:"storage"
    };
    return aliases[mode] || (["bulk","activity","quality","lifecycle","storage"].includes(mode) ? mode : "bulk");
  }

function currentInventoryToolSubmode(mode){
    const requested=String(appContext.currentHashParams().get("sub")||"");
    const allowed={
      bulk:["prices","metadata","status","psa","missing-certs"],
      activity:["recent","history","qr"],
      quality:["audit","images","duplicates","reprocess"],
      lifecycle:["lifecycle"],
      storage:["health","storage-audit","storage-optimizer","migration","backup"]
    };
    if(allowed[mode]?.includes(requested)) return requested;

    const oldMode=String(appContext.currentHashParams().get("mode")||"");
    if(allowed[mode]?.includes(oldMode)) return oldMode;

    return allowed[mode]?.[0] || "prices";
  }

function inventoryToolsSwitcher(mode,submode){
    const tabs=[
      ["bulk","Bulk Edit","Prices · metadata · status","prices"],
      ["activity","Activity","Recent · history","recent"],
      ["quality","Quality","Audit · images · duplicates · reprocess","audit"],
      ["lifecycle","Lifecycle","Drafts · archive","lifecycle"],
      ["storage","Storage","Capacity · audit · optimizer · migration · backup","health"]
    ];

    const subtabs={
      bulk:[["prices","Bulk Prices"],["metadata","Bulk Metadata"],["status","Bulk Status"],["psa","PSA POP"],["missing-certs","Missing Certs"]],
      activity:[["recent","Recently Edited"],["history","Edit History"],["qr","QR Generator"]],
      quality:[["audit","Catalogue Audit"],["images","Image Health"],["duplicates","Duplicates"],["reprocess","Reprocess Images"]],
      lifecycle:[["lifecycle","Drafts & Archive"]],
      storage:[["health","Database & Storage"],["storage-audit","Storage Audit"],["storage-optimizer","Storage Optimizer"],["migration","Image Migration"],["backup","Backup"]]
    };

    return `
      <div class="inventory-tools-switcher inventory-tools-category-switcher" role="tablist" aria-label="Inventory tool categories">
        ${tabs.map(([key,title,desc,defaultSub])=>`
          <a href="#/inventory-tools?mode=${key}&sub=${defaultSub}"
             class="${mode===key?"active":""}"
             role="tab"
             aria-selected="${mode===key?"true":"false"}">
            <strong>${title}</strong>
            <span>${desc}</span>
          </a>
        `).join("")}
      </div>
      <div class="inventory-tools-subnav">
        ${(subtabs[mode]||[]).map(([key,label])=>`
          <a href="#/inventory-tools?mode=${mode}&sub=${key}" class="${submode===key?"active":""}">${label}</a>
        `).join("")}
      </div>
    `;
  }

function getStoredImageHealthSummary(){
    try{
      const raw=JSON.parse(appContext.localStorage.getItem(appContext.IMAGE_HEALTH_SUMMARY_KEY)||"null");
      if(!raw || typeof raw!=="object") return null;
      const scannedAt=String(raw.scanned_at||"");
      const ts=new Date(scannedAt).getTime();
      if(!Number.isFinite(ts)) return null;
      return {
        scanned_at:scannedAt,
        issues:Number(raw.issues||0),
        broken:Number(raw.broken||0),
        single:Number(raw.single||0),
        small:Number(raw.small||0),
        external:Number(raw.external||0)
      };
    }catch{
      return null;
    }
  }

function saveStoredImageHealthSummary(summary){
    try{
      appContext.localStorage.setItem(appContext.IMAGE_HEALTH_SUMMARY_KEY,JSON.stringify({
        scanned_at:new Date().toISOString(),
        issues:Number(summary.issues||0),
        broken:Number(summary.broken||0),
        single:Number(summary.single||0),
        small:Number(summary.small||0),
        external:Number(summary.external||0)
      }));
    }catch{}
  }

function ownerInventoryHealthSummary(){
    const active=appContext.cards.filter(card=>
      appContext.isLiveLifecycle(card) &&
      appContext.normalizeFilterValue(card.availability||"Available")!=="sold"
    );

    if(!active.length){
      return {overall:100,images:100,pricing:100,metadata:100,grading:100,count:0};
    }

    let imagePoints=0;
    let pricingPoints=0;
    let metadataPoints=0;
    let gradingPoints=0;

    active.forEach(card=>{
      const imageCount=appContext.getImages(card).length;
      imagePoints += imageCount>=2 ? 100 : (imageCount===1 ? 50 : 0);

      const isNfs=appContext.normalizeFilterValue(card.availability)==="collection (nfs)";
      if(isNfs){
        pricingPoints += 100;
      }else{
        const priceFlags=[
          appContext.hasListedPrice(card.price_myr),
          appContext.hasListedPrice(card.price_usd ?? card.price),
          appContext.hasListedPrice(card.price_sgd)
        ];
        pricingPoints += (priceFlags.filter(Boolean).length/priceFlags.length)*100;
      }

      const metadataFlags=[
        String(card.card_code||"").trim(),
        String(card.year||"").trim(),
        String(card.series||"").trim(),
        String(card.condition||"").trim(),
        String(card.language||"").trim()
      ];
      metadataPoints += (metadataFlags.filter(Boolean).length/metadataFlags.length)*100;

      if(appContext.effectiveFormat(card)==="Graded"){
        const grades=Array.isArray(card.grading)?card.grading:[];
        const validGrade=grades.some(g=>
          g &&
          String(g.company||"").trim() &&
          String(g.grade??"").trim()
        );
        gradingPoints += validGrade ? 100 : 0;
      }else{
        gradingPoints += 100;
      }
    });

    const divisor=active.length;
    const images=Math.round(imagePoints/divisor);
    const pricing=Math.round(pricingPoints/divisor);
    const metadata=Math.round(metadataPoints/divisor);
    const grading=Math.round(gradingPoints/divisor);
    const overall=Math.round((images+pricing+metadata+grading)/4);

    return {overall,images,pricing,metadata,grading,count:active.length};
  }

function ownerHealthClass(score){
    if(score>=90) return "health-good";
    if(score>=75) return "health-watch";
    return "health-needs-work";
  }

function invalidateOwnerReservedAgeCache(){
    appContext.ownerReservedAgeCache.loaded=false;
    appContext.ownerReservedAgeCache.loading=false;
    appContext.ownerReservedAgeCache.map=new Map();
  }

function ownerReservedAgeDays(timestamp){
    const ms=Date.parse(timestamp||"");
    if(!Number.isFinite(ms)) return null;
    return Math.max(0,Math.floor((Date.now()-ms)/(24*60*60*1000)));
  }

function ownerReservedAgeLabel(timestamp){
    const days=appContext.ownerReservedAgeDays(timestamp);
    if(days==null) return "Reserved age unavailable";
    if(days===0) return "Reserved today";
    if(days===1) return "Reserved 1 day";
    return `Reserved ${days} days`;
  }

async function loadOwnerReservedAges(force=false){
    if(!appContext.isOwnerMode() || !appContext.editHistorySupported) return appContext.ownerReservedAgeCache;
    if(appContext.ownerReservedAgeCache.loading) return appContext.ownerReservedAgeCache;
    if(appContext.ownerReservedAgeCache.loaded && !force) return appContext.ownerReservedAgeCache;

    const reservedIds=new Set(
      appContext.cards
        .filter(card=>
          appContext.isLiveLifecycle(card) &&
          appContext.normalizeFilterValue(card.availability)==="reserved"
        )
        .map(card=>String(card.id))
    );

    appContext.ownerReservedAgeCache.loading=true;
    appContext.ownerReservedAgeCache.map=new Map();

    if(!reservedIds.size){
      appContext.ownerReservedAgeCache.loaded=true;
      appContext.ownerReservedAgeCache.loading=false;
      return appContext.ownerReservedAgeCache;
    }

    // card_edit_history is already owner-only via RLS. We derive age only
    // from an actual transition into Reserved. updated_at is intentionally
    // NOT used because an unrelated edit would give a false reservation age.
    const {data,error}=await appContext.supabaseClient
      .from("card_edit_history")
      .select("card_id,edited_at,before_data,after_data")
      .eq("action","card_update")
      .order("edited_at",{ascending:false})
      .limit(1000);

    if(error){
      console.error("Reserved age history error:",error);
      appContext.ownerReservedAgeCache.loaded=false;
      appContext.ownerReservedAgeCache.loading=false;
      return appContext.ownerReservedAgeCache;
    }

    (Array.isArray(data)?data:[]).forEach(row=>{
      const id=String(row?.card_id||"");
      if(!reservedIds.has(id) || appContext.ownerReservedAgeCache.map.has(id)) return;

      const before=appContext.normalizeFilterValue(row?.before_data?.availability||"");
      const after=appContext.normalizeFilterValue(row?.after_data?.availability||"");
      if(after==="reserved" && before!=="reserved"){
        appContext.ownerReservedAgeCache.map.set(id,row.edited_at);
      }
    });

    appContext.ownerReservedAgeCache.loaded=true;
    appContext.ownerReservedAgeCache.loading=false;
    return appContext.ownerReservedAgeCache;
  }

function ownerReservedAgeSummary(){
    const reserved=appContext.cards.filter(card=>
      appContext.isLiveLifecycle(card) &&
      appContext.normalizeFilterValue(card.availability)==="reserved"
    );

    const ages=reserved
      .map(card=>appContext.ownerReservedAgeDays(appContext.ownerReservedAgeCache.map.get(String(card.id))))
      .filter(days=>days!=null);

    return {
      total:reserved.length,
      known:ages.length,
      unknown:Math.max(0,reserved.length-ages.length),
      over7:ages.filter(days=>days>=7).length,
      over14:ages.filter(days=>days>=14).length,
      oldest:ages.length ? Math.max(...ages) : null
    };
  }

function hydrateOwnerReservedAgeUI(){
    if(!appContext.isOwnerMode()) return;

    const summary=appContext.ownerReservedAgeSummary();
    const dashboardText=document.querySelector("[data-owner-reserved-age-summary]");
    if(dashboardText){
      if(!appContext.editHistorySupported){
        dashboardText.textContent="Edit History migration required for reservation age";
      }else if(!appContext.ownerReservedAgeCache.loaded){
        dashboardText.textContent="Loading reservation age…";
      }else if(summary.total===0){
        dashboardText.textContent="No reserved listings";
      }else if(summary.known===0){
        dashboardText.textContent="Reservation dates unavailable for current listings";
      }else{
        const parts=[
          `${summary.over7} at 7+ days`,
          summary.oldest!=null ? `oldest ${summary.oldest}d` : "",
          summary.unknown ? `${summary.unknown} unknown` : ""
        ].filter(Boolean);
        dashboardText.textContent=parts.join(" · ");
      }
    }

    document.querySelectorAll("[data-owner-reserved-age-card]").forEach(el=>{
      const id=appContext.safeCardId(el.dataset.ownerReservedAgeCard);
      const timestamp=id ? appContext.ownerReservedAgeCache.map.get(id) : null;

      if(!appContext.editHistorySupported){
        el.textContent="Reserved age unavailable";
        el.className="owner-reserved-age owner-reserved-age-unknown";
        return;
      }

      if(!appContext.ownerReservedAgeCache.loaded){
        el.textContent="Checking reserved age…";
        return;
      }

      const days=appContext.ownerReservedAgeDays(timestamp);
      el.textContent=timestamp ? appContext.ownerReservedAgeLabel(timestamp) : "Reserved age unavailable";
      el.className="owner-reserved-age " + (
        days==null ? "owner-reserved-age-unknown" :
        days>=14 ? "owner-reserved-age-critical" :
        days>=7 ? "owner-reserved-age-warning" :
        "owner-reserved-age-fresh"
      );
    });
  }

async function refreshOwnerReservedAgeUI(force=false){
    if(!appContext.isOwnerMode()) return;
    appContext.hydrateOwnerReservedAgeUI();
    await appContext.loadOwnerReservedAges(force);
    appContext.hydrateOwnerReservedAgeUI();
  }

function ownerAlertSummary(){
    const active=appContext.cards.filter(card=>appContext.isLiveLifecycle(card) && appContext.normalizeFilterValue(card.availability||"Available")!=="sold");
    const qualitySummary=appContext.dataQualitySummary(active);
    const missingPrice=qualitySummary.missingPrice;
    const priceIssues=qualitySummary.priceIssues;
    const missingImage=active.filter(card=>appContext.getImages(card).length===0).length;
    const singleImage=active.filter(card=>appContext.getImages(card).length===1).length;
    const metadataIssues=active.filter(card=>
      !String(card.card_code||"").trim() ||
      !String(card.year||"").trim() ||
      !String(card.series||"").trim() ||
      !String(card.condition||"").trim() ||
      !String(card.language||"").trim()
    ).length;
    const reserved=appContext.cards.filter(card=>appContext.normalizeFilterValue(card.availability)==="reserved").length;
    const newThisWeek=appContext.cards.filter(card=>appContext.isNewCard(card)).length;
    const editedRecently=appContext.cards.filter(card=>{
      const ts=appContext.ownerRecentEditTime(card);
      return ts>0 && (Date.now()-ts)<=(7*24*60*60*1000);
    }).length;

    return {
      active:active.length,
      missingPrice,
      priceIssues,
      missingImage,
      singleImage,
      metadataIssues,
      reserved,
      newThisWeek,
      editedRecently,
      imageHealth:appContext.getStoredImageHealthSummary()
    };
  }

function ownerAlertsDashboardHTML(){
    const s=appContext.ownerAlertSummary();
    const health=appContext.ownerInventoryHealthSummary();
    const scanned=s.imageHealth;
    const brokenLabel=scanned ? String(scanned.broken) : "—";
    const brokenSub=scanned
      ? `Latest scan · ${appContext.formatOwnerTimestamp(scanned.scanned_at)}`
      : "Run Image Health to scan";

    return `
      <section class="owner-alerts-dashboard">
        <div class="owner-alerts-head">
          <div>
            <div class="eyebrow">Owner Overview</div>
            <h3>Inventory Alerts</h3>
          </div>
          <span>${s.active} active listings</span>
        </div>

        <div class="owner-health-overview ${appContext.ownerHealthClass(health.overall)}">
          <div class="owner-health-score">
            <strong>${health.overall}%</strong>
            <span>Inventory Health</span>
            <small>${health.count} active listings · quantity is not part of this score</small>
          </div>
          <div class="owner-health-breakdown">
            <div><span>Images</span><strong>${health.images}%</strong></div>
            <div><span>Pricing</span><strong>${health.pricing}%</strong></div>
            <div><span>Metadata</span><strong>${health.metadata}%</strong></div>
            <div><span>Grading</span><strong>${health.grading}%</strong></div>
          </div>
        </div>

        <div class="owner-alerts-grid">
          <a href="#/quality?filter=price" class="${s.priceIssues?"needs-attention":""}">
            <strong>${s.priceIssues}</strong>
            <span>Price issues</span>
            <small>${s.missingPrice} with no price at all</small>
          </a>
          <a href="#/quality?filter=image" class="${s.missingImage?"needs-attention":""}">
            <strong>${s.missingImage}</strong>
            <span>Missing images</span>
            <small>Open Data Quality</small>
          </a>
          <a href="#/inventory-tools?mode=quality&sub=images&filter=broken" class="${scanned&&scanned.broken?"needs-attention":""}">
            <strong>${brokenLabel}</strong>
            <span>Broken images</span>
            <small>${appContext.escapeHtml(brokenSub)}</small>
          </a>
          <a href="#/inventory-tools?mode=quality&sub=images&filter=single" class="${s.singleImage?"needs-attention":""}">
            <strong>${s.singleImage}</strong>
            <span>One-photo listings</span>
            <small>Review image coverage</small>
          </a>
          <a href="#/quality?filter=metadata" class="${s.metadataIssues?"needs-attention":""}">
            <strong>${s.metadataIssues}</strong>
            <span>Metadata issues</span>
            <small>Open Data Quality</small>
          </a>
          <a href="#/reserved" class="${appContext.ownerReservedAgeSummary().over14?"needs-attention":""}">
            <strong>${s.reserved}</strong>
            <span>Reserved</span>
            <small data-owner-reserved-age-summary>Loading reservation age…</small>
          </a>
          <a href="#/inventory?quick=new">
            <strong>${s.newThisWeek}</strong>
            <span>New this week</span>
            <small>View new listings</small>
          </a>
          <a href="#/inventory-tools?mode=activity&sub=recent">
            <strong>${s.editedRecently}</strong>
            <span>Edited this week</span>
            <small>Open Recently Edited</small>
          </a>
        </div>
      </section>
    `;
  }


function storageAuditFileSize(item){
    const metadata=item?.metadata||{};
    const candidates=[
      metadata.size,
      metadata.contentLength,
      metadata.content_length,
      metadata["content-length"],
      item?.size
    ];
    for(const value of candidates){
      const n=Number(value);
      if(Number.isFinite(n) && n>=0) return n;
    }
    return null;
  }

async function storageAuditResolveFileSize(file){
    const current=Number(file?.size);
    if(Number.isFinite(current) && current>0) return current;

    try{
      const {data}=appContext.supabaseClient.storage
        .from(appContext.CARD_IMAGE_STORAGE_BUCKET)
        .getPublicUrl(file.path);
      const url=appContext.safeHttpUrl(data?.publicUrl||"");
      if(!url) return null;

      // HEAD is cheap and avoids downloading image bodies. Some embedded
      // browsers/storage CDNs may block HEAD, so fall back to a one-byte range.
      try{
        const response=await appContext.fetch(url,{method:"HEAD",cache:"no-store"});
        const length=Number(response.headers.get("content-length"));
        if(response.ok && Number.isFinite(length) && length>0) return length;
      }catch{}

      try{
        const response=await appContext.fetch(url,{
          method:"GET",
          headers:{Range:"bytes=0-0"},
          cache:"no-store"
        });
        const range=String(response.headers.get("content-range")||"");
        const match=range.match(/\/(\d+)$/);
        if(match){
          const total=Number(match[1]);
          if(Number.isFinite(total) && total>0) return total;
        }
        const length=Number(response.headers.get("content-length"));
        if(Number.isFinite(length) && length>1) return length;
      }catch{}
    }catch{}

    return null;
  }

function storageAuditFileEtag(item){
    const metadata=item?.metadata||{};
    return String(
      metadata.eTag ||
      metadata.etag ||
      metadata.md5 ||
      metadata.hash ||
      ""
    ).replace(/^W\//,"").replace(/^["']|["']$/g,"").trim();
  }

async function listOwnerCardStorageObjects(){
    if(!appContext.requireOwner("audit card image Storage")) return [];

    const ownerId=String(appContext.ownerSession?.user?.id||"");
    if(!ownerId) throw new Error("Owner session unavailable");

    const bucket=appContext.supabaseClient.storage.from(appContext.CARD_IMAGE_STORAGE_BUCKET);
    const files=[];
    const visited=new Set();

    const walk=async(relativeFolder="")=>{
      const folder=relativeFolder ? `${ownerId}/${relativeFolder}` : ownerId;
      if(visited.has(folder)) return;
      visited.add(folder);

      const pageSize=100;
      for(let offset=0;;offset+=pageSize){
        const {data,error}=await bucket.list(folder,{
          limit:pageSize,
          offset,
          sortBy:{column:"name",order:"asc"}
        });
        if(error) throw error;
        const rows=Array.isArray(data)?data:[];
        for(const item of rows){
          const name=String(item?.name||"").trim();
          if(!name) continue;

          // Supabase returns folders without normal file metadata/id.
          const looksLikeFolder=!item?.id && !item?.metadata;
          if(looksLikeFolder){
            const child=relativeFolder ? `${relativeFolder}/${name}` : name;
            await walk(child);
            continue;
          }

          const path=`${folder}/${name}`;
          files.push({
            path,
            name,
            size:appContext.storageAuditFileSize(item),
            etag:appContext.storageAuditFileEtag(item),
            mime:String(item?.metadata?.mimetype||item?.metadata?.contentType||""),
            updatedAt:String(item?.updated_at||item?.updatedAt||item?.metadata?.lastModified||"")
          });
        }
        if(rows.length<pageSize) break;
      }
    };

    await walk("");

    // Some Supabase Storage responses omit per-file size metadata. Resolve only
    // unknown sizes from the public object headers so the audit never silently
    // counts an unknown file as 0 bytes.
    const unknown=files.filter(file=>!Number.isFinite(Number(file.size)) || Number(file.size)<=0);
    const concurrency=6;
    let cursor=0;
    const worker=async()=>{
      while(cursor<unknown.length){
        const index=cursor++;
        const file=unknown[index];
        const size=await appContext.storageAuditResolveFileSize(file);
        file.size=Number.isFinite(Number(size)) && Number(size)>0 ? Number(size) : null;
      }
    };
    await Promise.all(Array.from({length:Math.min(concurrency,unknown.length)},worker));

    return files;
  }

async function ownerCardStorageReferencePaths(){
    if(!appContext.requireOwner("audit card image references")) return new Set();

    const referenced=new Set();
    const protect=url=>{
      const path=appContext.cardStoragePathFromUrl(url);
      if(path) referenced.add(path);
    };

    const scan=async(table,columns,order,visit)=>{
      const pageSize=500;
      for(let offset=0;;offset+=pageSize){
        const {data,error}=await appContext.supabaseClient
          .from(table)
          .select(columns)
          .order(order,{ascending:true})
          .range(offset,offset+pageSize-1);
        if(error) throw error;
        const rows=Array.isArray(data)?data:[];
        rows.forEach(visit);
        if(rows.length<pageSize) break;
      }
    };

    await scan(
      "cards",
      appContext.thumbnailUrlSupported ? "id,images,thumbnail_url" : "id,images",
      "id",
      row=>{
        (Array.isArray(row.images)?row.images:[]).forEach(protect);
        if(row.thumbnail_url) protect(row.thumbnail_url);
      }
    );

    if(appContext.cardImageVariantsSupported){
      await scan(
        "card_image_variants",
        "image_key,original_url,watermarked_url",
        "image_key",
        row=>{
          protect(row.original_url);
          protect(row.watermarked_url);
        }
      );
    }

    return referenced;
  }

function storageAuditDuplicateGroups(files){
    const exact=new Map();
    const sizeOnly=new Map();

    files.forEach(file=>{
      if(file.etag){
        const key=`${file.size}:${file.etag}`;
        if(!exact.has(key)) exact.set(key,[]);
        exact.get(key).push(file);
      }else if(file.size>0){
        const key=String(file.size);
        if(!sizeOnly.has(key)) sizeOnly.set(key,[]);
        sizeOnly.get(key).push(file);
      }
    });

    const exactGroups=[...exact.values()].filter(group=>group.length>1);
    const possibleGroups=[...sizeOnly.values()].filter(group=>group.length>1);
    return {exactGroups,possibleGroups};
  }

async function buildOwnerStorageAudit(){
    const [files,referenced,usage]=await Promise.all([
      appContext.listOwnerCardStorageObjects(),
      appContext.ownerCardStorageReferencePaths(),
      appContext.fetchSupabaseCapacityUsage()
    ]);

    const rows=files.map(file=>({
      ...file,
      referenced:referenced.has(file.path),
      oversized:Number.isFinite(Number(file.size)) && Number(file.size)>=3*1024*1024
    }));

    const orphans=rows.filter(file=>!file.referenced);
    const oversized=rows.filter(file=>file.oversized).sort((a,b)=>b.size-a.size);
    const largest=rows.slice().sort((a,b)=>b.size-a.size).slice(0,50);
    const duplicates=appContext.storageAuditDuplicateGroups(rows);
    const orphanBytes=orphans.reduce((sum,file)=>sum+(Number.isFinite(Number(file.size))?Number(file.size):0),0);
    const ownerFolderBytes=rows.reduce((sum,file)=>sum+(Number.isFinite(Number(file.size))?Number(file.size):0),0);
    const unknownSizeCount=rows.filter(file=>!Number.isFinite(Number(file.size)) || Number(file.size)<=0).length;

    return {
      files:rows,
      orphans:orphans.sort((a,b)=>b.size-a.size),
      oversized,
      largest,
      exactDuplicateGroups:duplicates.exactGroups,
      possibleDuplicateGroups:duplicates.possibleGroups,
      orphanBytes,
      ownerFolderBytes,
      unknownSizeCount,
      usage
    };
  }

function storageAuditTableRows(rows,{checkboxes=false,limit=50}={}){
    if(!rows.length){
      return `<div class="empty compact"><p>No matching files.</p></div>`;
    }

    return `
      <div class="storage-audit-table-wrap">
        <table class="storage-audit-table">
          <thead>
            <tr>
              ${checkboxes?`<th class="storage-audit-check"></th>`:""}
              <th>File</th>
              <th>Size</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${rows.slice(0,limit).map(file=>`
              <tr>
                ${checkboxes?`
                  <td class="storage-audit-check">
                    <input type="checkbox"
                           data-storage-orphan-path="${appContext.escapeHtml(file.path)}"
                           aria-label="Select ${appContext.escapeHtml(file.name)}">
                  </td>`:""}
                <td>
                  <strong title="${appContext.escapeHtml(file.path)}">${appContext.escapeHtml(file.name)}</strong>
                  <small>${appContext.escapeHtml(file.path)}</small>
                </td>
                <td>${Number.isFinite(Number(file.size)) && Number(file.size)>0 ? appContext.escapeHtml(appContext.formatApproxBytes(file.size)) : "Size unavailable"}</td>
                <td>${file.updatedAt ? appContext.escapeHtml(new Date(file.updatedAt).toLocaleString()) : "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${rows.length>limit?`<div class="hint">Showing ${limit.toLocaleString()} of ${rows.length.toLocaleString()} files.</div>`:""}
      </div>
    `;
  }

function renderStorageAuditPage(){
    if(!appContext.requireOwner("open Storage audit")) return;

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Storage</div>
          <h2>Storage Audit</h2>
          <p>Find large, duplicate and unreferenced files in the <strong>card-images</strong> bucket before Storage fills up.</p>
        </div>
      </div>

      <section class="panel storage-audit-panel">
        <div id="storageAuditStatus" class="storage-audit-status">
          <strong>Ready to scan</strong>
          <span>No files are deleted automatically.</span>
        </div>
        <div class="storage-audit-actions">
          <button type="button" class="btn-primary" id="storageAuditRunBtn">Run Storage Audit</button>
        </div>
        <div id="storageAuditResults"></div>
      </section>
    `;

    let latestAudit=null;

    const setStatus=(title,message,kind="")=>{
      const el=appContext.$("storageAuditStatus");
      if(!el) return;
      el.className=`storage-audit-status ${kind}`.trim();
      el.innerHTML=`<strong>${appContext.escapeHtml(title)}</strong><span>${appContext.escapeHtml(message)}</span>`;
    };

    const renderAudit=audit=>{
      const usage=audit.usage;
      const totalStorage=usage?.ok ? usage.storageBytes : null;
      const storageLeft=usage?.ok
        ? appContext.capacityLeft(usage.storageBytes,SUPABASE_PRO_STORAGE_LIMIT_BYTES)
        : null;
      const exactDupFiles=audit.exactDuplicateGroups.reduce((sum,g)=>sum+g.length,0);
      const possibleDupFiles=audit.possibleDuplicateGroups.reduce((sum,g)=>sum+g.length,0);

      appContext.$("storageAuditResults").innerHTML=`
        <div class="storage-audit-summary">
          <article>
            <strong>${audit.files.length.toLocaleString()}</strong>
            <span>Files audited</span>
            <small>${appContext.formatApproxBytes(audit.ownerFolderBytes)} in your owner folder</small>
          </article>
          <article class="${audit.orphans.length?"needs-attention":""}">
            <strong>${audit.orphans.length.toLocaleString()}</strong>
            <span>Confirmed orphans</span>
            <small>${appContext.formatApproxBytes(audit.orphanBytes)} potentially reclaimable</small>
          </article>
          <article>
            <strong>${audit.oversized.length.toLocaleString()}</strong>
            <span>Files ≥ 3 MB</span>
            <small>Largest upload opportunities</small>
          </article>
          <article>
            <strong>${exactDupFiles.toLocaleString()}</strong>
            <span>Exact duplicate candidates</span>
            <small>${audit.exactDuplicateGroups.length.toLocaleString()} matching hash/size groups</small>
          </article>
          <article>
            <strong>${usage?.ok ? appContext.formatApproxBytes(totalStorage) : "—"}</strong>
            <span>Total File Storage used</span>
            <small>${usage?.ok ? `${appContext.formatApproxBytes(storageLeft)} left` : "Capacity RPC unavailable"}</small>
          </article>
        </div>

        <section class="storage-audit-section storage-audit-danger-zone">
          <div class="storage-audit-section-head">
            <div>
              <h3>Confirmed Orphaned Files</h3>
              <p>Files not referenced by any card image, thumbnail, original image or reversible watermark variant.</p>
            </div>
            <div class="storage-audit-inline-actions">
              <span class="hint">Scan only</span>
            </div>
          </div>
          ${appContext.storageAuditTableRows(audit.orphans,{limit:100})}
          <div class="storage-audit-safety-note">
            <strong>Analysis only</strong>
            <span>This tool reports unreferenced files and estimated reclaimable space. It cannot delete Storage objects.</span>
          </div>
        </section>

        <section class="storage-audit-section">
          <div class="storage-audit-section-head">
            <div><h3>Largest Files</h3><p>Top 50 files by Storage size.</p></div>
          </div>
          ${appContext.storageAuditTableRows(audit.largest,{limit:50})}
        </section>

        <section class="storage-audit-section">
          <div class="storage-audit-section-head">
            <div><h3>Oversized Files</h3><p>Files at least 3 MB. Consider compressing future uploads; these are not automatically deleted.</p></div>
          </div>
          ${appContext.storageAuditTableRows(audit.oversized,{limit:50})}
        </section>

        <section class="storage-audit-section">
          <div class="storage-audit-section-head">
            <div><h3>Duplicate Candidates</h3><p>Exact groups use matching Storage hash/ETag and byte size when available. Size-only matches are shown as possible duplicates and are never auto-deleted.</p></div>
          </div>
          <div class="storage-audit-duplicate-summary">
            <strong>${audit.exactDuplicateGroups.length.toLocaleString()} exact groups</strong>
            <span>${audit.possibleDuplicateGroups.length.toLocaleString()} possible size-only groups · ${possibleDupFiles.toLocaleString()} files</span>
          </div>
          ${audit.exactDuplicateGroups.length ? `
            <div class="storage-audit-duplicate-groups">
              ${audit.exactDuplicateGroups.slice(0,20).map((group,index)=>`
                <details>
                  <summary>Exact group ${index+1} · ${group.length} files · ${appContext.formatApproxBytes(group[0]?.size||0)} each</summary>
                  ${appContext.storageAuditTableRows(group,{limit:20})}
                </details>
              `).join("")}
            </div>
          ` : `<div class="empty compact"><p>No exact duplicate groups detected from available Storage metadata.</p></div>`}
        </section>
      `;

    };

    const runAudit=async()=>{
      const btn=appContext.$("storageAuditRunBtn");
      if(btn){
        btn.disabled=true;
        btn.textContent="Scanning Storage…";
      }
      setStatus(
        "Scanning Storage",
        "Reading Storage objects and cross-checking every database image reference…"
      );

      try{
        latestAudit=await appContext.buildOwnerStorageAudit();
        renderAudit(latestAudit);
        setStatus(
          "Audit complete",
          `${latestAudit.files.length.toLocaleString()} files checked · ${latestAudit.orphans.length.toLocaleString()} confirmed orphan${latestAudit.orphans.length===1?"":"s"} · ${appContext.formatApproxBytes(latestAudit.orphanBytes)} potentially reclaimable`,
          latestAudit.orphans.length?"warn":"ok"
        );
      }catch(error){
        console.error("Storage audit failed:",error);
        setStatus(
          "Audit unavailable",
          appContext.errorText(error,"Could not scan Storage. Nothing was deleted."),
          "warn"
        );
      }finally{
        if(btn){
          btn.disabled=false;
          btn.textContent="Run Storage Audit";
        }
      }
    };

    appContext.$("storageAuditRunBtn")?.addEventListener("click",runAudit);
  }


async function ownerCardStorageReferenceMap(){
    if(!appContext.requireOwner("analyze card image Storage references")) return new Map();

    const references=new Map();
    const add=(url,info)=>{
      const path=appContext.cardStoragePathFromUrl(url);
      if(!path) return;
      if(!references.has(path)) references.set(path,[]);
      references.get(path).push(info);
    };

    const scan=async(table,columns,order,visit)=>{
      const pageSize=500;
      for(let offset=0;;offset+=pageSize){
        const {data,error}=await appContext.supabaseClient
          .from(table)
          .select(columns)
          .order(order,{ascending:true})
          .range(offset,offset+pageSize-1);
        if(error) throw error;
        const rows=Array.isArray(data)?data:[];
        rows.forEach(visit);
        if(rows.length<pageSize) break;
      }
    };

    await scan(
      "cards",
      appContext.thumbnailUrlSupported ? "id,name,card_code,images,thumbnail_url" : "id,name,card_code,images",
      "id",
      row=>{
        (Array.isArray(row.images)?row.images:[]).forEach((url,index)=>{
          add(url,{
            type:"card-image",
            cardId:String(row.id||""),
            cardName:String(row.name||"Card"),
            cardCode:String(row.card_code||""),
            imageIndex:index+1
          });
        });
        if(row.thumbnail_url){
          add(row.thumbnail_url,{
            type:"thumbnail",
            cardId:String(row.id||""),
            cardName:String(row.name||"Card"),
            cardCode:String(row.card_code||""),
            imageIndex:0
          });
        }
      }
    );

    if(appContext.cardImageVariantsSupported){
      await scan(
        "card_image_variants",
        "image_key,card_id,original_url,watermarked_url,active_variant",
        "image_key",
        row=>{
          add(row.original_url,{
            type:"variant-original",
            cardId:String(row.card_id||""),
            imageKey:String(row.image_key||""),
            activeVariant:String(row.active_variant||"")
          });
          add(row.watermarked_url,{
            type:"variant-watermarked",
            cardId:String(row.card_id||""),
            imageKey:String(row.image_key||""),
            activeVariant:String(row.active_variant||"")
          });
        }
      );
    }

    return references;
  }

function storageOptimizerTargetBytes(size){
    const bytes=Number(size);
    if(!Number.isFinite(bytes) || bytes<=0) return null;
    const target=1.5*1024*1024;
    return Math.min(bytes,target);
  }

function storageOptimizerSavingsBytes(size){
    const bytes=Number(size);
    if(!Number.isFinite(bytes) || bytes<=0) return null;
    const target=appContext.storageOptimizerTargetBytes(bytes);
    if(!Number.isFinite(Number(target))) return null;
    return Math.max(0,bytes-Number(target));
  }

function storageOptimizerReferenceLabel(ref){
    if(!ref) return "Referenced";
    if(ref.type==="card-image"){
      return `${ref.cardName||"Card"}${ref.cardCode?` · ${ref.cardCode}`:""} · image ${ref.imageIndex||1}`;
    }
    if(ref.type==="thumbnail"){
      return `${ref.cardName||"Card"}${ref.cardCode?` · ${ref.cardCode}`:""} · thumbnail`;
    }
    if(ref.type==="variant-original"){
      return `Reversible watermark original${ref.cardId?` · card ${ref.cardId}`:""}`;
    }
    if(ref.type==="variant-watermarked"){
      return `Reversible watermark copy${ref.cardId?` · card ${ref.cardId}`:""}`;
    }
    return "Referenced";
  }

function storageOptimizerCardGroups(files,referenceMap){
    const cards=new Map();

    files.forEach(file=>{
      const refs=referenceMap.get(file.path)||[];
      refs.forEach(ref=>{
        const cardId=String(ref.cardId||"");
        if(!cardId || !["card-image","thumbnail"].includes(ref.type)) return;

        if(!cards.has(cardId)){
          cards.set(cardId,{
            cardId,
            cardName:ref.cardName||"Card",
            cardCode:ref.cardCode||"",
            paths:new Set(),
            bytes:0,
            estimatedSavings:0
          });
        }

        const group=cards.get(cardId);
        if(group.paths.has(file.path)) return;
        group.paths.add(file.path);
        group.bytes+=Number(file.size||0);
        group.estimatedSavings+=Number(appContext.storageOptimizerSavingsBytes(file.size)||0);
      });
    });

    return [...cards.values()].sort((a,b)=>b.bytes-a.bytes);
  }

function storageOptimizerVariantPairs(files,referenceMap){
    const byKey=new Map();

    files.forEach(file=>{
      const refs=referenceMap.get(file.path)||[];
      refs.forEach(ref=>{
        if(!["variant-original","variant-watermarked"].includes(ref.type)) return;
        const key=String(ref.imageKey||"");
        if(!key) return;

        if(!byKey.has(key)){
          byKey.set(key,{
            imageKey:key,
            cardId:String(ref.cardId||""),
            original:null,
            watermarked:null
          });
        }

        const group=byKey.get(key);
        if(ref.type==="variant-original") group.original=file;
        else group.watermarked=file;
      });
    });

    return [...byKey.values()]
      .filter(pair=>pair.original || pair.watermarked)
      .map(pair=>({
        ...pair,
        bytes:Number(pair.original?.size||0)+Number(pair.watermarked?.size||0),
        estimatedSavings:
          Number(appContext.storageOptimizerSavingsBytes(pair.original?.size)||0)+
          Number(appContext.storageOptimizerSavingsBytes(pair.watermarked?.size)||0)
      }))
      .sort((a,b)=>b.bytes-a.bytes);
  }

async function buildOwnerStorageOptimizer(){
    const [files,referenceMap,usage]=await Promise.all([
      appContext.listOwnerCardStorageObjects(),
      appContext.ownerCardStorageReferenceMap(),
      appContext.fetchSupabaseCapacityUsage()
    ]);

    const referencedFiles=files
      .filter(file=>referenceMap.has(file.path))
      .map(file=>({
        ...file,
        references:referenceMap.get(file.path)||[],
        targetBytes:appContext.storageOptimizerTargetBytes(file.size),
        estimatedSavings:appContext.storageOptimizerSavingsBytes(file.size)
      }));

    const knownFiles=referencedFiles.filter(file=>Number.isFinite(Number(file.size)) && Number(file.size)>0);
    const unknownSizeFiles=referencedFiles.filter(file=>!Number.isFinite(Number(file.size)) || Number(file.size)<=0);
    const over2=knownFiles.filter(file=>file.size>=2*1024*1024).sort((a,b)=>b.size-a.size);
    const over3=knownFiles.filter(file=>file.size>=3*1024*1024).sort((a,b)=>b.size-a.size);
    const over5=knownFiles.filter(file=>file.size>=5*1024*1024).sort((a,b)=>b.size-a.size);
    const opportunities=knownFiles
      .filter(file=>Number(file.estimatedSavings)>0)
      .sort((a,b)=>b.estimatedSavings-a.estimatedSavings);

    const estimatedSavings=opportunities.reduce((sum,file)=>sum+Number(file.estimatedSavings||0),0);
    const referencedBytes=knownFiles.reduce((sum,file)=>sum+Number(file.size||0),0);
    const cards=appContext.storageOptimizerCardGroups(referencedFiles,referenceMap);
    const variantPairs=appContext.storageOptimizerVariantPairs(referencedFiles,referenceMap);

    return {
      files:referencedFiles,
      over2,
      over3,
      over5,
      opportunities,
      estimatedSavings,
      referencedBytes,
      unknownSizeFiles,
      cards,
      variantPairs,
      usage
    };
  }

function storageOptimizerTableRows(rows,{limit=50,showReference=true}={}){
    if(!rows.length){
      return `<div class="empty compact"><p>No matching referenced files.</p></div>`;
    }

    return `
      <div class="storage-audit-table-wrap">
        <table class="storage-audit-table storage-optimizer-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Current</th>
              <th>Est. target</th>
              <th>Est. saving</th>
              ${showReference?`<th>Referenced by</th>`:""}
            </tr>
          </thead>
          <tbody>
            ${rows.slice(0,limit).map(file=>`
              <tr>
                <td>
                  <strong title="${appContext.escapeHtml(file.path)}">${appContext.escapeHtml(file.name)}</strong>
                  <small>${appContext.escapeHtml(file.path)}</small>
                </td>
                <td>${Number.isFinite(Number(file.size)) && Number(file.size)>0 ? appContext.escapeHtml(appContext.formatApproxBytes(file.size)) : "Size unavailable"}</td>
                <td>${Number.isFinite(Number(file.targetBytes)) && Number(file.targetBytes)>0 ? appContext.escapeHtml(appContext.formatApproxBytes(file.targetBytes)) : "—"}</td>
                <td><strong>${Number.isFinite(Number(file.estimatedSavings)) ? appContext.escapeHtml(appContext.formatApproxBytes(file.estimatedSavings)) : "—"}</strong></td>
                ${showReference?`
                  <td>
                    ${(file.references||[]).slice(0,2).map(ref=>
                      `<span class="storage-optimizer-ref">${appContext.escapeHtml(appContext.storageOptimizerReferenceLabel(ref))}</span>`
                    ).join("")}
                    ${(file.references||[]).length>2?`<small>+${(file.references||[]).length-2} more reference(s)</small>`:""}
                  </td>`:""}
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${rows.length>limit?`<div class="hint">Showing ${limit.toLocaleString()} of ${rows.length.toLocaleString()} files.</div>`:""}
      </div>
    `;
  }

function renderStorageOptimizerPage(){
    if(!appContext.requireOwner("open Storage optimizer")) return;

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Storage</div>
          <h2>Storage Optimizer</h2>
          <p>Analyze referenced card images and estimate how much File Storage could be recovered by recompressing oversized files.</p>
        </div>
      </div>

      <section class="panel storage-audit-panel">
        <div id="storageOptimizerStatus" class="storage-audit-status">
          <strong>Analysis only</strong>
          <span>This version does not modify, replace or delete referenced images.</span>
        </div>
        <div class="storage-audit-actions">
          <button type="button" class="btn-primary" id="storageOptimizerRunBtn">Analyze Referenced Images</button>
        </div>
        <div id="storageOptimizerResults"></div>
      </section>
    `;

    const setStatus=(title,message,kind="")=>{
      const el=appContext.$("storageOptimizerStatus");
      if(!el) return;
      el.className=`storage-audit-status ${kind}`.trim();
      el.innerHTML=`<strong>${appContext.escapeHtml(title)}</strong><span>${appContext.escapeHtml(message)}</span>`;
    };

    const run=async()=>{
      const btn=appContext.$("storageOptimizerRunBtn");
      if(btn){
        btn.disabled=true;
        btn.textContent="Analyzing…";
      }
      setStatus("Analyzing referenced images","Reading Storage metadata and matching it to cards and reversible watermark records…");

      try{
        const audit=await appContext.buildOwnerStorageOptimizer();
        const storageUsed=audit.usage?.ok ? audit.usage.storageBytes : null;
        const estimatedAfter=storageUsed!=null
          ? Math.max(0,storageUsed-audit.estimatedSavings)
          : null;

        appContext.$("storageOptimizerResults").innerHTML=`
          <div class="storage-audit-summary">
            <article>
              <strong>${audit.files.length.toLocaleString()}</strong>
              <span>Referenced files</span>
              <small>${appContext.formatApproxBytes(audit.referencedBytes)} tracked</small>
            </article>
            <article class="${audit.over2.length?"needs-attention":""}">
              <strong>${audit.over2.length.toLocaleString()}</strong>
              <span>Files ≥ 2 MB</span>
              <small>${audit.over3.length.toLocaleString()} ≥ 3 MB · ${audit.over5.length.toLocaleString()} ≥ 5 MB</small>
            </article>
            <article class="${audit.estimatedSavings>0?"needs-attention":""}">
              <strong>${appContext.formatApproxBytes(audit.estimatedSavings)}</strong>
              <span>Estimated savings</span>
              <small>Using a ~1.5 MB target per oversized referenced file</small>
            </article>
            <article>
              <strong>${audit.cards.length.toLocaleString()}</strong>
              <span>Cards with Storage files</span>
              <small>Ranked below by current Storage usage</small>
            </article>
            <article>
              <strong>${audit.variantPairs.length.toLocaleString()}</strong>
              <span>Watermark variant pairs</span>
              <small>Original + watermarked reversible pairs</small>
            </article>
            ${audit.unknownSizeFiles.length ? `
              <article class="needs-attention">
                <strong>${audit.unknownSizeFiles.length.toLocaleString()}</strong>
                <span>Sizes unavailable</span>
                <small>These files are excluded from the savings estimate</small>
              </article>
            ` : ""}
          </div>

          <section class="storage-audit-section">
            <div class="storage-audit-section-head">
              <div>
                <h3>Projected Storage Impact</h3>
                <p>This is a planning estimate only. No files have been changed.</p>
              </div>
            </div>
            <div class="storage-optimizer-projection">
              <div><span>Current total File Storage</span><strong>${storageUsed!=null?appContext.formatApproxBytes(storageUsed):"Unavailable"}</strong></div>
              <div><span>Estimated recoverable</span><strong>${appContext.formatApproxBytes(audit.estimatedSavings)}</strong></div>
              <div><span>Estimated total after optimization</span><strong>${estimatedAfter!=null?appContext.formatApproxBytes(estimatedAfter):"Unavailable"}</strong></div>
            </div>
            <div class="hint">Estimate assumes each referenced file above roughly 1.5 MB can be recompressed toward 1.5 MB. Actual results will depend on image dimensions, format and image complexity.</div>
          </section>

          <section class="storage-audit-section">
            <div class="storage-audit-section-head">
              <div>
                <h3>Biggest Optimization Opportunities</h3>
                <p>Referenced files with the largest estimated savings first.</p>
              </div>
            </div>
            ${appContext.storageOptimizerTableRows(audit.opportunities,{limit:60})}
          </section>

          <section class="storage-audit-section">
            <div class="storage-audit-section-head">
              <div>
                <h3>Cards Using the Most Storage</h3>
                <p>Counts unique Storage files referenced by each card.</p>
              </div>
            </div>
            ${audit.cards.length ? `
              <div class="storage-optimizer-card-list">
                ${audit.cards.slice(0,50).map((card,index)=>`
                  <article>
                    <span>${index+1}</span>
                    <div>
                      <strong>${appContext.escapeHtml(card.cardName)}</strong>
                      <small>${appContext.escapeHtml(card.cardCode||card.cardId)}</small>
                    </div>
                    <div>
                      <strong>${appContext.escapeHtml(appContext.formatApproxBytes(card.bytes))}</strong>
                      <small>${card.paths.size.toLocaleString()} file${card.paths.size===1?"":"s"} · est. ${appContext.escapeHtml(appContext.formatApproxBytes(card.estimatedSavings))} recoverable</small>
                    </div>
                  </article>
                `).join("")}
              </div>
            ` : `<div class="empty compact"><p>No referenced card Storage files found.</p></div>`}
          </section>

          <section class="storage-audit-section">
            <div class="storage-audit-section-head">
              <div>
                <h3>Reversible Watermark Pairs</h3>
                <p>These pairs intentionally retain both the original and watermarked copy. Do not delete originals if you want watermark reversal to remain available.</p>
              </div>
            </div>
            ${audit.variantPairs.length ? `
              <div class="storage-optimizer-pair-list">
                ${audit.variantPairs.slice(0,50).map((pair,index)=>`
                  <article>
                    <div>
                      <strong>Pair ${index+1}</strong>
                      <small>${appContext.escapeHtml(pair.cardId||pair.imageKey)}</small>
                    </div>
                    <div><span>Original</span><strong>${appContext.formatApproxBytes(pair.original?.size||0)}</strong></div>
                    <div><span>Watermarked</span><strong>${appContext.formatApproxBytes(pair.watermarked?.size||0)}</strong></div>
                    <div><span>Total</span><strong>${appContext.formatApproxBytes(pair.bytes)}</strong></div>
                    <div><span>Est. saving</span><strong>${appContext.formatApproxBytes(pair.estimatedSavings)}</strong></div>
                  </article>
                `).join("")}
              </div>
            ` : `<div class="empty compact"><p>No reversible watermark pairs found.</p></div>`}
          </section>
        `;

        setStatus(
          "Analysis complete",
          `${audit.files.length.toLocaleString()} referenced files checked · estimated ${appContext.formatApproxBytes(audit.estimatedSavings)} potentially recoverable`,
          audit.estimatedSavings>0?"warn":"ok"
        );
      }catch(error){
        console.error("Storage optimizer analysis failed:",error);
        setStatus(
          "Analysis unavailable",
          appContext.errorText(error,"Could not analyze referenced Storage images. Nothing was changed."),
          "warn"
        );
      }finally{
        if(btn){
          btn.disabled=false;
          btn.textContent="Analyze Referenced Images";
        }
      }
    };

    appContext.$("storageOptimizerRunBtn")?.addEventListener("click",run);
  }

function renderSupabaseHealthPage(){
    if(!appContext.requireOwner("view Supabase health")) return;

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Storage</div>
          <h2>Database & Storage</h2>
          <p>Owner-only capacity overview for your Supabase project.</p>
        </div>
      </div>
      <section class="panel supabase-health-panel">
        <div class="supabase-health-grid">
          <div><strong id="healthDbUsed">—</strong><span>Database used</span></div>
          <div><strong id="healthDbLeft">—</strong><span>Database left</span></div>
          <div><strong id="healthStorageUsed">—</strong><span>File Storage used</span></div>
          <div><strong id="healthStorageLeft">—</strong><span>File Storage left</span></div>
          <div><strong id="healthHistoryRows">—</strong><span>Edit history rows · max 100</span></div>
        </div>
        <button class="btn-primary" type="button" id="healthRefreshBtn">Refresh Supabase Usage</button>
        <div id="healthCapacityWarning" class="capacity-warning" hidden></div>
        <div class="hint" style="margin-top:10px">Database and file usage are read through the owner-only <code>get_owner_capacity_usage()</code> RPC. Remaining values are calculated from the live usage returned by <code>get_owner_capacity_usage()</code>. Pro plan included capacities used for the calculation: 8 GB database disk and 100 GB File Storage.</div>
      </section>`;

    const refresh=async()=>{
      if(!appContext.isOwnerMode()) return;
      const btn=appContext.$("healthRefreshBtn");
      if(!btn) return;
      btn.disabled=true;
      btn.textContent="Refreshing…";

      try{
        const usage=await appContext.fetchSupabaseCapacityUsage();

        if(!usage?.ok){
          ["healthDbUsed","healthDbLeft","healthStorageUsed","healthStorageLeft"].forEach(id=>{
            const el=appContext.$(id);
            if(el) el.textContent="Unavailable";
          });
        }else{
          const dbLeft=appContext.capacityLeft(usage.databaseBytes,SUPABASE_PRO_DATABASE_LIMIT_BYTES);
          const storageLeft=appContext.capacityLeft(usage.storageBytes,SUPABASE_PRO_STORAGE_LIMIT_BYTES);
          appContext.$("healthDbUsed").textContent=appContext.formatApproxBytes(usage.databaseBytes);
          appContext.$("healthDbLeft").textContent=appContext.formatApproxBytes(dbLeft);
          appContext.$("healthStorageUsed").textContent=appContext.formatApproxBytes(usage.storageBytes);
          appContext.$("healthStorageLeft").textContent=appContext.formatApproxBytes(storageLeft);

          appContext.$("healthDbUsed").title=appContext.capacitySummaryText("Database",usage.databaseBytes,SUPABASE_PRO_DATABASE_LIMIT_BYTES);
          appContext.$("healthDbLeft").title=appContext.capacitySummaryText("Database",usage.databaseBytes,SUPABASE_PRO_DATABASE_LIMIT_BYTES);
          appContext.$("healthStorageUsed").title=appContext.capacitySummaryText("File Storage",usage.storageBytes,SUPABASE_PRO_STORAGE_LIMIT_BYTES);
          appContext.$("healthStorageLeft").title=appContext.capacitySummaryText("File Storage",usage.storageBytes,SUPABASE_PRO_STORAGE_LIMIT_BYTES);

          const dbPct=appContext.capacityPercent(usage.databaseBytes,SUPABASE_PRO_DATABASE_LIMIT_BYTES);
          const storagePct=appContext.capacityPercent(usage.storageBytes,SUPABASE_PRO_STORAGE_LIMIT_BYTES);
          const warning=appContext.$("healthCapacityWarning");
          const parts=[];
          if(dbPct>=80) parts.push(`Database is ${dbPct.toFixed(1)}% of the 8 GB Pro included database disk.`);
          if(storagePct>=80) parts.push(`File Storage is ${storagePct.toFixed(1)}% of the 100 GB Pro included File Storage.`);
          warning.hidden=!parts.length;
          warning.classList.toggle("danger",dbPct>=90||storagePct>=90);
          warning.textContent=parts.join(" ");
        }

        // History count is optional. Never let a denied history count prevent
        // the Storage page itself from opening.
        try{
          const historyResult=await appContext.supabaseClient
            .from("card_edit_history")
            .select("id",{count:"exact",head:true});
          appContext.$("healthHistoryRows").textContent=historyResult.error
            ? "Unavailable"
            : Number(historyResult.count||0).toLocaleString();
        }catch{
          appContext.$("healthHistoryRows").textContent="Unavailable";
        }
      }catch(error){
        console.warn("Supabase health refresh failed:",error);
        ["healthDbUsed","healthDbLeft","healthStorageUsed","healthStorageLeft","healthHistoryRows"].forEach(id=>{
          const el=appContext.$(id);
          if(el) el.textContent="Unavailable";
        });
      }finally{
        btn.disabled=false;
        btn.textContent="Refresh Supabase Usage";
      }
    };

    appContext.$("healthRefreshBtn")?.addEventListener("click",refresh);
    refresh();
  }

  Object.assign(appContext,{currentInventoryToolMode,currentInventoryToolSubmode,inventoryToolsSwitcher,getStoredImageHealthSummary,saveStoredImageHealthSummary,ownerInventoryHealthSummary,ownerHealthClass,invalidateOwnerReservedAgeCache,ownerReservedAgeDays,ownerReservedAgeLabel,loadOwnerReservedAges,ownerReservedAgeSummary,hydrateOwnerReservedAgeUI,refreshOwnerReservedAgeUI,ownerAlertSummary,ownerAlertsDashboardHTML,storageAuditFileSize,storageAuditResolveFileSize,storageAuditFileEtag,listOwnerCardStorageObjects,ownerCardStorageReferencePaths,storageAuditDuplicateGroups,buildOwnerStorageAudit,storageAuditTableRows,renderStorageAuditPage,ownerCardStorageReferenceMap,storageOptimizerTargetBytes,storageOptimizerSavingsBytes,storageOptimizerReferenceLabel,storageOptimizerCardGroups,storageOptimizerVariantPairs,buildOwnerStorageOptimizer,storageOptimizerTableRows,renderStorageOptimizerPage,renderSupabaseHealthPage});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.IMAGE_HEALTH_SUMMARY_KEY = "collect_tcg_image_health_summary_v1";

  appContext.ownerReservedAgeCache = {
    loaded:false,
    loading:false,
    map:new Map()
  };
}
