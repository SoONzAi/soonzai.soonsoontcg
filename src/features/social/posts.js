/** V93 beta: features/social/posts. Shared dependencies are explicit on appContext. */
export function register(appContext){
function compactGeneratedPostSpacing(value){
    const lines=String(value||"")
      .replace(/\r\n?/g,"\n")
      .split("\n")
      .map(line=>line.replace(/[ \t]+$/g,""));

    const isHeader=line=>{
      const s=String(line||"").trim();
      return /^\([^)]{2,80}\)$/.test(s) ||
        /^【.+】$/.test(s) ||
        /^\[[^\]]+\]$/.test(s) ||
        /^(SOCIALS|HASHTAG\s*:|VIEW MORE OF OUR PRODUCTS\s*:|OTHER PRODUCTS INFO)$/i.test(s);
    };
    const isUrl=line=>/^https?:\/\/\S+$/i.test(String(line||"").trim());
    const isCompact=line=>/^(📩|💰|👥|📍|❌|Instagram:|Facebook:|Carousell Malaysia:|Carousell Singapore:|PRICE\s*:|-【)/i.test(String(line||"").trim());

    const out=[];
    for(const raw of lines){
      const line=raw.trim();
      if(!line){
        if(out.length && out[out.length-1]!=="") out.push("");
        continue;
      }
      if(out.length && out[out.length-1]===""){
        const prev=out[out.length-2]||"";
        if(
          (isHeader(prev) && (isUrl(line)||isCompact(line))) ||
          (isUrl(prev) && isCompact(line)) ||
          (isCompact(prev) && isCompact(line))
        ){
          out.pop();
        }
      }
      out.push(line);
    }

    return out.join("\n")
      .replace(/\n{3,}/g,"\n\n")
      .replace(/\n\n(━{4,})/g,"\n$1")
      .replace(/(━{4,})\n\n/g,"$1\n")
      .trim();
  }

  // One language choice is shared by every generator.  Card metadata and
  // editable fields deliberately remain as entered: translating those could
  // obscure a card's actual printing language or change a seller's wording.
  const POST_LANGUAGE_OPTIONS=Object.freeze([
    ["en","English"],
    ["ms","Bahasa Melayu"],
    ["zh","中文（简体）"],
    ["ja","日本語"],
    ["ko","한국어"]
  ]);

  function normalizePostLanguage(value){
    return POST_LANGUAGE_OPTIONS.some(([code])=>code===value) ? value : "en";
  }

  function getPostGeneratorLanguage(){
    try{return normalizePostLanguage(appContext.localStorage.getItem(appContext.POST_GENERATOR_LANGUAGE_KEY));}
    catch{return "en";}
  }

  function savePostGeneratorLanguage(value){
    const language=normalizePostLanguage(value);
    try{appContext.localStorage.setItem(appContext.POST_GENERATOR_LANGUAGE_KEY,language);}catch{}
    return language;
  }

  function postLanguageSelectHTML(id,selected){
    const language=normalizePostLanguage(selected);
    return `
      <div class="field post-language-field">
        <label for="${id}">Post language</label>
        <select id="${id}">
          ${POST_LANGUAGE_OPTIONS.map(([code,label])=>`<option value="${code}" ${code===language?"selected":""}>${label}</option>`).join("")}
        </select>
        <div class="hint">Changes all generated template wording. Card language, titles and any details you edit stay exactly as entered.</div>
      </div>`;
  }

  function postLocale(value){
    const language=normalizePostLanguage(value);
    const locales={
      en:{
        priceRefer:"PRICE : PLEASE REFER TO OUR WEBSITE",
        nfs:"🚫 NOT FOR SALE — PERSONAL COLLECTION",
        collectionCta:"🌐 VISIT OUR WEBSITE TO SEE MORE FROM OUR COLLECTION:",
        cardDrop:"✨ CARD DROP",
        cardList:"‼️ CARD LIST ‼️",
        moreCards:"More cards are available beyond this drop.",
        browseInventory:"Browse the full inventory:",
        inventory:"AVAILABLE INVENTORY",
        graded:"𝐆𝐑𝐀𝐃𝐄𝐃 𝐒𝐋𝐀𝐁𝐒", raw:"𝐑𝐀𝐖 𝐒𝐈𝐍𝐆𝐋𝐄𝐒", sealed:"𝐒𝐄𝐀𝐋𝐄𝐃 𝐏𝐑𝐎𝐃𝐔𝐂𝐓𝐒",
        dm:"📩 DM your offer if interested", serious:"💰 Serious buyers only", meetup:"👥 Can discuss meetup location", located:"📍 Located in KL 🇲🇾 / SG 🇸🇬", lowball:"❌ No lowball offers",
        cod:"📍 COD / MEETUP: MALAYSIA OR SINGAPORE, DEPENDING ON THE ITEM",
        shippingTitle:"🌏 INTERNATIONAL SHIPPING — BELOW USD 6,000 ONLY",
        shipping:"International shipping is available only for items valued below USD 6,000. Shipping costs and insurance fees will be borne by the buyer. Shipping insurance is optional, but strongly recommended for higher-value shipments. Cards will be packed securely, and a video of the packing process will be provided for buyer's peace of mind. A tracking number will be provided once your package has been shipped. For cards priced above USD 6,000, Cash on Delivery (COD) in Malaysia or Singapore is preferred, depending on the specific card. Please note that we cannot be held responsible for any loss, damage, or issues that may occur during transit once the package has been shipped.",
        winnerAnnouncement:"GIVEAWAY WINNER{plural} ANNOUNCEMENT", results:"The results are in!", congratulations:"Congratulations to:", prize:"Prize", winnerThanks:"Thank you very much to everyone who joined our giveaway and supported Collect TCG MY & SG.", winnerSupport:"We appreciate every follow, like, share, and comment. There will be more giveaways in the future, so keep an eye out for the next one 👀", winnerEnd:"Congratulations once again to {target}! 🎊",
        howToEnter:"📌 HOW TO ENTER:", followFacebook:"FOLLOW our Facebook Page", followInstagram:"FOLLOW our Instagram", comment:"COMMENT on the giveaway post", visitCode:"VISIT our website and find the Giveaway Code", submit:"SUBMIT your entry here", important:"‼️ IMPORTANT:", eligible:"Only participants who complete all required steps will be eligible for the draw.", contactWinner:"📩 HOW THE WINNER WILL BE CONTACTED:", contactWinnerText:"Facebook Pages cannot send the first message to personal accounts. We will reply to the winner’s comment, and the winner must PM our Facebook Page within {hours} hours to claim the prize.", bonus:"⭐ EXTRA ACTIONS / BONUS ENTRIES:", joinGroup:"➕ +1 BONUS: Join our Facebook Group", shareFacebook:"➕ +1 BONUS: Share this Facebook post publicly", tagFriends:"➕ +1 BONUS: Tag 2 friends", shareStory:"➕ +1 BONUS: Share to your IG Story and tag @collecttcg.mysg", groups:"📢 IMPORTANT:", groupsText:"This giveaway post has been shared across multiple groups. All eligible entries from every group will be combined into one single pool for the final draw.", selection:"🎲 WINNER SELECTION:", selectionText:"The winner will be selected randomly using {tool}.", verification:"🔎 WINNER VERIFICATION:", verificationText:"When the winner is announced, we will also include the winner’s Facebook profile URL for transparency and verification purposes.", luck:"🍀 GOOD LUCK, EVERYONE!", ends:"🗓️ GIVEAWAY ENDS", postage:"📦 Postage", explore:"EXPLORE MORE FROM COLLECT TCG",
        carousellNoTrade:"NO TRADE, ONLY SELL", productDetails:"[Product Details]", caution:"[Caution]", importantNotes:"[Important Notes]", codRules:"[COD Rules]"
      },
      ms:{
        priceRefer:"HARGA: SILA RUJUK LAMAN WEB KAMI", nfs:"🚫 BUKAN UNTUK DIJUAL — KOLEKSI PERIBADI", collectionCta:"🌐 LAWATI LAMAN WEB KAMI UNTUK MELIHAT LEBIH BANYAK KOLEKSI:", cardDrop:"✨ JATUHAN KAD", cardList:"‼️ SENARAI KAD ‼️", moreCards:"Lebih banyak kad tersedia selain pilihan ini.", browseInventory:"Lihat inventori penuh:", inventory:"INVENTORI TERSEDIA", graded:"𝐊𝐀𝐃 𝐁𝐄𝐑𝐆𝐑𝐀𝐃", raw:"𝐊𝐀𝐃 𝐌𝐄𝐍𝐓𝐀𝐇", sealed:"𝐏𝐑𝐎𝐃𝐔𝐊 𝐁𝐄𝐑𝐒𝐄𝐆𝐄𝐋", dm:"📩 Hantar DM tawaran anda jika berminat", serious:"💰 Pembeli serius sahaja", meetup:"👥 Lokasi pertemuan boleh dibincangkan", located:"📍 Berada di KL 🇲🇾 / SG 🇸🇬", lowball:"❌ Tiada tawaran melampau rendah", cod:"📍 COD / TEMU JANJI: MALAYSIA ATAU SINGAPURA, BERGANTUNG PADA ITEM", shippingTitle:"🌏 PENGHANTARAN ANTARABANGSA — BAWAH USD 6,000 SAHAJA", shipping:"Penghantaran antarabangsa hanya tersedia untuk item bernilai di bawah USD 6,000. Kos penghantaran dan insurans ditanggung pembeli. Insurans penghantaran adalah pilihan tetapi amat disyorkan untuk item bernilai tinggi. Kad akan dibungkus dengan selamat dan video proses pembungkusan akan diberikan. Nombor penjejakan akan diberikan selepas penghantaran. Untuk kad melebihi USD 6,000, COD di Malaysia atau Singapura adalah pilihan utama. Selepas item dihantar, kami tidak bertanggungjawab atas kehilangan, kerosakan atau isu semasa transit.", winnerAnnouncement:"PENGUMUMAN PEMENANG GIVEAWAY{plural}", results:"Keputusan telah diumumkan!", congratulations:"Tahniah kepada:", prize:"Hadiah", winnerThanks:"Terima kasih kepada semua yang menyertai giveaway kami dan menyokong Collect TCG MY & SG.", winnerSupport:"Kami menghargai setiap follow, like, share dan komen. Akan ada lebih banyak giveaway pada masa akan datang, jadi nantikan yang seterusnya 👀", winnerEnd:"Tahniah sekali lagi kepada {target}! 🎊", howToEnter:"📌 CARA PENYERTAAN:", followFacebook:"IKUTI Halaman Facebook kami", followInstagram:"IKUTI Instagram kami", comment:"TINGGALKAN KOMEN pada pos giveaway", visitCode:"LAWATI laman web kami dan cari Kod Giveaway", submit:"HANTAR penyertaan anda di sini", important:"‼️ PENTING:", eligible:"Hanya peserta yang melengkapkan semua langkah diperlukan layak untuk cabutan.", contactWinner:"📩 CARA PEMENANG AKAN DIHUBUNGI:", contactWinnerText:"Halaman Facebook tidak boleh menghantar mesej pertama kepada akaun peribadi. Kami akan membalas komen pemenang dan pemenang perlu PM Halaman Facebook kami dalam {hours} jam untuk menuntut hadiah.", bonus:"⭐ TINDAKAN TAMBAHAN / PENYERTAAN BONUS:", joinGroup:"➕ BONUS +1: Sertai Kumpulan Facebook kami", shareFacebook:"➕ BONUS +1: Kongsi pos Facebook ini secara umum", tagFriends:"➕ BONUS +1: Tag 2 rakan", shareStory:"➕ BONUS +1: Kongsi ke IG Story dan tag @collecttcg.mysg", groups:"📢 PENTING:", groupsText:"Pos giveaway ini dikongsi dalam beberapa kumpulan. Semua penyertaan yang layak akan digabungkan dalam satu cabutan akhir.", selection:"🎲 PEMILIHAN PEMENANG:", selectionText:"Pemenang akan dipilih secara rawak menggunakan {tool}.", verification:"🔎 PENGESAHAN PEMENANG:", verificationText:"Apabila pemenang diumumkan, URL profil Facebook pemenang juga akan disertakan untuk ketelusan dan pengesahan.", luck:"🍀 SEMOGA BERJAYA!", ends:"🗓️ GIVEAWAY TAMAT", postage:"📦 Pos", explore:"TEROKAI LEBIH BANYAK DARIPADA COLLECT TCG", carousellNoTrade:"TIADA TRADE, JUAL SAHAJA", productDetails:"[Butiran Produk]", caution:"[Perhatian]", importantNotes:"[Nota Penting]", codRules:"[Peraturan COD]"
      },
      zh:{
        priceRefer:"价格：请参考我们的网站", nfs:"🚫 非卖品 — 个人收藏", collectionCta:"🌐 浏览我们的网站，查看更多收藏：", cardDrop:"✨ 卡牌上新", cardList:"‼️ 卡牌清单 ‼️", moreCards:"除本次上新外，还有更多卡牌可供选择。", browseInventory:"浏览完整库存：", inventory:"现货库存", graded:"𝐏𝐒𝐀／评级卡", raw:"𝐔𝐍𝐆𝐑𝐀𝐃𝐄𝐃／裸卡", sealed:"𝐌𝐈𝐍𝐓／密封产品", dm:"📩 如有兴趣，请私信报价", serious:"💰 仅限诚意买家", meetup:"👥 可讨论见面地点", located:"📍 位于吉隆坡 🇲🇾 / 新加坡 🇸🇬", lowball:"❌ 谢绝过低报价", cod:"📍 COD / 面交：马来西亚或新加坡，视商品而定", shippingTitle:"🌏 国际运输 — 仅限低于 USD 6,000 的商品", shipping:"国际运输仅适用于价值低于 USD 6,000 的商品。运费和保险费由买方承担。运输保险为可选项目，但强烈建议高价值商品购买。卡牌将安全包装，并提供包装过程视频。发货后会提供追踪号码。价值高于 USD 6,000 的卡牌优先在马来西亚或新加坡 COD。商品发出后，运输过程中产生的遗失、损坏或问题恕不负责。", winnerAnnouncement:"抽奖中奖者公告{plural}", results:"结果已经揭晓！", congratulations:"恭喜以下得奖者：", prize:"奖品", winnerThanks:"感谢所有参加抽奖并支持 Collect TCG MY & SG 的朋友。", winnerSupport:"我们感谢每一次关注、点赞、分享和评论。未来还会有更多抽奖，请继续关注 👀", winnerEnd:"再次恭喜{target}！🎊", howToEnter:"📌 参与方式：", followFacebook:"关注我们的 Facebook 专页", followInstagram:"关注我们的 Instagram", comment:"在抽奖贴文留言", visitCode:"访问我们的网站并寻找抽奖代码", submit:"在此提交报名", important:"‼️ 重要：", eligible:"只有完成所有必要步骤的参与者才有资格参加抽奖。", contactWinner:"📩 联系中奖者的方式：", contactWinnerText:"Facebook 专页无法主动向个人账号发送第一条消息。我们会回复中奖者的评论，中奖者必须在 {hours} 小时内私信我们的 Facebook 专页领取奖品。", bonus:"⭐ 额外行动 / 奖励次数：", joinGroup:"➕ +1 奖励：加入我们的 Facebook 群组", shareFacebook:"➕ +1 奖励：公开分享此 Facebook 贴文", tagFriends:"➕ +1 奖励：标记 2 位朋友", shareStory:"➕ +1 奖励：分享到 IG Story 并标记 @collecttcg.mysg", groups:"📢 重要：", groupsText:"此抽奖贴文已分享到多个群组。所有符合资格的报名将合并到同一个最终抽奖池。", selection:"🎲 中奖者选择：", selectionText:"中奖者将使用 {tool} 随机选出。", verification:"🔎 中奖者核实：", verificationText:"公布中奖者时，我们也会附上其 Facebook 个人资料链接，以便公开透明和核实。", luck:"🍀 祝大家好运！", ends:"🗓️ 抽奖截止", postage:"📦 邮寄", explore:"探索更多 COLLECT TCG 商品", carousellNoTrade:"不接受交换，仅出售", productDetails:"[商品详情]", caution:"[注意事项]", importantNotes:"[重要说明]", codRules:"[COD 规则]"
      },
      ja:{
        priceRefer:"価格：ウェブサイトをご確認ください", nfs:"🚫 非売品 — 個人コレクション", collectionCta:"🌐 ウェブサイトでコレクションをもっと見る：", cardDrop:"✨ カード入荷", cardList:"‼️ カードリスト ‼️", moreCards:"この掲載以外にも、さらに多くのカードをご用意しています。", browseInventory:"全在庫を見る：", inventory:"販売中の在庫", graded:"𝐆𝐑𝐀𝐃𝐄𝐃 カード", raw:"𝐑𝐀𝐖 カード", sealed:"𝐒𝐄𝐀𝐋𝐄𝐃 商品", dm:"📩 ご興味があればDMでオファーをお送りください", serious:"💰 真剣な購入者のみ", meetup:"👥 待ち合わせ場所は相談可能", located:"📍 KL 🇲🇾 / SG 🇸🇬 所在", lowball:"❌ 大幅な値下げ交渉はご遠慮ください", cod:"📍 COD / 対面取引：商品によりマレーシアまたはシンガポール", shippingTitle:"🌏 国際発送 — USD 6,000 未満の商品限定", shipping:"国際発送は USD 6,000 未満の商品に限ります。送料と保険料は購入者負担です。発送保険は任意ですが、高額商品の場合は強く推奨します。カードは安全に梱包し、梱包動画を提供します。発送後に追跡番号をお知らせします。USD 6,000 を超えるカードは、商品によりマレーシアまたはシンガポールでのCODを優先します。発送後の輸送中の紛失、破損、その他の問題については責任を負いかねます。", winnerAnnouncement:"GIVEAWAY 当選者{plural}発表", results:"結果が出ました！", congratulations:"当選者：", prize:"賞品", winnerThanks:"Giveawayに参加し、Collect TCG MY & SGを応援してくださった皆さま、ありがとうございます。", winnerSupport:"フォロー、いいね、シェア、コメントのすべてに感謝しています。今後もGiveawayを行いますので、次回もお楽しみに 👀", winnerEnd:"{target}の皆さま、改めておめでとうございます！🎊", howToEnter:"📌 参加方法：", followFacebook:"Facebookページをフォロー", followInstagram:"Instagramをフォロー", comment:"Giveaway投稿にコメント", visitCode:"ウェブサイトを訪問してGiveawayコードを見つける", submit:"こちらから応募", important:"‼️ 重要：", eligible:"必要な手順をすべて完了した参加者のみ抽選対象となります。", contactWinner:"📩 当選者への連絡方法：", contactWinnerText:"Facebookページから個人アカウントへ最初のメッセージを送ることはできません。当選者のコメントに返信しますので、当選者は{hours}時間以内にFacebookページへPMでご連絡ください。", bonus:"⭐ 追加アクション / ボーナス応募：", joinGroup:"➕ +1 ボーナス：Facebookグループに参加", shareFacebook:"➕ +1 ボーナス：このFacebook投稿を公開シェア", tagFriends:"➕ +1 ボーナス：友達2人をタグ付け", shareStory:"➕ +1 ボーナス：IGストーリーで @collecttcg.mysg をタグ付けしてシェア", groups:"📢 重要：", groupsText:"このGiveaway投稿は複数のグループで共有されています。すべての有効な応募は、最終抽選のために1つのプールにまとめられます。", selection:"🎲 当選者の選出：", selectionText:"当選者は {tool} を使ってランダムに選出されます。", verification:"🔎 当選者の確認：", verificationText:"当選者発表時には、透明性と確認のため当選者のFacebookプロフィールURLも記載します。", luck:"🍀 幸運を祈ります！", ends:"🗓️ GIVEAWAY 締切", postage:"📦 送料", explore:"COLLECT TCGをもっと見る", carousellNoTrade:"トレード不可・販売のみ", productDetails:"[商品詳細]", caution:"[注意事項]", importantNotes:"[重要事項]", codRules:"[CODルール]"
      },
      ko:{
        priceRefer:"가격: 웹사이트를 확인해 주세요", nfs:"🚫 판매하지 않음 — 개인 컬렉션", collectionCta:"🌐 웹사이트에서 더 많은 컬렉션 보기:", cardDrop:"✨ 카드 드롭", cardList:"‼️ 카드 리스트 ‼️", moreCards:"이번 드롭 외에도 더 많은 카드가 준비되어 있습니다.", browseInventory:"전체 인벤토리 보기:", inventory:"판매 가능 재고", graded:"𝐆𝐑𝐀𝐃𝐄𝐃 카드", raw:"𝐑𝐀𝐖 카드", sealed:"𝐒𝐄𝐀𝐋𝐄𝐃 상품", dm:"📩 관심 있으시면 DM으로 제안해 주세요", serious:"💰 진지한 구매자만", meetup:"👥 만남 장소 협의 가능", located:"📍 KL 🇲🇾 / SG 🇸🇬 위치", lowball:"❌ 터무니없는 가격 제안 사절", cod:"📍 COD / 직거래: 상품에 따라 말레이시아 또는 싱가포르", shippingTitle:"🌏 국제 배송 — USD 6,000 미만 상품만", shipping:"국제 배송은 USD 6,000 미만의 상품에만 가능합니다. 배송비와 보험료는 구매자 부담입니다. 배송 보험은 선택 사항이지만 고가 상품에는 강력히 권장합니다. 카드는 안전하게 포장하며 포장 과정 영상도 제공합니다. 발송 후 운송장 번호를 안내드립니다. USD 6,000 이상의 카드는 상품에 따라 말레이시아 또는 싱가포르에서 COD를 우선합니다. 발송 후 운송 중 발생하는 분실, 파손 또는 기타 문제에 대해서는 책임지지 않습니다.", winnerAnnouncement:"GIVEAWAY 당첨자{plural} 발표", results:"결과가 나왔습니다!", congratulations:"축하드립니다:", prize:"경품", winnerThanks:"Giveaway에 참여하고 Collect TCG MY & SG를 응원해 주신 모든 분들께 진심으로 감사드립니다.", winnerSupport:"팔로우, 좋아요, 공유, 댓글 하나하나에 감사드립니다. 앞으로도 더 많은 Giveaway가 있으니 다음 기회도 기대해 주세요 👀", winnerEnd:"{target} 다시 한번 축하드립니다! 🎊", howToEnter:"📌 참여 방법:", followFacebook:"Facebook 페이지 팔로우", followInstagram:"Instagram 팔로우", comment:"Giveaway 게시물에 댓글 남기기", visitCode:"웹사이트에서 Giveaway 코드를 찾기", submit:"여기에서 응모하기", important:"‼️ 중요:", eligible:"필수 단계를 모두 완료한 참여자만 추첨 대상이 됩니다.", contactWinner:"📩 당첨자 연락 방법:", contactWinnerText:"Facebook 페이지는 개인 계정에 먼저 메시지를 보낼 수 없습니다. 당첨자의 댓글에 답글을 남기며, 당첨자는 {hours}시간 이내에 Facebook 페이지로 PM을 보내 경품을 수령해야 합니다.", bonus:"⭐ 추가 액션 / 보너스 응모:", joinGroup:"➕ +1 보너스: Facebook 그룹 가입", shareFacebook:"➕ +1 보너스: 이 Facebook 게시물을 전체 공개로 공유", tagFriends:"➕ +1 보너스: 친구 2명 태그", shareStory:"➕ +1 보너스: IG 스토리에 공유하고 @collecttcg.mysg 태그", groups:"📢 중요:", groupsText:"이 Giveaway 게시물은 여러 그룹에 공유되었습니다. 모든 유효 응모는 최종 추첨을 위해 하나의 풀로 합쳐집니다.", selection:"🎲 당첨자 선정:", selectionText:"당첨자는 {tool}을 사용하여 무작위로 선정됩니다.", verification:"🔎 당첨자 확인:", verificationText:"당첨자 발표 시 투명성과 확인을 위해 당첨자의 Facebook 프로필 URL도 함께 안내합니다.", luck:"🍀 행운을 빕니다!", ends:"🗓️ GIVEAWAY 마감", postage:"📦 배송", explore:"COLLECT TCG 더 보기", carousellNoTrade:"교환 불가, 판매만", productDetails:"[상품 상세]", caution:"[주의사항]", importantNotes:"[중요 안내]", codRules:"[COD 규정]"
      }
    };
    const shippingPolicy={
      en:{
        shippingTitle:"🌏 WORLDWIDE SHIPPING AVAILABLE",
        shipping:"Worldwide shipping is available. Shipping costs and insurance fees will be borne by the buyer. Shipping insurance is optional, but strongly recommended for higher-value shipments. Cards will be packed securely, and a video of the packing process will be provided for buyer's peace of mind. A tracking number will be provided once your package has been shipped. For high-value items (USD 6,000+), Cash on Delivery (COD) in Malaysia or Singapore is preferred. Secure international shipping may also be considered case by case—please contact us first to discuss payment, delivery, insurance and packing arrangements. Please note that we cannot be held responsible for any loss, damage, or issues that may occur during transit once the package has been shipped."
      },
      ms:{
        shippingTitle:"🌏 PENGHANTARAN SELURUH DUNIA TERSEDIA",
        shipping:"Penghantaran seluruh dunia tersedia. Kos penghantaran dan insurans ditanggung pembeli. Insurans penghantaran adalah pilihan tetapi amat disyorkan untuk item bernilai tinggi. Kad akan dibungkus dengan selamat dan video proses pembungkusan akan diberikan. Nombor penjejakan akan diberikan selepas penghantaran. Untuk item bernilai tinggi (USD 6,000+), COD di Malaysia atau Singapura adalah pilihan utama. Penghantaran antarabangsa yang selamat juga boleh dipertimbangkan mengikut kes—sila hubungi kami terlebih dahulu untuk membincangkan pembayaran, penghantaran, insurans dan urusan pembungkusan. Selepas item dihantar, kami tidak bertanggungjawab atas kehilangan, kerosakan atau isu semasa transit."
      },
      zh:{
        shippingTitle:"🌏 提供全球配送",
        shipping:"提供全球配送。运费和保险费由买方承担。运输保险为可选项目，但强烈建议高价值商品购买。卡牌将安全包装，并提供包装过程视频。发货后会提供追踪号码。对于高价值商品（USD 6,000+），优先在马来西亚或新加坡 COD。也可按个案考虑安全国际运输——请在购买前先联系我们，讨论付款、配送、保险和包装安排。商品发出后，运输过程中产生的遗失、损坏或问题恕不负责。"
      },
      ja:{
        shippingTitle:"🌏 世界各国へ発送可能",
        shipping:"世界各国へ発送可能です。送料と保険料は購入者負担です。発送保険は任意ですが、高額商品の場合は強く推奨します。カードは安全に梱包し、梱包動画を提供します。発送後に追跡番号をお知らせします。高額商品（USD 6,000+）は、マレーシアまたはシンガポールでのCODを優先します。安全な国際発送も個別に検討できますので、購入前に支払い、配送、保険、梱包の手配についてご相談ください。発送後の輸送中の紛失、破損、その他の問題については責任を負いかねます。"
      },
      ko:{
        shippingTitle:"🌏 전 세계 배송 가능",
        shipping:"전 세계 배송이 가능합니다. 배송비와 보험료는 구매자 부담입니다. 배송 보험은 선택 사항이지만 고가 상품에는 강력히 권장합니다. 카드는 안전하게 포장하며 포장 과정 영상도 제공합니다. 발송 후 운송장 번호를 안내드립니다. 고가 상품(USD 6,000+)은 말레이시아 또는 싱가포르에서의 COD를 우선합니다. 안전한 국제 배송도 건별로 검토할 수 있으니, 구매 전에 결제, 배송, 보험 및 포장 절차를 논의하기 위해 먼저 연락해 주세요. 발송 후 운송 중 발생하는 분실, 파손 또는 기타 문제에 대해서는 책임지지 않습니다."
      }
    };
    return {...(locales[language]||locales.en),...(shippingPolicy[language]||shippingPolicy.en)};
  }

  function replacePostTokens(text,values={}){
    return String(text||"").replace(/\{(\w+)\}/g,(_match,key)=>values[key]??"");
  }

  function postSalesFooterLines(language){
    const t=postLocale(language);
    return [t.cod,"",t.shippingTitle,"",t.shipping,"",t.dm,"",t.serious,"",t.meetup,"",t.located,"",t.lowball];
  }

  function facebookGroupSalesCopy(language){
    const copy={
      en:{price:"💰 Price & full details:",shipping:"🌏 Worldwide shipping available",dm:"📩 DM if interested or if you would like more photos / video."},
      ms:{price:"💰 Harga & butiran penuh:",shipping:"🌏 Penghantaran seluruh dunia tersedia",dm:"📩 DM jika berminat atau jika anda mahu lebih banyak foto / video."},
      zh:{price:"💰 价格与完整详情：",shipping:"🌏 提供全球配送",dm:"📩 如有兴趣或想查看更多照片 / 视频，请私信。"},
      ja:{price:"💰 価格・詳細：",shipping:"🌏 世界各国へ発送可能",dm:"📩 ご興味がある場合、または追加の写真・動画をご希望の場合はDMください。"},
      ko:{price:"💰 가격 및 전체 정보:",shipping:"🌏 전 세계 배송 가능",dm:"📩 관심이 있거나 추가 사진 / 영상을 원하시면 DM 주세요."}
    };
    return copy[normalizePostLanguage(language)]||copy.en;
  }

  function facebookGroupSalesFooterLines(language){
    const t=postLocale(language);
    const short=facebookGroupSalesCopy(language);
    return [t.cod,"",short.shipping,"",short.dm,"",t.meetup,"",t.located];
  }

function getFbPostPrefs(){
    try{
      const parsed = JSON.parse(appContext.localStorage.getItem(appContext.FB_POST_PREFS_KEY) || "{}");
      return {
        carousellShopUrl: appContext.safeHttpUrl(parsed.carousellShopUrl) || appContext.FB_POST_DEFAULTS.carousellShopUrl,
        instagramUrl: appContext.safeHttpUrl(parsed.instagramUrl) || appContext.FB_POST_DEFAULTS.instagramUrl,
        hashtags: String(parsed.hashtags || appContext.FB_POST_DEFAULTS.hashtags).trim().slice(0,500)
      };
    }catch{
      return {...appContext.FB_POST_DEFAULTS};
    }
  }

function saveFbPostPrefs(prefs){
    try{
      appContext.localStorage.setItem(appContext.FB_POST_PREFS_KEY, JSON.stringify({
        carousellShopUrl:appContext.safeHttpUrl(prefs.carousellShopUrl) || appContext.FB_POST_DEFAULTS.carousellShopUrl,
        instagramUrl:appContext.safeHttpUrl(prefs.instagramUrl) || appContext.FB_POST_DEFAULTS.instagramUrl,
        hashtags:String(prefs.hashtags || "").trim().slice(0,500)
      }));
    }catch{}
  }

function getFbCardMeta(){
    try{
      const parsed = JSON.parse(appContext.localStorage.getItem(appContext.FB_POST_CARD_META_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }catch{
      return {};
    }
  }

function saveFbCardMeta(meta){
    try{ appContext.localStorage.setItem(appContext.FB_POST_CARD_META_KEY, JSON.stringify(meta)); }catch{}
  }

function safeHttpUrl(value){
    const raw=String(value||"").trim().slice(0,1000);
    if(!raw) return "";
    try{
      const u=new URL(raw);
      return ["http:","https:"].includes(u.protocol) ? u.toString() : "";
    }catch{
      return "";
    }
  }

function openSafeExternalUrl(value){
    const raw=String(value||"").trim().slice(0,4096);
    if(!raw) return null;

    try{
      const url=new URL(raw);
      if(!["http:","https:"].includes(url.protocol)) return null;
      return window.open(url.toString(),"_blank","noopener,noreferrer");
    }catch{
      return null;
    }
  }

function fbFormatLabel(card){
    const grades = Array.isArray(card?.grading) ? card.grading.filter(g=>g && g.company) : [];
    if(grades.length){
      return `${String(grades[0].company || "").toUpperCase()} ${String(grades[0].grade || "").trim()}`.trim();
    }
    const format = appContext.effectiveFormat(card || {});
    if(appContext.normalizeFilterValue(format) === "sealed") return "SEALED";
    if(appContext.normalizeFilterValue(format) === "graded") return "GRADED";
    return appContext.rawConditionPostLabel(card);
  }

function postEraLabel(card){
    const era=String(card?.era||"").trim();
    return era ? `【${era.toUpperCase()}】` : "";
  }

function postPopLabel(card){
    const grades=Array.isArray(card?.grading)
      ? card.grading.filter(g=>g && String(g.company||"").trim())
      : [];

    if(!grades.length) return "";

    if(grades.length===1){
      const pop=grades[0]?.pop_count;
      if(pop==null || pop==="") return "";
      const n=Number(pop);
      if(!Number.isFinite(n)) return "";
      return `【POP ${Math.round(n).toLocaleString()}】`;
    }

    const pops=grades
      .map((g,index)=>{
        const pop=g?.pop_count;
        if(pop==null || pop==="") return "";
        const n=Number(pop);
        if(!Number.isFinite(n)) return "";
        return `S${index+1} POP ${Math.round(n).toLocaleString()}`;
      })
      .filter(Boolean);

    return pops.length ? `【${pops.join(" · ")}】` : "";
  }

function fbGameLabel(card){
    const game = String(card?.game || "").trim();
    if(appContext.normalizeFilterValue(game) === "one piece card game") return "ONE PIECE";
    return game.toUpperCase();
  }

function defaultFbPostTitle(card){
    if(!card) return "";
    const parts = [
      card.year || "",
      appContext.fbGameLabel(card),
      appContext.normalizeFilterValue(card.era) === "vintage" && appContext.normalizeFilterValue(card.game).includes("one piece") ? "CARDDASS" : "",
      card.series || "",
      card.name || "",
      card.card_code || ""
    ].filter(Boolean);

    return `WTS【${appContext.fbFormatLabel(card)}】${appContext.postPopLabel(card)}${appContext.postEraLabel(card)} ${parts.join(" ")}`.replace(/\s+/g," ").trim().toUpperCase();
  }

function singleCardCopyTitle(card){
    if(!card) return "";
    const type=appContext.cardListFormat(card);
    const lead=type==="graded" ? appContext.gradedPostLabel(card) : (type==="sealed" ? "Sealed" : appContext.rawConditionPostLabel(card));
    return [lead,card.series,card.name,card.card_code].map(value=>String(value||"").trim()).filter(Boolean).join(" · ");
  }

function defaultFbHashtags(card){
    const game = appContext.normalizeFilterValue(card?.game || "");
    if(game.includes("one piece")){
      return "#tcg #onepiece #onepiecetcg #onepiececardgame #TCGCollector";
    }
    if(game.includes("zatch") || game.includes("gash")){
      return "#tcg #zatchbell #gashbell #carddass #TCGCollector";
    }
    if(game.includes("gundam")){
      return "#tcg #gundam #gundamcardgame #carddass #TCGCollector";
    }
    return "#tcg #TCGCollector";
  }

function buildFbPostText(card, values){
    if(!card) return "";

    const divider = "━━━━━━━━━━━━━━━━━━━━━━━━";
    const text=appContext.postLocale(values.language);
    const title = String(values.title || appContext.defaultFbPostTitle(card)).trim();
    const websiteCardUrl = appContext.getCardShareUrl(card.id);
    const carousellShopUrl = appContext.safeHttpUrl(values.carousellShopUrl);
    const instagramUrl = appContext.safeHttpUrl(values.instagramUrl);
    const hashtags = String(values.hashtags || appContext.defaultFbHashtags(card)).trim();

    const groupFriendly=values.templateMode!=="detailed";
    const groupCopy=appContext.facebookGroupSalesCopy(values.language);
    const lines = [
      title,
      "",
      groupCopy.price,
      "",
      websiteCardUrl,
      "",
      divider,
      "",
      ...(groupFriendly
        ? appContext.facebookGroupSalesFooterLines(values.language)
        : appContext.postSalesFooterLines(values.language)),
      "",
      divider
    ];

    lines.push(
      "",
      "HASHTAG :",
      hashtags
    );

    return appContext.compactGeneratedPostSpacing(lines.join("\n"));
  }

function buildFbNfsPostText(card,values){
    if(!card) return "";

    const divider="━━━━━━━━━━━━━━━━━━━━━━━━";
    const text=appContext.postLocale(values.language);
    const title=String(values.title||appContext.defaultFbPostTitle(card)).trim();
    const collectionUrl=`${location.origin}${location.pathname}${location.search}#/collection`;
    const hashtags=String(values.hashtags||appContext.defaultFbHashtags(card)).trim();

    const lines=[
      title,
      "",
      text.nfs,
      "",
      text.collectionCta,
      collectionUrl,
      "",
      divider,
      "",
      "HASHTAG :",
      hashtags
    ];

    return appContext.compactGeneratedPostSpacing(lines.join("\n"));
  }

async function copyTextToClipboard(text){
    const value=String(text||"");
    if(!value) return false;

    try{
      await navigator.clipboard.writeText(value);
      return true;
    }catch{
      try{
        const ta=document.createElement("textarea");
        ta.value=value;
        ta.setAttribute("readonly","");
        ta.style.position="fixed";
        ta.style.opacity="0";
        document.body.appendChild(ta);
        ta.select();
        const ok=document.execCommand("copy");
        ta.remove();
        return !!ok;
      }catch{
        return false;
      }
    }
  }

async function copyPlainText(text,successMessage){
    const ok=await appContext.copyTextToClipboard(text);
    appContext.showToast(ok ? (successMessage||"Copied") : "Could not copy");
    return ok;
  }

function currentFacebookToolMode(){
    const mode=appContext.currentHashParams().get("mode");
    return ["single","nfs","list","giveaway","winner","carousell","ebay"].includes(mode) ? mode : "single";
  }

function facebookToolsHeaderHTML(mode){
    const descriptions={
      single:"Create a ready-to-post Facebook listing for one card.",
      nfs:"Create a showcase post for one Not For Sale card from your personal collection.",
      list:"Create a complete Facebook sales list from your available inventory.",
      giveaway:"Create a reusable Facebook giveaway post from your giveaway template.",
      winner:"Create a winner-announcement post from your saved Past Winners.",
      carousell:"Create a ready-to-copy Carousell listing description from your card inventory.",
      ebay:"Create an eBay-ready title, item specifics and listing description from one inventory card, with its listing photos ready to download."
    };

    return appContext.compactGeneratedPostSpacing(`
      <div class="page-head fb-tools-page-head">
        <div>
          <div class="eyebrow">Owner Tools</div>
          <h2>Post Generator Tools</h2>
          <p>${appContext.escapeHtml(descriptions[mode]||descriptions.single)}</p>
        </div>
      </div>
      <div class="fb-tools-switcher" role="tablist" aria-label="Post generator type">
        <a href="#/fb-tools?mode=single"
           class="fb-tools-switch ${mode==="single" ? "active" : ""}"
           role="tab"
           aria-selected="${mode==="single" ? "true" : "false"}">
          <span class="fb-tools-switch-icon">▣</span>
          <span>
            <strong>Single Card Post</strong>
            <small>Choose one card · copy post · download all images as ZIP (Sold listings get a SOLD marker automatically)</small>
          </span>
        </a>

        <a href="#/fb-tools?mode=nfs"
           class="fb-tools-switch ${mode==="nfs" ? "active" : ""}"
           role="tab"
           aria-selected="${mode==="nfs" ? "true" : "false"}">
          <span class="fb-tools-switch-icon">◇</span>
          <span>
            <strong>Single Card NFS Post</strong>
            <small>Choose one Collection (NFS) card · showcase it · invite visitors to see more of the collection</small>
          </span>
        </a>

        <a href="#/fb-tools?mode=list"
           class="fb-tools-switch ${mode==="list" ? "active" : ""}"
           role="tab"
           aria-selected="${mode==="list" ? "true" : "false"}">
          <span class="fb-tools-switch-icon">☷</span>
          <span>
            <strong>Card List Post</strong>
            <small>Choose available cards · full list · first images ZIP</small>
          </span>
        </a>

        <a href="#/fb-tools?mode=giveaway"
           class="fb-tools-switch ${mode==="giveaway" ? "active" : ""}"
           role="tab"
           aria-selected="${mode==="giveaway" ? "true" : "false"}">
          <span class="fb-tools-switch-icon">🎁</span>
          <span>
            <strong>Giveaway Post</strong>
            <small>Load a giveaway · edit entry links · copy ready-to-post text</small>
          </span>
        </a>

        <a href="#/fb-tools?mode=winner"
           class="fb-tools-switch ${mode==="winner" ? "active" : ""}"
           role="tab"
           aria-selected="${mode==="winner" ? "true" : "false"}">
          <span class="fb-tools-switch-icon">🏆</span>
          <span>
            <strong>Giveaway Winners</strong>
            <small>Select from Past Winners · matched prizes · Facebook links</small>
          </span>
        </a>

        <a href="#/fb-tools?mode=ebay" class="fb-tools-switch ${mode==="ebay" ? "active" : ""}" role="tab" aria-selected="${mode==="ebay" ? "true" : "false"}"><span class="fb-tools-switch-icon">e</span><span><strong>eBay Listing</strong><small>Choose one card · title · item specifics · description · image ZIP</small></span></a>

        <a href="#/fb-tools?mode=carousell"
           class="fb-tools-switch ${mode==="carousell" ? "active" : ""}"
           role="tab"
           aria-selected="${mode==="carousell" ? "true" : "false"}">
          <span class="fb-tools-switch-icon">C</span>
          <span>
            <strong>Carousell Post</strong>
            <small>Choose a card or giveaway prize · edit Product Details · copy listing template</small>
          </span>
        </a>
      </div>
    `);
  }

function renderFacebookToolsPage(){
    if(!appContext.requireOwner("open Facebook tools")) return;

    const mode = appContext.currentFacebookToolMode();

    if(mode==="list"){
      appContext.renderFbCardListGeneratorPage();
    }else if(mode==="nfs"){
      appContext.renderFbPostGeneratorPage(true);
    }else if(mode==="giveaway"){
      appContext.renderFbGiveawayPostGeneratorPage();
    }else if(mode==="winner"){
      appContext.renderGiveawayWinnerPostGeneratorPage();
    }else if(mode==="carousell"){
      appContext.renderCarousellPostGeneratorPage();
    }else if(mode==="ebay"){
      appContext.renderEbayListingGeneratorPage();
    }else{
      appContext.renderFbPostGeneratorPage();
    }

    const existingHead = appContext.view.querySelector(".page-head");
    if(existingHead){
      existingHead.outerHTML = appContext.facebookToolsHeaderHTML(mode);
    }else{
      appContext.view.insertAdjacentHTML("afterbegin", appContext.facebookToolsHeaderHTML(mode));
    }
  }

function renderFbPostGeneratorPage(nfsMode=false){
    if(!appContext.requireOwner("open FB post generator")) return;

    const prefs = appContext.getFbPostPrefs();
    const perCardMeta = appContext.getFbCardMeta();
    const selectableCards = appContext.cards
      .filter(card=>!nfsMode || appContext.canonicalAvailability(card.availability)==="Collection (NFS)")
      .slice()
      .sort((a,b)=>{
        const aSold = appContext.normalizeFilterValue(a.availability) === "sold" ? 1 : 0;
        const bSold = appContext.normalizeFilterValue(b.availability) === "sold" ? 1 : 0;
        return aSold - bSold || String(a.name || "").localeCompare(String(b.name || ""));
      });

    const fbSingleGameOptions=[...new Set(
      selectableCards.map(card=>String(card.game||"").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    const fbSingleStatusOptions=[...new Set(
      selectableCards.map(card=>String(card.availability||"Available").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    appContext.view.innerHTML = `
      <div class="page-head fb-post-page-head">
        <div>
          <div class="eyebrow">Owner Tool</div>
          <h2>${nfsMode ? "Facebook NFS Post Generator" : "Facebook Post Generator"}</h2>
          <p>${nfsMode
            ? "Select a Collection (NFS) card and create a showcase post with no sales or pricing language."
            : "Select a card and copy a ready-to-post Facebook sales template."}</p>
        </div>
      </div>

      <div class="fb-post-layout">
        <section class="panel fb-post-builder">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">1 · Select Card</div>
              <h3>Card Details</h3>
            </div>
          </div>

          <div class="fb-card-list-selection-toolbar">
            <div class="field fb-card-list-search-field">
              <label for="fbPostCardSearch">Search cards</label>
              <input id="fbPostCardSearch" type="search" maxlength="100" placeholder="Name, code, series, year…">
            </div>

            <div class="fb-card-list-filter-row">
              <div class="field">
                <label for="fbPostGameFilter">Game</label>
                <select id="fbPostGameFilter">
                  <option value="">All games</option>
                  ${fbSingleGameOptions.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="fbPostStatusFilter">Status</label>
                <select id="fbPostStatusFilter" ${nfsMode ? "disabled" : ""}>
                  ${nfsMode
                    ? `<option value="Collection (NFS)">Collection (NFS)</option>`
                    : `<option value="">All statuses</option>${fbSingleStatusOptions.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}`}
                </select>
              </div>
              <div class="field">
                <label for="fbPostTypeFilter">Type</label>
                <select id="fbPostTypeFilter">
                  <option value="">All types</option>
                  <option value="graded">Graded</option>
                  <option value="raw">Raw</option>
                  <option value="sealed">Sealed</option>
                </select>
              </div>
            </div>
          </div>

          <div class="field">
            <label for="fbPostCardSelect">Card</label>
            <select id="fbPostCardSelect">
              <option value="">Select a card…</option>
            </select>
            <div class="hint" id="fbPostFilterCount"></div>
          </div>

          <div id="fbPostSelectedCard" class="fb-post-selected-card" hidden></div>

          <div class="field">
            <label for="fbPostTitle">Facebook title</label>
            <input id="fbPostTitle" type="text" maxlength="300" placeholder="Generated automatically after selecting a card">
            <div class="hint">The title is generated from the card data, but you can edit it for terms such as FOIL or a specific Carddass series.</div>
          </div>

          ${appContext.postLanguageSelectHTML("fbPostLanguage",appContext.getPostGeneratorLanguage())}

          ${nfsMode ? "" : `
            <div class="field">
              <label for="fbPostTemplateMode">Facebook template</label>
              <select id="fbPostTemplateMode">
                <option value="group">Group-friendly (short)</option>
                <option value="detailed" selected>Detailed listing</option>
              </select>
              <div class="hint">Group-friendly keeps the card link, COD / meetup, worldwide shipping and DM contact while leaving detailed shipping terms on the website.</div>
            </div>`}

          <details class="fb-post-settings">
            <summary>Template links & hashtags</summary>
            <div class="fb-post-settings-body">
              <div class="field">
                <label for="fbPostCarousellShop">Carousell shop URL</label>
                <input id="fbPostCarousellShop" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.carousellShopUrl)}">
              </div>
              <div class="field">
                <label for="fbPostInstagram">Instagram URL</label>
                <input id="fbPostInstagram" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.instagramUrl)}">
              </div>
              <div class="field">
                <label for="fbPostHashtags">Hashtags</label>
                <textarea id="fbPostHashtags" rows="3" maxlength="500">${appContext.escapeHtml(prefs.hashtags)}</textarea>
              </div>
            </div>
          </details>
        </section>

        <section class="panel fb-post-output-panel">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">2 · Copy & Post</div>
              <h3>Post Preview</h3>
            </div>
            <div class="fb-post-copy-actions">
              <button type="button" class="btn-ghost" id="fbCopyListingTitleBtn" disabled>Copy Listing Title</button>
              <button type="button" class="btn-ghost" id="fbCopyTitleBtn" disabled>Copy Facebook Title</button>
              <button type="button" class="btn-ghost" id="fbCopyPostBtn" disabled>Copy Full Post</button>
              <button type="button" class="btn-primary fb-prepare-btn" id="fbPreparePostBtn" disabled>Prepare Facebook Post</button>
            </div>
          </div>

          <div class="field"><label for="fbListingTitleOutput">Listing Title</label><input id="fbListingTitleOutput" type="text" readonly placeholder="Select a card to generate the listing title…"><div class="hint">Condition / grade / sealed · series · card name · card code. Empty fields are omitted.</div></div>
          <textarea id="fbPostOutput" class="fb-post-output" readonly placeholder="Select a card to generate the Facebook post…"></textarea>

          <div class="fb-post-bottom-actions">
            <button type="button" class="btn-ghost" id="fbDownloadImageBtn" disabled>Download Images (.ZIP)</button>
            <button type="button" class="btn-ghost" id="fbOpenCardBtn" disabled>Open Card</button>
          </div>
        </section>
      </div>
    `;

    const select = appContext.$("fbPostCardSelect");
    const searchInput = appContext.$("fbPostCardSearch");
    const gameFilter = appContext.$("fbPostGameFilter");
    const statusFilter = appContext.$("fbPostStatusFilter");
    const typeFilter = appContext.$("fbPostTypeFilter");
    const filterCount = appContext.$("fbPostFilterCount");
    const titleInput = appContext.$("fbPostTitle");
    const languageInput = appContext.$("fbPostLanguage");
    const templateModeInput = appContext.$("fbPostTemplateMode");
    const shopInput = appContext.$("fbPostCarousellShop");
    const instagramInput = appContext.$("fbPostInstagram");
    const hashtagsInput = appContext.$("fbPostHashtags");
    const listingTitleOutput = appContext.$("fbListingTitleOutput");
    const output = appContext.$("fbPostOutput");
    const selectedCardMount = appContext.$("fbPostSelectedCard");
    const copyListingTitleBtn = appContext.$("fbCopyListingTitleBtn");
    const copyTitleBtn = appContext.$("fbCopyTitleBtn");
    const copyPostBtn = appContext.$("fbCopyPostBtn");
    const prepareBtn = appContext.$("fbPreparePostBtn");
    const downloadBtn = appContext.$("fbDownloadImageBtn");
    const openCardBtn = appContext.$("fbOpenCardBtn");

    let selectedCard = null;

    function fbSingleMatchesFilters(card){
      const q=appContext.normalizeFilterValue(searchInput.value);
      const game=appContext.normalizeFilterValue(gameFilter.value);
      const status=appContext.normalizeFilterValue(statusFilter.value);
      const type=appContext.normalizeFilterValue(typeFilter.value);

      if(game && appContext.normalizeFilterValue(card.game)!==game) return false;
      if(status && appContext.normalizeFilterValue(card.availability||"Available")!==status) return false;
      if(type && appContext.cardListFormat(card)!==type) return false;

      if(q){
        const hay=[
          card.name,
          card.card_code,
          card.series,
          card.year,
          card.game,
          card.era,
          card.language,
          card.availability
        ].map(v=>appContext.normalizeFilterValue(v)).join(" ");
        if(!hay.includes(q)) return false;
      }
      return true;
    }

    function renderFbSingleCardOptions(){
      const visible=selectableCards.filter(fbSingleMatchesFilters);
      const selectedId=String(select.value||selectedCard?.id||"");

      select.innerHTML=[
        `<option value="">Select a card…</option>`,
        ...visible.map(card=>`
          <option value="${appContext.escapeHtml(card.id)}">
            ${appContext.escapeHtml(`${card.card_code ? card.card_code + " · " : ""}${card.name} · ${card.availability || "Available"}`)}
          </option>
        `)
      ].join("");

      if(selectedId && visible.some(card=>String(card.id)===selectedId)){
        select.value=selectedId;
      }

      filterCount.textContent=nfsMode
        ? `${visible.length} Collection (NFS) card${visible.length===1?"":"s"} shown`
        : `${visible.length} of ${selectableCards.length} cards shown`;
    }

    function currentValues(){
      return {
        title:titleInput.value,
        language:languageInput.value,
        templateMode:templateModeInput?.value||"detailed",
        carousellShopUrl:shopInput.value,
        instagramUrl:instagramInput.value,
        hashtags:hashtagsInput.value
      };
    }

    function persistCurrent(){
      const prefsNow = currentValues();
      appContext.savePostGeneratorLanguage(prefsNow.language);
      appContext.saveFbPostPrefs(prefsNow);

      if(selectedCard){
        const meta = appContext.getFbCardMeta();
        meta[selectedCard.id] = {
          title:String(titleInput.value || "").trim().slice(0,300),
        };
        appContext.saveFbCardMeta(meta);
      }
    }

    function updateOutput(){
      if(!selectedCard){
        listingTitleOutput.value = "";
        output.value = "";
        copyListingTitleBtn.disabled = true;
        copyTitleBtn.disabled = true;
        copyPostBtn.disabled = true;
        prepareBtn.disabled = true;
        downloadBtn.disabled = true;
        return;
      }

      const values = currentValues();
      listingTitleOutput.value = appContext.singleCardCopyTitle(selectedCard);
      output.value = nfsMode
        ? appContext.buildFbNfsPostText(selectedCard,values)
        : appContext.buildFbPostText(selectedCard,values);
      copyListingTitleBtn.disabled = !listingTitleOutput.value.trim();
      copyTitleBtn.disabled = !titleInput.value.trim();
      copyPostBtn.disabled = !output.value.trim();
      prepareBtn.disabled = !output.value.trim();
      downloadBtn.disabled = appContext.getImages(selectedCard).length === 0;
    }

    function renderSelectedCard(){
      if(!selectedCard){
        selectedCardMount.hidden = true;
        selectedCardMount.innerHTML = "";
        return;
      }
      const image = appContext.getImages(selectedCard)[0] || "";
      selectedCardMount.hidden = false;
      selectedCardMount.innerHTML = `
        <div class="fb-post-card-image">
          ${image ? `<img src="${appContext.escapeHtml(image)}" alt="${appContext.escapeHtml(selectedCard.name)}">` : `<div class="fb-post-no-image">No image</div>`}
        </div>
        <div class="fb-post-card-copy">
          <strong>${appContext.escapeHtml(selectedCard.name)}</strong>
          <span>${appContext.escapeHtml([
            selectedCard.card_code,
            selectedCard.year,
            selectedCard.game,
            selectedCard.series
          ].filter(Boolean).join(" · "))}</span>
          <small>${appContext.escapeHtml(selectedCard.availability || "Available")} · ${appContext.getImages(selectedCard).length} image${appContext.getImages(selectedCard).length === 1 ? "" : "s"}</small>
        </div>
      `;
    }

    function selectCard(cardId){
      selectedCard = appContext.getCardById(cardId) || null;

      if(!selectedCard){
        titleInput.value = "";
        openCardBtn.disabled = true;
        renderSelectedCard();
        updateOutput();
        return;
      }

      const meta = perCardMeta[selectedCard.id] || {};
      const normalDefaultTitle=appContext.defaultFbPostTitle(selectedCard);
      const nfsDefaultTitle=`COLLECTION SHOWCASE【NFS】${String(selectedCard.name||"").toUpperCase()}${selectedCard.card_code ? ` · ${String(selectedCard.card_code).toUpperCase()}` : ""}`;
      titleInput.value = String(
        meta.title || (nfsMode ? nfsDefaultTitle : normalDefaultTitle)
      ).slice(0,300);

      hashtagsInput.value = prefs.hashtags === appContext.FB_POST_DEFAULTS.hashtags
        ? appContext.defaultFbHashtags(selectedCard)
        : prefs.hashtags;

      openCardBtn.disabled = false;
      renderSelectedCard();
      updateOutput();
    }

    select.addEventListener("change", ()=>selectCard(select.value));

    [searchInput,gameFilter,statusFilter,typeFilter].forEach(input=>{
      input.addEventListener("input",renderFbSingleCardOptions);
      input.addEventListener("change",renderFbSingleCardOptions);
    });

    renderFbSingleCardOptions();

    openCardBtn.addEventListener("click",()=>{
      if(!selectedCard || openCardBtn.disabled) return;
      // Show the existing card-details overlay in place. Do not change the
      // route, so closing the details returns to this generator exactly as-is.
      appContext.openDetailsModal(selectedCard);
    });

    const requestedCardId=appContext.safeCardId(appContext.currentHashParams().get("card"));
    if(requestedCardId && selectableCards.some(card=>String(card.id)===requestedCardId)){
      const requestedCard=appContext.getCardById(requestedCardId);
      if(requestedCard){
        searchInput.value="";
        gameFilter.value="";
        if(!nfsMode) statusFilter.value="";
        typeFilter.value="";
        renderFbSingleCardOptions();
        select.value=requestedCardId;
        selectCard(requestedCardId);
      }
    }

    [titleInput,languageInput,templateModeInput,shopInput,instagramInput,hashtagsInput].filter(Boolean).forEach(input=>{
      input.addEventListener("input", ()=>{
        persistCurrent();
        updateOutput();
      });
      input.addEventListener("change", ()=>{
        persistCurrent();
        updateOutput();
      });
    });

    copyListingTitleBtn.addEventListener("click", ()=>{
      appContext.copyPlainText(listingTitleOutput.value, "Listing title copied");
    });

    copyTitleBtn.addEventListener("click", ()=>{
      appContext.copyPlainText(titleInput.value, "Facebook title copied");
    });

    copyPostBtn.addEventListener("click", ()=>{
      appContext.copyPlainText(output.value, nfsMode ? "NFS showcase post copied" : "Facebook post copied");
    });

    prepareBtn.addEventListener("click", async ()=>{
      if(!selectedCard) return;
      if(!appContext.requireOwner("prepare single-card Facebook post")) return;
      if(!output.value.trim()){
        appContext.showToast("No Facebook post to prepare");
        return;
      }

      const originalText=prepareBtn.textContent;
      prepareBtn.disabled=true;
      copyPostBtn.disabled=true;
      downloadBtn.disabled=true;
      prepareBtn.textContent="Preparing…";

      try{
        const copied=await appContext.copyPlainText(
          output.value,
          nfsMode ? "NFS showcase post copied" : "Facebook post copied"
        );
        if(!copied) throw new Error("Could not copy Facebook post");

        const images=appContext.getImages(selectedCard);
        if(!images.length){
          appContext.showToast("Post copied · no card images to download");
          return;
        }

        prepareBtn.textContent="Creating image ZIP…";
        const result=await appContext.downloadSingleCardImagesZip(
          selectedCard,
          (done,total,added,failed)=>{
            prepareBtn.textContent=failed
              ? `ZIP ${done}/${total} · ${failed} skipped`
              : `ZIP ${done}/${total}`;
          }
        );

        appContext.showToast(
          result.failed.length
            ? `Post ready · ${result.added} images included · ${result.failed.length} skipped`
            : `Post ready · text copied + ${result.added} image${result.added===1?"":"s"} ZIP`
        );
      }catch(err){
        console.error("Prepare single-card Facebook post error:",err);
        appContext.showToast(`Could not fully prepare post${err?.message ? `: ${String(err.message).slice(0,100)}` : ""}`);
      }finally{
        prepareBtn.textContent=originalText;
        updateOutput();
      }
    });

    downloadBtn.addEventListener("click", async ()=>{
      if(!selectedCard) return;
      if(!appContext.requireOwner("download single-card image ZIP")) return;

      const images = appContext.getImages(selectedCard);
      if(!images.length){
        appContext.showToast("No card images available");
        return;
      }

      const originalText = downloadBtn.textContent;
      downloadBtn.disabled = true;
      downloadBtn.textContent = "Preparing ZIP…";

      try{
        const result = await appContext.downloadSingleCardImagesZip(
          selectedCard,
          (done,total,added,failed)=>{
            downloadBtn.textContent = failed
              ? `Preparing ${done}/${total} · ${failed} skipped`
              : `Preparing ${done}/${total}`;
          }
        );

        appContext.showToast(
          result.failed.length
            ? `ZIP downloaded · ${result.added} included · ${result.failed.length} skipped`
            : `ZIP downloaded with ${result.added} image${result.added===1?"":"s"}`
        );
      }catch(err){
        console.error("Single-card ZIP error:", err);
        appContext.showToast(`Could not create image ZIP${err?.message ? `: ${String(err.message).slice(0,100)}` : ""}`);
      }finally{
        downloadBtn.disabled = false;
        downloadBtn.textContent = originalText;
      }
    });
  }

function getFbGiveawayPostPrefs(){
    try{
      const p=JSON.parse(appContext.localStorage.getItem(appContext.FB_GIVEAWAY_POST_PREFS_KEY)||"{}");
      const safe=(value,fallback,max=500)=>String(value??fallback).trim().slice(0,max);

      return {
        giveawayNumber:safe(p.giveawayNumber,appContext.FB_GIVEAWAY_POST_DEFAULTS.giveawayNumber,20),
        winnerHeadline:safe(p.winnerHeadline,appContext.FB_GIVEAWAY_POST_DEFAULTS.winnerHeadline,250),
        prizeLine:safe(p.prizeLine,appContext.FB_GIVEAWAY_POST_DEFAULTS.prizeLine,350),
        facebookPageUrl:appContext.safeHttpUrl(p.facebookPageUrl)||appContext.FB_GIVEAWAY_POST_DEFAULTS.facebookPageUrl,
        instagramUrl:appContext.safeHttpUrl(p.instagramUrl)||appContext.FB_GIVEAWAY_POST_DEFAULTS.instagramUrl,
        facebookGroupUrl:appContext.safeHttpUrl(p.facebookGroupUrl)||appContext.FB_GIVEAWAY_POST_DEFAULTS.facebookGroupUrl,
        includeFacebookGroupBonus:p.includeFacebookGroupBonus!==false,
        commentText:safe(p.commentText,appContext.FB_GIVEAWAY_POST_DEFAULTS.commentText,250),
        claimHours:safe(p.claimHours,appContext.FB_GIVEAWAY_POST_DEFAULTS.claimHours,10),
        winnerTool:safe(p.winnerTool,appContext.FB_GIVEAWAY_POST_DEFAULTS.winnerTool,100),
        giveawayEnds:safe(p.giveawayEnds,appContext.FB_GIVEAWAY_POST_DEFAULTS.giveawayEnds,180),
        cod:safe(p.cod,appContext.FB_GIVEAWAY_POST_DEFAULTS.cod,180),
        postage:safe(p.postage,appContext.FB_GIVEAWAY_POST_DEFAULTS.postage,100),
        carousellMalaysiaUrl:appContext.safeHttpUrl(p.carousellMalaysiaUrl)||appContext.FB_GIVEAWAY_POST_DEFAULTS.carousellMalaysiaUrl,
        carousellSingaporeUrl:appContext.safeHttpUrl(p.carousellSingaporeUrl)||appContext.FB_GIVEAWAY_POST_DEFAULTS.carousellSingaporeUrl,
        hashtags:safe(p.hashtags,appContext.FB_GIVEAWAY_POST_DEFAULTS.hashtags,500),
        includeMultiGroupNotice:p.includeMultiGroupNotice!==false
      };
    }catch{
      return {...appContext.FB_GIVEAWAY_POST_DEFAULTS};
    }
  }

function saveFbGiveawayPostPrefs(p){
    try{
      const safe=(value,max)=>String(value||"").trim().slice(0,max);
      appContext.localStorage.setItem(appContext.FB_GIVEAWAY_POST_PREFS_KEY,JSON.stringify({
        giveawayNumber:safe(p.giveawayNumber,20),
        winnerHeadline:safe(p.winnerHeadline,250),
        prizeLine:safe(p.prizeLine,350),
        facebookPageUrl:appContext.safeHttpUrl(p.facebookPageUrl),
        instagramUrl:appContext.safeHttpUrl(p.instagramUrl),
        facebookGroupUrl:appContext.safeHttpUrl(p.facebookGroupUrl),
        includeFacebookGroupBonus:p.includeFacebookGroupBonus!==false,
        commentText:safe(p.commentText,250),
        claimHours:safe(p.claimHours,10),
        winnerTool:safe(p.winnerTool,100),
        giveawayEnds:safe(p.giveawayEnds,180),
        cod:safe(p.cod,180),
        postage:safe(p.postage,100),
        carousellMalaysiaUrl:appContext.safeHttpUrl(p.carousellMalaysiaUrl),
        carousellSingaporeUrl:appContext.safeHttpUrl(p.carousellSingaporeUrl),
        hashtags:safe(p.hashtags,500),
        includeMultiGroupNotice:!!p.includeMultiGroupNotice
      }));
    }catch{}
  }

function giveawayNumberFromTitle(title){
    const match=String(title||"").match(/giveaway\s*#?\s*(\d+)/i);
    return match ? match[1] : "";
  }

function formatGiveawayEndsGmt8(value){
    if(!value) return "";
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return "";

    try{
      const datePart=new Intl.DateTimeFormat("en-GB",{
        timeZone:"Asia/Kuala_Lumpur",
        day:"numeric",
        month:"long"
      }).format(date);

      const timePart=new Intl.DateTimeFormat("en-US",{
        timeZone:"Asia/Kuala_Lumpur",
        hour:"numeric",
        minute:"2-digit",
        hour12:true
      }).format(date);

      const weekday=new Intl.DateTimeFormat("en-US",{
        timeZone:"Asia/Kuala_Lumpur",
        weekday:"long"
      }).format(date);

      return appContext.compactGeneratedPostSpacing(`${datePart} at ${timePart} GMT+8 (${weekday})`);
    }catch{
      return "";
    }
  }

function getGiveawayShareUrl(giveawayId){
    const base=`${location.origin}${location.pathname}`;
    const id=String(giveawayId||"").trim();
    return id
      ? `${base}#/giveaway?winner=${encodeURIComponent(id)}`
      : `${base}#/giveaway`;
  }

function buildGiveawayWinnerAnnouncementPost(selectedWinners,language="en"){
    const rows=(Array.isArray(selectedWinners)?selectedWinners:[])
      .filter(appContext.isPastGiveawayWinner);

    if(!rows.length) return "";

    const giveawayLink=rows.length===1
      ? appContext.getGiveawayShareUrl(rows[0].id)
      : appContext.getGiveawayShareUrl();

    const plural=rows.length>1;
    const text=appContext.postLocale(language);
    const lines=[
      `🎁 Giveaway: ${giveawayLink}`,
      "",
      `🎉 ${appContext.replacePostTokens(text.winnerAnnouncement,{plural:plural?"S":""})} 🎉`,
      "",
      text.results,
      "",
      text.congratulations,
      ""
    ];

    rows.forEach((winner,index)=>{
      const name=String(winner.winner_name||"Winner").trim()||"Winner";
      const profile=appContext.safePublicProfileUrl(winner.winner_profile_url);
      const prize=String(winner.card_name||winner.title||"Giveaway Prize").trim()||"Giveaway Prize";
      const number=rows.length>1 ? `${index+1}. ` : "";

      lines.push(
        `🏆 ${number}${name}${profile ? ` — ${profile}` : ""}`,
        `🎁 ${text.prize}: ${prize}`
      );

      if(index<rows.length-1) lines.push("");
    });

    lines.push(
      "",
      text.winnerThanks,
      "",
      text.winnerSupport,
      "",
      appContext.replacePostTokens(text.winnerEnd,{target:plural?"all our winners":"our winner"}),
      "",
      "— Collect TCG MY & SG"
    );

    return appContext.compactGeneratedPostSpacing(lines.join("\n"));
  }

function renderGiveawayWinnerPostGeneratorPage(){
    if(!appContext.requireOwner("open giveaway winner post generator")) return;

    const pastWinners=appContext.sortedPastGiveawayWinners();
    const selectedIds=new Set();

    appContext.view.innerHTML=`
      <div class="page-head fb-post-page-head">
        <div>
          <div class="eyebrow">Owner Tool</div>
          <h2>Giveaway Winner Post Generator</h2>
          <p>Select saved Past Winners. Each selected winner is automatically matched with the prize and Facebook profile saved on that giveaway.</p>
        </div>
      </div>

      <div class="fb-card-list-layout">
        <section class="panel fb-card-list-builder">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">1 · Past Winners</div>
              <h3>Select Winners</h3>
            </div>
            <div class="fb-post-copy-actions">
              <button type="button" class="btn-ghost" id="winnerPostSelectAllBtn">Select All</button>
              <button type="button" class="btn-ghost" id="winnerPostClearBtn">Clear</button>
            </div>
          </div>

          <div class="field">
            <label for="winnerPostSearch">Find a past winner</label>
            <input id="winnerPostSearch" type="search" maxlength="120" placeholder="Winner, giveaway or prize…">
          </div>

          ${appContext.postLanguageSelectHTML("winnerPostLanguage",appContext.getPostGeneratorLanguage())}

          <div class="hint" id="winnerPostSelectionCount" style="margin-bottom:10px;"></div>
          <div class="fb-card-list-selection-list" id="winnerPostSelectionList"></div>
        </section>

        <section class="panel fb-post-output-panel">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">2 · Preview & Copy</div>
              <h3>Winner Announcement</h3>
            </div>
            <div class="fb-post-copy-actions">
              <button type="button" class="btn-primary" id="winnerPostCopyBtn" disabled>Copy Post</button>
            </div>
          </div>

          <div class="winner-post-images" id="winnerPostImages"></div>

          <textarea id="winnerPostOutput" class="fb-post-output" readonly></textarea>

          <div class="fb-post-bottom-actions">
            <button type="button" class="btn-ghost" id="winnerPostDownloadImagesBtn" disabled>Download Images</button>
            <a class="btn-ghost" href="#/giveaway">Open Past Winners</a>
          </div>
        </section>
      </div>
    `;

    const list=appContext.$("winnerPostSelectionList");
    const search=appContext.$("winnerPostSearch");
    const languageInput=appContext.$("winnerPostLanguage");
    const count=appContext.$("winnerPostSelectionCount");
    const output=appContext.$("winnerPostOutput");
    const copyBtn=appContext.$("winnerPostCopyBtn");
    const imagesWrap=appContext.$("winnerPostImages");
    const downloadImagesBtn=appContext.$("winnerPostDownloadImagesBtn");

    function selectedRows(){
      return pastWinners.filter(g=>selectedIds.has(String(g.id)));
    }

    function winnerImageUrl(row){
      return appContext.safeHttpUrl(row?.image_url||row?.winner_image_url||row?.card_image_url||"");
    }

    function selectedWinnerImages(){
      const seen=new Set();
      return selectedRows()
        .map(row=>({row,url:winnerImageUrl(row)}))
        .filter(item=>{
          if(!item.url || seen.has(item.url)) return false;
          seen.add(item.url);
          return true;
        });
    }

    function renderWinnerImages(){
      const items=selectedWinnerImages();
      downloadImagesBtn.disabled=!items.length;

      imagesWrap.innerHTML=items.length
        ? items.map((item,index)=>`
            <div class="winner-post-image-card">
              <div class="winner-post-image-frame">
                <img src="${appContext.escapeHtml(item.url)}"
                     alt="${appContext.escapeHtml(item.row?.title||item.row?.card_name||`Giveaway image ${index+1}`)}"
                     loading="lazy">
              </div>
              <div class="winner-post-image-copy">
                <strong>${appContext.escapeHtml(item.row?.title||"Giveaway")}</strong>
                <small>${appContext.escapeHtml(item.row?.card_name||"Giveaway Prize")}</small>
              </div>
            </div>
          `).join("")
        : `<div class="winner-post-no-images">Select a Past Winner to preview the giveaway image.</div>`;
    }

    function renderOutput(){
      const rows=selectedRows();
      output.value=appContext.buildGiveawayWinnerAnnouncementPost(rows,languageInput.value);
      copyBtn.disabled=!rows.length;
      count.textContent=`${rows.length} selected · ${pastWinners.length} Past Winner${pastWinners.length===1?"":"s"} available`;
      renderWinnerImages();
    }

    function matchesSearch(g){
      const q=appContext.normalizeFilterValue(search.value);
      if(!q) return true;
      const hay=[
        g.winner_name,
        g.title,
        g.card_name,
        g.winner_profile_url,
        appContext.giveawayWinnerDateLabel(g.gave_away_date || g.winner_announced_at)
      ].map(v=>appContext.normalizeFilterValue(v)).join(" ");
      return hay.includes(q);
    }

    function renderList(){
      const visible=pastWinners.filter(matchesSearch);

      list.innerHTML=visible.length
        ? visible.map(g=>{
            const id=String(g.id);
            const checked=selectedIds.has(id);
            const profile=appContext.safePublicProfileUrl(g.winner_profile_url);
            return `
              <label class="fb-card-list-select-row">
                <input type="checkbox"
                       data-winner-post-id="${appContext.escapeHtml(id)}"
                       ${checked?"checked":""}>
                <span class="fb-card-list-select-copy">
                  <strong>${appContext.escapeHtml(g.winner_name||"Winner")}</strong>
                  <small>${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.title))} · Prize: ${appContext.escapeHtml(appContext.giveawayDisplayTitle(g.card_name||"Giveaway Prize"))}</small>
                  ${profile ? `<small>${appContext.escapeHtml(profile)}</small>` : `<small>No Facebook profile link saved</small>`}
                </span>
              </label>
            `;
          }).join("")
        : `<div class="empty">No Past Winners match this search.</div>`;

      list.querySelectorAll("[data-winner-post-id]").forEach(input=>{
        input.addEventListener("change",()=>{
          const id=String(input.dataset.winnerPostId||"");
          if(input.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          renderOutput();
        });
      });

      renderOutput();
    }

    search.addEventListener("input",renderList);
    languageInput.addEventListener("change",()=>{
      appContext.savePostGeneratorLanguage(languageInput.value);
      renderOutput();
    });

    appContext.$("winnerPostSelectAllBtn")?.addEventListener("click",()=>{
      pastWinners.forEach(g=>selectedIds.add(String(g.id)));
      renderList();
    });

    appContext.$("winnerPostClearBtn")?.addEventListener("click",()=>{
      selectedIds.clear();
      renderList();
    });

    postFormatInput.addEventListener("change",syncPostFormatUI);

    copyBtn.addEventListener("click",()=>{
      appContext.copyPlainText(output.value,"Winner announcement copied");
    });

    downloadImagesBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("download giveaway winner images")) return;

      const items=selectedWinnerImages();
      if(!items.length){
        appContext.showToast("No giveaway images available");
        return;
      }

      const old=downloadImagesBtn.textContent;
      downloadImagesBtn.disabled=true;

      try{
        if(items.length===1){
          downloadImagesBtn.textContent="Downloading…";
          await appContext.downloadImageSource(
            items[0].url,
            items[0].row?.title||items[0].row?.card_name||"giveaway-winner",
            1
          );
          appContext.showToast("Giveaway image downloaded");
        }else{
          const ZipCtor=await appContext.ensureJsZip();
          const zip=new ZipCtor();
          let added=0;
          const failed=[];

          for(let i=0;i<items.length;i++){
            downloadImagesBtn.textContent=`Preparing ${i+1}/${items.length}`;
            try{
              const blob=await appContext.imageSourceToBlob(items[i].url);
              const ext=appContext.imageExtensionFromBlob(blob);
              const base=appContext.safeDownloadName(
                items[i].row?.title||items[i].row?.card_name||`giveaway-${i+1}`
              );
              zip.file(`${String(i+1).padStart(2,"0")} - ${base}.${ext}`,blob);
              added++;
            }catch(err){
              failed.push(i+1);
              console.warn("Could not add giveaway winner image to ZIP:",err);
            }
          }

          if(!added){
            appContext.showToast("No giveaway images could be downloaded");
            return;
          }

          const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
          const href=URL.createObjectURL(blob);
          const a=document.createElement("a");
          a.href=href;
          a.download=`Collect-TCG-Giveaway-Winners-${new Date().toISOString().slice(0,10)}.zip`;
          a.rel="noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(()=>URL.revokeObjectURL(href),1000);

          appContext.showToast(failed.length
            ? `${added} image${added===1?"":"s"} downloaded · ${failed.length} skipped`
            : `${added} giveaway images downloaded`);
        }
      }finally{
        downloadImagesBtn.textContent=old;
        downloadImagesBtn.disabled=!selectedWinnerImages().length;
      }
    });

    renderList();
  }

function buildFbGiveawayPost(values,sourceGiveaway=null){
    const divider="━━━━━━━━━━━━━━━━━━━━━━━━";
    const text=appContext.postLocale(values.language);
    const number=String(values.giveawayNumber||"").trim().replace(/^#/,"")||"1";
    const winnerHeadline=String(values.winnerHeadline||"").trim();
    const prizeLine=String(values.prizeLine||"").trim();
    const commentText=String(values.commentText||"").trim();
    const giveawayComment=commentText
      ? `${commentText} + your Instagram handle`
      : "Your comment + your Instagram handle";
    const claimHours=String(values.claimHours||"24").trim()||"24";
    const winnerTool=String(values.winnerTool||"Wheel of Names").trim()||"Wheel of Names";
    const giveawayEnds=String(values.giveawayEnds||"").trim();
    const cod=String(values.cod||"").trim();
    const postage=String(values.postage||"").trim();
    const hashtags=String(values.hashtags||"").trim();

    const lines=[
      `🎁 GIVEAWAY #${number} 🎁`,
      `🏆 ${winnerHeadline}`,
      `🥇 ${prizeLine}`,
      divider,
      text.howToEnter,
      ...(()=>{
        const steps=[];
        let n=1;
        if(!sourceGiveaway || sourceGiveaway.require_facebook!==false){
          steps.push(`${n++}️⃣ ${text.followFacebook}: ${appContext.safeHttpUrl(values.facebookPageUrl)||"[LINK NOT SET]"}`);
        }
        if(!sourceGiveaway || sourceGiveaway.require_instagram!==false){
          steps.push(`${n++}️⃣ ${text.followInstagram}: ${appContext.safeHttpUrl(values.instagramUrl)||"[LINK NOT SET]"}`);
        }
        if(!sourceGiveaway || sourceGiveaway.require_comment!==false){
          steps.push(`${n++}️⃣ ${text.comment}: ${giveawayComment}`);
        }
        if(sourceGiveaway?.require_website_code){
          steps.push(`${n++}️⃣ ${text.visitCode}: ${appContext.getGiveawayShareUrl()}`);
        }
        if(appContext.safeHttpUrl(sourceGiveaway?.entry_form_url)){
          steps.push(`${n++}️⃣ ${text.submit}: ${appContext.safeHttpUrl(sourceGiveaway.entry_form_url)}`);
        }
        return steps;
      })(),
      divider,
      text.important,
      text.eligible,
      "",
      text.contactWinner,
      appContext.replacePostTokens(text.contactWinnerText,{hours:claimHours}),
      ""
    ];

    {
      const bonusLines=[];
      const facebookGroupUrl=appContext.safeHttpUrl(values.facebookGroupUrl);
      if(values.includeFacebookGroupBonus && facebookGroupUrl){
        bonusLines.push(`${text.joinGroup}: ${facebookGroupUrl}`);
      }
      if(sourceGiveaway?.bonus_share_facebook) bonusLines.push(text.shareFacebook);
      if(sourceGiveaway?.bonus_tag_friends) bonusLines.push(text.tagFriends);
      if(sourceGiveaway?.bonus_share_instagram_story) bonusLines.push(text.shareStory);

      if(bonusLines.length){
        lines.push(
          text.bonus,
          ...bonusLines,
          ""
        );
      }
    }

    if(values.includeMultiGroupNotice){
      lines.push(
        text.groups,
        text.groupsText,
        ""
      );
    }

    lines.push(
      text.selection,
      appContext.replacePostTokens(text.selectionText,{tool:winnerTool}),
      "",
      text.verification,
      text.verificationText,
      "",
      text.luck,
      divider,
      `${text.ends}: ${giveawayEnds}`,
      `📍 COD: ${cod}`,
      `${text.postage}: ${postage}`,
      divider,
      text.explore,
      `WEBSITE : ${appContext.getWebsiteShareUrl()}`,
      `COLLECTION : ${location.origin}${location.pathname}#/collection`,
      divider,
      "HASHTAG :",
      hashtags
    );

    return appContext.compactGeneratedPostSpacing(lines.join("\n"));
  }

function renderFbGiveawayPostGeneratorPage(){
    if(!appContext.requireOwner("open giveaway post generator")) return;

    const prefs=appContext.getFbGiveawayPostPrefs();
    const giveawayRows=appContext.giveaways
      .slice()
      .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));

    appContext.view.innerHTML=`
      <div class="page-head fb-post-page-head">
        <div>
          <div class="eyebrow">Owner Tool</div>
          <h2>Facebook Giveaway Post Generator</h2>
          <p>Load an existing giveaway if useful, then edit the reusable Facebook giveaway template.</p>
        </div>
      </div>

      <div class="fb-post-layout fb-giveaway-layout">
        <section class="panel fb-post-builder fb-giveaway-builder">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">1 · Giveaway</div>
              <h3>Prize & Headline</h3>
            </div>
          </div>

          <div class="field">
            <label for="fbGiveawaySourceSelect">Load existing Giveaway <span class="field-optional">(optional)</span></label>
            <select id="fbGiveawaySourceSelect">
              <option value="">Manual template</option>
              ${giveawayRows.map(g=>`
                <option value="${appContext.escapeHtml(g.id)}">
                  ${appContext.escapeHtml([appContext.giveawayDisplayTitle(g.title),appContext.giveawayDisplayTitle(g.card_name)].filter(Boolean).join(" · ")||"Giveaway")}
                </option>
              `).join("")}
            </select>
            <div class="hint">Loading a giveaway can fill the prize name, giveaway number and GMT+8 end time. The Facebook template remains editable.</div>
          </div>

          <div id="fbGiveawaySelected" class="fb-post-selected-card" hidden></div>

          <div class="fb-giveaway-two-col">
            <div class="field">
              <label for="fbGiveawayNumber">Giveaway number</label>
              <input id="fbGiveawayNumber" maxlength="20" value="${appContext.escapeHtml(prefs.giveawayNumber)}">
            </div>
            <div class="field">
              <label for="fbGiveawayClaimHours">Claim window (hours)</label>
              <input id="fbGiveawayClaimHours" inputmode="numeric" maxlength="10" value="${appContext.escapeHtml(prefs.claimHours)}">
            </div>
          </div>

          <div class="field">
            <label for="fbGiveawayWinnerHeadline">Winner headline</label>
            <input id="fbGiveawayWinnerHeadline" maxlength="250" value="${appContext.escapeHtml(prefs.winnerHeadline)}">
          </div>

          <div class="field">
            <label for="fbGiveawayPrizeLine">Prize line</label>
            <input id="fbGiveawayPrizeLine" maxlength="350" value="${appContext.escapeHtml(prefs.prizeLine)}">
          </div>

          ${appContext.postLanguageSelectHTML("fbGiveawayLanguage",appContext.getPostGeneratorLanguage())}

          <div class="fb-card-list-settings-divider"></div>
          <div class="eyebrow">2 · Entry Conditions</div>

          <div class="fb-giveaway-condition-card">
            <strong>Condition 1</strong>
            <span>Like the giveaway post and follow both official social pages.</span>
          </div>

          <div class="fb-giveaway-two-col">
            <div class="field">
              <label for="fbGiveawayFacebookPageUrl">Facebook Page URL</label>
              <input id="fbGiveawayFacebookPageUrl" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.facebookPageUrl)}">
              <div class="hint"><a href="${appContext.escapeHtml(prefs.facebookPageUrl)}" target="_blank" rel="noopener noreferrer">Open Facebook Page ↗</a></div>
            </div>
            <div class="field">
              <label for="fbGiveawayInstagramUrl">Instagram URL</label>
              <input id="fbGiveawayInstagramUrl" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.instagramUrl)}">
              <div class="hint"><a href="${appContext.escapeHtml(prefs.instagramUrl)}" target="_blank" rel="noopener noreferrer">Open Instagram ↗</a></div>
            </div>
          </div>

          <div class="field">
            <label class="fb-giveaway-check">
              <input id="fbGiveawayFacebookGroupBonus" type="checkbox" ${prefs.includeFacebookGroupBonus?"checked":""}>
              <span>Include “Join / Follow our Facebook Group” as +1 bonus entry</span>
            </label>
            <label for="fbGiveawayFacebookGroupUrl">Facebook Group URL</label>
            <input id="fbGiveawayFacebookGroupUrl" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.facebookGroupUrl)}">
            <div class="hint">
              <a href="${appContext.escapeHtml(prefs.facebookGroupUrl)}" target="_blank" rel="noopener noreferrer">Open Facebook Group ↗</a>
            </div>
          </div>

          <div class="fb-giveaway-condition-card">
            <strong>Condition 2</strong>
            <span>Set the comment text participants must leave. They must also include their own Instagram handle.</span>
          </div>

          <div class="field">
            <label for="fbGiveawayCommentText">Comment:</label>
            <input id="fbGiveawayCommentText" maxlength="250" value="${appContext.escapeHtml(prefs.commentText)}" placeholder="Type the required comment here">
            <div class="hint">Participants will be asked to include their own Instagram handle with the comment.</div>
          </div>

          <div class="fb-card-list-settings-divider"></div>
          <div class="eyebrow">3 · Draw & Fulfilment</div>

          <div class="field">
            <label for="fbGiveawayWinnerTool">Winner selection tool</label>
            <input id="fbGiveawayWinnerTool" maxlength="100" value="${appContext.escapeHtml(prefs.winnerTool)}">
          </div>

          <div class="field">
            <label for="fbGiveawayEnds">Giveaway ends text</label>
            <input id="fbGiveawayEnds" maxlength="180" value="${appContext.escapeHtml(prefs.giveawayEnds)}">
            <div class="hint">Example: 23 August at 10:00 PM GMT+8 (Sunday)</div>
          </div>

          <div class="field">
            <label class="fb-giveaway-check">
              <input id="fbGiveawayMultiGroup" type="checkbox" ${prefs.includeMultiGroupNotice?"checked":""}>
              <span>Include the “shared across multiple groups” notice</span>
            </label>
          </div>

          <div class="fb-giveaway-two-col">
            <div class="field">
              <label for="fbGiveawayCod">COD</label>
              <input id="fbGiveawayCod" maxlength="180" value="${appContext.escapeHtml(prefs.cod)}">
            </div>
            <div class="field">
              <label for="fbGiveawayPostage">Postage</label>
              <input id="fbGiveawayPostage" maxlength="100" value="${appContext.escapeHtml(prefs.postage)}">
            </div>
          </div>

          <details class="fb-post-settings">
            <summary>Carousell links & hashtags</summary>
            <div class="fb-post-settings-body">
              <div class="field">
                <label for="fbGiveawayCarousellMY">Carousell Malaysia URL</label>
                <input id="fbGiveawayCarousellMY" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.carousellMalaysiaUrl)}">
              </div>
              <div class="field">
                <label for="fbGiveawayCarousellSG">Carousell Singapore URL</label>
                <input id="fbGiveawayCarousellSG" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.carousellSingaporeUrl)}">
              </div>
              <div class="field">
                <label for="fbGiveawayHashtags">Hashtags</label>
                <textarea id="fbGiveawayHashtags" rows="3" maxlength="500">${appContext.escapeHtml(prefs.hashtags)}</textarea>
              </div>
            </div>
          </details>

          <div class="fb-giveaway-template-note">
            Facebook output uses normal emoji characters. The copied fbcdn emoji-image URLs are intentionally not included.
          </div>
        </section>

        <section class="panel fb-post-output-panel fb-giveaway-preview">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">4 · Preview & Copy</div>
              <h3>Giveaway Post</h3>
            </div>
            <div class="fb-post-copy-actions">
              <button type="button" class="btn-ghost" id="fbGiveawayCopyBtn">Copy Full Post</button>
              <button type="button" class="btn-primary fb-prepare-btn" id="fbGiveawayPrepareBtn">Prepare Facebook Post</button>
            </div>
          </div>

          <textarea id="fbGiveawayOutput" class="fb-post-output fb-giveaway-output" readonly></textarea>

          <div class="fb-post-bottom-actions">
            <button type="button" class="btn-ghost" id="fbGiveawayDownloadImageBtn" disabled>Download Giveaway Image</button>
            <a class="btn-ghost" href="#/giveaway">Open Giveaway Page</a>
          </div>
        </section>
      </div>
    `;

    const sourceSelect=appContext.$("fbGiveawaySourceSelect");
    const output=appContext.$("fbGiveawayOutput");
    const selectedMount=appContext.$("fbGiveawaySelected");
    const copyBtn=appContext.$("fbGiveawayCopyBtn");
    const prepareBtn=appContext.$("fbGiveawayPrepareBtn");
    const downloadBtn=appContext.$("fbGiveawayDownloadImageBtn");

    const inputs={
      giveawayNumber:appContext.$("fbGiveawayNumber"),
      winnerHeadline:appContext.$("fbGiveawayWinnerHeadline"),
      prizeLine:appContext.$("fbGiveawayPrizeLine"),
      language:appContext.$("fbGiveawayLanguage"),
      facebookPageUrl:appContext.$("fbGiveawayFacebookPageUrl"),
      instagramUrl:appContext.$("fbGiveawayInstagramUrl"),
      facebookGroupUrl:appContext.$("fbGiveawayFacebookGroupUrl"),
      includeFacebookGroupBonus:appContext.$("fbGiveawayFacebookGroupBonus"),
      commentText:appContext.$("fbGiveawayCommentText"),
      claimHours:appContext.$("fbGiveawayClaimHours"),
      winnerTool:appContext.$("fbGiveawayWinnerTool"),
      giveawayEnds:appContext.$("fbGiveawayEnds"),
      cod:appContext.$("fbGiveawayCod"),
      postage:appContext.$("fbGiveawayPostage"),
      carousellMalaysiaUrl:appContext.$("fbGiveawayCarousellMY"),
      carousellSingaporeUrl:appContext.$("fbGiveawayCarousellSG"),
      hashtags:appContext.$("fbGiveawayHashtags"),
      includeMultiGroupNotice:appContext.$("fbGiveawayMultiGroup")
    };

    let selectedGiveaway=null;

    function currentValues(){
      return {
        giveawayNumber:inputs.giveawayNumber.value,
        winnerHeadline:inputs.winnerHeadline.value,
        prizeLine:inputs.prizeLine.value,
        language:inputs.language.value,
        facebookPageUrl:inputs.facebookPageUrl.value,
        instagramUrl:inputs.instagramUrl.value,
        facebookGroupUrl:inputs.facebookGroupUrl.value,
        includeFacebookGroupBonus:inputs.includeFacebookGroupBonus.checked,
        commentText:inputs.commentText.value,
        claimHours:inputs.claimHours.value,
        winnerTool:inputs.winnerTool.value,
        giveawayEnds:inputs.giveawayEnds.value,
        cod:inputs.cod.value,
        postage:inputs.postage.value,
        carousellMalaysiaUrl:inputs.carousellMalaysiaUrl.value,
        carousellSingaporeUrl:inputs.carousellSingaporeUrl.value,
        hashtags:inputs.hashtags.value,
        includeMultiGroupNotice:inputs.includeMultiGroupNotice.checked
      };
    }

    function updateOutput(){
      const values=currentValues();
      appContext.savePostGeneratorLanguage(values.language);
      appContext.saveFbGiveawayPostPrefs(values);
      output.value=appContext.buildFbGiveawayPost(values,selectedGiveaway);
      copyBtn.disabled=!output.value.trim();
      prepareBtn.disabled=!output.value.trim();
      downloadBtn.disabled=!appContext.safeHttpUrl(selectedGiveaway?.image_url||"");
    }

    function renderSelectedGiveaway(){
      if(!selectedGiveaway){
        selectedMount.hidden=true;
        selectedMount.innerHTML="";
        return;
      }

      const image=appContext.safeHttpUrl(selectedGiveaway.image_url||"");
      selectedMount.hidden=false;
      selectedMount.innerHTML=`
        <div class="fb-post-card-image">
          ${image
            ? `<img src="${appContext.escapeHtml(image)}" alt="${appContext.escapeHtml(selectedGiveaway.card_name||selectedGiveaway.title||"Giveaway")}">`
            : `<div class="fb-post-no-image">No image</div>`}
        </div>
        <div class="fb-post-card-copy">
          <strong>${appContext.escapeHtml(selectedGiveaway.title||"Giveaway")}</strong>
          <span>${appContext.escapeHtml(selectedGiveaway.card_name||"No prize name")}</span>
          <small>${appContext.escapeHtml(selectedGiveaway.status||"active")}${selectedGiveaway.ends_at ? ` · ${appContext.escapeHtml(appContext.formatGiveawayEndsGmt8(selectedGiveaway.ends_at))}` : ""}</small>
          ${appContext.giveawayGrowthFieldsSupported===true ? `
            <div class="fb-giveaway-growth-summary">
              <b>Entry setup</b>
              <span>${selectedGiveaway.require_facebook ? "✓ Facebook" : "— Facebook"}</span>
              <span>${selectedGiveaway.require_instagram ? "✓ Instagram" : "— Instagram"}</span>
              <span>${selectedGiveaway.require_comment ? "✓ Comment" : "— Comment"}</span>
              <span>${selectedGiveaway.require_website_code ? "✓ Website code" : "— Website code"}</span>
              <span>${appContext.safeHttpUrl(selectedGiveaway.entry_form_url) ? "✓ Entry form" : "— Entry form"}</span>
              <span>${selectedGiveaway.bonus_join_facebook_group ? "✓ Facebook Group +1" : "— Facebook Group +1"}</span>
              <span>${(selectedGiveaway.bonus_share_facebook||selectedGiveaway.bonus_tag_friends||selectedGiveaway.bonus_share_instagram_story) ? "✓ Other bonus actions" : "— Other bonus actions"}</span>
            </div>
          ` : ""}
        </div>
      `;
    }

    function loadGiveaway(id){
      selectedGiveaway=appContext.giveaways.find(g=>String(g.id)===String(id))||null;

      if(selectedGiveaway){
        const parsedNumber=appContext.giveawayNumberFromTitle(selectedGiveaway.title);
        if(parsedNumber) inputs.giveawayNumber.value=parsedNumber;
        if(selectedGiveaway.card_name) inputs.prizeLine.value=selectedGiveaway.card_name;

        const ends=appContext.formatGiveawayEndsGmt8(selectedGiveaway.ends_at);
        if(ends) inputs.giveawayEnds.value=ends;
        inputs.includeFacebookGroupBonus.checked=selectedGiveaway.bonus_join_facebook_group===true;
      }

      renderSelectedGiveaway();
      updateOutput();
    }

    sourceSelect.addEventListener("change",()=>loadGiveaway(sourceSelect.value));

    Object.values(inputs).forEach(input=>{
      const eventName=input.type==="checkbox" ? "change" : "input";
      input.addEventListener(eventName,updateOutput);
      if(eventName!=="change") input.addEventListener("change",updateOutput);
    });

    copyBtn.addEventListener("click",()=>{
      appContext.copyPlainText(output.value,"Giveaway post copied");
    });

    downloadBtn.addEventListener("click",async()=>{
      if(!selectedGiveaway || !appContext.requireOwner("download giveaway image")) return;
      const image=appContext.safeHttpUrl(selectedGiveaway.image_url||"");
      if(!image){
        appContext.showToast("No giveaway image available");
        return;
      }
      await appContext.downloadImageSource(
        image,
        selectedGiveaway.card_name||selectedGiveaway.title||"Collect-TCG-Giveaway",
        1
      );
    });

    prepareBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("prepare giveaway Facebook post")) return;
      if(!output.value.trim()){
        appContext.showToast("No giveaway post to prepare");
        return;
      }

      const original=prepareBtn.textContent;
      prepareBtn.disabled=true;
      copyBtn.disabled=true;
      downloadBtn.disabled=true;
      prepareBtn.textContent="Preparing…";

      try{
        const copied=await appContext.copyPlainText(output.value,"Giveaway post copied");
        if(!copied) throw new Error("Could not copy giveaway post");

        const image=appContext.safeHttpUrl(selectedGiveaway?.image_url||"");
        if(image){
          prepareBtn.textContent="Downloading giveaway image…";
          await appContext.downloadImageSource(
            image,
            selectedGiveaway.card_name||selectedGiveaway.title||"Collect-TCG-Giveaway",
            1
          );
          appContext.showToast("Giveaway post ready · text copied + image download started");
        }else{
          appContext.showToast("Giveaway post copied");
        }
      }catch(error){
        console.error("Prepare giveaway Facebook post error:",error);
        appContext.showToast("Could not fully prepare giveaway post");
      }finally{
        prepareBtn.textContent=original;
        updateOutput();
      }
    });

    updateOutput();
  }

function defaultCarousellProductDetails(card,language="en"){
    if(!card) return "";

    const lines=[];
    const grade=Array.isArray(card.grading)
      ? card.grading.find(g=>g && String(g.company||"").trim())
      : null;

    const carousellFormatLabel=grade
      ? `${String(grade.company||"").trim().toUpperCase()} ${String(grade.grade||"").trim()}`.trim()
      : (appContext.normalizeFilterValue(appContext.effectiveFormat(card))==="sealed"
          ? "SEALED"
          : appContext.rawConditionPostLabel(card));
    const carousellName=[card.name,card.card_code].filter(Boolean).join(" ").trim();
    if(carousellName){
      lines.push(`【${carousellFormatLabel}】${appContext.postPopLabel(card)}${appContext.postEraLabel(card)} ${carousellName}`.replace(/\s+/g," ").trim());
    }
    const labels={
      en:["Year","Series","Game","Language","Price Terms"],
      ms:["Tahun","Siri","Permainan","Bahasa","Syarat Harga"],
      zh:["年份","系列","游戏","语言","价格条款"],
      ja:["年","シリーズ","ゲーム","言語","価格条件"],
      ko:["연도","시리즈","게임","언어","가격 조건"]
    }[appContext.normalizePostLanguage(language)]||["Year","Series","Game","Language","Price Terms"];
    if(card.year) lines.push(`${labels[0]}: ${card.year}`);
    if(card.series) lines.push(`${labels[1]}: ${String(card.series).trim()}`);
    if(card.game) lines.push(`${labels[2]}: ${String(card.game).trim()}`);
    if(card.language) lines.push(`${labels[3]}: ${String(card.language).trim()}`);

    const savedTerm=appContext.normalizePriceNegotiability(
      card.price_negotiability || appContext.priceNegotiabilityFromNotes(card.notes||"")
    );
    if(savedTerm) lines.push(`${labels[4]}: ${savedTerm}`);

    const publicNotes=appContext.stripPriceNegotiabilityMarker(card.notes||"");
    if(publicNotes) lines.push("",publicNotes);

    return lines.join("\n");
  }

function getCarousellPostPrefs(){
    try{
      const parsed=JSON.parse(appContext.localStorage.getItem(appContext.CAROUSELL_POST_PREFS_KEY)||"{}");
      return {
        productDetails:String(parsed.productDetails||"").slice(0,5000)
      };
    }catch{
      return {productDetails:""};
    }
  }

function saveCarousellPostPrefs(values){
    try{
      appContext.localStorage.setItem(appContext.CAROUSELL_POST_PREFS_KEY,JSON.stringify({
        productDetails:String(values.productDetails||"").slice(0,5000)
      }));
    }catch{}
  }

function buildCarousellPostText(productDetails,language="en"){
    const details=String(productDetails||"").trim()||"[Add product/card explanation here]";
    const selectedLanguage=appContext.normalizePostLanguage(language);
    const text=appContext.postLocale(selectedLanguage);

    if(selectedLanguage!=="en"){
      const local={
        ms:["Mungkin terdapat calar awal atau kecacatan pembuatan.","Sila semak gambar dengan teliti sebelum membeli.","Untuk perlindungan pembeli dan penjual, urusan COD sahaja.","Harga boleh berubah mengikut pasaran.","Tiada trade. Item ini untuk jualan sahaja.","COD hanya di tempat awam di Kuala Lumpur dan Singapura, pada hujung minggu.","Harga akhir mesti dipersetujui sebelum pertemuan. Tiada perubahan semasa urusan.","Item hanya akan ditempah selepas pengesahan pembeli.","Pembeli boleh memeriksa item semasa pertemuan sebelum membuat bayaran.","Bayaran perlu dibuat melalui pindahan bank segera semasa pertemuan.","Sila buat tawaran untuk pertimbangan kami."],
        zh:["可能存在初始刮痕或生产瑕疵。","购买前请仔细查看照片。","为保障买卖双方，仅接受 COD。","价格可能随市场变化。","不接受交换，仅出售。","COD 仅限吉隆坡和新加坡的公共场所，周末进行。","见面前必须确认最终价格，交易时不接受更改。","仅在买方确认后保留商品。","买方可在付款前于见面时检查商品。","见面时须通过即时银行转账付款。","欢迎报价，我们会考虑。"],
        ja:["初期傷や製造上の不具合がある場合があります。","購入前に写真をよくご確認ください。","購入者・販売者双方の保護のため、CODのみです。","価格は市場に合わせて変更される場合があります。","トレード不可、販売のみです。","CODは週末にクアラルンプールおよびシンガポールの公共の場所でのみ可能です。","最終価格は対面前に合意してください。取引中の変更はできません。","商品は購入者の確認後にのみ取り置きします。","購入者は支払い前に対面で商品を確認できます。","支払いは対面時に即時銀行振込でお願いします。","ご検討のため、オファーをお送りください。"],
        ko:["초기 스크래치나 제조상 하자가 있을 수 있습니다.","구매 전 사진을 꼼꼼히 확인해 주세요.","구매자와 판매자 보호를 위해 COD만 가능합니다.","가격은 시장 상황에 따라 변경될 수 있습니다.","교환 불가, 판매만 가능합니다.","COD는 주말에 쿠알라룸푸르와 싱가포르의 공공장소에서만 가능합니다.","최종 가격은 만남 전에 합의해야 하며 거래 중 변경은 불가합니다.","구매자 확인 후에만 상품을 예약합니다.","구매자는 결제 전에 만남에서 상품을 확인할 수 있습니다.","결제는 만남 중 즉시 은행이체로 진행합니다.","검토를 위해 제안 가격을 보내 주세요."]
      }[selectedLanguage];
      return appContext.compactGeneratedPostSpacing([
        text.carousellNoTrade,"",text.productDetails,details,"",text.caution,local[0],local[1],"",text.importantNotes,
        `- ${local[2]}`,`- ${local[3]}`,`- ${local[4]}`,`- ${local[1]}`,"",text.codRules,
        `1. ${local[5]}`,`2. ${local[6]}`,`3. ${local[7]}`,`4. ${local[8]}`,`5. ${local[9]}` ,"",local[10]
      ].join("\n"));
    }

    const lines = [
      "NO TRADE, ONLY SELL",
      "",
      "[Product Details]",
      details,
      "",
      "[Caution]",
      "There may be initial scratches or manufacturing defects.",
      "Please purchase for play/use purposes only.",
      "As these items are stored by an amateur, please refrain from purchasing if you are overly sensitive about condition.",
      "Please do not leave reviews based on the contents/condition alone.",
      "Thank you for viewing.",
      "",
      "[Important Notes]",
      "- For both buyer and seller protection, COD only.",
      "- Price may be subject to change to match the market.",
      "- No trades. Listings are for sale only.",
      "- Please carefully review the photos before purchasing.",
      "- Feel free to ask if you would like additional photos.",
      "- Even PSA 10 cards may contain scratches, dents, holo chipping, whitening, print lines, etc.",
      "- The case itself may have scratches, dirt, embedded dust, or other damage. If you are concerned about such issues, please refrain from purchasing.",
      "",
      "[COD Rules]",
      "1. COD only in public places within Kuala Lumpur & Singapore. Weekends only.",
      "2. Final price must be agreed upon before the meetup. No changes will be accepted during the transaction.",
      "3. If a buyer fails to show up after confirming the deal, future transactions with that party will not be accepted.",
      "4. Please be punctual. A grace period of up to 15 minutes will be given; after that, the meetup may be cancelled.",
      "5. Items will only be reserved upon confirmation from the buyer.",
      "6. Buyer is allowed to inspect the item during the meetup before making payment.",
      "7. Payment must be made during the meetup via instant bank transfer.",
      "8. For both buyer and seller protection, a photo of the item together with the bank transfer receipt/payment proof will be taken upon completion of the transaction to avoid future disputes.",
      "",
      "Thank you for your interest.",
      "Please make an offer so that we may consider it.",
      "",
      "Basic negotiation rules we follow:",
      "1. No lowball offers. Please check the market value beforehand. We recommend using SNKRDUNK and 130 Point for listing and actual sold listings.",
      "2. Please be respectful during negotiations.",
      "3. In good faith, we do not require deposits or advance payments for reservations. However, any backout after confirmation will result in being blacklisted from future dealings."
    ];

    return appContext.compactGeneratedPostSpacing(lines.join("\n"));
  }


function carousellGiveawayImages(giveaway){
    if(!giveaway) return [];
    const out=[];
    const add=value=>{
      const url=appContext.safeHttpUrl(value||"");
      if(url && !out.includes(url)) out.push(url);
    };
    if(Array.isArray(giveaway.images)) giveaway.images.forEach(add);
    add(giveaway.image_url);
    return out.slice(0,10);
  }

function defaultCarousellGiveawayProductDetails(giveaway){
    if(!giveaway) return "";
    const lines=[];
    const prize=String(giveaway.card_name||giveaway.title||"Giveaway prize").trim();
    const title=String(giveaway.title||"").trim();
    if(prize) lines.push(`【GIVEAWAY PRIZE】 ${prize}`);
    if(title && title!==prize) lines.push(`Giveaway: ${title}`);
    if(giveaway.status){
      const status=String(giveaway.status).replace(/_/g," ").trim();
      lines.push(`Giveaway Status: ${status.replace(/\b\w/g,c=>c.toUpperCase())}`);
    }
    if(giveaway.ends_at && typeof appContext.giveawayDateLabel==="function"){
      const label=appContext.giveawayDateLabel(giveaway.ends_at);
      if(label) lines.push(`Giveaway Ends: ${label}`);
    }
    const notes=String(giveaway.details||"").trim();
    if(notes) lines.push("",notes);
    return lines.join("\n");
  }

async function downloadCarousellGiveawayImagesZip(giveaway,progressCallback){
    if(!giveaway) return {added:0,failed:[]};
    const images=appContext.carousellGiveawayImages(giveaway);
    if(!images.length) return {added:0,failed:[]};

    const ZipCtor=await appContext.ensureJsZip();
    const zip=new ZipCtor();
    const failed=[];
    let added=0;
    const base=typeof appContext.safeDownloadName==="function"
      ? appContext.safeDownloadName(giveaway.card_name||giveaway.title||"Collect-TCG-Giveaway")
      : String(giveaway.card_name||giveaway.title||"Collect-TCG-Giveaway").replace(/[\\/:*?"<>|]+/g,"-").trim();

    for(let i=0;i<images.length;i++){
      try{
        const blob=await appContext.imageSourceToBlob(images[i]);
        const ext=appContext.imageExtensionFromBlob(blob);
        zip.file(`${String(i+1).padStart(2,"0")} - ${base}.${ext}`,blob);
        added++;
      }catch(error){
        failed.push({index:i+1,reason:error?.message||"Image could not be read"});
        console.warn("Could not add giveaway image to Carousell ZIP:",giveaway?.id,i+1,error);
      }
      if(progressCallback) progressCallback(i+1,images.length,added,failed.length);
    }

    if(!added){
      const error=new Error("No downloadable giveaway images found");
      error.failed=failed;
      throw error;
    }

    const blob=await zip.generateAsync({
      type:"blob",
      compression:"DEFLATE",
      compressionOptions:{level:6}
    });
    const href=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=href;
    a.download=`${base} - Giveaway Images.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),1500);
    return {added,failed};
  }

function ebayListingTitle(card){
    if(!card) return "";
    const type=appContext.cardListFormat(card);
    const condition=type==="graded" ? appContext.gradedPostLabel(card) : (type==="sealed" ? "Sealed" : appContext.rawConditionPostLabel(card));
    return [card.name,card.card_code,card.series,condition,card.language,appContext.fbGameLabel(card)].map(v=>String(v||"").trim()).filter(Boolean).join(" ").replace(/\s+/g," ").trim().slice(0,80).trim();
  }

function ebayItemSpecifics(card){
    if(!card) return "";
    const type=appContext.cardListFormat(card);
    const rows=[["Game",card.game],["Card Name",card.name],["Card Number",card.card_code],["Set / Series",card.series],["Year",card.year],["Language",card.language],["Condition",type==="graded"?"Graded":type==="sealed"?"Sealed":appContext.rawConditionPostLabel(card)]];
    if(type==="graded") rows.push(["Grade",appContext.gradedPostLabel(card)]);
    return rows.filter(row=>String(row[1]||"").trim()).map(row=>row[0]+": "+String(row[1]).trim()).join("\n");
  }

function ebayListingDescription(card){
    if(!card) return "";
    return appContext.compactGeneratedPostSpacing([String(card.name||"").toUpperCase()+(card.card_code ? " · "+String(card.card_code).toUpperCase() : ""),"",appContext.ebayItemSpecifics(card),"","[ITEM DETAILS]","You will receive the exact card/item shown in the photos.","Please review all photos carefully before purchasing.","Additional photos can be provided on request.","","[SHIPPING]","The item will be packed securely for shipment.","Tracking will be provided after dispatch.","","[COLLECT TCG MY & SG]","More trading cards, vintage cards and tournament cards are available in our inventory."].join("\n"));
  }

function renderEbayListingGeneratorPage(){
    if(!appContext.requireOwner("open eBay listing generator")) return;
    const cards=appContext.cards.filter(card=>appContext.cardLifecycle(card)!=="archived").slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
    appContext.view.innerHTML='<div class="page-head fb-post-page-head"><div><div class="eyebrow">Owner Tool</div><h2>eBay Listing Generator</h2><p>Select an inventory card and copy an eBay-ready title, item specifics and description.</p></div></div><div class="fb-post-layout"><section class="panel fb-post-builder"><div class="fb-post-section-title"><div><div class="eyebrow">1 · Select Card</div><h3>Card Details</h3></div></div><div class="field"><label for="ebayCardSearch">Search cards</label><input id="ebayCardSearch" type="search" maxlength="100" placeholder="Name, code, series, game…"></div><div class="field"><label for="ebayCardSelect">Card</label><select id="ebayCardSelect"><option value="">Select a card…</option></select><div class="hint" id="ebayCardCount"></div></div><div id="ebaySelectedCard" class="fb-post-selected-card" hidden></div></section><section class="panel fb-post-output-panel"><div class="fb-post-section-title"><div><div class="eyebrow">2 · Copy Listing</div><h3>eBay Listing</h3></div></div><div class="field"><label for="ebayTitleOutput">eBay Title <span id="ebayTitleCount">0 / 80</span></label><input id="ebayTitleOutput" type="text" maxlength="80"><div class="hint">Card name · card code · series · grade/condition · language · game.</div></div><div class="fb-post-copy-actions"><button type="button" class="btn-ghost" id="ebayCopyTitle" disabled>Copy Title</button></div><div class="field"><label for="ebaySpecificsOutput">Item Specifics</label><textarea id="ebaySpecificsOutput" rows="8" readonly></textarea></div><div class="fb-post-copy-actions"><button type="button" class="btn-ghost" id="ebayCopySpecifics" disabled>Copy Item Specifics</button></div><div class="field"><label for="ebayDescriptionOutput">Description</label><textarea id="ebayDescriptionOutput" class="fb-post-output" readonly></textarea></div><div class="fb-post-copy-actions"><button type="button" class="btn-ghost" id="ebayCopyDescription" disabled>Copy Description</button><button type="button" class="btn-primary" id="ebayCopyAll" disabled>Copy All</button></div><div class="fb-post-bottom-actions"><button type="button" class="btn-ghost" id="ebayDownloadImages" disabled>Download Images (.ZIP)</button><button type="button" class="btn-ghost" id="ebayOpenCard" disabled>Open Card</button></div></section></div>';
    const search=appContext.$("ebayCardSearch"),select=appContext.$("ebayCardSelect"),count=appContext.$("ebayCardCount"),mount=appContext.$("ebaySelectedCard"),title=appContext.$("ebayTitleOutput"),titleCount=appContext.$("ebayTitleCount"),specifics=appContext.$("ebaySpecificsOutput"),description=appContext.$("ebayDescriptionOutput"),copyTitle=appContext.$("ebayCopyTitle"),copySpecifics=appContext.$("ebayCopySpecifics"),copyDescription=appContext.$("ebayCopyDescription"),copyAll=appContext.$("ebayCopyAll"),downloadImages=appContext.$("ebayDownloadImages"),open=appContext.$("ebayOpenCard");
    let selected=null;
    function renderOptions(){const q=appContext.normalizeFilterValue(search.value);const visible=cards.filter(c=>!q||[c.name,c.card_code,c.series,c.game,c.year,c.language].map(v=>appContext.normalizeFilterValue(v)).join(" ").includes(q));const id=String(selected?.id||select.value||"");select.innerHTML='<option value="">Select a card…</option>'+visible.map(c=>'<option value="'+appContext.escapeHtml(c.id)+'">'+appContext.escapeHtml([c.name,c.card_code,c.series].filter(Boolean).join(" · "))+'</option>').join("");if(id&&visible.some(c=>String(c.id)===id))select.value=id;count.textContent=visible.length+" of "+cards.length+" cards shown";}
    function update(){if(!selected){title.value=specifics.value=description.value="";mount.hidden=true;[copyTitle,copySpecifics,copyDescription,copyAll,downloadImages,open].forEach(b=>b.disabled=true);titleCount.textContent="0 / 80";return;}title.value=appContext.ebayListingTitle(selected);specifics.value=appContext.ebayItemSpecifics(selected);description.value=appContext.ebayListingDescription(selected);titleCount.textContent=title.value.length+" / 80";mount.hidden=false;const image=appContext.getImages(selected)[0]||"";mount.innerHTML='<div class="fb-post-card-image">'+(image?'<img src="'+appContext.escapeHtml(image)+'" alt="">':'<div class="fb-post-no-image">No image</div>')+'</div><div class="fb-post-card-copy"><strong>'+appContext.escapeHtml(selected.name||"Untitled card")+'</strong><span>'+appContext.escapeHtml([selected.card_code,selected.series,selected.year].filter(Boolean).join(" · "))+'</span></div>';[copyTitle,copySpecifics,copyDescription,copyAll,open].forEach(b=>b.disabled=false);downloadImages.disabled=appContext.getImages(selected).length===0;}
    search.addEventListener("input",renderOptions);select.addEventListener("change",()=>{selected=cards.find(card=>String(card.id)===String(select.value))||null;update();});title.addEventListener("input",()=>{titleCount.textContent=title.value.length+" / 80";copyTitle.disabled=!title.value.trim();copyAll.disabled=!title.value.trim();});copyTitle.addEventListener("click",()=>appContext.copyPlainText(title.value,"eBay title copied"));copySpecifics.addEventListener("click",()=>appContext.copyPlainText(specifics.value,"eBay item specifics copied"));copyDescription.addEventListener("click",()=>appContext.copyPlainText(description.value,"eBay description copied"));copyAll.addEventListener("click",()=>appContext.copyPlainText("TITLE\n"+title.value+"\n\nITEM SPECIFICS\n"+specifics.value+"\n\nDESCRIPTION\n"+description.value,"eBay listing copied"));
    downloadImages.addEventListener("click",async()=>{
      if(!selected || !appContext.requireOwner("download eBay listing images")) return;
      if(!appContext.getImages(selected).length){appContext.showToast("No images available");return;}
      const old=downloadImages.textContent;
      downloadImages.disabled=true;
      downloadImages.textContent="Preparing ZIP…";
      try{
        const result=await appContext.downloadSingleCardImagesZip(selected,(done,total)=>{downloadImages.textContent=`Preparing ${done}/${total}`;});
        appContext.showToast(result?.failed?.length
          ? `eBay ZIP downloaded · ${result.added} included · ${result.failed.length} skipped`
          : "eBay images ZIP downloaded");
      }catch(error){
        console.error("eBay image ZIP error:",error);
        appContext.showToast("Could not create image ZIP");
      }finally{
        downloadImages.textContent=old;
        downloadImages.disabled=!selected || appContext.getImages(selected).length===0;
      }
    });
    open.addEventListener("click",()=>{if(selected)appContext.openDetailsModal(selected);});renderOptions();update();
  }

function renderCarousellPostGeneratorPage(){
    if(!appContext.requireOwner("open Carousell post generator")) return;

    const prefs=appContext.getCarousellPostPrefs();
    const selectableCards=appContext.cards
      .filter(card=>appContext.cardLifecycle(card)!=="archived")
      .slice()
      .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));

    const selectableGiveaways=(Array.isArray(appContext.giveaways)?appContext.giveaways:[])
      .filter(g=>String(g.card_name||g.title||"").trim())
      .slice()
      .sort((a,b)=>{
        const aPast=appContext.normalizeFilterValue(a.status)==="gave_away" ? 1 : 0;
        const bPast=appContext.normalizeFilterValue(b.status)==="gave_away" ? 1 : 0;
        return aPast-bPast || String(a.card_name||a.title||"").localeCompare(String(b.card_name||b.title||""));
      });

    const carousellGameOptions=[...new Set(
      selectableCards.map(card=>String(card.game||"").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    const carousellStatusOptions=[...new Set(
      selectableCards.map(card=>String(card.availability||"Available").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    appContext.view.innerHTML=`
      <div class="page-head fb-post-page-head">
        <div>
          <div class="eyebrow">Owner Tool</div>
          <h2>Carousell Post Generator</h2>
          <p>Choose an inventory card or a giveaway prize, review/edit Product Details, then copy the complete Carousell listing template.</p>
        </div>
      </div>

      <div class="fb-post-layout carousell-post-layout">
        <section class="panel fb-post-builder">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">1 · Select Product</div>
              <h3>Product Details</h3>
            </div>
          </div>

          <div class="fb-card-list-selection-toolbar">
            <div class="field fb-card-list-search-field">
              <label for="carousellPostCardSearch">Search cards / giveaways</label>
              <input id="carousellPostCardSearch" type="search" maxlength="100" placeholder="Name, code, series, giveaway title…">
            </div>

            <div class="fb-card-list-filter-row">
              <div class="field">
                <label for="carousellPostSourceFilter">Source</label>
                <select id="carousellPostSourceFilter">
                  <option value="">Cards + giveaways</option>
                  <option value="card">Inventory / Collection</option>
                  <option value="giveaway">Giveaway prizes</option>
                </select>
              </div>
              <div class="field">
                <label for="carousellPostGameFilter">Game</label>
                <select id="carousellPostGameFilter">
                  <option value="">All games</option>
                  ${carousellGameOptions.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="carousellPostStatusFilter">Status</label>
                <select id="carousellPostStatusFilter">
                  <option value="">All statuses</option>
                  ${carousellStatusOptions.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="carousellPostTypeFilter">Type</label>
                <select id="carousellPostTypeFilter">
                  <option value="">All types</option>
                  <option value="graded">Graded</option>
                  <option value="raw">Raw</option>
                  <option value="sealed">Sealed</option>
                </select>
              </div>
            </div>
          </div>

          <div class="field">
            <label for="carousellPostCardSelect">Card / Giveaway Prize <span class="field-optional">(optional)</span></label>
            <select id="carousellPostCardSelect">
              <option value="">Manual product details</option>
            </select>
            <div class="hint" id="carousellPostFilterCount">Selecting an item fills Product Details automatically. Giveaway prizes use their giveaway photos.</div>
          </div>

          <div id="carousellPostSelectedCard" class="fb-post-selected-card" hidden></div>

          <div class="field">
            <label for="carousellProductDetails">Product Details / card explanation</label>
            <textarea id="carousellProductDetails" rows="12" maxlength="5000" placeholder="Explain the card/product here…">${appContext.escapeHtml(prefs.productDetails)}</textarea>
            <div class="hint">You can edit the generated details before copying. The caution, COD and negotiation rules remain fixed in the template.</div>
          </div>

          ${appContext.postLanguageSelectHTML("carousellPostLanguage",appContext.getPostGeneratorLanguage())}
        </section>

        <section class="panel fb-post-output-panel">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">2 · Preview & Copy</div>
              <h3>Carousell Listing Description</h3>
            </div>
            <div class="fb-post-copy-actions">
              <button type="button" class="btn-ghost" id="carousellCopyPostBtn">Copy Full Post</button>
              <button type="button" class="btn-primary" id="carousellPreparePostBtn">Prepare Carousell Post</button>
            </div>
          </div>

          <textarea id="carousellPostOutput" class="fb-post-output carousell-post-output" readonly></textarea>

          <div class="fb-post-bottom-actions">
            <button type="button" class="btn-ghost" id="carousellDownloadImagesBtn" disabled>Download Images (.ZIP)</button>
            <button type="button" class="btn-ghost" id="carousellOpenCardBtn" disabled>Open Card</button>
          </div>
        </section>
      </div>
    `;

    const select=appContext.$("carousellPostCardSelect");
    const searchInput=appContext.$("carousellPostCardSearch");
    const sourceFilter=appContext.$("carousellPostSourceFilter");
    const gameFilter=appContext.$("carousellPostGameFilter");
    const statusFilter=appContext.$("carousellPostStatusFilter");
    const typeFilter=appContext.$("carousellPostTypeFilter");
    const filterCount=appContext.$("carousellPostFilterCount");
    const detailsInput=appContext.$("carousellProductDetails");
    const languageInput=appContext.$("carousellPostLanguage");
    const selectedMount=appContext.$("carousellPostSelectedCard");
    const output=appContext.$("carousellPostOutput");
    const copyBtn=appContext.$("carousellCopyPostBtn");
    const prepareBtn=appContext.$("carousellPreparePostBtn");
    const downloadBtn=appContext.$("carousellDownloadImagesBtn");
    const openCardBtn=appContext.$("carousellOpenCardBtn");

    let selectedCard=null;
    let selectedGiveaway=null;

    function giveawayMatchesSearch(giveaway){
      const q=appContext.normalizeFilterValue(searchInput.value);
      if(!q) return true;
      const hay=[
        giveaway.title,
        giveaway.card_name,
        giveaway.status,
        giveaway.details,
        giveaway.giveaway_code
      ].map(v=>appContext.normalizeFilterValue(v)).join(" ");
      return hay.includes(q);
    }

    function carousellMatchesFilters(card){
      const q=appContext.normalizeFilterValue(searchInput.value);
      const game=appContext.normalizeFilterValue(gameFilter.value);
      const status=appContext.normalizeFilterValue(statusFilter.value);
      const type=appContext.normalizeFilterValue(typeFilter.value);

      if(game && appContext.normalizeFilterValue(card.game)!==game) return false;
      if(status && appContext.normalizeFilterValue(card.availability||"Available")!==status) return false;
      if(type && appContext.cardListFormat(card)!==type) return false;

      if(q){
        const hay=[
          card.name,
          card.card_code,
          card.series,
          card.year,
          card.game,
          card.era,
          card.language,
          card.availability
        ].map(v=>appContext.normalizeFilterValue(v)).join(" ");
        if(!hay.includes(q)) return false;
      }
      return true;
    }

    function renderCarousellCardOptions(){
      const source=sourceFilter.value;
      const visibleCards=source==="giveaway" ? [] : selectableCards.filter(carousellMatchesFilters);

      const giveawayFiltersActive=Boolean(gameFilter.value || statusFilter.value || typeFilter.value);
      const visibleGiveaways=(source==="card" || giveawayFiltersActive)
        ? []
        : selectableGiveaways.filter(giveawayMatchesSearch);

      const currentValue=String(select.value||(
        selectedGiveaway ? `giveaway:${selectedGiveaway.id}` :
        selectedCard ? `card:${selectedCard.id}` : ""
      ));

      const options=[`<option value="">Manual product details</option>`];

      if(visibleCards.length){
        options.push(`<optgroup label="Inventory / Collection">`);
        visibleCards.forEach(card=>{
          options.push(`
            <option value="card:${appContext.escapeHtml(card.id)}">
              ${appContext.escapeHtml(`${card.card_code ? card.card_code+" · " : ""}${card.name}${card.year ? " · "+card.year : ""}`)}
            </option>
          `);
        });
        options.push(`</optgroup>`);
      }

      if(visibleGiveaways.length){
        options.push(`<optgroup label="Giveaway Prizes">`);
        visibleGiveaways.forEach(g=>{
          const status=appContext.normalizeFilterValue(g.status)==="gave_away" ? "Past Winner" : String(g.status||"Active").replace(/_/g," ");
          options.push(`
            <option value="giveaway:${appContext.escapeHtml(g.id)}">
              ${appContext.escapeHtml(`${g.card_name||g.title||"Giveaway prize"} · ${g.title||"Giveaway"} · ${status}`)}
            </option>
          `);
        });
        options.push(`</optgroup>`);
      }

      select.innerHTML=options.join("");

      if(currentValue && [...select.options].some(option=>option.value===currentValue)){
        select.value=currentValue;
      }

      const parts=[];
      if(source!=="giveaway") parts.push(`${visibleCards.length} card${visibleCards.length===1?"":"s"}`);
      if(source!=="card" && !giveawayFiltersActive) parts.push(`${visibleGiveaways.length} giveaway prize${visibleGiveaways.length===1?"":"s"}`);
      filterCount.textContent=`${parts.join(" + ") || "0 items"} shown · selecting an item fills Product Details automatically.${giveawayFiltersActive && source!=="card" ? " Clear Game/Status/Type filters to show giveaway prizes." : ""}`;
    }

    function selectedImages(){
      if(selectedGiveaway) return appContext.carousellGiveawayImages(selectedGiveaway);
      if(selectedCard) return appContext.getImages(selectedCard);
      return [];
    }

    function renderSelected(){
      const selected=selectedGiveaway||selectedCard;
      if(!selected){
        selectedMount.hidden=true;
        selectedMount.innerHTML="";
        downloadBtn.disabled=true;
        openCardBtn.disabled=true;
        openCardBtn.textContent="Open Card";
        return;
      }

      const images=selectedImages();
      const image=images[0]||"";
      const isGiveaway=Boolean(selectedGiveaway);
      selectedMount.hidden=false;
      selectedMount.innerHTML=`
        <div class="fb-post-card-image">
          ${image ? `<img src="${appContext.escapeHtml(image)}" alt="${appContext.escapeHtml(isGiveaway ? (selected.card_name||selected.title||"Giveaway prize") : selected.name)}">` : `<div class="fb-post-no-image">No image</div>`}
        </div>
        <div class="fb-post-card-copy">
          <strong>${appContext.escapeHtml(isGiveaway ? (selected.card_name||selected.title||"Giveaway prize") : (selected.name||"Untitled card"))}</strong>
          <span>${appContext.escapeHtml(isGiveaway
            ? [selected.title,"Giveaway"].filter(Boolean).join(" · ")
            : [selected.card_code,selected.era,selected.year,selected.series].filter(Boolean).join(" · "))}</span>
          <small>${appContext.escapeHtml(isGiveaway
            ? `Giveaway · ${String(selected.status||"active").replace(/_/g," ")}`
            : (selected.availability||"Available"))} · ${images.length} image${images.length===1?"":"s"}</small>
        </div>
      `;
      downloadBtn.disabled=images.length===0;
      openCardBtn.disabled=false;
      openCardBtn.textContent=isGiveaway ? "Open Giveaway" : "Open Card";
    }

    function regenerate(){
      appContext.saveCarousellPostPrefs({productDetails:detailsInput.value});
      appContext.savePostGeneratorLanguage(languageInput.value);
      output.value=appContext.buildCarousellPostText(detailsInput.value,languageInput.value);
      copyBtn.disabled=!output.value.trim();
      prepareBtn.disabled=!output.value.trim();
    }

    function setSelection(value){
      selectedCard=null;
      selectedGiveaway=null;

      const raw=String(value||"");
      if(raw.startsWith("card:")){
        const id=raw.slice(5);
        selectedCard=selectableCards.find(card=>String(card.id)===id)||null;
        if(selectedCard) detailsInput.value=appContext.defaultCarousellProductDetails(selectedCard,languageInput.value);
      }else if(raw.startsWith("giveaway:")){
        const id=raw.slice(9);
        selectedGiveaway=selectableGiveaways.find(g=>String(g.id)===id)||null;
        if(selectedGiveaway) detailsInput.value=appContext.defaultCarousellGiveawayProductDetails(selectedGiveaway);
      }

      renderSelected();
      regenerate();
    }

    select.addEventListener("change",()=>setSelection(select.value));

    [searchInput,sourceFilter,gameFilter,statusFilter,typeFilter].forEach(input=>{
      input.addEventListener("input",renderCarousellCardOptions);
      input.addEventListener("change",renderCarousellCardOptions);
    });

    sourceFilter.addEventListener("change",()=>{
      if(sourceFilter.value==="giveaway"){
        gameFilter.value="";
        statusFilter.value="";
        typeFilter.value="";
      }
      renderCarousellCardOptions();
    });

    renderCarousellCardOptions();

    openCardBtn.addEventListener("click",()=>{
      if(openCardBtn.disabled) return;
      if(selectedGiveaway){
        if(typeof appContext.openGiveawayDetails==="function"){
          appContext.openGiveawayDetails(selectedGiveaway.id);
        }else{
          location.hash="#/giveaway";
        }
        return;
      }
      if(selectedCard) appContext.openDetailsModal(selectedCard);
    });

    detailsInput.addEventListener("input",regenerate);
    detailsInput.addEventListener("change",regenerate);
    languageInput.addEventListener("change",()=>{
      // Regenerate only the automatically supplied details; never overwrite a
      // seller's manual description just because they change template language.
      if(selectedCard) detailsInput.value=appContext.defaultCarousellProductDetails(selectedCard,languageInput.value);
      regenerate();
    });

    copyBtn.addEventListener("click",()=>{
      appContext.copyPlainText(output.value,"Carousell post copied");
    });

    async function downloadSelectedImages(progressCallback){
      if(selectedGiveaway){
        return await appContext.downloadCarousellGiveawayImagesZip(selectedGiveaway,progressCallback);
      }
      if(selectedCard){
        return await appContext.downloadSingleCardImagesZip(selectedCard,progressCallback);
      }
      return {added:0,failed:[]};
    }

    downloadBtn.addEventListener("click",async()=>{
      if((!selectedCard && !selectedGiveaway) || !appContext.requireOwner("download Carousell listing images")) return;
      const images=selectedImages();
      if(!images.length){
        appContext.showToast("No images available");
        return;
      }

      const old=downloadBtn.textContent;
      downloadBtn.disabled=true;
      downloadBtn.textContent="Preparing ZIP…";
      try{
        const result=await downloadSelectedImages((done,total)=>{
          downloadBtn.textContent=`Preparing ${done}/${total}`;
        });
        appContext.showToast(
          result?.failed?.length
            ? `Carousell ZIP downloaded · ${result.added} included · ${result.failed.length} skipped`
            : "Carousell images ZIP downloaded"
        );
      }catch(error){
        console.error("Carousell image ZIP error:",error);
        appContext.showToast("Could not create image ZIP");
      }finally{
        downloadBtn.textContent=old;
        downloadBtn.disabled=selectedImages().length===0;
      }
    });

    prepareBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("prepare Carousell post")) return;
      if(!output.value.trim()){
        appContext.showToast("No Carousell post to prepare");
        return;
      }

      const old=prepareBtn.textContent;
      prepareBtn.disabled=true;
      copyBtn.disabled=true;
      prepareBtn.textContent="Preparing…";

      try{
        const copied=await appContext.copyPlainText(output.value,"Carousell post copied");
        if(!copied) throw new Error("Could not copy Carousell post");

        if((selectedCard||selectedGiveaway) && selectedImages().length){
          prepareBtn.textContent="Creating image ZIP…";
          await downloadSelectedImages();
          appContext.showToast("Carousell post ready · text copied + image ZIP downloaded");
        }else{
          appContext.showToast("Carousell post copied");
        }
      }catch(error){
        console.error("Prepare Carousell post error:",error);
        appContext.showToast("Could not fully prepare Carousell post");
      }finally{
        prepareBtn.textContent=old;
        regenerate();
        downloadBtn.disabled=selectedImages().length===0;
      }
    });

    const params=appContext.currentHashParams();
    const requestedGiveaway=String(params.get("giveaway")||"").trim();
    if(requestedGiveaway){
      const match=selectableGiveaways.find(g=>String(g.id)===requestedGiveaway);
      if(match){
        select.value=`giveaway:${match.id}`;
        setSelection(select.value);
        return;
      }
    }

    const requestedCard=appContext.safeCardId(params.get("card"));
    if(requestedCard){
      const match=selectableCards.find(card=>String(card.id)===requestedCard);
      if(match){
        select.value=`card:${requestedCard}`;
        setSelection(select.value);
        return;
      }
    }

    regenerate();
  }

function getFbCardListPostPrefs(){
    try{
      const p = JSON.parse(appContext.localStorage.getItem(appContext.FB_CARD_LIST_POST_PREFS_KEY) || "{}");
      return {
        listTitle:String(p.listTitle || "AVAILABLE INVENTORY").trim().slice(0,120),
        postFormat:["drop","full"].includes(p.postFormat) ? p.postFormat : "drop",
        dropLimit:[3,4,5,6,8].includes(Number(p.dropLimit)) ? Number(p.dropLimit) : 5,
        dropSelectionMode:p.dropSelectionMode==="selected" ? "selected" : "trending",
        language:appContext.getPostGeneratorLanguage(),
        carousellMalaysiaUrl:appContext.safeHttpUrl(p.carousellMalaysiaUrl || p.carousellShopUrl) || "https://www.carousell.com.my/u/collect_tcg_my_sg/",
        carousellSingaporeUrl:appContext.safeHttpUrl(p.carousellSingaporeUrl) || "https://www.carousell.sg/u/collect_tcg_sg/",
        instagramUrl:appContext.safeHttpUrl(p.instagramUrl) || "https://www.instagram.com/collecttcg.mysg",
        hashtags:String(p.hashtags || "#tcg #onepiece #onepiecetcg #onepiececardgame #TCGCollector").trim().slice(0,500)
      };
    }catch{
      return {
        listTitle:"AVAILABLE INVENTORY",
        postFormat:"drop",
        dropLimit:5,
        dropSelectionMode:"trending",
        language:appContext.getPostGeneratorLanguage(),
        carousellMalaysiaUrl:"https://www.carousell.com.my/u/collect_tcg_my_sg/",
        carousellSingaporeUrl:"https://www.carousell.sg/u/collect_tcg_sg/",
        instagramUrl:"https://www.instagram.com/collecttcg.mysg",
        hashtags:"#tcg #onepiece #onepiecetcg #onepiececardgame #TCGCollector"
      };
    }
  }

function saveFbCardListPostPrefs(p){
    try{
      appContext.localStorage.setItem(appContext.FB_CARD_LIST_POST_PREFS_KEY, JSON.stringify({
        listTitle:String(p.listTitle || "").trim().slice(0,120),
        postFormat:["drop","full"].includes(p.postFormat) ? p.postFormat : "drop",
        dropLimit:[3,4,5,6,8].includes(Number(p.dropLimit)) ? Number(p.dropLimit) : 5,
        dropSelectionMode:p.dropSelectionMode==="selected" ? "selected" : "trending",
        language:appContext.normalizePostLanguage(p.language),
        carousellMalaysiaUrl:appContext.safeHttpUrl(p.carousellMalaysiaUrl),
        carousellSingaporeUrl:appContext.safeHttpUrl(p.carousellSingaporeUrl),
        instagramUrl:appContext.safeHttpUrl(p.instagramUrl),
        hashtags:String(p.hashtags || "").trim().slice(0,500)
      }));
    }catch{}
  }

function ordinalDay(n){
    const v = n % 100;
    if(v >= 11 && v <= 13) return appContext.compactGeneratedPostSpacing(`${n}TH`);
    switch(n % 10){
      case 1:return `${n}ST`;
      case 2:return `${n}ND`;
      case 3:return `${n}RD`;
      default:return `${n}TH`;
    }
  }

function fbCardListDateLabel(date = new Date()){
    const month = date.toLocaleDateString("en-US",{month:"long"}).toUpperCase();
    return `${appContext.ordinalDay(date.getDate())} ${month} ${date.getFullYear()}`;
  }

function cardListFormat(card){
    const format = appContext.normalizeFilterValue(appContext.effectiveFormat(card));
    if(format === "sealed") return "sealed";
    const grades = Array.isArray(card.grading) ? card.grading.filter(g=>g && g.company) : [];
    if(grades.length || format === "graded") return "graded";
    return "raw";
  }

function rawConditionPostLabel(card){
    const c = String(card?.condition || "").trim().toUpperCase();
    if(c === "M") return "Mint";
    if(c && c !== "NA" && c !== "SEALED") return c;
    return "RAW";
  }

function gradedPostLabel(card){
    const grade = Array.isArray(card.grading) ? card.grading.find(g=>g && g.company) : null;
    if(!grade) return "GRADED";
    return `${String(grade.company || "").toUpperCase()} ${String(grade.grade || "").trim()}`.trim();
  }

function cardListPriceLine(card,language="en"){
    const pieces = [];
    if(appContext.hasListedPrice(card.price_myr)) pieces.push(appContext.fmtMYR(card.price_myr));
    if(appContext.hasListedPrice(card.price_usd ?? card.price)) pieces.push(`$${Math.round(Number(card.price_usd ?? card.price)).toLocaleString("en-US")} USD`);
    if(appContext.hasListedPrice(card.price_sgd)) pieces.push(appContext.fmtSGD(card.price_sgd));

    // Pricing terms now come only from the card's saved Pricing terms
    // category. There is no Facebook-level override/default anymore.
    const savedTerm=appContext.normalizePriceNegotiability(
      card.price_negotiability || appContext.priceNegotiabilityFromNotes(card.notes||"")
    );
    const termsSuffix=savedTerm ? ` (${savedTerm.toLowerCase()})` : "";

    const labels={en:["PRICE","PLEASE INQUIRE"],ms:["HARGA","SILA TANYA"],zh:["价格","请询价"],ja:["価格","お問い合わせください"],ko:["가격","문의해 주세요"]};
    const [priceLabel,inquire]=labels[appContext.normalizePostLanguage(language)]||labels.en;
    return appContext.compactGeneratedPostSpacing(`${priceLabel} : ${pieces.length ? pieces.join(" / ") : inquire}${termsSuffix}`);
  }

function cardListGroupHeading(card){
    const year = card.year ? String(card.year) : "";
    const series = String(card.series || "").trim().toUpperCase();
    if(year && series){
      if(series.includes(year)) return series;
      return `${year} ${series}`;
    }
    return series || year || "OTHER";
  }

function cardListItemLine(card){
    const format = appContext.cardListFormat(card);
    const label = format === "graded"
      ? appContext.gradedPostLabel(card)
      : (format === "sealed" ? "SEALED" : appContext.rawConditionPostLabel(card));

    const nameParts = [
      card.year || "",
      String(card.series || "").toUpperCase(),
      String(card.name || "").toUpperCase(),
      String(card.card_code || "").toUpperCase()
    ].filter(Boolean);

    return `-【${label}】${appContext.postPopLabel(card)}${appContext.postEraLabel(card)} ${nameParts.join(" ").replace(/\s+/g," ").trim()}`.replace(/\s+/g," ").trim();
  }

  function dropDisplayText(value){
    const text=String(value||"").trim();
    if(!text || text!==text.toUpperCase()) return text;
    return text.replace(/[A-Z]+(?:'[A-Z]+)?/g,word=>{
      if(word.length<=3 || /^(?:PSA|BGS|CGC|SGC|POP|TCG)$/i.test(word)) return word;
      return `${word.charAt(0)}${word.slice(1).toLowerCase()}`;
    });
  }

  function dropCardName(card){
    const raw=String(card?.name||card?.card_code||"Untitled card").trim();
    const series=String(card?.series||"").trim();
    let name=raw;
    if(series && name.toLocaleLowerCase().startsWith(series.toLocaleLowerCase())){
      name=name.slice(series.length).replace(/^[\s:–—-]+/,"").trim() || raw;
    }
    const code=String(card?.card_code||"").trim();
    const withCode=code && !name.toLocaleLowerCase().includes(code.toLocaleLowerCase()) ? `${name} · ${code}` : name;
    return dropDisplayText(withCode);
  }

  function dropCardLanguageLabel(card){
    const language=dropDisplayText(card?.language);
    const details=String(card?.language_details||"").trim();
    if(!details) return language;
    return language ? `${language}: ${details}` : details;
  }

  function dropCardMetaLine(card){
    const format=appContext.cardListFormat(card);
    const label=format==="graded"
      ? appContext.gradedPostLabel(card)
      : (format==="sealed" ? "Sealed" : appContext.rawConditionPostLabel(card));
    const pop=appContext.postPopLabel(card).replace(/[【】]/g,"");
    return [
      card?.year,
      dropDisplayText(card?.series),
      appContext.dropCardLanguageLabel(card),
      dropDisplayText(label),
      pop,
      dropDisplayText(card?.era)
    ].filter(Boolean).join(" · ");
  }

  function dropCardPriceLine(card,language="en"){
    return appContext.cardListPriceLine(card,language)
      .replace(/^[^:]+\s*:\s*/,"")
      .replace(/\$([\d,]+)\s+USD\b/g,(_match,amount)=>"US$"+amount)
      .replace(/\bSGD\s*([\d,]+)/g,(_match,amount)=>"S$"+amount)
      .replace(/\s*\/\s*/g," · ")
      .replace(/\s*\(([^)]+)\)\s*$/," · $1");
  }

  function dropCardEntryLines(card,index,language="en"){
    return [
      `${index+1}. ${appContext.dropCardName(card)}`,
      appContext.dropCardMetaLine(card),
      appContext.dropCardPriceLine(card,language)
    ].filter(Boolean);
  }

function sortCardListCards(list){
    return list.slice().sort((a,b)=>{
      const ay = Number(a.year || 9999);
      const by = Number(b.year || 9999);
      if(ay !== by) return ay - by;
      const as = String(a.series || "");
      const bs = String(b.series || "");
      const sc = as.localeCompare(bs);
      if(sc) return sc;
      const ag = Number((Array.isArray(a.grading) && a.grading[0]?.grade) || -1);
      const bg = Number((Array.isArray(b.grading) && b.grading[0]?.grade) || -1);
      if(bg !== ag) return bg - ag;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

function buildFbCardListSection(title, cardsInSection, prefs){
    if(!cardsInSection.length) return "";
    const divider = "━━━━━━━━━━━━━━━━━━━━━━━━";
    const lines = [divider,"",title,"",divider,""];

    const groups=[];
    const groupMap=new Map();
    cardsInSection.forEach(card=>{
      const heading=appContext.cardListGroupHeading(card);
      if(!groupMap.has(heading)){
        const group={heading,cards:[]};
        groupMap.set(heading,group);
        groups.push(group);
      }
      groupMap.get(heading).cards.push(card);
    });

    groups.forEach((group,groupIndex)=>{
      if(groupIndex>0) lines.push("");
      lines.push(`【${group.heading}】`,"");

      const cards=group.cards;
      if(cards.length<=2){
        cards.forEach(card=>{
          lines.push(appContext.cardListItemLine(card),"",appContext.cardListPriceLine(card,prefs.language),"");
        });
        return;
      }

      cards.slice(0,2).forEach(card=>{
        lines.push(appContext.cardListItemLine(card),"",appContext.cardListPriceLine(card,prefs.language),"");
      });
      lines.push(".",".",".","");
      const lastCard=cards[cards.length-1];
      lines.push(appContext.cardListItemLine(lastCard),"",appContext.cardListPriceLine(lastCard,prefs.language),"");
    });

    return lines.join("\n").trimEnd();
  }

function buildFbCardListPost(availableCards,prefs){
    if(prefs.postFormat !== "full") return appContext.buildFbCardDropPost(availableCards,prefs);
    const divider = "━━━━━━━━━━━━━━━━━━━━━━━━";
    const text=appContext.postLocale(prefs.language);
    const graded = availableCards.filter(c=>appContext.cardListFormat(c)==="graded");
    const raw = availableCards.filter(c=>appContext.cardListFormat(c)==="raw");
    const sealed = availableCards.filter(c=>appContext.cardListFormat(c)==="sealed");

    const sections = [
      appContext.buildFbCardListSection(text.graded,graded,prefs),
      appContext.buildFbCardListSection(text.raw,raw,prefs),
      appContext.buildFbCardListSection(text.sealed,sealed,prefs)
    ].filter(Boolean);

    const lines = [
      `${text.cardList}  [${prefs.language==="en"?"UPDATE":"更新"} : ${appContext.fbCardListDateLabel()}]`,
      "",
      `WTS【CARD LIST】${String(prefs.listTitle || "AVAILABLE INVENTORY").toUpperCase()}`,
      "",
      ...sections.flatMap((s,i)=>i ? ["",s] : [s]),
      "",
      divider,
      "",
      ...appContext.postSalesFooterLines(prefs.language),
      "",
      divider,
      "",
      `WEBSITE : ${appContext.getWebsiteShareUrl()}`,
      "",
      divider,
      "",
      "HASHTAG :",
      String(prefs.hashtags || "").trim()
    ];

    return appContext.compactGeneratedPostSpacing(lines.join("\n"));
  }

  function buildFbCardDropPost(selectedCards,prefs){
    const cards=selectedCards.slice(0,Number(prefs.dropLimit)||5);
    if(!cards.length) return "";
    const divider="━━━━━━━━━━━━━━━━━━━━━━━━";
    const text=appContext.postLocale(prefs.language);
    const shown=cards.map((card,index)=>appContext.dropCardEntryLines(card,index,prefs.language).join("\n"));
    const lines=[
      `${text.cardDrop} · ${appContext.fbCardListDateLabel()}`,
      "",
      `WTS · ${String(prefs.listTitle || "AVAILABLE INVENTORY").toUpperCase()} · COLLECT TCG MY & SG`,
      "",
      ...shown.flatMap((line,index)=>index ? ["",line] : [line]),
      "",
      text.moreCards,
      `${text.browseInventory} ${appContext.getWebsiteShareUrl()}`,
      "",
      divider,
      "",
      ...appContext.postSalesFooterLines(prefs.language),
      "",
      divider,
      "",
      String(prefs.hashtags || "").trim()
    ];
    return appContext.compactGeneratedPostSpacing(lines.join("\n"));
  }

  function balancedCardDropCards(cards,limit){
    const remaining=cards.slice();
    const chosen=[];
    const usedGames=new Set();
    const usedSeries=new Set();
    const usedEras=new Set();
    const usedFormats=new Set();
    const add=card=>{
      chosen.push(card);
      usedGames.add(appContext.normalizeFilterValue(card.game||""));
      usedSeries.add(`${appContext.normalizeFilterValue(card.game||"")}|${appContext.normalizeFilterValue(card.series||"")}`);
      usedEras.add(appContext.normalizeFilterValue(card.era||""));
      usedFormats.add(appContext.cardListFormat(card));
    };
    if(remaining.length) add(remaining.shift());
    while(remaining.length && chosen.length<limit){
      let bestIndex=0;
      let bestScore=-1;
      remaining.forEach((card,index)=>{
        const game=appContext.normalizeFilterValue(card.game||"");
        const series=`${game}|${appContext.normalizeFilterValue(card.series||"")}`;
        const era=appContext.normalizeFilterValue(card.era||"");
        const format=appContext.cardListFormat(card);
        const score=(usedGames.has(game)?0:1000)+(usedSeries.has(series)?0:100)+(usedEras.has(era)?0:10)+(usedFormats.has(format)?0:1);
        if(score>bestScore){bestScore=score;bestIndex=index;}
      });
      add(remaining.splice(bestIndex,1)[0]);
    }
    return chosen;
  }

function dataUrlToBlob(dataUrl){
    const value = String(dataUrl || "");
    const comma = value.indexOf(",");
    if(comma < 0) throw new Error("Invalid data URL");

    const header = value.slice(0,comma);
    const body = value.slice(comma+1);
    const mimeMatch = header.match(/^data:([^;,]+)/i);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";

    if(/;base64$/i.test(header)){
      const bytes = atob(body);
      const arr = new Uint8Array(bytes.length);
      for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
      return new Blob([arr],{type:mime});
    }

    return new Blob([decodeURIComponent(body)],{type:mime});
  }

async function imageSourceToBlob(src){
    if(/^data:/i.test(src)) return appContext.dataUrlToBlob(src);
    if(/^blob:/i.test(src)){
      const r = await appContext.fetch(src);
      if(!r.ok) throw new Error("Could not read image");
      return r.blob();
    }
    const r = await appContext.fetch(src,{
      mode:"cors",
      credentials:"omit",
      referrerPolicy:"no-referrer"
    });
    if(!r.ok) throw new Error("Could not fetch image");
    return r.blob();
  }

function imageExtensionFromBlob(blob){
    const t = String(blob?.type || "").toLowerCase();
    if(t.includes("png")) return "png";
    if(t.includes("webp")) return "webp";
    if(t.includes("avif")) return "avif";
    return "jpg";
  }

function loadScriptOnce(src){
    return new Promise((resolve,reject)=>{
      const existing = Array.from(document.scripts).find(s=>s.src === src);
      if(existing && typeof JSZip !== "undefined"){
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = ()=>resolve();
      script.onerror = ()=>reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }

async function ensureJsZip(){
    if(typeof JSZip !== "undefined") return JSZip;
    if(appContext.jsZipLoadPromise) return appContext.jsZipLoadPromise;

    appContext.jsZipLoadPromise = (async()=>{
      const sources = [
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
      ];

      let lastError = null;
      for(const src of sources){
        try{
          await appContext.loadScriptOnce(src);
          if(typeof JSZip !== "undefined") return JSZip;
        }catch(err){
          lastError = err;
        }
      }

      throw lastError || new Error("ZIP library is unavailable");
    })().catch(err=>{
      appContext.jsZipLoadPromise = null;
      throw err;
    });

    return appContext.jsZipLoadPromise;
  }

async function downloadCardListFirstImagesZip(cardsForZip, progressCallback){
    const ZipCtor = await appContext.ensureJsZip();
    const zip = new ZipCtor();
    const usedNames = new Set();
    const failedCards = [];
    let added = 0;

    for(let i=0;i<cardsForZip.length;i++){
      const card = cardsForZip[i];
      const firstImage = appContext.getImages(card)[0];
      if(!firstImage) continue;

      try{
        const soldWatermark = appContext.shouldApplySoldDownloadWatermark(card);
        const blob = soldWatermark
          ? await appContext.renderSoldDownloadBlob(firstImage, card)
          : await appContext.imageSourceToBlob(firstImage);
        const ext = soldWatermark ? "jpg" : appContext.imageExtensionFromBlob(blob);
        let base = appContext.safeDownloadName(
          [card.card_code,card.name].filter(Boolean).join(" - ") || `card-${i+1}`
        );
        let name = `${String(i+1).padStart(3,"0")} - ${base}.${ext}`;
        let suffix = 2;
        while(usedNames.has(name)){
          name = `${String(i+1).padStart(3,"0")} - ${base} (${suffix++}).${ext}`;
        }
        usedNames.add(name);
        zip.file(name,blob);
        added++;
      }catch(err){
        failedCards.push({
          id:card?.id || "",
          name:card?.name || card?.card_code || `Card ${i+1}`,
          reason:err?.message || "Image could not be read"
        });
        console.warn("Could not add card-list image to ZIP:",card?.id,err);
      }

      if(progressCallback) progressCallback(i+1,cardsForZip.length,added,failedCards.length);
    }

    if(!added){
      const error = new Error(
        failedCards.length
          ? `None of the ${failedCards.length} first images could be added to the ZIP.`
          : "No downloadable first images found"
      );
      error.failedCards = failedCards;
      throw error;
    }

    const blob = await zip.generateAsync({
      type:"blob",
      compression:"DEFLATE",
      compressionOptions:{level:6}
    });

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `Collect-TCG-Card-List-${new Date().toISOString().slice(0,10)}.zip`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),1500);
    return {added, failed:failedCards};
  }

function renderFbCardListGeneratorPage(){
    if(!appContext.requireOwner("open card list post generator")) return;

    const prefs = appContext.getFbCardListPostPrefs();
    const availableCards = appContext.cards.filter(c=>
      appContext.normalizeFilterValue(c.availability || "Available") === "available"
    );

    const selectedIds = new Set(availableCards.map(c=>String(c.id)));
    let orderedIds = appContext.sortCardListCards(availableCards).map(c=>String(c.id));
    let activeOrderMode = "default";
    let draggedOrderId = null;
    const trendingScores = new Map();
    let trendingState = "loading";

    const gameOptions = [...new Set(
      availableCards.map(c=>String(c.game || "").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    const eraOptions = [...new Set(
      availableCards.map(c=>String(c.era || "").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b));

    appContext.view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">Owner Tool</div>
          <h2>Card List Post Generator</h2>
          <p>Select the listings to include, control their order, generate the Facebook sales list, and download the first image from each selected listing as a ZIP. Sold listings are exported with a SOLD corner triangle automatically.</p>
        </div>
      </div>

      <div class="card-list-generator-stats">
        <div><strong id="fbCardListSelectedStat">${availableCards.length}</strong><span>Selected</span></div>
        <div><strong>${availableCards.length}</strong><span>Available</span></div>
        <div><strong>${availableCards.filter(c=>appContext.cardListFormat(c)==="graded").length}</strong><span>Graded</span></div>
        <div><strong>${availableCards.filter(c=>appContext.cardListFormat(c)==="raw").length}</strong><span>Raw</span></div>
        <div><strong>${availableCards.filter(c=>appContext.cardListFormat(c)==="sealed").length}</strong><span>Sealed</span></div>
      </div>

      <div class="fb-card-list-layout">
        <section class="panel fb-card-list-controls">
          <div class="eyebrow">1 · Choose Listings</div>
          <div class="fb-card-list-control-heading">
            <h3>Cards to Include</h3>
            <span class="fb-card-list-selection-count" id="fbCardListSelectionCount">${availableCards.length} / ${availableCards.length}</span>
          </div>

          <div class="fb-card-list-selection-toolbar">
            <div class="field fb-card-list-search-field">
              <label for="fbCardListSearch">Search</label>
              <input id="fbCardListSearch" type="search" maxlength="100" placeholder="Name, code or series…">
            </div>

            <div class="fb-card-list-filter-row">
              <div class="field">
                <label for="fbCardListGameFilter">Game</label>
                <select id="fbCardListGameFilter">
                  <option value="">All games</option>
                  ${gameOptions.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="fbCardListEraFilter">Era</label>
                <select id="fbCardListEraFilter">
                  <option value="">All eras</option>
                  ${eraOptions.map(v=>`<option value="${appContext.escapeHtml(v)}">${appContext.escapeHtml(v)}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="fbCardListFormatFilter">Type</label>
                <select id="fbCardListFormatFilter">
                  <option value="">All types</option>
                  <option value="graded">Graded</option>
                  <option value="raw">Raw</option>
                  <option value="sealed">Sealed</option>
                </select>
              </div>
            </div>

            <div class="fb-card-list-bulk-actions">
              <button type="button" class="btn-ghost" id="fbCardListSelectAllBtn">Select All</button>
              <button type="button" class="btn-ghost" id="fbCardListClearAllBtn">Clear All</button>
              <button type="button" class="btn-ghost" id="fbCardListSelectFilteredBtn">Select Filtered</button>
              <button type="button" class="btn-ghost" id="fbCardListClearFilteredBtn">Clear Filtered</button>
            </div>
          </div>

          <div class="fb-card-list-picker" id="fbCardListPicker" aria-label="Available cards"></div>
          <div class="fb-card-list-picker-empty" id="fbCardListPickerEmpty" hidden>No cards match the current filters.</div>

          <div class="fb-card-list-settings-divider"></div>

          <div class="eyebrow">2 · Arrange Order</div>
          <div class="fb-card-list-control-heading">
            <h3>Selected Card Order</h3>
            <span class="fb-card-list-order-mode" id="fbCardListOrderModeLabel">Default</span>
          </div>

          <div class="field">
            <label for="fbCardListOrderPreset">Sort preset</label>
            <select id="fbCardListOrderPreset">
              <option value="default">Default</option>
              <option value="price-high">Price: High → Low</option>
              <option value="year-old">Year: Oldest → Newest</option>
              <option value="grade-high">Grade: High → Low</option>
              <option value="series">Series A → Z</option>
              <option value="manual">Manual</option>
            </select>
            <div class="hint">Drag cards below to arrange them manually. On mobile, use the ↑ and ↓ buttons.</div>
          </div>

          <div class="fb-card-list-order-list" id="fbCardListOrderList" aria-label="Selected card order"></div>
          <div class="fb-card-list-order-empty" id="fbCardListOrderEmpty" hidden>Select at least one card to arrange the post order.</div>

          <div class="fb-card-list-settings-divider"></div>
          <div class="eyebrow">3 · Post Settings</div>

          <div class="fb-card-list-filter-row">
            <div class="field">
              <label for="fbCardListPostFormat">Post format</label>
              <select id="fbCardListPostFormat">
                <option value="drop" ${prefs.postFormat==="drop" ? "selected" : ""}>Drop post (short)</option>
                <option value="full" ${prefs.postFormat==="full" ? "selected" : ""}>Full list (detailed)</option>
              </select>
              <div class="hint">Drop posts are designed for quick social browsing. Full list keeps the existing detailed format.</div>
            </div>
            <div class="field" id="fbCardListDropLimitField">
              <label for="fbCardListDropLimit">Cards in drop</label>
              <select id="fbCardListDropLimit">
                ${[3,4,5,6,8].map(n=>`<option value="${n}" ${prefs.dropLimit===n ? "selected" : ""}>${n} cards</option>`).join("")}
              </select>
              <div class="hint">Number of selected cards included in the post.</div>
            </div>
            <div class="field" id="fbCardListDropMixField">
              <label for="fbCardListDropMix">Card mix</label>
              <select id="fbCardListDropMix">
                <option value="trending" ${prefs.dropSelectionMode!=="selected" ? "selected" : ""}>Trending cards (automatic)</option>
                <option value="selected" ${prefs.dropSelectionMode==="selected" ? "selected" : ""}>Use selected order</option>
              </select>
              <div class="hint" id="fbCardListDropMixHint">Trending uses the last 7 days of buyer activity. Loading current demand…</div>
            </div>
          </div>

          <div class="field">
            <label for="fbCardListTitle">List title</label>
            <input id="fbCardListTitle" maxlength="120" value="${appContext.escapeHtml(prefs.listTitle)}" placeholder="e.g. VINTAGE SERIES">
          </div>

          ${appContext.postLanguageSelectHTML("fbCardListLanguage",prefs.language)}

          <div class="fb-card-list-terms-note">
            Pricing terms are taken automatically from each card's saved <strong>Pricing terms</strong> category.
          </div>

          <details class="fb-post-settings">
            <summary>Links & hashtags</summary>
            <div class="fb-post-settings-body">
              <div class="field">
                <label for="fbCardListCarousellMY">Carousell Malaysia URL</label>
                <input id="fbCardListCarousellMY" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.carousellMalaysiaUrl)}">
              </div>
              <div class="field">
                <label for="fbCardListCarousellSG">Carousell Singapore URL</label>
                <input id="fbCardListCarousellSG" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.carousellSingaporeUrl)}">
              </div>
              <div class="field">
                <label for="fbCardListInstagram">Instagram URL</label>
                <input id="fbCardListInstagram" type="url" maxlength="1000" value="${appContext.escapeHtml(prefs.instagramUrl)}">
              </div>
              <div class="field">
                <label for="fbCardListHashtags">Hashtags</label>
                <textarea id="fbCardListHashtags" rows="3" maxlength="500">${appContext.escapeHtml(prefs.hashtags)}</textarea>
              </div>
            </div>
          </details>

          <div class="fb-card-list-image-note">
            <strong>ZIP image rule</strong>
            <span>Only the first image from each selected listing is included. ZIP filenames follow the selected card order.</span>
          </div>

          <button type="button" class="btn-primary fb-card-list-zip-btn" id="fbCardListZipBtn">
            Download Selected First Images (.ZIP)
          </button>
          <div class="hint" id="fbCardListZipStatus"></div>
        </section>

        <section class="panel fb-card-list-preview-panel">
          <div class="fb-post-section-title">
            <div>
              <div class="eyebrow">4 · Preview & Copy</div>
              <h3 id="fbCardListPreviewTitle">Facebook Card List</h3>
            </div>
            <div class="fb-post-copy-actions">
              <button type="button" class="btn-ghost" id="fbCardListCopyBtn">Copy Post</button>
              <button type="button" class="btn-primary fb-prepare-btn" id="fbCardListPrepareBtn">Prepare Facebook Post</button>
            </div>
          </div>

          <div class="fb-card-list-preview-summary" id="fbCardListPreviewSummary"></div>
          <textarea id="fbCardListOutput" class="fb-post-output fb-card-list-output"></textarea>
          <div class="hint">The preview is editable. Changing the selection, order or settings regenerates it.</div>
        </section>
      </div>
    `;

    const searchInput=appContext.$("fbCardListSearch");
    const gameFilter=appContext.$("fbCardListGameFilter");
    const eraFilter=appContext.$("fbCardListEraFilter");
    const formatFilter=appContext.$("fbCardListFormatFilter");
    const picker=appContext.$("fbCardListPicker");
    const pickerEmpty=appContext.$("fbCardListPickerEmpty");
    const selectionCount=appContext.$("fbCardListSelectionCount");
    const selectedStat=appContext.$("fbCardListSelectedStat");
    const previewSummary=appContext.$("fbCardListPreviewSummary");

    const orderPreset=appContext.$("fbCardListOrderPreset");
    const orderList=appContext.$("fbCardListOrderList");
    const orderEmpty=appContext.$("fbCardListOrderEmpty");
    const orderModeLabel=appContext.$("fbCardListOrderModeLabel");

    const postFormatInput=appContext.$("fbCardListPostFormat");
    const dropLimitInput=appContext.$("fbCardListDropLimit");
    const dropLimitField=appContext.$("fbCardListDropLimitField");
    const dropMixInput=appContext.$("fbCardListDropMix");
    const dropMixField=appContext.$("fbCardListDropMixField");
    const dropMixHint=appContext.$("fbCardListDropMixHint");
    const previewTitle=appContext.$("fbCardListPreviewTitle");
    const titleInput=appContext.$("fbCardListTitle");
    const languageInput=appContext.$("fbCardListLanguage");
    const carousellMYInput=appContext.$("fbCardListCarousellMY");
    const carousellSGInput=appContext.$("fbCardListCarousellSG");
    const instagramInput=appContext.$("fbCardListInstagram");
    const hashtagsInput=appContext.$("fbCardListHashtags");
    const output=appContext.$("fbCardListOutput");
    const copyBtn=appContext.$("fbCardListCopyBtn");
    const prepareBtn=appContext.$("fbCardListPrepareBtn");
    const zipBtn=appContext.$("fbCardListZipBtn");
    const zipStatus=appContext.$("fbCardListZipStatus");

    const byId=new Map(availableCards.map(card=>[String(card.id),card]));

    function currentPrefs(){
      return {
        listTitle:titleInput.value,
        postFormat:postFormatInput.value,
        dropLimit:Number(dropLimitInput.value),
        dropSelectionMode:dropMixInput.value,
        language:languageInput.value,
        carousellMalaysiaUrl:carousellMYInput.value,
        carousellSingaporeUrl:carousellSGInput.value,
        instagramUrl:instagramInput.value,
        hashtags:hashtagsInput.value
      };
    }

    function syncPostFormatUI(){
      const isDrop=postFormatInput.value!=="full";
      dropLimitField.hidden=!isDrop;
      dropMixField.hidden=!isDrop;
      previewTitle.textContent=isDrop ? "Facebook Drop Post" : "Facebook Card List";
      copyBtn.textContent=isDrop ? "Copy Drop Post" : "Copy Full Post";
      prepareBtn.textContent=isDrop ? "Prepare Drop Post" : "Prepare Facebook Post";
    }

    function ensureOrderHasSelected(){
      const selectedSet=new Set(selectedIds);
      orderedIds=orderedIds.filter(id=>selectedSet.has(id) && byId.has(id));

      availableCards.forEach(card=>{
        const id=String(card.id);
        if(selectedSet.has(id) && !orderedIds.includes(id)){
          orderedIds.push(id);
        }
      });
    }

    function orderedSelectedCards(){
      ensureOrderHasSelected();
      return orderedIds.map(id=>byId.get(id)).filter(Boolean);
    }

    function cardPrimaryPrice(card){
      const candidates=[
        Number(card.price_myr),
        Number(card.price_usd ?? card.price),
        Number(card.price_sgd)
      ];
      return candidates.find(Number.isFinite) || 0;
    }

    function cardGradeNumber(card){
      const grade=Array.isArray(card.grading) ? card.grading.find(g=>g && g.company)?.grade : null;
      const n=Number(grade);
      return Number.isFinite(n) ? n : -1;
    }

    function applyOrderPreset(mode){
      activeOrderMode=mode;
      ensureOrderHasSelected();
      const current=orderedSelectedCards();

      if(mode==="manual"){
        orderModeLabel.textContent="Manual";
        renderOrderList();
        regenerate();
        return;
      }

      let sorted=current.slice();

      if(mode==="default"){
        sorted=appContext.sortCardListCards(current);
      }else if(mode==="price-high"){
        sorted.sort((a,b)=>
          cardPrimaryPrice(b)-cardPrimaryPrice(a) ||
          String(a.name||"").localeCompare(String(b.name||""))
        );
      }else if(mode==="year-old"){
        sorted.sort((a,b)=>
          Number(a.year||9999)-Number(b.year||9999) ||
          String(a.series||"").localeCompare(String(b.series||"")) ||
          String(a.name||"").localeCompare(String(b.name||""))
        );
      }else if(mode==="grade-high"){
        sorted.sort((a,b)=>
          cardGradeNumber(b)-cardGradeNumber(a) ||
          Number(a.year||9999)-Number(b.year||9999) ||
          String(a.name||"").localeCompare(String(b.name||""))
        );
      }else if(mode==="series"){
        sorted.sort((a,b)=>
          String(a.series||"").localeCompare(String(b.series||"")) ||
          Number(a.year||9999)-Number(b.year||9999) ||
          String(a.name||"").localeCompare(String(b.name||""))
        );
      }

      orderedIds=sorted.map(c=>String(c.id));
      const labelMap={
        "default":"Default",
        "price-high":"Price: High → Low",
        "year-old":"Year: Oldest → Newest",
        "grade-high":"Grade: High → Low",
        "series":"Series A → Z",
        "manual":"Manual"
      };
      orderModeLabel.textContent=labelMap[mode] || "Manual";
      renderOrderList();
      regenerate();
    }

    function switchToManual(){
      activeOrderMode="manual";
      orderPreset.value="manual";
      orderModeLabel.textContent="Manual";
    }

    function moveOrderId(id,direction){
      ensureOrderHasSelected();
      const index=orderedIds.indexOf(id);
      if(index<0) return;
      const next=index+direction;
      if(next<0 || next>=orderedIds.length) return;
      [orderedIds[index],orderedIds[next]]=[orderedIds[next],orderedIds[index]];
      switchToManual();
      renderOrderList();
      regenerate();
    }

    function moveOrderIdBefore(sourceId,targetId){
      if(!sourceId || !targetId || sourceId===targetId) return;
      ensureOrderHasSelected();
      const sourceIndex=orderedIds.indexOf(sourceId);
      const targetIndex=orderedIds.indexOf(targetId);
      if(sourceIndex<0 || targetIndex<0) return;

      orderedIds.splice(sourceIndex,1);
      const updatedTargetIndex=orderedIds.indexOf(targetId);
      orderedIds.splice(updatedTargetIndex,0,sourceId);

      switchToManual();
      renderOrderList();
      regenerate();
    }

    function matchesPickerFilters(card){
      const q=appContext.normalizeFilterValue(searchInput.value);
      const game=appContext.normalizeFilterValue(gameFilter.value);
      const era=appContext.normalizeFilterValue(eraFilter.value);
      const type=appContext.normalizeFilterValue(formatFilter.value);

      if(game && appContext.normalizeFilterValue(card.game)!==game) return false;
      if(era && appContext.normalizeFilterValue(card.era)!==era) return false;
      if(type && appContext.cardListFormat(card)!==type) return false;

      if(q){
        const hay=[
          card.name,
          card.card_code,
          card.series,
          card.year,
          card.game,
          card.era,
          card.language
        ].map(v=>appContext.normalizeFilterValue(v)).join(" ");
        if(!hay.includes(q)) return false;
      }

      return true;
    }

    function filteredCards(){
      return availableCards.filter(matchesPickerFilters);
    }

    function renderPicker(){
      const visible=filteredCards();
      pickerEmpty.hidden=visible.length>0;

      picker.innerHTML=visible.map(card=>{
        const id=String(card.id);
        const checked=selectedIds.has(id);
        const image=appContext.getImages(card)[0] || "";
        const type=appContext.cardListFormat(card);
        const grade=type==="graded" ? appContext.gradedPostLabel(card) : (type==="sealed" ? "SEALED" : appContext.rawConditionPostLabel(card));
        const meta=[
          card.card_code,
          card.year,
          card.series,
          card.game
        ].filter(Boolean).join(" · ");

        return `
          <label class="fb-card-list-picker-row ${checked?"selected":""}">
            <input type="checkbox" data-card-list-id="${appContext.escapeHtml(id)}" ${checked?"checked":""}>
            <span class="fb-card-list-picker-thumb">
              ${image ? `<img src="${appContext.escapeHtml(image)}" alt="">` : `<span>No image</span>`}
            </span>
            <span class="fb-card-list-picker-copy">
              <strong>${appContext.escapeHtml(card.name || "Untitled card")}</strong>
              <small>${appContext.escapeHtml(meta)}</small>
            </span>
            <span class="fb-card-list-picker-type">${appContext.escapeHtml(grade)}</span>
          </label>
        `;
      }).join("");

      picker.querySelectorAll("[data-card-list-id]").forEach(input=>{
        input.addEventListener("change",()=>{
          const id=String(input.dataset.cardListId || "");
          if(input.checked){
            selectedIds.add(id);
            if(!orderedIds.includes(id)) orderedIds.push(id);
          }else{
            selectedIds.delete(id);
            orderedIds=orderedIds.filter(x=>x!==id);
          }

          input.closest(".fb-card-list-picker-row")?.classList.toggle("selected",input.checked);

          if(activeOrderMode!=="manual"){
            applyOrderPreset(activeOrderMode);
          }else{
            renderOrderList();
            regenerate();
          }
        });
      });
    }

    function renderOrderList(){
      const ordered=orderedSelectedCards();
      orderEmpty.hidden=ordered.length>0;

      orderList.innerHTML=ordered.map((card,index)=>{
        const id=String(card.id);
        const image=appContext.getImages(card)[0] || "";
        const type=appContext.cardListFormat(card);
        const meta=[
          card.card_code,
          card.year,
          card.series
        ].filter(Boolean).join(" · ");

        return `
          <div class="fb-card-order-row"
               draggable="true"
               data-order-id="${appContext.escapeHtml(id)}"
               tabindex="0">
            <span class="fb-card-order-grip" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
            <span class="fb-card-order-number">${index+1}</span>
            <span class="fb-card-order-thumb">
              ${image ? `<img src="${appContext.escapeHtml(image)}" alt="">` : `<span>—</span>`}
            </span>
            <span class="fb-card-order-copy">
              <strong>${appContext.escapeHtml(card.name || "Untitled card")}</strong>
              <small>${appContext.escapeHtml(meta)}</small>
            </span>
            <span class="fb-card-order-type">${appContext.escapeHtml(type)}</span>
            <span class="fb-card-order-buttons">
              <button type="button"
                      class="fb-card-order-move"
                      data-order-up="${appContext.escapeHtml(id)}"
                      aria-label="Move ${appContext.escapeHtml(card.name || "card")} up"
                      ${index===0?"disabled":""}>↑</button>
              <button type="button"
                      class="fb-card-order-move"
                      data-order-down="${appContext.escapeHtml(id)}"
                      aria-label="Move ${appContext.escapeHtml(card.name || "card")} down"
                      ${index===ordered.length-1?"disabled":""}>↓</button>
            </span>
          </div>
        `;
      }).join("");

      orderList.querySelectorAll("[data-order-up]").forEach(btn=>{
        btn.addEventListener("click",()=>moveOrderId(String(btn.dataset.orderUp),-1));
      });

      orderList.querySelectorAll("[data-order-down]").forEach(btn=>{
        btn.addEventListener("click",()=>moveOrderId(String(btn.dataset.orderDown),1));
      });

      orderList.querySelectorAll("[data-order-id]").forEach(row=>{
        row.addEventListener("dragstart",e=>{
          draggedOrderId=String(row.dataset.orderId || "");
          row.classList.add("dragging");
          if(e.dataTransfer){
            e.dataTransfer.effectAllowed="move";
            e.dataTransfer.setData("text/plain",draggedOrderId);
          }
        });

        row.addEventListener("dragend",()=>{
          draggedOrderId=null;
          orderList.querySelectorAll(".fb-card-order-row").forEach(r=>{
            r.classList.remove("dragging","drag-over");
          });
        });

        row.addEventListener("dragover",e=>{
          e.preventDefault();
          if(!draggedOrderId || draggedOrderId===String(row.dataset.orderId || "")) return;
          orderList.querySelectorAll(".fb-card-order-row").forEach(r=>r.classList.remove("drag-over"));
          row.classList.add("drag-over");
          if(e.dataTransfer) e.dataTransfer.dropEffect="move";
        });

        row.addEventListener("drop",e=>{
          e.preventDefault();
          const sourceId=draggedOrderId || e.dataTransfer?.getData("text/plain") || "";
          const targetId=String(row.dataset.orderId || "");
          moveOrderIdBefore(sourceId,targetId);
        });
      });
    }

    function trendingCardDropCards(cards,limit){
      if(trendingState!=="ready"){
        return appContext.balancedCardDropCards(cards,limit);
      }

      const orderIndex=new Map(orderedIds.map((id,index)=>[id,index]));
      const ranked=cards.slice().sort((a,b)=>{
        const aid=String(a.id);
        const bid=String(b.id);
        const aTrend=trendingScores.get(aid)||{score:0,unique:0,views:0};
        const bTrend=trendingScores.get(bid)||{score:0,unique:0,views:0};
        return bTrend.score-aTrend.score ||
          bTrend.unique-aTrend.unique ||
          bTrend.views-aTrend.views ||
          (orderIndex.get(aid)??999999)-(orderIndex.get(bid)??999999);
      });

      const hasCurrentDemand=ranked.some(card=>(trendingScores.get(String(card.id))?.score||0)>0);
      return hasCurrentDemand
        ? ranked.slice(0,limit)
        : appContext.balancedCardDropCards(cards,limit);
    }

    async function loadTrendingDropScores(){
      if(typeof appContext.fetchInsights!=="function" || typeof appContext.fetchCardEngagementInsights!=="function"){
        trendingState="unavailable";
        if(dropMixHint) dropMixHint.textContent="Trending data is unavailable. Automatic mode is using the balanced inventory mix.";
        regenerate();
        return;
      }

      try{
        const {start,end}=appContext.dateRangeForPreset("7d");
        const [viewRows,engagementResult]=await Promise.all([
          appContext.fetchInsights(start,end,{silent:true}),
          appContext.fetchCardEngagementInsights(start,end)
        ]);

        const viewMap=new Map((Array.isArray(viewRows)?viewRows:[]).map(row=>[
          String(row.card_id||row.id||""),
          row
        ]));
        const engagementMap=new Map((Array.isArray(engagementResult?.rows)?engagementResult.rows:[]).map(row=>[
          String(row.card_id||""),
          row
        ]));

        trendingScores.clear();
        availableCards.forEach(card=>{
          const id=String(card.id);
          const views=viewMap.get(id)||{};
          const engagement=engagementMap.get(id)||{};
          const combined={...views,...engagement};
          trendingScores.set(id,{
            score:Math.max(0,Number(appContext.insightInterestScore?.(combined)||0)),
            unique:Math.max(0,Number(views.unique_views||0)),
            views:Math.max(0,Number(views.views||0))
          });
        });

        trendingState="ready";
        const demandCount=[...trendingScores.values()].filter(item=>item.score>0).length;
        if(dropMixHint){
          dropMixHint.textContent=demandCount
            ? `Trending prioritizes the last 7 days of qualified views, favorites, shares and buyer contact intent · ${demandCount} listing${demandCount===1?"":"s"} with current activity.`
            : "No buyer activity was recorded in the last 7 days. Automatic mode is using the balanced inventory mix.";
        }
      }catch(error){
        console.warn("Could not load trending cards for Card Drop:",error);
        trendingState="unavailable";
        if(dropMixHint) dropMixHint.textContent="Trending data could not be loaded. Automatic mode is using the balanced inventory mix.";
      }

      regenerate();
    }

    function cardsForPost(){
      const selected=orderedSelectedCards();
      if(postFormatInput.value==="full") return selected;
      const limit=Number(dropLimitInput.value)||5;
      return dropMixInput.value==="selected"
        ? selected.slice(0,limit)
        : trendingCardDropCards(selected,limit);
    }

    function updateSelectionStatus(){
      const selected=orderedSelectedCards();
      const postCards=cardsForPost();
      const selectedWithImage=postCards.filter(c=>appContext.getImages(c).length);

      selectionCount.textContent=`${selected.length} / ${availableCards.length}`;
      selectedStat.textContent=selected.length;

      previewSummary.innerHTML=`
        <span><strong>${selected.length}</strong> listing${selected.length===1?"":"s"} selected</span>
        <span><strong>${postCards.length}</strong> shown in post</span>
        <span><strong>${selected.filter(c=>appContext.cardListFormat(c)==="graded").length}</strong> graded</span>
        <span><strong>${selected.filter(c=>appContext.cardListFormat(c)==="raw").length}</strong> raw</span>
        <span><strong>${selected.filter(c=>appContext.cardListFormat(c)==="sealed").length}</strong> sealed</span>
        <span><strong>${appContext.escapeHtml(orderModeLabel.textContent || "Default")}</strong> order</span>
      `;

      zipBtn.disabled=selectedWithImage.length===0;
      zipStatus.textContent=selectedWithImage.length
        ? `${selectedWithImage.length} post image${selectedWithImage.length===1?"":"s"} ready for ZIP in the displayed order.`
        : "No cards shown in this post currently have an image.";

      copyBtn.disabled=selected.length===0;
      prepareBtn.disabled=selected.length===0;
    }

    function regenerate(){
      const now=currentPrefs();
      appContext.savePostGeneratorLanguage(now.language);
      appContext.saveFbCardListPostPrefs(now);
      const selected=cardsForPost();

      output.value=selected.length
        ? appContext.buildFbCardListPost(selected,now)
        : "";

      updateSelectionStatus();
    }

    function refreshSelectionOutputs(){
      renderOrderList();
      regenerate();
    }

    function setSelectionForCards(cardList,selected){
      cardList.forEach(card=>{
        const id=String(card.id);

        if(selected){
          selectedIds.add(id);
          if(!orderedIds.includes(id)) orderedIds.push(id);
        }else{
          selectedIds.delete(id);
          orderedIds=orderedIds.filter(x=>x!==id);
        }
      });

      renderPicker();

      if(activeOrderMode!=="manual"){
        applyOrderPreset(activeOrderMode);
      }else{
        refreshSelectionOutputs();
      }
    }

    [searchInput,gameFilter,eraFilter,formatFilter].forEach(el=>{
      el.addEventListener("input",renderPicker);
      el.addEventListener("change",renderPicker);
    });

    appContext.$("fbCardListSelectAllBtn").addEventListener("click",()=>{
      setSelectionForCards(availableCards,true);
    });

    appContext.$("fbCardListClearAllBtn").addEventListener("click",()=>{
      setSelectionForCards(availableCards,false);
    });

    appContext.$("fbCardListSelectFilteredBtn").addEventListener("click",()=>{
      setSelectionForCards(filteredCards(),true);
    });

    appContext.$("fbCardListClearFilteredBtn").addEventListener("click",()=>{
      setSelectionForCards(filteredCards(),false);
    });

    orderPreset.addEventListener("change",()=>{
      applyOrderPreset(orderPreset.value);
    });

    [postFormatInput,dropLimitInput,dropMixInput,titleInput,languageInput,carousellMYInput,carousellSGInput,instagramInput,hashtagsInput].forEach(el=>{
      el.addEventListener("input",regenerate);
      el.addEventListener("change",regenerate);
    });

    copyBtn.addEventListener("click",()=>{
      if(!orderedSelectedCards().length){
        appContext.showToast("Select at least one card");
        return;
      }

      appContext.copyPlainText(output.value,"Card list post copied");
    });

    prepareBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("prepare card-list Facebook post")) return;

      const selected=cardsForPost();
      if(!selected.length){
        appContext.showToast("Select at least one card");
        return;
      }
      if(!output.value.trim()){
        appContext.showToast("No Facebook post to prepare");
        return;
      }

      const originalText=prepareBtn.textContent;
      prepareBtn.disabled=true;
      copyBtn.disabled=true;
      zipBtn.disabled=true;
      prepareBtn.textContent="Preparing…";

      try{
        const copied=await appContext.copyPlainText(output.value,"Card list post copied");
        if(!copied) throw new Error("Could not copy card list post");

        const zipCards=selected.filter(c=>appContext.getImages(c).length);
        if(!zipCards.length){
          appContext.showToast("Post copied · selected listings have no images");
          return;
        }

        prepareBtn.textContent="Creating image ZIP…";
        const result=await appContext.downloadCardListFirstImagesZip(
          zipCards,
          (done,total,included,failed)=>{
            prepareBtn.textContent=failed
              ? `ZIP ${done}/${total} · ${failed} skipped`
              : `ZIP ${done}/${total}`;
            zipStatus.textContent=`Preparing ${done}/${total} · ${included} added${failed ? ` · ${failed} skipped` : ""}`;
          }
        );

        zipStatus.textContent=result.failed.length
          ? `ZIP ready · ${result.added} included · ${result.failed.length} inaccessible image${result.failed.length===1?"":"s"} skipped`
          : `ZIP ready · ${result.added} image${result.added===1?"":"s"} included in the selected order`;

        appContext.showToast(
          result.failed.length
            ? `Post ready · ${result.added} images included · ${result.failed.length} skipped`
            : `Post ready · text copied + ${result.added} image${result.added===1?"":"s"} ZIP`
        );
      }catch(err){
        console.error("Prepare card-list Facebook post error:",err);
        appContext.showToast(`Could not fully prepare post${err?.message ? `: ${String(err.message).slice(0,100)}` : ""}`);
      }finally{
        prepareBtn.textContent=originalText;
        updateSelectionStatus();
      }
    });

    zipBtn.addEventListener("click",async()=>{
      if(!appContext.requireOwner("download card list ZIP")) return;

      const zipCards=cardsForPost().filter(c=>appContext.getImages(c).length);

      if(!zipCards.length){
        appContext.showToast("No selected card images to download");
        return;
      }

      const old=zipBtn.textContent;
      zipBtn.disabled=true;
      zipBtn.textContent="Preparing ZIP…";

      try{
        const result=await appContext.downloadCardListFirstImagesZip(zipCards,(done,total,included,failed)=>{
          zipStatus.textContent=`Preparing ${done}/${total} · ${included} added${failed ? ` · ${failed} skipped` : ""}`;
        });

        zipStatus.textContent=result.failed.length
          ? `ZIP ready · ${result.added} included · ${result.failed.length} inaccessible image${result.failed.length===1?"":"s"} skipped`
          : `ZIP ready · ${result.added} image${result.added===1?"":"s"} included in the selected order`;

        appContext.showToast(
          result.failed.length
            ? `ZIP downloaded · ${result.failed.length} image${result.failed.length===1?"":"s"} skipped`
            : `Downloaded ZIP with ${result.added} image${result.added===1?"":"s"}`
        );
      }catch(err){
        console.error("Card list ZIP error:",err);
        const reason=String(err?.message || "Unknown ZIP error").slice(0,180);
        zipStatus.textContent=`Could not create ZIP: ${reason}`;
        appContext.showToast("Could not create image ZIP");
      }finally{
        zipBtn.disabled=cardsForPost().filter(c=>appContext.getImages(c).length).length===0;
        zipBtn.textContent=old;
      }
    });

    syncPostFormatUI();
    renderPicker();
    applyOrderPreset("default");
    loadTrendingDropScores();
  }

  Object.assign(appContext,{compactGeneratedPostSpacing,normalizePostLanguage,getPostGeneratorLanguage,savePostGeneratorLanguage,postLanguageSelectHTML,postLocale,replacePostTokens,postSalesFooterLines,facebookGroupSalesCopy,facebookGroupSalesFooterLines,getFbPostPrefs,saveFbPostPrefs,getFbCardMeta,saveFbCardMeta,safeHttpUrl,openSafeExternalUrl,fbFormatLabel,postEraLabel,postPopLabel,fbGameLabel,defaultFbPostTitle,singleCardCopyTitle,defaultFbHashtags,buildFbPostText,buildFbNfsPostText,copyTextToClipboard,copyPlainText,currentFacebookToolMode,facebookToolsHeaderHTML,renderFacebookToolsPage,renderFbPostGeneratorPage,getFbGiveawayPostPrefs,saveFbGiveawayPostPrefs,giveawayNumberFromTitle,formatGiveawayEndsGmt8,getGiveawayShareUrl,buildGiveawayWinnerAnnouncementPost,renderGiveawayWinnerPostGeneratorPage,buildFbGiveawayPost,renderFbGiveawayPostGeneratorPage,defaultCarousellProductDetails,carousellGiveawayImages,defaultCarousellGiveawayProductDetails,downloadCarousellGiveawayImagesZip,getCarousellPostPrefs,saveCarousellPostPrefs,buildCarousellPostText,renderCarousellPostGeneratorPage,ebayListingTitle,ebayItemSpecifics,ebayListingDescription,renderEbayListingGeneratorPage,getFbCardListPostPrefs,saveFbCardListPostPrefs,ordinalDay,fbCardListDateLabel,cardListFormat,rawConditionPostLabel,gradedPostLabel,cardListPriceLine,cardListGroupHeading,cardListItemLine,dropDisplayText,dropCardName,dropCardLanguageLabel,dropCardMetaLine,dropCardPriceLine,dropCardEntryLines,sortCardListCards,buildFbCardListSection,buildFbCardDropPost,balancedCardDropCards,buildFbCardListPost,dataUrlToBlob,imageSourceToBlob,imageExtensionFromBlob,loadScriptOnce,ensureJsZip,downloadCardListFirstImagesZip,renderFbCardListGeneratorPage});
}

/** State and event initialization; called in preserved startup order. */
export function initialize(appContext,runtime){
  appContext.POST_GENERATOR_LANGUAGE_KEY = "collect_tcg_post_generator_language_v1";
  appContext.FB_GIVEAWAY_POST_PREFS_KEY = "collect_tcg_fb_giveaway_post_prefs_v1";

  appContext.FB_GIVEAWAY_POST_DEFAULTS = Object.freeze({
    giveawayNumber:"3",
    winnerHeadline:"WIN PSA10 ONE PIECE CARD!",
    prizeLine:'[PSA10] LECAFIG GOLD TEXT LEADER "JEWELRY BONNEY" SHONEN JUMP',
    facebookPageUrl:"https://www.facebook.com/profile.php?id=61590041416102",
    instagramUrl:"https://www.instagram.com/collecttcg.mysg/",
    facebookGroupUrl:"https://www.facebook.com/groups/1765445114770379",
    includeFacebookGroupBonus:true,
    commentText:"That’s him officer!!! 🫵👮",
    claimHours:"24",
    winnerTool:"Wheel of Names",
    giveawayEnds:"23 August at 10:00 PM GMT+8 (Sunday)",
    cod:"KL — TRX / KLCC / Pavilion KL",
    postage:"Available",
    carousellMalaysiaUrl:"https://sl1nk.com/nezhxv2",
    carousellSingaporeUrl:"https://l1nq.com/i7eq8mx",
    hashtags:"#tcg #onepiece #onepiecetcg #onepiecetradingcardgame #tcgcommunity #tcgcollector",
    includeMultiGroupNotice:true
  });

  appContext.CAROUSELL_POST_PREFS_KEY = "collect_tcg_carousell_post_prefs_v1";

  appContext.FB_CARD_LIST_POST_PREFS_KEY = "collect_tcg_fb_card_list_post_prefs_v1";

  appContext.jsZipLoadPromise = null;
}
