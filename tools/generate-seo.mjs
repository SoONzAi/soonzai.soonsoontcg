import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args=new Set(process.argv.slice(2));
const mode=args.has('--production')?'production':'beta';
const selfTest=args.has('--self-test');
const root=process.cwd();

const config=mode==='production'
  ? {
      outputDir:root,
      sourceIndex:path.join(root,'index.html'),
      runtimeFile:path.join(root,'src/app/production-runtime.js'),
      publicBase:'https://collecttcg.github.io/Collect_TCG/',
      sitePath:'/Collect_TCG/',
      robotsMeta:'index,follow,max-image-preview:large',
      robotsTxt:'User-agent: *\nAllow: /\nSitemap: https://collecttcg.github.io/Collect_TCG/sitemap.xml\n'
    }
  : {
      outputDir:path.join(root,'beta'),
      sourceIndex:path.join(root,'beta/index.html'),
      runtimeFile:path.join(root,'beta/src/app/production-runtime.js'),
      publicBase:'https://collecttcg.github.io/Collect_TCG_Beta/beta/',
      sitePath:'/Collect_TCG_Beta/beta/',
      robotsMeta:'noindex,nofollow,noarchive',
      robotsTxt:'User-agent: *\nDisallow: /\nSitemap: https://collecttcg.github.io/Collect_TCG_Beta/beta/sitemap.xml\n'
    };

const SEO_START='<!-- SEO_PHASE1_META_START -->';
const SEO_END='<!-- SEO_PHASE1_META_END -->';

function escapeHtml(value){
  return String(value??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function slugPart(value){
  return String(value??'')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/&/g,' and ')
    .replace(/['’]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .replace(/-{2,}/g,'-');
}

function gradeLabel(card){
  const grading=Array.isArray(card?.grading)?card.grading:[];
  const grade=grading.find(entry=>entry&&entry.company);
  return grade?[grade.company,grade.grade].filter(Boolean).join(' '):'';
}

function cardSlug(card){
  const parts=[card?.year,card?.game,card?.series,card?.name,card?.card_code,gradeLabel(card)]
    .map(slugPart).filter(Boolean);
  return (parts.join('-').replace(/-{2,}/g,'-').slice(0,120).replace(/-+$/,'')||'card');
}

function priceOffer(card){
  const candidates=[
    ['USD',card?.price_usd??card?.price],
    ['MYR',card?.price_myr],
    ['SGD',card?.price_sgd]
  ];
  for(const [currency,value] of candidates){
    const n=Number(value);
    if(Number.isFinite(n)&&n>0) return {currency,price:n};
  }
  return null;
}

function availabilitySchema(value){
  const normalized=String(value||'').trim().toLowerCase();
  if(normalized==='sold') return 'https://schema.org/OutOfStock';
  if(normalized==='reserved') return 'https://schema.org/LimitedAvailability';
  if(normalized==='available') return 'https://schema.org/InStock';
  return '';
}

function descriptionFor(card){
  const bits=[
    card?.year,card?.game,card?.series,card?.name,card?.card_code,
    gradeLabel(card),card?.language,card?.availability
  ].map(v=>String(v||'').trim()).filter(Boolean);
  const base=bits.join(' · ');
  return `${base}${base?' — ':''}Collect TCG MY & SG. Browse card details, pricing and availability.`.slice(0,300);
}

function mainImage(card){
  const thumb=String(card?.thumbnail_url||'').trim();
  if(/^https?:\/\//i.test(thumb)) return thumb;
  const first=Array.isArray(card?.images)?String(card.images[0]||'').trim():'';
  return /^https?:\/\//i.test(first)?first:'';
}

function productJsonLd(card,url){
  const image=mainImage(card);
  const offer=priceOffer(card);
  const availability=availabilitySchema(card?.availability);
  const product={
    '@context':'https://schema.org',
    '@type':'Product',
    name:String(card?.name||'Trading card'),
    url,
    ...(image?{image:[image]}:{}),
    ...(card?.card_code?{sku:String(card.card_code)}:{}),
    description:descriptionFor(card),
    category:String(card?.game||'Trading Card'),
    additionalProperty:[
      card?.year&&{'@type':'PropertyValue',name:'Year',value:String(card.year)},
      card?.series&&{'@type':'PropertyValue',name:'Series',value:String(card.series)},
      card?.language&&{'@type':'PropertyValue',name:'Language',value:String(card.language)},
      gradeLabel(card)&&{'@type':'PropertyValue',name:'Grade',value:gradeLabel(card)},
      card?.condition&&{'@type':'PropertyValue',name:'Condition',value:String(card.condition)}
    ].filter(Boolean),
    ...(offer&&availability&&String(card?.availability||'').toLowerCase()!=='collection (nfs)'?{
      offers:{
        '@type':'Offer',
        url,
        priceCurrency:offer.currency,
        price:String(offer.price),
        availability,
        seller:{'@type':'Organization',name:'Collect TCG MY & SG'}
      }
    }:{})
  };
  return JSON.stringify(product).replace(/</g,'\\u003c');
}

function metadataBlock(card,url){
  const titleParts=[card?.year,card?.name,card?.card_code,gradeLabel(card)]
    .map(v=>String(v||'').trim()).filter(Boolean);
  const title=`${titleParts.join(' · ')||'Trading Card'} | Collect TCG MY & SG`.slice(0,180);
  const description=descriptionFor(card);
  const image=mainImage(card);
  const tags=[
    SEO_START,
    `<meta name="collect-tcg-site-base" content="${escapeHtml(config.publicBase)}">`,
    `<meta name="collect-tcg-card-id" content="${escapeHtml(card.id)}">`,
    `<meta name="robots" content="${escapeHtml(config.robotsMeta)}">`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    '<meta property="og:type" content="product">',
    '<meta property="og:site_name" content="Collect TCG MY & SG">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    ...(image?[`<meta property="og:image" content="${escapeHtml(image)}">`]:[]),
    `<meta name="twitter:card" content="${image?'summary_large_image':'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    ...(image?[`<meta name="twitter:image" content="${escapeHtml(image)}">`]:[]),
    `<script type="application/ld+json">${productJsonLd(card,url)}</script>`,
    SEO_END
  ];
  return {title,html:tags.join('\n')};
}

function replaceSeoMeta(html,block,title){
  const markerPattern=new RegExp(`${SEO_START}[\\s\\S]*?${SEO_END}`,'m');
  let next=markerPattern.test(html)
    ? html.replace(markerPattern,block)
    : html.replace('</title>',`</title>\n${block}`);
  next=next.replace(/<title>[\s\S]*?<\/title>/i,`<title>${escapeHtml(title)}</title>`);
  if(!/<base\s/i.test(next)){
    next=next.replace(/<head>/i,`<head>\n<base href="${escapeHtml(config.sitePath)}">`);
  }
  return next;
}

function noscriptSnapshot(card,url){
  const image=mainImage(card);
  const price=priceOffer(card);
  const lines=[card?.year,card?.game,card?.series,card?.card_code,gradeLabel(card),card?.language,card?.availability].filter(Boolean);
  return `<noscript><main style="max-width:760px;margin:40px auto;padding:24px;font-family:Arial,sans-serif"><h1>${escapeHtml(card?.name||'Trading card')}</h1>${image?`<img src="${escapeHtml(image)}" alt="${escapeHtml(card?.name||'Trading card')}" style="max-width:360px;width:100%;height:auto">`:''}<p>${escapeHtml(lines.join(' · '))}</p>${price?`<p>${escapeHtml(price.currency)} ${escapeHtml(price.price)}</p>`:''}<p><a href="${escapeHtml(url)}">Collect TCG MY &amp; SG card listing</a></p></main></noscript>`;
}

function renderCardPage(indexHtml,card,slug){
  const url=new URL(`cards/${slug}/`,config.publicBase).toString();
  const meta=metadataBlock(card,url);
  let html=replaceSeoMeta(indexHtml,meta.html,meta.title);
  html=html.replace(/<body([^>]*)>/i,match=>`${match}\n${noscriptSnapshot(card,url)}`);
  return {html,url};
}

function xmlEscape(value){
  return String(value??'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function sitemapXml(urls){
  const body=urls.map(url=>`  <url><loc>${xmlEscape(url)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function runtimeConfig(){
  const source=await fs.readFile(config.runtimeFile,'utf8');
  const url=source.match(/PRODUCTION_URL\s*=\s*['"]([^'"]+)['"]/)?.[1];
  const key=source.match(/PRODUCTION_KEY\s*=\s*['"]([^'"]+)['"]/)?.[1];
  if(!url||!key) throw new Error('Could not read Supabase public runtime configuration');
  return {url,key};
}

async function fetchCards(){
  const runtime=await runtimeConfig();
  const light='id,name,card_code,year,game,language,era,availability,set_name,series,format,rarity,condition,quantity,price,price_usd,price_myr,price_sgd,notes,thumbnail_url,grading,created_at,updated_at';
  const full='id,name,card_code,year,game,language,era,availability,set_name,series,format,rarity,condition,quantity,price,price_usd,price_myr,price_sgd,notes,images,grading,created_at,updated_at';

  async function fetchWithColumns(columns){
    const rows=[];
    for(let offset=0;;offset+=1000){
      const endpoint=new URL('/rest/v1/cards',runtime.url);
      endpoint.searchParams.set('select',columns);
      endpoint.searchParams.set('order','created_at.asc');
      endpoint.searchParams.set('limit','1000');
      endpoint.searchParams.set('offset',String(offset));
      const response=await fetch(endpoint,{headers:{apikey:runtime.key,Authorization:`Bearer ${runtime.key}`}});
      if(!response.ok){
        const body=await response.text();
        const error=new Error(`Supabase public catalogue request failed (${response.status}): ${body.slice(0,500)}`);
        error.status=response.status;
        throw error;
      }
      const batch=await response.json();
      if(!Array.isArray(batch)) throw new Error('Supabase catalogue response was not an array');
      rows.push(...batch);
      if(batch.length<1000) break;
    }
    return rows;
  }

  try{return await fetchWithColumns(light);}
  catch(error){
    if(error?.status===400){
      try{return await fetchWithColumns(full);}
      catch(fullError){
        if(fullError?.status!==401 && fullError?.status!==403) throw fullError;
      }
    }else if(error?.status!==401 && error?.status!==403){
      throw error;
    }
  }

  const rpcEndpoint=new URL('/rest/v1/rpc/get_public_seo_cards',runtime.url);
  const response=await fetch(rpcEndpoint,{
    method:'POST',
    headers:{
      apikey:runtime.key,
      Authorization:`Bearer ${runtime.key}`,
      'Content-Type':'application/json'
    },
    body:'{}'
  });
  if(!response.ok){
    const body=await response.text();
    throw new Error(
      `SEO catalogue RPC unavailable (${response.status}). Run 2026-09-24-v01-SEO-PUBLIC-CATALOG.sql in Supabase before generating SEO pages. ${body.slice(0,350)}`
    );
  }
  const data=await response.json();
  if(!Array.isArray(data)) throw new Error('SEO catalogue RPC response was not an array');
  return data;
}

async function readSlugState(){
  const file=path.join(config.outputDir,'seo-slugs.json');
  try{
    const parsed=JSON.parse(await fs.readFile(file,'utf8'));
    return parsed&&typeof parsed==='object'&&parsed.cards&&typeof parsed.cards==='object'
      ? parsed
      : {version:1,cards:{}};
  }catch{
    return {version:1,cards:{}};
  }
}

async function generate(){
  const [indexHtml,cards,state]=await Promise.all([
    fs.readFile(config.sourceIndex,'utf8'),
    fetchCards(),
    readSlugState()
  ]);

  const liveCards=cards.filter(card=>card&&card.id&&card.name);
  const nextState={version:1,cards:{}};
  const cardsDir=path.join(config.outputDir,'cards');
  await fs.rm(cardsDir,{recursive:true,force:true});
  await fs.mkdir(cardsDir,{recursive:true});

  const urls=[config.publicBase];
  const usedSlugs=new Set();
  const allocateSlug=(preferred)=>{
    const base=slugPart(preferred)||'card';
    if(!usedSlugs.has(base)){
      usedSlugs.add(base);
      return base;
    }
    let suffix=2;
    while(usedSlugs.has(`${base}-${suffix}`)) suffix+=1;
    const unique=`${base}-${suffix}`;
    usedSlugs.add(unique);
    return unique;
  };
  for(const card of liveCards){
    const previous=state.cards?.[card.id]?.slug;
    const slug=allocateSlug(previous||cardSlug(card));
    nextState.cards[card.id]={slug};
    const rendered=renderCardPage(indexHtml,card,slug);
    const dir=path.join(cardsDir,slug);
    await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,'index.html'),rendered.html,'utf8');
    urls.push(rendered.url);
  }

  await fs.writeFile(path.join(config.outputDir,'seo-slugs.json'),JSON.stringify(nextState,null,2)+'\n','utf8');
  await fs.writeFile(path.join(config.outputDir,'sitemap.xml'),sitemapXml(urls),'utf8');
  await fs.writeFile(path.join(config.outputDir,'robots.txt'),config.robotsTxt,'utf8');

  process.stdout.write(`Generated ${liveCards.length} SEO card pages for ${mode}.\n`);
}

function runSelfTest(){
  const card={
    id:'12345678-1234-1234-1234-123456789abc',
    name:'LUFFY & NAMI',card_code:'C01',year:1999,game:'One Piece',series:'Hyper Battle',
    language:'JP',availability:'Available',price_usd:1200,
    grading:[{company:'PSA',grade:'8'}],thumbnail_url:'https://example.com/card.jpg'
  };
  const slug=cardSlug(card);
  if(!slug.includes('luffy-and-nami')||!slug.includes('psa-8')) throw new Error('Slug self-test failed');
  const rendered=renderCardPage(
    '<!doctype html><html><head><title>X</title></head><body><div id="app"></div></body></html>',
    card,slug
  );
  for(const needle of ['rel="canonical"','application/ld+json','collect-tcg-card-id','og:image','<base href=']){
    if(!rendered.html.includes(needle)) throw new Error(`Render self-test missing ${needle}`);
  }
  if(rendered.url.includes(card.id)||!rendered.url.endsWith(`/${slug}/`)) throw new Error('SEO URL self-test failed');
  process.stdout.write('SEO generator self-test passed.\n');
}

if(selfTest) runSelfTest();
else await generate();
