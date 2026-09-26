/** V93 beta: features/content/information. Shared dependencies are explicit on appContext. */
export function register(appContext){
function renderAboutPage(){
    appContext.view.innerHTML = `
      <div class="page-head information-page-head">
        <div>
          <div class="eyebrow">About us</div>
          <h2>SoonSoonTCG</h2>
          <p>Collect. Trade. Connect.</p>
        </div>
      </div>

      <div class="panel about-panel information-page-panel" style="max-width:820px;">
        <h3>Who We Are</h3>
        <div class="about-copy">
          <p>Welcome to <b>SoonSoonTCG</b>! We are dedicated trading card collectors and vendors based in Singapore, specializing in rare collectibles, vintage cards, tournament prize cards, graded grails, and premium cards across Pokémon, One Piece, and other collectible card games.</p>

          <p>Please note that we operate online and are committed to providing smooth, transparent, and trustworthy transactions for collectors worldwide.</p>

          <p>While we strive to keep our social and Carousell posts up to date, pricing and availability may occasionally change. In the event of any discrepancy, please refer to our listings here on the website for the latest real-time information.</p>
        </div>

        <h3 class="about-subhead">Browse Our Platforms &amp; Connect</h3>
        <div class="about-links">
          <a class="about-link" href="https://wa.me/6581805946" target="_blank" rel="noopener noreferrer">
            <span><b>💬 WhatsApp</b><small>+65 8180 5946</small></span><span>↗</span>
          </a>
          <a class="about-link" href="https://www.carousell.sg/u/xsoonx/" target="_blank" rel="noopener noreferrer">
            <span><b>🇸🇬 Carousell Singapore</b><small>@xsoonx</small></span><span>↗</span>
          </a>
          <a class="about-link" href="https://www.facebook.com/darren.tehkoksoon" target="_blank" rel="noopener noreferrer">
            <span><b>Facebook</b><small>SoonSoonTCG</small></span><span>↗</span>
          </a>
        </div>

        <h3 class="about-subhead">🌏 Worldwide Shipping &amp; Delivery</h3>
        <div class="about-copy">
          <p><b>Worldwide shipping is available.</b> Shipping costs and insurance fees will be borne by the buyer. Shipping insurance is optional, but strongly recommended for higher-value shipments. Cards will be packed securely with top-tier protective packaging, and a video of the packing process can be provided for buyer peace of mind. A tracking number will be provided once your package is shipped.</p>
          <p>For high-value items, Cash on Delivery (COD) / self-collection in Singapore is available. Please contact us before purchase via WhatsApp or Carousell to discuss payment, delivery, and packing arrangements.</p>
        </div>

        <h3 class="about-subhead">COD / Meetup Rules</h3>
        <ol class="cod-rules">
          <li>COD / face-to-face transactions are available in Singapore at agreed meetup locations.</li>
          <li>Final price must be agreed upon before the meetup. No last-minute price negotiations at meetup.</li>
          <li>Please be punctual. A grace period of up to 15 minutes will be given.</li>
          <li>Items will only be reserved upon confirmation from the buyer.</li>
          <li>The buyer is welcome to inspect the card during the meetup before making payment.</li>
          <li>Payment must be made during the meetup via instant PayNow / bank transfer.</li>
        </ol>
      </div>`;
  }

function renderContactPage(){
    appContext.view.innerHTML = `
      <div class="page-head information-page-head">
        <div>
          <div class="eyebrow">Get in touch</div>
          <h2>Contact</h2>
          <p>Follow SoonSoonTCG or contact us directly through any of our official channels.</p>
        </div>
      </div>
      <div class="panel contact-panel information-page-panel" style="max-width:680px;">
        <h3>SoonSoonTCG</h3>
        <div class="contact-links">
          <a class="contact-link" href="https://wa.me/6581805946" target="_blank" rel="noopener noreferrer">
            <span>WhatsApp (+65 8180 5946)</span><span class="contact-arrow">↗</span>
          </a>
          <a class="contact-link" href="https://www.carousell.sg/u/xsoonx/" target="_blank" rel="noopener noreferrer">
            <span>Carousell (@xsoonx)</span><span class="contact-arrow">↗</span>
          </a>
          <a class="contact-link" href="https://www.facebook.com/darren.tehkoksoon" target="_blank" rel="noopener noreferrer">
            <span>Facebook</span><span class="contact-arrow">↗</span>
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
    carousellShopUrl:"https://www.carousell.sg/u/xsoonx/",
    facebookUrl:"https://www.facebook.com/darren.tehkoksoon",
    whatsappUrl:"https://wa.me/6581805946",
    hashtags:"#tcg #pokemon #onepiece #onepiecetcg #SoonSoonTCG #TCGCollector"
  });
}
