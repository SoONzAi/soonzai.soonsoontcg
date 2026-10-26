/** V93 beta: features/owner/export. Shared dependencies are explicit on appContext. */
export function register(appContext) {
  function csvEscape(value) {
    const s = String(value ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    text = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const header = (rows.shift() || []).map(h => h.trim());
    return rows
      .filter(r => r.some(v => v.trim()))
      .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || "").trim()])));
  }

  const IMPORT_CONDITIONS = { "near mint": "NM", "mint": "M", "lightly played": "LP", "moderately played": "MP", "heavily played": "HP", "damaged": "DMG" };

  // Collectr export row > card object accepted by createCardStorage.
  // Price: USD market +10%; under 10 rounds up to the next whole unit, otherwise up to the nearest 10.
  // MYR/SGD are converted fron that USO price with live FX and rounded the sane way.

  function collectrRowToCard(row, rates) {
    const roundUp = v => v < 10 ? Math.ceil(v) : Math.ceil(v / 10) * 10;
    const marketKey = Object.keys(row).find(k => /^market price/i.test(k));
    const market = Number(row[marketKey]);
    const usd = Number.isFinite(market) && market > 0 ? roundUp(market * 1.1) : null;
    const myr = usd == null ? null : roundUp(usd / rates.usdPerMyr);
    const gradeMatch = /^(PSA|BGS|CGC|TAG|SGC|ACE|ARS)\s+([\d.]+)/i.exec(row["Grade"] || "");
    const stripJp = v => String(v || "").replace(/\s*\(JP\)\s*/gi, " ").replace(/\s+/g, " ").trim();
    return {
      name: stripJp(row["Product Name"]),
      card_code: row["Card Number"] || "",
      year: "",
      game: /^pok/i.test(row["Category"]) ? "Pokémon" : (row["Category"] || ""),
      era: appContext.ERA_OPTIONS.find(e => e.replace(/\W/g, "").toLowerCase() === String(row["Era"] || "").replace(/\W/g, "").toLowerCase()) || "Modern",
      language: /\(JP\)/i.test(`${row["Product Name"]} ${row["Set"]}`) ? "JP" : "ENG",
      availability: "Available",
      set: stripJp(row["Set"]),
      series: stripJp(row["Set"]),
      format: gradeMatch ? "Graded" : "Raw",
      rarity: row["Rarity"] || "Common",
      condition: gradeMatch ? "NA" : (IMPORT_CONDITIONS[(row["Card Condition"] || "").toLowerCase()] || "NM"),
      qty: Math.max(1, parseInt(row["Quantity"], 10) || 1),
      price_usd: usd,
      price_myr: myr,
      price_sgd: myr == null ? null : roundUp(usd * rates.sgdPerMyr / rates.usdPerMyr),
      notes: "Price terms: Negotiable",
      images: [],
      grading: gradeMatch ? [{ company: gradeMatch[1].toUpperCase(), grade: String(Number(gradeMatch[2])) }] : [],
      lifecycle_status: "live"
    };
  }

  // Stock images from TCGdex for low-value raw listings without photos.
  const TCGDEX = "https://api.tcgdex.net/v2";
  const STOCK_MAX_USD = 20;
  const tcgdexSets = {};

  async function tcgdexJson(url) {
    try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
  }

  function needStockImage(card) {
    return /^pok/i.test(card.game || "") && appContext.normalizeFilterValue(appContext.effectiveFormat(card)) === "raw" && !(Array.isArray(card.grading) && card.grading.some(g => g && g.company)) && Number(card.price_usd) > 0 && Number(card.price_usd) <= STOCK_MAX_USD && card._images_loaded !== false && !appContext.getImages(card).length;
  }

  // Match by set card total
  async function findStockImage(card) {
    const lang = card.language === "JP" ? "ja" : "en";
    const [localId, total] = String(card.card_code || "").trim().toUpperCase().split("/");
    if (!localId) return "";
    const key = s => String(s || "").toLowerCase().replace(/\s*[\(\[].*?[\)\]]/g, "").replace(/[^a-z0-9]/g, "");
    let hits = [];
    if (/^\d+$/.test(total || "")) {
      tcgdexSets[lang] = tcgdexSets[lang] || tcgdexJson(`${TCGDEX}/${lang}/sets`);
      const sets = ((await tcgdexSets[lang]) || []).filter(s => s.cardCount?.official === Number(total));
      hits = (await Promise.all(sets.map(s => tcgdexJson(`${TCGDEX}/${lang}/sets/${s.id}/${localId}`)))).filter(c => c?.image);
    }
    else if (lang === "en") {
      const first = String(card.name || "").split(/\s+/)[0];
      hits = ((await  tcgdexJson(`${TCGDEX}/en/cards?localId=${encodeURIComponent(localId)}&name=${encodeURIComponent(first)}`)) || []).filter(c => c?.image);
    } 
    if (hits.length > 1 && lang === "en") {
      hits = hits.filter(c => key(card.name).includes(key(c.name)) || key(c.name).includes(key(card.name)));
    }
    return hits.length === 1 ? `${hits[0].image}/high.webp` : "";
  }

function exportGradingText(card) {
  const grades = Array.isArray(card.grading) ? card.grading.filter(g => g && g.company) : [];
  return grades.map(g => `${g.company} ${g.grade || ""}`.trim()).join(" | ");
}

function exportCertText(card) {
  const grades = Array.isArray(card.grading) ? card.grading.filter(g => g && g.company) : [];
  return grades.map(g => g.cert || "").filter(Boolean).join(" | ");
}

function safeExportScope(value) {
  return ["all", "available", "reserved", "sold", "collection (nfs)"].includes(value) ? value : "all";
}

function exportCardsForScope(scope) {
  const s = appContext.safeExportScope(scope);
  if (s === "all") return appContext.cards.slice();
  return appContext.cards.filter(card => appContext.normalizeFilterValue(card.availability) === s);
}

function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1200);
}

function buildInventoryCsv(rows, includeCert) {
  const header = [
    "ID", "Card Code", "Name", "Year", "Game", "Series", "Set", "Era", "Language", "Language Details", "Format",
    "Rarity", "Condition", "Availability", "Quantity", "MYR", "USD", "SGD", "Cost",
    "Grading", ...(includeCert ? ["Certificate"] : []), "Notes", "Images", "Created At", "Updated At", "Sold At"
  ];

  const lines = [header.map(appContext.csvEscape).join(",")];

  rows.forEach(card => {
    const values = [
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
      ...(includeCert ? [appContext.exportCertText(card)] : []),
      card.notes,
      appContext.getImages(card).join(" | "),
      card.created_at,
      card.updated_at,
      card.sold_at
    ];
    lines.push(values.map(appContext.csvEscape).join(","));
  });

  return "\uFEFF" + lines.join("\r\n");
}

function buildInventoryBackupJson(rows, includePrivate) {
  const safeRows = rows.map(card => {
    const backup = {
      id: card.id,
      name: card.name,
      card_code: card.card_code,
      year: card.year,
      game: card.game,
      language: card.language,
      language_details: card.language_details,
      era: card.era,
      availability: card.availability,
      set: card.set,
      series: card.series,
      format: card.format,
      rarity: card.rarity,
      condition: card.condition,
      qty: card.qty,
      price_myr: card.price_myr,
      price_usd: card.price_usd ?? card.price ?? null,
      price_sgd: card.price_sgd,
      cost: card.cost,
      notes: card.notes,
      images: appContext.getImages(card).slice(),
      grading: Array.isArray(card.grading) ? card.grading.map(g => ({
        company: g.company || "",
        grade: g.grade || "",
        ...(includePrivate ? { cert: g.cert || "" } : {}),
        pop_count: g.pop_count == null ? null : Number(g.pop_count),
        pop_higher: g.pop_higher == null ? null : Number(g.pop_higher),
        pop_updated_at: g.pop_updated_at || null
      })) : [],
      sold_at: card.sold_at || null,
      created_at: card.created_at || null,
      updated_at: card.updated_at || null
    };
    return backup;
  });

  return JSON.stringify({
    format: "collect-tcg-inventory-backup",
    version: 1,
    exported_at: new Date().toISOString(),
    count: safeRows.length,
    cards: safeRows
  }, null, 2);
}

function renderInventoryExportPage() {
  if (!appContext.requireOwner("open inventory export")) return;

  appContext.view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">Owner Tool</div>
          <h2>Inventory Export, Backup & Import</h2>
          <p>Download an offline copy of your inventory, or bulk-add listings from a CSV.</p>
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

        <section class="panel export-owner-card">
          <div class="eyebrow">CSV Import</div> 
          <h3>Bulk Add from Collectr CSV</h3>
          <p>Adds each rom as a live, Available listing without photos. Cards already in inventory (sane name, number and grade) are skipped.</p>
          
          <div class="field">
            <input type="file" id="importCsvFile" accept=".csv,text/csv">
          </div>
          <button type="button" class="btn-primary" id="importCsvBtn">Import CSV</button>
          <div class="hint" id="importCsvStatus"></div>
          <p> Raw Pokemon cards listed at USD ${STOCK_MAX_USD} or less get a TCGdex stock image automatically. Use the button below for cards already listed.</p>
          <button type="button" class="btn-ghost" id="fillStockImagesBtn">Fill stock images</button>
          <div class="hint" id="fillStockImagesStatus"></div>
        </section>
      </div>

      <div class="panel export-owner-note">
        <strong>Backup recommendation</strong>
        <span>Keep periodic copies somewhere separate from the website. Export files are generated locally in your browser and do not create a new database write.</span>
      </div>
    `;

  appContext.$("exportCsvBtn").addEventListener("click", () => {
    if (!appContext.requireOwner("export inventory CSV")) return;
    const scope = appContext.safeExportScope(appContext.$("exportCsvScope").value);
    const includeCert = appContext.$("exportCsvCert").checked;
    const rows = appContext.exportCardsForScope(scope);
    const csv = appContext.buildInventoryCsv(rows, includeCert);
    const stamp = new Date().toISOString().slice(0, 10);
    appContext.downloadTextFile(`Collect-TCG-Inventory-${scope.replace(/[^a-z0-9]+/gi, "-")}-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    appContext.$("exportCsvStatus").textContent = `Exported ${rows.length} listing${rows.length === 1 ? "" : "s"}.`;
    appContext.showToast(`CSV downloaded · ${rows.length} listings`);
  });

  appContext.$("importCsvBtn").addEventListener("click", async () => {
    if (!appContext.requireOwner("import inventory CSV")) return;
    const status = appContext.$("importCsvStatus");
    const file = appContext.$("importCsvFile").files?.[0];
    if (!file) { status.textContent = "Choose a CSV file first."; return; }
    const rows = parseCsv(await file.text());
    const rates = await appContext.fetchCurrentMyrFxRates();
    if (!rates) { status.textContent = "Could not load exchange rates. Try again later."; return; }
    if (!window.confirm(`Import ${rows.length} rows from ${file.name}?`)) return;
    const importKey = c => `${String(c.name || "").toUpperCase()}|${String(c.card_code || "").toUpperCase()}|${exportGradingText(c)}`;
    const existing = new Set(appContext.cards.map(importKey));
    const btn = appContext.$("importCsvBtn");
    btn.disabled = true;
    let added = 0, skipped = 0, failed = 0, stocked = 0;
    for (const row of rows) {
      const card = collectrRowToCard(row, rates);
      if (!card.name || !card.game || existing.has(importKey(card))) { skipped++; continue; }
      if (needStockImage(card)) {
        const image = await findStockImage(card);
        if (image) { card.images = [image]; stocked++; }
      }
      const saved = await appContext.createCardStorage(card);
      if (saved) { appContext.cards.push(saved); existing.add(importKey(card)); added++; }
      else failed++;
      status.textContent = `Importing... ${added + skipped + failed} /${rows.length}`;
    }
    btn.disabled = false;
    status.textContent = `Done: ${added} added (${stocked} with stock image), ${skipped} skipped, ${failed} failed.`;
    appContext.showToast(`CSV import ${added} cards added`);
  });

  appContext.$("fillStockImagesBtn").addEventListener("click", async () => {
    if (!appContext.requireOwner("fill stock images")) return;
    const status = appContext.$("fillStockImagesStatus");
    const targets = appContext.cards.filter(needStockImage);
    if (!targets.length) {
      status.textContent = "No raw Pokemon cards without photos at or under the threshold.";
      return;
    }
    if (!window.confirm(`Look up stock images for ${targets.length} cards?`)) return;
    const btn = appContext.$("fillStockImagesBtn");
    btn.disabled = true;
    let filled = 0, notFound = 0, failed = 0;
    for (const card of targets) {
      const image = await findStockImage(card);
      if (!image) { notFound++; }
      else {
        const saved = await appContext.updateCardStorage({ ...card, images: [image] });
        if (saved) { Object.assign(card, saved, { images: [image], image }); filled++; } else { failed++; }
      }
    }
    btn.disabled = false;
    status.textContent = `Done: ${filled} filled, ${notFound} not found, ${failed} failed.`;
    appContext.showToast(`Stock images ${filled} cards updated`);
  });

appContext.$("exportJsonBtn").addEventListener("click", () => {
  if (!appContext.requireOwner("export inventory backup")) return;
  const scope = appContext.safeExportScope(appContext.$("exportJsonScope").value);
  const includePrivate = appContext.$("exportJsonPrivate").checked;
  const rows = appContext.exportCardsForScope(scope);
  const json = appContext.buildInventoryBackupJson(rows, includePrivate);
  const stamp = new Date().toISOString().slice(0, 10);
  appContext.downloadTextFile(`Collect-TCG-Backup-${scope.replace(/[^a-z0-9]+/gi, "-")}-${stamp}.json`, json, "application/json;charset=utf-8");
  appContext.$("exportJsonStatus").textContent = `Backed up ${rows.length} listing${rows.length === 1 ? "" : "s"}.`;
  appContext.showToast(`JSON backup downloaded · ${rows.length} listings`);
});
}

Object.assign(appContext, { csvEscape, exportGradingText, exportCertText, safeExportScope, exportCardsForScope, downloadTextFile, buildInventoryCsv, buildInventoryBackupJson, renderInventoryExportPage });
}
