/** V93 beta: features/owner/history. Shared dependencies are explicit on appContext. */
export function register(appContext){
function ownerRecentEditTime(card){
    const updated=card?.updated_at ? new Date(card.updated_at).getTime() : 0;
    const created=card?.created_at ? new Date(card.created_at).getTime() : 0;
    return Math.max(Number.isFinite(updated)?updated:0,Number.isFinite(created)?created:0);
  }

function formatOwnerTimestamp(value){
    if(!value) return "—";
    const d=new Date(value);
    if(!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleString("en-US",{
      year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"
    });
  }

function renderRecentlyEditedOwnerPage(fromInventoryTools=false){
    if(!appContext.requireOwner("open recently edited")) return;

    const recent=appContext.cards.slice().sort((a,b)=>
      appContext.ownerRecentEditTime(b)-appContext.ownerRecentEditTime(a) ||
      String(a.name||"").localeCompare(String(b.name||""))
    );

    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Inventory Tools · Activity</div>
          <h2>Recently Edited</h2>
          <p>Review the most recently added or updated inventory listings and jump straight into common owner actions.</p>
        </div>
      </div>

      <div class="recent-edit-summary">
        <div><strong>${recent.length}</strong><span>Total listings</span></div>
        <div><strong>${recent.filter(c=>appContext.isNewCard(c)).length}</strong><span>Added this week</span></div>
        <div><strong>${recent.filter(c=>appContext.normalizeFilterValue(c.availability)==="reserved").length}</strong><span>Reserved</span></div>
      </div>

      <div class="panel recent-edit-panel">
        <div class="recent-edit-toolbar">
          <div class="field">
            <label for="recentEditSearch">Search</label>
            <input id="recentEditSearch" type="search" maxlength="100" placeholder="Name, code, game or series…">
          </div>
          <div class="field">
            <label for="recentEditStatus">Status</label>
            <select id="recentEditStatus">
              <option value="">All statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
              <option value="collection (nfs)">Collection (NFS)</option>
            </select>
          </div>
          <div class="field">
            <label for="recentEditLimit">Show</label>
            <select id="recentEditLimit">
              <option value="20">20 listings</option>
              <option value="50">50 listings</option>
              <option value="100">100 listings</option>
              <option value="all">All listings</option>
            </select>
          </div>
        </div>

        <div class="recent-edit-list" id="recentEditList"></div>
        <div class="recent-edit-empty" id="recentEditEmpty" hidden>No matching listings.</div>
      </div>
    `;

    const search=appContext.$("recentEditSearch");
    const status=appContext.$("recentEditStatus");
    const limit=appContext.$("recentEditLimit");
    const list=appContext.$("recentEditList");
    const empty=appContext.$("recentEditEmpty");

    function filtered(){
      const q=appContext.normalizeFilterValue(search.value);
      const s=appContext.normalizeFilterValue(status.value);

      let rows=recent.filter(card=>{
        if(s && appContext.normalizeFilterValue(card.availability)!==s) return false;
        if(q){
          const hay=[card.name,card.card_code,card.game,card.series,card.year,card.language,card.language_details]
            .map(v=>appContext.normalizeFilterValue(v)).join(" ");
          if(!hay.includes(q)) return false;
        }
        return true;
      });

      if(limit.value!=="all"){
        const n=Math.max(1,Number(limit.value)||20);
        rows=rows.slice(0,n);
      }
      return rows;
    }

    function render(){
      const rows=filtered();
      empty.hidden=rows.length>0;

      list.innerHTML=rows.map(card=>{
        const image=appContext.getImages(card)[0]||"";
        const updated=appContext.ownerRecentEditTime(card);
        const createdTime=card.created_at ? new Date(card.created_at).getTime() : 0;
        const isAdded=updated===createdTime || !card.updated_at;
        const id=String(card.id);

        return `
          <article class="recent-edit-row">
            <div class="recent-edit-thumb">${image?`<img src="${appContext.escapeHtml(image)}" alt="">`:"—"}</div>
            <div class="recent-edit-main">
              <div class="recent-edit-title">
                <strong>${appContext.escapeHtml(card.name||"Untitled card")}</strong>
                ${appContext.isNewCard(card)?`<span class="recent-edit-new">NEW</span>`:""}
              </div>
              <div class="recent-edit-meta">${appContext.escapeHtml([card.card_code,card.year,card.game,card.series].filter(Boolean).join(" · "))}</div>
              <div class="recent-edit-time">${isAdded?"Added":"Updated"} ${appContext.escapeHtml(appContext.formatOwnerTimestamp(card.updated_at||card.created_at))}</div>
            </div>
            <div class="recent-edit-status">${appContext.escapeHtml(card.availability||"Available")}</div>
            <div class="recent-edit-actions">
              <button type="button" class="btn-ghost" data-recent-view="${appContext.escapeHtml(id)}">View</button>
              <button type="button" class="btn-ghost" data-recent-clone="${appContext.escapeHtml(id)}">Clone</button>
              <button type="button" class="btn-ghost" data-recent-fb="${appContext.escapeHtml(id)}">FB Post</button>
              <button type="button" class="btn-primary" data-recent-edit="${appContext.escapeHtml(id)}">Edit</button>
            </div>
          </article>
        `;
      }).join("");

      list.querySelectorAll("[data-recent-view]").forEach(btn=>btn.addEventListener("click",()=>{
        const card=appContext.getCardById(btn.dataset.recentView);
        if(card) appContext.openCardRoute(card.id);
      }));
      list.querySelectorAll("[data-recent-edit]").forEach(btn=>btn.addEventListener("click",()=>{
        const card=appContext.getCardById(btn.dataset.recentEdit);
        if(card&&appContext.requireOwner("edit recent listing")) appContext.openEditModal(card);
      }));
      list.querySelectorAll("[data-recent-clone]").forEach(btn=>btn.addEventListener("click",()=>{
        const card=appContext.getCardById(btn.dataset.recentClone);
        if(card&&appContext.requireOwner("clone recent listing")) appContext.openCloneOptions(card);
      }));
      list.querySelectorAll("[data-recent-fb]").forEach(btn=>btn.addEventListener("click",()=>{
        if(!appContext.requireOwner("generate Facebook post")) return;
        const id=String(btn.dataset.recentFb||"");
        location.hash=`#/fb-tools?mode=single&card=${encodeURIComponent(id)}`;
      }));
    }

    [search,status,limit].forEach(el=>{
      el.addEventListener("input",render);
      el.addEventListener("change",render);
    });
    render();
  }

  Object.assign(appContext,{ownerRecentEditTime,formatOwnerTimestamp,renderRecentlyEditedOwnerPage});
}
