/** V93 beta: features/content/reviews. Shared dependencies are explicit on appContext. */
export function register(appContext){
function reviewStars(rating){
    const value=Math.max(1,Math.min(5,Number(rating)||1));
    return `${"★".repeat(value)}${"☆".repeat(5-value)}`;
  }

function reviewCountryLabel(value){
    const safe=String(value||"").trim();
    const match=appContext.REVIEW_COUNTRIES.find(([code])=>code===safe);
    return match ? match[1] : "";
  }

function reviewCountryOptions(){
    const priority=new Set(["MY","SG","JP","KR","US","GB","AU","CN","HK","TW","TH","ID","PH","VN"]);
    const primary=appContext.REVIEW_COUNTRIES.filter(([code])=>priority.has(code));
    const rest=appContext.REVIEW_COUNTRIES.filter(([code])=>!priority.has(code) && code!=="Other");

    const option=([code,label])=>`<option value="${appContext.escapeHtml(code)}">${appContext.escapeHtml(label)}</option>`;

    return [
      ...primary.map(option),
      `<option disabled>──────────</option>`,
      ...rest.map(option),
      `<option value="Other">Other</option>`
    ].join("");
  }

function reviewDateLabel(value){
    if(!value) return "";
    const d=new Date(value);
    if(Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US",{
      year:"numeric",
      month:"short",
      day:"numeric"
    }).format(d);
  }

function reviewRpcUnavailable(error,name){
    const message=`${error?.message||""} ${error?.details||""}`.toLowerCase();
    return message.includes(String(name||"").toLowerCase()) ||
      message.includes("schema cache") ||
      message.includes("could not find the function");
  }

async function loadPublicReviews(){
    const {data,error}=await appContext.supabaseClient.rpc("get_public_reviews");
    if(error){
      if(appContext.reviewRpcUnavailable(error,"get_public_reviews")){
        appContext.reviewBackendState="missing";
      }else{
        console.error("Load public reviews error:",error);
        appContext.reviewBackendState="error";
      }
      appContext.publicReviews=[];
      return false;
    }

    appContext.reviewBackendState="ready";
    appContext.publicReviews=Array.isArray(data)?data:[];
    return true;
  }

async function loadOwnerReviewSubmissions(){
    if(!appContext.isOwnerMode()){
      appContext.ownerReviewSubmissions=[];
      return true;
    }

    const {data,error}=await appContext.supabaseClient.rpc("get_review_submissions");
    if(error){
      if(!appContext.reviewRpcUnavailable(error,"get_review_submissions")){
        console.error("Load review submissions error:",error);
      }
      appContext.ownerReviewSubmissions=[];
      return false;
    }

    appContext.ownerReviewSubmissions=Array.isArray(data)?data:[];
    return true;
  }

function approvedReviewSummary(){
    const rows=appContext.publicReviews;
    const count=rows.length;
    const average=count
      ? rows.reduce((sum,row)=>sum+Number(row.rating||0),0)/count
      : 0;
    const verified=rows.filter(row=>row.verified_buyer===true).length;
    return {count,average,verified};
  }

function reviewPublicCardHtml(review){
    const item=String(review.item_reference||"").trim();
    const country=appContext.reviewCountryLabel(review.country);
    return `
      <article class="review-card">
        <div class="review-card-top">
          <div>
            <div class="review-stars" aria-label="${appContext.escapeHtml(`${review.rating} out of 5 stars`)}">${appContext.reviewStars(review.rating)}</div>
            <div class="reviewer-line">
              <strong>${appContext.escapeHtml(review.display_name||"Collector")}</strong>
              ${review.verified_buyer ? `<span class="review-verified-badge">✓ Verified Buyer</span>` : ""}
            </div>
          </div>
          <time>${appContext.escapeHtml(appContext.reviewDateLabel(review.approved_at||review.created_at))}</time>
        </div>

        <p class="review-text">${appContext.escapeHtml(review.review_text||"")}</p>

        ${(item||country) ? `
          <div class="review-meta-row">
            ${item ? `<span>Item: ${appContext.escapeHtml(item)}</span>` : ""}
            ${country ? `<span>${appContext.escapeHtml(country)}</span>` : ""}
          </div>
        ` : ""}
      </article>
    `;
  }

function reviewModerationCardHtml(review){
    const status=String(review.status||"pending").toLowerCase();
    return `
      <article class="review-moderation-card" data-review-admin-card="${appContext.escapeHtml(review.id)}">
        <div class="review-moderation-head">
          <div>
            <div class="review-stars">${appContext.reviewStars(review.rating)}</div>
            <strong>${appContext.escapeHtml(review.display_name||"Collector")}</strong>
          </div>
          <span class="review-status review-status-${appContext.escapeHtml(status)}">${appContext.escapeHtml(status.toUpperCase())}</span>
        </div>

        <p>${appContext.escapeHtml(review.review_text||"")}</p>

        <div class="review-moderation-meta">
          ${review.item_reference ? `<span>Item: ${appContext.escapeHtml(review.item_reference)}</span>` : ""}
          ${review.country ? `<span>${appContext.escapeHtml(appContext.reviewCountryLabel(review.country))}</span>` : ""}
          <span>${appContext.escapeHtml(appContext.reviewDateLabel(review.created_at))}</span>
          ${review.verified_buyer ? `<span class="review-verified-badge">✓ Verified Buyer</span>` : ""}
        </div>

        <div class="review-moderation-actions">
          <button type="button" class="btn-primary" data-review-action="approve" data-review-id="${appContext.escapeHtml(review.id)}">Approve</button>
          <button type="button" class="btn-ghost" data-review-verified="${appContext.escapeHtml(review.id)}">
            ${review.verified_buyer ? "Remove Verified" : "Mark Verified"}
          </button>
          <button type="button" class="btn-ghost" data-review-action="hide" data-review-id="${appContext.escapeHtml(review.id)}">Hide</button>
          <button type="button" class="btn-ghost review-reject-btn" data-review-action="reject" data-review-id="${appContext.escapeHtml(review.id)}">Reject</button>
          <button type="button" class="btn-ghost review-delete-btn" data-review-delete="${appContext.escapeHtml(review.id)}">Delete</button>
        </div>
      </article>
    `;
  }

function reviewSubmitErrorMessage(code){
    const value=String(code||"").toLowerCase();
    const messages={
      "invalid_name":"Please enter a display name between 2 and 60 characters.",
      "invalid_rating":"Please choose a rating from 1 to 5 stars.",
      "invalid_review":"Please write a review between 10 and 500 characters.",
      "invalid_item":"The item / transaction reference is too long.",
      "invalid_country":"Please choose a valid country.",
      "link_not_allowed":"Please remove website links from the review text.",
      "pending_exists":"You already have a review waiting for approval.",
      "rate_limited":"We’ve already received a recent review. Please try again later.",
      "duplicate":"This looks like a duplicate review.",
      "owner_blocked":"Owner Mode cannot submit public reviews."
    };
    return messages[value] || "Could not submit the review. Please try again later.";
  }

async function submitPublicReview(form){
    const displayName=String(form.elements.display_name?.value||"").trim();
    const rating=Number(form.elements.rating?.value||0);
    const reviewText=String(form.elements.review_text?.value||"").trim();
    const itemReference=String(form.elements.item_reference?.value||"").trim();
    const country=String(form.elements.country?.value||"").trim();
    const honeypot=String(form.elements.website?.value||"").trim();

    // Bot honeypot: behave like a successful submission without sending data.
    if(honeypot){
      form.reset();
      appContext.showToast("Review submitted for moderation");
      return;
    }

    if(displayName.length<2 || displayName.length>appContext.REVIEW_NAME_MAX){
      appContext.showToast("Please enter a display name between 2 and 60 characters.");
      return;
    }
    if(!Number.isInteger(rating) || rating<1 || rating>5){
      appContext.showToast("Please choose a star rating.");
      return;
    }
    if(reviewText.length<appContext.REVIEW_TEXT_MIN || reviewText.length>appContext.REVIEW_TEXT_MAX){
      appContext.showToast(`Review must be ${appContext.REVIEW_TEXT_MIN}–${appContext.REVIEW_TEXT_MAX} characters.`);
      return;
    }
    if(/https?:\/\/|www\./i.test(reviewText)){
      appContext.showToast("Please remove website links from the review text.");
      return;
    }

    const submitBtn=form.querySelector('[type="submit"]');
    if(submitBtn){
      submitBtn.disabled=true;
      submitBtn.textContent="Submitting…";
    }

    try{
      const {data,error}=await appContext.supabaseClient.rpc("submit_review",{
        p_visitor_id:appContext.getVisitorId(),
        p_display_name:displayName,
        p_rating:rating,
        p_review_text:reviewText,
        p_item_reference:itemReference || null,
        p_country:country || "Other"
      });

      if(error){
        if(appContext.reviewRpcUnavailable(error,"submit_review")){
          appContext.reviewBackendState="missing";
          appContext.showToast("Reviews need the Supabase migration first");
        }else{
          console.error("Submit review error:",error);
          appContext.showToast("Could not submit review. Please try again later.");
        }
        return;
      }

      const result=Array.isArray(data) ? data[0] : data;
      if(!result?.success){
        appContext.showToast(appContext.reviewSubmitErrorMessage(result?.code));
        return;
      }

      form.reset();
      const ratingInput=form.querySelector('[name="rating"]');
      if(ratingInput) ratingInput.value="5";
      form.querySelectorAll("[data-review-star]").forEach(btn=>{
        btn.classList.toggle("active",Number(btn.dataset.reviewStar)<=5);
      });
      const count=appContext.$("reviewCharCount");
      if(count) count.textContent=`0 / ${appContext.REVIEW_TEXT_MAX}`;

      appContext.showToast("Review submitted — pending owner approval");
      const notice=appContext.$("reviewSubmitNotice");
      if(notice){
        notice.hidden=false;
        notice.textContent="Thank you. Your review is pending moderation and will not appear publicly until approved.";
      }
    }finally{
      if(submitBtn){
        submitBtn.disabled=false;
        submitBtn.textContent="Submit Review";
      }
    }
  }

async function moderateReview(id,action){
    if(!appContext.requireOwner("moderate reviews")) return;

    const row=appContext.ownerReviewSubmissions.find(item=>String(item.id)===String(id));
    if(!row) return;

    const {data,error}=await appContext.supabaseClient.rpc("moderate_review",{
      p_review_id:Number(id),
      p_action:String(action||""),
      p_verified:null
    });

    if(error){
      console.error("Moderate review error:",error);
      appContext.showToast("Could not update review");
      return;
    }

    appContext.showToast(
      action==="approve" ? "Review approved" :
      action==="reject" ? "Review rejected" :
      action==="hide" ? "Review hidden" :
      "Review updated"
    );
    await appContext.renderReviewsPage();
  }

async function toggleReviewVerified(id){
    if(!appContext.requireOwner("verify reviews")) return;

    const row=appContext.ownerReviewSubmissions.find(item=>String(item.id)===String(id));
    if(!row) return;

    const {error}=await appContext.supabaseClient.rpc("moderate_review",{
      p_review_id:Number(id),
      p_action:String(row.status||"pending"),
      p_verified:!row.verified_buyer
    });

    if(error){
      console.error("Verify review error:",error);
      appContext.showToast("Could not update Verified Buyer status");
      return;
    }

    appContext.showToast(row.verified_buyer ? "Verified Buyer removed" : "Marked as Verified Buyer");
    await appContext.renderReviewsPage();
  }

async function deleteReviewSubmission(id){
    if(!appContext.requireOwner("delete reviews")) return;

    const row=appContext.ownerReviewSubmissions.find(item=>String(item.id)===String(id));
    if(!row) return;

    const preview=String(row.review_text||"").trim().slice(0,80);
    const ok=confirm(
      `Permanently delete this review from ${row.display_name||"this reviewer"}?\n\n` +
      `${preview}${String(row.review_text||"").length>80?"…":""}\n\n` +
      `This cannot be undone.`
    );
    if(!ok) return;

    const {data,error}=await appContext.supabaseClient.rpc("delete_review",{
      p_review_id:Number(id)
    });

    if(error){
      console.error("Delete review error:",error);
      appContext.showToast("Could not delete review");
      return;
    }

    if(data!==true){
      appContext.showToast("Review was not deleted");
      return;
    }

    appContext.showToast("Review permanently deleted");
    await appContext.renderReviewsPage();
  }

function bindReviewPageEvents(){
    appContext.$("writeReviewBtn")?.addEventListener("click",()=>{
      const panel=appContext.$("reviewSubmitPanel");
      if(!panel) return;
      panel.scrollIntoView({behavior:"smooth",block:"start"});
      setTimeout(()=>{
        panel.querySelector('input[name="display_name"]')?.focus({preventScroll:true});
      },350);
    });

    const form=appContext.$("reviewSubmitForm");
    if(form){
      const ratingInput=form.querySelector('[name="rating"]');
      form.querySelectorAll("[data-review-star]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const value=Number(btn.dataset.reviewStar||0);
          if(ratingInput) ratingInput.value=String(value);
          form.querySelectorAll("[data-review-star]").forEach(star=>{
            star.classList.toggle("active",Number(star.dataset.reviewStar)<=value);
          });
        });
      });

      const reviewText=form.elements.review_text;
      const count=appContext.$("reviewCharCount");
      reviewText?.addEventListener("input",()=>{
        if(count) count.textContent=`${reviewText.value.length} / ${appContext.REVIEW_TEXT_MAX}`;
      });

      form.addEventListener("submit",event=>{
        event.preventDefault();
        appContext.submitPublicReview(form);
      });
    }

    appContext.view.querySelectorAll("[data-review-action]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        appContext.moderateReview(btn.dataset.reviewId,btn.dataset.reviewAction);
      });
    });

    appContext.view.querySelectorAll("[data-review-verified]").forEach(btn=>{
      btn.addEventListener("click",()=>appContext.toggleReviewVerified(btn.dataset.reviewVerified));
    });

    appContext.view.querySelectorAll("[data-review-delete]").forEach(btn=>{
      btn.addEventListener("click",()=>appContext.deleteReviewSubmission(btn.dataset.reviewDelete));
    });
  }

async function renderReviewsPage(){
    appContext.view.innerHTML=`
      <div class="page-head">
        <div>
          <div class="eyebrow">Collector feedback</div>
          <h2>Reviews</h2>
          <p>Feedback from collectors who have dealt with Collect TCG MY &amp; SG.</p>
        </div>
      </div>
      <div class="review-loading panel">Loading reviews…</div>
    `;

    await Promise.all([
      appContext.loadPublicReviews(),
      appContext.loadOwnerReviewSubmissions()
    ]);

    if(appContext.currentRoute()!=="reviews") return;

    const summary=appContext.approvedReviewSummary();
    const pendingCount=appContext.ownerReviewSubmissions.filter(row=>String(row.status)==="pending").length;

    appContext.view.innerHTML=`
      <div class="page-head review-page-head">
        <div>
          <div class="eyebrow">Collector feedback</div>
          <h2>Reviews</h2>
          <p>Feedback from collectors who have dealt with Collect TCG MY &amp; SG.</p>
        </div>
        <button type="button" class="btn-ghost" id="writeReviewBtn">Write a Review</button>
      </div>

      ${appContext.reviewBackendState==="missing" ? `
        <div class="review-setup-warning owner-only">
          <strong>Reviews backend not installed.</strong>
          <span>Run the secure Reviews Supabase migration before accepting submissions.</span>
        </div>
      ` : ""}

      <section class="review-summary-panel">
        <div class="review-summary-score">
          <strong>${summary.count ? summary.average.toFixed(1) : "—"}</strong>
          <div>
            <div class="review-stars review-stars-large">${summary.count ? appContext.reviewStars(Math.round(summary.average)) : "☆☆☆☆☆"}</div>
            <span>${summary.count} approved review${summary.count===1?"":"s"}</span>
          </div>
        </div>
        <div class="review-summary-stat">
          <strong>${summary.verified}</strong>
          <span>Verified Buyer review${summary.verified===1?"":"s"}</span>
        </div>
        <div class="review-summary-trust">
          <strong>Review Protection</strong>
          <span>Reviews are checked before publishing.</span>
        </div>
      </section>

      <div class="reviews-public-layout">
        <section class="reviews-list-panel">
          <div class="reviews-section-head">
            <div>
              <h3>Collector Reviews</h3>
            </div>
            <span>${summary.count}</span>
          </div>

          <div class="reviews-list">
            ${appContext.publicReviews.length
              ? appContext.publicReviews.map(appContext.reviewPublicCardHtml).join("")
              : `<div class="reviews-empty">No approved reviews yet. Be the first to share your experience.</div>`}
          </div>
        </section>

        <aside class="review-submit-panel" id="reviewSubmitPanel">
          <div class="review-submit-head">
            <div class="eyebrow">Share your experience</div>
            <h3>Write a Review</h3>
            <p>Reviews are checked for spam and relevance before they appear publicly.</p>
          </div>

          <form id="reviewSubmitForm" novalidate>
            <div class="review-form-grid">
              <label class="field">
                <span>Display name</span>
                <input name="display_name"
                       maxlength="${appContext.REVIEW_NAME_MAX}"
                       autocomplete="name"
                       required
                       placeholder="e.g. Alex T.">
              </label>

              <label class="field">
                <span>Country</span>
                <select name="country">
                  ${appContext.reviewCountryOptions()}
                </select>
              </label>
            </div>

            <div class="field review-rating-field">
              <span>Rating</span>
              <input type="hidden" name="rating" value="5">
              <div class="review-star-picker" role="group" aria-label="Choose rating">
                ${[1,2,3,4,5].map(n=>`
                  <button type="button"
                          class="active"
                          data-review-star="${n}"
                          aria-label="${n} star${n===1?"":"s"}">★</button>
                `).join("")}
              </div>
            </div>

            <label class="field">
              <span>Item / transaction reference <small>(optional)</small></span>
              <input name="item_reference"
                     maxlength="${appContext.REVIEW_ITEM_MAX}"
                     autocomplete="off"
                     placeholder="e.g. OP trophy card / COD in KL">
            </label>

            <label class="field">
              <span>Your review</span>
              <textarea name="review_text"
                        minlength="${appContext.REVIEW_TEXT_MIN}"
                        maxlength="${appContext.REVIEW_TEXT_MAX}"
                        rows="6"
                        required
                        placeholder="Tell other collectors about your experience."></textarea>
              <div class="review-text-meta">
                <span>No website links or promotional content.</span>
                <span id="reviewCharCount">0 / ${appContext.REVIEW_TEXT_MAX}</span>
              </div>
            </label>

            <label class="review-confirm">
              <input type="checkbox" required>
              <span>I confirm this review reflects my own experience with Collect TCG MY &amp; SG.</span>
            </label>

            <label class="review-honeypot" aria-hidden="true">
              Website
              <input name="website" tabindex="-1" autocomplete="off">
            </label>

            <button type="submit" class="btn-primary review-submit-btn" ${appContext.reviewBackendState==="missing"?"disabled":""}>
              Submit Review
            </button>

            <p class="review-moderation-note">
              Reviews may be moderated for spam, abusive content, duplicates, or unrelated content. Genuine positive and negative feedback is welcome.
            </p>
            <div class="review-submit-notice" id="reviewSubmitNotice" hidden></div>
          </form>
        </aside>
      </div>

      <section class="review-owner-panel owner-only">
        <div class="reviews-section-head">
          <div>
            <div class="eyebrow">Owner moderation</div>
            <h3>Review Management</h3>
            <p>Approve genuine reviews, reject spam, or mark confirmed buyers as verified.</p>
          </div>
          <span>${pendingCount} pending</span>
        </div>

        <div class="review-owner-stats">
          ${["pending","approved","hidden","rejected"].map(status=>{
            const count=appContext.ownerReviewSubmissions.filter(row=>String(row.status)===status).length;
            return `<div><strong>${count}</strong><span>${status}</span></div>`;
          }).join("")}
        </div>

        <div class="review-moderation-list">
          ${appContext.ownerReviewSubmissions.length
            ? appContext.ownerReviewSubmissions.map(appContext.reviewModerationCardHtml).join("")
            : `<div class="reviews-empty">No review submissions yet.</div>`}
        </div>
      </section>
    `;

    appContext.bindReviewPageEvents();
    appContext.applyOwnerMode();
  }

  Object.assign(appContext,{reviewStars,reviewCountryLabel,reviewCountryOptions,reviewDateLabel,reviewRpcUnavailable,loadPublicReviews,loadOwnerReviewSubmissions,approvedReviewSummary,reviewPublicCardHtml,reviewModerationCardHtml,reviewSubmitErrorMessage,submitPublicReview,moderateReview,toggleReviewVerified,deleteReviewSubmission,bindReviewPageEvents,renderReviewsPage});
}
