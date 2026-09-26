/** V93 beta: features/cards/presentation. Shared dependencies are explicit on appContext. */
export function register(appContext){
function getImages(c){
    if(Array.isArray(c.images) && c.images.length) return c.images.filter(Boolean);
    if(c.image) return [c.image]; // backwards compatibility with older listings
    return [];
  }

function statusCornerHTML(card){
    if(!card) return "";
    if(card.availability === "Sold"){
      return `<span class="status-corner status-corner-sold" aria-label="Sold"></span>`;
    }
    if(card.availability === "Reserved"){
      return `<span class="status-corner status-corner-reserved" aria-label="Reserved"></span>`;
    }
    return "";
  }

function overviewGradeOverlayHTML(card){
    if(!card || appContext.normalizeFilterValue(appContext.effectiveFormat(card))!=="graded") return "";

    const grade=(Array.isArray(card.grading)?card.grading:[])
      .find(g=>g && String(g.company||"").trim() && String(g.grade??"").trim());

    if(!grade) return "";

    const company=String(grade.company||"").trim().toUpperCase().slice(0,12);
    const value=String(grade.grade??"").trim().slice(0,12);
    const status=appContext.normalizeFilterValue(card.availability||"Available");
    const avoidStatusCorner=status==="sold" || status==="reserved";

    const gradeText=`${company} ${value}`.trim();
    const allGrades=appContext.validGradingEntries(card);
    const popText=allGrades.length===1 ? appContext.gradePopLabel(grade) : "";
    const slabText=allGrades.length>1 ? `${allGrades.length} SLABS` : (popText || "GRADED");
    return `<button type="button"
                    class="overview-grade-overlay filter-pill-btn ${avoidStatusCorner?"overview-grade-overlay-right":""} ${appContext.pillFilterState.grade.size && appContext.pillFilterState.grade.has(gradeText)?"pill-selected":""}"
                    data-pill-filter="grade"
                    data-pill-value="${appContext.escapeHtml(gradeText)}"
                    title="${appContext.escapeHtml(popText ? `${gradeText} · ${popText}` : `Filter by ${gradeText}`)}"
                    aria-label="${appContext.escapeHtml(`Filter by ${gradeText}`)}">
      <strong>${appContext.escapeHtml(gradeText)}</strong>
      <small>${appContext.escapeHtml(slabText)}</small>
    </button>`;
  }

function overviewRawConditionOverlayHTML(card){
    if(!card || appContext.normalizeFilterValue(appContext.effectiveFormat(card))!=="raw") return "";

    const condition=appContext.rawConditionShortLabel(card.condition);
    const filterValue=appContext.rawConditionFilterLabel(card.condition);
    if(!condition || !filterValue) return "";

    const status=appContext.normalizeFilterValue(card.availability||"Available");
    const avoidStatusCorner=status==="sold" || status==="reserved";

    return `<button type="button"
                    class="overview-grade-overlay condition-filter-btn filter-pill-btn ${avoidStatusCorner?"overview-grade-overlay-right":""} ${appContext.pillFilterState.grade.size && appContext.selectedSetMatches(appContext.pillFilterState.grade,filterValue) ? "pill-selected" : ""}"
                    data-pill-filter="grade"
                    data-pill-value="${appContext.escapeHtml(filterValue)}"
                    title="Filter by ${appContext.escapeHtml(filterValue)}"
                    aria-label="${appContext.escapeHtml(`Filter by raw condition ${filterValue}`)}">
      <strong>${appContext.escapeHtml(condition)}</strong>
      <small>RAW</small>
    </button>`;
  }

function overviewSealedConditionOverlayHTML(card){
    if(!card || appContext.normalizeFilterValue(appContext.effectiveFormat(card))!=="sealed") return "";

    const condition=appContext.rawConditionShortLabel(card.condition || "SEALED") || "SEALED";
    const status=appContext.normalizeFilterValue(card.availability||"Available");
    const avoidStatusCorner=status==="sold" || status==="reserved";

    const sealedFilterValue="Sealed";
    return `<button type="button"
                    class="overview-grade-overlay filter-pill-btn ${avoidStatusCorner?"overview-grade-overlay-right":""} ${appContext.pillFilterState.grade.size && appContext.pillFilterState.grade.has(sealedFilterValue)?"pill-selected":""}"
                    data-pill-filter="grade"
                    data-pill-value="${sealedFilterValue}"
                    title="Filter by Sealed"
                    aria-label="Filter by sealed condition">
      <strong>${appContext.escapeHtml(condition)}</strong>
      <small>SEALED</small>
    </button>`;
  }

function cardThumbHTML(c, renderIndex=999){
    const color = appContext.RARITY_COLOR[c.rarity] || "var(--r-common)";
    const images = appContext.getImages(c);
    if(images.length){
      const initialCount=Math.max(1,images.length);
      return `<div class="thumb-wrap listing-card-gallery"
                   style="position:relative; flex-shrink:0;"
                   data-listing-gallery="${appContext.escapeHtml(c.id)}"
                   data-listing-gallery-index="0">
        <img class="thumb"
             src="${appContext.escapeHtml(images[0])}"
             alt="${appContext.escapeHtml(c.name)} photo 1"
             loading="${renderIndex < 6 ? "eager" : "lazy"}"
             decoding="async"
             fetchpriority="${renderIndex < 4 ? "high" : "low"}"
             style="border-color:${color}">
        ${appContext.overviewGradeOverlayHTML(c)}
        ${appContext.overviewRawConditionOverlayHTML(c)}
        ${appContext.overviewSealedConditionOverlayHTML(c)}
        ${appContext.isNewCard(c) ? `<span class="new-card-badge ${["graded","raw","sealed"].includes(appContext.normalizeFilterValue(appContext.effectiveFormat(c))) ? "new-card-badge-with-grade" : ""}" aria-label="Recently added">NEW</span>` : ""}
        ${appContext.statusCornerHTML(c)}
        <span class="image-count-badge"
              data-listing-image-count
              aria-label="${initialCount} photo${initialCount===1?"":"s"}">▧ ${initialCount}</span>
        <button type="button"
                class="listing-gallery-arrow listing-gallery-arrow-prev"
                data-listing-gallery-step="-1"
                data-id="${appContext.escapeHtml(c.id)}"
                aria-label="Previous photo">‹</button>
        <button type="button"
                class="listing-gallery-arrow listing-gallery-arrow-next"
                data-listing-gallery-step="1"
                data-id="${appContext.escapeHtml(c.id)}"
                aria-label="Next photo">›</button>
        <span class="listing-gallery-counter" data-listing-gallery-counter>1 / ${initialCount}</span>
      </div>`;
    }
    const initial = (c.name || "?").trim().charAt(0).toUpperCase() || "?";
    return `<div class="thumb-placeholder" style="--stripe:${color}">${initial}</div>`;
  }

  Object.assign(appContext,{getImages,statusCornerHTML,overviewGradeOverlayHTML,overviewRawConditionOverlayHTML,overviewSealedConditionOverlayHTML,cardThumbHTML});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.GAME_CHOICES = [
    "Digimon",
    "Disney Lorcana",
    "Flesh and Blood",
    "Gundam",
    "Hunter x Hunter Hyper Battle",
    "Magic: The Gathering",
    "One Piece Card Game",
    "One Piece From Tv Animation",
    "One Piece Hyper Battle",
    "One Piece OnePy Berry Match",
    "One Piece Visual Adventure",
    "Pokémon",
    "Weekly Jump",
    "Yu-Gi-Oh!",
    "Zatch Bell!"
  ];
}
