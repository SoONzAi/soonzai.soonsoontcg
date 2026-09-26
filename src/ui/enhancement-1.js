/** Preserved supplementary UI behavior. */
export function setup(appContext){
  const localStorage=appContext.localStorage;
  const sessionStorage=appContext.sessionStorage;
  const fetch=appContext.fetch;

(function(){
  const btn = document.getElementById("backToTopBtn");
  const shell = document.querySelector(".shell");
  if(!btn) return;

  function mobileUsesShellScroll(){
    return window.matchMedia("(max-width: 800px)").matches && shell;
  }

  function currentScrollTop(){
    if(mobileUsesShellScroll()) return shell.scrollTop || 0;
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function updateBackToTop(){
    btn.classList.toggle("show", currentScrollTop() > 350);
  }

  btn.addEventListener("click", function(){
    if(mobileUsesShellScroll()){
      shell.scrollTo({ top: 0, behavior: "smooth" });
    }else{
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  window.addEventListener("scroll", updateBackToTop, { passive: true });
  if(shell) shell.addEventListener("scroll", updateBackToTop, { passive: true });
  let backToTopResizeRaf=0;
  window.addEventListener("resize", ()=>{
    if(backToTopResizeRaf) cancelAnimationFrame(backToTopResizeRaf);
    backToTopResizeRaf=requestAnimationFrame(()=>{
      backToTopResizeRaf=0;
      updateBackToTop();
    });
  }, { passive: true });
  updateBackToTop();
})();

}
