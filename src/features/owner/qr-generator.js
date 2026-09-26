/** 2026-09-17-v04: owner-only URL QR generator promoted from Beta v13. */
export function register(appContext){
  const originalSubmode=appContext.currentInventoryToolSubmode;
  const originalSwitcher=appContext.inventoryToolsSwitcher;
  const originalRenderInventoryToolsPage=appContext.renderInventoryToolsPage;

  function ensureQrStyles(){
    if(document.getElementById('collectOwnerQrGeneratorStyles')) return;
    const style=document.createElement('style');
    style.id='collectOwnerQrGeneratorStyles';
    style.textContent='.qr-generator-panel{max-width:760px;display:grid;gap:14px}.qr-generator-panel label{display:grid;gap:4px}.qr-generator-panel label span{color:var(--muted);font-size:12px}.qr-generator-entry{display:flex;gap:8px}.qr-generator-entry input{min-width:0;flex:1}.qr-generator-result{display:grid;justify-items:center;gap:14px;padding:20px;border:1px solid var(--border);border-radius:12px;background:var(--surface-soft,rgba(255,255,255,.025))}.qr-generator-code{display:grid;place-items:center;padding:12px;border-radius:10px;background:#fff;line-height:0}.qr-generator-code canvas,.qr-generator-code img{display:block;max-width:min(100%,360px);height:auto}.qr-generator-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}@media(max-width:600px){.qr-generator-entry{flex-direction:column}.qr-generator-entry button{width:100%}.qr-generator-code canvas,.qr-generator-code img{max-width:260px}}';
    document.head.appendChild(style);
  }

  function addQrSubnavLink(){
    const subnav=appContext.view?.querySelector('.inventory-tools-subnav');
    if(!subnav || subnav.querySelector('[data-owner-qr-generator-link]')) return;
    const link=document.createElement('a');
    link.href='#/inventory-tools?mode=activity&sub=qr';
    link.dataset.ownerQrGeneratorLink='1';
    link.textContent='QR Generator';
    if(String(appContext.currentHashParams?.().get('sub')||'')==='qr') link.classList.add('active');
    subnav.appendChild(link);
  }

  function renderQrGeneratorPage(){
    if(!appContext.requireOwner('open QR generator')) return;
    ensureQrStyles();
    appContext.view.innerHTML=`
      <div class="page-head"><div><div class="eyebrow">Inventory Tools · Activity</div><h2>QR Generator</h2><p>Create a scannable QR code for any website link.</p></div></div>
      <section class="panel qr-generator-panel">
        <label for="qrGeneratorUrl"><strong>Destination URL</strong><span>Paste the full link you want customers to open.</span></label>
        <div class="qr-generator-entry"><input id="qrGeneratorUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://example.com"><button type="button" class="btn-primary" id="generateQrBtn">Generate QR</button></div>
        <p class="hint" id="qrGeneratorMessage" aria-live="polite">HTTPS links are recommended.</p>
        <div class="qr-generator-result" id="qrGeneratorResult" hidden>
          <div class="qr-generator-code" id="qrGeneratorCode" aria-label="Generated QR code"></div>
          <div class="qr-generator-actions"><button type="button" class="btn-ghost" id="copyQrUrlBtn">Copy Link</button><button type="button" class="btn-primary" id="downloadQrBtn">Download PNG</button></div>
        </div>
      </section>`;

    if(typeof originalSwitcher==='function'){
      const pageHead=appContext.view.querySelector('.page-head');
      if(pageHead){
        pageHead.insertAdjacentHTML('afterend',originalSwitcher.call(appContext,'activity','qr'));
        addQrSubnavLink();
      }
    }

    const input=appContext.$('qrGeneratorUrl');
    const message=appContext.$('qrGeneratorMessage');
    const result=appContext.$('qrGeneratorResult');
    const holder=appContext.$('qrGeneratorCode');
    let currentUrl='';
    const normaliseUrl=()=>{
      const raw=String(input?.value||'').trim();
      if(!raw) throw new Error('Enter a link first.');
      const url=new URL(raw);
      if(!/^https?:$/.test(url.protocol)) throw new Error('Use an http or https link.');
      return url.href;
    };
    const generate=()=>{
      try{
        if(typeof QRCode!=='function') throw new Error('QR generator could not load. Please refresh and try again.');
        currentUrl=normaliseUrl();
        input.value=currentUrl;
        holder.innerHTML='';
        new QRCode(holder,{text:currentUrl,width:360,height:360,colorDark:'#111216',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
        result.hidden=false;
        message.textContent='QR code ready to scan or download.';
      }catch(error){
        result.hidden=true;
        message.textContent=error?.message||'Could not create the QR code.';
      }
    };
    appContext.$('generateQrBtn')?.addEventListener('click',generate);
    input?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();generate();}});
    appContext.$('copyQrUrlBtn')?.addEventListener('click',()=>{if(currentUrl) appContext.copyPlainText(currentUrl,'QR link copied');});
    appContext.$('downloadQrBtn')?.addEventListener('click',()=>{
      const canvas=holder.querySelector('canvas');
      const image=holder.querySelector('img');
      const href=canvas ? canvas.toDataURL('image/png') : image?.src;
      if(!href){appContext.showToast('Generate a QR code first.');return;}
      const link=document.createElement('a');
      link.href=href;
      link.download='Collect-TCG-QR-Code.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      appContext.showToast('QR code downloaded');
    });
  }

  if(typeof originalSubmode==='function'){
    appContext.currentInventoryToolSubmode=function(mode){
      if(mode==='activity' && String(appContext.currentHashParams?.().get('sub')||'')==='qr') return 'qr';
      return originalSubmode.call(appContext,mode);
    };
  }

  if(typeof originalRenderInventoryToolsPage==='function'){
    appContext.renderInventoryToolsPage=function(...args){
      const mode=appContext.currentInventoryToolMode?.();
      const sub=String(appContext.currentHashParams?.().get('sub')||'');
      if(mode==='activity' && sub==='qr') return renderQrGeneratorPage();
      const result=originalRenderInventoryToolsPage.apply(appContext,args);
      if(mode==='activity') addQrSubnavLink();
      return result;
    };
  }

  Object.assign(appContext,{renderQrGeneratorPage});
}
