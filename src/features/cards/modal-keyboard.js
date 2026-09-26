/** Shared modal keyboard/focus controller extracted from card details. */
export function createModalKeyboardController({getOverlay,getInitialFocus,onEscape}){
  let lastFocused=null;
  function open(){
    lastFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    requestAnimationFrame(()=>getInitialFocus?.()?.focus?.());
  }
  function close(){
    const target=lastFocused;lastFocused=null;
    if(target?.isConnected)requestAnimationFrame(()=>{try{target.focus({preventScroll:true});}catch{target.focus();}});
  }
  function keydown(event){
    const overlay=getOverlay?.();
    if(!overlay||overlay.hidden)return;
    if(event.key==="Escape"){event.preventDefault();onEscape?.();return;}
    if(event.key!=="Tab")return;
    const focusable=Array.from(overlay.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>!el.hidden&&getComputedStyle(el).display!=="none");
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  return {open,close,keydown};
}
