/** V93 beta: features/owner/export. Shared dependencies are explicit on appContext. */
export function register(appContext){
function csvEscape(value){
    const s=String(value ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

function exportGradingText(card){
    const grades=Array.isArray(card.grading)?card.grading.filter(g=>g&&g.company):[];
    return grades.map(g=>`${g.company} ${g.grade||""}`.trim()).join(" | ");
  }

function exportCertText(card){
    const grades=Array.isArray(card.grading)?card.grading.filter(g=>g&&g.company):[];
    return grades.map(g=>g.cert||"").filter(Boolean).join(" | ");
  }

function safeExportScope(value){
    return ["all","available","reserved","sold","collection (nfs)"].includes(value)?value:"all";
  }

function exportCardsForScope(scope){
    const s=appContext.safeExportScope(scope);
    if(s==="all") return appContext.cards.slice();
    return appContext.cards.filter(card=>appContext.normalizeFilterValue(card.availability)===s);
  }

function downloadTextFile(filename,text,mime="text/plain;charset=utf-8"){
    const blob=new Blob([text],{type:mime});
    const href=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=href;
    a.download=filename;
    a.rel="noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),1200);
  }

function buildInventoryCsv(rows,includeCert){
    const header=[
      "ID","Card Code","Name","Year","Game","Series","Set","Era","Language","Language Details","Format",
      "Rarity","Condition","Availability","Quantity","MYR","USD","SGD","Cost",
      "Grading",...(includeCert?["Certificate"]:[]),"Notes","Images","Created At","Updated At","Sold At"
    ];

    const lines=[header.map(appContext.csvEscape).join(",")];

    rows.forEach(card=>{
      const values=[
        card.id,
        card.card_code,
        card.name,
        card.year,
        card.game,
        card.series,
        card.set,
        card.era,
        card.language,
        card.language_details,
        appContext.effectiveFormat(card),
        card.rarity,
        card.condition,
        card.availability,
        card.qty,
        card.price_myr,
        card.price_usd ?? card.price,
        card.price_sgd,
        card.cost,
        appContext.exportGradingText(card),
        ...(includeCert?[appContext.exportCertText(card)]:[]),
        card.notes,
        appContext.getImages(card).join(" | "),
        card.created_at,
        card.updated_at,
        card.sold_at
      ];
      lines.push(values.map(appContext.csvEscape).join(","));
    });

    return "\uFEFF"+lines.join("\r\n");
  }

function buildInventoryBackupJson(rows,includePrivate){
    const safeRows=rows.map(card=>{
      const backup={
        id:card.id,
        name:card.name,
        card_code:card.card_code,
        year:card.year,
        game:card.game,
        language:card.language,
        language_details:card.language_details,
        era:card.era,
        availability:card.availability,
        set:card.set,
        series:card.series,
        format:card.format,
        rarity:card.rarity,
        condition:card.condition,
        qty:card.qty,
        price_myr:card.price_myr,
        price_usd:card.price_usd ?? card.price ?? null,
        price_sgd:card.price_sgd,
        cost:card.cost,
        notes:card.notes,
        images:appContext.getImages(card).slice(),
        grading:Array.isArray(card.grading)?card.grading.map(g=>({
          company:g.company||"",
          grade:g.grade||"",
          ...(includePrivate?{cert:g.cert||""}:{}),
          pop_count:g.pop_count==null?null:Number(g.pop_count),
          pop_higher:g.pop_higher==null?null:Number(g.pop_higher),
          pop_updated_at:g.pop_updated_at||null
        })):[],
        sold_at:card.sold_at||null,
        created_at:card.created_at||null,
        updated_at:card.updated_at||null
      };
      return backup;
    });

    return JSON.stringify({
      format:"collect-tcg-inventory-backup",
      version:1,
      exported_at:new Date().toISOString(),
      count:safeRows.length,
      cards:safeRows
    },null,2);
  }

function renderInventoryExportPage(){
    if(!appContext.requireOwner("open inventory export")) return;

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Owner Tool</div>
          <h2>Inventory Export & Backup</h2>
          <p>Download an offline copy of your inventory for analysis, record-keeping or disaster recovery.</p>
        </div>
      </div>

      <div class="export-owner-grid">
        <section class="panel export-owner-card">
          <div class="eyebrow">CSV Export</div>
          <h3>Spreadsheet Export</h3>
          <p>Exports inventory as UTF-8 CSV for Excel, Numbers or Google Sheets.</p>

          <div class="field">
            <label for="exportCsvScope">Listings</label>
            <select id="exportCsvScope">
              <option value="all">All listings</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
              <option value="collection (nfs)">Collection (NFS)</option>
            </select>
          </div>

          <label class="export-owner-check">
            <input type="checkbox" id="exportCsvCert">
            <span>Include grading certificate numbers</span>
          </label>
          <div class="export-owner-sensitive">Certificate numbers are owner-private data. Leave this off unless you specifically need them in the export.</div>

          <button type="button" class="btn-primary" id="exportCsvBtn">Download CSV</button>
          <div class="hint" id="exportCsvStatus"></div>
        </section>

        <section class="panel export-owner-card">
          <div class="eyebrow">JSON Backup</div>
          <h3>Full Inventory Backup</h3>
          <p>Creates a structured JSON backup containing inventory metadata, prices, images and grading data.</p>

          <div class="field">
            <label for="exportJsonScope">Listings</label>
            <select id="exportJsonScope">
              <option value="all">All listings</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
              <option value="collection (nfs)">Collection (NFS)</option>
            </select>
          </div>

          <label class="export-owner-check">
            <input type="checkbox" id="exportJsonPrivate">
            <span>Include grading certificate numbers</span>
          </label>
          <div class="export-owner-sensitive">The backup never includes authentication tokens, passwords, Supabase keys, visitor IDs or owner-session data.</div>

          <button type="button" class="btn-primary" id="exportJsonBtn">Download JSON Backup</button>
          <div class="hint" id="exportJsonStatus"></div>
        </section>
      </div>

      <div class="panel export-owner-note">
        <strong>Backup recommendation</strong>
        <span>Keep periodic copies somewhere separate from the website. Export files are generated locally in your browser and do not create a new database write.</span>
      </div>
    `;

    appContext.$("exportCsvBtn").addEventListener("click",()=>{
      if(!appContext.requireOwner("export inventory CSV")) return;
      const scope=appContext.safeExportScope(appContext.$("exportCsvScope").value);
      const includeCert=appContext.$("exportCsvCert").checked;
      const rows=appContext.exportCardsForScope(scope);
      const csv=appContext.buildInventoryCsv(rows,includeCert);
      const stamp=new Date().toISOString().slice(0,10);
      appContext.downloadTextFile(`Collect-TCG-Inventory-${scope.replace(/[^a-z0-9]+/gi,"-")}-${stamp}.csv`,csv,"text/csv;charset=utf-8");
      appContext.$("exportCsvStatus").textContent=`Exported ${rows.length} listing${rows.length===1?"":"s"}.`;
      appContext.showToast(`CSV downloaded · ${rows.length} listings`);
    });

    appContext.$("exportJsonBtn").addEventListener("click",()=>{
      if(!appContext.requireOwner("export inventory backup")) return;
      const scope=appContext.safeExportScope(appContext.$("exportJsonScope").value);
      const includePrivate=appContext.$("exportJsonPrivate").checked;
      const rows=appContext.exportCardsForScope(scope);
      const json=appContext.buildInventoryBackupJson(rows,includePrivate);
      const stamp=new Date().toISOString().slice(0,10);
      appContext.downloadTextFile(`Collect-TCG-Backup-${scope.replace(/[^a-z0-9]+/gi,"-")}-${stamp}.json`,json,"application/json;charset=utf-8");
      appContext.$("exportJsonStatus").textContent=`Backed up ${rows.length} listing${rows.length===1?"":"s"}.`;
      appContext.showToast(`JSON backup downloaded · ${rows.length} listings`);
    });
  }

  Object.assign(appContext,{csvEscape,exportGradingText,exportCertText,safeExportScope,exportCardsForScope,downloadTextFile,buildInventoryCsv,buildInventoryBackupJson,renderInventoryExportPage});
}
