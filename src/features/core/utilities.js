/** V93 beta: features/core/utilities. Shared dependencies are explicit on appContext. */
export function register(appContext){
function rawConditionShortLabel(condition){
    const value=String(condition||"").trim();
    if(!value) return "";
    return appContext.RAW_CONDITION_SHORT[value.toUpperCase()] || value.toUpperCase();
  }

function rawConditionFilterLabel(condition){
    const value=String(condition||"").trim();
    if(!value) return "";
    return appContext.CONDITION_LABEL[value] || appContext.CONDITION_LABEL[value.toUpperCase()] || value;
  }

function safeCardId(value){
    const id=String(value||"").trim();
    return /^[0-9a-fA-F-]{20,40}$/.test(id) ? id : "";
  }

function seoSlugPart(value){
    return String(value||"")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase()
      .replace(/&/g," and ")
      .replace(/['’]/g,"")
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"")
      .replace(/-{2,}/g,"-");
  }

function seoCardSlug(card){
    if(!card) return "card";
    const grade=Array.isArray(card.grading)
      ? card.grading.find(entry=>entry && entry.company)
      : null;
    const gradeLabel=grade
      ? [grade.company,grade.grade].filter(Boolean).join(" ")
      : "";
    const parts=[
      card.year,
      card.game,
      card.series,
      card.name,
      card.card_code,
      gradeLabel
    ].map(appContext.seoSlugPart).filter(Boolean);
    const slug=parts.join("-").replace(/-{2,}/g,"-").slice(0,120).replace(/-+$/,"");
    return slug || "card";
  }

function siteRootUrl(){
    try{
      const explicit=document.querySelector('meta[name="collect-tcg-site-base"]')?.content;
      if(explicit) return new URL(explicit,location.origin).toString();
      return new URL("./",document.baseURI).toString();
    }catch{
      return `${location.origin}${location.pathname.replace(/[^/]*$/,"")}`;
    }
  }

function seoCardUrl(card,slugOverride=""){
    const id=appContext.safeCardId(card?.id);
    if(!id) return "";
    const slug=appContext.seoSlugPart(slugOverride)||appContext.seoCardSlug(card);
    return new URL(
      `cards/${slug}/`,
      appContext.siteRootUrl()
    ).toString();
  }

async function loadSeoCardSlugMap(){
    try{
      const response=await appContext.fetch(new URL("seo-slugs.json",appContext.siteRootUrl()),{
        method:"GET",
        cache:"no-store",
        credentials:"omit"
      });
      if(!response.ok) return false;
      const payload=await response.json();
      const entries=payload && typeof payload.cards==="object" ? Object.entries(payload.cards) : [];
      const map=new Map();
      entries.forEach(([id,value])=>{
        const safeId=appContext.safeCardId(id);
        const slug=appContext.seoSlugPart(value?.slug||"");
        if(safeId && slug) map.set(safeId,slug);
      });
      appContext.seoCardSlugMap=map;
      return true;
    }catch{
      return false;
    }
  }

function publishedSeoCardUrl(card){
    const id=appContext.safeCardId(card?.id);
    const slug=id ? appContext.seoCardSlugMap?.get(id) : "";
    return slug ? appContext.seoCardUrl(card,slug) : "";
  }

  Object.assign(appContext,{rawConditionShortLabel,rawConditionFilterLabel,safeCardId,seoSlugPart,seoCardSlug,siteRootUrl,seoCardUrl,loadSeoCardSlugMap,publishedSeoCardUrl});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.RARITY_COLOR = {
    "Common":"var(--r-common)", "Uncommon":"var(--r-uncommon)", "Rare":"var(--r-rare)",
    "Rare Holo":"var(--r-holo)", "Ultra Rare":"var(--r-ultra)", "Secret Rare":"var(--r-ultra)", "Promo":"var(--r-holo)"
  };

  appContext.SHIMMER_RARITIES = new Set(["Rare Holo","Ultra Rare","Secret Rare","Promo"]);

  appContext.CONDITION_LABEL = {NM:"Near Mint", M:"Mint", LP:"Lightly Played", MP:"Moderately Played", HP:"Heavily Played", DMG:"Damaged", SEALED:"Sealed", NA:"Not Applicable"};

  appContext.RAW_CONDITION_SHORT = {
    "M":"M",
    "MINT":"M",
    "NM":"NM",
    "NEAR MINT":"NM",
    "LP":"LP",
    "LIGHTLY PLAYED":"LP",
    "MP":"MP",
    "MODERATELY PLAYED":"MP",
    "HP":"HP",
    "HEAVILY PLAYED":"HP",
    "DMG":"DMG",
    "DAMAGED":"DMG",
    "NA":"N/A",
    "NOT APPLICABLE":"N/A"
  };

  appContext.LANGUAGE_OPTIONS = ["JP","ENG","KR","CN","Mixed / Multiple languages","N/A"];

  appContext.ERA_OPTIONS = ["Modern","Mid-Era","Vintage"];

  appContext.AVAILABILITY_OPTIONS = Object.freeze(["Available","Reserved","Sold","Collection (NFS)"]);

  appContext.LIFECYCLE_OPTIONS = Object.freeze(["live","draft","archived"]);

  appContext.RARITY_LIST = ["Common","Uncommon","Rare","Rare Holo","Ultra Rare","Secret Rare","Promo"];

  appContext.INDEX_KEY = "card-index";

  appContext.RECENTLY_VIEWED_KEY = "collect_tcg_recently_viewed_v1";

  appContext.RECENTLY_VIEWED_LIMIT = 12;

  appContext.seoCardSlugMap = new Map();
  appContext.loadSeoCardSlugMap().catch(()=>{});
}
