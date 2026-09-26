/** V93 beta: features/content/information. Shared dependencies are explicit on appContext. */
export function register(appContext){
function renderAboutPage(){
    appContext.view.innerHTML = `
      <div class="page-head information-page-head">
        <div>
          <div class="eyebrow">About us</div>
          <h2>Collect TCG MY & SG</h2>
          <p>Collect. Trade. Connect.</p>
        </div>
      </div>

      <div class="panel about-panel information-page-panel" style="max-width:820px;">
        <h3>Who We Are</h3>
        <div class="about-copy">
          <p>We are a group of friends and dedicated One Piece Trading Card Game collectors based in Malaysia and Singapore, specializing in rare collectibles, vintage cards, tournament prize cards, and premium grails. While One Piece is our primary focus, we occasionally list cards and collectibles from other TCGs from our personal collections as well.</p>

          <p>Please note that we do not operate a physical storefront and are not accepting consignment items at this time.</p>

          <p>While we strive to keep our Facebook/Carousell posts up to date, pricing and availability may occasionally change. In the event of any discrepancy, please refer to our listings here for the latest information.</p>
        </div>

        <h3 class="about-subhead">Browse Our Collection</h3>
        <div class="about-links">
          <a class="about-link" href="https://www.carousell.com.my/u/collect_tcg_my_sg/" target="_blank" rel="noopener noreferrer">
            <span><b>🇲🇾 Carousell Malaysia</b><small>collect_tcg_my_sg</small></span><span>↗</span>
          </a>
          <a class="about-link" href="https://www.carousell.sg/u/collect_tcg_sg/" target="_blank" rel="noopener noreferrer">
            <span><b>🇸🇬 Carousell Singapore</b><small>collect_tcg_sg</small></span><span>↗</span>
          </a>
          <a class="about-link" href="https://www.instagram.com/collecttcg.mysg/" target="_blank" rel="noopener noreferrer">
            <span><b>📸 Instagram</b><small>@collecttcg.mysg</small></span><span>↗</span>
          </a>
          <a class="about-link" href="https://www.facebook.com/profile.php?id=61590041416102" target="_blank" rel="noopener noreferrer">
            <span><b>Facebook</b><small>Collect TCG MY &amp; SG</small></span><span>↗</span>
          </a>
        </div>

        <h3 class="about-subhead">🌏 Worldwide Shipping &amp; High-Value Delivery</h3>
        <div class="about-copy">
          <p><b>Worldwide shipping is available.</b> Shipping costs and insurance fees will be borne by the buyer. Shipping insurance is optional, but strongly recommended for higher-value shipments. Cards will be packed securely, and a video of the packing process will be provided for buyer's peace of mind. A tracking number will be provided once your package has been shipped.</p>
          <p>For items above <b>USD 6,000</b>, Cash on Delivery (COD) in Malaysia or Singapore is preferred, depending on the specific card. Secure international shipping may also be considered case by case—please contact us before purchase to discuss payment, delivery, insurance and packing arrangements. Please note that we cannot be held responsible for any loss, damage, or issues that may occur during transit once the package has been shipped.</p>
        </div>

        <h3 class="about-subhead">COD Rules</h3>
        <ol class="cod-rules">
          <li>COD / face-to-face transactions are available in Malaysia or Singapore, depending on the item and agreed meetup location. <b>Weekends only.</b></li>
          <li>Final price must be agreed upon before the meetup. No changes will be accepted during the transaction.</li>
          <li>If a buyer fails to show up after confirming the deal, future transactions with that party will not be accepted.</li>
          <li>Please be punctual. A grace period of up to 15 minutes will be given; after that, the meetup may be cancelled.</li>
          <li>Items will only be reserved upon confirmation from the buyer.</li>
          <li>The buyer is allowed to inspect the item during the meetup before making payment.</li>
          <li>Payment must be made during the meetup via instant bank transfer.</li>
          <li>For both buyer and seller protection, a photo of the item together with the bank transfer receipt/payment proof will be taken upon completion of the transaction to avoid any future disputes.</li>
        </ol>
      </div>`;
  }

function renderContactPage(){
    appContext.view.innerHTML = `
      <div class="page-head information-page-head">
        <div>
          <div class="eyebrow">Get in touch</div>
          <h2>Contact</h2>
          <p>Follow Collect TCG MY & SG or contact us through our official pages.</p>
        </div>
      </div>
      <div class="panel contact-panel information-page-panel" style="max-width:680px;">
        <h3>Collect TCG MY & SG</h3>
        <div class="contact-links">
          <a class="contact-link" href="https://m.me/61590041416102" target="_blank" rel="noopener noreferrer">
            <span>Facebook Messenger</span><span class="contact-arrow">↗</span>
          </a>
          <a class="contact-link" href="https://www.instagram.com/collecttcg.mysg" target="_blank" rel="noopener noreferrer">
            <span>Instagram</span><span class="contact-arrow">↗</span>
          </a>
          <a class="contact-link" href="https://www.carousell.com.my/u/collect_tcg_my_sg/" target="_blank" rel="noopener noreferrer">
            <span>Carousell Malaysia</span><span class="contact-arrow">↗</span>
          </a>
          <a class="contact-link" href="https://www.carousell.sg/u/collect_tcg_sg/" target="_blank" rel="noopener noreferrer">
            <span>Carousell Singapore</span><span class="contact-arrow">↗</span>
          </a>
        </div>
      </div>`;
  }

  Object.assign(appContext,{renderAboutPage,renderContactPage});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.FB_POST_PREFS_KEY = "collect_tcg_fb_post_prefs_v1";

  appContext.FB_POST_CARD_META_KEY = "collect_tcg_fb_post_card_meta_v1";

  appContext.FB_POST_DEFAULTS = Object.freeze({
    carousellShopUrl:"https://www.carousell.com.my/u/collect_tcg_my_sg/",
    instagramUrl:"https://www.instagram.com/collecttcg.mysg",
    hashtags:"#tcg #onepiece #onepiecetcg #onepiececardgame #TCGCollector"
  });
}
