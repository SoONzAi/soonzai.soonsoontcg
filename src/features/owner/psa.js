/** V93 beta: features/owner/psa. Shared dependencies are explicit on appContext. */
export function register(appContext){
function normalizePsaCertInput(value){
    const raw=String(value||"").trim();
    if(!raw) return "";

    const urlMatch=raw.match(/psacard\.com\/cert\/(\d+)/i);
    if(urlMatch?.[1]) return urlMatch[1];

    return /^\d+$/.test(raw) ? raw : raw.replace(/\D+/g,"");
  }

function psaCertUrl(value){
    const cert=appContext.normalizePsaCertInput(value);
    return cert ? `https://www.psacard.com/cert/${encodeURIComponent(cert)}/psa` : "";
  }

function gradePopLabel(grade){
    if(!grade || String(grade.company||"").trim().toUpperCase()!=="PSA") return "";
    if(grade.pop_count==null || grade.pop_count==="") return "";
    const pop=Number(grade.pop_count);
    return Number.isFinite(pop) ? `POP ${pop.toLocaleString()}` : "";
  }

function gradePopDetailLabel(grade){
    const pop=appContext.gradePopLabel(grade);
    if(!pop) return "";
    const higher=grade?.pop_higher;
    const higherText=higher!=null && higher!=="" && Number.isFinite(Number(higher))
      ? ` · ${Number(higher).toLocaleString()} higher`
      : "";
    return `${pop}${higherText}`;
  }

function validGradingEntries(card){
    return (Array.isArray(card?.grading)?card.grading:[])
      .filter(g=>g && String(g.company||"").trim());
  }

function gradingSummaryLabel(card){
    const grades=appContext.validGradingEntries(card);
    if(!grades.length) return "";

    const labels=grades.map(g=>
      `${String(g.company||"").trim().toUpperCase()} ${String(g.grade||"").trim()}`.trim()
    );
    const unique=[...new Set(labels)];

    if(grades.length===1) return labels[0];

    if(unique.length===1){
      return `${unique[0]} ×${grades.length}`;
    }

    return `${grades.length} graded slabs`;
  }

function gradingPopSummaryLabel(card){
    const grades=appContext.validGradingEntries(card);
    if(grades.length!==1) return "";
    return appContext.gradePopLabel(grades[0]);
  }

function slabLabel(index,total){
    return total>1 ? `Slab ${index+1}` : "Slab";
  }

function psaPopEntries(){
    const rows=[];

    // Keep one row per listing/slab, even when multiple listings intentionally
    // reference the same PSA certificate. The UI/counts are listing-based;
    // startBulkPsaPopSync() still deduplicates the actual PSA cert lookup queue.
    appContext.cards.forEach(card=>{
      (Array.isArray(card.grading)?card.grading:[]).forEach((grade,index)=>{
        if(String(grade?.company||"").trim().toUpperCase()!=="PSA") return;

        const cert=appContext.normalizePsaCertInput(grade?.cert||"");
        if(!cert) return;

        const updatedAt=String(grade?.pop_updated_at||"");
        const updatedMs=updatedAt ? new Date(updatedAt).getTime() : NaN;

        rows.push({
          cardId:String(card.id||""),
          cardName:String(card.name||"Card"),
          cardCode:String(card.card_code||""),
          gradeIndex:index,
          slabNumber:index+1,
          slabCount:(Array.isArray(card.grading)?card.grading:[]).filter(g=>g&&String(g.company||"").trim()).length,
          cert,
          pop:grade?.pop_count,
          higher:grade?.pop_higher,
          updatedAt,
          updatedMs:Number.isFinite(updatedMs)?updatedMs:null
        });
      });
    });

    return rows.sort((a,b)=>
      a.cardName.localeCompare(b.cardName) ||
      a.cert.localeCompare(b.cert)
    );
  }

function psaPopEntryUpdatedMs(entry){
    const direct=Number(entry?.updatedMs);
    if(Number.isFinite(direct) && direct>0) return direct;

    const parsed=Date.parse(entry?.updatedAt||"");
    return Number.isFinite(parsed) ? parsed : 0;
  }

function psaPopEntryIsDue(entry){
    if(entry?.pop==null || entry?.pop==="") return true;

    const updatedMs=psaPopEntryUpdatedMs(entry);
    if(!updatedMs) return true;

    const configuredMs=Number(appContext.PSA_POP_DAILY_MS);
    const dueMs=Number.isFinite(configuredMs) && configuredMs>0
      ? configuredMs
      : 3 * 24 * 60 * 60 * 1000;

    // Array.filter passes (entry, index, array), so never accept a second
    // callback argument as the current timestamp. Always use the real time.
    return Date.now()-updatedMs>=dueMs;
  }

function encodePsaBulkState(state){
    try{
      const json=JSON.stringify(state);
      return btoa(unescape(encodeURIComponent(json)));
    }catch{
      return "";
    }
  }

function decodePsaBulkState(value){
    try{
      if(!value) return null;
      const json=decodeURIComponent(escape(atob(String(value))));
      const parsed=JSON.parse(json);
      if(!parsed || !Array.isArray(parsed.certs)) return null;
      return parsed;
    }catch{
      return null;
    }
  }

function readPsaBulkState(explicitEncoded=""){
    const fromUrl=appContext.decodePsaBulkState(explicitEncoded);
    if(fromUrl) return fromUrl;

    try{
      const parsed=JSON.parse(appContext.sessionStorage.getItem(appContext.PSA_BULK_SYNC_KEY)||"null");
      if(!parsed || !Array.isArray(parsed.certs)) return null;
      return parsed;
    }catch{
      return null;
    }
  }

function writePsaBulkState(state){
    appContext.sessionStorage.setItem(appContext.PSA_BULK_SYNC_KEY,JSON.stringify(state));
    return appContext.encodePsaBulkState(state);
  }

function clearPsaBulkState(){
    appContext.sessionStorage.removeItem(appContext.PSA_BULK_SYNC_KEY);
  }

function openPsaPopAutoSync(cert,{bulk=false,bulkState=null}={}){
    const normalized=appContext.normalizePsaCertInput(cert);
    if(!normalized){
      appContext.showToast("Add a PSA cert number first");
      return false;
    }

    const returnUrl=new URL(location.href);
    returnUrl.hash="";

    const psaUrl=new URL(appContext.psaCertUrl(normalized));
    psaUrl.searchParams.set("collectSync","1");
    psaUrl.searchParams.set("collectReturn",returnUrl.toString());

    if(bulk){
      psaUrl.searchParams.set("collectBulk","1");
      const encoded=bulkState ? appContext.writePsaBulkState(bulkState) : "";
      if(encoded) psaUrl.searchParams.set("collectBulkState",encoded);
    }

    appContext.showToast(bulk ? "Updating PSA POPs…" : "Opening PSA to refresh POP…");
    location.href=psaUrl.toString();
    return true;
  }

function startBulkPsaPopSync(entries,label="PSA POP"){
    if(!appContext.requireOwner("bulk update PSA POP")) return;

    const certs=(entries||[])
      .map(entry=>normalizePsaCertInput(entry?.cert))
      .filter(Boolean);

    if(!certs.length){
      appContext.showToast("No PSA certs need updating");
      return;
    }

    const state={
      certs,
      index:0,
      completed:0,
      failed:[],
      label,
      startedAt:new Date().toISOString(),
      returnHash:"#/inventory-tools?mode=bulk&sub=psa"
    };

    // A new manual refresh always replaces any stale/interrupted queue.
    appContext.clearPsaBulkState();
    appContext.writePsaBulkState(state);
    appContext.sessionStorage.removeItem(appContext.PSA_BULK_RESULT_KEY);

    const started=appContext.openPsaPopAutoSync(certs[0],{bulk:true,bulkState:state});
    if(!started){
      appContext.clearPsaBulkState();
      appContext.showToast("Unable to start PSA POP refresh");
    }
  }

function finishPsaBulkSync(state){
    const result={
      total:state.certs.length,
      completed:Number(state.completed||0),
      failed:Array.isArray(state.failed)?state.failed:[],
      label:state.label||"PSA POP",
      finishedAt:new Date().toISOString()
    };

    appContext.sessionStorage.setItem(appContext.PSA_BULK_RESULT_KEY,JSON.stringify(result));
    try{
      if(result.failed.length){
        appContext.localStorage.setItem(appContext.PSA_BULK_RETRY_KEY,JSON.stringify(result));
      }else{
        appContext.localStorage.removeItem(appContext.PSA_BULK_RETRY_KEY);
      }
    }catch{}
    appContext.clearPsaBulkState();

    appContext.showToast(
      result.failed.length
        ? `PSA POP bulk update finished · ${result.completed} updated · ${result.failed.length} failed`
        : `PSA POP bulk update finished · ${result.completed} updated`
    );

    location.hash=state.returnHash||"#/inventory-tools?mode=bulk&sub=psa";
  }

function continuePsaBulkSync(cert,{ok=true,reason="",encodedState=""}={}){
    const state=appContext.readPsaBulkState(encodedState);
    if(!state) return false;

    const currentCert=appContext.normalizePsaCertInput(state.certs[state.index]||"");
    const incomingCert=appContext.normalizePsaCertInput(cert||"");

    if(currentCert && incomingCert && currentCert!==incomingCert){
      return false;
    }

    if(ok){
      state.completed=Number(state.completed||0)+1;
    }else{
      state.failed=Array.isArray(state.failed)?state.failed:[];
      state.failed.push({
        cert:incomingCert||currentCert||"",
        reason:String(reason||"Update failed").slice(0,160)
      });
    }

    state.index=Number(state.index||0)+1;
    appContext.writePsaBulkState(state);

    if(state.index>=state.certs.length){
      appContext.finishPsaBulkSync(state);
      return true;
    }

    const nextCert=state.certs[state.index];

    appContext.view.innerHTML=`
      <div class="empty psa-sync-waiting">
        <h2>Bulk PSA POP Update</h2>
        <p>${appContext.escapeHtml(String(state.index))} / ${appContext.escapeHtml(String(state.certs.length))} completed.</p>
        <p>Opening the next PSA certificate…</p>
      </div>`;

    setTimeout(()=>appContext.openPsaPopAutoSync(nextCert,{bulk:true,bulkState:state}),250);
    return true;
  }

function readPsaBulkRetryResult(){
    try{
      const parsed=JSON.parse(appContext.localStorage.getItem(appContext.PSA_BULK_RETRY_KEY)||"null");
      if(!parsed || !Array.isArray(parsed.failed)) return null;
      return parsed;
    }catch{
      return null;
    }
  }

function clearPsaBulkRetryResult(){
    try{ appContext.localStorage.removeItem(appContext.PSA_BULK_RETRY_KEY); }catch{}
  }

function hasPsaCert(card){
    return Array.isArray(card.grading) && card.grading.some(g =>
      g && String(g.company || "").toUpperCase() === "PSA" && String(g.cert || "").trim()
    );
  }

async function refreshPsaPopForCard(cardId, silent=false){
    try{
      const { data, error } = await appContext.supabaseClient.functions.invoke("refresh-psa-pop", {
        body: { card_id: cardId }
      });
      if(error) throw error;

      if(data && data.card){
        const refreshed = appContext.dbToCard(data.card);
        const idx = appContext.cards.findIndex(c=>c.id === refreshed.id);
        if(idx > -1) appContext.cards[idx] = refreshed;

        const synced = Array.isArray(refreshed.grading) && refreshed.grading.some(g =>
          String(g.company || "").toUpperCase() === "PSA" && g.pop_count != null
        );

        if(!silent){
          appContext.showToast(synced ? "PSA POP updated" : "PSA cert saved, but POP was not returned");
        }
        return refreshed;
      }

      if(!silent) appContext.showToast(data?.message || "PSA POP was not returned");
    }catch(e){
      console.error("PSA POP sync error:", e);
      if(!silent) appContext.showToast("Saved, but PSA POP sync was unavailable");
    }
    return null;
  }

async function handleIncomingPsaPopSync(){
    const rawHash=String(location.hash||"");
    const queryIndex=rawHash.indexOf("?");
    const params=new URLSearchParams(queryIndex>=0 ? rawHash.slice(queryIndex+1) : "");

    const cert=appContext.normalizePsaCertInput(params.get("cert")||"");
    const popRaw=params.get("pop");
    const higherRaw=params.get("higher");
    const source=params.get("source")||"";
    const incomingError=String(params.get("error")||"").trim();
    const incomingBulkState=String(params.get("bulkState")||"");

    const pop=popRaw!=null && popRaw!=="" ? Number(popRaw) : NaN;
    const higher=higherRaw!=null && higherRaw!=="" ? Number(higherRaw) : null;

    if(incomingError){
      if(appContext.continuePsaBulkSync(cert,{ok:false,reason:incomingError,encodedState:incomingBulkState})) return;

      appContext.view.innerHTML=`
        <div class="empty">
          <h2>PSA POP Update Failed</h2>
          <p>${appContext.escapeHtml(incomingError)}</p>
          <button type="button" class="btn-primary" id="psaSyncBackBtn">Browse Inventory</button>
        </div>`;
      appContext.$("psaSyncBackBtn")?.addEventListener("click",()=>appContext.goToRoute("inventory"));
      return;
    }

    if(!cert || !Number.isFinite(pop) || pop<0){
      if(appContext.continuePsaBulkSync(cert,{ok:false,reason:"PSA POP data was incomplete",encodedState:incomingBulkState})) return;

      appContext.view.innerHTML=`
        <div class="empty">
          <h2>PSA POP Sync</h2>
          <p>The incoming PSA POP data is incomplete or invalid.</p>
          <button type="button" class="btn-primary" id="psaSyncBackBtn">Browse Inventory</button>
        </div>`;
      appContext.$("psaSyncBackBtn")?.addEventListener("click",()=>appContext.goToRoute("inventory"));
      return;
    }

    if(!appContext.isOwnerMode()){
      appContext.view.innerHTML=`
        <div class="empty psa-sync-waiting">
          <h2>PSA POP Ready</h2>
          <p>Cert <strong>${appContext.escapeHtml(cert)}</strong> · POP <strong>${appContext.escapeHtml(pop.toLocaleString())}</strong>${higher!=null && Number.isFinite(higher) ? ` · ${appContext.escapeHtml(higher.toLocaleString())} higher` : ""}</p>
          <p>Enable <strong>Owner Mode</strong>, then click Apply PSA POP.</p>
          <button type="button" class="btn-primary" id="psaSyncApplyBtn">Apply PSA POP</button>
        </div>`;
      appContext.$("psaSyncApplyBtn")?.addEventListener("click",appContext.handleIncomingPsaPopSync);
      return;
    }

    const matches=[];
    appContext.cards.forEach(card=>{
      (Array.isArray(card.grading)?card.grading:[]).forEach((grade,index)=>{
        if(
          String(grade?.company||"").trim().toUpperCase()==="PSA" &&
          appContext.normalizePsaCertInput(grade?.cert||"")===cert
        ){
          matches.push({card,grade,index});
        }
      });
    });

    if(matches.length===0){
      if(appContext.continuePsaBulkSync(cert,{ok:false,reason:"No matching PSA cert in inventory",encodedState:incomingBulkState})) return;
      appContext.view.innerHTML=`
        <div class="empty">
          <h2>No Matching PSA Cert</h2>
          <p>No card in your inventory has PSA cert <strong>${appContext.escapeHtml(cert)}</strong>.</p>
          <p>Add/save that cert number to the graded card first, then use <strong>Send to Collect TCG</strong> again from PSA.</p>
          ${source ? `<a class="btn-ghost" href="${appContext.escapeHtml(appContext.safeHttpUrl(source)||appContext.psaCertUrl(cert))}" target="_blank" rel="noopener">Open PSA ↗</a>` : ""}
          <button type="button" class="btn-primary" id="psaSyncBackBtn">Browse Inventory</button>
        </div>`;
      appContext.$("psaSyncBackBtn")?.addEventListener("click",()=>appContext.goToRoute("inventory"));
      return;
    }

    // The same PSA cert may intentionally be referenced by more than one listing.
    // POP is cert-level information, so one successful lookup should populate every
    // matching listing instead of treating the duplicate reference as an error.
    const matchesByCard=new Map();
    matches.forEach(match=>{
      const id=String(match.card?.id||"");
      if(!id) return;
      if(!matchesByCard.has(id)) matchesByCard.set(id,{card:match.card,indexes:new Set()});
      matchesByCard.get(id).indexes.add(match.index);
    });

    const targets=[...matchesByCard.values()];
    const popUpdatedAt=new Date().toISOString();

    appContext.view.innerHTML=`
      <div class="empty psa-sync-waiting">
        <h2>Updating PSA POP…</h2>
        <p>Cert ${appContext.escapeHtml(cert)} · applying POP to ${appContext.escapeHtml(String(targets.length))} ${targets.length===1?"listing":"listings"}</p>
      </div>`;

    const savedCards=[];
    for(const target of targets){
      const nextGrades=(Array.isArray(target.card.grading)?target.card.grading:[]).map((grade,index)=>
        target.indexes.has(index)
          ? {
              ...grade,
              cert,
              pop_count:Math.round(pop),
              pop_higher:higher!=null && Number.isFinite(higher) && higher>=0 ? Math.round(higher) : null,
              pop_updated_at:popUpdatedAt
            }
          : grade
      );

      const saved=await appContext.updateCardStorage({...target.card,grading:nextGrades});
      if(!saved){
        if(appContext.continuePsaBulkSync(cert,{ok:false,reason:"Supabase card update failed",encodedState:incomingBulkState})) return;
        appContext.view.innerHTML=`
          <div class="empty">
            <h2>PSA POP Update Failed</h2>
            <p>PSA returned the POP, but Supabase did not accept the update for every matching listing.</p>
            <button type="button" class="btn-primary" id="psaSyncRetryBtn">Retry</button>
          </div>`;
        appContext.$("psaSyncRetryBtn")?.addEventListener("click",appContext.handleIncomingPsaPopSync);
        return;
      }

      appContext.replaceCardInMemory(saved);
      savedCards.push(saved);
    }

    appContext.showToast(
      targets.length>1
        ? `PSA POP ${Math.round(pop).toLocaleString()} saved to ${targets.length} listings`
        : `PSA POP ${Math.round(pop).toLocaleString()} saved`
    );

    if(appContext.continuePsaBulkSync(cert,{ok:true,encodedState:incomingBulkState})) return;

    const firstSaved=savedCards[0];
    if(firstSaved) appContext.goToRoute(`card/${encodeURIComponent(firstSaved.id)}`);
    else appContext.goToRoute("inventory");
  }

  Object.assign(appContext,{normalizePsaCertInput,psaCertUrl,gradePopLabel,gradePopDetailLabel,validGradingEntries,gradingSummaryLabel,gradingPopSummaryLabel,slabLabel,psaPopEntries,psaPopEntryUpdatedMs,psaPopEntryIsDue,encodePsaBulkState,decodePsaBulkState,readPsaBulkState,writePsaBulkState,clearPsaBulkState,openPsaPopAutoSync,startBulkPsaPopSync,finishPsaBulkSync,continuePsaBulkSync,readPsaBulkRetryResult,clearPsaBulkRetryResult,hasPsaCert,refreshPsaPopForCard,handleIncomingPsaPopSync});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.PSA_BULK_SYNC_KEY = "collect_tcg_psa_bulk_sync_v2";

  appContext.PSA_BULK_RESULT_KEY = "collect_tcg_psa_bulk_result_v1";
  appContext.PSA_BULK_RETRY_KEY = "collect_tcg_psa_bulk_retry_v1";

  appContext.PSA_POP_DAILY_MS = 3 * 24 * 60 * 60 * 1000;

  appContext.detailsReturnHash = "#/inventory";

  appContext.LISTING_SCROLL_STATE_KEY = "collect_tcg_listing_scroll_return_v1";

  appContext.FILTERED_RESULTS_BROWSE_KEY = "collect_tcg_filtered_results_browse_v1";

  appContext.filteredResultsBrowseContext = null;
}
