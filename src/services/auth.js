/** V93 beta: services/auth. Shared dependencies are explicit on appContext. */
export function register(appContext){
function isMobileOwnerBlocked(){
    return window.matchMedia("(max-width:800px)").matches;
  }

function isOwnerAuthenticated(){
    return !!appContext.ownerSession && appContext.ownerVerified === true;
  }

function isOwnerBuyerPreview(){
    return !appContext.isMobileOwnerBlocked() && appContext.isOwnerAuthenticated() && appContext.ownerBuyerPreview === true;
  }

function isOwnerMode(){
    return !appContext.isMobileOwnerBlocked() && appContext.isOwnerAuthenticated() && !appContext.isOwnerBuyerPreview();
  }

function canManageCollectionOrder(){
    return appContext.isOwnerAuthenticated();
  }

function readOwnerBuyerPreviewPreference(){
    try{return appContext.sessionStorage.getItem('collect_tcg_owner_buyer_preview')==='1';}catch{return false;}
  }

function writeOwnerBuyerPreviewPreference(enabled){
    try{
      if(enabled) appContext.sessionStorage.setItem('collect_tcg_owner_buyer_preview','1');
      else appContext.sessionStorage.removeItem('collect_tcg_owner_buyer_preview');
    }catch{}
  }

function ensureOwnerBuyerPreviewToggle(){
    let button=document.getElementById('ownerBuyerPreviewToggle');
    if(!button){
      button=document.createElement('button');
      button.id='ownerBuyerPreviewToggle';
      button.type='button';
      button.className='owner-buyer-preview-toggle';
      button.addEventListener('click',()=>appContext.toggleOwnerBuyerPreview());
      document.body.appendChild(button);
    }
    return button;
  }

function syncOwnerBuyerPreviewToggle(){
    const button=appContext.ensureOwnerBuyerPreviewToggle();
    const authenticated=appContext.isOwnerAuthenticated() && !appContext.isMobileOwnerBlocked();
    const preview=appContext.isOwnerBuyerPreview();
    button.hidden=!authenticated;
    button.classList.toggle('is-previewing',preview);
    button.setAttribute('aria-pressed',preview?'true':'false');
    button.textContent=preview ? 'Exit buyer preview' : 'Preview buyer view';
    button.title=preview ? 'Return to Owner View' : 'Hide owner controls and preview the public buyer experience';
  }

function setOwnerBuyerPreview(enabled,{rerender=true,notify=true}={}){
    const next=!!enabled && appContext.isOwnerAuthenticated() && !appContext.isMobileOwnerBlocked();
    appContext.ownerBuyerPreview=next;
    appContext.writeOwnerBuyerPreviewPreference(next);
    appContext.applyOwnerMode();
    if(rerender && typeof appContext.router==='function') appContext.router();
    if(notify) appContext.showToast(next ? 'Buyer preview enabled' : 'Owner view restored');
    return next;
  }

function toggleOwnerBuyerPreview(){
    return appContext.setOwnerBuyerPreview(!appContext.isOwnerBuyerPreview());
  }

function requireCollectionOrderOwner(action="rearrange Collection"){
    if(appContext.canManageCollectionOrder()) return true;
    console.warn(`Blocked non-owner attempt to ${action}.`);
    appContext.showToast("Owner login required");
    return false;
  }

async function verifyOwnerSession(session){
    if(!session?.user?.id) return false;

    const {data,error}=await appContext.supabaseClient.rpc("is_app_owner");
    if(error){
      console.error("Owner verification error:",error);
      return false;
    }
    return data === true;
  }

function clearOwnerOnlyClientState(){
    appContext.cards=appContext.cards.filter(appContext.isLiveLifecycle);
    appContext.ownerPrivateSupported=false;
    appContext.cardImageVariantsSupported=false;
    appContext.editHistorySupported=false;
    appContext.ownerVerified=false;
    appContext.detailsPreservedListingHash="";
    if(typeof appContext.invalidateOwnerReservedAgeCache==="function"){
      appContext.invalidateOwnerReservedAgeCache();
    }

    if(!appContext.detailsOverlay.hidden){
      const current=appContext.getCardById(appContext.detailsCardId);
      if(!current) appContext.closeDetailsModal(false);
    }
  }

function applyOwnerMode(){
    const owner=appContext.isOwnerMode();
    const authenticatedOwner=appContext.isOwnerAuthenticated();
    const buyerPreview=appContext.isOwnerBuyerPreview();
    document.body.classList.toggle("owner-mode", owner);
    document.body.classList.toggle("owner-authenticated", authenticatedOwner);
    document.body.classList.toggle("owner-buyer-preview", buyerPreview);

    // Keep owner analytics caches intact while merely previewing the buyer UI.
    if(!authenticatedOwner){
      appContext.qualifiedViewTotalsByCard?.clear?.();
      appContext.qualifiedViewTotalsBackendState="unknown";
    }

    const b = appContext.$("ownerToggle");
    if(b) b.textContent = owner ? "Owner logout" : "Owner login";
    const sidebarToggle = appContext.$("sidebarOwnerToggleBtn");
    if(sidebarToggle) sidebarToggle.textContent = owner ? "🚪 Owner logout" : "🔐 Owner login";
    appContext.syncOwnerBuyerPreviewToggle();

    // Toggle .not-owner-only items
    document.querySelectorAll(".not-owner-only").forEach(el=>{
      el.hidden = owner;
      if(owner) el.style.setProperty("display","none","important");
      else el.style.removeProperty("display");
    });

    // Fail closed in both desktop and mobile navigation. Responsive CSS must
    // never be the only thing deciding whether an owner tool is visible.
    document.querySelectorAll(".owner-private-analytics").forEach(el=>{
      if(owner) el.style.removeProperty("display");
      else el.style.setProperty("display","none","important");
    });

    document.querySelectorAll(".owner-only").forEach(el=>{
      if(el.id==="detailsEditBtn" || el.id==="detailsCloneBtn" || el.id==="detailsDeleteBtn"){
        el.hidden=!owner;
        return;
      }

      // Navigation/actions that are owner-only are explicitly removed from
      // layout for public sessions. Verified owner mode may reveal them.
      if(
        el.matches("nav a, nav button, .desktop-more-owner, .card-actions, .showcase-owner-actions, .giveaway-owner-actions, .premium-more-menu a, .premium-more-menu button, .mobile-more-links a, .mobile-more-links button, .premium-more-divider")
      ){
        el.hidden=!owner;
        if(owner) el.style.removeProperty("display");
        else el.style.setProperty("display","none","important");
      }
    });

    const detailsEditBtn = appContext.$("detailsEditBtn");
    if(detailsEditBtn){
      detailsEditBtn.hidden = !owner;
      detailsEditBtn.style.display = owner ? "inline-flex" : "none";
    }

    const detailsCloneBtn = appContext.$("detailsCloneBtn");
    if(detailsCloneBtn){
      detailsCloneBtn.hidden = !owner;
      detailsCloneBtn.style.display = owner ? "inline-flex" : "none";
    }

    const detailsDeleteBtn = appContext.$("detailsDeleteBtn");
    if(detailsDeleteBtn){
      detailsDeleteBtn.hidden = !owner;
      detailsDeleteBtn.style.display = owner ? "inline-flex" : "none";
    }

    // If owner state disappears while an owner-only route is open, immediately
    // leave that route instead of leaving stale owner UI on screen.
    if(!owner && typeof appContext.currentRoute==="function"){
      const route=appContext.currentRoute();
      if(appContext.isOwnerOnlyRoute(route)){
        appContext.goToRoute("inventory");
      }
    }
  }

function requireOwner(action = "perform this action"){
    if(appContext.isOwnerMode()) return true;
    console.warn(`Blocked non-owner attempt to ${action}.`);
    appContext.showToast("Owner login required");
    return false;
  }

function confirmOwnerAction(message){
    if(!appContext.isOwnerMode()) return false;
    return window.confirm(String(message||""));
  }

async function refreshOwnerSession(){
    const {data,error}=await appContext.supabaseClient.auth.getSession();
    if(error) console.error("Auth session error:",error);

    appContext.ownerSession=data?.session||null;

    if(appContext.isMobileOwnerBlocked()){
      appContext.ownerVerified=await appContext.verifyOwnerSession(appContext.ownerSession);
      appContext.ownerBuyerPreview=false;
      appContext.writeOwnerBuyerPreviewPreference(false);
      if(appContext.ownerSession && !appContext.ownerVerified){
        console.warn("Authenticated mobile session is not authorized for Collection ordering.");
      }
      appContext.applyOwnerMode();
      return;
    }

    appContext.ownerVerified=await appContext.verifyOwnerSession(appContext.ownerSession);
    appContext.ownerBuyerPreview=appContext.ownerVerified ? appContext.readOwnerBuyerPreviewPreference() : false;

    if(appContext.ownerSession && !appContext.ownerVerified){
      console.warn("Authenticated session is not authorized as an app owner.");
    }
    appContext.applyOwnerMode();
  }

function ownerPostHandoffNonce(){
    return crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

function currentOwnerPostHandoffNonce(){
    if(appContext.currentRoute()!=="fb-tools") return "";
    return String(appContext.currentHashParams().get("handoff")||"").trim();
  }

function removeOwnerPostHandoffParam(){
    if(appContext.currentRoute()!=="fb-tools") return;
    const params=appContext.currentHashParams();
    params.delete("handoff");
    const query=params.toString();
    history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#/fb-tools${query?`?${query}`:""}`
    );
  }

async function receiveOwnerPostGeneratorHandoff(){
    const nonce=appContext.currentOwnerPostHandoffNonce();
    if(!nonce) return false;

    const channelName=`collect-tcg-owner-post-${nonce}`;

    return await new Promise(resolve=>{
      let settled=false;
      let channel=null;

      const finish=value=>{
        if(settled) return;
        settled=true;
        clearTimeout(timer);
        try{ channel?.close(); }catch{}
        window.removeEventListener("message",onWindowMessage);
        resolve(value);
      };

      const acceptSession=async payload=>{
        if(!payload || payload.type!==appContext.OWNER_POST_HANDOFF_MESSAGE) return;
        if(payload.nonce!==nonce || payload.action!=="session") return;

        try{
          const accessToken=String(payload.access_token||"");
          const refreshToken=String(payload.refresh_token||"");

          if(!accessToken || !refreshToken){
            finish(false);
            return;
          }

          const {data,error}=await appContext.supabaseClient.auth.setSession({
            access_token:accessToken,
            refresh_token:refreshToken
          });

          if(error || !data?.session){
            console.warn("Owner Post Generator handoff failed:",error);
            finish(false);
            return;
          }

          appContext.ownerSession=data.session;
          appContext.ownerVerified=await appContext.verifyOwnerSession(appContext.ownerSession);

          if(!appContext.ownerVerified){
            console.warn("Owner Post Generator handoff session was not verified.");
            appContext.ownerSession=null;
            finish(false);
            return;
          }

          appContext.applyOwnerMode();
          appContext.removeOwnerPostHandoffParam();

          try{
            channel?.postMessage({
              type:appContext.OWNER_POST_HANDOFF_MESSAGE,
              nonce,
              action:"ack"
            });
          }catch{}

          try{
            window.opener?.postMessage({
              type:appContext.OWNER_POST_HANDOFF_MESSAGE,
              nonce,
              action:"ack"
            },location.origin);
          }catch{}

          try{ window.opener=null; }catch{}
          finish(true);
        }catch(error){
          console.warn("Owner Post Generator handoff failed:",error);
          finish(false);
        }
      };

      const onWindowMessage=event=>{
        if(event.origin!==location.origin) return;
        acceptSession(event.data);
      };

      window.addEventListener("message",onWindowMessage);

      if("BroadcastChannel" in window){
        try{
          channel=new BroadcastChannel(channelName);
          channel.addEventListener("message",event=>{
            acceptSession(event.data);
          });

          // Ask repeatedly for a short period in case the opener has not yet
          // attached its BroadcastChannel listener.
          const request=()=>{
            try{
              channel?.postMessage({
                type:appContext.OWNER_POST_HANDOFF_MESSAGE,
                nonce,
                action:"request"
              });
            }catch{}
          };

          request();
          setTimeout(request,120);
          setTimeout(request,300);
          setTimeout(request,650);
        }catch(error){
          console.warn("BroadcastChannel owner handoff unavailable:",error);
        }
      }

      // Fallback for browsers that preserve window.opener.
      try{
        window.opener?.postMessage({
          type:appContext.OWNER_POST_HANDOFF_MESSAGE,
          nonce,
          action:"request"
        },location.origin);
      }catch{}

      const timer=setTimeout(()=>finish(false),6000);
    });
  }

async function openOwnerAccess(options = {}){
    const mobileCollectionAccess=appContext.isMobileOwnerBlocked();

    if(mobileCollectionAccess && appContext.canManageCollectionOrder()){
      await appContext.supabaseClient.auth.signOut();
      appContext.ownerSession=null;
      appContext.ownerVerified=false;
      appContext.ownerBuyerPreview=false;
      appContext.writeOwnerBuyerPreviewPreference(false);
      appContext.applyOwnerMode();
      if(appContext.currentRoute()==="collection") appContext.router();
      appContext.showToast("Collection owner access logged out");
      return;
    }

    if(appContext.isOwnerAuthenticated() && appContext.isOwnerBuyerPreview()){
      appContext.setOwnerBuyerPreview(false,{rerender:true,notify:true});
      return;
    }

    if(appContext.isOwnerMode()){
      await appContext.supabaseClient.auth.signOut();
      appContext.ownerSession=null;
      appContext.ownerVerified=false;
      appContext.ownerBuyerPreview=false;
      appContext.writeOwnerBuyerPreviewPreference(false);
      appContext.clearOwnerOnlyClientState();
      appContext.applyOwnerMode();
      const loaded=await appContext.loadCards();
      if(!loaded && !appContext.cards.length){
        appContext.renderCatalogueLoadError();
        return;
      }

      if(appContext.currentRoute()==="add") appContext.goToRoute("inventory");
      else appContext.router();

      appContext.showToast("Logged out of owner mode");
      return;
    }

    const overlay = document.getElementById("ownerLoginOverlay");
    const form = document.getElementById("ownerLoginForm");
    const emailInput = document.getElementById("ownerLoginEmail");
    const passwordInput = document.getElementById("ownerLoginPassword");
    const errorBox = document.getElementById("ownerLoginError");
    const cancelBtn = document.getElementById("ownerLoginCancelBtn");
    const submitBtn = document.getElementById("ownerLoginSubmitBtn");

    if(overlay && form && emailInput && passwordInput){
      return new Promise(resolve => {
        emailInput.value = "";
        passwordInput.value = "";
        if(errorBox){ errorBox.style.display = "none"; errorBox.textContent = ""; }
        if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = "Log in"; }
        overlay.hidden = false;
        setTimeout(() => emailInput.focus(), 60);

        const cleanup = () => {
          overlay.hidden = true;
          form.removeEventListener("submit", onSubmit);
          cancelBtn?.removeEventListener("click", onCancel);
          overlay.removeEventListener("click", onOverlayClick);
          window.removeEventListener("keydown", onKeyDown);
        };

        const onCancel = () => {
          cleanup();
          if(options.onCancel) options.onCancel();
          resolve(false);
        };

        const onOverlayClick = (e) => {
          if(e.target === overlay) onCancel();
        };

        const onKeyDown = (e) => {
          if(e.key === "Escape") onCancel();
        };

        const onSubmit = async (e) => {
          e.preventDefault();
          const email = emailInput.value.trim();
          const password = passwordInput.value;

          if(!email || !password) return;

          if(submitBtn){
            submitBtn.disabled = true;
            submitBtn.textContent = "Logging in…";
          }
          if(errorBox) errorBox.style.display = "none";

          try {
            const { data, error } = await appContext.supabaseClient.auth.signInWithPassword({
              email,
              password
            });

            if(error){
              console.error("Login error:", error);
              if(errorBox){
                errorBox.textContent = error.message || "Invalid login credentials.";
                errorBox.style.display = "block";
              }
              appContext.showToast(error.message || "Login failed");
              if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = "Log in"; }
              return;
            }

            appContext.ownerSession = data.session;
            appContext.ownerVerified = await appContext.verifyOwnerSession(appContext.ownerSession);

            if(!appContext.ownerVerified){
              await appContext.supabaseClient.auth.signOut();
              appContext.ownerSession = null;
              appContext.ownerVerified = false;
              if(errorBox){
                errorBox.textContent = "This account is not authorized as an owner.";
                errorBox.style.display = "block";
              }
              appContext.showToast("This account is not authorized as owner");
              if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = "Log in"; }
              return;
            }

            cleanup();
            appContext.ownerBuyerPreview = false;
            appContext.writeOwnerBuyerPreviewPreference(false);
            appContext.applyOwnerMode();

            if(appContext.isMobileOwnerBlocked()){
              await Promise.all([
                appContext.loadCollectionCardOrder(),
                appContext.loadCollectionGameOrder(),
                appContext.loadInventoryCardOrder(),
                appContext.loadInventoryGameOrder()
              ]);
              appContext.router();
              appContext.showToast("Mobile rearrange access enabled");
              resolve(true);
              return;
            }

            const loaded = await appContext.loadCards();
            if(!loaded && !appContext.cards.length){
              appContext.renderCatalogueLoadError();
              resolve(true);
              return;
            }

            if(options.targetRoute){
              appContext.goToRoute(options.targetRoute);
            } else if(appContext.currentRoute() === "add"){
              appContext.renderAddPage();
            } else {
              appContext.router();
            }

            appContext.showToast("Owner login successful");
            resolve(true);
          } catch(err){
            console.error("Owner login exception:", err);
            if(errorBox){
              errorBox.textContent = err.message || "An unexpected error occurred.";
              errorBox.style.display = "block";
            }
            if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = "Log in"; }
          }
        };

        form.addEventListener("submit", onSubmit);
        cancelBtn?.addEventListener("click", onCancel);
        overlay.addEventListener("click", onOverlayClick);
        window.addEventListener("keydown", onKeyDown);
      });
    }

    // Fallback prompt dialogs if modal not mounted
    const email = prompt("Owner email:");
    if(email === null) return;
    const password = prompt("Owner password:");
    if(password === null) return;

    const { data, error } = await appContext.supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if(error){
      console.error("Login error:", error);
      appContext.showToast("Login failed");
      return;
    }

    appContext.ownerSession=data.session;
    appContext.ownerVerified=await appContext.verifyOwnerSession(appContext.ownerSession);

    if(!appContext.ownerVerified){
      await appContext.supabaseClient.auth.signOut();
      appContext.ownerSession=null;
      appContext.ownerVerified=false;
      appContext.ownerBuyerPreview=false;
      appContext.writeOwnerBuyerPreviewPreference(false);
      appContext.clearOwnerOnlyClientState();
      appContext.applyOwnerMode();
      appContext.showToast("This account is not authorized as owner");
      return;
    }

    appContext.ownerBuyerPreview=false;
    appContext.writeOwnerBuyerPreviewPreference(false);
    appContext.applyOwnerMode();

    if(appContext.isMobileOwnerBlocked()){
      await Promise.all([
        appContext.loadCollectionCardOrder(),
        appContext.loadCollectionGameOrder(),
        appContext.loadInventoryCardOrder(),
        appContext.loadInventoryGameOrder()
      ]);
      appContext.router();
      appContext.showToast("Mobile rearrange access enabled");
      return;
    }

    const loaded=await appContext.loadCards();

    if(!loaded && !appContext.cards.length){
      appContext.renderCatalogueLoadError();
      return;
    }

    if(options.targetRoute){
      appContext.goToRoute(options.targetRoute);
    } else {
      appContext.router();
    }
    appContext.showToast("Owner login successful");
  }

function renderLoginPage(targetRoute = "inventory", noticeMessage = ""){
    if(appContext.isOwnerMode()){
      appContext.goToRoute(targetRoute || "inventory");
      return;
    }

    appContext.view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">Store Administration</div>
          <h2>Owner Login</h2>
          <p>${noticeMessage || "Sign in with your Supabase owner credentials to add cards, upload photos, and manage inventory."}</p>
        </div>
      </div>
      <div class="owner-login-page-card" style="max-width: 460px; margin: 1.5rem 0 3rem 0; background: var(--surface-1, #15171c); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 28px; box-shadow: 0 16px 40px rgba(0,0,0,0.45);">
        <form id="pageOwnerLoginForm" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label for="pageOwnerEmail" style="font-weight:600; font-size:13px; color:var(--text, #f0f0f0);">Owner Email</label>
            <input type="email" id="pageOwnerEmail" required placeholder="owner@soonsoontcg.com" autocomplete="username" style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:9px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.04); color:inherit; font-size:14px; outline:none;">
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label for="pageOwnerPassword" style="font-weight:600; font-size:13px; color:var(--text, #f0f0f0);">Password</label>
            <input type="password" id="pageOwnerPassword" required placeholder="••••••••" autocomplete="current-password" style="width:100%; box-sizing:border-box; padding:12px 14px; border-radius:9px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.04); color:inherit; font-size:14px; outline:none;">
          </div>
          <div id="pageOwnerError" style="color:var(--danger, #ff6b6b); font-size:13px; display:none; padding:10px 14px; background:rgba(255,90,90,0.12); border-radius:8px; border:1px solid rgba(255,90,90,0.25); line-height:1.4;"></div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <a href="#/inventory" class="btn-ghost" style="text-decoration:none; display:inline-flex; align-items:center; padding:10px 16px; border-radius:9px; font-size:13.5px;">Cancel</a>
            <button type="submit" class="btn-primary" id="pageOwnerSubmitBtn" style="padding:10px 24px; font-size:13.5px;">Log in to SoonSoonTCG</button>
          </div>
        </form>
      </div>
    `;

    const form = document.getElementById("pageOwnerLoginForm");
    const emailInput = document.getElementById("pageOwnerEmail");
    const passwordInput = document.getElementById("pageOwnerPassword");
    const errorBox = document.getElementById("pageOwnerError");
    const submitBtn = document.getElementById("pageOwnerSubmitBtn");

    setTimeout(() => emailInput?.focus(), 60);

    form?.addEventListener("submit", async e => {
      e.preventDefault();
      const email = emailInput?.value.trim();
      const password = passwordInput?.value;
      if(!email || !password) return;

      if(submitBtn){
        submitBtn.disabled = true;
        submitBtn.textContent = "Logging in…";
      }
      if(errorBox) errorBox.style.display = "none";

      try {
        const { data, error } = await appContext.supabaseClient.auth.signInWithPassword({
          email,
          password
        });

        if(error){
          console.error("Login error:", error);
          if(errorBox){
            errorBox.textContent = error.message || "Invalid login credentials.";
            errorBox.style.display = "block";
          }
          appContext.showToast(error.message || "Login failed");
          if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = "Log in to SoonSoonTCG"; }
          return;
        }

        appContext.ownerSession = data.session;
        appContext.ownerVerified = await appContext.verifyOwnerSession(appContext.ownerSession);

        if(!appContext.ownerVerified){
          await appContext.supabaseClient.auth.signOut();
          appContext.ownerSession = null;
          appContext.ownerVerified = false;
          if(errorBox){
            errorBox.textContent = "This account is authenticated, but is not recognized as an owner in Supabase.";
            errorBox.style.display = "block";
          }
          appContext.showToast("This account is not authorized as owner");
          if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = "Log in to SoonSoonTCG"; }
          return;
        }

        appContext.ownerBuyerPreview = false;
        appContext.writeOwnerBuyerPreviewPreference(false);
        appContext.applyOwnerMode();
        await appContext.loadCards();
        appContext.showToast("Owner login successful!");

        if(targetRoute && targetRoute !== "login"){
          appContext.goToRoute(targetRoute);
        } else {
          appContext.goToRoute("add");
        }
      } catch(err){
        console.error("Login exception:", err);
        if(errorBox){
          errorBox.textContent = err.message || "An unexpected error occurred.";
          errorBox.style.display = "block";
        }
        if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = "Log in to SoonSoonTCG"; }
      }
    });
  }

  Object.assign(appContext,{isMobileOwnerBlocked,isOwnerAuthenticated,isOwnerBuyerPreview,isOwnerMode,canManageCollectionOrder,readOwnerBuyerPreviewPreference,writeOwnerBuyerPreviewPreference,ensureOwnerBuyerPreviewToggle,syncOwnerBuyerPreviewToggle,setOwnerBuyerPreview,toggleOwnerBuyerPreview,requireCollectionOrderOwner,verifyOwnerSession,clearOwnerOnlyClientState,applyOwnerMode,requireOwner,confirmOwnerAction,refreshOwnerSession,ownerPostHandoffNonce,currentOwnerPostHandoffNonce,removeOwnerPostHandoffParam,receiveOwnerPostGeneratorHandoff,openOwnerAccess,renderLoginPage});
}
