/**
 * UI notifications module for SoonSoonTCG.
 * Provides fallback / notification hooks into appContext.
 */
export function register(appContext) {
  // Ensure showToast fallback exists on appContext if not already provided
  if (!appContext.showToast) {
    appContext.showToast = function(message) {
      const toastEl = document.getElementById('toast');
      if (toastEl) {
        toastEl.textContent = message;
        toastEl.hidden = false;
        toastEl.classList.add('show');
        clearTimeout(toastEl._timer);
        toastEl._timer = setTimeout(() => {
          toastEl.classList.remove('show');
          toastEl.hidden = true;
        }, 3200);
      } else {
        console.log('[Toast]', message);
      }
    };
  }
}
