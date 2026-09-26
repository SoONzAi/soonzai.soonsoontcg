/** V93 beta: features/content/showcase. Shared dependencies are explicit on appContext. */
export function register(appContext){
async function uploadShowcaseThumbnail(file){
    return appContext.uploadOwnerImage(file, "showcase-thumbnails", "Thumbnail");
  }

function renderShowcaseThumbnailPreview(url){
    const mount = appContext.$("showcaseThumbnailPreview");
    if(!mount) return;
    mount.innerHTML = url
      ? `<div class="showcase-thumb-preview"><img src="${appContext.escapeHtml(url)}" alt="Thumbnail preview"></div>`
      : "";
  }

function cleanFacebookVideoUrl(url){
    try{
      const u = new URL(url);
      u.search = "";
      u.hash = "";
      return u.toString();
    }catch(_){
      return url;
    }
  }

function isFacebookVideoUrl(url){
    try{
      const u = new URL(url);
      return /(^|\.)facebook\.com$/i.test(u.hostname) ||
             /(^|\.)fb\.watch$/i.test(u.hostname);
    }catch(_){
      return false;
    }
  }

function youtubeVideoId(url){
    try{
      const u=new URL(url);
      const host=u.hostname.toLowerCase();
      const isShortHost=host==="youtu.be" || host.endsWith(".youtu.be");
      const isYoutubeHost=host==="youtube.com" || host.endsWith(".youtube.com");

      if(isShortHost){
        return u.pathname.replace(/^\//,"").split("/")[0]||"";
      }
      if(isYoutubeHost){
        if(u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2]||"";
        if(u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2]||"";
        return u.searchParams.get("v")||"";
      }
    }catch{}
    return "";
  }

function showcaseThumbnail(v){
    const manual=appContext.safeHttpUrl(v?.thumbnail_url||"");
    if(manual) return manual;

    const yt=appContext.youtubeVideoId(v?.video_url||"");
    return yt ? `https://img.youtube.com/vi/${encodeURIComponent(yt)}/hqdefault.jpg` : "";
  }

function openShowcaseVideo(v){
    const overlay = appContext.$("videoOverlay");
    const mount = appContext.$("videoPlayerMount");
    const title = appContext.$("videoModalTitle");
    const copy = appContext.$("videoModalCopy");

    const url=appContext.safeHttpUrl(v.video_url||"");
    if(!url){
      appContext.showToast("Unsupported video URL");
      return;
    }
    const yt=appContext.youtubeVideoId(url);

    title.textContent = v.title || "Showcase";
    copy.innerHTML = `
      ${v.series ? `<div class="showcase-series">${appContext.escapeHtml(v.series)}</div>` : ""}
      ${v.description ? `<p>${appContext.escapeHtml(v.description)}</p>` : ""}
    `;

    if(yt){
      mount.innerHTML = `<iframe
        src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?autoplay=1&rel=0&modestbranding=1"
        title="${appContext.escapeHtml(v.title)}"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen></iframe>`;
      overlay.hidden = false;
      return;
    }

    if(/\.(mp4|webm|ogg)(\?|#|$)/i.test(url)){
      mount.innerHTML = `<video controls autoplay playsinline src="${appContext.escapeHtml(url)}"></video>`;
      overlay.hidden = false;
      return;
    }

    if(appContext.isFacebookVideoUrl(url)){
      appContext.openSafeExternalUrl(appContext.cleanFacebookVideoUrl(url));
      return;
    }

    appContext.openSafeExternalUrl(url);
  }

function closeShowcaseVideo(){
    appContext.$("videoOverlay").hidden = true;
    appContext.$("videoPlayerMount").innerHTML = "";
  }

function showcaseDisplayCategory(v){
    return (v?.category || "Collection Showcase")==="PSA Returns"
      ? "PSA Returns"
      : "Collection Showcase";
  }

function showcasesForActiveCategory(){
    return appContext.showcases
      .filter(v=>appContext.activeShowcaseCategory==="All" || appContext.showcaseDisplayCategory(v)===appContext.activeShowcaseCategory)
      .sort((a,b)=>{
        const ao=Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER;
        const bo=Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER;
        if(ao!==bo) return ao-bo;
        return new Date(b.created_at||0)-new Date(a.created_at||0);
      });
  }

async function persistShowcaseDomOrder(container){
    if(!appContext.requireOwner("reorder showcase")) return false;
    if(!container) return false;

    const ids=[...container.querySelectorAll("[data-showcase-card]")]
      .map(card=>String(card.dataset.showcaseCard||""))
      .filter(Boolean);

    for(let index=0;index<ids.length;index++){
      const id=ids[index];
      const item=appContext.showcases.find(v=>String(v.id)===id);
      if(!item) continue;

      const payload={sort_order:index};
      if(appContext.activeShowcaseCategory!=="All" &&
         appContext.showcaseDisplayCategory(item)==="Collection Showcase" &&
         item.category!=="Collection Showcase"){
        payload.category="Collection Showcase";
      }

      if(Number(item.sort_order)===index && !payload.category) continue;

      const {error}=await appContext.saveShowcase(payload,item.id);
      if(error){
        console.error("Showcase reorder error:",error);
        appContext.showToast("Could not save Showcase order");
        return false;
      }

      item.sort_order=index;
      if(payload.category) item.category=payload.category;
    }

    return true;
  }

function setupShowcaseRearrangeMode(){
    const toggleBtn=appContext.$("toggleShowcaseRearrangeBtn");
    const container=appContext.$("showcaseGrid");
    if(!toggleBtn || !container || !appContext.isOwnerMode()) return;

    let mode=false;
    let dragged=null;
    let placeholder=null;
    let pointerId=null;
    let offsetX=0;
    let offsetY=0;

    const cards=()=>[...container.querySelectorAll("[data-showcase-card]")];

    const setMode=next=>{
      mode=Boolean(next);
      container.classList.toggle("showcase-rearrange-mode",mode);
      toggleBtn.classList.toggle("active",mode);
      toggleBtn.setAttribute("aria-pressed",String(mode));
      toggleBtn.textContent=mode ? "Done Rearranging" : "Rearrange Showcase";
      document.body.classList.toggle("showcase-rearranging-body",mode);
      if(mode) appContext.showToast("Drag Showcase cards to rearrange them");
    };

    function nearestCard(x,y){
      let best=null;
      let distance=Infinity;
      cards().forEach(card=>{
        if(card===dragged) return;
        const rect=card.getBoundingClientRect();
        const cx=rect.left+rect.width/2;
        const cy=rect.top+rect.height/2;
        const d=Math.hypot(x-cx,y-cy);
        if(d<distance){
          distance=d;
          best={card,rect,cx,cy};
        }
      });
      return best;
    }

    function clearDraggedStyles(){
      if(!dragged) return;
      dragged.classList.remove("showcase-pointer-dragging");
      dragged.style.position="";
      dragged.style.left="";
      dragged.style.top="";
      dragged.style.width="";
      dragged.style.height="";
      dragged.style.zIndex="";
      dragged.style.pointerEvents="";
    }

    async function finishDrag(){
      if(!dragged || !placeholder) return;

      placeholder.replaceWith(dragged);
      clearDraggedStyles();

      dragged=null;
      placeholder=null;
      pointerId=null;
      document.body.classList.remove("showcase-dragging-body");

      const ok=await appContext.persistShowcaseDomOrder(container);
      if(ok){
        // Stay in rearrange mode after each drop so multiple moves can be
        // completed without pressing "Rearrange Showcase" again.
        appContext.showToast("Showcase order saved · continue rearranging");
      }else{
        await appContext.loadShowcases();
        appContext.renderShowcasePage();
      }
    }

    function cancelDrag(){
      if(dragged && placeholder){
        placeholder.replaceWith(dragged);
      }
      clearDraggedStyles();
      placeholder?.remove();
      dragged=null;
      placeholder=null;
      pointerId=null;
      document.body.classList.remove("showcase-dragging-body");
    }

    container.addEventListener("pointerdown",event=>{
      if(!mode) return;
      if(event.button!==undefined && event.button!==0) return;
      if(event.target.closest("button,a")) return;

      const card=event.target.closest("[data-showcase-card]");
      if(!card) return;

      event.preventDefault();

      const rect=card.getBoundingClientRect();
      dragged=card;
      pointerId=event.pointerId;
      offsetX=event.clientX-rect.left;
      offsetY=event.clientY-rect.top;

      placeholder=document.createElement("div");
      placeholder.className="showcase-reorder-placeholder";
      placeholder.style.width=`${rect.width}px`;
      placeholder.style.height=`${rect.height}px`;

      card.replaceWith(placeholder);
      document.body.appendChild(card);

      card.classList.add("showcase-pointer-dragging");
      card.style.position="fixed";
      card.style.left=`${rect.left}px`;
      card.style.top=`${rect.top}px`;
      card.style.width=`${rect.width}px`;
      card.style.height=`${rect.height}px`;
      card.style.zIndex="99999";
      card.style.pointerEvents="none";
      document.body.classList.add("showcase-dragging-body");

      try{ container.setPointerCapture(event.pointerId); }catch(_){}
    });

    container.addEventListener("pointermove",event=>{
      if(!dragged || event.pointerId!==pointerId) return;
      event.preventDefault();

      dragged.style.left=`${event.clientX-offsetX}px`;
      dragged.style.top=`${event.clientY-offsetY}px`;

      const nearest=nearestCard(event.clientX,event.clientY);
      if(!nearest || !placeholder) return;

      const {card,cx,cy}=nearest;
      const horizontalBias=Math.abs(event.clientX-cx)>Math.abs(event.clientY-cy);
      const before=horizontalBias ? event.clientX<cx : event.clientY<cy;
      const ref=before ? card : card.nextSibling;

      if(ref!==placeholder){
        container.insertBefore(placeholder,ref);
      }
    });

    container.addEventListener("pointerup",event=>{
      if(!dragged || event.pointerId!==pointerId) return;
      event.preventDefault();
      finishDrag();
    });

    container.addEventListener("pointercancel",event=>{
      if(!dragged || event.pointerId!==pointerId) return;
      cancelDrag();
      appContext.renderShowcasePage();
    });

    toggleBtn.addEventListener("click",()=>{
      if(dragged) return;
      setMode(!mode);
    });
  }

function renderShowcasePage(){
    const categories = ["All","PSA Returns","Collection Showcase"];
    if(!categories.includes(appContext.activeShowcaseCategory)){
      appContext.activeShowcaseCategory="All";
    }
    const filteredShowcases=appContext.showcasesForActiveCategory();

    appContext.view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">Showcase</div>
          <h2>Collection Showcase</h2>
          <p>Short videos featuring cards and collectibles from our collection, hosted on YouTube.</p>
        </div>
        <div class="showcase-page-owner-actions owner-only">
          <button type="button" class="btn-ghost" id="toggleShowcaseRearrangeBtn" aria-pressed="false">Rearrange Showcase</button>
          <button type="button" class="btn-primary" id="addShowcaseBtn">+ Add Video</button>
        </div>
      </div>

      <div class="showcase-category-bar" id="showcaseCategoryBar">
        ${categories.map(cat=>`
          <button type="button"
            class="showcase-category-btn ${appContext.activeShowcaseCategory===cat ? "active" : ""}"
            data-showcase-category="${appContext.escapeHtml(cat)}">${appContext.escapeHtml(cat)}</button>
        `).join("")}
      </div>

      <div id="showcaseMount"></div>
    `;

    const mount = appContext.$("showcaseMount");
    if(!filteredShowcases.length){
      mount.innerHTML = `<div class="empty-state">${appContext.EMPTY_ICON}<h2>No showcase videos</h2><p>There are no videos in this category yet.</p></div>`;
    }else{
      mount.innerHTML = `<div class="showcase-grid" id="showcaseGrid">${
        filteredShowcases.map(v=>{
          const thumb = appContext.showcaseThumbnail(v);
          const category = appContext.showcaseDisplayCategory(v);
          return `<article class="showcase-card" data-showcase-card="${appContext.escapeHtml(v.id)}">
            <div class="showcase-media" data-showcase-watch="${v.id}">
              ${v.featured ? `<span class="showcase-featured">Featured</span>` : ""}
              ${thumb
                ? `<img src="${appContext.escapeHtml(thumb)}" alt="${appContext.escapeHtml(v.title)} thumbnail">`
                : `<div class="showcase-media-placeholder">${appContext.youtubeVideoId(v.video_url) ? "YouTube Video" : "Video showcase"}</div>`}
              <div class="showcase-play">▶</div>
            </div>
            <div class="showcase-body">
              <div class="showcase-title">${appContext.escapeHtml(v.title)}</div>
              <div class="showcase-category-label">${appContext.escapeHtml(category)}</div>
              ${v.series ? `<div class="showcase-series">${appContext.escapeHtml(v.series)}</div>` : ""}
              ${v.description ? `<div class="showcase-description">${appContext.escapeHtml(v.description)}</div>` : ""}
              <div class="showcase-actions">
                <button type="button" class="btn-ghost showcase-watch" data-showcase-watch="${v.id}">${appContext.youtubeVideoId(v.video_url) ? "▶ Watch" : (appContext.isFacebookVideoUrl(v.video_url) ? "▶ Watch on Facebook ↗" : "▶ Watch")}</button>
                <div class="showcase-owner-actions owner-only">
                  <button type="button" class="btn-ghost" data-showcase-edit="${v.id}">Edit</button>
                  <button type="button" class="btn-ghost" data-showcase-delete="${v.id}" style="color:var(--danger)">Delete</button>
                </div>
              </div>
            </div>
          </article>`;
        }).join("")
      }</div>`;
    }

    appContext.$("showcaseCategoryBar").querySelectorAll("[data-showcase-category]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        appContext.activeShowcaseCategory = btn.dataset.showcaseCategory;
        appContext.renderShowcasePage();
      });
    });

    const addBtn = appContext.$("addShowcaseBtn");
    if(addBtn) addBtn.addEventListener("click", ()=>appContext.openShowcaseForm());

    appContext.setupShowcaseRearrangeMode();

    mount.querySelectorAll("[data-showcase-watch]").forEach(el=>{
      el.addEventListener("click", e=>{
        e.stopPropagation();
        const v = appContext.showcases.find(x=>x.id===el.dataset.showcaseWatch);
        if(v) appContext.openShowcaseVideo(v);
      });
    });

    mount.querySelectorAll("[data-showcase-edit]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const v = appContext.showcases.find(x=>x.id===btn.dataset.showcaseEdit);
        if(v) appContext.openShowcaseForm(v);
      });
    });

    mount.querySelectorAll("[data-showcase-delete]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        if(!appContext.requireOwner()) return;
        const v = appContext.showcases.find(x=>x.id===btn.dataset.showcaseDelete);
        if(!v) return;
        if(!confirm(`Delete showcase "${v.title}"?`)) return;
        const { error } = await appContext.deleteShowcase(v.id);
        if(error){ console.error(error); appContext.showToast("Could not delete showcase"); return; }
        await appContext.loadShowcases();
        appContext.renderShowcasePage();
        appContext.showToast("Showcase deleted");
      });
    });
  }

function openShowcaseForm(v=null){
    if(!appContext.requireOwner()) return;
    appContext.$("showcaseFormTitle").textContent = v ? "Edit Showcase Video" : "Add Showcase Video";
    appContext.$("showcaseId").value = v ? v.id : "";
    appContext.$("showcaseTitle").value = v ? v.title : "";
    appContext.$("showcaseCategory").value = v
      ? appContext.showcaseDisplayCategory(v)
      : (appContext.activeShowcaseCategory==="PSA Returns" ? "PSA Returns" : "Collection Showcase");
    appContext.$("showcaseSeries").value = v ? v.series : "";
    appContext.$("showcaseVideoUrl").value = v ? v.video_url : "";
    appContext.$("showcaseThumbnail").value = v ? v.thumbnail_url : "";
    appContext.$("showcaseThumbnailFile").value = "";
    appContext.renderShowcaseThumbnailPreview(v ? v.thumbnail_url : "");
    appContext.$("showcaseDescription").value = v ? v.description : "";
    appContext.$("showcaseSortOrder").value = v
      ? v.sort_order
      : appContext.showcases.filter(x=>appContext.showcaseDisplayCategory(x)===(
          appContext.activeShowcaseCategory==="PSA Returns" ? "PSA Returns" : "Collection Showcase"
        )).length;
    appContext.$("showcaseFeatured").checked = v ? !!v.featured : false;
    appContext.showcaseOverlay.hidden = false;
  }

function closeShowcaseForm(){
    appContext.showcaseOverlay.hidden = true;
    appContext.showcaseForm.reset();
    appContext.$("showcaseId").value = "";
  }

  Object.assign(appContext,{uploadShowcaseThumbnail,renderShowcaseThumbnailPreview,cleanFacebookVideoUrl,isFacebookVideoUrl,youtubeVideoId,showcaseThumbnail,openShowcaseVideo,closeShowcaseVideo,showcaseDisplayCategory,showcasesForActiveCategory,persistShowcaseDomOrder,setupShowcaseRearrangeMode,renderShowcasePage,openShowcaseForm,closeShowcaseForm});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.showcaseOverlay = appContext.$("showcaseOverlay");

  appContext.showcaseForm = appContext.$("showcaseForm");

appContext.$("showcaseCancelBtn").addEventListener("click", appContext.closeShowcaseForm);

appContext.$("showcaseThumbnailFile").addEventListener("change", ()=>{
    const file = appContext.$("showcaseThumbnailFile").files?.[0];
    if(!file){
      appContext.renderShowcaseThumbnailPreview(appContext.$("showcaseThumbnail").value);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    appContext.renderShowcaseThumbnailPreview(objectUrl);
  });

appContext.showcaseOverlay.addEventListener("click", e=>{
    if(e.target === appContext.showcaseOverlay) appContext.closeShowcaseForm();
  });

appContext.showcaseForm.addEventListener("submit", async e=>{
    e.preventDefault();
    if(!appContext.requireOwner()) return;

    const id = appContext.$("showcaseId").value || null;

    let thumbnailUrl = appContext.$("showcaseThumbnail").value.trim();
    const thumbnailFile = appContext.$("showcaseThumbnailFile").files?.[0];

    if(thumbnailFile){
      appContext.showToast("Uploading thumbnail…");
      const uploaded = await appContext.uploadShowcaseThumbnail(thumbnailFile);
      if(!uploaded) return;
      thumbnailUrl = uploaded;
    }

    const payload = {
      title: appContext.$("showcaseTitle").value.trim(),
      category: appContext.$("showcaseCategory").value,
      series: appContext.$("showcaseSeries").value.trim(),
      video_url: appContext.$("showcaseVideoUrl").value.trim(),
      thumbnail_url: thumbnailUrl,
      description: appContext.$("showcaseDescription").value.trim(),
      sort_order: parseInt(appContext.$("showcaseSortOrder").value || "0",10) || 0,
      featured: appContext.$("showcaseFeatured").checked
    };

    if(!payload.title || !payload.video_url) return;

    const { error } = await appContext.saveShowcase(payload, id);
    if(error){
      console.error("Save showcase error:", error);
      appContext.showToast("Could not save showcase");
      return;
    }

    appContext.closeShowcaseForm();
    await appContext.loadShowcases();
    appContext.renderShowcasePage();
    appContext.showToast(id ? "Showcase updated" : "Showcase added");
  });

appContext.$("videoCloseBtn").addEventListener("click", appContext.closeShowcaseVideo);

appContext.$("videoOverlay").addEventListener("click", e=>{
    if(e.target === appContext.$("videoOverlay")) appContext.closeShowcaseVideo();
  });
}
