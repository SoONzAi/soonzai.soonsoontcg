/** V93 beta: features/cards/related. Shared dependencies are explicit on appContext. */
export function register(appContext){
function relatedCardNameTokens(card){
    const tokenize=value=>String(value||"").normalize("NFKC").toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)||[];
    const metadata=new Set([
      ...tokenize(card.game),...tokenize(card.series),...tokenize(card.year),
      ...tokenize(card.card_code),...tokenize(card.language),...tokenize(card.format),
      ...tokenize(card.rarity),...tokenize(card.era),
      "psa","bgs","cgc","sgc","graded","raw","sealed","promo","promotional",
      "parallel","alternate","alt","art","foil","holo","holographic","rare",
      "super","secret","special","card","cards","winner","finalist","championship",
      "anniversary","edition","limited","the","and","with"
    ]);
    return new Set(tokenize(card.name).filter(token=>
      !metadata.has(token) && !/^\d+$/.test(token) &&
      (token.length>=3 || /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(token))
    ));
  }

function relatedCardNamesMatch(sourceTokens,candidate){
    if(!sourceTokens.size) return false;
    const candidateTokens=appContext.relatedCardNameTokens(candidate);
    if(!candidateTokens.size) return false;
    const shared=[...sourceTokens].filter(token=>candidateTokens.has(token)).length;
    const union=sourceTokens.size+candidateTokens.size-shared;
    // A shared surname alone should not match two different full names.
    return shared>0 && shared/union>=0.5;
  }

function relatedSeriesTokens(card){
    const tokenize=value=>String(value||"").normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
    const generic=new Set([
      ...tokenize(card?.game),
      "card","cards","game","tcg","series","set","edition","promo","promotional",
      "championship","tournament","event","the","and","of"
    ]);
    return new Set(tokenize(card?.series).filter(token=>!generic.has(token) && (token.length>=2 || /\d/.test(token))));
  }

function relatedSeriesAffinity(sourceTokens,candidate){
    if(!sourceTokens?.size) return 0;
    const candidateTokens=appContext.relatedSeriesTokens(candidate);
    if(!candidateTokens.size) return 0;
    const shared=[...sourceTokens].filter(token=>candidateTokens.has(token)).length;
    return shared/Math.max(sourceTokens.size,candidateTokens.size);
  }

function relatedGradeAffinity(source,candidate){
    const sourceGrades=appContext.validGradingEntries?.(source)||[];
    const candidateGrades=appContext.validGradingEntries?.(candidate)||[];
    if(!sourceGrades.length || !candidateGrades.length) return 0;
    let best=0;
    sourceGrades.forEach(a=>candidateGrades.forEach(b=>{
      if(appContext.normalizeFilterValue(a.company)!==appContext.normalizeFilterValue(b.company)) return;
      const ag=Number.parseFloat(String(a.grade??""));
      const bg=Number.parseFloat(String(b.grade??""));
      if(Number.isFinite(ag) && Number.isFinite(bg)){
        const diff=Math.abs(ag-bg);
        if(diff===0) best=Math.max(best,1);
        else if(diff<=1) best=Math.max(best,0.6);
      }else{
        best=Math.max(best,0.35);
      }
    }));
    return best;
  }

function relatedCardIdentityKey(card){
    if(!card) return "";
    const norm=value=>appContext.normalizeFilterValue(value || "");
    const game=norm(card.game);
    const code=norm(card.card_code);
    const language=norm(card.language);

    // Card code is the most reliable identity signal. Keep language in the key
    // because different-language printings can be meaningfully different items.
    if(code) return `code|${game}|${code}|${language}`;

    // Fallback for older/vintage listings without a card code: ignore grading /
    // condition differences by using the normalized card name + series + language.
    const name=norm(card.name)
      .replace(/\b(psa|bgs|cgc|sgc)\s*\d+(?:\.\d+)?\b/g," ")
      .replace(/\b(raw|graded|sealed|mint|near mint|lightly played|moderately played|heavily played|poor)\b/g," ")
      .replace(/\s+/g," ")
      .trim();
    const series=norm(card.series);
    return `name|${game}|${series}|${name}|${language}`;
  }

function getRelatedCards(card, limit = 4, options = {}){
    if(!card) return [];
    // Collection pages may recommend NFS pieces after available alternatives.
    // Every other listing recommends available cards only.
    const includeCollection = !options.availableOnly &&
      appContext.normalizeFilterValue(card.availability || "Available") === "collection (nfs)";

    const sourceGame=appContext.normalizeFilterValue(card.game);
    const sourceSeries=appContext.normalizeFilterValue(card.series);
    const sourceCode=appContext.normalizeFilterValue(card.card_code);
    const sourceNameTokens=appContext.relatedCardNameTokens(card);
    const sourceSeriesTokens=appContext.relatedSeriesTokens(card);

    const ranked = appContext.cards
      .filter(c=>{
        if(!c || c.id === card.id || !appContext.isLiveLifecycle(c)) return false;
        const status = appContext.normalizeFilterValue(c.availability || "Available");
        if(status !== "available" && !(includeCollection && status === "collection (nfs)")) return false;
        return true;
      })
      .map(c=>{
        const sameGame=!!sourceGame && appContext.normalizeFilterValue(c.game)===sourceGame;
        const sameSeries=sameGame && !!sourceSeries && appContext.normalizeFilterValue(c.series)===sourceSeries;
        const sameCode=sameGame && !!sourceCode && appContext.normalizeFilterValue(c.card_code)===sourceCode;
        const sameName=sameGame && appContext.relatedCardNamesMatch(sourceNameTokens,c);
        const seriesAffinity=sameGame ? appContext.relatedSeriesAffinity(sourceSeriesTokens,c) : 0;
        const gradeAffinity=sameGame ? appContext.relatedGradeAffinity(card,c) : 0;
        let score = 0;
        if(sameGame) score += 4;
        if(sameCode) score += 18;
        if(sameName) score += 14;
        if(sameSeries) score += 10;
        else if(seriesAffinity>=0.66) score += 7;
        else if(seriesAffinity>=0.34) score += 4;
        if(card.era && appContext.normalizeFilterValue(c.era) === appContext.normalizeFilterValue(card.era)) score += 5;
        if(appContext.normalizeFilterValue(appContext.effectiveFormat(c)) === appContext.normalizeFilterValue(appContext.effectiveFormat(card))) score += 3;
        if(card.language && appContext.normalizeFilterValue(c.language) === appContext.normalizeFilterValue(card.language)) score += 2;
        if(gradeAffinity>=1) score += 4;
        else if(gradeAffinity>=0.6) score += 2;

        const sourcePrice=appContext.cardUsdListedPrice(card);
        const candidatePrice=appContext.cardUsdListedPrice(c);
        if(sourcePrice!==null && candidatePrice!==null && sourcePrice>0){
          const ratio=Math.max(sourcePrice,candidatePrice)/Math.max(1,Math.min(sourcePrice,candidatePrice));
          if(ratio<=1.25) score+=4;
          else if(ratio<=1.75) score+=2;
        }

        const status = appContext.normalizeFilterValue(c.availability || "Available");
        if(status === "available" || status === "collection (nfs)") score += 2;
        else if(status === "reserved") score += 1;

        return {
          card:c,
          score,
          sameGame,
          sameCode,
          sameSeries,
          sameName,
          seriesAffinity,
          identity:appContext.relatedCardIdentityKey(c) || `id|${String(c.id||"")}`
        };
      })
      .filter(x=>x.score > 0)
      .sort((a,b)=>{
        if(includeCollection){
          const aAvailable = appContext.normalizeFilterValue(a.card.availability || "Available") === "available";
          const bAvailable = appContext.normalizeFilterValue(b.card.availability || "Available") === "available";
          if(aAvailable !== bAvailable) return aAvailable ? -1 : 1;
        }
        // Collector relevance first: same game, exact card identity/character,
        // then event/set affinity. Score handles grade, era, language and price.
        return Number(b.sameGame)-Number(a.sameGame) ||
          Number(b.sameCode)-Number(a.sameCode) ||
          Number(b.sameName)-Number(a.sameName) ||
          Number(b.sameSeries)-Number(a.sameSeries) ||
          b.seriesAffinity-a.seriesAffinity ||
          b.score-a.score ||
          String(b.card.created_at || "").localeCompare(String(a.card.created_at || ""));
      });

    // Recommendation diversity:
    // 1) Prefer one listing per underlying card identity.
    // 2) Only if there are not enough distinct cards, allow one extra condition /
    //    grade of an identity. Never recommend three or more versions of one card.
    const selected=[];
    const selectedIds=new Set();
    const identityCounts=new Map();

    const addCandidate=(entry,maxPerIdentity)=>{
      if(selected.length>=limit || selectedIds.has(entry.card.id)) return;
      const count=identityCounts.get(entry.identity)||0;
      if(count>=maxPerIdentity) return;
      selected.push(entry.card);
      selectedIds.add(entry.card.id);
      identityCounts.set(entry.identity,count+1);
    };

    ranked.forEach(entry=>addCandidate(entry,1));
    if(selected.length<limit){
      ranked.forEach(entry=>addCandidate(entry,2));
    }

    return selected.slice(0,limit);
  }

  Object.assign(appContext,{relatedCardNameTokens,relatedCardNamesMatch,relatedSeriesTokens,relatedSeriesAffinity,relatedGradeAffinity,relatedCardIdentityKey,getRelatedCards});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.COMPARE_MAX = 4;

  appContext.compareSelectedIds = new Set();
}
